import iconv from "iconv-lite";
import { cachePath, readJsonCache, writeJsonCache } from "./storage";
import type { MarketRow, PricePoint, TechnicalSnapshot } from "./types";
import { average, decodeEntities, NAVER_HEADERS, numberFrom } from "./utils";

function parseMarketRows(html: string, market: "KOSPI" | "KOSDAQ") {
  const rows: MarketRow[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html))) {
    const row = rowMatch[1];
    const codeMatch = row.match(/href="\/item\/main\.naver\?code=(\d{6})"/);
    const nameMatch = row.match(/class="tltle">([^<]+)</);
    if (!codeMatch || !nameMatch) continue;

    const numberCells = [...row.matchAll(/<td class="number">([\s\S]*?)<\/td>/g)].map((cell) =>
      cell[1].replace(/<[^>]+>/g, "").trim(),
    );
    const rateMatch = row.replace(/<[^>]+>/g, " ").match(/([+-]?\d+(?:\.\d+)?)\s*%/);

    rows.push({
      code: codeMatch[1],
      name: decodeEntities(nameMatch[1].trim()),
      price: numberFrom(numberCells[0]),
      changeRate: rateMatch ? numberFrom(rateMatch[1]) : 0,
      volume: numberFrom(numberCells[5] ?? numberCells[4]),
      market,
    });
  }

  return rows;
}

export async function getMarketRows() {
  const pages = await Promise.all(
    [
      ["KOSPI", "0"],
      ["KOSDAQ", "1"],
    ].map(async ([market, sosok]) => {
      const response = await fetch(`https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=1`, {
        headers: NAVER_HEADERS,
      });
      const html = iconv.decode(Buffer.from(await response.arrayBuffer()), "euc-kr");
      return parseMarketRows(html, market as "KOSPI" | "KOSDAQ");
    }),
  );

  return pages.flat();
}

function parseNaverChart(text: string): PricePoint[] {
  return [...text.matchAll(/\[([^\]]+)\]/g)]
    .map((match) => match[1].split(",").map((part) => part.trim().replace(/^"|"$/g, "")))
    .filter((cols) => /^\d{8}$/.test(cols[0]) && cols.length >= 6)
    .map((cols) => ({
      date: `${cols[0].slice(0, 4)}-${cols[0].slice(4, 6)}-${cols[0].slice(6, 8)}`,
      close: numberFrom(cols[4]),
      open: numberFrom(cols[1]),
      high: numberFrom(cols[2]),
      low: numberFrom(cols[3]),
      volume: numberFrom(cols[5]),
    }));
}

function stddev(values: number[]) {
  if (!values.length) return null;
  const mean = average(values);
  if (mean === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function emaSeries(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  const series: (number | null)[] = [];
  let ema: number | null = null;

  values.forEach((value, index) => {
    if (index < period - 1) {
      series.push(null);
      return;
    }

    if (ema === null) {
      ema = average(values.slice(index - period + 1, index + 1));
    } else {
      ema = value * multiplier + ema * (1 - multiplier);
    }
    series.push(ema);
  });

  return series;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.filter((value) => value > 0).reduce((sum, value) => sum + value, 0) / period;
  const losses = Math.abs(recent.filter((value) => value < 0).reduce((sum, value) => sum + value, 0) / period);
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function macd(values: number[]) {
  const ema12 = emaSeries(values, 12);
  const ema26 = emaSeries(values, 26);
  const macdLine = values.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];
    return fast !== null && slow !== null ? fast - slow : null;
  });
  const compact = macdLine.filter((value): value is number => value !== null);
  const signalCompact = emaSeries(compact, 9);
  const signal = signalCompact.at(-1) ?? null;
  const line = macdLine.at(-1) ?? null;
  return {
    macd: line,
    macdSignal: signal,
    macdHistogram: line !== null && signal !== null ? line - signal : null,
  };
}

export async function getTechnicalSnapshot(stockCode: string): Promise<TechnicalSnapshot> {
  const path = cachePath("market", "prices", `${stockCode}.json`);
  const cached = readJsonCache<TechnicalSnapshot>(path);
  if (cached?.indicators && "rsi14" in cached.indicators && "ma120" in cached.indicators) return cached;

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 430);
  const format = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://api.finance.naver.com/siseJson.naver?symbol=${stockCode}&requestType=1&startTime=${format(start)}&endTime=${format(end)}&timeframe=day`;
  const arrayBuffer = await fetch(url, { headers: NAVER_HEADERS }).then((res) => res.arrayBuffer());
  const text = iconv.decode(Buffer.from(new Uint8Array(arrayBuffer)), "euc-kr");
  const prices = parseNaverChart(text);
  const closes = prices.map((point) => point.close).filter(Boolean);
  const volumes = prices.map((point) => point.volume).filter(Boolean);
  const recent20 = prices.slice(-20);
  const recent60 = prices.slice(-60);
  const latestClose = prices.at(-1)?.close ?? null;
  const latestVolume = prices.at(-1)?.volume ?? null;
  const ma20 = average(closes.slice(-20));
  const ma60 = average(closes.slice(-60));
  const ma120 = average(closes.slice(-120));
  const v25 = average(volumes.slice(-25));
  const recent20Closes = closes.slice(-20);
  const volatilityBase = stddev(recent20Closes);
  const bollingerMiddle = ma20;
  const bollingerUpper = bollingerMiddle !== null && volatilityBase !== null ? bollingerMiddle + volatilityBase * 2 : null;
  const bollingerLower = bollingerMiddle !== null && volatilityBase !== null ? bollingerMiddle - volatilityBase * 2 : null;
  const macdValues = macd(closes);
  const trendScore =
    latestClose === null
      ? null
      : Math.round(
          [
            ma20 !== null ? (latestClose > ma20 ? 22 : -8) : 0,
            ma60 !== null ? (latestClose > ma60 ? 22 : -8) : 0,
            ma120 !== null ? (latestClose > ma120 ? 18 : -6) : 0,
            macdValues.macdHistogram !== null ? (macdValues.macdHistogram > 0 ? 18 : -6) : 0,
            latestVolume !== null && v25 !== null ? (latestVolume > v25 ? 10 : 0) : 0,
          ].reduce((sum, value) => sum + value, 40),
        );
  const snapshot: TechnicalSnapshot = {
    source: "naver-siseJson",
    stockCode,
    storedAt: new Date().toISOString(),
    prices,
    indicators: {
      latestClose,
      ma5: average(closes.slice(-5)),
      ma20,
      ma60,
      ma120,
      v25,
      volumeRatio25: latestVolume !== null && v25 ? (latestVolume / v25) * 100 : null,
      support20: recent20.length ? Math.min(...recent20.map((point) => point.low)) : null,
      resistance20: recent20.length ? Math.max(...recent20.map((point) => point.high)) : null,
      support60: recent60.length ? Math.min(...recent60.map((point) => point.low)) : null,
      resistance60: recent60.length ? Math.max(...recent60.map((point) => point.high)) : null,
      rsi14: rsi(closes, 14),
      ...macdValues,
      bollingerUpper,
      bollingerMiddle,
      bollingerLower,
      volatility20: latestClose !== null && volatilityBase !== null ? (volatilityBase / latestClose) * 100 : null,
      trendScore,
    },
  };

  writeJsonCache(path, snapshot);
  return snapshot;
}
