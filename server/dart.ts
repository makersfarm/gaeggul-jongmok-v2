import AdmZip from "adm-zip";
import { cachePath, readJsonCache, writeJsonCache } from "./storage";
import type { CorpCodeRow, FinancialSnapshot } from "./types";
import { amountFrom, ratio } from "./utils";

const REPORT_CODE = "11011";

export async function getCorpCodeMap() {
  const path = cachePath("dart", "corp-codes.json");
  const cached = readJsonCache<CorpCodeRow[]>(path);
  if (cached?.length) return cached;

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`);
  const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
  const xml = zip.getEntries()[0]?.getData().toString("utf-8") ?? "";
  const rows = [...xml.matchAll(/<list>([\s\S]*?)<\/list>/g)]
    .map((match) => {
      const block = match[1];
      const get = (tag: string) => block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? "";
      return {
        corp_code: get("corp_code"),
        corp_name: get("corp_name"),
        stock_code: get("stock_code"),
        modify_date: get("modify_date"),
      };
    })
    .filter((row) => row.stock_code);

  writeJsonCache(path, rows);
  return rows;
}

export async function getFinancialSnapshot(stockCode: string, year = String(new Date().getFullYear() - 1)): Promise<FinancialSnapshot | null> {
  const path = cachePath("dart", "fundamentals", `${stockCode}-${year}.json`);
  const cached = readJsonCache<FinancialSnapshot>(path);
  if (cached?.metrics && "roicProxy" in cached.metrics) return cached;

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) return null;

  const corp = (await getCorpCodeMap()).find((row) => row.stock_code === stockCode);
  if (!corp) return null;

  const url = `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?crtfc_key=${apiKey}&corp_code=${corp.corp_code}&bsns_year=${year}&reprt_code=${REPORT_CODE}`;
  const payload = await fetch(url).then((res) => res.json());
  const list = Array.isArray(payload.list) ? payload.list : [];
  const preferred = list.some((item: any) => item.fs_div === "CFS") ? list.filter((item: any) => item.fs_div === "CFS") : list;
  const account = (name: string) =>
    amountFrom(preferred.find((item: any) => item.account_nm === name || String(item.account_nm).includes(name))?.thstrm_amount);

  const revenue = account("매출액");
  const operatingIncome = account("영업이익");
  const netIncome = account("당기순이익");
  const assets = account("자산총계");
  const liabilities = account("부채총계");
  const equity = account("자본총계");
  const investedCapital = equity !== null && liabilities !== null ? equity + liabilities : null;
  const ebitProxy = operatingIncome;
  const ebitdaProxy = operatingIncome;

  const snapshot: FinancialSnapshot = {
    source: "opendart-fnlttSinglAcnt",
    stockCode,
    corp,
    year,
    reportCode: REPORT_CODE,
    storedAt: new Date().toISOString(),
    accounts: preferred,
    metrics: {
      revenue,
      operatingIncome,
      netIncome,
      assets,
      liabilities,
      equity,
      operatingMargin: ratio(operatingIncome, revenue),
      netMargin: ratio(netIncome, revenue),
      debtRatio: ratio(liabilities, equity),
      roe: ratio(netIncome, equity),
      investedCapital,
      roiProxy: ratio(netIncome, assets),
      roicProxy: ratio(operatingIncome, investedCapital),
      ebitProxy,
      ebitdaProxy,
    },
  };

  writeJsonCache(path, snapshot);
  return snapshot;
}

export async function getFinancialTrend(stockCode: string, years = 5): Promise<FinancialSnapshot[]> {
  const latestYear = new Date().getFullYear() - 1;
  const targets = Array.from({ length: years }, (_, index) => String(latestYear - index));
  const snapshots = await Promise.all(targets.map((year) => getFinancialSnapshot(stockCode, year)));
  return snapshots.filter((snapshot): snapshot is FinancialSnapshot => Boolean(snapshot)).sort((a, b) => Number(a.year) - Number(b.year));
}
