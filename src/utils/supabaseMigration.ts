import { migrateLocalDataToSupabase, isSupabaseConfigured } from './supabase';

export async function runSupabaseMigration(): Promise<{ ok: boolean; message: string; summary?: unknown }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: 'Configuration Supabase absente. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
    };
  }

  try {
    const summary = await migrateLocalDataToSupabase();
    return {
      ok: true,
      message: 'Migration Supabase terminée.',
      summary
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Échec de la migration.'
    };
  }
}
