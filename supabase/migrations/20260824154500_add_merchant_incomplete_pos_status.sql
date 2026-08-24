begin;

-- Un POS actif quitté avant son objectif transactionnel reste consultable comme
-- inachevé, sans être confondu avec une visite non effectuée ou un POS non actif.
alter table public.ba_pos_visits
  drop constraint if exists ba_pos_visits_status_check;

alter table public.ba_pos_visits
  add constraint ba_pos_visits_status_check
  check (status in ('planned', 'visited', 'incomplete', 'alerted', 'not_visited'));

create index if not exists ba_pos_visits_incomplete_lookup_idx
  on public.ba_pos_visits(campaign_run_id, ba_id, activity_date, status)
  where status = 'incomplete';

commit;
