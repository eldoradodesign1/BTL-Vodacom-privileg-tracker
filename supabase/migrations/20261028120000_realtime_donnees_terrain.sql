-- Mise à jour en direct des vues superviseur (Supabase Realtime, postgres_changes).
-- Ajoute les tables de saisie terrain à la publication supabase_realtime.
-- Aucune donnée, colonne, politique RLS ni index n'est modifié : les vues
-- superviseur lisent déjà ces tables avec le rôle anon (politiques SELECT existantes).
-- Idempotent : une table déjà publiée est ignorée.
-- Retour arrière : alter publication supabase_realtime drop table public.<table>;

do $$
declare
  t text;
begin
  foreach t in array array[
    'checkins',
    'leads',
    'daily_reports',
    'ba_daily_attendance',
    'ba_transactions',
    'ba_pos_visits',
    'merchant_fund_requests',
    'mpesa_mikili_daily_attendance',
    'mpesa_mikili_clients',
    'youth_daily_attendance',
    'youth_contact_reports',
    'event_attendance'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
