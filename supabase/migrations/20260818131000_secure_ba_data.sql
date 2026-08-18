begin;

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

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
      and role in ('admin', 'supervisor')
  )
$$;

create or replace function public.has_campaign_access(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_campaign_operator()
  or exists (
    select 1 from public.user_campaign_assignments
    where user_id = public.current_app_user_id()
      and campaign_id = target_campaign_id
      and is_active
  )
$$;

alter table public.campaigns enable row level security;
alter table public.user_campaign_assignments enable row level security;
alter table public.campaign_runs enable row level security;
alter table public.points_of_sale enable row level security;
alter table public.ba_import_batches enable row level security;
alter table public.ba_daily_assignments enable row level security;
alter table public.ba_daily_attendance enable row level security;
alter table public.ba_pos_visits enable row level security;
alter table public.ba_transactions enable row level security;

create policy campaigns_select_authorized on public.campaigns
for select to authenticated
using (public.has_campaign_access(id));

create policy user_campaign_assignments_select_self_or_operator on public.user_campaign_assignments
for select to authenticated
using (user_id = public.current_app_user_id() or public.is_campaign_operator());
create policy user_campaign_assignments_manage_operator on public.user_campaign_assignments
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy campaign_runs_select_authorized on public.campaign_runs
for select to authenticated
using (public.has_campaign_access(campaign_id));
create policy campaign_runs_manage_operator on public.campaign_runs
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy points_of_sale_select_authorized on public.points_of_sale
for select to authenticated
using (public.has_campaign_access(campaign_id));
create policy points_of_sale_manage_operator on public.points_of_sale
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy ba_import_batches_operator_only on public.ba_import_batches
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy ba_daily_assignments_select_authorized on public.ba_daily_assignments
for select to authenticated
using (public.is_campaign_operator() or ba_id = public.current_app_user_id());
create policy ba_daily_assignments_manage_operator on public.ba_daily_assignments
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

create policy ba_daily_attendance_select_authorized on public.ba_daily_attendance
for select to authenticated
using (public.is_campaign_operator() or ba_id = public.current_app_user_id());
create policy ba_daily_attendance_insert_self on public.ba_daily_attendance
for insert to authenticated
with check (ba_id = public.current_app_user_id());
create policy ba_daily_attendance_update_self_or_operator on public.ba_daily_attendance
for update to authenticated
using (ba_id = public.current_app_user_id() or public.is_campaign_operator())
with check (ba_id = public.current_app_user_id() or public.is_campaign_operator());

create policy ba_pos_visits_select_authorized on public.ba_pos_visits
for select to authenticated
using (
  public.is_campaign_operator()
  or exists (
    select 1 from public.ba_daily_assignments
    where id = daily_assignment_id
      and ba_id = public.current_app_user_id()
  )
);
create policy ba_pos_visits_manage_assigned_ba_or_operator on public.ba_pos_visits
for all to authenticated
using (
  public.is_campaign_operator()
  or exists (
    select 1 from public.ba_daily_assignments
    where id = daily_assignment_id
      and ba_id = public.current_app_user_id()
  )
)
with check (
  public.is_campaign_operator()
  or exists (
    select 1 from public.ba_daily_assignments
    where id = daily_assignment_id
      and ba_id = public.current_app_user_id()
  )
);

create policy ba_transactions_select_authorized on public.ba_transactions
for select to authenticated
using (public.is_campaign_operator() or ba_id = public.current_app_user_id());
create policy ba_transactions_insert_assigned_ba_or_operator on public.ba_transactions
for insert to authenticated
with check (
  public.is_campaign_operator()
  or (
    ba_id = public.current_app_user_id()
    and exists (
      select 1 from public.ba_daily_assignments
      where ba_id = public.current_app_user_id()
        and pos_id = ba_transactions.pos_id
        and campaign_run_id = ba_transactions.campaign_run_id
        and activity_date = (ba_transactions.occurred_at at time zone 'Africa/Kinshasa')::date
    )
  )
);
create policy ba_transactions_update_owner_or_operator on public.ba_transactions
for update to authenticated
using (public.is_campaign_operator() or ba_id = public.current_app_user_id())
with check (public.is_campaign_operator() or ba_id = public.current_app_user_id());

insert into storage.buckets (id, name, public)
values ('ba-evidence', 'ba-evidence', false)
on conflict (id) do update set public = false;

create policy ba_evidence_select_authorized on storage.objects
for select to authenticated
using (
  bucket_id = 'ba-evidence'
  and public.has_campaign_access((storage.foldername(name))[1]::uuid)
);
create policy ba_evidence_upload_authorized on storage.objects
for insert to authenticated
with check (
  bucket_id = 'ba-evidence'
  and public.has_campaign_access((storage.foldername(name))[1]::uuid)
);

create or replace view public.ba_visit_alerts with (security_invoker = true) as
select
  v.id as visit_id,
  a.campaign_run_id,
  a.activity_date,
  a.ba_id,
  a.pos_id,
  v.visited_at,
  coalesce(count(t.id), 0) as transaction_count,
  (v.status = 'visited' and coalesce(count(t.id), 0) = 0) as is_alert
from public.ba_pos_visits v
join public.ba_daily_assignments a on a.id = v.daily_assignment_id
left join public.ba_transactions t on t.pos_visit_id = v.id and t.status <> 'rejected'
group by v.id, a.campaign_run_id, a.activity_date, a.ba_id, a.pos_id, v.visited_at, v.status;

commit;
