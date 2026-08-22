export const SCHEMA_SQL = `-- BTL Vodacom Privilege Tracker — schéma opérationnel
-- Les migrations versionnées dans supabase/migrations restent la source d’exécution.

create table public.users (
  id uuid primary key,
  full_name text not null,
  phone text not null unique,
  password_hash text,
  role text not null,
  user_category text,
  supervisor_id uuid,
  permanent_shop_id text
);

create table public.shops (
  id text primary key,
  name text not null,
  city text,
  type text
);

create table public.checkins (
  id uuid primary key,
  agent_id uuid not null references public.users(id),
  type text not null,
  timestamp timestamptz not null,
  lat numeric,
  long numeric,
  photo text,
  photo_drive_url text,
  status text
);

create table public.leads (
  id uuid primary key,
  agent_id uuid not null references public.users(id),
  shop_id text references public.shops(id),
  client_name text not null,
  msisdn text not null,
  action_type text not null,
  timestamp timestamptz not null,
  status text
);

create table public.daily_reports (
  id uuid primary key,
  agent_id uuid not null references public.users(id),
  date date not null,
  priv integer default 0,
  roam integer default 0,
  bund integer default 0,
  comment text
);

create table public.campaigns (
  id uuid primary key,
  code text not null unique,
  name text not null
);

create table public.campaign_runs (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id),
  start_date date not null,
  status text not null,
  campaign_pos_target integer,
  target_pos_per_ba integer,
  target_transactions_per_pos integer
);

create table public.ba_daily_attendance (
  id uuid primary key,
  campaign_run_id uuid not null references public.campaign_runs(id),
  ba_id uuid not null references public.users(id),
  activity_date date not null,
  checkin_at timestamptz,
  checkout_at timestamptz,
  checkin_photo_path text,
  closing_comment text
);

create table public.points_of_sale (
  id uuid primary key,
  agent_number text,
  denomination text not null,
  address text,
  pool text
);

create table public.ba_pos_visits (
  id uuid primary key,
  campaign_run_id uuid not null references public.campaign_runs(id),
  ba_id uuid not null references public.users(id),
  pos_id uuid not null references public.points_of_sale(id),
  activity_date date not null,
  visited_at timestamptz not null,
  latitude numeric,
  longitude numeric,
  accuracy_m numeric,
  arrival_photo_path text,
  unique (campaign_run_id, pos_id, activity_date)
);

create table public.ba_transactions (
  id uuid primary key,
  campaign_run_id uuid not null references public.campaign_runs(id),
  ba_id uuid not null references public.users(id),
  pos_id uuid not null references public.points_of_sale(id),
  pos_visit_id uuid references public.ba_pos_visits(id),
  transaction_reference text,
  client_number text not null,
  amount numeric not null,
  evidence_path text,
  occurred_at timestamptz not null,
  latitude numeric,
  longitude numeric,
  comment text,
  status text
);`;
