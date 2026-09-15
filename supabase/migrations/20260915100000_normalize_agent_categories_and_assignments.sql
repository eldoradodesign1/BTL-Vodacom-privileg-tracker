begin;

-- Youth F2F is a campaign, not a distinct field category.
update public.users
set user_category = 'brand_ambassador'
where user_category = 'brand_ambassador_youth';

-- Restore the canonical campaign memberships without deleting history.
insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select u.id, c.id, true
from public.users u
join public.campaigns c on c.code = 'vodacom-privilege'
where u.role = 'agent'
  and u.user_category = 'hostess'
on conflict (user_id, campaign_id) do update
set is_active = true;

insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select u.id, c.id, true
from public.users u
join public.campaigns c on c.code = 'merchant-educational-campaign'
where u.role = 'agent'
  and u.user_category = 'brand_ambassador'
  and not exists (
    select 1
    from public.user_campaign_assignments existing
    join public.campaigns youth on youth.id = existing.campaign_id
    where existing.user_id = u.id
      and existing.is_active = true
      and youth.code = 'youth-f2f'
  )
on conflict (user_id, campaign_id) do update
set is_active = true;

commit;
