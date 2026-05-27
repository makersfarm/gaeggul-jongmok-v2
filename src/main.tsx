import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Database,
  LineChart,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import "./styles.css";

type MarketRow = {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  volume: number;
  market: "KOSPI" | "KOSDAQ";
};

type ChartSeries = {
  title: string;
  unit: "money" | "percent" | "price" | "volume";
  labels: string[];
  lines: { label: string; values: (number | null)[] }[];
};

type LearningItem = {
  key: string;
  title: string;
  formula: string;
  beginner: string;
  interpretation: string;
  caution: string;
};

type Analysis = {
  stock: MarketRow;
  financial: {
    year: string;
    corp: { corp_name: string; corp_code: string };
    storedAt: string;
    metrics: Record<string, number | null>;
  } | null;
  financialTrend: Record<string, number | string | null>[];
  technical: {
    storedAt: string;
    prices: { date: string; close: number; volume: number }[];
    indicators: Record<string, number | null>;
  } | null;
  grade: "우수" | "양호" | "중립" | "주의";
  summary: string;
  chartSeries: ChartSeries[];
  learning: LearningItem[];
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

function App() {
  const [dark, setDark] = useState(false);
  const [route, setRoute] = useState(location.hash === "#/learn" ? "learn" : "dashboard");
  const [market, setMarket] = useState<MarketRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("005930");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const top = useMemo(() => market.slice(0, 5), [market]);

  useEffect(() => {
    const onHash = () => setRoute(location.hash === "#/learn" ? "learn" : "dashboard");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetch("/api/market")
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload.rows ?? [])
          .filter((row: MarketRow) => row.price > 0)
          .sort((a: MarketRow, b: MarketRow) => b.volume - a.volume);
        setMarket(rows);
        if (rows[0]) setSelectedCode(rows[0].code);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analysis?code=${selectedCode}`)
      .then((res) => res.json())
      .then(setAnalysis)
      .finally(() => setLoading(false));
  }, [selectedCode]);

  return (
    <main className={dark ? "dark" : "light"}>
      <div className="shell">
        <header className="topbar">
          <a className="brand" href="#/">
            <Sparkles />
            <strong>개꿀종목 v2</strong>
          </a>
          <nav className="nav">
            <a className={route === "dashboard" ? "active" : ""} href="#/">
              <BarChart3 size={16} />
              분석
            </a>
            <a className={route === "learn" ? "active" : ""} href="#/learn">
              <BookOpen size={16} />
              지표 학습
            </a>
          </nav>
          <button className="iconButton" onClick={() => setDark((value) => !value)} aria-label="테마 변경">
            {dark ? <Sun /> : <Moon />}
          </button>
        </header>

        {route === "learn" ? <LearnPage learning={analysis?.learning ?? []} /> : null}
        {route === "dashboard" ? (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">5개년 DART 재무제표 + 모델링 기반 기술지표</p>
                <h1>성장성, 수익성, 안정성, 추세를 한 화면에서 비교합니다</h1>
              </div>
              <div className="statusBox">
                <Database />
                <span>사업보고서 원천 계정은 파일 캐시에 저장하고, 지표는 요청 시 재계산합니다</span>
              </div>
            </section>

            <section className="layout">
              <aside className="sidebar">
                <div className="sectionTitle">
                  <span>거래량 TOP 5</span>
                  <RefreshCw size={16} />
                </div>
                <div className="stockList">
                  {top.map((stock, index) => (
                    <button
                      className={`stockButton ${selectedCode === stock.code ? "active" : ""}`}
                      key={stock.code}
                      onClick={() => setSelectedCode(stock.code)}
                    >
                      <b>{index + 1}</b>
                      <span>
                        <strong>{stock.name}</strong>
                        <small>
                          {stock.code} · {stock.market}
                        </small>
                      </span>
                      <em>{stock.changeRate.toFixed(2)}%</em>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="content">
                {analysis ? <AnalysisView analysis={analysis} loading={loading} /> : <Empty />}
              </section>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function AnalysisView({ analysis, loading }: { analysis: Analysis; loading: boolean }) {
  return (
    <>
      <div className="summaryPanel">
        <div>
          <p className="eyebrow">{analysis.stock.market}</p>
          <h2>{analysis.stock.name}</h2>
          <p>
            {analysis.stock.price.toLocaleString("ko-KR")}원 · {analysis.stock.changeRate.toFixed(2)}%
          </p>
        </div>
        <div className={`grade ${analysis.grade}`}>{analysis.grade}</div>
      </div>

      <p className="summaryText">{loading ? "분석 갱신 중..." : analysis.summary}</p>

      <section className="chartGrid">
        {analysis.chartSeries.map((series) => (
          <ChartCard series={series} key={series.title} />
        ))}
        <TechnicalChart analysis={analysis} />
      </section>

      <section className="metricGrid">
        {analysis.metrics.map((metric) => (
          <article className={`metric ${metric.status}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="detailGrid">
        <Panel icon={<LineChart />} title="5개년 재무제표 핵심 계정">
          <Fact label="수집연도" value={analysis.financialTrend.map((point) => point.year).join(", ") || "미확인"} />
          <Fact label="최근 매출액" value={money(analysis.financial?.metrics.revenue)} />
          <Fact label="최근 영업이익" value={money(analysis.financial?.metrics.operatingIncome)} />
          <Fact label="최근 순이익" value={money(analysis.financial?.metrics.netIncome)} />
          <Fact label="자산/부채/자본" value={`${money(analysis.financial?.metrics.assets)} / ${money(analysis.financial?.metrics.liabilities)} / ${money(analysis.financial?.metrics.equity)}`} />
          <Fact label="저장시각" value={formatTime(analysis.financial?.storedAt)} />
        </Panel>

        <Panel icon={<Activity />} title="일봉 기반 기술지표">
          <Fact label="가격 데이터" value={`${analysis.technical?.prices.length ?? 0}개 일봉`} />
          <Fact label="5/20/60/120일선" value={`${num(analysis.technical?.indicators.ma5)} / ${num(analysis.technical?.indicators.ma20)} / ${num(analysis.technical?.indicators.ma60)} / ${num(analysis.technical?.indicators.ma120)}`} />
          <Fact label="RSI / MACD" value={`${pct(analysis.technical?.indicators.rsi14)} / ${num(analysis.technical?.indicators.macdHistogram, 1)}`} />
          <Fact label="볼린저 하단/상단" value={`${num(analysis.technical?.indicators.bollingerLower)} / ${num(analysis.technical?.indicators.bollingerUpper)}`} />
          <Fact label="60일 지지/저항" value={`${num(analysis.technical?.indicators.support60)} / ${num(analysis.technical?.indicators.resistance60)}`} />
        </Panel>
      </section>

      <section className="checkPanel">
        <div className="sectionTitle">
          <span>종합 체크리스트</span>
          <ShieldCheck size={16} />
        </div>
        {analysis.checklist.map((item) => (
          <article className={item.passed ? "passed" : "blocked"} key={item.label}>
            <b>{item.passed ? "통과" : "확인"}</b>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function ChartCard({ series }: { series: ChartSeries }) {
  const values = series.lines.flatMap((line) => line.values).filter((value): value is number => value !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const colors = ["#0f766e", "#2563eb", "#dc2626", "#7c3aed"];
  const width = 320;
  const height = 190;
  const left = 34;
  const right = 14;
  const top = 18;
  const bottom = 30;
  const step = (width - left - right) / Math.max(series.labels.length - 1, 1);
  const point = (value: number | null, index: number) => {
    if (value === null) return null;
    const x = left + step * index;
    const y = top + (1 - (value - min) / range) * (height - top - bottom);
    return `${x},${y}`;
  };

  return (
    <article className="chartCard">
      <h3>{series.title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.title}>
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} />
        <line x1={left} y1={top} x2={left} y2={height - bottom} />
        {series.lines.map((line, lineIndex) => (
          <polyline
            key={line.label}
            points={line.values.map(point).filter(Boolean).join(" ")}
            fill="none"
            stroke={colors[lineIndex % colors.length]}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {series.labels.map((label, index) => (
          <text x={left + step * index} y={height - 8} key={label}>
            {label.slice(2)}
          </text>
        ))}
      </svg>
      <div className="legend">
        {series.lines.map((line, index) => (
          <span key={line.label}>
            <i style={{ background: colors[index % colors.length] }} />
            {line.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function TechnicalChart({ analysis }: { analysis: Analysis }) {
  const prices = analysis.technical?.prices.slice(-80) ?? [];
  const labels = prices.map((point) => point.date.slice(5));
  const closes = prices.map((point) => point.close);
  return (
    <ChartCard
      series={{
        title: "최근 80거래일 종가",
        unit: "price",
        labels,
        lines: [{ label: "종가", values: closes }],
      }}
    />
  );
}

function LearnPage({ learning }: { learning: LearningItem[] }) {
  const items = learning.length ? learning : [];
  return (
    <section className="learnPage">
      <div className="hero compact">
        <div>
          <p className="eyebrow">초심자용 지표 사전</p>
          <h1>그래프의 선이 무슨 뜻인지 먼저 이해하고 판단합니다</h1>
        </div>
      </div>
      <div className="learnGrid">
        {items.map((item) => (
          <article className="learnCard" key={item.key}>
            <h3>{item.title}</h3>
            <code>{item.formula}</code>
            <p>{item.beginner}</p>
            <strong>{item.interpretation}</strong>
            <small>{item.caution}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h3>
        {icon}
        {title}
      </h3>
      <div className="facts">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Empty() {
  return (
    <div className="empty">
      <AlertTriangle />
      <span>분석 데이터를 불러오는 중입니다.</span>
    </div>
  );
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "미확인";
  if (Math.abs(value) >= 1_0000_0000_0000) return `${Math.round(value / 1_0000_0000_0000).toLocaleString("ko-KR")}조`;
  if (Math.abs(value) >= 1_0000_0000) return `${Math.round(value / 1_0000_0000).toLocaleString("ko-KR")}억`;
  return value.toLocaleString("ko-KR");
}

function num(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined ? "미확인" : value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function pct(value: number | null | undefined) {
  return value === null || value === undefined ? "미확인" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

function formatTime(value?: string) {
  if (!value) return "미확인";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

createRoot(document.getElementById("root")!).render(<App />);
