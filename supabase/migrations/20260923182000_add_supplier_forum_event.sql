-- Supplier Forum is a one-day event, operationally isolated from campaign activity.
alter table public.campaigns drop constraint if exists campaigns_campaign_type_check;
alter table public.campaigns add constraint campaigns_campaign_type_check check (campaign_type in ('hostess', 'brand_ambassador', 'event'));

insert into public.campaigns (code, name, campaign_type, status, starts_on, ends_on, daily_pos_target, transactions_per_pos_target)
values ('vodacom-supplier-forum-sept-2026', 'Vodacom Supplier Forum (Sept 2026)', 'event', 'active', '2026-09-25', '2026-09-25', null, null)
on conflict (code) do update set
  name = excluded.name,
  campaign_type = excluded.campaign_type,
  status = excluded.status,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  daily_pos_target = null,
  transactions_per_pos_target = null,
  updated_at = now();

create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.campaigns(id) on delete cascade,
  agent_id text not null references public.users(id) on delete cascade,
  activity_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  checkin_at timestamptz,
  checkin_latitude numeric(10, 7),
  checkin_longitude numeric(10, 7),
  checkin_accuracy_m numeric(10, 2),
  checkin_photo_path text,
  checkout_at timestamptz,
  checkout_latitude numeric(10, 7),
  checkout_longitude numeric(10, 7),
  checkout_accuracy_m numeric(10, 2),
  checkout_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, agent_id, activity_date),
  check (checkin_latitude is null or checkin_latitude between -90 and 90),
  check (checkin_longitude is null or checkin_longitude between -180 and 180),
  check (checkout_latitude is null or checkout_latitude between -90 and 90),
  check (checkout_longitude is null or checkout_longitude between -180 and 180)
);
create index if not exists event_attendance_event_date_idx on public.event_attendance (event_id, activity_date);
create index if not exists event_attendance_agent_date_idx on public.event_attendance (agent_id, activity_date);

-- Assign only the five named hostesses found in the users table; no user is invented.
insert into public.user_campaign_assignments (user_id, campaign_id, is_active)
select u.id, c.id, true
from public.users u
cross join public.campaigns c
where c.code = 'vodacom-supplier-forum-sept-2026'
  and u.role = 'agent'
  and u.user_category = 'hostess'
  and (
    lower(trim(u.full_name)) like 'zerhuia%'
    or lower(trim(u.full_name)) like 'laureine%'
    or lower(trim(u.full_name)) like 'judith%'
    or lower(trim(u.full_name)) like 'tina%'
    or lower(trim(u.full_name)) like 'loïs%'
    or lower(trim(u.full_name)) like 'lois%'
  )
on conflict (user_id, campaign_id) do update set is_active = true;

-- Alpha is the sole event supervisor, if that existing account is present.
insert into public.agent_campaign_supervisor_assignments (agent_id, supervisor_id, campaign_id, is_active)
select a.user_id, s.id, c.id, true
from public.user_campaign_assignments a
join public.campaigns c on c.id = a.campaign_id and c.code = 'vodacom-supplier-forum-sept-2026'
join public.users s on lower(s.full_name) = 'alpha okito'
where a.campaign_id = c.id
on conflict do nothing;

grant select, insert, update on public.event_attendance to anon, authenticated;
alter table public.event_attendance enable row level security;
drop policy if exists event_attendance_public_read on public.event_attendance;
drop policy if exists event_attendance_public_write on public.event_attendance;
create policy event_attendance_public_read on public.event_attendance for select using (true);
create policy event_attendance_public_write on public.event_attendance for all using (true) with check (true);
