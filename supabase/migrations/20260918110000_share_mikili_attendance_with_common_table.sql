begin;

insert into public.campaign_runs (
  campaign_id, name, starts_on, ends_on, status, daily_pos_target, transactions_per_pos_target
)
select c.id, 'M-Pesa Mikili · Terrain', '2026-09-01', '2099-12-31', 'active', 1, 0
from public.campaigns c
where c.code = 'mpesa-mikili'
  and not exists (
    select 1 from public.campaign_runs r
    where r.campaign_id = c.id
      and r.name = 'M-Pesa Mikili · Terrain'
  );

drop policy if exists campaign_runs_select_mikili_custom_auth on public.campaign_runs;
create policy campaign_runs_select_mikili_custom_auth
on public.campaign_runs
for select to anon
using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_runs.campaign_id
      and c.code = 'mpesa-mikili'
  )
);

drop policy if exists ba_daily_attendance_mikili_custom_auth on public.ba_daily_attendance;
create policy ba_daily_attendance_mikili_custom_auth
on public.ba_daily_attendance
for all to anon
using (
  exists (
    select 1
    from public.campaign_runs r
    join public.campaigns c on c.id = r.campaign_id
    where r.id = ba_daily_attendance.campaign_run_id
      and c.code = 'mpesa-mikili'
  )
)
with check (
  exists (
    select 1
    from public.campaign_runs r
    join public.campaigns c on c.id = r.campaign_id
    where r.id = ba_daily_attendance.campaign_run_id
      and c.code = 'mpesa-mikili'
  )
);

commit;
