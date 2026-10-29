import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Campaign, User } from '../types';
import { getSupabaseConfig } from './supabase';
import type { WewaAttendance, WewaReport, WewaRider, WewaSettings, WewaStation } from './wewaModel';

export interface WewaSnapshot {
  campaign: Campaign; settings: WewaSettings; stations: WewaStation[]; riders: WewaRider[];
  attendance: WewaAttendance[]; agents: Array<{ id: string; name: string }>;
  assignments: Array<{ ba_id: string; station_id: string; activity_date: string }>;
  report: WewaReport; paused: boolean;
}
let client: SupabaseClient | null = null;
const sessions = new Map<string, { token: string; expires: number; credential: string }>();
function db() {
  if (!client) { const c = getSupabaseConfig(); if (!c) throw new Error('Connexion à la base indisponible.'); client = createClient(c.url, c.anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); }
  return client;
}
async function tokenFor(user: User) {
  const cached = sessions.get(user.id);
  if (cached && cached.expires > Date.now() && cached.credential === user.password) return cached.token;
  const { data, error } = await db().rpc('wewa_open_session', { p_actor_id: user.id, p_password: user.password ?? '' });
  if (error) throw new Error(error.message);
  sessions.set(user.id, { token: data.token, expires: Date.parse(data.expires_at) - 60_000, credential: user.password ?? '' });
  return data.token as string;
}
export function clearWewaSessions() { sessions.clear(); }
export async function wewaCall<T = unknown>(user: User, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc('wewa_call', { p_token: await tokenFor(user), p_action: action, p_payload: payload });
  if (error) { if (error.message.includes('Session WEWA')) sessions.delete(user.id); throw new Error(error.message); }
  return data as T;
}
export const loadWewa = (user: User) => wewaCall<WewaSnapshot>(user, 'snapshot');
export function wewaLocation(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La géolocalisation est indisponible.'));
    navigator.geolocation.getCurrentPosition(p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }), () => reject(new Error('Autorise la localisation pour valider le pointage.')), { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  });
}
export async function wewaPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Photo illisible.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/jpeg', .62);
    if (data.length > 200_000) data = canvas.toDataURL('image/jpeg', .35);
    if (data.length > 200_000) throw new Error('La photo est trop volumineuse. Reprends une photo plus simple.');
    return data;
  } finally { bitmap.close(); }
}
