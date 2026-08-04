do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    create extension pgcrypto;
  end if;
end $$;

create table if not exists public.users (
  id text primary key,
  phone text not null,
  name text not null,
  role text not null,
  password text,
  supervisor_id text,
  permanent_shop_id text,
  created_at timestamptz default now(),
  last_login timestamptz
);

create table if not exists public.shops (
  id text primary key,
  name text not null,
  city text not null,
  lat double precision,
  long double precision,
  type text not null
);

create table if not exists public.checkins (
  id text primary key,
  assignment_id text,
  agent_id text not null,
  type text not null,
  timestamp timestamptz not null,
  lat double precision not null,
  long double precision not null,
  accuracy double precision not null,
  photo text,
  photo_drive_url text,
  distance_m double precision,
  geo_status text,
  device text,
  status text not null default 'pending'
);

create table if not exists public.leads (
  id text primary key,
  timestamp timestamptz not null,
  agent_id text not null,
  shop_id text not null,
  client_name text not null,
  msisdn text not null,
  action_type text not null,
  bundle_type text,
  amount double precision,
  status text not null default 'pending'
);

create table if not exists public.daily_reports (
  id text primary key,
  date text not null,
  agent_id text not null,
  agent_name text not null,
  shop_id text not null,
  shop_name text not null,
  priv integer not null default 0,
  roam integer not null default 0,
  bund integer not null default 0,
  amount integer not null default 0,
  comment text not null default '',
  pdf_url text,
  photos jsonb default '[]'::jsonb,
  arrival_time text,
  departure_time text,
  pointage_photo text,
  maps_in text,
  maps_out text,
  drive_pdf_url text,
  report_photos_drive_urls jsonb default '[]'::jsonb
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  timestamp timestamptz not null,
  deleted boolean
);

create table if not exists public.chat_messages (
  id text primary key,
  sender_id text not null,
  sender_name text not null,
  sender_role text not null,
  message text not null,
  timestamp timestamptz not null,
  created_at timestamptz default now(),
  deleted boolean default false,
  deleted_at timestamptz,
  deleted_by text,
  read_by jsonb default '[]'::jsonb
);

alter table public.users enable row level security;
alter table public.shops enable row level security;
alter table public.checkins enable row level security;
alter table public.leads enable row level security;
alter table public.daily_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_select_all'
  ) then
    create policy "users_select_all" on public.users for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_insert_all'
  ) then
    create policy "users_insert_all" on public.users for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_update_all'
  ) then
    create policy "users_update_all" on public.users for update using (true) with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname = 'shops_select_all'
  ) then
    create policy "shops_select_all" on public.shops for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname = 'shops_insert_all'
  ) then
    create policy "shops_insert_all" on public.shops for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shops'
      and policyname = 'shops_update_all'
  ) then
    create policy "shops_update_all" on public.shops for update using (true) with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'checkins'
      and policyname = 'checkins_select_all'
  ) then
    create policy "checkins_select_all" on public.checkins for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'checkins'
      and policyname = 'checkins_insert_all'
  ) then
    create policy "checkins_insert_all" on public.checkins for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'checkins'
      and policyname = 'checkins_update_all'
  ) then
    create policy "checkins_update_all" on public.checkins for update using (true) with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and policyname = 'leads_select_all'
  ) then
    create policy "leads_select_all" on public.leads for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and policyname = 'leads_insert_all'
  ) then
    create policy "leads_insert_all" on public.leads for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and policyname = 'leads_update_all'
  ) then
    create policy "leads_update_all" on public.leads for update using (true) with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_reports'
      and policyname = 'daily_reports_select_all'
  ) then
    create policy "daily_reports_select_all" on public.daily_reports for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_reports'
      and policyname = 'daily_reports_insert_all'
  ) then
    create policy "daily_reports_insert_all" on public.daily_reports for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_reports'
      and policyname = 'daily_reports_update_all'
  ) then
    create policy "daily_reports_update_all" on public.daily_reports for update using (true) with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_select_all'
  ) then
    create policy "notifications_select_all" on public.notifications for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_insert_all'
  ) then
    create policy "notifications_insert_all" on public.notifications for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_update_all'
  ) then
    create policy "notifications_update_all" on public.notifications for update using (true) with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_select_all'
  ) then
    create policy "chat_messages_select_all" on public.chat_messages for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_insert_all'
  ) then
    create policy "chat_messages_insert_all" on public.chat_messages for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_update_all'
  ) then
    create policy "chat_messages_update_all" on public.chat_messages for update using (true) with check (true);
  end if;
end $$;
