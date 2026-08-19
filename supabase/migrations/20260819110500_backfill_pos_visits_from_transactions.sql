begin;

-- Pour les transactions créées avant l’ajout du pointage POS, crée une visite
-- reconstituée avec les données de la première transaction du POS ce jour-là.
with first_transactions as (
  select distinct on (
    t.campaign_run_id,
    t.ba_id,
    t.pos_id,
    (t.occurred_at at time zone 'Africa/Kinshasa')::date
  )
    t.campaign_run_id,
    t.ba_id,
    t.pos_id,
    (t.occurred_at at time zone 'Africa/Kinshasa')::date as activity_date,
    t.occurred_at as visited_at,
    t.latitude,
    t.longitude,
    t.accuracy_m,
    t.evidence_path as arrival_photo_path
  from public.ba_transactions t
  order by
    t.campaign_run_id,
    t.ba_id,
    t.pos_id,
    (t.occurred_at at time zone 'Africa/Kinshasa')::date,
    t.occurred_at asc
)
insert into public.ba_pos_visits (
  campaign_run_id,
  ba_id,
  pos_id,
  activity_date,
  visited_at,
  latitude,
  longitude,
  accuracy_m,
  arrival_photo_path,
  status,
  comment
)
select
  ft.campaign_run_id,
  ft.ba_id,
  ft.pos_id,
  ft.activity_date,
  ft.visited_at,
  ft.latitude,
  ft.longitude,
  ft.accuracy_m,
  ft.arrival_photo_path,
  'visited',
  'Visite reconstituée depuis la première transaction enregistrée avant le pointage POS.'
from first_transactions ft
where not exists (
  select 1
  from public.ba_pos_visits v
  where v.campaign_run_id = ft.campaign_run_id
    and v.ba_id = ft.ba_id
    and v.pos_id = ft.pos_id
    and v.activity_date = ft.activity_date
)
on conflict do nothing;

commit;
