import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Campaign, User } from '../types';
import { getSupabaseConfig } from './supabase';
import { getMerchantEvidencePublicUrl, uploadMerchantEvidence } from './merchantCampaign';

export const MPESA_MIKILI_CAMPAIGN_CODE = 'mpesa-mikili';
export const MPESA_MIKILI_REGIONS = ['Kinshasa', 'Kongo-Central', 'Haut-Katanga'] as const;

export type MikiliRegion = typeof MPESA_MIKILI_REGIONS[number];
export type MikiliExistingUser = 'yes' | 'no' | 'unknown';
export type MikiliPresentedService = 'send' | 'receive' | 'both';
export type MikiliTransactionType = 'send' | 'receive' | 'both' | 'na';

export interface MikiliLocation {
  id: string;
  campaign_id: string;
  region: MikiliRegion;
  name: string;
  is_active: boolean;
}

export interface MikiliAttendance {
  id: string;
  campaign_id: string;
  ba_id: string;
  activity_date: string;
  status: 'open' | 'closed' | 'alerted';
  checkin_at?: string | null;
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  checkin_accuracy_m?: number | null;
  checkin_photo_path?: string | null;
  checkout_at?: string | null;
  checkout_latitude?: number | null;
  checkout_longitude?: number | null;
  checkout_accuracy_m?: number | null;
  closing_comment?: string | null;
}

