-- Restore the dedicated Youth F2F test account without altering production Merchant or Privilège users.
begin;

insert into public.users (
  id, phone, full_name, role, password_hash, supervisor_id, permanent_shop_id, user_category
)
values (
  'agt-test-ba-herve-0821000001', '0821000001', 'Agent Test', 'agent', 'password',
  'usr-youth-alpha-okito', null, 'brand_ambassador_youth'
)
on conflict (id) do update
set phone = excluded.phone,
    full_name = excluded.full_name,
    role = excluded.role,
    password_hash = excluded.password_hash,
    supervisor_id = excluded.supervisor_id,
    permanent_shop_id = null,
    user_category = excluded.user_category;

-- This is a dedicated Youth test account: remove only its obsolete campaign links, never touch other users.
delete from public.user_campaign_assignments
where user_id = 'agt-test-ba-herve-0821000001'
  and campaign_id <> (select id from public.campaigns where code = 'youth-f2f');

insert into public.user_campaign_assignments (user_id, campaign_id, is_active, assigned_by)
select 'agt-test-ba-herve-0821000001', id, true, 'usr-youth-alpha-okito'
from public.campaigns
where code = 'youth-f2f'
on conflict (user_id, campaign_id) do update
set is_active = true,
    assigned_by = excluded.assigned_by;

commit;
