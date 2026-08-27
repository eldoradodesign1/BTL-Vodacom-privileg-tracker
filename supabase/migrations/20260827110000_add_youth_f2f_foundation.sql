-- Youth F2F foundation: campaign remains intentionally in draft, with no dates or targets.
-- The migration is idempotent and does not alter data from Vodacom Privilège or Merchant Educational Campaign.

begin;

-- Youth F2F BA accounts have their own category while remaining a brand-ambassador campaign type.
alter table public.users drop constraint if exists users_user_category_check;
alter table public.users add constraint users_user_category_check
  check (user_category in ('hostess', 'brand_ambassador', 'brand_ambassador_youth', 'operations'));

-- The campaign is intentionally discoverable (draft) but has no launch dates, target or campaign run.
insert into public.campaigns (
  code, name, campaign_type, status, starts_on, ends_on, daily_pos_target, transactions_per_pos_target
)
values ('youth-f2f', 'Youth F2F', 'brand_ambassador', 'draft', null, null, null, null)
on conflict (code) do nothing;

-- Reference sites are kept independently from Merchant points of sale.
create table if not exists public.youth_universities (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code text not null,
  name text not null,
  commune text,
  address text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location_validation_status text not null default 'pending'
    check (location_validation_status in ('pending', 'validated')),
  source_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, code),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

-- One university assignment per BA and per activity date. A campaign may use several BAs at one university.
create table if not exists public.youth_daily_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ba_id text not null references public.users(id) on delete restrict,
  university_id uuid not null references public.youth_universities(id) on delete restrict,
  activity_date date not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  notes text,
  assigned_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, ba_id, activity_date)
);

-- Daily check-in is deliberately separate from the university assignment. It supports the future photo/GPS flow
-- without imposing a reporting target or activity structure before the Youth F2F matrix is approved.
create table if not exists public.youth_daily_attendance (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  daily_assignment_id uuid references public.youth_daily_assignments(id) on delete set null,
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
  unique (campaign_id, ba_id, activity_date),
  check (checkin_latitude is null or checkin_latitude between -90 and 90),
  check (checkin_longitude is null or checkin_longitude between -180 and 180),
  check (checkout_latitude is null or checkout_latitude between -90 and 90),
  check (checkout_longitude is null or checkout_longitude between -180 and 180)
);

create index if not exists youth_universities_campaign_active_idx
  on public.youth_universities(campaign_id, name) where is_active;
create index if not exists youth_daily_assignments_ba_date_idx
  on public.youth_daily_assignments(ba_id, activity_date);
create index if not exists youth_daily_assignments_university_date_idx
  on public.youth_daily_assignments(university_id, activity_date);
create index if not exists youth_daily_attendance_ba_date_idx
  on public.youth_daily_attendance(ba_id, activity_date desc);

create or replace function public.set_youth_f2f_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists youth_universities_updated_at on public.youth_universities;
create trigger youth_universities_updated_at
before update on public.youth_universities
for each row execute function public.set_youth_f2f_updated_at();

drop trigger if exists youth_daily_assignments_updated_at on public.youth_daily_assignments;
create trigger youth_daily_assignments_updated_at
before update on public.youth_daily_assignments
for each row execute function public.set_youth_f2f_updated_at();

drop trigger if exists youth_daily_attendance_updated_at on public.youth_daily_attendance;
create trigger youth_daily_attendance_updated_at
before update on public.youth_daily_attendance
for each row execute function public.set_youth_f2f_updated_at();

alter table public.youth_universities enable row level security;
alter table public.youth_daily_assignments enable row level security;
alter table public.youth_daily_attendance enable row level security;

grant select, insert, update, delete on public.youth_universities to anon, authenticated;
grant select, insert, update, delete on public.youth_daily_assignments to anon, authenticated;
grant select, insert, update, delete on public.youth_daily_attendance to anon, authenticated;

drop policy if exists youth_universities_legacy_anon_access on public.youth_universities;
create policy youth_universities_legacy_anon_access on public.youth_universities
  for all to anon using (true) with check (true);
drop policy if exists youth_daily_assignments_legacy_anon_access on public.youth_daily_assignments;
create policy youth_daily_assignments_legacy_anon_access on public.youth_daily_assignments
  for all to anon using (true) with check (true);
drop policy if exists youth_daily_attendance_legacy_anon_access on public.youth_daily_attendance;
create policy youth_daily_attendance_legacy_anon_access on public.youth_daily_attendance
  for all to anon using (true) with check (true);

drop policy if exists youth_universities_authenticated_access on public.youth_universities;
create policy youth_universities_authenticated_access on public.youth_universities
  for all to authenticated using (true) with check (true);
drop policy if exists youth_daily_assignments_authenticated_access on public.youth_daily_assignments;
create policy youth_daily_assignments_authenticated_access on public.youth_daily_assignments
  for all to authenticated using (true) with check (true);
drop policy if exists youth_daily_attendance_authenticated_access on public.youth_daily_attendance;
create policy youth_daily_attendance_authenticated_access on public.youth_daily_attendance
  for all to authenticated using (true) with check (true);

with youth_campaign as (
  select id from public.campaigns where code = 'youth-f2f'
)
insert into public.youth_universities (
  campaign_id, code, name, commune, address, location_validation_status, source_url, notes
)
select youth_campaign.id, seed.code, seed.name, seed.commune, seed.address, 'pending', seed.source_url,
       'Adresse issue de la source institutionnelle ; coordonnées GPS à confirmer avant affectation terrain.'
