begin;

alter table public.users
  add column if not exists user_category text not null default 'hostess',
  add column if not exists auth_user_id uuid;

update public.users
set user_category = case
  when role = 'agent' then 'hostess'
  else 'operations'
end
where user_category is null or user_category = 'hostess';

alter table public.users drop constraint if exists users_user_category_check;
alter table public.users add constraint users_user_category_check
  check (user_category in ('hostess', 'brand_ambassador', 'operations'));

create unique index if not exists users_auth_user_id_key
  on public.users(auth_user_id) where auth_user_id is not null;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  campaign_type text not null check (campaign_type in ('hostess', 'brand_ambassador')),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  starts_on date,
  ends_on date,
  daily_pos_target integer check (daily_pos_target is null or daily_pos_target > 0),
  transactions_per_pos_target integer check (transactions_per_pos_target is null or transactions_per_pos_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

insert into public.campaigns (code, name, campaign_type, status, daily_pos_target, transactions_per_pos_target)
values
  ('vodacom-privilege', 'Vodacom Privilège', 'hostess', 'active', null, null),
  ('merchant-educational-campaign', 'Merchant Educational Campaign', 'brand_ambassador', 'active', 15, 3)
on conflict (code) do update
set name = excluded.name,
    campaign_type = excluded.campaign_type,
    daily_pos_target = excluded.daily_pos_target,
    transactions_per_pos_target = excluded.transactions_per_pos_target,
    updated_at = now();

create table if not exists public.user_campaign_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by text references public.users(id) on delete set null,
  unique (user_id, campaign_id)
);

insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select u.id, c.id, true
from public.users u
join public.campaigns c on c.code = 'vodacom-privilege'
where u.role = 'agent'
on conflict (user_id, campaign_id) do nothing;

create table if not exists public.campaign_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed', 'archived')),
  daily_pos_target integer not null default 15 check (daily_pos_target > 0),
  transactions_per_pos_target integer not null default 3 check (transactions_per_pos_target >= 0),
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on)
);

create table if not exists public.points_of_sale (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  denomination text not null,
  agent_number text not null,
  address text not null,
  pool text not null check (pool in ('Funa', 'Mont amba', 'Tshangu', 'Lukunga')),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, agent_number),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.ba_import_batches (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind text not null check (kind in ('points_of_sale', 'daily_assignments')),
  source_filename text not null,
  file_path text,
  row_count integer not null default 0 check (row_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  errors jsonb not null default '[]'::jsonb,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ba_daily_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  activity_date date not null,
  ba_id text not null references public.users(id) on delete restrict,
  pos_id uuid not null references public.points_of_sale(id) on delete restrict,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'visited', 'not_visited', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'csv', 'xlsx')),
  import_batch_id uuid references public.ba_import_batches(id) on delete set null,
  assigned_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_run_id, activity_date, pos_id)
);

create index if not exists user_campaign_assignments_campaign_user_idx
  on public.user_campaign_assignments(campaign_id, user_id) where is_active;
create index if not exists points_of_sale_campaign_pool_idx
  on public.points_of_sale(campaign_id, pool) where is_active;
create index if not exists ba_daily_assignments_ba_date_idx
  on public.ba_daily_assignments(ba_id, activity_date);
create index if not exists ba_daily_assignments_run_date_idx
  on public.ba_daily_assignments(campaign_run_id, activity_date);

commit;
