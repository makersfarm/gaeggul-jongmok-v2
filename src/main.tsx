import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LineChart as EchartsLineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  ChevronLeft,
  Database,
  ExternalLink,
  LineChart,
  Moon,
  Search,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Volume2,
} from "lucide-react";
import "./styles.css";

echarts.use([EchartsLineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

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
  const [route, setRoute] = useState<Route>(getRoute());
  const [market, setMarket] = useState<MarketRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("005930");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const top = useMemo(() => market.slice(0, 5), [market]);

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
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
            <a className={route === "financial" ? "active" : ""} href="#/financial">
              <LineChart size={16} />
              재무정보
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
          <HomeDashboardView
            top={top}
            selectedCode={selectedCode}
            setSelectedCode={setSelectedCode}
            analysis={analysis}
            loading={loading}
          />
        ) : null}
        {route === "financial" ? (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">5개년 DART 재무제표 + 모델링 기반 기술지표</p>
                <h1>성장성, 수익성, 안정성, 추세를 분리해서 봅니다</h1>
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
                {analysis ? <FinancialAnalysisView analysis={analysis} loading={loading} dark={dark} /> : <Empty />}
              </section>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function HomeDashboardView({
  top,
  selectedCode,
  setSelectedCode,
  analysis,
  loading,
}: {
  top: MarketRow[];
  selectedCode: string;
  setSelectedCode: (code: string) => void;
  analysis: Analysis | null;
  loading: boolean;
}) {
  const selected = analysis?.stock ?? top.find((stock) => stock.code === selectedCode) ?? top[0];
  const ranking = useMemo(
    () => [...top].sort((a, b) => b.changeRate - a.changeRate || b.volume - a.volume),
    [top],
  );
  const dataStatus = top.length ? "네이버 금융 공개 페이지 polling 데이터 사용 중" : "무료 공개 데이터 연결 중";

  return (
    <>
      <section className="homeHero">
        <div>
          <p className="eyebrow">공시 + 시세 + 리포트 + 대중 의견</p>
          <h1>오늘 볼 종목을 근거와 위험까지 한 번에 압축</h1>
        </div>
        <div className="homeSearchBox">
          <Search size={18} />
          <span>{dataStatus}</span>
        </div>
      </section>

      <section className="homeLayout">
        <aside className="homeDashboard">
          <div className="homeSectionHeader">
            <div>
              <p className="eyebrow">TOP 5</p>
              <h2>인기 종목</h2>
            </div>
            <TrendingUp size={22} />
          </div>
          <div className="homeStockList">
            {ranking.map((stock, index) => (
              <button
                key={stock.code}
                className={`homeStockCard ${stock.code === selectedCode ? "active" : ""}`}
                onClick={() => setSelectedCode(stock.code)}
              >
                <div className="homeRank">{index + 1}</div>
                <div className="homeStockMain">
                  <strong>{stock.name}</strong>
                  <span>
                    {stock.code} · {stock.market}
                  </span>
                </div>
                <div className="homeStockMetric">
                  <strong>{signedPct(stock.changeRate)}</strong>
                  <span>거래량 {compactNumber(stock.volume)}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="homeDetail">
          <button className="homeBackButton" onClick={() => top[0] && setSelectedCode(top[0].code)}>
            <ChevronLeft size={16} />
            대시보드
          </button>

          {analysis && selected ? (
            <>
              <div className="homeDetailHero">
                <div>
                  <p className="eyebrow">{selected.market}</p>
                  <h2>{selected.name}</h2>
                  <p className="homePrice">
                    {selected.price.toLocaleString("ko-KR")}원 <span>{signedPct(selected.changeRate)}</span>
                  </p>
                </div>
                <HomeScoreRing value={scoreFromGrade(analysis.grade)} label="신뢰도" />
              </div>

              <p className="homeVerdict">{loading ? "분석 갱신 중..." : analysis.summary}</p>

              <div className="homeMetricGrid">
                <HomeMetric icon={<Volume2 />} label="거래량" value={compactNumber(selected.volume)} tone="info" />
                <HomeMetric icon={<TrendingUp />} label="등락률" value={signedPct(selected.changeRate)} tone="good" />
                <HomeMetric icon={<AlertTriangle />} label="종합 등급" value={analysis.grade} tone="danger" />
                <HomeMetric icon={<ShieldCheck />} label="정확성" value={`${analysis.metrics.length}개 지표`} tone="safe" />
              </div>

              <div className="homeAnalysisGrid">
                <HomePanel icon={<Database />} title="DART 재무 요약">
                  <HomeFact label="최근 매출액" value={money(analysis.financial?.metrics.revenue)} />
                  <HomeFact label="최근 영업이익" value={money(analysis.financial?.metrics.operatingIncome)} />
                  <HomeFact label="최근 순이익" value={money(analysis.financial?.metrics.netIncome)} />
                </HomePanel>

                <HomePanel icon={<Activity />} title="시세 API 분석">
                  <HomeFact label="가격 데이터" value={`${analysis.technical?.prices.length ?? 0}개 일봉`} />
                  <HomeFact label="5/20/60일선" value={`${num(analysis.technical?.indicators.ma5)} / ${num(analysis.technical?.indicators.ma20)} / ${num(analysis.technical?.indicators.ma60)}`} />
                  <HomeFact label="RSI / MACD" value={`${pct(analysis.technical?.indicators.rsi14)} / ${num(analysis.technical?.indicators.macdHistogram, 1)}`} />
                </HomePanel>

                <HomePanel icon={<BarChart3 />} title="핵심 지표">
                  {analysis.metrics.slice(0, 3).map((metric) => (
                    <article className="homeCompactItem" key={metric.label}>
                      <div>
                        <strong>{metric.label}</strong>
                        <span>{metric.value}</span>
                      </div>
                      <p>{metric.description}</p>
                    </article>
                  ))}
                </HomePanel>

                <HomePanel icon={<ShieldCheck />} title="종합 체크리스트">
                  {analysis.checklist.slice(0, 3).map((item) => (
                    <article className="homeCompactItem" key={item.label}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.passed ? "통과" : "확인"}</span>
                      </div>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </HomePanel>
              </div>

              <a className="homeDetailEntry" href="#/financial">
                <span>
                  <strong>재무정보 자세히 보기</strong>
                  <small>5개년 수치 테이블과 인터랙티브 그래프를 확인합니다</small>
                </span>
                <ExternalLink size={18} />
              </a>
            </>
          ) : (
            <Empty />
          )}
        </section>
      </section>
    </>
  );
}

function HomeScoreRing({ value, label }: { value: number; label: string }) {
  return (
    <div className="homeScoreRing" style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function HomeMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <article className={`homeMetric ${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function HomePanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="homePanel">
      <div className="homePanelTitle">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function HomeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="homeFact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type Route = "dashboard" | "financial" | "learn";

function getRoute(): Route {
  if (location.hash === "#/learn") return "learn";
  if (location.hash === "#/financial") return "financial";
  return "dashboard";
}

function CompactAnalysisView({ analysis, loading }: { analysis: Analysis; loading: boolean }) {
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

      <section className="metricGrid">
        {analysis.metrics.slice(0, 4).map((metric) => (
          <article className={`metric ${metric.status}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.description}</p>
          </article>
        ))}
      </section>

      <a className="detailEntry" href="#/financial">
        <span>
          <strong>재무정보 자세히 보기</strong>
          <small>5개년 수치 테이블, 재무·기술 그래프, 체크리스트를 상세 화면에서 봅니다</small>
        </span>
        <ExternalLink size={18} />
      </a>
    </>
  );
}

function FinancialAnalysisView({ analysis, loading, dark }: { analysis: Analysis; loading: boolean; dark: boolean }) {
  return (
    <>
      <CompactAnalysisView analysis={analysis} loading={loading} />

      <section className="financialTablePanel">
        <div className="sectionTitle">
          <span>5개년 수치 데이터</span>
          <LineChart size={16} />
        </div>
        <FinancialTrendTable trend={analysis.financialTrend} />
      </section>

      <ChartExplorer
        title="재무 추세 그래프"
        description="성장성, 수익성, 안정성 항목을 선택하면 오른쪽 그래프가 전환됩니다."
        series={analysis.chartSeries}
        dark={dark}
      />

      <TechnicalChartExplorer analysis={analysis} dark={dark} />

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

function FinancialTrendTable({ trend }: { trend: Analysis["financialTrend"] }) {
  const latestIndex = trend.length - 1;
  const rows = [
    { key: "revenue", label: "매출액", format: money },
    { key: "operatingIncome", label: "영업이익", format: money },
    { key: "netIncome", label: "순이익", format: money },
    { key: "operatingMargin", label: "영업이익률", format: pct },
    { key: "roe", label: "ROE", format: pct },
    { key: "debtRatio", label: "부채비율", format: pct },
    { key: "roicProxy", label: "ROIC 근사", format: pct },
  ];

  if (!trend.length) return <div className="emptyTable">5개년 재무 데이터가 아직 수집되지 않았습니다.</div>;

  return (
    <div className="tableWrap">
      <table className="financialTable">
        <thead>
          <tr>
            <th>항목</th>
            {trend.map((point, index) => (
              <th className={index === latestIndex ? "latestYear" : ""} key={String(point.year)}>
                {point.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th>{row.label}</th>
              {trend.map((point, index) => (
                <td className={index === latestIndex ? "latestYear" : ""} key={`${row.key}-${String(point.year)}`}>
                  {row.format(point[row.key] as number | null | undefined)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartExplorer({
  title,
  description,
  series,
  dark,
}: {
  title: string;
  description: string;
  series: ChartSeries[];
  dark: boolean;
}) {
  const [active, setActive] = useState(0);
  const selected = series[Math.min(active, series.length - 1)];

  return (
    <section className="chartExplorer">
      <div className="sectionTitle">
        <span>{title}</span>
        <small>{description}</small>
      </div>
      <div className="chartSwitch">
        <div className="chartTabs">
          {series.map((item, index) => (
            <button className={index === active ? "active" : ""} key={item.title} onClick={() => setActive(index)}>
              <strong>{item.title}</strong>
              <span>{item.lines.map((line) => line.label).join(" · ")}</span>
            </button>
          ))}
        </div>
        {selected ? <FinancialChartCard series={selected} dark={dark} /> : <div className="emptyTable">표시할 그래프가 없습니다.</div>}
      </div>
    </section>
  );
}

function FinancialChartCard({ series, dark }: { series: ChartSeries; dark: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const colors = ["#0f766e", "#2563eb", "#dc2626", "#7c3aed"];

  useEffect(() => {
    if (!ref.current) return;
    const style = getComputedStyle(ref.current);
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.setOption({
      color: colors,
      grid: { left: 42, right: 18, top: 34, bottom: 34, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: style.getPropertyValue("--surface").trim(),
        borderColor: style.getPropertyValue("--line").trim(),
        textStyle: { color: style.getPropertyValue("--text").trim() },
        formatter: (params: unknown) => formatEchartsTooltip(series, params),
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: style.getPropertyValue("--muted").trim(), fontWeight: 700 },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: series.labels,
        axisLine: { lineStyle: { color: style.getPropertyValue("--line").trim() } },
        axisLabel: { color: style.getPropertyValue("--muted").trim(), formatter: (value: string) => value.slice(2) },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: style.getPropertyValue("--muted").trim(),
          formatter: (value: number) => compactChartValue(value, series.unit),
        },
        splitLine: { lineStyle: { color: style.getPropertyValue("--line").trim() } },
      },
      series: series.lines.map((line) => ({
        name: line.label,
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 7,
        emphasis: { focus: "series" },
        data: line.values,
      })),
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [series, dark]);

  return (
    <article className="chartCard">
      <h3>{series.title}</h3>
      <div className="echartsCanvas" ref={ref} aria-label={series.title} />
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

function TechnicalChartExplorer({ analysis, dark }: { analysis: Analysis; dark: boolean }) {
  const series = makeTechnicalSeries(analysis);
  return (
    <section className="chartExplorer">
      <div className="sectionTitle">
        <span>기술 추세 그래프</span>
        <small>마우스를 올리면 해당 거래일의 종가, 거래량, 이동평균, RSI를 함께 봅니다.</small>
      </div>
      <div className="chartSwitch">
        <div className="chartTabs">
          <button className="active">
            <strong>{series.title}</strong>
            <span>종가 · 거래량 · MA20 · MA60 · RSI</span>
          </button>
        </div>
        <TechnicalTradingChart analysis={analysis} dark={dark} />
      </div>
    </section>
  );
}

type TechnicalHover = {
  x: number;
  y: number;
  date: string;
  close: number | null;
  volume: number | null;
  ma20: number | null;
  ma60: number | null;
  rsi14: number | null;
};

function TechnicalTradingChart({ analysis, dark }: { analysis: Analysis; dark: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hover, setHover] = useState<TechnicalHover | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const style = getComputedStyle(ref.current);
    const prices = analysis.technical?.prices.slice(-80) ?? [];
    const indicators = buildTechnicalOverlay(prices);
    const chart = createChart(ref.current, {
      autoSize: true,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: style.getPropertyValue("--surface").trim() },
        textColor: style.getPropertyValue("--muted").trim(),
      },
      grid: {
        vertLines: { color: style.getPropertyValue("--line").trim() },
        horzLines: { color: style.getPropertyValue("--line").trim() },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: style.getPropertyValue("--brand").trim(),
          labelBackgroundColor: style.getPropertyValue("--brand").trim(),
        },
        horzLine: {
          color: style.getPropertyValue("--brand").trim(),
          labelBackgroundColor: style.getPropertyValue("--brand").trim(),
        },
      },
      rightPriceScale: { borderColor: style.getPropertyValue("--line").trim() },
      timeScale: { borderColor: style.getPropertyValue("--line").trim(), timeVisible: true },
    });
    chartRef.current = chart;

    const closeSeries = chart.addSeries(LineSeries, {
      color: "#0f766e",
      lineWidth: 3,
      priceLineVisible: false,
      title: "종가",
    });
    const ma20Series = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      priceLineVisible: false,
      title: "MA20",
    });
    const ma60Series = chart.addSeries(LineSeries, {
      color: "#7c3aed",
      lineWidth: 2,
      priceLineVisible: false,
      title: "MA60",
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "rgba(15, 118, 110, 0.24)",
      priceFormat: { type: "volume" },
      priceScaleId: "",
      title: "거래량",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.76, bottom: 0 } });

    closeSeries.setData(prices.map((point) => ({ time: point.date as Time, value: point.close })));
    ma20Series.setData(toLineData(indicators.ma20));
    ma60Series.setData(toLineData(indicators.ma60));
    volumeSeries.setData(prices.map((point) => ({ time: point.date as Time, value: point.volume })));
    chart.timeScale().fitContent();

    const hoverRows = new Map(
      prices.map((point, index) => [
        point.date,
        {
          date: point.date,
          close: point.close,
          volume: point.volume,
          ma20: indicators.ma20[index]?.value ?? null,
          ma60: indicators.ma60[index]?.value ?? null,
          rsi14: indicators.rsi14[index] ?? null,
        },
      ]),
    );
    const onMove = (param: MouseEventParams<Time>) => {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        setHover(null);
        return;
      }
      const row = hoverRows.get(String(param.time));
      if (!row) {
        setHover(null);
        return;
      }
      setHover({ x: param.point.x, y: param.point.y, ...row });
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
    };
  }, [analysis, dark]);

  return (
    <article className="chartCard">
      <h3>최근 80거래일 종가</h3>
      <div className="tradingChartWrap">
        <div className="tradingCanvas" ref={ref} />
        {hover ? <TechnicalTooltip hover={hover} /> : null}
      </div>
      <div className="legend">
        <span><i style={{ background: "#0f766e" }} />종가</span>
        <span><i style={{ background: "#2563eb" }} />MA20</span>
        <span><i style={{ background: "#7c3aed" }} />MA60</span>
        <span><i style={{ background: "rgba(15, 118, 110, 0.35)" }} />거래량</span>
      </div>
    </article>
  );
}

function TechnicalTooltip({ hover }: { hover: TechnicalHover }) {
  return (
    <div className="chartHoverTooltip" style={{ left: Math.min(hover.x + 16, 520), top: Math.max(hover.y - 18, 8) }}>
      <strong>{hover.date}</strong>
      <span>종가 {num(hover.close)}원</span>
      <span>거래량 {num(hover.volume)}</span>
      <span>MA20 {num(hover.ma20)} / MA60 {num(hover.ma60)}</span>
      <span>RSI {pct(hover.rsi14)}</span>
    </div>
  );
}

function makeTechnicalSeries(analysis: Analysis): ChartSeries {
  const prices = analysis.technical?.prices.slice(-80) ?? [];
  const labels = prices.map((point) => point.date.slice(5));
  const closes = prices.map((point) => point.close);
  return {
    title: "최근 80거래일 종가",
    unit: "price",
    labels,
    lines: [{ label: "종가", values: closes }],
  };
}

function buildTechnicalOverlay(prices: { date: string; close: number; volume: number }[]) {
  const closes = prices.map((point) => point.close);
  return {
    ma20: movingAverage(prices, 20),
    ma60: movingAverage(prices, 60),
    rsi14: closes.map((_, index) => rsiAt(closes.slice(0, index + 1), 14)),
  };
}

function movingAverage(prices: { date: string; close: number }[], period: number) {
  return prices.map((point, index) => {
    if (index < period - 1) return { time: point.date as Time, value: null };
    const slice = prices.slice(index - period + 1, index + 1);
    const value = Math.round(slice.reduce((sum, item) => sum + item.close, 0) / period);
    return { time: point.date as Time, value };
  });
}

function toLineData(points: { time: Time; value: number | null }[]) {
  return points.filter((point): point is { time: Time; value: number } => point.value !== null);
}

function rsiAt(values: number[], period: number) {
  if (values.length <= period) return null;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.filter((value) => value > 0).reduce((sum, value) => sum + value, 0) / period;
  const losses = Math.abs(recent.filter((value) => value < 0).reduce((sum, value) => sum + value, 0) / period);
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function formatEchartsTooltip(series: ChartSeries, params: unknown) {
  const rows = Array.isArray(params)
    ? params as { axisValue?: string; marker?: string; seriesName?: string; value?: number | null }[]
    : [];
  const label = rows[0]?.axisValue ?? "";
  const items = rows
    .filter((row) => row.value !== null && row.value !== undefined)
    .map((row) => `<div><span>${row.marker ?? ""}${row.seriesName}</span><b>${compactChartValue(row.value ?? null, series.unit)}</b></div>`)
    .join("");
  return `<section class="echartsTooltip"><strong>${label}</strong>${items}</section>`;
}

function compactChartValue(value: number | null | undefined, unit: ChartSeries["unit"]) {
  if (value === null || value === undefined) return "미확인";
  if (unit === "money") return money(value);
  if (unit === "percent") return pct(value);
  if (unit === "price") return `${num(value)}원`;
  return num(value);
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

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function compactNumber(value: number) {
  if (Math.abs(value) >= 1_0000_0000) return `${Math.round(value / 1_0000_0000).toLocaleString("ko-KR")}억`;
  if (Math.abs(value) >= 1_0000) return `${Math.round(value / 1_0000).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}

function scoreFromGrade(grade: Analysis["grade"]) {
  if (grade === "우수") return 88;
  if (grade === "양호") return 76;
  if (grade === "중립") return 62;
  return 45;
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
