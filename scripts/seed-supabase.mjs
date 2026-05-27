import AdmZip from "adm-zip";
import iconv from "iconv-lite";
import { readFileSync } from "node:fs";

const REPORT_CODE = "11011";
const NAVER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36",
  referer: "https://finance.naver.com/",
};

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dartApiKey = process.env.DART_API_KEY;
const marketArg = argValue("--market", "KOSPI");
const includeMarkets = marketArg === "ALL" ? ["KOSPI", "KOSDAQ"] : [marketArg];
const years = Number(argValue("--years", "5"));
const maxStocks = Number(argValue("--max-stocks", "0"));
const includeFinancials = !process.argv.includes("--skip-financials");
const delayMs = Number(argValue("--delay-ms", "140"));
const dryRun = process.argv.includes("--dry-run");

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

console.log(`[seed] markets=${includeMarkets.join(",")} years=${years} financials=${includeFinancials}`);

const marketRows = await getAllMarketRows(includeMarkets);
const rows = maxStocks > 0 ? marketRows.slice(0, maxStocks) : marketRows;
console.log(`[seed] market rows=${rows.length}`);

if (dryRun) {
  const sample = rows.slice(0, 8).map((row) => `${row.market} ${row.code} ${row.name}`).join(" / ");
  console.log(`[seed] dry-run sample=${sample}`);
  process.exit(0);
}

const corpMap = includeFinancials ? await getCorpCodeMap() : [];
const corpByStock = new Map(corpMap.map((corp) => [corp.stock_code, corp]));

await upsert("stocks", rows.map((row) => {
  const corp = corpByStock.get(row.code);
  return {
    stock_code: row.code,
    name: row.name,
    market: row.market,
    corp_code: corp?.corp_code ?? null,
    corp_name: corp?.corp_name ?? null,
    listed: true,
    source: "naver-finance",
    updated_at: new Date().toISOString(),
  };
}), "stock_code");

await upsert("latest_quotes", rows.map((row, index) => ({
  stock_code: row.code,
  price: row.price || null,
  change_rate: row.changeRate,
  volume: row.volume || null,
  market_rank: index + 1,
  quote_source: "naver-finance",
  quoted_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})), "stock_code");

if (includeFinancials) {
  if (!dartApiKey) throw new Error("DART_API_KEY is required when financial preload is enabled.");
  const latestYear = new Date().getFullYear() - 1;
  const targetYears = Array.from({ length: years }, (_, index) => String(latestYear - index));
  const financialRows = [];
  let processed = 0;

  for (const stock of rows) {
    const corp = corpByStock.get(stock.code);
    if (!corp) continue;

    for (const year of targetYears) {
      const snapshot = await getFinancialSnapshot(corp, stock.code, year);
      if (snapshot) financialRows.push(snapshot);
      if (financialRows.length >= 500) {
        await upsert("financial_metrics", financialRows.splice(0), "stock_code,business_year,report_code");
      }
      await sleep(delayMs);
    }

    processed += 1;
    if (processed % 25 === 0) console.log(`[seed] financial processed=${processed}/${rows.length}`);
  }

  if (financialRows.length) {
    await upsert("financial_metrics", financialRows, "stock_code,business_year,report_code");
  }
}

console.log("[seed] done");

function loadEnv() {
  try {
    const body = readFileSync(".env", "utf-8");
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional when environment variables are already set.
  }
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase upsert ${table} failed: ${response.status} ${text}`);
  }
  console.log(`[seed] upsert ${table} rows=${rows.length}`);
}

async function getAllMarketRows(markets) {
  const pairs = markets.map((market) => [market, market === "KOSPI" ? "0" : "1"]);
  const output = [];

  for (const [market, sosok] of pairs) {
    let emptyCount = 0;
    for (let page = 1; page <= 80; page += 1) {
      const response = await fetch(`https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`, {
        headers: NAVER_HEADERS,
      });
      const html = iconv.decode(Buffer.from(await response.arrayBuffer()), "euc-kr");
      const rows = parseMarketRows(html, market);
      if (!rows.length) {
        emptyCount += 1;
        if (emptyCount >= 2) break;
      } else {
        emptyCount = 0;
        output.push(...rows);
      }
      await sleep(80);
    }
    console.log(`[seed] ${market} rows=${output.filter((row) => row.market === market).length}`);
  }

  return [...new Map(output.map((row) => [row.code, row])).values()];
}

function parseMarketRows(html, market) {
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;

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

async function getCorpCodeMap() {
  const response = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${dartApiKey}`);
  if (!response.ok) throw new Error(`OpenDART corpCode failed: ${response.status}`);
  const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
  const xml = zip.getEntries()[0]?.getData().toString("utf-8") ?? "";
  return [...xml.matchAll(/<list>([\s\S]*?)<\/list>/g)]
    .map((match) => {
      const block = match[1];
      const get = (tag) => block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? "";
      return {
        corp_code: get("corp_code"),
        corp_name: get("corp_name"),
        stock_code: get("stock_code"),
        modify_date: get("modify_date"),
      };
    })
    .filter((row) => row.stock_code);
}

async function getFinancialSnapshot(corp, stockCode, year) {
  const url = `https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?crtfc_key=${dartApiKey}&corp_code=${corp.corp_code}&bsns_year=${year}&reprt_code=${REPORT_CODE}`;
  const payload = await fetch(url).then((res) => res.json());
  const list = Array.isArray(payload.list) ? payload.list : [];
  if (!list.length) return null;

  const preferred = list.some((item) => item.fs_div === "CFS") ? list.filter((item) => item.fs_div === "CFS") : list;
  const account = (name) =>
    amountFrom(preferred.find((item) => item.account_nm === name || String(item.account_nm).includes(name))?.thstrm_amount);

  const revenue = account("매출액");
  const operatingIncome = account("영업이익");
  const netIncome = account("당기순이익");
  const assets = account("자산총계");
  const liabilities = account("부채총계");
  const equity = account("자본총계");
  const investedCapital = equity !== null && liabilities !== null ? equity + liabilities : null;

  return {
    stock_code: stockCode,
    business_year: Number(year),
    report_code: REPORT_CODE,
    revenue,
    operating_income: operatingIncome,
    net_income: netIncome,
    assets,
    liabilities,
    equity,
    operating_margin: ratio(operatingIncome, revenue),
    net_margin: ratio(netIncome, revenue),
    debt_ratio: ratio(liabilities, equity),
    roe: ratio(netIncome, equity),
    roi_proxy: ratio(netIncome, assets),
    roic_proxy: ratio(operatingIncome, investedCapital),
    ebit_proxy: operatingIncome,
    ebitda_proxy: operatingIncome,
    source: "opendart-fnlttSinglAcnt",
    stored_at: new Date().toISOString(),
  };
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function numberFrom(value) {
  if (!value) return 0;
  const parsed = Number(value.replace(/[,+%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountFrom(value) {
  if (!value || value === "-") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function ratio(numerator, denominator) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
