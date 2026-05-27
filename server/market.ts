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

export async function getTechnicalSnapshot(stockCode: string): Promise<TechnicalSnapshot> {
  const path = cachePath("market", "prices", `${stockCode}.json`);
  const cached = readJsonCache<TechnicalSnapshot>(path);
  if (cached) return cached;

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 220);
  const format = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://api.finance.naver.com/siseJson.naver?symbol=${stockCode}&requestType=1&startTime=${format(start)}&endTime=${format(end)}&timeframe=day`;
  const arrayBuffer = await fetch(url, { headers: NAVER_HEADERS }).then((res) => res.arrayBuffer());
  const text = iconv.decode(Buffer.from(new Uint8Array(arrayBuffer)), "euc-kr");
  const prices = parseNaverChart(text);
  const closes = prices.map((point) => point.close).filter(Boolean);
  const volumes = prices.map((point) => point.volume).filter(Boolean);
  const recent20 = prices.slice(-20);
  const snapshot: TechnicalSnapshot = {
    source: "naver-siseJson",
    stockCode,
    storedAt: new Date().toISOString(),
    prices,
    indicators: {
      latestClose: prices.at(-1)?.close ?? null,
      ma5: average(closes.slice(-5)),
      ma20: average(closes.slice(-20)),
      ma60: average(closes.slice(-60)),
      v25: average(volumes.slice(-25)),
      support20: recent20.length ? Math.min(...recent20.map((point) => point.low)) : null,
      resistance20: recent20.length ? Math.max(...recent20.map((point) => point.high)) : null,
    },
  };

  writeJsonCache(path, snapshot);
  return snapshot;
}
