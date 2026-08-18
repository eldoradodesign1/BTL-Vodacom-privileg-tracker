begin;

-- Multi-campaign identity layer. Existing Vodacom users remain usable while
-- future secure Supabase Auth identities are linked through auth_user_id.
alter table public.users
  add column if not exists user_category text not null default 'hostess',
  add column if not exists auth_user_id uuid;

update public.users
set user_category = case
  when role = 'agent' then 'hostess'
  else 'operations'
end
where user_category is null or user_category = 'hostess';

alter table public.users
  drop constraint if exists users_user_category_check;
alter table public.users
  add constraint users_user_category_check
  check (user_category in ('hostess', 'brand_ambassador', 'operations'));

create unique index if not exists users_auth_user_id_key
  on public.users(auth_user_id)
  where auth_user_id is not null;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  campaign_type text not null check (campaign_type in ('hostess', 'brand_ambassador')),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  starts_on date,
  ends_on date,
  daily_pos_target integer,
  transactions_per_pos_target integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on),
  check (daily_pos_target is null or daily_pos_target > 0),
  check (transactions_per_pos_target is null or transactions_per_pos_target >= 0)
);

insert into public.campaigns (
  code, name, campaign_type, status, daily_pos_target, transactions_per_pos_target
) values
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

create index if not exists user_campaign_assignments_campaign_user_idx
  on public.user_campaign_assignments(campaign_id, user_id) where is_active;
create index if not exists points_of_sale_campaign_pool_idx
  on public.points_of_sale(campaign_id, pool) where is_active;
create index if not exists ba_daily_assignments_ba_date_idx
  on public.ba_daily_assignments(ba_id, activity_date);
create index if not exists ba_daily_assignments_run_date_idx
  on public.ba_daily_assignments(campaign_run_id, activity_date);
create index if not exists ba_daily_attendance_ba_date_idx
  on public.ba_daily_attendance(ba_id, activity_date);
create index if not exists ba_transactions_ba_occurred_at_idx
  on public.ba_transactions(ba_id, occurred_at desc);
create index if not exists ba_transactions_pos_occurred_at_idx
  on public.ba_transactions(pos_id, occurred_at desc);

-- Reports a visible alert whenever a completed POS visit has no recorded transaction.
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

-- Helpers for RLS. The existing custom users table is linked progressively
-- through users.auth_user_id during the secure authentication rollout.
create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_campaign_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = public.current_app_user_id()
      and role in ('admin', 'supervisor')
  )
$$;

create or replace function public.has_campaign_access(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_campaign_operator()
  or exists (
    select 1 from public.user_campaign_assignments uca
    where uca.user_id = public.current_app_user_id()
      and uca.campaign_id = target_campaign_id
      and uca.is_active
  )
$$;

alter table public.campaigns enable row level security;
alter table public.user_campaign_assignments enable row level security;
alter table public.campaign_runs enable row level security;
alter table public.points_of_sale enable row level security;
alter table public.ba_import_batches enable row level security;
alter table public.ba_daily_assignments enable row level security;
alter table public.ba_daily_attendance enable row level security;
alter table public.ba_pos_visits enable row level security;
alter table public.ba_transactions enable row level security;

create policy campaigns_select_authorized on public.campaigns
for select to authenticated
using (public.has_campaign_access(id));

create policy user_campaign_assignments_select_self_or_operator on public.user_campaign_assignments
for select to authenticated
using (user_id = public.current_app_user_id() or public.is_campaign_operator());

create policy user_campaign_assignments_manage_operator on public.user_campaign_assignments
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy campaign_runs_select_authorized on public.campaign_runs
for select to authenticated
using (public.has_campaign_access(campaign_id));

create policy campaign_runs_manage_operator on public.campaign_runs
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy points_of_sale_select_authorized on public.points_of_sale
for select to authenticated
using (public.has_campaign_access(campaign_id));

create policy points_of_sale_manage_operator on public.points_of_sale
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy ba_import_batches_operator_only on public.ba_import_batches
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy ba_daily_assignments_select_authorized on public.ba_daily_assignments
for select to authenticated
using (
  public.is_campaign_operator()
  or ba_id = public.current_app_user_id()
);

create policy ba_daily_assignments_manage_operator on public.ba_daily_assignments
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy ba_daily_attendance_select_authorized on public.ba_daily_attendance
for select to authenticated
using (
  public.is_campaign_operator()
  or ba_id = public.current_app_user_id()
);

create policy ba_daily_attendance_insert_self on public.ba_daily_attendance
for insert to authenticated
with check (ba_id = public.current_app_user_id());

create policy ba_daily_attendance_update_self_or_operator on public.ba_daily_attendance
for update to authenticated
using (ba_id = public.current_app_user_id() or public.is_campaign_operator())
with check (ba_id = public.current_app_user_id() or public.is_campaign_operator());

create policy ba_pos_visits_select_authorized on public.ba_pos_visits
for select to authenticated
using (
  public.is_campaign_operator()
  or exists (
    select 1 from public.ba_daily_assignments a
    where a.id = daily_assignment_id
      and a.ba_id = public.current_app_user_id()
  )
);

create policy ba_pos_visits_manage_assigned_ba_or_operator on public.ba_pos_visits
for all to authenticated
using (
  public.is_campaign_operator()
  or exists (
    select 1 from public.ba_daily_assignments a
    where a.id = daily_assignment_id
      and a.ba_id = public.current_app_user_id()
  )
)
with check (
  public.is_campaign_operator()
  or exists (
    select 1 from public.ba_daily_assignments a
    where a.id = daily_assignment_id
      and a.ba_id = public.current_app_user_id()
  )
);

create policy ba_transactions_select_authorized on public.ba_transactions
for select to authenticated
using (public.is_campaign_operator() or ba_id = public.current_app_user_id());

create policy ba_transactions_insert_assigned_ba_or_operator on public.ba_transactions
for insert to authenticated
with check (
  public.is_campaign_operator()
  or (
    ba_id = public.current_app_user_id()
    and exists (
      select 1 from public.ba_daily_assignments a
      where a.ba_id = public.current_app_user_id()
        and a.pos_id = ba_transactions.pos_id
        and a.campaign_run_id = ba_transactions.campaign_run_id
        and a.activity_date = (ba_transactions.occurred_at at time zone 'Africa/Kinshasa')::date
    )
  )
);

create policy ba_transactions_update_owner_or_operator on public.ba_transactions
for update to authenticated
using (public.is_campaign_operator() or ba_id = public.current_app_user_id())
with check (public.is_campaign_operator() or ba_id = public.current_app_user_id());

insert into storage.buckets (id, name, public)
values ('ba-evidence', 'ba-evidence', false)
on conflict (id) do update set public = false;

create policy ba_evidence_select_authorized on storage.objects
for select to authenticated
using (
  bucket_id = 'ba-evidence'
  and public.has_campaign_access((storage.foldername(name))[1]::uuid)
);

create policy ba_evidence_upload_authorized on storage.objects
for insert to authenticated
with check (
  bucket_id = 'ba-evidence'
  and public.has_campaign_access((storage.foldername(name))[1]::uuid)
);

commit;
