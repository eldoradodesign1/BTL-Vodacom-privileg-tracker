import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Campaign, User, YouthContactReport, YouthDailyAssignment, YouthDailyAttendance, YouthRegion, YouthSubscriberType, YouthUniversity } from '../types';
import { getSupabaseConfig } from './supabase';
import { getMerchantEvidencePublicUrl, uploadMerchantEvidence } from './merchantCampaign';

export const YOUTH_F2F_CAMPAIGN_CODE = 'youth-f2f';

let youthClient: SupabaseClient | null = null;
let youthClientKey = '';

function getYouthClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error('La configuration Supabase est indisponible.');
  const nextKey = `${config.url}|${config.anonKey}`;
  if (youthClient && youthClientKey === nextKey) return youthClient;
  youthClient = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  youthClientKey = nextKey;
  return youthClient;
}

function fail(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context} : ${error.message}`);
}

function kinshasaParts(now = new Date()): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

export function youthTodayIso(now = new Date()): string {
  const parts = kinshasaParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function getYouthCampaign(): Promise<Campaign | null> {
  const client = getYouthClient();
  const { data, error } = await client.from('campaigns').select('*').eq('code', YOUTH_F2F_CAMPAIGN_CODE).maybeSingle();
  fail(error, 'Impossible de charger la campagne Youth F2F');
  return data as Campaign | null;
}

export async function getYouthUniversities(campaignId: string): Promise<YouthUniversity[]> {
  const client = getYouthClient();
  const { data, error } = await client
    .from('youth_universities')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)
    .order('name');
  fail(error, 'Impossible de charger les universités');
  return (data || []) as YouthUniversity[];
}

export async function getYouthAssignment(baId: string, campaignId: string, activityDate: string): Promise<YouthDailyAssignment | null> {
  const client = getYouthClient();
  const { data, error } = await client
    .from('youth_daily_assignments')
    .select('*, university:youth_universities(*)')
    .eq('ba_id', baId)
    .eq('campaign_id', campaignId)
    .eq('activity_date', activityDate)
    .maybeSingle();
  fail(error, 'Impossible de charger votre université du jour');
  return data as YouthDailyAssignment | null;
}

export async function saveYouthAssignment(input: {
  campaignId: string;
  baId: string;
  universityId: string;
  activityDate: string;
  assignedBy?: string;
  notes?: string;
}): Promise<YouthDailyAssignment> {
  const client = getYouthClient();
  const { data, error } = await client
    .from('youth_daily_assignments')
    .upsert({
      campaign_id: input.campaignId,
      ba_id: input.baId,
      university_id: input.universityId,
      activity_date: input.activityDate,
      status: 'in_progress',
      assigned_by: input.assignedBy || null,
      notes: input.notes?.trim() || null,
    }, { onConflict: 'campaign_id,ba_id,activity_date' })
    .select('*, university:youth_universities(*)')
    .single();
  fail(error, 'Impossible d’enregistrer l’université du jour');
  return data as YouthDailyAssignment;
}

export async function getYouthAttendance(baId: string, campaignId: string, activityDate: string): Promise<YouthDailyAttendance | null> {
  const client = getYouthClient();
  const { data, error } = await client
    .from('youth_daily_attendance')
    .select('*')
    .eq('ba_id', baId)
    .eq('campaign_id', campaignId)
    .eq('activity_date', activityDate)
    .maybeSingle();
  fail(error, 'Impossible de charger le pointage Youth F2F');
  return data as YouthDailyAttendance | null;
}

export async function recordYouthCheckin(input: {
  campaignId: string;
  assignmentId?: string | null;
  baId: string;
  activityDate: string;
  checkinAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photoPath: string;
}): Promise<YouthDailyAttendance> {
  const client = getYouthClient();
  const { data, error } = await client
    .from('youth_daily_attendance')
    .upsert({
      campaign_id: input.campaignId,
      daily_assignment_id: input.assignmentId || null,
      ba_id: input.baId,
      activity_date: input.activityDate,
      status: 'open',
      checkin_at: input.checkinAt,
      checkin_latitude: input.latitude,
      checkin_longitude: input.longitude,
      checkin_accuracy_m: input.accuracy,
      checkin_photo_path: input.photoPath,
    }, { onConflict: 'campaign_id,ba_id,activity_date' })
    .select('*')
    .single();
  fail(error, 'Impossible d’enregistrer le pointage Youth F2F');
  return data as YouthDailyAttendance;
}

export async function closeYouthAttendance(input: {
  attendanceId: string;
  checkoutAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  comment: string;
}): Promise<YouthDailyAttendance> {
  if (!input.comment.trim()) throw new Error('Le commentaire de clôture est obligatoire.');
  const client = getYouthClient();
  const { data, error } = await client
    .from('youth_daily_attendance')
    .update({
      status: 'closed',
      checkout_at: input.checkoutAt,
      checkout_latitude: input.latitude,
      checkout_longitude: input.longitude,
      checkout_accuracy_m: input.accuracy,
      closing_comment: input.comment.trim(),
    })
    .eq('id', input.attendanceId)
    .select('*')
    .single();
  fail(error, 'Impossible de clôturer la journée Youth F2F');
  return data as YouthDailyAttendance;
}

export async function getYouthAttendanceHistory(baId: string, campaignId: string): Promise<YouthDailyAttendance[]> {
  const client = getYouthClient();
  const { data, error } = await client
    .from('youth_daily_attendance')
    .select('*')
    .eq('ba_id', baId)
    .eq('campaign_id', campaignId)
    .order('activity_date', { ascending: false })
    .limit(30);
  fail(error, 'Impossible de charger les archives Youth F2F');
  return (data || []) as YouthDailyAttendance[];
}

export async function getYouthContacts(baId: string, campaignId: string, activityDate?: string): Promise<YouthContactReport[]> {
  const client = getYouthClient();
  let query = client.from('youth_contact_reports').select('*').eq('ba_id', baId).eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(500);
  if (activityDate) query = query.eq('activity_date', activityDate);
  const { data, error } = await query;
  if (error?.code === 'PGRST205') return [];
  fail(error, 'Impossible de charger les contacts Youth F2F');
  return (data || []) as YouthContactReport[];
}

export async function addYouthContact(input: {
  campaignId: string;
  attendanceId?: string | null;
  baId: string;
  activityDate: string;
  region: YouthRegion;
  subscriberType: YouthSubscriberType;
  subscriberPhone: string;
  subscriberName: string;
  actions: string[];
}): Promise<YouthContactReport> {
  const client = getYouthClient();
  const { data, error } = await client.from('youth_contact_reports').insert({
    campaign_id: input.campaignId,
    attendance_id: input.attendanceId || null,
    ba_id: input.baId,
    activity_date: input.activityDate,
    region: input.region,
    subscriber_type: input.subscriberType,
    subscriber_phone: input.subscriberPhone,
    subscriber_name: input.subscriberName.trim(),
    actions: input.actions,
  }).select('*').single();
  fail(error, 'Impossible d’enregistrer le contact Youth F2F');
  return data as YouthContactReport;
}

export async function getYouthAgents(supervisorId?: string): Promise<User[]> {
  const client = getYouthClient();
  const campaign = await getYouthCampaign();
  if (!campaign) return [];
  const { data: assignmentRows, error: assignmentError } = await client
    .from('user_campaign_assignments')
    .select('user_id')
    .eq('campaign_id', campaign.id)
    .eq('is_active', true)
    .limit(1000);
  fail(assignmentError, 'Impossible de charger les affectations Youth F2F');
  const agentIds = Array.from(new Set((assignmentRows || []).map((row) => row.user_id).filter(Boolean)));
  if (agentIds.length === 0) return [];
  let request = client
    .from('users')
    .select('id,phone,full_name,role,password_hash,supervisor_id,permanent_shop_id,user_category,created_at,last_login')
    .in('id', agentIds)
    .eq('user_category', 'brand_ambassador')
    .eq('role', 'agent')
    .order('full_name');
  if (supervisorId) request = request.eq('supervisor_id', supervisorId);
  const { data, error } = await request;
  fail(error, 'Impossible de charger les agents Youth F2F');
  return (data || []).map((row: any) => ({
    id: row.id,
    phone: row.phone,
    name: row.full_name,
    role: row.role,
    password: row.password_hash,
    supervisorId: row.supervisor_id,
    permanentShopId: row.permanent_shop_id,
    userCategory: row.user_category,
    created_at: row.created_at,
    last_login: row.last_login,
  })) as User[];
}

export async function uploadYouthEvidence(relativePath: string, file: Blob): Promise<string> {
  return uploadMerchantEvidence(YOUTH_F2F_CAMPAIGN_CODE, relativePath, file);
}

export async function getYouthEvidenceUrl(path?: string | null): Promise<string> {
  return getMerchantEvidencePublicUrl(path);
}
