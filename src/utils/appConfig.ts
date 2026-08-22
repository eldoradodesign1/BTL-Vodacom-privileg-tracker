export interface RuntimeSupabaseConfig {
  url: string;
  anonKey: string;
}

const SUPABASE_RUNTIME_KEY = 'btl_runtime_supabase_config';
const GEMINI_API_KEY = 'btl_gemini_api_key';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function getRuntimeSupabaseConfig(): RuntimeSupabaseConfig | null {
  const config = readJson<Partial<RuntimeSupabaseConfig> | null>(SUPABASE_RUNTIME_KEY, null);
  if (!config?.url?.trim() || !config.anonKey?.trim()) return null;
  return { url: config.url.trim(), anonKey: config.anonKey.trim() };
}

export function saveRuntimeSupabaseConfig(config: RuntimeSupabaseConfig): void {
  window.localStorage.setItem(SUPABASE_RUNTIME_KEY, JSON.stringify({ url: config.url.trim(), anonKey: config.anonKey.trim() }));
  window.dispatchEvent(new Event('btl-runtime-config-updated'));
}

export function getGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(GEMINI_API_KEY)?.trim() || '';
}

export function saveGeminiApiKey(apiKey: string): void {
  window.localStorage.setItem(GEMINI_API_KEY, apiKey.trim());
  window.dispatchEvent(new Event('btl-runtime-config-updated'));
}

export function clearRuntimeConfiguration(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SUPABASE_RUNTIME_KEY);
  window.localStorage.removeItem(GEMINI_API_KEY);
}
