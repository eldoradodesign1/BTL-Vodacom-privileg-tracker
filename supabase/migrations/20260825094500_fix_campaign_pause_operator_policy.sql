begin;

create or replace function public.is_campaign_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = public.current_app_user_id()
      and role in ('admin', 'supervisor', 'sub_admin', 'super_admin')
  )
$$;

commit;
