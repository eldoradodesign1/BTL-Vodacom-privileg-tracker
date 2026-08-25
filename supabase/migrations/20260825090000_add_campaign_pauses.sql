begin;

create table if not exists public.campaign_pauses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  reason text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists campaign_pauses_campaign_dates_idx
  on public.campaign_pauses(campaign_id, starts_on desc, ends_on);

alter table public.campaign_pauses enable row level security;

create policy campaign_pauses_select_authorized on public.campaign_pauses
for select to authenticated
using (public.has_campaign_access(campaign_id));

create policy campaign_pauses_manage_operator on public.campaign_pauses
for all to authenticated
using (public.is_campaign_operator())
with check (public.is_campaign_operator());

commit;
