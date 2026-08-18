begin;

create table if not exists public.ba_daily_attendance (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  ba_id text not null references public.users(id) on delete restrict,
  activity_date date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'alerted')),
  checkin_at timestamptz,
  checkin_latitude numeric(10, 7),
  checkin_longitude numeric(10, 7),
  checkin_accuracy_m numeric(10, 2),
  checkin_photo_path text,
  checkout_at timestamptz,
  checkout_latitude numeric(10, 7),
  checkout_longitude numeric(10, 7),
  checkout_accuracy_m numeric(10, 2),
  closing_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_run_id, ba_id, activity_date),
  check (checkin_latitude is null or checkin_latitude between -90 and 90),
  check (checkin_longitude is null or checkin_longitude between -180 and 180),
  check (checkout_latitude is null or checkout_latitude between -90 and 90),
  check (checkout_longitude is null or checkout_longitude between -180 and 180)
);

create table if not exists public.ba_pos_visits (
  id uuid primary key default gen_random_uuid(),
  daily_assignment_id uuid not null unique references public.ba_daily_assignments(id) on delete cascade,
  visited_at timestamptz,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accuracy_m numeric(10, 2),
  status text not null default 'planned' check (status in ('planned', 'visited', 'alerted', 'not_visited')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.ba_transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  ba_id text not null references public.users(id) on delete restrict,
  pos_id uuid not null references public.points_of_sale(id) on delete restrict,
  pos_visit_id uuid references public.ba_pos_visits(id) on delete set null,
  transaction_reference text,
  amount numeric(14, 2) not null check (amount >= 0),
  evidence_path text not null,
  occurred_at timestamptz not null default now(),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accuracy_m numeric(10, 2),
  comment text,
  status text not null default 'recorded' check (status in ('recorded', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create index if not exists ba_daily_attendance_ba_date_idx
  on public.ba_daily_attendance(ba_id, activity_date);
create index if not exists ba_transactions_ba_occurred_at_idx
  on public.ba_transactions(ba_id, occurred_at desc);
create index if not exists ba_transactions_pos_occurred_at_idx
  on public.ba_transactions(pos_id, occurred_at desc);

create or replace view public.ba_visit_alerts as
select
  v.id as visit_id,
  a.campaign_run_id,
  a.activity_date,
  a.ba_id,
  a.pos_id,
  v.visited_at,
  coalesce(count(t.id), 0) as transaction_count,
  (v.status = 'visited' and coalesce(count(t.id), 0) = 0) as is_alert
from public.ba_pos_visits v
join public.ba_daily_assignments a on a.id = v.daily_assignment_id
left join public.ba_transactions t on t.pos_visit_id = v.id and t.status <> 'rejected'
group by v.id, a.campaign_run_id, a.activity_date, a.ba_id, a.pos_id, v.visited_at, v.status;

commit;
