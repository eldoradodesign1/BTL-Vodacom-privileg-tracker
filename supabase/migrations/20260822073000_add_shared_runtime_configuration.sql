-- Configuration partagée servie à tous les appareils.
-- Les valeurs publiques sont lisibles par l'application ; le secret Gemini reste réservé aux fonctions Edge.

create table if not exists public.app_runtime_config (
  id boolean primary key default true check (id),
  supabase_url text not null,
  publishable_key text not null,
  gemini_configured boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_secrets (
  id boolean primary key default true check (id),
  gemini_api_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_runtime_config enable row level security;
alter table public.app_runtime_secrets enable row level security;

drop policy if exists "Application can read shared runtime configuration" on public.app_runtime_config;
create policy "Application can read shared runtime configuration"
  on public.app_runtime_config
  for select
  using (true);

-- Aucune politique cliente n'est créée pour les secrets ou les mises à jour.
-- Les écritures passent exclusivement par les fonctions Edge utilisant la service role key.

create or replace function public.touch_app_runtime_configuration()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_runtime_config_updated_at on public.app_runtime_config;
create trigger app_runtime_config_updated_at
  before update on public.app_runtime_config
  for each row execute function public.touch_app_runtime_configuration();

drop trigger if exists app_runtime_secrets_updated_at on public.app_runtime_secrets;
create trigger app_runtime_secrets_updated_at
  before update on public.app_runtime_secrets
  for each row execute function public.touch_app_runtime_configuration();