export interface MikiliClient {
  id: string;
  campaign_id: string;
  attendance_id?: string | null;
  agent_id: string;
  activity_date: string;
  location_id: string;
  client_name: string;
  client_phone: string;
  existing_mikili_user: MikiliExistingUser;
  presented_service: MikiliPresentedService;
  transaction_done: boolean;
  transaction_type: MikiliTransactionType;
  transaction_reference?: string | null;
  created_at: string;
  updated_at: string;
  location?: MikiliLocation;
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

function fail(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context} : ${error.message}`);
}

function kinshasaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const values = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const mikiliTodayIso = kinshasaDate;

export async function getMikiliCampaign(): Promise<Campaign | null> {
  const db = getClient();
  const { data, error } = await db.from('campaigns').select('*').eq('code', MPESA_MIKILI_CAMPAIGN_CODE).maybeSingle();
  fail(error, 'Impossible de charger la campagne M-Pesa Mikili');
  return data as Campaign | null;
}

export async function getMikiliLocations(campaignId: string): Promise<MikiliLocation[]> {
  const db = getClient();
  const { data, error } = await db.from('campaign_locations').select('*').eq('campaign_id', campaignId).eq('is_active', true).order('region').order('name');
  fail(error, 'Impossible de charger les lieux M-Pesa Mikili');
  return (data || []) as MikiliLocation[];
}

export async function getMikiliAttendance(baId: string, campaignId: string, date = kinshasaDate()): Promise<MikiliAttendance | null> {
  const db = getClient();
  const { data, error } = await db.from('mpesa_mikili_daily_attendance').select('*').eq('ba_id', baId).eq('campaign_id', campaignId).eq('activity_date', date).maybeSingle();
  fail(error, 'Impossible de charger le pointage M-Pesa Mikili');
  return data as MikiliAttendance | null;
}

export async function recordMikiliCheckin(input: {
  campaignId: string;
  baId: string;
  activityDate: string;
  checkinAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photoPath: string;
}): Promise<MikiliAttendance> {
  const db = getClient();
  const { data, error } = await db.from('mpesa_mikili_daily_attendance').upsert({
    campaign_id: input.campaignId,
    ba_id: input.baId,
    activity_date: input.activityDate,
    status: 'open',
    checkin_at: input.checkinAt,
    checkin_latitude: input.latitude,
    checkin_longitude: input.longitude,
    checkin_accuracy_m: input.accuracy,
    checkin_photo_path: input.photoPath,
  }, { onConflict: 'campaign_id,ba_id,activity_date' }).select('*').single();
  fail(error, 'Impossible d’enregistrer le pointage M-Pesa Mikili');
  return data as MikiliAttendance;
}

export async function closeMikiliAttendance(input: {
  attendanceId: string;
  checkoutAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  comment: string;
}): Promise<MikiliAttendance> {
  if (!input.comment.trim()) throw new Error('Le commentaire de clôture est obligatoire.');
  const db = getClient();
  const { data, error } = await db.from('mpesa_mikili_daily_attendance').update({
    status: 'closed', checkout_at: input.checkoutAt, checkout_latitude: input.latitude,
    checkout_longitude: input.longitude, checkout_accuracy_m: input.accuracy, closing_comment: input.comment.trim(),
  }).eq('id', input.attendanceId).select('*').single();
  fail(error, 'Impossible de clôturer la journée M-Pesa Mikili');
  return data as MikiliAttendance;
}

export async function getMikiliClientsForDay(agentId: string, campaignId: string, date = kinshasaDate()): Promise<MikiliClient[]> {
  const db = getClient();
  const { data, error } = await db.from('mpesa_mikili_clients').select('*, location:campaign_locations(*)')
    .eq('agent_id', agentId).eq('campaign_id', campaignId).eq('activity_date', date).order('created_at', { ascending: false });
  fail(error, 'Impossible de charger vos clients M-Pesa Mikili');
  return (data || []) as MikiliClient[];
}

export async function getMikiliClientHistory(agentId: string, campaignId: string): Promise<MikiliClient[]> {
  const db = getClient();
  const { data, error } = await db.from('mpesa_mikili_clients').select('*, location:campaign_locations(*)')
    .eq('agent_id', agentId).eq('campaign_id', campaignId).order('activity_date', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  fail(error, 'Impossible de charger l’historique M-Pesa Mikili');
  return (data || []) as MikiliClient[];
}

export async function addMikiliClient(input: Omit<MikiliClient, 'id' | 'created_at' | 'updated_at' | 'location'>): Promise<MikiliClient> {
  const db = getClient();
  const { data, error } = await db.from('mpesa_mikili_clients').insert({
    campaign_id: input.campaign_id,
    attendance_id: input.attendance_id || null,
    agent_id: input.agent_id,
    activity_date: input.activity_date,
    location_id: input.location_id,
    client_name: input.client_name.trim(),
    client_phone: input.client_phone.trim(),
    existing_mikili_user: input.existing_mikili_user,
    presented_service: input.presented_service,
    transaction_done: input.transaction_done,
    transaction_type: input.transaction_done ? input.transaction_type : 'na',
    transaction_reference: input.transaction_done ? input.transaction_reference?.trim() || null : null,
  }).select('*, location:campaign_locations(*)').single();
  fail(error, 'Impossible d’enregistrer le client M-Pesa Mikili');
  return data as MikiliClient;
}

export async function uploadMikiliEvidence(relativePath: string, file: Blob): Promise<string> {
  return uploadMerchantEvidence(MPESA_MIKILI_CAMPAIGN_CODE, relativePath, file);
}

export async function getMikiliEvidenceUrl(path?: string | null): Promise<string> {
  return getMerchantEvidencePublicUrl(path);
}

export function normalizeMikiliPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('243')) return `+${digits}`;
  if (digits.startsWith('0')) return `+243${digits.slice(1)}`;
  return value.trim();
}

export function mikiliDisplayExisting(value: MikiliExistingUser): string {
  return value === 'yes' ? 'Oui' : value === 'no' ? 'Non' : 'Ne connaît pas le service';
}

export function mikiliDisplayService(value: MikiliPresentedService): string {
  return value === 'send' ? 'Envoi vers l’étranger' : value === 'receive' ? 'Réception depuis l’étranger' : 'Envoi + réception';
}

export function mikiliDisplayTransaction(value: MikiliTransactionType): string {
  return value === 'send' ? 'Envoi vers l’étranger' : value === 'receive' ? 'Réception depuis l’étranger' : value === 'both' ? 'Envoi + réception' : 'NA';
}


export interface MikiliPodiumEntry {
  userId: string;
  name: string;
  phone: string;
  clients: number;
  transactions: number;
}

export interface MikiliTeamMember {
  userId: string;
  name: string;
  phone: string;
  supervisorId: string | null;
  clients: number;
  transactions: number;
  attendance: MikiliAttendance | null;
  locations: string[];
}

export async function getMikiliPodium(campaignId: string, activityDate = kinshasaDate(), limit = 10): Promise<MikiliPodiumEntry[]> {
  const db = getClient();
  const [assignmentsResponse, usersResponse, clientsResponse] = await Promise.all([
    db.from('user_campaign_assignments').select('user_id').eq('campaign_id', campaignId).eq('is_active', true),
    db.from('users').select('id,full_name,phone,role,user_category').eq('role', 'agent').eq('user_category', 'brand_ambassador'),
    db.from('mpesa_mikili_clients').select('agent_id,transaction_done').eq('campaign_id', campaignId).eq('activity_date', activityDate),
  ]);
  fail(assignmentsResponse.error, 'Impossible de charger le podium M-Pesa Mikili');
  fail(usersResponse.error, 'Impossible de charger les BA M-Pesa Mikili');
  fail(clientsResponse.error, 'Impossible de charger les performances M-Pesa Mikili');

  const assignedIds = new Set((assignmentsResponse.data || []).map((row: { user_id: string }) => row.user_id));
  const stats = new Map<string, { clients: number; transactions: number }>();
  ((clientsResponse.data || []) as Array<{ agent_id: string; transaction_done: boolean }>).forEach((row) => {
    const current = stats.get(row.agent_id) || { clients: 0, transactions: 0 };
    current.clients += 1;
    if (row.transaction_done) current.transactions += 1;
    stats.set(row.agent_id, current);
  });

  return ((usersResponse.data || []) as Array<{ id: string; full_name?: string | null; phone?: string | null }>)
    .filter((user) => assignedIds.has(user.id))
    .map((user) => ({
      userId: user.id,
      name: user.full_name || 'Brand Ambassador',
      phone: user.phone || '',
      clients: stats.get(user.id)?.clients || 0,
      transactions: stats.get(user.id)?.transactions || 0,
    }))
    .sort((a, b) => b.transactions - a.transactions || b.clients - a.clients || a.name.localeCompare(b.name, 'fr'))
    .slice(0, Math.max(1, limit));
}

export async function getMikiliTeam(
  campaignId: string,
  activityDate = kinshasaDate(),
  options: { supervisorId?: string | null; regions?: MikiliRegion[] } = {},
): Promise<MikiliTeamMember[]> {
  const db = getClient();
  const [assignmentsResponse, usersResponse, attendanceResponse, clientsResponse] = await Promise.all([
    db.from('user_campaign_assignments').select('user_id').eq('campaign_id', campaignId).eq('is_active', true),
    db.from('users').select('id,full_name,phone,role,user_category,supervisor_id').eq('role', 'agent').eq('user_category', 'brand_ambassador'),
    db.from('mpesa_mikili_daily_attendance').select('*').eq('campaign_id', campaignId).eq('activity_date', activityDate),
    db.from('mpesa_mikili_clients').select('agent_id,transaction_done,location_id,location:campaign_locations(region,name)').eq('campaign_id', campaignId).eq('activity_date', activityDate),
  ]);
  fail(assignmentsResponse.error, 'Impossible de charger les affectations M-Pesa Mikili');
  fail(usersResponse.error, 'Impossible de charger les BA M-Pesa Mikili');
  fail(attendanceResponse.error, 'Impossible de charger les pointages M-Pesa Mikili');
  fail(clientsResponse.error, 'Impossible de charger les clients M-Pesa Mikili');

  const assignedIds = new Set((assignmentsResponse.data || []).map((row: { user_id: string }) => row.user_id));
  const attendanceByBa = new Map(((attendanceResponse.data || []) as MikiliAttendance[]).map((row) => [row.ba_id, row]));
  const stats = new Map<string, { clients: number; transactions: number; locations: Set<string> }>();
  ((clientsResponse.data || []) as Array<{ agent_id: string; transaction_done: boolean; location?: { region?: string | null; name?: string | null } | Array<{ region?: string | null; name?: string | null }> | null }>).forEach((row) => {
    const current = stats.get(row.agent_id) || { clients: 0, transactions: 0, locations: new Set<string>() };
    current.clients += 1;
    if (row.transaction_done) current.transactions += 1;
    const location = Array.isArray(row.location) ? row.location[0] : row.location;
    if (location?.region) current.locations.add(location.region);
    if (location?.name) current.locations.add(location.name);
    stats.set(row.agent_id, current);
  });

  const allowedRegions = new Set(options.regions || []);
  return ((usersResponse.data || []) as Array<{ id: string; full_name?: string | null; phone?: string | null; supervisor_id?: string | null }>)
    .filter((user) => {
      if (!assignedIds.has(user.id)) return false;
      if (!options.supervisorId) return true;
      if (user.supervisor_id === options.supervisorId) return true;
      if (allowedRegions.size === 0) return false;
      const userRegions = stats.get(user.id)?.locations || new Set<string>();
      return Array.from(allowedRegions).some((region) => userRegions.has(region));
    })
    .map((user) => {
      const row = stats.get(user.id);
      return {
        userId: user.id,
        name: user.full_name || 'Brand Ambassador',
        phone: user.phone || '',
        supervisorId: user.supervisor_id || null,
        clients: row?.clients || 0,
        transactions: row?.transactions || 0,
        attendance: attendanceByBa.get(user.id) || null,
        locations: Array.from(row?.locations || []),
      };
    })
    .sort((a, b) => b.transactions - a.transactions || b.clients - a.clients || a.name.localeCompare(b.name, 'fr'));
}


export async function getMikiliCampaignClients(
  campaignId: string,
  startDate?: string,
  endDate?: string,
): Promise<MikiliClient[]> {
  const db = getClient();
  let query = db.from('mpesa_mikili_clients').select('*, location:campaign_locations(*)').eq('campaign_id', campaignId).order('activity_date', { ascending: false }).order('created_at', { ascending: false });
  if (startDate) query = query.gte('activity_date', startDate);
  if (endDate) query = query.lte('activity_date', endDate);
  const { data, error } = await query.limit(1000);
  fail(error, 'Impossible de charger les archives M-Pesa Mikili');
  return (data || []) as MikiliClient[];
}


export async function getMikiliSupervisorRegions(campaignId: string, supervisorId: string): Promise<MikiliRegion[]> {
  const db = getClient();
  const { data, error } = await db.from('campaign_supervisor_regions').select('region').eq('campaign_id', campaignId).eq('supervisor_id', supervisorId).eq('is_active', true);
  fail(error, 'Impossible de charger le périmètre régional M-Pesa Mikili');
  const configured = Array.from(new Set(((data || []) as Array<{ region: string }>).map((row) => row.region).filter((region): region is MikiliRegion => (MPESA_MIKILI_REGIONS as readonly string[]).includes(region))));
  if (configured.length) return configured;

  // Fallback métier tant que les lignes campaign_supervisor_regions ne sont pas encore renseignées.
  const { data: supervisor, error: supervisorError } = await db.from('users').select('full_name').eq('id', supervisorId).maybeSingle();
  fail(supervisorError, 'Impossible de déterminer le superviseur M-Pesa Mikili');
  const name = String(supervisor?.full_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (name.includes('herve')) return ['Kinshasa'];
  if (name.includes('serge')) return ['Kongo-Central', 'Haut-Katanga'];
  return [];
}
