import type { FinancialSnapshot, MarketRow, StockAnalysis, TechnicalSnapshot } from "./types";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function ratioText(value: number | null | undefined) {
  return value === null || value === undefined ? "미확인" : `${value.toLocaleString("ko-KR")}%`;
}

function moneyText(value: number | null | undefined) {
  if (value === null || value === undefined) return "미확인";
  if (Math.abs(value) >= 1_0000_0000_0000) return `${Math.round(value / 1_0000_0000_0000).toLocaleString("ko-KR")}조`;
  if (Math.abs(value) >= 1_0000_0000) return `${Math.round(value / 1_0000_0000).toLocaleString("ko-KR")}억`;
  return value.toLocaleString("ko-KR");
}

export function buildAnalysis(
  stock: MarketRow,
  financial: FinancialSnapshot | null,
  technical: TechnicalSnapshot | null,
): StockAnalysis {
  const metrics = financial?.metrics;
  const operatingMargin = metrics?.operatingMargin ?? null;
  const debtRatio = metrics?.debtRatio ?? null;
  const roe = metrics?.roe ?? null;
  const latestClose = technical?.indicators.latestClose ?? stock.price;
  const ma20 = technical?.indicators.ma20 ?? null;
  const ma60 = technical?.indicators.ma60 ?? null;
  const priceAboveMa20 = ma20 ? latestClose > ma20 : false;
  const priceAboveMa60 = ma60 ? latestClose > ma60 : false;
  const quality = clamp(
    45 +
      (operatingMargin ?? 0) * 1.8 +
      (roe ?? 0) * 1.4 -
      Math.max((debtRatio ?? 160) - 100, 0) * 0.2 +
      (priceAboveMa20 ? 6 : -3) +
      (priceAboveMa60 ? 6 : -3),
  );
  const grade = quality >= 78 ? "우수" : quality >= 64 ? "양호" : quality >= 50 ? "중립" : "주의";

  return {
    stock,
    financial,
    technical,
    grade,
    summary: financial
      ? `${financial.year}년 사업보고서 기준 매출 ${moneyText(metrics?.revenue)}, 영업이익률 ${ratioText(operatingMargin)}, ROE ${ratioText(roe)}, 부채비율 ${ratioText(debtRatio)}입니다. 가격은 20일선 ${priceAboveMa20 ? "위" : "아래"}, 60일선 ${priceAboveMa60 ? "위" : "아래"}에 있습니다.`
      : "DART 재무제표가 아직 수집되지 않아 시세 기반 예비 분석만 제공합니다.",
    metrics: [
      {
        label: "영업이익률",
        value: ratioText(operatingMargin),
        description: "매출에서 본업 이익이 얼마나 남는지 봅니다.",
        status: (operatingMargin ?? 0) >= 10 ? "good" : (operatingMargin ?? 0) >= 3 ? "neutral" : "danger",
      },
      {
        label: "ROE",
        value: ratioText(roe),
        description: "자본으로 순이익을 얼마나 만들었는지 봅니다.",
        status: (roe ?? 0) >= 10 ? "good" : (roe ?? 0) >= 3 ? "neutral" : "danger",
      },
      {
        label: "부채비율",
        value: ratioText(debtRatio),
        description: "자본 대비 빚 부담입니다. 낮을수록 안정적입니다.",
        status: debtRatio === null ? "neutral" : debtRatio <= 100 ? "good" : debtRatio <= 200 ? "neutral" : "danger",
      },
      {
        label: "20일선 위치",
        value: ma20 ? `${latestClose > ma20 ? "상단" : "하단"} (${ma20.toLocaleString("ko-KR")})` : "미확인",
        description: "단기 추세의 기준선입니다.",
        status: priceAboveMa20 ? "good" : "neutral",
      },
      {
        label: "V25",
        value: technical?.indicators.v25?.toLocaleString("ko-KR") ?? "미확인",
        description: "최근 25거래일 평균 거래량입니다.",
        status: "neutral",
      },
      {
        label: "지지/저항",
        value:
          technical?.indicators.support20 && technical.indicators.resistance20
            ? `${technical.indicators.support20.toLocaleString("ko-KR")} / ${technical.indicators.resistance20.toLocaleString("ko-KR")}`
            : "미확인",
        description: "최근 20거래일 저점과 고점입니다.",
        status: "neutral",
      },
    ],
    checklist: [
      {
        label: "재무제표 수집",
        passed: Boolean(financial),
        detail: financial ? `${financial.corp.corp_name} ${financial.year}년 사업보고서 주요 계정을 저장했습니다.` : "DART 재무제표 수집이 필요합니다.",
      },
      {
        label: "본업 수익성",
        passed: (operatingMargin ?? 0) >= 3,
        detail: `영업이익률 ${ratioText(operatingMargin)}입니다.`,
      },
      {
        label: "재무 안정성",
        passed: debtRatio !== null && debtRatio <= 200,
        detail: `부채비율 ${ratioText(debtRatio)}입니다.`,
      },
      {
        label: "추세 확인",
        passed: priceAboveMa20 || priceAboveMa60,
        detail: `20일선 ${priceAboveMa20 ? "위" : "아래"}, 60일선 ${priceAboveMa60 ? "위" : "아래"}입니다.`,
      },
    ],
  };
}
