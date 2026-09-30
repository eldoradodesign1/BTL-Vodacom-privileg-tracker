-- Vodacom Fondation - Inauguration Forage is a one-day hostess event.
insert into public.campaigns (
  code, name, campaign_type, status, starts_on, ends_on, daily_pos_target, transactions_per_pos_target
)
values (
  'vodacom-fondation-inauguration-forage-2026',
  'Vodacom Fondation - Inauguration Forage',
  'event',
  'active',
  '2026-10-02',
  '2026-10-02',
  null,
  null
)
on conflict (code) do update set
  name = excluded.name,
  campaign_type = excluded.campaign_type,
  status = excluded.status,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  daily_pos_target = null,
  transactions_per_pos_target = null,
  updated_at = now();

-- Initial team only: Eunice Muleba and Judith Onema.
insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select u.id, c.id, true
from public.users u
cross join public.campaigns c
where c.code = 'vodacom-fondation-inauguration-forage-2026'
  and u.role = 'agent'
  and u.user_category = 'hostess'
  and lower(trim(u.full_name)) in ('eunice muleba', 'judith onema')
on conflict (user_id, campaign_id) do update set is_active = true;
