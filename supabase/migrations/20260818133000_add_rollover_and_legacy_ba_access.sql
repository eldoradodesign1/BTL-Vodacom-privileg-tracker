begin;

alter table public.points_of_sale
  add column if not exists activity text,
  add column if not exists mfs_name text;

alter table public.ba_daily_assignments
  add column if not exists origin_assignment_id uuid references public.ba_daily_assignments(id) on delete set null,
  add column if not exists carried_from_date date,
  add column if not exists carry_reason text;

alter table public.ba_daily_assignments drop constraint if exists ba_daily_assignments_status_check;
alter table public.ba_daily_assignments add constraint ba_daily_assignments_status_check
  check (status in ('planned', 'in_progress', 'visited', 'not_visited', 'carried_forward', 'cancelled'));

create index if not exists ba_daily_assignments_origin_idx
  on public.ba_daily_assignments(origin_assignment_id) where origin_assignment_id is not null;

create or replace function public.carry_unvisited_pos_forward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_activity_date date;
begin
  if new.status = 'not_visited' and old.status is distinct from 'not_visited' then
    next_activity_date := new.activity_date + 1;

    insert into public.ba_daily_assignments (
      campaign_run_id,
      activity_date,
      ba_id,
      pos_id,
      status,
      source,
      origin_assignment_id,
      carried_from_date,
      carry_reason,
      assigned_by
    )
    values (
      new.campaign_run_id,
      next_activity_date,
      new.ba_id,
      new.pos_id,
      'carried_forward',
      'manual',
      coalesce(new.origin_assignment_id, new.id),
      new.activity_date,
      'POS non visité : report automatique au jour suivant',
      new.assigned_by
    )
    on conflict (campaign_run_id, activity_date, pos_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ba_daily_assignments_carry_forward on public.ba_daily_assignments;
create trigger ba_daily_assignments_carry_forward
  after update of status on public.ba_daily_assignments
  for each row execute function public.carry_unvisited_pos_forward();

-- L’application actuelle utilise une connexion locale par MSISDN/mot de passe.
-- Ces politiques transitoires évitent OTP et API payante ; la sécurité fine reste côté application.
create policy campaigns_legacy_anon_access on public.campaigns
for all to anon using (true) with check (true);
create policy user_campaign_assignments_legacy_anon_access on public.user_campaign_assignments
for all to anon using (true) with check (true);
create policy campaign_runs_legacy_anon_access on public.campaign_runs
for all to anon using (true) with check (true);
create policy points_of_sale_legacy_anon_access on public.points_of_sale
for all to anon using (true) with check (true);
create policy ba_import_batches_legacy_anon_access on public.ba_import_batches
for all to anon using (true) with check (true);
create policy ba_daily_assignments_legacy_anon_access on public.ba_daily_assignments
for all to anon using (true) with check (true);
create policy ba_daily_attendance_legacy_anon_access on public.ba_daily_attendance
for all to anon using (true) with check (true);
create policy ba_pos_visits_legacy_anon_access on public.ba_pos_visits
for all to anon using (true) with check (true);
create policy ba_transactions_legacy_anon_access on public.ba_transactions
for all to anon using (true) with check (true);

create policy ba_evidence_legacy_anon_access on storage.objects
for all to anon
using (bucket_id = 'ba-evidence')
with check (bucket_id = 'ba-evidence');

commit;
