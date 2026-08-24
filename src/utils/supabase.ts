import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, Checkin, DailyReport, Lead, NotificationItem, Shop, User } from '../types';
import { getRuntimeSupabaseConfig } from './appConfig';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface MigrationSummary {
  users: number;
  shops: number;
  checkins: number;
  leads: number;
  reports: number;
  notifications: number;
  chatMessages: number;
}

const supabaseClientCache = new Map<string, SupabaseClient>();

function readEnv(name: string): string | undefined {
  const env = (typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env : undefined);
  const value = env ? env[name] : undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getSupabaseConfig(overrides?: Partial<SupabaseConfig>): SupabaseConfig | null {
  const runtimeConfig = getRuntimeSupabaseConfig();
  const url = overrides?.url || runtimeConfig?.url || readEnv('VITE_SUPABASE_URL') || readEnv('SUPABASE_URL');
  const anonKey = overrides?.anonKey || runtimeConfig?.anonKey || readEnv('VITE_SUPABASE_ANON_KEY') || readEnv('SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function isSupabaseConfigured(overrides?: Partial<SupabaseConfig>): boolean {
  return !!getSupabaseConfig(overrides);
}

export function getSupabaseClient(overrides?: Partial<SupabaseConfig>): SupabaseClient | null {
  const config = getSupabaseConfig(overrides);
  if (!config) return null;

  const cacheKey = `${config.url}|${config.anonKey}`;
  const cached = supabaseClientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  supabaseClientCache.set(cacheKey, client);
  return client;
}

function sanitizeRecord<T extends Record<string, unknown>>(record: T): T {
  const copy = { ...record } as Record<string, unknown>;
  Object.keys(copy).forEach((key) => {
    if (copy[key] === undefined) {
      delete copy[key];
    }
  });
  return copy as T;
}

async function upsertRows<T extends Record<string, unknown>>(client: SupabaseClient, table: string, rows: T[]): Promise<void> {
  if (!rows.length) return;
  const sanitized = rows.map((row) => sanitizeRecord(row)) as Record<string, unknown>[];
  const { error } = await client.from(table).upsert(sanitized, { onConflict: 'id' });
  if (error) {
    throw new Error(`Supabase upsert failed for ${table}: ${error.message}`);
  }
}

export async function syncLocalDataToSupabase(payload: {
  users?: User[];
  shops?: Shop[];
  checkins?: Checkin[];
  leads?: Lead[];
  reports?: DailyReport[];
  notifications?: NotificationItem[];
  chatMessages?: ChatMessage[];
}, overrides?: Partial<SupabaseConfig>): Promise<MigrationSummary> {
  const client = getSupabaseClient(overrides);
  if (!client) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
  }
  
  console.log(payload.reports);
  await upsertRows(client, 'users', (payload.users || []).map((item) => ({
    ...item,
    supervisor_id: item.supervisorId,
    permanent_shop_id: item.permanentShopId,
    user_category: item.userCategory,
    auth_user_id: item.authUserId
  })));

  await upsertRows(client, 'shops', (payload.shops || []).map((item) => ({
    ...item,
    lat: item.lat ?? null,
    long: item.long ?? null
  })));

  await upsertRows(client, 'checkins', (payload.checkins || []).map((item) => ({
    ...item,
    photo: item.photo || null,
    photo_drive_url: item.photo_drive_url || null,
    distance_m: item.distance_m ?? null,
    geo_status: item.geo_status || null,
    device: item.device || null
  })));

  await upsertRows(client, 'leads', (payload.leads || []).map((item) => ({
    ...item,
    amount: item.amount ?? null,
    bundle_type: item.bundle_type || null,
    status: item.status || 'pending'
  })));

  await upsertRows(client, 'daily_reports', (payload.reports || []).map((item) => ({
    ...item,
    pdf_url: item.pdf_url || null,
    photos: item.photos || [],
    arrival_time: item.arrival_time || null,
    departure_time: item.departure_time || null,
    pointage_photo: item.pointage_photo || null,
    maps_in: item.maps_in || null,
    maps_out: item.maps_out || null,
    drive_pdf_url: item.drive_pdf_url || null,
    report_photos_drive_urls: item.report_photos_drive_urls || []
  })));

  await upsertRows(client, 'notifications', (payload.notifications || []).map((item) => ({
    ...item,
    deleted: item.deleted ?? null
  })));

  await upsertRows(client, 'chat_messages', (payload.chatMessages || []).map((item) => ({
    ...item,
    deleted: item.deleted ?? false,
    deleted_at: item.deleted_at || null,
    deleted_by: item.deleted_by || null,
    read_by: item.read_by || []
  })));

  return {
    users: payload.users?.length || 0,
    shops: payload.shops?.length || 0,
    checkins: payload.checkins?.length || 0,
    leads: payload.leads?.length || 0,
    reports: payload.reports?.length || 0,
    notifications: payload.notifications?.length || 0,
    chatMessages: payload.chatMessages?.length || 0
  };
}

export async function migrateLocalDataToSupabase(overrides?: Partial<SupabaseConfig>): Promise<MigrationSummary> {
  const storageKeys = {
    users: 'vodacom_users_v6',
    shops: 'vodacom_shops_v6',
    checkins: 'vodacom_checkins_v6',
    leads: 'vodacom_leads_v6',
    reports: 'vodacom_reports_v6',
    notifications: 'vodacom_notifs_v6',
    chatMessages: 'vodacom_chat_v6'
  };

  const readJson = <T,>(key: string): T[] => {
    if (typeof window === 'undefined' || !window.localStorage) return [] as T[];
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [] as T[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as T[];
    }
  };

  return syncLocalDataToSupabase({
    users: readJson<User>(storageKeys.users),
    shops: readJson<Shop>(storageKeys.shops),
    checkins: readJson<Checkin>(storageKeys.checkins),
    leads: readJson<Lead>(storageKeys.leads),
    reports: readJson<DailyReport>(storageKeys.reports),
    notifications: readJson<NotificationItem>(storageKeys.notifications),
    chatMessages: readJson<ChatMessage>(storageKeys.chatMessages)
  }, overrides);
}

export async function uploadPhotoToSupabase(fileOrDataUrl: string, bucket: string, pathPrefix = 'checkins', overrides?: Partial<SupabaseConfig>): Promise<string> {
  const client = getSupabaseClient(overrides);
  if (!client) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
  }

  const mime = fileOrDataUrl.startsWith('data:') ? fileOrDataUrl.substring(5, fileOrDataUrl.indexOf(';')) : 'image/jpeg';
  const fileName = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  let blob: Blob;
  if (fileOrDataUrl.startsWith('data:')) {
    const [header, payload] = fileOrDataUrl.split(',');
    const binary = window.atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: mime || 'image/jpeg' });
  } else {
    const response = await fetch(fileOrDataUrl);
    blob = await response.blob();
  }

  const { error } = await client.storage.from(bucket).upload(fileName, blob, {
    contentType: mime || 'image/jpeg',
    upsert: true
  });

  if (error) {
    throw new Error(`Photo upload failed: ${error.message}`);
  }

  const { data: publicData } = client.storage.from(bucket).getPublicUrl(fileName);
  return publicData.publicUrl;
}