from youth_campaign
cross join (values
  ('UNIKIN-MONT-AMBA', 'Université de Kinshasa', 'Lemba', 'Campus du Mont Amba, Lemba, Kinshasa', 'https://www.unikin.ac.cd/en/presentation-de-lunikin'),
  ('ULK-LIMETE', 'Université Libre de Kinshasa', 'Limete', 'N°36, 15e Rue, Quartier Industriel, Limete, Kinshasa', 'https://ulk-rdc.ac/'),
  ('UJBK-NGALIEMA', 'Université Jacques Bossuet de Kinshasa', 'Ngaliema', '62, avenue Souvenir, quartier Bumba (UPN-Verkis), Ngaliema, Kinshasa', 'https://www.jacques-bossuet.com/'),
  ('UJBK-MONT-NGAFULA', 'Université Jacques Bossuet de Kinshasa', 'Mont-Ngafula', 'Avenue Minuku n°01 bis, quartier Matadi Mayo, Mont-Ngafula, Kinshasa', 'https://www.jacques-bossuet.com/')
) as seed(code, name, commune, address, source_url)
on conflict (campaign_id, code) do nothing;

-- The phone format is normalized locally (0XXXXXXXXX), which the existing login accepts together with +243XXXXXXXXX.
insert into public.users (
  id, phone, full_name, role, password_hash, supervisor_id, permanent_shop_id, user_category
)
values (
  'usr-youth-alpha-okito', '0821000008', 'Alpha Okito', 'supervisor', 'test', null, null, 'operations'
)
on conflict (id) do nothing;

with candidate_data(id, phone, full_name) as (
values
  ('usr-youth-810773633', '0810773633', 'Altopheur Mvunzi Kinyambi'),
  ('usr-youth-822040040', '0822040040', 'CHRISTIAN MUPAPA PELANGULA'),
  ('usr-youth-836630889', '0836630889', 'MOÏSE KANGAWODJA OKENDA'),
  ('usr-youth-812391118', '0812391118', 'Alpha Kabanga Mukulu'),
  ('usr-youth-818596445', '0818596445', 'Guylain Tshimanga Kalonji'),
  ('usr-youth-814892803', '0814892803', 'Grâce Nsubila Mubikayi'),
  ('usr-youth-817005071', '0817005071', 'Daniel Gbalanu Ndegea'),
  ('usr-youth-830003812', '0830003812', 'COLOMBE LIABU MBOWI'),
  ('usr-youth-832289671', '0832289671', 'Anelka Bazilepo Anelka'),
  ('usr-youth-862348200', '0862348200', 'Dorcas Okonda Ometanga'),
  ('usr-youth-836473238', '0836473238', 'Henock Kangudi Mbuyi'),
  ('usr-youth-816200535', '0816200535', 'Celine Atamba Okenda'),
  ('usr-youth-810789148', '0810789148', 'Cherubin Ohelo Ongombe'),
  ('usr-youth-810165605', '0810165605', 'PERSIDE MULENGA BIUMA'),
  ('usr-youth-839074320', '0839074320', 'Dorcas Kibansala Mafuta'),
  ('usr-youth-837727930', '0837727930', 'Jeannine Mbelu Bukasa'),
  ('usr-youth-823645580', '0823645580', 'Divine Lusamba Bonyi'),
  ('usr-youth-828108159', '0828108159', 'Naomie Mbombo Kabeya'),
  ('usr-youth-836085400', '0836085400', 'Ketshia EKOFO Mboyo'),
  ('usr-youth-861952069', '0861952069', 'Fyfy Vilhena Nzinga'),
  ('usr-youth-822734038', '0822734038', 'Christiane Mayele Elali'),
  ('usr-youth-815704329', '0815704329', 'Eudoxie Matondo Ma mbela'),
  ('usr-youth-839282727', '0839282727', 'Exaucé Luviya Lokonga'),
  ('usr-youth-812670884', '0812670884', 'Ruth Limbangi Lutete'),
  ('usr-youth-844059251', '0844059251', 'CHRISTIVIE KAVIRA ISAMBA'),
  ('usr-youth-827975630', '0827975630', 'Dorcas Tshituka Mukendi'),
  ('usr-youth-821244644', '0821244644', 'Chadrack Songa Biembe'),
  ('usr-youth-833642603', '0833642603', 'Israël Diyeka Kiakuama')
)
insert into public.users (
  id, phone, full_name, role, password_hash, supervisor_id, permanent_shop_id, user_category
)
select c.id, c.phone, c.full_name, 'agent', 'password', 'usr-youth-alpha-okito', null, 'brand_ambassador_youth'
from candidate_data c
where not exists (
  select 1
  from public.users existing
  where (case
    when regexp_replace(existing.phone, '[^0-9]', '', 'g') like '0%'
      then '243' || substring(regexp_replace(existing.phone, '[^0-9]', '', 'g') from 2)
    else regexp_replace(existing.phone, '[^0-9]', '', 'g')
  end) = ('243' || substring(c.phone from 2))
  and existing.id <> c.id
)
on conflict (id) do nothing;

with youth_campaign as (
  select id from public.campaigns where code = 'youth-f2f'
), youth_agents as (
  select id, 'usr-youth-alpha-okito'::text as assigned_by
  from public.users
  where id like 'usr-youth-%'
    and id <> 'usr-youth-alpha-okito'
)
insert into public.user_campaign_assignments (user_id, campaign_id, is_active, assigned_by)
select youth_agents.id, youth_campaign.id, true, youth_agents.assigned_by
from youth_agents cross join youth_campaign
on conflict (user_id, campaign_id) do nothing;

commit;
