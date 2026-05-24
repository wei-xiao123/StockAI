create extension if not exists "pgcrypto";

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  user_id uuid not null,
  is_active boolean not null default true,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_sessions_session_id
  on public.user_sessions (session_id);

create index if not exists idx_user_sessions_user_id_created_at
  on public.user_sessions (user_id, created_at desc);

create table if not exists public.analysis_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  symbol varchar(6) not null,
  stock_name text not null,
  market text not null default 'CN',
  latest_trade_date date not null,
  sentiment text not null check (sentiment in ('bullish', 'neutral', 'bearish')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  summary text not null,
  key_drivers jsonb not null,
  risk_factors jsonb not null,
  quote_snapshot jsonb not null,
  chart_meta jsonb not null,
  analysis_json jsonb not null,
  llm_provider text not null default 'siliconflow',
  llm_model text not null,
  prompt_version text not null default 'v1',
  source_provider text not null default 'akshare',
  created_at timestamptz not null default now()
);

alter table public.user_sessions enable row level security;
create index if not exists idx_analysis_records_created_at
  on public.analysis_records (created_at desc);

create index if not exists idx_analysis_records_symbol_created_at
  on public.analysis_records (symbol, created_at desc);

create index if not exists idx_analysis_records_user_created_at
  on public.analysis_records (user_id, created_at desc);

create index if not exists idx_analysis_records_sentiment_risk
  on public.analysis_records (sentiment, risk_level);

alter table public.analysis_records enable row level security;

comment on table public.analysis_records is
  'Stores AI analysis runs for A-share stocks. Frontend must access through backend APIs only.';