export async function fetchUsersFromSupabase(): Promise<User[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await client
    .from('users')
    .select('*');

  if (error) {
    throw error;
  }

  return (data || []).map((u: any) => ({
    id: u.id,
    phone: u.phone,
    name: u.full_name,
    role: u.role,
    password: u.password_hash,
    supervisorId: u.supervisor_id,
    permanentShopId: u.permanent_shop_id,
    userCategory: u.user_category || undefined,
    authUserId: u.auth_user_id || undefined,
    created_at: u.created_at,
    last_login: u.last_login
  })) as User[];
}

export async function fetchShopsFromSupabase(): Promise<Shop[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await client
    .from('shops')
    .select('*');

  if (error) {
    throw error;
  }

  return (data || []) as Shop[];
}

export async function fetchLeadsFromSupabase(): Promise<Lead[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await client
    .from('leads')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as Lead[];
}


export async function fetchCheckinsFromSupabase(): Promise<Checkin[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('checkins')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((item) => ({
    ...item
  })) as Checkin[];
}

export async function fetchReportsFromSupabase(): Promise<DailyReport[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await client
    .from('daily_reports')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    date: r.date,
    agent_id: r.agent_id,
    agent_name: r.agent_name,
    shop_id: r.shop_id,
    shop_name: r.shop_name,
    priv: r.priv,
    roam: r.roam,
    bund: r.bund,
    amount: r.amount,
    comment: r.comment,
    pdf_url: r.pdf_url,
    photos: r.photos || [],
    arrival_time: r.arrival_time,
    departure_time: r.departure_time,
    pointage_photo: r.pointage_photo,
    maps_in: r.maps_in,
    maps_out: r.maps_out,
    drive_pdf_url: r.drive_pdf_url,
    report_photos_drive_urls: r.report_photos_drive_urls || []
  })) as DailyReport[];
}