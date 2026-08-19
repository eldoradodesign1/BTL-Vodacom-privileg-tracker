-- Make the global Merchant POS objective configurable per campaign run.
alter table public.campaign_runs
  add column if not exists campaign_pos_target integer;

update public.campaign_runs as runs
set campaign_pos_target = inventory.total_pos
from (
  select campaign_id, count(*)::integer as total_pos
  from public.points_of_sale
  where is_active = true
  group by campaign_id
) as inventory
where runs.campaign_id = inventory.campaign_id
  and runs.campaign_pos_target is null;

update public.campaign_runs
set campaign_pos_target = 0
where campaign_pos_target is null;

alter table public.campaign_runs
  alter column campaign_pos_target set default 0;

alter table public.campaign_runs
  alter column campaign_pos_target set not null;

alter table public.campaign_runs
  add constraint campaign_runs_campaign_pos_target_nonnegative
  check (campaign_pos_target >= 0) not valid;

alter table public.campaign_runs
  validate constraint campaign_runs_campaign_pos_target_nonnegative;
