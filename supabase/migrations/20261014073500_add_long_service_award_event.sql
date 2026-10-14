-- Long Service Award is a one-day attendance-only event.
insert into public.campaigns (
  code, name, campaign_type, status, starts_on, ends_on, daily_pos_target, transactions_per_pos_target
)
values (
  'long-service-award-2026',
  'Long Service Award',
  'event',
  'active',
  '2026-10-19',
  '2026-10-19',
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

-- Only existing users with exact normalized names are assigned; no account is invented.
insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select u.id, c.id, true
from public.users u
cross join public.campaigns c
where c.code = 'long-service-award-2026'
  and u.role = 'agent'
  and u.user_category = 'hostess'
  and lower(trim(u.full_name)) in (
    'tina belo',
    'marguerite marie',
    'judith onema',
    'benisia zola'
  )
on conflict (user_id, campaign_id) do update set is_active = true;

-- Alpha and Hervé both monitor the same Event.
insert into public.agent_campaign_supervisor_assignments (agent_id, supervisor_id, campaign_id, is_active)
select a.user_id, s.id, c.id, true
from public.user_campaign_assignments a
join public.campaigns c on c.id = a.campaign_id and c.code = 'long-service-award-2026'
join public.users s on lower(trim(s.full_name)) in ('hervé ntalu', 'alpha okito')
where a.campaign_id = c.id
on conflict do nothing;
