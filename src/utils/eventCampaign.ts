import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Campaign, User } from '../types';
import { getSupabaseConfig } from './supabase';
import { getMerchantEvidencePublicUrl, uploadMerchantEvidence } from './merchantCampaign';

export const SUPPLIER_FORUM_CODE = 'vodacom-supplier-forum-sept-2026';
export const SUPPLIER_FORUM_DATE = '2026-09-25';
export const SUPPLIER_FORUM_ARRIVAL_DEADLINE = '09:00';
export const SUPPLIER_FORUM_DEPARTURE_TIME = '15:00';

export interface EventAttendance {
  id: string;
  event_id: string;
  agent_id: string;
  activity_date: string;
  status: 'open' | 'closed';
  checkin_at?: string | null;
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  checkin_accuracy_m?: number | null;
  checkin_photo_path?: string | null;
  checkout_at?: string | null;
  checkout_latitude?: number | null;
  checkout_longitude?: number | null;
  checkout_accuracy_m?: number | null;
  checkout_photo_path?: string | null;
}

let client: SupabaseClient | null = null;
let clientKey = '';
function getClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error('La configuration Supabase est indisponible.');
  const key = `${config.url}|${config.anonKey}`;
  if (client && clientKey === key) return client;
  client = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  clientKey = key;
  return client;
}
function fail(error: { message: string } | null, context: string): void { if (error) throw new Error(`${context} : ${error.message}`); }
export function supplierForumDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export async function getSupplierForumCampaign(): Promise<Campaign | null> {
  const { data, error } = await getClient().from('campaigns').select('*').eq('code', SUPPLIER_FORUM_CODE).maybeSingle();
  fail(error, 'Impossible de charger l’Event Supplier Forum');
  return data as Campaign | null;
}
export async function getEventAttendance(eventId: string, agentId: string, date = SUPPLIER_FORUM_DATE): Promise<EventAttendance | null> {
  const { data, error } = await getClient().from('event_attendance').select('*').eq('event_id', eventId).eq('agent_id', agentId).eq('activity_date', date).maybeSingle();
  fail(error, 'Impossible de charger le pointage de l’Event');
  return data as EventAttendance | null;
}
export async function getEventTeam(eventId: string, date = SUPPLIER_FORUM_DATE): Promise<Array<{ user: User; attendance: EventAttendance | null }>> {
  const db = getClient();
  const [assignments, users, attendance] = await Promise.all([
    db.from('user_campaign_assignments').select('user_id').eq('campaign_id', eventId).eq('is_active', true),
    db.from('users').select('*').eq('role', 'agent').eq('user_category', 'hostess'),
    db.from('event_attendance').select('*').eq('event_id', eventId).eq('activity_date', date),
  ]);
  fail(assignments.error, 'Impossible de charger les affectations de l’Event');
  fail(users.error, 'Impossible de charger les hôtesses de l’Event');
  fail(attendance.error, 'Impossible de charger les pointages de l’Event');
  const ids = new Set((assignments.data || []).map((row: { user_id: string }) => row.user_id));
  const attendanceByAgent = new Map((attendance.data || []).map((row: EventAttendance) => [row.agent_id, row]));
  return (users.data || []).filter((row: User) => ids.has(row.id)).map((row: User) => ({ user: row, attendance: attendanceByAgent.get(row.id) || null })).sort((a, b) => (a.user.full_name || a.user.name).localeCompare(b.user.full_name || b.user.name, 'fr'));
}
export async function saveEventArrival(input: { eventId: string; agentId: string; date: string; at: string; latitude: number | null; longitude: number | null; accuracy: number | null; photo: Blob }): Promise<EventAttendance> {
  const photoPath = await uploadMerchantEvidence(input.eventId, `${input.agentId}/${input.date}/arrival-${Date.now()}.jpg`, input.photo);
  const payload = { event_id: input.eventId, agent_id: input.agentId, activity_date: input.date, status: 'open', checkin_at: input.at, checkin_latitude: input.latitude, checkin_longitude: input.longitude, checkin_accuracy_m: input.accuracy, checkin_photo_path: photoPath };
  const { data, error } = await getClient().from('event_attendance').upsert(payload, { onConflict: 'event_id,agent_id,activity_date' }).select('*').single();
  fail(error, 'Impossible d’enregistrer le pointage d’arrivée');
  return data as EventAttendance;
}
export async function saveEventDeparture(input: { attendanceId: string; at: string; latitude: number | null; longitude: number | null; accuracy: number | null; photo: Blob }): Promise<EventAttendance> {
  const photoPath = await uploadMerchantEvidence('event', `departure/${input.attendanceId}-${Date.now()}.jpg`, input.photo);
  const { data, error } = await getClient().from('event_attendance').update({ status: 'closed', checkout_at: input.at, checkout_latitude: input.latitude, checkout_longitude: input.longitude, checkout_accuracy_m: input.accuracy, checkout_photo_path: photoPath }).eq('id', input.attendanceId).select('*').single();
  fail(error, 'Impossible d’enregistrer le pointage de départ');
  return data as EventAttendance;
}
export async function getEventPhotoUrl(path?: string | null): Promise<string> { return getMerchantEvidencePublicUrl(path); }
export async function assignSupplierForumAgents(eventId: string, agentIds: string[], assignedBy: string): Promise<void> {
  const payload = agentIds.map((user_id) => ({ user_id, campaign_id: eventId, is_active: true, assigned_by: assignedBy }));
  if (!payload.length) return;
  const { error } = await getClient().from('user_campaign_assignments').upsert(payload, { onConflict: 'user_id,campaign_id' });
  fail(error, 'Impossible d’affecter les hôtesses à l’Event');
}
export async function getEventAssignedUsers(eventId: string): Promise<string[]> {
  const { data, error } = await getClient().from('user_campaign_assignments').select('user_id').eq('campaign_id', eventId).eq('is_active', true);
  fail(error, 'Impossible de charger les affectations de l’Event');
  return (data || []).map((row: { user_id: string }) => row.user_id);
}
