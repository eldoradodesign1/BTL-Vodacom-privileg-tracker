begin;

-- Test Brand Ambassador assigned to Hervé Ntalu for the Merchant campaign.
insert into public.users (
  id,
  full_name,
  phone,
  role,
  password_hash,
  supervisor_id,
  user_category
)
values (
  'agt-test-ba-herve-0821000001',
  'Agent Test',
  '0821000001',
  'agent',
  'password',
  'sup-0001-4a11-a881-100000000001',
  'brand_ambassador'
)
on conflict (id) do update
set full_name = excluded.full_name,
    phone = excluded.phone,
    role = excluded.role,
    password_hash = excluded.password_hash,
    supervisor_id = excluded.supervisor_id,
    user_category = excluded.user_category;

insert into public.user_campaign_assignments (
  user_id,
  campaign_id,
  is_active,
  assigned_by
)
select
  'agt-test-ba-herve-0821000001',
  c.id,
  true,
  'sup-0001-4a11-a881-100000000001'
from public.campaigns c
where c.code = 'merchant-educational-campaign'
on conflict (user_id, campaign_id) do update
set is_active = true,
    assigned_by = excluded.assigned_by;

commit;
