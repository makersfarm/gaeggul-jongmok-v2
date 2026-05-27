import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, AlertTriangle, BarChart3, Database, Moon, RefreshCw, ShieldCheck, Sparkles, Sun } from "lucide-react";
import "./styles.css";

type MarketRow = {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  volume: number;
  market: "KOSPI" | "KOSDAQ";
};

type Analysis = {
  stock: MarketRow;
  financial: {
    year: string;
    corp: { corp_name: string; corp_code: string };
    storedAt: string;
    metrics: Record<string, number | null>;
  } | null;
  technical: {
    storedAt: string;
    prices: unknown[];
    indicators: Record<string, number | null>;
  } | null;
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

function App() {
  const [dark, setDark] = useState(false);
  const [market, setMarket] = useState<MarketRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("005930");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const top = useMemo(() => market.slice(0, 5), [market]);

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
          <div className="brand">
            <Sparkles />
            <strong>개꿀종목 v2</strong>
          </div>
          <button className="iconButton" onClick={() => setDark((value) => !value)} aria-label="테마 변경">
            {dark ? <Sun /> : <Moon />}
          </button>
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow">DART 재무제표 저장 + 기술지표 계산</p>
            <h1>진짜 펀더먼털 데이터부터 다시 쌓는 주식 분석 콘솔</h1>
          </div>
          <div className="statusBox">
            <Database />
            <span>OpenDART 사업보고서와 일봉 데이터를 파일 캐시에 저장 후 렌더링</span>
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
            {analysis ? (
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
                  {analysis.metrics.map((metric) => (
                    <article className={`metric ${metric.status}`} key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <p>{metric.description}</p>
                    </article>
                  ))}
                </section>

                <section className="detailGrid">
                  <Panel icon={<BarChart3 />} title="사업보고서 주요 재무제표">
                    <Fact label="수집연도" value={analysis.financial?.year ?? "미확인"} />
                    <Fact label="회사 고유번호" value={analysis.financial?.corp?.corp_code ?? "미확인"} />
                    <Fact label="저장시각" value={formatTime(analysis.financial?.storedAt)} />
                    <Fact label="매출액" value={money(analysis.financial?.metrics.revenue)} />
                    <Fact label="영업이익" value={money(analysis.financial?.metrics.operatingIncome)} />
                    <Fact label="당기순이익" value={money(analysis.financial?.metrics.netIncome)} />
                    <Fact label="자산/부채/자본" value={`${money(analysis.financial?.metrics.assets)} / ${money(analysis.financial?.metrics.liabilities)} / ${money(analysis.financial?.metrics.equity)}`} />
                  </Panel>

                  <Panel icon={<Activity />} title="일봉 기반 기술지표">
                    <Fact label="가격 데이터" value={`${analysis.technical?.prices.length ?? 0}개 일봉`} />
                    <Fact label="5/20/60일 이평" value={`${num(analysis.technical?.indicators.ma5)} / ${num(analysis.technical?.indicators.ma20)} / ${num(analysis.technical?.indicators.ma60)}`} />
                    <Fact label="V25" value={num(analysis.technical?.indicators.v25)} />
                    <Fact label="20일 지지/저항" value={`${num(analysis.technical?.indicators.support20)} / ${num(analysis.technical?.indicators.resistance20)}`} />
                    <Fact label="저장시각" value={formatTime(analysis.technical?.storedAt)} />
                  </Panel>
                </section>

                <section className="checkPanel">
                  <div className="sectionTitle">
                    <span>펀더먼털 체크리스트</span>
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
            ) : (
              <div className="empty">
                <AlertTriangle />
                <span>분석 데이터를 불러오는 중입니다.</span>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
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

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "미확인";
  if (Math.abs(value) >= 1_0000_0000_0000) return `${Math.round(value / 1_0000_0000_0000).toLocaleString("ko-KR")}조`;
  if (Math.abs(value) >= 1_0000_0000) return `${Math.round(value / 1_0000_0000).toLocaleString("ko-KR")}억`;
  return value.toLocaleString("ko-KR");
}

function num(value: number | null | undefined) {
  return value === null || value === undefined ? "미확인" : value.toLocaleString("ko-KR");
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
