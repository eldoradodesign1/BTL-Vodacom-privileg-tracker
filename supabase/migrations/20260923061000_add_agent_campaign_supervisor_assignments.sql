-- Permet à un même agent d'être suivi par plusieurs superviseurs
-- dans la même campagne, sans modifier la relation historique users.supervisor_id.
create table if not exists public.agent_campaign_supervisor_assignments (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.users(id) on delete cascade,
  supervisor_id text not null references public.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by text references public.users(id) on delete set null,
  unique (agent_id, supervisor_id, campaign_id),
  check (agent_id <> supervisor_id)
);

create index if not exists agent_campaign_supervisor_assignments_scope_idx
  on public.agent_campaign_supervisor_assignments (campaign_id, supervisor_id, is_active);

create index if not exists agent_campaign_supervisor_assignments_agent_idx
  on public.agent_campaign_supervisor_assignments (agent_id, campaign_id, is_active);

alter table public.agent_campaign_supervisor_assignments enable row level security;

drop policy if exists agent_campaign_supervisor_assignments_select on public.agent_campaign_supervisor_assignments;
create policy agent_campaign_supervisor_assignments_select
on public.agent_campaign_supervisor_assignments
for select to anon, authenticated
using (true);

drop policy if exists agent_campaign_supervisor_assignments_manage on public.agent_campaign_supervisor_assignments;
create policy agent_campaign_supervisor_assignments_manage
on public.agent_campaign_supervisor_assignments
for all to anon, authenticated
using (true)
with check (true);

-- Compatibilité : les affectations historiques restent valides pour Privilège.
-- Elles ne sont insérées que si une ligne détaillée n'existe pas déjà.
insert into public.agent_campaign_supervisor_assignments (agent_id, supervisor_id, campaign_id)
select u.id, u.supervisor_id, c.id
from public.users u
join public.campaigns c on c.code = 'vodacom-privilege'
where u.role = 'agent'
  and u.user_category = 'hostess'
  and u.supervisor_id is not null
on conflict (agent_id, supervisor_id, campaign_id) do nothing;
