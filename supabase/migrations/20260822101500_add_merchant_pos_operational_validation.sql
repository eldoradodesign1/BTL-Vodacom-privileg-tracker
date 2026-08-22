begin;

-- Une validation terrain décrit l'état réel observé par le BA. Elle ne modifie pas
-- automatiquement points_of_sale.is_active, qui reste le statut du référentiel central.
alter table public.ba_pos_visits
  add column if not exists operational_status text not null default 'active',
  add column if not exists operational_confirmed_at timestamptz,
  add column if not exists operational_note text;

alter table public.ba_pos_visits
  drop constraint if exists ba_pos_visits_operational_status_check;

alter table public.ba_pos_visits
  add constraint ba_pos_visits_operational_status_check
  check (operational_status in ('active', 'inactive'));

update public.ba_pos_visits
set operational_status = 'active',
    operational_confirmed_at = coalesce(operational_confirmed_at, visited_at, created_at)
where operational_status is null
   or operational_confirmed_at is null;

create index if not exists ba_pos_visits_operational_status_idx
  on public.ba_pos_visits(campaign_run_id, activity_date, operational_status);

commit;
