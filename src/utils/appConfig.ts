export interface RuntimeSupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SharedRuntimeConfig extends RuntimeSupabaseConfig {
  geminiConfigured: boolean;
  updatedAt: string;
}

export interface SharedRuntimeUpdate {
  actor: { phone: string; password: string };
  url: string;
  anonKey: string;
  geminiApiKey?: string;
}

const SHARED_RUNTIME_CACHE_KEY = 'btl_shared_runtime_config';
let runtimeConfig: SharedRuntimeConfig | null = null;

function readEnv(name: string): string | undefined {
  const env = (typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env : undefined);
  const value = env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function validConfig(config: Partial<RuntimeSupabaseConfig> | null | undefined): config is RuntimeSupabaseConfig {
  return Boolean(config?.url?.trim() && config.anonKey?.trim());
}

function dispatchUpdate(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('btl-runtime-config-updated'));
}

function cacheSharedConfig(config: SharedRuntimeConfig): void {
  runtimeConfig = config;
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHARED_RUNTIME_CACHE_KEY, JSON.stringify(config));
  dispatchUpdate();
}

function readCachedSharedConfig(): SharedRuntimeConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARED_RUNTIME_CACHE_KEY) || 'null') as Partial<SharedRuntimeConfig> | null;
    if (!parsed || !validConfig(parsed)) return null;
    const shared = parsed as SharedRuntimeConfig;
    if (typeof shared.geminiConfigured !== 'boolean' || !shared.updatedAt) return null;
    return { url: shared.url.trim(), anonKey: shared.anonKey.trim(), geminiConfigured: shared.geminiConfigured, updatedAt: shared.updatedAt };
  } catch {
    return null;
  }
}

function fallbackConfig(): RuntimeSupabaseConfig | null {
  const url = readEnv('VITE_SUPABASE_URL') || readEnv('SUPABASE_URL');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY') || readEnv('SUPABASE_ANON_KEY');
  return validConfig({ url, anonKey }) ? { url, anonKey } : null;
}

export function getRuntimeSupabaseConfig(): RuntimeSupabaseConfig | null {
  const shared = runtimeConfig || readCachedSharedConfig();
  if (shared) {
    runtimeConfig = shared;
    return { url: shared.url, anonKey: shared.anonKey };
  }
  return fallbackConfig();
}

export function getSharedRuntimeConfig(): SharedRuntimeConfig | null {
  const cached = runtimeConfig || readCachedSharedConfig();
  if (cached) runtimeConfig = cached;
  return cached;
}

export async function loadSharedRuntimeConfig(): Promise<SharedRuntimeConfig | null> {
  const bootstrap = fallbackConfig();
  if (!bootstrap || typeof fetch === 'undefined') return getSharedRuntimeConfig();
  try {
    const response = await fetch(`${bootstrap.url.replace(/\/$/, '')}/functions/v1/runtime-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: bootstrap.anonKey },
      body: JSON.stringify({ action: 'get' }),
    });
    if (!response.ok) return getSharedRuntimeConfig();
    const payload = await response.json() as { config?: { supabaseUrl?: string; publishableKey?: string; geminiConfigured?: boolean; updatedAt?: string } };
    const source = payload.config;
    if (!source || !validConfig({ url: source.supabaseUrl, anonKey: source.publishableKey }) || typeof source.geminiConfigured !== 'boolean' || !source.updatedAt) return getSharedRuntimeConfig();
    const config: SharedRuntimeConfig = {
      url: source.supabaseUrl.trim(),
      anonKey: source.publishableKey.trim(),
      geminiConfigured: source.geminiConfigured,
      updatedAt: source.updatedAt,
    };
    cacheSharedConfig(config);
    return config;
  } catch {
    return getSharedRuntimeConfig();
  }
}

export async function updateSharedRuntimeConfig(update: SharedRuntimeUpdate): Promise<SharedRuntimeConfig> {
  const current = getRuntimeSupabaseConfig();
  if (!current) throw new Error('La configuration Supabase de démarrage est indisponible.');
  const response = await fetch(`${current.url.replace(/\/$/, '')}/functions/v1/runtime-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: current.anonKey },
    body: JSON.stringify({
      action: 'update',
      actor: update.actor,
      supabaseUrl: update.url.trim(),
      publishableKey: update.anonKey.trim(),
      geminiApiKey: update.geminiApiKey?.trim() || undefined,
    }),
  });
  const payload = await response.json() as { config?: { supabaseUrl?: string; publishableKey?: string; geminiConfigured?: boolean; updatedAt?: string }; error?: string };
  if (!response.ok || !payload.config) throw new Error(payload.error || 'La configuration partagée n’a pas pu être mise à jour.');
  const source = payload.config;
  if (!validConfig({ url: source.supabaseUrl, anonKey: source.publishableKey }) || typeof source.geminiConfigured !== 'boolean' || !source.updatedAt) throw new Error('Réponse de configuration invalide.');
  const config: SharedRuntimeConfig = {
    url: source.supabaseUrl.trim(),
    anonKey: source.publishableKey.trim(),
    geminiConfigured: source.geminiConfigured,
    updatedAt: source.updatedAt,
  };
  cacheSharedConfig(config);
  return config;
}

export function clearRuntimeConfigurationCache(): void {
  runtimeConfig = null;
  if (typeof window !== 'undefined') localStorage.removeItem(SHARED_RUNTIME_CACHE_KEY);
}
