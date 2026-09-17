-- M-Pesa Mikili campaign foundation.
-- This migration is already applied to the connected production project as
-- 20260917173724 / add_mpesa_mikili_campaign; this file keeps the schema in source control.

insert into public.campaigns (code, name, campaign_type, status)
values ('mpesa-mikili', 'M-Pesa Mikili', 'brand_ambassador', 'active')
on conflict (code) do update set name = excluded.name, campaign_type = excluded.campaign_type, status = excluded.status;

create table if not exists public.campaign_locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  region text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campaign_id, region, name)
);

create index if not exists campaign_locations_campaign_region_idx on public.campaign_locations (campaign_id, region, is_active);

create table if not exists public.campaign_supervisor_regions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  supervisor_id text not null references public.users(id) on delete cascade,
  region text not null,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (campaign_id, supervisor_id, region)
);

create index if not exists campaign_supervisor_regions_lookup_idx on public.campaign_supervisor_regions (campaign_id, supervisor_id, region, is_active);

create table if not exists public.mpesa_mikili_daily_attendance (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ba_id text not null references public.users(id) on delete cascade,
  activity_date date not null,
  status text not null default 'open' check (status in ('open','closed','alerted')),
  checkin_at timestamptz,
  checkin_latitude numeric,
  checkin_longitude numeric,
  checkin_accuracy_m numeric,
  checkin_photo_path text,
  checkout_at timestamptz,
  checkout_latitude numeric,
  checkout_longitude numeric,
  checkout_accuracy_m numeric,
  closing_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, ba_id, activity_date)
);

create index if not exists mpesa_mikili_attendance_day_idx on public.mpesa_mikili_daily_attendance (campaign_id, activity_date, ba_id);

create table if not exists public.mpesa_mikili_clients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  attendance_id uuid references public.mpesa_mikili_daily_attendance(id) on delete set null,
  agent_id text not null references public.users(id) on delete cascade,
  activity_date date not null,
  location_id uuid not null references public.campaign_locations(id),
  client_name text not null,
  client_phone text not null,
  existing_mikili_user text not null check (existing_mikili_user in ('yes','no','unknown')),
  presented_service text not null check (presented_service in ('send','receive','both')),
  transaction_done boolean not null default false,
  transaction_type text not null check (transaction_type in ('send','receive','both','na')),
  transaction_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mpesa_mikili_clients_day_idx on public.mpesa_mikili_clients (campaign_id, activity_date, agent_id);
create index if not exists mpesa_mikili_clients_location_idx on public.mpesa_mikili_clients (campaign_id, location_id, activity_date);

insert into public.campaign_locations (campaign_id, region, name)
select c.id, v.region, v.name
from public.campaigns c
cross join (values
  ('Kinshasa','Marché de la Liberté (Masina)'),
  ('Kinshasa','Rond-Point Victoire / Kalamu'),
  ('Kinshasa','Boulevard du 30 Juin'),
  ('Kinshasa','Autre(s)'),
  ('Kinshasa','Echangeur de Limete'),
  ('Kinshasa','NA'),
  ('Kinshasa','University of Kinshasa (UNIKIN) / UPC'),
  ('Kongo-Central','Port de Matadi'),
  ('Kongo-Central','Frontière de Lufu'),
  ('Kongo-Central','NA'),
  ('Kongo-Central','Autre(s)'),
  ('Haut-Katanga','Rond point de la poste'),
  ('Haut-Katanga','Marché Mzee Laurent-Désiré Kabila'),
  ('Haut-Katanga','Route de Kasumbalesa'),
  ('Haut-Katanga','Port de Luano'),
  ('Haut-Katanga','Université de Lubumbashi (UNILU)'),
  ('Haut-Katanga','Port de Kalemie'),
  ('Haut-Katanga','Autre(s)'),
  ('Haut-Katanga','NA')
) as v(region,name) on true
where c.code = 'mpesa-mikili'
on conflict (campaign_id, region, name) do update set is_active = true;

alter table public.campaign_locations enable row level security;
alter table public.campaign_supervisor_regions enable row level security;
alter table public.mpesa_mikili_daily_attendance enable row level security;
alter table public.mpesa_mikili_clients enable row level security;

create policy campaign_locations_read_authenticated on public.campaign_locations for select to authenticated using (true);
create policy campaign_supervisor_regions_read_authenticated on public.campaign_supervisor_regions for select to authenticated using (true);
create policy mpesa_mikili_attendance_read_authenticated on public.mpesa_mikili_daily_attendance for select to authenticated using (true);
create policy mpesa_mikili_attendance_insert_authenticated on public.mpesa_mikili_daily_attendance for insert to authenticated with check (true);
create policy mpesa_mikili_attendance_update_authenticated on public.mpesa_mikili_daily_attendance for update to authenticated using (true) with check (true);
create policy mpesa_mikili_clients_read_authenticated on public.mpesa_mikili_clients for select to authenticated using (true);
create policy mpesa_mikili_clients_insert_authenticated on public.mpesa_mikili_clients for insert to authenticated with check (true);
create policy mpesa_mikili_clients_update_authenticated on public.mpesa_mikili_clients for update to authenticated using (true) with check (true);
