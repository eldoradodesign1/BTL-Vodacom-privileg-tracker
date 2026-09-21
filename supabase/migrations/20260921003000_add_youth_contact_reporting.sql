begin;

create table if not exists public.youth_contact_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  attendance_id uuid references public.youth_daily_attendance(id) on delete set null,
  ba_id text not null references public.users(id) on delete restrict,
  activity_date date not null,
  region text not null check (region in ('Bandundu','Equateur','Kongo_Central','Kinshasa','Province_Orientale','H_Lualaba','H_Katanga','Kasai_Occidental','Kasai_Oriental','Maniema','Nord_Kivu','Sud_Kivu')),
  subscriber_type text not null check (subscriber_type in ('new_connection','existing_mpesa_no_app','existing_no_mpesa_no_app')),
  subscriber_phone text not null,
  subscriber_name text not null,
  actions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists youth_contact_reports_ba_date_idx on public.youth_contact_reports(ba_id, activity_date desc);
create index if not exists youth_contact_reports_campaign_date_idx on public.youth_contact_reports(campaign_id, activity_date desc);

create or replace function public.set_youth_contact_reports_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists youth_contact_reports_updated_at on public.youth_contact_reports;
create trigger youth_contact_reports_updated_at before update on public.youth_contact_reports for each row execute function public.set_youth_contact_reports_updated_at();

alter table public.youth_contact_reports enable row level security;
grant select, insert, update, delete on public.youth_contact_reports to anon, authenticated;
drop policy if exists youth_contact_reports_legacy_anon_access on public.youth_contact_reports;
create policy youth_contact_reports_legacy_anon_access on public.youth_contact_reports for all to anon using (true) with check (true);
drop policy if exists youth_contact_reports_authenticated_access on public.youth_contact_reports;
create policy youth_contact_reports_authenticated_access on public.youth_contact_reports for all to authenticated using (true) with check (true);

commit;
