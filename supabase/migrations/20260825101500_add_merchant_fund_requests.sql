begin;

create table if not exists public.merchant_fund_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  ba_id text not null references public.users(id) on delete restrict,
  supervisor_id text references public.users(id) on delete set null,
  pos_id uuid references public.points_of_sale(id) on delete set null,
  mfs_name text,
  ba_phone text,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_fund_requests_ba_requested_idx
  on public.merchant_fund_requests(ba_id, requested_at desc);
create index if not exists merchant_fund_requests_supervisor_status_idx
  on public.merchant_fund_requests(supervisor_id, status, requested_at desc);
create index if not exists merchant_fund_requests_run_requested_idx
  on public.merchant_fund_requests(campaign_run_id, requested_at desc);

alter table public.merchant_fund_requests enable row level security;
drop policy if exists merchant_fund_requests_app_client_read on public.merchant_fund_requests;
drop policy if exists merchant_fund_requests_app_client_insert on public.merchant_fund_requests;
drop policy if exists merchant_fund_requests_app_client_update on public.merchant_fund_requests;
create policy merchant_fund_requests_app_client_read on public.merchant_fund_requests for select to anon, authenticated using (true);
create policy merchant_fund_requests_app_client_insert on public.merchant_fund_requests for insert to anon, authenticated with check (true);
create policy merchant_fund_requests_app_client_update on public.merchant_fund_requests for update to anon, authenticated using (true) with check (true);

commit;
