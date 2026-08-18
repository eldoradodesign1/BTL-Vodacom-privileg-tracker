begin;

insert into public.users (
  id,
  full_name,
  phone,
  role,
  password_hash,
  user_category,
  permanent_shop_id
)
values (
  'arnold-koma-sub-admin',
  'Arnold Koma',
  '0823031980',
  'sub_admin',
  'password',
  'operations',
  'global-operations'
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  phone = excluded.phone,
  role = excluded.role,
  password_hash = excluded.password_hash,
  user_category = excluded.user_category,
  permanent_shop_id = excluded.permanent_shop_id;

insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select 'arnold-koma-sub-admin', id, true
from public.campaigns
where code in ('vodacom-privilege', 'merchant-educational-campaign')
on conflict (user_id, campaign_id) do update set is_active = true;

commit;
