export type MarketRow = {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  volume: number;
  market: "KOSPI" | "KOSDAQ";
};

export type CorpCodeRow = {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  modify_date: string;
};

export type FinancialMetrics = {
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  debtRatio: number | null;
  roe: number | null;
};

export type FinancialSnapshot = {
  source: string;
  stockCode: string;
  corp: CorpCodeRow;
  year: string;
  reportCode: string;
  storedAt: string;
  accounts: unknown[];
  metrics: FinancialMetrics;
};

export type PricePoint = {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
};

export type TechnicalSnapshot = {
  source: string;
  stockCode: string;
  storedAt: string;
  prices: PricePoint[];
  indicators: {
    latestClose: number | null;
    ma5: number | null;
    ma20: number | null;
    ma60: number | null;
    v25: number | null;
    support20: number | null;
    resistance20: number | null;
  };
};

export type StockAnalysis = {
  stock: MarketRow;
  financial: FinancialSnapshot | null;
  technical: TechnicalSnapshot | null;
  grade: "우수" | "양호" | "중립" | "주의";
  summary: string;
  metrics: {
    label: string;
    value: string;
    description: string;
    status: "good" | "neutral" | "danger";
  }[];
  checklist: {
    label: string;
    passed: boolean;
    detail: string;
  }[];
};
