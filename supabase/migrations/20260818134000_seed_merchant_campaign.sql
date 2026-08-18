begin;

insert into public.users (
  id,
  phone,
  full_name,
  role,
  password_hash,
  permanent_shop_id,
  user_category
)
values
  ('ba-dieu-merci-makami', '0861521593', 'Dieu Merci Makami', 'agent', 'password', 'merchant-educational', 'brand_ambassador'),
  ('ba-jonathan-makanisa', '0824690030', 'Jonathan Makanisa', 'agent', 'password', 'merchant-educational', 'brand_ambassador'),
  ('ba-antoine-ifefa', '0825883563', 'Antoine Ifefa', 'agent', 'password', 'merchant-educational', 'brand_ambassador'),
  ('ba-plamedi-kashama', '0831686474', 'Plamedi Kashama', 'agent', 'password', 'merchant-educational', 'brand_ambassador'),
  ('ba-chrisco-kidila', '0823750818', 'Chrisco Kidila', 'agent', 'password', 'merchant-educational', 'brand_ambassador'),
  ('ba-exauce-lukombo', '0971424128', 'Exaucé Lukombo', 'agent', 'password', 'merchant-educational', 'brand_ambassador')
on conflict (id) do update
set phone = excluded.phone,
    full_name = excluded.full_name,
    role = excluded.role,
    password_hash = excluded.password_hash,
    permanent_shop_id = excluded.permanent_shop_id,
    user_category = excluded.user_category;

insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select u.id, c.id, true
from public.users u
join public.campaigns c on c.code = 'merchant-educational-campaign'
where u.id in (
  'ba-dieu-merci-makami',
  'ba-jonathan-makanisa',
  'ba-antoine-ifefa',
  'ba-plamedi-kashama',
  'ba-chrisco-kidila',
  'ba-exauce-lukombo'
)
on conflict (user_id, campaign_id) do update set is_active = true;

insert into public.campaign_runs (
  campaign_id,
  name,
  starts_on,
  ends_on,
  status,
  daily_pos_target,
  transactions_per_pos_target
)
select
  c.id,
  'Merchant Educational Campaign — Vague initiale',
  current_date + 1,
  current_date + 10,
  'active',
  15,
  3
from public.campaigns c
where c.code = 'merchant-educational-campaign'
  and not exists (
    select 1
    from public.campaign_runs r
    where r.campaign_id = c.id
      and r.name = 'Merchant Educational Campaign — Vague initiale'
  );

commit;
