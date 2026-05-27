import type {
  ChartSeries,
  FinancialSnapshot,
  LearningItem,
  MarketRow,
  StockAnalysis,
  TechnicalSnapshot,
  TrendPoint,
} from "./types";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function ratioText(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "미확인" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;
}

function moneyText(value: number | null | undefined) {
  if (value === null || value === undefined) return "미확인";
  if (Math.abs(value) >= 1_0000_0000_0000) return `${Math.round(value / 1_0000_0000_0000).toLocaleString("ko-KR")}조`;
  if (Math.abs(value) >= 1_0000_0000) return `${Math.round(value / 1_0000_0000).toLocaleString("ko-KR")}억`;
  return value.toLocaleString("ko-KR");
}

function numText(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined ? "미확인" : value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function growth(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function cagr(first: number | null | undefined, last: number | null | undefined, periods: number) {
  if (!first || !last || first <= 0 || last <= 0 || periods <= 0) return null;
  return (Math.pow(last / first, 1 / periods) - 1) * 100;
}

function change(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return current - previous;
}

function buildTrend(financials: FinancialSnapshot[]): TrendPoint[] {
  return financials.map((snapshot, index) => {
    const previous = financials[index - 1]?.metrics;
    const metrics = snapshot.metrics;
    return {
      year: snapshot.year,
      revenue: metrics.revenue,
      operatingIncome: metrics.operatingIncome,
      netIncome: metrics.netIncome,
      operatingMargin: metrics.operatingMargin,
      netMargin: metrics.netMargin,
      roe: metrics.roe,
      debtRatio: metrics.debtRatio,
      roiProxy: metrics.roiProxy,
      roicProxy: metrics.roicProxy,
      revenueGrowth: growth(metrics.revenue, previous?.revenue),
      operatingIncomeGrowth: growth(metrics.operatingIncome, previous?.operatingIncome),
      netIncomeGrowth: growth(metrics.netIncome, previous?.netIncome),
      roeChange: change(metrics.roe, previous?.roe),
      operatingMarginChange: change(metrics.operatingMargin, previous?.operatingMargin),
    };
  });
}

function statusBy(value: number | null | undefined, good: number, neutral: number, lowerIsBetter = false) {
  if (value === null || value === undefined) return "neutral" as const;
  if (lowerIsBetter) {
    if (value <= good) return "good" as const;
    if (value <= neutral) return "neutral" as const;
    return "danger" as const;
  }
  if (value >= good) return "good" as const;
  if (value >= neutral) return "neutral" as const;
  return "danger" as const;
}

function makeLearning(): LearningItem[] {
  return [
    {
      key: "revenue-cagr",
      title: "매출 성장률",
      formula: "5년 CAGR = (마지막해 매출 / 첫해 매출)^(1/기간) - 1",
      beginner: "회사가 실제로 커지고 있는지 보는 가장 기본적인 성장 지표예요.",
      interpretation: "꾸준히 양수면 시장 점유율이나 판매량이 커지는 신호입니다.",
      caution: "매출만 커지고 이익이 줄면 비용 구조가 나빠졌을 수 있어요.",
    },
    {
      key: "operating-margin",
      title: "영업이익률",
      formula: "영업이익률 = 영업이익 / 매출액 x 100",
      beginner: "본업으로 100원을 팔았을 때 얼마가 남는지 보는 지표예요.",
      interpretation: "높거나 개선되면 가격 결정력, 원가 관리, 제품 경쟁력이 좋다는 뜻일 수 있습니다.",
      caution: "업종마다 정상 범위가 다르므로 같은 업종끼리 비교해야 합니다.",
    },
    {
      key: "roe",
      title: "ROE",
      formula: "ROE = 당기순이익 / 자본총계 x 100",
      beginner: "주주 돈을 얼마나 효율적으로 굴렸는지 보는 지표예요.",
      interpretation: "10% 이상이 꾸준하면 자본 효율이 좋은 편으로 봅니다.",
      caution: "부채를 크게 늘려 ROE가 높아질 수도 있어 부채비율과 같이 봐야 합니다.",
    },
    {
      key: "roic",
      title: "ROIC 근사치",
      formula: "ROIC 근사 = 영업이익 / (부채총계 + 자본총계) x 100",
      beginner: "회사에 들어간 전체 돈이 본업 이익을 얼마나 만드는지 보는 값이에요.",
      interpretation: "자본비용보다 높게 유지되면 좋은 사업 모델일 가능성이 커집니다.",
      caution: "정확한 ROIC에는 세후영업이익과 운전자본 보정이 필요해 현재는 DART 기본 계정 기반 근사치입니다.",
    },
    {
      key: "ma",
      title: "이동평균선",
      formula: "N일 이동평균 = 최근 N거래일 종가 평균",
      beginner: "가격의 잡음을 줄이고 추세 방향을 보기 위한 선이에요.",
      interpretation: "주가가 20/60/120일선 위에 있으면 단기/중기/장기 추세가 강하다고 봅니다.",
      caution: "늦게 반응하는 지표라 급락 전환을 바로 잡아내지는 못합니다.",
    },
    {
      key: "rsi",
      title: "RSI",
      formula: "RSI = 100 - 100 / (1 + 평균상승폭 / 평균하락폭)",
      beginner: "최근 상승 압력이 너무 강한지, 너무 약한지 보는 온도계예요.",
      interpretation: "70 이상은 과열, 30 이하는 침체로 해석하는 경우가 많습니다.",
      caution: "강한 상승장에서는 RSI가 오래 높게 유지될 수 있습니다.",
    },
    {
      key: "macd",
      title: "MACD",
      formula: "MACD = 12일 EMA - 26일 EMA, Signal = MACD의 9일 EMA",
      beginner: "짧은 추세와 긴 추세의 힘 차이를 비교하는 지표예요.",
      interpretation: "MACD가 Signal 위로 올라가면 상승 전환 신호로 보는 경우가 많습니다.",
      caution: "횡보장에서는 가짜 신호가 자주 나옵니다.",
    },
    {
      key: "bollinger",
      title: "볼린저 밴드",
      formula: "상단/하단 = 20일 이동평균 ± 2 x 표준편차",
      beginner: "최근 가격이 평소 움직임 범위 안인지 밖인지 보는 띠예요.",
      interpretation: "상단 돌파는 강한 수급, 하단 이탈은 위험 신호로 볼 수 있습니다.",
      caution: "밴드 돌파만으로 매수/매도 판단하면 변동성 장세에서 흔들릴 수 있습니다.",
    },
  ];
}

export function buildAnalysis(
  stock: MarketRow,
  financials: FinancialSnapshot[],
  technical: TechnicalSnapshot | null,
): StockAnalysis {
  const financial = financials.at(-1) ?? null;
  const trend = buildTrend(financials);
  const metrics = financial?.metrics;
  const first = financials[0]?.metrics;
  const periods = Math.max(financials.length - 1, 0);
  const revenueCagr = cagr(first?.revenue, metrics?.revenue, periods);
  const opIncomeCagr = cagr(first?.operatingIncome, metrics?.operatingIncome, periods);
  const netIncomeCagr = cagr(first?.netIncome, metrics?.netIncome, periods);
  const operatingMargin = metrics?.operatingMargin ?? null;
  const debtRatio = metrics?.debtRatio ?? null;
  const roe = metrics?.roe ?? null;
  const roicProxy = metrics?.roicProxy ?? null;
  const latestClose = technical?.indicators.latestClose ?? stock.price;
  const indicators = technical?.indicators;
  const priceAboveMa20 = indicators?.ma20 ? latestClose > indicators.ma20 : false;
  const priceAboveMa60 = indicators?.ma60 ? latestClose > indicators.ma60 : false;
  const priceAboveMa120 = indicators?.ma120 ? latestClose > indicators.ma120 : false;
  const momentumHealthy = (indicators?.rsi14 ?? 50) >= 45 && (indicators?.rsi14 ?? 50) <= 72;
  const macdPositive = (indicators?.macdHistogram ?? 0) > 0;

  const quality = clamp(
    38 +
      (operatingMargin ?? 0) * 1.2 +
      (roe ?? 0) * 1.1 +
      (revenueCagr ?? 0) * 0.9 +
      (opIncomeCagr ?? 0) * 0.7 +
      (roicProxy ?? 0) * 0.8 -
      Math.max((debtRatio ?? 160) - 100, 0) * 0.18 +
      (priceAboveMa20 ? 5 : -3) +
      (priceAboveMa60 ? 5 : -3) +
      (priceAboveMa120 ? 4 : -2) +
      (momentumHealthy ? 4 : -2) +
      (macdPositive ? 4 : -2),
  );
  const grade = quality >= 78 ? "우수" : quality >= 64 ? "양호" : quality >= 50 ? "중립" : "주의";

  const chartSeries: ChartSeries[] = [
    {
      title: "5개년 매출·이익 추세",
      unit: "money",
      labels: trend.map((point) => point.year),
      lines: [
        { label: "매출", values: trend.map((point) => point.revenue) },
        { label: "영업이익", values: trend.map((point) => point.operatingIncome) },
        { label: "순이익", values: trend.map((point) => point.netIncome) },
      ],
    },
    {
      title: "수익성·효율성 변화",
      unit: "percent",
      labels: trend.map((point) => point.year),
      lines: [
        { label: "영업이익률", values: trend.map((point) => point.operatingMargin) },
        { label: "ROE", values: trend.map((point) => point.roe) },
        { label: "ROIC 근사", values: trend.map((point) => point.roicProxy) },
      ],
    },
    {
      title: "안정성 변화",
      unit: "percent",
      labels: trend.map((point) => point.year),
      lines: [{ label: "부채비율", values: trend.map((point) => point.debtRatio) }],
    },
  ];

  return {
    stock,
    financial,
    financialTrend: trend,
    technical,
    grade,
    summary: financial
      ? `${financials.length}개년 사업보고서 기준 매출 CAGR ${ratioText(revenueCagr)}, 영업이익 CAGR ${ratioText(opIncomeCagr)}, ROE ${ratioText(roe)}, 부채비율 ${ratioText(debtRatio)}입니다. 기술적으로는 20/60/120일선 중 ${[priceAboveMa20, priceAboveMa60, priceAboveMa120].filter(Boolean).length}개 위에 있습니다.`
      : "DART 재무제표가 아직 수집되지 않아 시세 기반 예비 분석만 제공합니다.",
    chartSeries,
    learning: makeLearning(),
    metrics: [
      {
        label: "매출 CAGR",
        value: ratioText(revenueCagr),
        description: "최근 5개년 매출이 연평균 얼마나 성장했는지 봅니다.",
        status: statusBy(revenueCagr, 8, 2),
      },
      {
        label: "영업이익 CAGR",
        value: ratioText(opIncomeCagr),
        description: "본업 이익의 장기 성장 속도입니다.",
        status: statusBy(opIncomeCagr, 10, 0),
      },
      {
        label: "순이익 CAGR",
        value: ratioText(netIncomeCagr),
        description: "최종 이익이 장기적으로 늘었는지 봅니다.",
        status: statusBy(netIncomeCagr, 8, 0),
      },
      {
        label: "영업이익률",
        value: ratioText(operatingMargin),
        description: "매출에서 본업 이익이 얼마나 남는지 봅니다.",
        status: statusBy(operatingMargin, 10, 3),
      },
      {
        label: "ROE",
        value: ratioText(roe),
        description: "주주 자본으로 순이익을 얼마나 만들었는지 봅니다.",
        status: statusBy(roe, 10, 3),
      },
      {
        label: "ROIC 근사",
        value: ratioText(roicProxy),
        description: "투입된 자본이 본업 이익으로 얼마나 회수되는지 봅니다.",
        status: statusBy(roicProxy, 8, 3),
      },
      {
        label: "부채비율",
        value: ratioText(debtRatio),
        description: "자본 대비 빚 부담입니다. 낮을수록 안정적입니다.",
        status: statusBy(debtRatio, 100, 200, true),
      },
      {
        label: "EBITDA 근사",
        value: moneyText(metrics?.ebitdaProxy),
        description: "DART 기본 계정 기준으로 영업이익을 EBITDA 근사값으로 둡니다.",
        status: statusBy(metrics?.ebitdaProxy, 0, -1),
      },
      {
        label: "20/60/120일선",
        value: `${priceAboveMa20 ? "20↑" : "20↓"} · ${priceAboveMa60 ? "60↑" : "60↓"} · ${priceAboveMa120 ? "120↑" : "120↓"}`,
        description: "단기·중기·장기 추세선 위에 있는지 확인합니다.",
        status: [priceAboveMa20, priceAboveMa60, priceAboveMa120].filter(Boolean).length >= 2 ? "good" : "neutral",
      },
      {
        label: "RSI 14",
        value: ratioText(indicators?.rsi14),
        description: "최근 상승/하락 압력의 과열 여부를 봅니다.",
        status: indicators?.rsi14 === null || indicators?.rsi14 === undefined ? "neutral" : indicators.rsi14 > 75 || indicators.rsi14 < 25 ? "danger" : indicators.rsi14 > 45 ? "good" : "neutral",
      },
      {
        label: "MACD",
        value: `${numText(indicators?.macd, 1)} / ${numText(indicators?.macdSignal, 1)}`,
        description: "짧은 추세와 긴 추세의 힘 차이입니다.",
        status: macdPositive ? "good" : "neutral",
      },
      {
        label: "볼린저 위치",
        value:
          indicators?.bollingerLower && indicators.bollingerUpper
            ? `${numText(indicators.bollingerLower)} ~ ${numText(indicators.bollingerUpper)}`
            : "미확인",
        description: "가격이 최근 변동성 범위 안팎에 있는지 봅니다.",
        status: "neutral",
      },
      {
        label: "거래량 강도",
        value: ratioText(indicators?.volumeRatio25),
        description: "오늘 거래량이 25일 평균 대비 얼마나 큰지 봅니다.",
        status: statusBy(indicators?.volumeRatio25, 130, 80),
      },
      {
        label: "20일 변동성",
        value: ratioText(indicators?.volatility20),
        description: "최근 20거래일 가격 흔들림의 크기입니다.",
        status: statusBy(indicators?.volatility20, 3, 7, true),
      },
      {
        label: "60일 지지/저항",
        value:
          indicators?.support60 && indicators.resistance60
            ? `${numText(indicators.support60)} / ${numText(indicators.resistance60)}`
            : "미확인",
        description: "최근 60거래일 저점과 고점입니다.",
        status: "neutral",
      },
    ],
    checklist: [
      {
        label: "5개년 재무제표 수집",
        passed: financials.length >= 3,
        detail: `${financials.length}개 연도 사업보고서 주요 계정을 파일 캐시에 저장했습니다.`,
      },
      {
        label: "성장성",
        passed: (revenueCagr ?? -100) > 0 && (opIncomeCagr ?? -100) > 0,
        detail: `매출 CAGR ${ratioText(revenueCagr)}, 영업이익 CAGR ${ratioText(opIncomeCagr)}입니다.`,
      },
      {
        label: "수익성",
        passed: (operatingMargin ?? 0) >= 3 && (roe ?? 0) >= 3,
        detail: `영업이익률 ${ratioText(operatingMargin)}, ROE ${ratioText(roe)}입니다.`,
      },
      {
        label: "안정성",
        passed: debtRatio !== null && debtRatio <= 200,
        detail: `부채비율 ${ratioText(debtRatio)}입니다.`,
      },
      {
        label: "기술적 추세",
        passed: priceAboveMa20 || priceAboveMa60 || macdPositive,
        detail: `RSI ${ratioText(indicators?.rsi14)}, MACD 히스토그램 ${numText(indicators?.macdHistogram, 1)}입니다.`,
      },
    ],
  };
}
