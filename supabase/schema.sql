create table if not exists public.stocks (
  stock_code text primary key,
  name text not null,
  market text not null check (market in ('KOSPI', 'KOSDAQ')),
  corp_code text,
  corp_name text,
  listed boolean not null default true,
  source text not null default 'naver-finance',
  updated_at timestamptz not null default now()
);

create index if not exists stocks_market_idx on public.stocks (market);
create index if not exists stocks_name_idx on public.stocks (name);

create table if not exists public.latest_quotes (
  stock_code text primary key references public.stocks (stock_code) on delete cascade,
  price bigint,
  change_rate numeric(8, 3),
  volume bigint,
  market_rank integer,
  quote_source text not null default 'naver-finance',
  quoted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists latest_quotes_volume_idx on public.latest_quotes (volume desc nulls last);
create index if not exists latest_quotes_change_rate_idx on public.latest_quotes (change_rate desc nulls last);

create table if not exists public.financial_metrics (
  stock_code text not null references public.stocks (stock_code) on delete cascade,
  business_year integer not null,
  report_code text not null default '11011',
  revenue bigint,
  operating_income bigint,
  net_income bigint,
  assets bigint,
  liabilities bigint,
  equity bigint,
  operating_margin numeric(10, 3),
  net_margin numeric(10, 3),
  debt_ratio numeric(10, 3),
  roe numeric(10, 3),
  roi_proxy numeric(10, 3),
  roic_proxy numeric(10, 3),
  ebit_proxy bigint,
  ebitda_proxy bigint,
  source text not null default 'opendart-fnlttSinglAcnt',
  stored_at timestamptz not null default now(),
  primary key (stock_code, business_year, report_code)
);

create index if not exists financial_metrics_year_idx on public.financial_metrics (business_year desc);

create table if not exists public.analysis_cache (
  stock_code text primary key references public.stocks (stock_code) on delete cascade,
  payload jsonb not null,
  expires_at timestamptz not null,
  stored_at timestamptz not null default now()
);

create index if not exists analysis_cache_expires_at_idx on public.analysis_cache (expires_at);

-- Keep full daily price history out of Supabase Free by default.
-- Store it in local/edge cache on demand, and only persist compact latest quotes here.
