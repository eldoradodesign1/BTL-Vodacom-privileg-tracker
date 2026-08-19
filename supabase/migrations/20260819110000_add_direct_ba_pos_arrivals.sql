begin;

-- Les affectations journalières ne sont plus fournies : une visite est désormais créée
-- directement par le BA lors de son arrivée sur un nouveau POS de la journée.
alter table public.ba_pos_visits
  alter column daily_assignment_id drop not null;

alter table public.ba_pos_visits
  add column if not exists campaign_run_id uuid references public.campaign_runs(id) on delete cascade,
  add column if not exists ba_id text references public.users(id) on delete restrict,
  add column if not exists pos_id uuid references public.points_of_sale(id) on delete restrict,
  add column if not exists activity_date date,
  add column if not exists arrival_photo_path text;

-- Préserve la lisibilité de toute visite historique créée depuis une affectation.
update public.ba_pos_visits v
set
  campaign_run_id = coalesce(v.campaign_run_id, a.campaign_run_id),
  ba_id = coalesce(v.ba_id, a.ba_id),
  pos_id = coalesce(v.pos_id, a.pos_id),
  activity_date = coalesce(v.activity_date, a.activity_date)
from public.ba_daily_assignments a
where v.daily_assignment_id = a.id
  and (v.campaign_run_id is null or v.ba_id is null or v.pos_id is null or v.activity_date is null);

create index if not exists ba_pos_visits_run_ba_date_idx
  on public.ba_pos_visits(campaign_run_id, ba_id, activity_date, visited_at desc);

create unique index if not exists ba_pos_visits_direct_daily_unique
  on public.ba_pos_visits(campaign_run_id, ba_id, pos_id, activity_date)
  where campaign_run_id is not null
    and ba_id is not null
    and pos_id is not null
    and activity_date is not null;

commit;
