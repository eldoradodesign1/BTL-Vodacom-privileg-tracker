begin;

-- La campagne Merchant est officiellement ouverte depuis le 18 août 2026.
update public.campaigns
set starts_on = date '2026-08-18',
    updated_at = now()
where code = 'merchant-educational-campaign';

update public.campaign_runs r
set starts_on = date '2026-08-18',
    updated_at = now()
from public.campaigns c
where r.campaign_id = c.id
  and c.code = 'merchant-educational-campaign'
  and r.starts_on <> date '2026-08-18';

-- Conserve une visite terrain canonique par POS et par jour. Les doublons de
-- démonstration déjà présents sont historisés comme alertes, sans perdre leur trace.
with ranked_visits as (
  select
    id,
    row_number() over (
      partition by campaign_run_id, pos_id, activity_date
      order by visited_at nulls last, created_at asc, id asc
    ) as visit_rank
  from public.ba_pos_visits
  where campaign_run_id is not null
    and pos_id is not null
    and activity_date is not null
)
update public.ba_pos_visits v
set status = 'alerted',
    comment = concat_ws(' ', nullif(v.comment, ''), '[Doublon historique : POS déjà pris en charge par un autre BA ce jour.]'),
    updated_at = now()
from ranked_visits ranked
where ranked.id = v.id
  and ranked.visit_rank > 1
  and v.status <> 'alerted';

-- Remplace l’unicité par BA par une exclusivité du POS, tous BA confondus.
drop index if exists public.ba_pos_visits_direct_daily_unique;
create unique index if not exists ba_pos_visits_one_pos_per_day_unique
  on public.ba_pos_visits(campaign_run_id, pos_id, activity_date)
  where campaign_run_id is not null
    and pos_id is not null
    and activity_date is not null
    and status <> 'alerted';

commit;
