export const NAVER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36",
  referer: "https://finance.naver.com/",
};

export function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function numberFrom(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value.replace(/[,+%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function amountFrom(value: string | undefined) {
  if (!value || value === "-") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
