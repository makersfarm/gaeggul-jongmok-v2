create table if not exists public.dart_corp_codes (
  stock_code text primary key,
  corp_code text not null,
  corp_name text not null,
  modify_date text,
  updated_at timestamptz not null default now()
);

create table if not exists public.dart_financial_snapshots (
  id bigserial primary key,
  stock_code text not null,
  corp_code text not null,
  business_year integer not null,
  report_code text not null,
  metrics jsonb not null,
  raw_accounts jsonb not null,
  stored_at timestamptz not null default now(),
  unique (stock_code, business_year, report_code)
);

create table if not exists public.market_price_snapshots (
  id bigserial primary key,
  stock_code text not null,
  indicators jsonb not null,
  prices jsonb not null,
  stored_at timestamptz not null default now(),
  unique (stock_code)
);

create table if not exists public.stock_analysis_snapshots (
  id bigserial primary key,
  stock_code text not null,
  payload jsonb not null,
  stored_at timestamptz not null default now()
);
