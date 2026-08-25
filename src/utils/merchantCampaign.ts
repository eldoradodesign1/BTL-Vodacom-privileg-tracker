import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BADailyAttendance,
  BAPosVisit,
  BATransaction,
  Campaign,
  CampaignRun,
  PointOfSale,
} from '../types';
import { getSupabaseConfig } from './supabase';

const MERCHANT_CACHE_PREFIX = 'btl_merchant_cache_v1:';
export const MERCHANT_CACHE_TTL_MS = 60 * 60 * 1000;
type MerchantCacheEntry<T> = { savedAt: number; value: T };
let merchantClient: SupabaseClient | null = null;
let merchantClientKey = '';

function readMerchantCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${MERCHANT_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as MerchantCacheEntry<T>;
    if (!entry || Date.now() - entry.savedAt >= MERCHANT_CACHE_TTL_MS) return null;
    return entry.value;
  } catch {
    return null;
  }
}

function writeMerchantCache<T>(key: string, value: T): T {
  if (typeof window === 'undefined') return value;
  try {
    window.localStorage.setItem(`${MERCHANT_CACHE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value } satisfies MerchantCacheEntry<T>));
  } catch {
    // Le cache est une optimisation facultative : la consultation réseau reste disponible.
  }
  return value;
}

async function withMerchantCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = readMerchantCache<T>(key);
  if (cached !== null) return cached;
  return writeMerchantCache(key, await loader());
}

export function invalidateMerchantCache(scope?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prefix = `${MERCHANT_CACHE_PREFIX}${scope || ''}`;
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Le cache ne doit jamais bloquer une opération terrain.
  }
}

export const MERCHANT_CAMPAIGN_CODE = 'merchant-educational-campaign';
export const MERCHANT_CAMPAIGN_START = '2026-08-24';
export const MERCHANT_TIME_ZONE = 'Africa/Kinshasa';

function merchantClockParts(now = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MERCHANT_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { date: `${byType.year}-${byType.month}-${byType.day}`, hour: Number(byType.hour || 0) };
}

export const merchantTodayIso = () => merchantClockParts().date;

export function isMerchantActivityExpired(activityDate: string, now = new Date()): boolean {
  const clock = merchantClockParts(now);
  return activityDate < clock.date || (activityDate === clock.date && clock.hour >= 20);
}

export function clampMerchantActivityDate(value?: string): string {
  const selected = value || merchantTodayIso();
  if (selected < MERCHANT_CAMPAIGN_START) return MERCHANT_CAMPAIGN_START;
  if (selected > merchantTodayIso()) return merchantTodayIso();
  return selected;
}

function getMerchantClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error('La configuration Supabase est indisponible.');
  const nextKey = `${config.url}|${config.anonKey}`;
  if (merchantClient && merchantClientKey === nextKey) return merchantClient;

  merchantClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  merchantClientKey = nextKey;
  return merchantClient;
}

function fail(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context} : ${error.message}`);
}

export async function getCampaigns(): Promise<Campaign[]> {
  const client = getMerchantClient();
  const { data, error } = await client
    .from('campaigns')
    .select('*')
    .in('status', ['draft', 'active'])
    .order('name');
  fail(error, 'Impossible de charger les campagnes');
  return (data || []) as Campaign[];
}

export async function assignUserToCampaigns(userId: string, campaignIds: string[]): Promise<void> {
  if (campaignIds.length === 0) return;
  const client = getMerchantClient();
  const payload = campaignIds.map((campaignId) => ({
    user_id: userId,
    campaign_id: campaignId,
    is_active: true,
  }));
  const { error } = await client
    .from('user_campaign_assignments')
    .upsert(payload, { onConflict: 'user_id,campaign_id' });
  fail(error, 'Impossible d’affecter les campagnes à l’utilisateur');
}

export async function getMerchantCampaign(): Promise<Campaign | null> {
  return withMerchantCache('campaign', async () => {
    const client = getMerchantClient();
    const { data, error } = await client
      .from('campaigns')
      .select('*')
      .eq('code', MERCHANT_CAMPAIGN_CODE)
      .maybeSingle();
    fail(error, 'Impossible de charger la campagne');
    return data as Campaign | null;
  });
}

export async function getCampaignsForUser(userId: string): Promise<Campaign[]> {
  const client = getMerchantClient();
  const { data, error } = await client
    .from('user_campaign_assignments')
    .select('campaign:campaigns(*)')
    .eq('user_id', userId)
    .eq('is_active', true);
  fail(error, 'Impossible de charger les campagnes de l’utilisateur');

  const campaigns = (data || [])
    .map((row: { campaign?: Campaign | Campaign[] | null }) => Array.isArray(row.campaign) ? row.campaign[0] : row.campaign)
    .filter((campaign): campaign is Campaign => Boolean(campaign));
  return campaigns;
}

export async function getActiveCampaignRuns(campaignId: string): Promise<CampaignRun[]> {
  return withMerchantCache(`runs:${campaignId}`, async () => {
    const client = getMerchantClient();
    const { data, error } = await client
      .from('campaign_runs')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['draft', 'active'])
      .order('starts_on', { ascending: false });
    fail(error, 'Impossible de charger les vagues de campagne');
    return (data || []) as CampaignRun[];
  });
}

export async function getDailyAttendance(baId: string, runId: string, activityDate: string): Promise<BADailyAttendance | null> {
  return withMerchantCache(`attendance:${runId}:${baId}:${activityDate}`, async () => {
    const client = getMerchantClient();
    const { data, error } = await client
      .from('ba_daily_attendance')
      .select('*')
      .eq('ba_id', baId)
      .eq('campaign_run_id', runId)
      .eq('activity_date', activityDate)
      .maybeSingle();
    fail(error, 'Impossible de charger le pointage');
    return data as BADailyAttendance | null;
  });
}

export async function getTransactionsForDay(baId: string, runId: string, activityDate: string): Promise<BATransaction[]> {
  return withMerchantCache(`transactions:${runId}:${baId}:${activityDate}`, async () => {
    const client = getMerchantClient();
    const start = `${activityDate}T00:00:00+01:00`;
    const end = `${activityDate}T23:59:59.999+01:00`;
    const { data, error } = await client
      .from('ba_transactions')
      .select('*, point_of_sale:points_of_sale(agent_number,denomination,pool)')
      .eq('ba_id', baId)
      .eq('campaign_run_id', runId)
      .gte('occurred_at', start)
      .lte('occurred_at', end)
      .order('occurred_at', { ascending: false });
    fail(error, 'Impossible de charger les transactions');
    return (data || []) as BATransaction[];
  });
}

export async function getPosVisitsForDay(baId: string, runId: string, activityDate: string): Promise<BAPosVisit[]> {
  return withMerchantCache(`visits:${runId}:${baId}:${activityDate}`, async () => {
    const client = getMerchantClient();
    const [visitsResponse, transactions] = await Promise.all([
      client
        .from('ba_pos_visits')
        .select('*, point_of_sale:points_of_sale(*)')
        .eq('ba_id', baId)
        .eq('campaign_run_id', runId)
        .eq('activity_date', activityDate)
        .order('visited_at', { ascending: false }),
      getTransactionsForDay(baId, runId, activityDate),
    ]);
    fail(visitsResponse.error, 'Impossible de charger les POS visités');
    return ((visitsResponse.data || []) as BAPosVisit[]).map((visit) => ({
      ...visit,
      transactions: transactions.filter((transaction) => transaction.pos_visit_id === visit.id || transaction.pos_id === visit.pos_id),
    }));
  });
}

export async function getAttendanceHistoryForBA(baId: string, campaignRunId?: string): Promise<BADailyAttendance[]> {
  const client = getMerchantClient();
  let query = client
    .from('ba_daily_attendance')
    .select('*')
    .eq('ba_id', baId)
    .eq('status', 'closed')
    .order('activity_date', { ascending: false });
  if (campaignRunId) query = query.eq('campaign_run_id', campaignRunId);
  const { data, error } = await query;
  fail(error, 'Impossible de charger les archives BA');
  return (data || []) as BADailyAttendance[];
}

export async function getTransactionsForBA(baId: string, campaignRunId?: string): Promise<BATransaction[]> {
  const client = getMerchantClient();
  let query = client
    .from('ba_transactions')
    .select('*, point_of_sale:points_of_sale(agent_number,denomination,pool)')
    .eq('ba_id', baId)
    .order('occurred_at', { ascending: false });
  if (campaignRunId) query = query.eq('campaign_run_id', campaignRunId);
  const { data, error } = await query;
  fail(error, 'Impossible de charger les transactions');
  return (data || []) as BATransaction[];
}

export interface MerchantTeamActivity {
  ba: { id: string; name: string; phone: string };
  attendance: BADailyAttendance | null;
  transactions: BATransaction[];
  status: 'absent' | 'present' | 'closed';
  visitedPosCount: number;
  inactivePosCount: number;
  transactionCount: number;
  totalAmount: number;
  mfsNames: string[];
}

export interface MerchantArchiveSummary {
  attendance: BADailyAttendance;
  ba: { id: string; name: string; phone: string };
  transactions: BATransaction[];
  visitedPosCount: number;
  transactionCount: number;
  totalAmount: number;
}

function activityWindow(activityDate: string) {
  return {
    start: `${activityDate}T00:00:00+01:00`,
    end: `${activityDate}T23:59:59.999+01:00`,
  };
}

async function getMerchantBAs() {
  return withMerchantCache('bas', async () => {
    const client = getMerchantClient();
    const { data, error } = await client
      .from('users')
      .select('id,full_name,phone')
      .eq('user_category', 'brand_ambassador')
      .order('full_name');
    fail(error, 'Impossible de charger les Brand Ambassadors');
    return (data || []).map((user: { id: string; full_name?: string | null; phone?: string | null }) => ({
      id: user.id,
      name: user.full_name || 'Brand Ambassador',
      phone: user.phone || '',
    }));
  });
}

export async function getMerchantMonitoring(runId: string, activityDate: string): Promise<MerchantTeamActivity[]> {
  const safeActivityDate = clampMerchantActivityDate(activityDate);
  return withMerchantCache(`monitoring:${runId}:${safeActivityDate}`, async () => {
    const client = getMerchantClient();
    const { start, end } = activityWindow(safeActivityDate);
    const [bas, attendanceResponse, transactionResponse, visitResponse] = await Promise.all([
      getMerchantBAs(),
      client.from('ba_daily_attendance').select('*').eq('campaign_run_id', runId).eq('activity_date', safeActivityDate),
      client.from('ba_transactions').select('*, point_of_sale:points_of_sale(agent_number,denomination,pool)').eq('campaign_run_id', runId).gte('occurred_at', start).lte('occurred_at', end),
      client.from('ba_pos_visits').select('id,ba_id,pos_id,operational_status,point_of_sale:points_of_sale(mfs_name)').eq('campaign_run_id', runId).eq('activity_date', safeActivityDate).neq('status', 'alerted'),
    ]);
    fail(attendanceResponse.error, 'Impossible de charger les pointages Merchant');
    fail(transactionResponse.error, 'Impossible de charger les transactions Merchant');
    fail(visitResponse.error, 'Impossible de charger les arrivées POS Merchant');

    const attendances = (attendanceResponse.data || []) as BADailyAttendance[];
    const transactions = (transactionResponse.data || []) as BATransaction[];
    const visits = (visitResponse.data || []) as Array<Pick<BAPosVisit, 'id' | 'ba_id' | 'pos_id' | 'operational_status'> & { point_of_sale?: Pick<PointOfSale, 'mfs_name'> | null }>;
    return bas.map((ba) => {
      const attendance = attendances.find((item) => item.ba_id === ba.id) || null;
      const baTransactions = transactions.filter((item) => item.ba_id === ba.id);
      const baVisits = visits.filter((item) => item.ba_id === ba.id);
      return {
        ba,
        attendance,
        transactions: baTransactions,
        status: attendance?.status === 'closed' ? 'closed' : attendance?.checkin_at ? 'present' : 'absent',
        visitedPosCount: baVisits.length,
        inactivePosCount: baVisits.filter((item) => item.operational_status === 'inactive').length,
        transactionCount: baTransactions.length,
        totalAmount: baTransactions.reduce((total, item) => total + Number(item.amount || 0), 0),
        mfsNames: Array.from(new Set([attendance?.mfs_name?.trim() || '', ...baVisits.map((item) => item.point_of_sale?.mfs_name?.trim() || '')].filter(Boolean))),
      };
    });
  });
}

export async function getMerchantArchives(runId: string, startDate?: string, endDate?: string): Promise<MerchantArchiveSummary[]> {
  const client = getMerchantClient();
  const safeStartDate = clampMerchantActivityDate(startDate || MERCHANT_CAMPAIGN_START);
  const safeEndDate = clampMerchantActivityDate(endDate || merchantTodayIso());
  let attendanceQuery = client
    .from('ba_daily_attendance')
    .select('*')
    .eq('campaign_run_id', runId)
    .eq('status', 'closed')
    .order('activity_date', { ascending: false });
  attendanceQuery = attendanceQuery.gte('activity_date', safeStartDate).lte('activity_date', safeEndDate);
  const [bas, attendanceResponse] = await Promise.all([getMerchantBAs(), attendanceQuery]);
  fail(attendanceResponse.error, 'Impossible de charger les archives Merchant');
  const attendances = (attendanceResponse.data || []) as BADailyAttendance[];
  if (attendances.length === 0) return [];

  const minDate = attendances[attendances.length - 1].activity_date;
  const maxDate = attendances[0].activity_date;
  const { start } = activityWindow(minDate);
  const { end } = activityWindow(maxDate);
  const { data, error } = await client
    .from('ba_transactions')
    .select('*, point_of_sale:points_of_sale(agent_number,denomination,pool)')
    .eq('campaign_run_id', runId)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: false });
  fail(error, 'Impossible de charger les transactions des archives Merchant');
  const transactions = (data || []) as BATransaction[];

  return attendances.map((attendance) => {
    const ba = bas.find((item) => item.id === attendance.ba_id) || { id: attendance.ba_id, name: 'Brand Ambassador', phone: '' };
    const dayTransactions = transactions.filter((item) => item.ba_id === attendance.ba_id && item.occurred_at.slice(0, 10) === attendance.activity_date);
    return {
      attendance,
      ba,
      transactions: dayTransactions,
      visitedPosCount: new Set(dayTransactions.map((item) => item.pos_id)).size,
      transactionCount: dayTransactions.length,
      totalAmount: dayTransactions.reduce((total, item) => total + Number(item.amount || 0), 0),
    };
  });
}

export interface MerchantPosCreateInput {
  campaign_id: string;
  denomination: string;
  agent_number: string;
  address: string;
  pool: PointOfSale['pool'];
  activity?: string | null;
  mfs_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export async function createMerchantPos(input: MerchantPosCreateInput): Promise<PointOfSale> {
  const client = getMerchantClient();
  const clean = {
    ...input,
    denomination: input.denomination.trim(),
    agent_number: input.agent_number.trim(),
    address: input.address.trim(),
    activity: input.activity?.trim() || null,
    mfs_name: input.mfs_name?.trim() || null,
    is_active: true,
  };
  if (!clean.denomination || !clean.agent_number || !clean.address) {
    throw new Error('La dénomination, le short-code et l’adresse sont requis.');
  }

  const { data: duplicate, error: duplicateError } = await client
    .from('points_of_sale')
    .select('id,denomination,agent_number')
    .eq('campaign_id', clean.campaign_id)
    .eq('agent_number', clean.agent_number)
    .maybeSingle();
  fail(duplicateError, 'Impossible de vérifier le short-code');
  if (duplicate) throw new Error(`Le short-code ${clean.agent_number} existe déjà pour « ${duplicate.denomination} », déjà présent dans le référentiel.`);

  const { data, error } = await client
    .from('points_of_sale')
    .insert(clean)
    .select('*')
    .single();
  fail(error, 'Impossible de créer le POS');
  invalidateMerchantCache();
  return data as PointOfSale;
}

export async function updateMerchantPosMfs(posId: string, mfsName: string): Promise<PointOfSale> {
  const client = getMerchantClient();
  const { data, error } = await client
    .from('points_of_sale')
    .update({ mfs_name: mfsName.trim() || null })
    .eq('id', posId)
    .select('*')
    .single();
  fail(error, 'Impossible de mettre à jour le MFS du POS');
  invalidateMerchantCache();
  return data as PointOfSale;
}

export async function getCampaignPos(campaignId: string, pool?: string): Promise<PointOfSale[]> {
  return withMerchantCache(`pos:${campaignId}:${pool || 'all'}`, async () => {
    const client = getMerchantClient();
    let query = client
      .from('points_of_sale')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('denomination');
    if (pool) query = query.eq('pool', pool);
    const { data, error } = await query;
    fail(error, 'Impossible de charger les POS');
    return (data || []) as PointOfSale[];
  });
}

export async function recordCheckin(input: Omit<BADailyAttendance, 'id' | 'created_at' | 'updated_at' | 'checkout_at' | 'checkout_latitude' | 'checkout_longitude' | 'checkout_accuracy_m' | 'closing_comment'>): Promise<BADailyAttendance> {
  const client = getMerchantClient();
  const activityDate = clampMerchantActivityDate(input.activity_date);
  await finalizePriorMerchantDays(input.campaign_run_id, input.ba_id, activityDate);
  const { data, error } = await client
    .from('ba_daily_attendance')
    .upsert({ ...input, activity_date: activityDate }, { onConflict: 'campaign_run_id,ba_id,activity_date' })
    .select()
    .single();
  fail(error, 'Impossible d’enregistrer le pointage du matin');
  invalidateMerchantCache();
  return data as BADailyAttendance;
}

const merchantDayBounds = (activityDate: string) => {
  const start = `${activityDate}T00:00:00+00:00`;
  const nextDay = new Date(`${activityDate}T12:00:00+00:00`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return { start, end: `${nextDay.toISOString().slice(0, 10)}T00:00:00+00:00` };
};

async function getMerchantTransactionTarget(runId: string): Promise<number> {
  const client = getMerchantClient();
  const { data, error } = await client
    .from('campaign_runs')
    .select('transactions_per_pos_target')
    .eq('id', runId)
    .single();
  fail(error, 'Impossible de charger l’objectif transactionnel Merchant');
  return Math.max(1, Number(data?.transactions_per_pos_target || 3));
}

export interface MarkIncompleteMerchantPosVisitsInput {
  runId: string;
  baId: string;
  activityDate: string;
  exceptPosId?: string;
  target?: number;
}

/**
 * Finalise une journée ou un changement de POS sans jamais assimiler un POS non actif
 * à un POS inachevé. Les comptes sont indexés par visite afin d’éviter toute comparaison N×M.
 */
export async function markIncompleteMerchantPosVisits({ runId, baId, activityDate, exceptPosId, target }: MarkIncompleteMerchantPosVisitsInput): Promise<number> {
  const client = getMerchantClient();
  const safeActivityDate = clampMerchantActivityDate(activityDate);
  const transactionTarget = target ?? await getMerchantTransactionTarget(runId);
  const { data: visitsData, error: visitsError } = await client
    .from('ba_pos_visits')
    .select('id,pos_id,status,operational_status')
    .eq('campaign_run_id', runId)
    .eq('ba_id', baId)
    .eq('activity_date', safeActivityDate)
    .eq('status', 'visited');
  fail(visitsError, 'Impossible de charger les visites à finaliser');

  const visits = (visitsData || []) as Pick<BAPosVisit, 'id' | 'pos_id' | 'status' | 'operational_status'>[];
  const eligibleVisits = visits.filter((visit) => visit.operational_status !== 'inactive' && visit.pos_id !== exceptPosId);
  if (eligibleVisits.length === 0) return 0;

  const { start, end } = merchantDayBounds(safeActivityDate);
  const { data: transactionsData, error: transactionsError } = await client
    .from('ba_transactions')
    .select('pos_visit_id,pos_id')
    .eq('campaign_run_id', runId)
    .eq('ba_id', baId)
    .gte('occurred_at', start)
    .lt('occurred_at', end)
    .neq('status', 'rejected');
  fail(transactionsError, 'Impossible de compter les transactions des visites');

  const countByVisitId = new Map<string, number>();
  const countByPosId = new Map<string, number>();
  (transactionsData || []).forEach((transaction) => {
    if (transaction.pos_visit_id) countByVisitId.set(transaction.pos_visit_id, (countByVisitId.get(transaction.pos_visit_id) || 0) + 1);
    countByPosId.set(transaction.pos_id, (countByPosId.get(transaction.pos_id) || 0) + 1);
  });
  const incompleteIds = eligibleVisits
    .filter((visit) => (countByVisitId.get(visit.id) ?? countByPosId.get(visit.pos_id) ?? 0) < transactionTarget)
    .map((visit) => visit.id);
  if (incompleteIds.length === 0) return 0;

  const { error: updateError } = await client
    .from('ba_pos_visits')
    .update({ status: 'incomplete' })
    .in('id', incompleteIds);
  fail(updateError, 'Impossible de marquer les POS inachevés');
  invalidateMerchantCache();
  return incompleteIds.length;
}

/** Finalise les visites ouvertes d’un BA avant la journée en cours. */
export async function finalizePriorMerchantDays(runId: string, baId: string, currentActivityDate: string, target?: number): Promise<number> {
  const client = getMerchantClient();
  const safeCurrentDate = clampMerchantActivityDate(currentActivityDate);
  const transactionTarget = target ?? await getMerchantTransactionTarget(runId);
  const { data: visitsData, error: visitsError } = await client
    .from('ba_pos_visits')
    .select('id,pos_id,activity_date,status,operational_status')
    .eq('campaign_run_id', runId)
    .eq('ba_id', baId)
    .lt('activity_date', safeCurrentDate)
    .eq('status', 'visited');
  fail(visitsError, 'Impossible de charger les jours Merchant antérieurs');

  const visits = (visitsData || []) as Array<Pick<BAPosVisit, 'id' | 'pos_id' | 'activity_date' | 'status' | 'operational_status'>>;
  const eligibleVisits = visits.filter((visit) => visit.operational_status !== 'inactive');
  if (eligibleVisits.length === 0) return 0;

  const { start: beforeCurrentDay } = merchantDayBounds(safeCurrentDate);
  const { data: transactionsData, error: transactionsError } = await client
    .from('ba_transactions')
    .select('pos_visit_id,pos_id,occurred_at')
    .eq('campaign_run_id', runId)
    .eq('ba_id', baId)
    .lt('occurred_at', beforeCurrentDay)
    .neq('status', 'rejected');
  fail(transactionsError, 'Impossible de compter les transactions historiques Merchant');

  const countByVisitId = new Map<string, number>();
  const countByPosAndDate = new Map<string, number>();
  (transactionsData || []).forEach((transaction) => {
    if (transaction.pos_visit_id) countByVisitId.set(transaction.pos_visit_id, (countByVisitId.get(transaction.pos_visit_id) || 0) + 1);
    const key = `${transaction.pos_id}:${transaction.occurred_at.slice(0, 10)}`;
    countByPosAndDate.set(key, (countByPosAndDate.get(key) || 0) + 1);
  });
  const incompleteIds = eligibleVisits
    .filter((visit) => (countByVisitId.get(visit.id) ?? countByPosAndDate.get(`${visit.pos_id}:${visit.activity_date}`) ?? 0) < transactionTarget)
    .map((visit) => visit.id);
  if (incompleteIds.length === 0) return 0;

  const { error: updateError } = await client
    .from('ba_pos_visits')
    .update({ status: 'incomplete' })
    .in('id', incompleteIds);
  fail(updateError, 'Impossible de finaliser les POS inachevés des jours antérieurs');
  invalidateMerchantCache();
  return incompleteIds.length;
}

export async function closeDailyAttendance(id: string, input: Pick<BADailyAttendance, 'checkout_at' | 'checkout_latitude' | 'checkout_longitude' | 'checkout_accuracy_m' | 'closing_comment' | 'status'>): Promise<BADailyAttendance> {
  const client = getMerchantClient();
  const { data: attendance, error: attendanceError } = await client
    .from('ba_daily_attendance')
    .select('campaign_run_id,ba_id,activity_date')
    .eq('id', id)
    .single();
  fail(attendanceError, 'Impossible de préparer la clôture de journée');
  await markIncompleteMerchantPosVisits({
    runId: attendance.campaign_run_id,
    baId: attendance.ba_id,
    activityDate: attendance.activity_date,
  });

  const { data, error } = await client
    .from('ba_daily_attendance')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  fail(error, 'Impossible de clôturer la journée');
  invalidateMerchantCache();
  return data as BADailyAttendance;
}

export async function updateMerchantAttendanceMfs(attendanceId: string, mfsName: string): Promise<BADailyAttendance> {
  const client = getMerchantClient();
  const { data, error } = await client
    .from('ba_daily_attendance')
    .update({ mfs_name: mfsName.trim() || null })
    .eq('id', attendanceId)
    .select()
    .single();
  fail(error, 'Impossible d’enregistrer le MFS du jour');
  invalidateMerchantCache();
  return data as BADailyAttendance;
}

export async function recordPosArrival(input: Omit<BAPosVisit, 'id' | 'created_at' | 'updated_at' | 'point_of_sale' | 'transactions'>): Promise<BAPosVisit> {
  const client = getMerchantClient();
  const activityDate = clampMerchantActivityDate(input.activity_date);
  await markIncompleteMerchantPosVisits({
    runId: input.campaign_run_id,
    baId: input.ba_id,
    activityDate,
    exceptPosId: input.pos_id,
  });
  const { data: existing, error: lookupError } = await client
    .from('ba_pos_visits')
    .select('*, point_of_sale:points_of_sale(*)')
    .eq('campaign_run_id', input.campaign_run_id)
    .eq('pos_id', input.pos_id)
    .eq('activity_date', activityDate)
    .neq('status', 'alerted')
    .maybeSingle();
  fail(lookupError, 'Impossible de vérifier le POS du jour');
  if (existing) {
    if (existing.ba_id === input.ba_id) return existing as BAPosVisit;
    throw new Error('Ce POS a déjà été pris en charge aujourd’hui par un autre Brand Ambassador.');
  }

  const { data, error } = await client
    .from('ba_pos_visits')
    .insert({ ...input, activity_date: activityDate })
    .select('*, point_of_sale:points_of_sale(*)')
    .single();
  if (error?.code === '23505') {
    throw new Error('Ce POS vient d’être pris en charge par un autre Brand Ambassador. Veuillez sélectionner un autre point de vente.');
  }
  fail(error, 'Impossible d’enregistrer l’arrivée au POS');
  invalidateMerchantCache();
  return data as BAPosVisit;
}

export async function createTransaction(input: Omit<BATransaction, 'id' | 'created_at' | 'updated_at'>, target?: number): Promise<BATransaction> {
  const client = getMerchantClient();
  const { data, error } = await client.from('ba_transactions').insert(input).select().single();
  fail(error, 'Impossible d’enregistrer la transaction');

  if (input.pos_visit_id) {
    const transactionTarget = target ?? await getMerchantTransactionTarget(input.campaign_run_id);
    const { count, error: countError } = await client
      .from('ba_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('pos_visit_id', input.pos_visit_id)
      .neq('status', 'rejected');
    fail(countError, 'Impossible de vérifier la progression du POS');
    if ((count || 0) >= transactionTarget) {
      const { error: restoreError } = await client
        .from('ba_pos_visits')
        .update({ status: 'visited' })
        .eq('id', input.pos_visit_id)
        .eq('operational_status', 'active')
        .eq('status', 'incomplete');
      fail(restoreError, 'Impossible de rétablir le POS complété');
    }
  }
  invalidateMerchantCache();
  return data as BATransaction;
}

export async function updateMerchantTransactionReference(transactionId: string, reference: string | null): Promise<BATransaction> {
  const client = getMerchantClient();
  const normalized = reference?.trim() || null;
  const { data, error } = await client
    .from('ba_transactions')
    .update({ transaction_reference: normalized })
    .eq('id', transactionId)
    .select('*, point_of_sale:points_of_sale(agent_number,denomination,pool)')
    .single();
  fail(error, 'Impossible de mettre à jour l’identifiant de transaction');
  invalidateMerchantCache();
  return data as BATransaction;
}

export async function uploadMerchantEvidence(campaignId: string, relativePath: string, file: Blob): Promise<string> {
  const client = getMerchantClient();
  const path = `${campaignId}/${relativePath}`;
  const { error } = await client.storage.from('ba-evidence').upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
  fail(error, 'Impossible de téléverser la preuve');
  return path;
}

export async function getMerchantEvidencePublicUrl(path?: string | null): Promise<string> {
  if (!path) return '';
  const client = getMerchantClient();
  const { data, error } = await client.storage.from('ba-evidence').createSignedUrl(path, 60 * 60 * 12);
  fail(error, 'Impossible de préparer la photo de pointage');
  return data?.signedUrl || '';
}

export async function getMerchantSession() {
  const client = getMerchantClient();
  const { data, error } = await client.auth.getSession();
  fail(error, 'Impossible de lire la session sécurisée');
  return data.session;
}

export async function signInMerchant(email: string, password: string) {
  const client = getMerchantClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  fail(error, 'Connexion sécurisée impossible');
  return data;
}

export async function signOutMerchant(): Promise<void> {
  const client = getMerchantClient();
  const { error } = await client.auth.signOut();
  fail(error, 'Déconnexion sécurisée impossible');
}

export async function getMerchantAttendanceTimeline(baId: string, campaignRunId?: string): Promise<BADailyAttendance[]> {
  const client = getMerchantClient();
  let query = client
    .from('ba_daily_attendance')
    .select('*')
    .eq('ba_id', baId)
    .order('activity_date', { ascending: false });
  if (campaignRunId) query = query.eq('campaign_run_id', campaignRunId);
  const { data, error } = await query;
  fail(error, 'Impossible de charger le calendrier de présence BA');
  return (data || []) as BADailyAttendance[];
}

export async function getMerchantBAActivityDetail(baId: string, campaignRunId?: string) {
  const [attendances, transactions] = await Promise.all([
    getMerchantAttendanceTimeline(baId, campaignRunId),
    getTransactionsForBA(baId, campaignRunId),
  ]);
  return { attendances, transactions };
}

export interface MerchantTargetSettings {
  campaign_pos_target: number;
  daily_pos_target: number;
  transactions_per_pos_target: number;
}

export interface MerchantDashboardSummary {
  targets: MerchantTargetSettings;
  activeBas: number;
  teamSize: number;
  visitedToday: number;
  transactionsToday: number;
  dailyExecutionRate: number;
  campaignExecutionRate: number;
  donut: Array<{ name: string; value: number; color: string }>;
  byBa: Array<{ id: string; name: string; pos: number; target: number; transactions: number; amount: number }>;
  timeline: Array<{ label: string; visits: number; target: number }>;
}

export interface MerchantPodiumEntry {
  rank: number;
  activity: MerchantTeamActivity;
  firstArrival: string;
  platinumStreak: number;
  isLocked: boolean;
  targetReachedAt: string | null;
  dailyPosTarget: number;
  dailyTransactionTarget: number;
}

export interface MerchantPosControlItem {
  pos: PointOfSale;
  status: 'pending' | 'active' | 'inactive' | 'incomplete' | 'completed';
  transactionCount: number;
  ba: { id: string; name: string; phone: string } | null;
  visit: BAPosVisit | null;
  transactions: BATransaction[];
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function getDateRange(days: number, end = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => {
    const next = new Date(end);
    next.setDate(end.getDate() - (days - 1 - index));
    return isoDate(next);
  });
}

export async function updateMerchantTargetSettings(runId: string, targets: Pick<MerchantTargetSettings, 'daily_pos_target' | 'transactions_per_pos_target'>): Promise<CampaignRun> {
  const client = getMerchantClient();
  const payload = {
    daily_pos_target: Math.max(1, Math.round(targets.daily_pos_target)),
    transactions_per_pos_target: Math.max(1, Math.round(targets.transactions_per_pos_target)),
  };
  const { data, error } = await client
    .from('campaign_runs')
    .update(payload)
    .eq('id', runId)
    .select()
    .single();
  fail(error, 'Impossible de mettre à jour les objectifs Merchant');
  invalidateMerchantCache();
  return data as CampaignRun;
}

async function getRunActivityData(runId: string) {
  return withMerchantCache(`activity:${runId}`, async () => {
    const client = getMerchantClient();
    const [visitsResponse, transactionsResponse, attendanceResponse] = await Promise.all([
      client.from('ba_pos_visits').select('*, point_of_sale:points_of_sale(*)').eq('campaign_run_id', runId).gte('activity_date', MERCHANT_CAMPAIGN_START).neq('status', 'alerted').order('visited_at', { ascending: true }),
      client.from('ba_transactions').select('*, point_of_sale:points_of_sale(agent_number,denomination,pool)').eq('campaign_run_id', runId).gte('occurred_at', `${MERCHANT_CAMPAIGN_START}T00:00:00+01:00`).neq('status', 'rejected').order('occurred_at', { ascending: true }),
      client.from('ba_daily_attendance').select('*').eq('campaign_run_id', runId).gte('activity_date', MERCHANT_CAMPAIGN_START).order('activity_date', { ascending: true }),
    ]);
    fail(visitsResponse.error, 'Impossible de charger les visites POS Merchant');
    fail(transactionsResponse.error, 'Impossible de charger les transactions Merchant');
    fail(attendanceResponse.error, 'Impossible de charger les présences Merchant');
    return {
      visits: (visitsResponse.data || []) as BAPosVisit[],
      transactions: (transactionsResponse.data || []) as BATransaction[],
      attendances: (attendanceResponse.data || []) as BADailyAttendance[],
    };
  });
}

function getIncompleteMerchantVisitIds(
  visits: BAPosVisit[],
  transactions: BATransaction[],
  attendances: BADailyAttendance[],
  transactionTarget: number,
): Set<string> {
  const closedDays = new Set(attendances
    .filter((attendance) => attendance.status === 'closed' || Boolean(attendance.checkout_at))
    .map((attendance) => `${attendance.ba_id}:${attendance.activity_date}`));
  const countByVisitId = new Map<string, number>();
  const countByPosAndDate = new Map<string, number>();
  transactions.filter((transaction) => transaction.status !== 'rejected').forEach((transaction) => {
    if (transaction.pos_visit_id) countByVisitId.set(transaction.pos_visit_id, (countByVisitId.get(transaction.pos_visit_id) || 0) + 1);
    const key = `${transaction.pos_id}:${transaction.occurred_at.slice(0, 10)}`;
    countByPosAndDate.set(key, (countByPosAndDate.get(key) || 0) + 1);
  });

  return new Set(visits
    .filter((visit) => {
      if (visit.operational_status === 'inactive') return false;
      const transactionCount = countByVisitId.get(visit.id) ?? countByPosAndDate.get(`${visit.pos_id}:${visit.activity_date}`) ?? 0;
      const wasClosed = closedDays.has(`${visit.ba_id}:${visit.activity_date}`);
      return transactionCount < transactionTarget && (visit.status === 'incomplete' || wasClosed || isMerchantActivityExpired(visit.activity_date));
    })
    .map((visit) => visit.id));
}

async function persistHistoricalIncompleteVisits(runId: string, incompleteIds: Set<string>): Promise<void> {
  const visitIds = Array.from(incompleteIds);
  if (!visitIds.length) return;
  const client = getMerchantClient();
  const { error } = await client
    .from('ba_pos_visits')
    .update({ status: 'incomplete' })
    .eq('campaign_run_id', runId)
    .eq('operational_status', 'active')
    .eq('status', 'visited')
    .in('id', visitIds);
  if (!error) invalidateMerchantCache(`activity:${runId}`);
}

export async function getMerchantDashboardSummary(run: CampaignRun, activityDate = isoDate(new Date())): Promise<MerchantDashboardSummary> {
  const safeActivityDate = clampMerchantActivityDate(activityDate);
  const [team, bas, activity, campaignPos] = await Promise.all([
    getMerchantMonitoring(run.id, safeActivityDate),
    getMerchantBAs(),
    getRunActivityData(run.id),
    getCampaignPos(run.campaign_id),
  ]);
  const targets: MerchantTargetSettings = {
    campaign_pos_target: campaignPos.length,
    daily_pos_target: Number(run.daily_pos_target || 15),
    transactions_per_pos_target: Number(run.transactions_per_pos_target || 3),
  };
  const incompleteVisitIds = getIncompleteMerchantVisitIds(activity.visits, activity.transactions, activity.attendances, targets.transactions_per_pos_target);
  await persistHistoricalIncompleteVisits(run.id, incompleteVisitIds);
  const todayVisits = activity.visits.filter((item) => item.activity_date === safeActivityDate);
  const todayTransactions = activity.transactions.filter((item) => item.occurred_at.slice(0, 10) === safeActivityDate);
  const activeBas = team.filter((item) => item.status !== 'absent').length;
  const distinctCampaignPos = new Set(activity.visits.map((item) => item.pos_id));
  const transactionCountByPos = new Map<string, number>();
  activity.transactions.forEach((item) => transactionCountByPos.set(item.pos_id, (transactionCountByPos.get(item.pos_id) || 0) + 1));
  const latestVisitByPos = new Map<string, BAPosVisit>();
  activity.visits.forEach((visit) => {
    const current = latestVisitByPos.get(visit.pos_id);
    if (!current || new Date(visit.visited_at || 0).getTime() > new Date(current.visited_at || 0).getTime()) latestVisitByPos.set(visit.pos_id, visit);
  });
  const inactivePos = Array.from(distinctCampaignPos).filter((posId) => latestVisitByPos.get(posId)?.operational_status === 'inactive').length;
  const incompletePos = Array.from(distinctCampaignPos).filter((posId) => {
    const visit = latestVisitByPos.get(posId);
    return visit?.operational_status !== 'inactive' && Boolean(visit && incompleteVisitIds.has(visit.id)) && (transactionCountByPos.get(posId) || 0) < targets.transactions_per_pos_target;
  }).length;
  const activePos = Array.from(distinctCampaignPos).filter((posId) => {
    const visit = latestVisitByPos.get(posId);
    return visit?.operational_status !== 'inactive' && !Boolean(visit && incompleteVisitIds.has(visit.id)) && (transactionCountByPos.get(posId) || 0) < targets.transactions_per_pos_target;
  }).length;
  const completedPos = Array.from(distinctCampaignPos).filter((posId) => latestVisitByPos.get(posId)?.operational_status !== 'inactive' && (transactionCountByPos.get(posId) || 0) >= targets.transactions_per_pos_target).length;
  const untouchedPos = Math.max(0, targets.campaign_pos_target - distinctCampaignPos.size);
  const days = getDateRange(7, new Date(`${safeActivityDate}T12:00:00`)).filter((day) => day >= MERCHANT_CAMPAIGN_START);
  const timeline = days.map((day) => {
    const present = activity.attendances.filter((item) => item.activity_date === day && Boolean(item.checkin_at)).length;
    return {
      label: new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      visits: activity.visits.filter((item) => item.activity_date === day).length,
      target: present * targets.daily_pos_target,
    };
  });
  return {
    targets,
    activeBas,
    teamSize: bas.length,
    visitedToday: todayVisits.length,
    transactionsToday: todayTransactions.length,
    dailyExecutionRate: activeBas > 0 ? Math.min(100, Math.round((todayVisits.length / (activeBas * targets.daily_pos_target)) * 100)) : 0,
    campaignExecutionRate: targets.campaign_pos_target > 0 ? Math.min(100, Math.round((distinctCampaignPos.size / targets.campaign_pos_target) * 100)) : 0,
    donut: [
      { name: 'Complétés', value: completedPos, color: '#34d399' },
      { name: 'Actifs', value: activePos, color: '#38bdf8' },
      { name: 'Inachevés', value: incompletePos, color: '#fb7185' },
      { name: 'Non actifs', value: inactivePos, color: '#f59e0b' },
      { name: 'À couvrir', value: untouchedPos, color: '#a78bfa' },
    ],
    byBa: team.map((item) => ({
      id: item.ba.id,
      name: item.ba.name.split(' ')[0],
      pos: item.visitedPosCount,
      target: targets.daily_pos_target,
      transactions: item.transactionCount,
      amount: item.totalAmount,
    })),
    timeline,
  };
}

export async function getMerchantStandings(runId: string, activityDate = isoDate(new Date())): Promise<MerchantPodiumEntry[]> {
  const safeActivityDate = clampMerchantActivityDate(activityDate);
  const client = getMerchantClient();
  const [team, activity, runResponse] = await Promise.all([
    getMerchantMonitoring(runId, safeActivityDate),
    getRunActivityData(runId),
    client.from('campaign_runs').select('daily_pos_target,transactions_per_pos_target').eq('id', runId).single(),
  ]);
  fail(runResponse.error, 'Impossible de charger les objectifs Merchant du podium');
  const dailyPosTarget = Math.max(1, Number(runResponse.data?.daily_pos_target || 15));
  const dailyTransactionTarget = dailyPosTarget * Math.max(1, Number(runResponse.data?.transactions_per_pos_target || 3));
  const firstArrivalByBa = new Map<string, string>();
  const visitsTodayByBa = new Map<string, BAPosVisit[]>();
  const transactionsTodayByBa = new Map<string, BATransaction[]>();
  activity.visits
    .filter((visit) => visit.activity_date === safeActivityDate && visit.visited_at)
    .forEach((visit) => {
      const current = firstArrivalByBa.get(visit.ba_id);
      if (!current || new Date(visit.visited_at as string).getTime() < new Date(current).getTime()) firstArrivalByBa.set(visit.ba_id, visit.visited_at as string);
      const rows = visitsTodayByBa.get(visit.ba_id) || [];
      rows.push(visit);
      visitsTodayByBa.set(visit.ba_id, rows);
    });
  activity.transactions
    .filter((transaction) => transaction.occurred_at.slice(0, 10) === safeActivityDate)
    .forEach((transaction) => {
      const rows = transactionsTodayByBa.get(transaction.ba_id) || [];
      rows.push(transaction);
      transactionsTodayByBa.set(transaction.ba_id, rows);
    });
  const targetReachedAtByBa = new Map<string, string>();
  team.forEach((item) => {
    const baVisits = (visitsTodayByBa.get(item.ba.id) || []).sort((left, right) => String(left.visited_at).localeCompare(String(right.visited_at)));
    const inactiveCount = baVisits.filter((visit) => visit.operational_status === 'inactive').length;
    const requiredTransactionTarget = Math.max(0, (dailyPosTarget - inactiveCount) * Math.max(1, Number(runResponse.data?.transactions_per_pos_target || 3)));
    const targetVisit = baVisits[dailyPosTarget - 1]?.visited_at;
    const targetTransaction = requiredTransactionTarget > 0
      ? (transactionsTodayByBa.get(item.ba.id) || []).sort((left, right) => left.occurred_at.localeCompare(right.occurred_at))[requiredTransactionTarget - 1]?.occurred_at
      : targetVisit;
    if (targetVisit && targetTransaction) targetReachedAtByBa.set(item.ba.id, new Date(Math.max(new Date(targetVisit).getTime(), new Date(targetTransaction).getTime())).toISOString());
  });
  const compareVolume = (left: MerchantTeamActivity, right: MerchantTeamActivity) => {
    if (right.transactionCount !== left.transactionCount) return right.transactionCount - left.transactionCount;
    if (right.visitedPosCount !== left.visitedPosCount) return right.visitedPosCount - left.visitedPosCount;
    if (right.totalAmount !== left.totalAmount) return right.totalAmount - left.totalAmount;
    return new Date(firstArrivalByBa.get(left.ba.id) || 0).getTime() - new Date(firstArrivalByBa.get(right.ba.id) || 0).getTime();
  };
  const eligible = team.filter((item) => firstArrivalByBa.has(item.ba.id));
  const locked = eligible
    .filter((item) => targetReachedAtByBa.has(item.ba.id))
    .sort((left, right) => String(targetReachedAtByBa.get(left.ba.id)).localeCompare(String(targetReachedAtByBa.get(right.ba.id))))
    .slice(0, 3);
  const lockedIds = new Set(locked.map((item) => item.ba.id));
  const ranked = [...locked, ...eligible.filter((item) => !lockedIds.has(item.ba.id)).sort(compareVolume)];

  const dailyVolume = new Map<string, Map<string, { transactionCount: number; visitedPos: Set<string>; totalAmount: number; firstArrival: string }>>();
  activity.visits.filter((visit) => Boolean(visit.visited_at)).forEach((visit) => {
    const day = visit.activity_date;
    const byBa = dailyVolume.get(day) || new Map<string, { transactionCount: number; visitedPos: Set<string>; totalAmount: number; firstArrival: string }>();
    const current = byBa.get(visit.ba_id) || { transactionCount: 0, visitedPos: new Set<string>(), totalAmount: 0, firstArrival: String(visit.visited_at) };
    current.visitedPos.add(visit.pos_id);
    if (new Date(visit.visited_at as string).getTime() < new Date(current.firstArrival).getTime()) current.firstArrival = String(visit.visited_at);
    byBa.set(visit.ba_id, current);
    dailyVolume.set(day, byBa);
  });
  activity.transactions.forEach((transaction) => {
    const day = transaction.occurred_at.slice(0, 10);
    const byBa = dailyVolume.get(day) || new Map<string, { transactionCount: number; visitedPos: Set<string>; totalAmount: number; firstArrival: string }>();
    const current = byBa.get(transaction.ba_id) || { transactionCount: 0, visitedPos: new Set<string>(), totalAmount: 0, firstArrival: transaction.occurred_at };
    current.transactionCount += 1;
    current.totalAmount += Number(transaction.amount || 0);
    byBa.set(transaction.ba_id, current);
    dailyVolume.set(day, byBa);
  });
  const dailyWinnerByDate = new Map<string, string>();
  dailyVolume.forEach((byBa, day) => {
    const winner = Array.from(byBa.entries()).sort(([, left], [, right]) => {
      if (right.transactionCount !== left.transactionCount) return right.transactionCount - left.transactionCount;
      if (right.visitedPos.size !== left.visitedPos.size) return right.visitedPos.size - left.visitedPos.size;
      if (right.totalAmount !== left.totalAmount) return right.totalAmount - left.totalAmount;
      return new Date(left.firstArrival).getTime() - new Date(right.firstArrival).getTime();
    })[0];
    if (winner) dailyWinnerByDate.set(day, winner[0]);
  });
  const orderedDays = Array.from(dailyWinnerByDate.keys()).filter((date) => date >= MERCHANT_CAMPAIGN_START && date <= safeActivityDate).sort((left, right) => right.localeCompare(left));
  return ranked.map((activityItem, index) => {
    let platinumStreak = 0;
    for (const day of orderedDays) {
      if (dailyWinnerByDate.get(day) === activityItem.ba.id) platinumStreak += 1;
      else break;
    }
    return {
      rank: index + 1,
      activity: activityItem,
      firstArrival: firstArrivalByBa.get(activityItem.ba.id) as string,
      platinumStreak,
      isLocked: lockedIds.has(activityItem.ba.id),
      targetReachedAt: targetReachedAtByBa.get(activityItem.ba.id) || null,
      dailyPosTarget,
      dailyTransactionTarget,
    };
  });
}

export async function getMerchantPodium(runId: string, activityDate = isoDate(new Date())): Promise<MerchantPodiumEntry[]> {
  return (await getMerchantStandings(runId, activityDate)).slice(0, 3);
}

export async function getMerchantPosControl(run: CampaignRun): Promise<MerchantPosControlItem[]> {
  const [campaign, bas, activity] = await Promise.all([
    getMerchantCampaign(),
    getMerchantBAs(),
    getRunActivityData(run.id),
  ]);
  if (!campaign) return [];
  const pos = await getCampaignPos(campaign.id);
  const baById = new Map(bas.map((ba) => [ba.id, ba]));
  const target = Number(run.transactions_per_pos_target || 3);
  const incompleteVisitIds = getIncompleteMerchantVisitIds(activity.visits, activity.transactions, activity.attendances, target);
  await persistHistoricalIncompleteVisits(run.id, incompleteVisitIds);
  const transactionsByPos = new Map<string, BATransaction[]>();
  activity.transactions.forEach((transaction) => {
    const rows = transactionsByPos.get(transaction.pos_id) || [];
    rows.push(transaction);
    transactionsByPos.set(transaction.pos_id, rows);
  });
  const latestVisitByPos = new Map<string, BAPosVisit>();
  activity.visits.forEach((visit) => {
    const current = latestVisitByPos.get(visit.pos_id);
    if (!current || new Date(visit.visited_at || 0).getTime() > new Date(current.visited_at || 0).getTime()) {
      latestVisitByPos.set(visit.pos_id, visit);
    }
  });
  transactionsByPos.forEach((rows) => rows.sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime()));

  return pos.map((item) => {
    const transactions = transactionsByPos.get(item.id) || [];
    const visit = latestVisitByPos.get(item.id) || null;
    const transactionCount = transactions.length;
    const status: MerchantPosControlItem['status'] = visit?.operational_status === 'inactive'
      ? 'inactive'
      : transactionCount >= target
        ? 'completed'
        : visit && incompleteVisitIds.has(visit.id)
          ? 'incomplete'
          : visit
            ? 'active'
            : 'pending';
    return {
      pos: item,
      status,
      transactionCount,
      ba: visit ? baById.get(visit.ba_id) || null : null,
      visit,
      transactions,
    };
  });
}

export async function getMerchantPosDetail(run: CampaignRun, posId: string): Promise<MerchantPosControlItem | null> {
  const items = await getMerchantPosControl(run);
  return items.find((item) => item.pos.id === posId) || null;
}

export type MerchantSupervisorReportKind = 'daily' | 'weekly' | 'compiled';

export interface MerchantSupervisorReport {
  kind: MerchantSupervisorReportKind;
  startsOn: string;
  endsOn: string;
  targets: MerchantTargetSettings;
  totals: { pos: number; transactions: number; amount: number; activeBas: number; executionRate: number };
  byBa: Array<{ id: string; name: string; phone: string; pos: number; transactions: number; amount: number; firstArrival?: string | null }>;
  daily: Array<{ date: string; pos: number; transactions: number; activeBas: number }>;
}

const addCalendarDays = (iso: string, offset: number): string => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return isoDate(date);
};

export async function getMerchantSupervisorReport(run: CampaignRun, kind: MerchantSupervisorReportKind, activityDate = merchantTodayIso()): Promise<MerchantSupervisorReport> {
  const today = merchantTodayIso();
  const selectedDay = clampMerchantActivityDate(activityDate);
  const startsOn = kind === 'daily'
    ? selectedDay
    : kind === 'weekly'
      ? (addCalendarDays(today, -6) < MERCHANT_CAMPAIGN_START ? MERCHANT_CAMPAIGN_START : addCalendarDays(today, -6))
      : MERCHANT_CAMPAIGN_START;
  const endsOn = today;
  const [bas, activity, campaignPos] = await Promise.all([getMerchantBAs(), getRunActivityData(run.id), getCampaignPos(run.campaign_id)]);
  const inRange = (value: string) => value >= startsOn && value <= endsOn;
  const visits = activity.visits.filter((item) => inRange(item.activity_date));
  const transactions = activity.transactions.filter((item) => inRange(item.occurred_at.slice(0, 10)));
  const attendance = activity.attendances.filter((item) => inRange(item.activity_date) && Boolean(item.checkin_at));
  const targets: MerchantTargetSettings = {
    campaign_pos_target: campaignPos.length,
    daily_pos_target: Number(run.daily_pos_target || 15),
    transactions_per_pos_target: Number(run.transactions_per_pos_target || 3),
  };
  const periodDays = Math.max(1, Math.round((new Date(`${endsOn}T12:00:00`).getTime() - new Date(`${startsOn}T12:00:00`).getTime()) / 86400000) + 1);
  const activeBas = new Set(attendance.map((item) => item.ba_id)).size;
  const targetVisits = Math.max(1, activeBas * targets.daily_pos_target * periodDays);
  const byBa = bas.map((ba) => {
    const baVisits = visits.filter((item) => item.ba_id === ba.id);
    const baTransactions = transactions.filter((item) => item.ba_id === ba.id);
    return {
      ...ba,
      pos: baVisits.length,
      transactions: baTransactions.length,
      amount: baTransactions.reduce((total, item) => total + Number(item.amount || 0), 0),
      firstArrival: baVisits.filter((item) => Boolean(item.visited_at)).sort((a, b) => new Date(a.visited_at as string).getTime() - new Date(b.visited_at as string).getTime())[0]?.visited_at || null,
    };
  }).filter((item) => item.pos > 0 || item.transactions > 0).sort((a, b) => b.pos - a.pos || b.transactions - a.transactions || a.name.localeCompare(b.name));
  const dates = Array.from({ length: periodDays }, (_, index) => addCalendarDays(startsOn, index));
  return {
    kind,
    startsOn,
    endsOn,
    targets,
    totals: {
      pos: visits.length,
      transactions: transactions.length,
      amount: transactions.reduce((total, item) => total + Number(item.amount || 0), 0),
      activeBas,
      executionRate: Math.min(100, Math.round((visits.length / targetVisits) * 100)),
    },
    byBa,
    daily: dates.map((date) => ({
      date,
      pos: visits.filter((item) => item.activity_date === date).length,
      transactions: transactions.filter((item) => item.occurred_at.slice(0, 10) === date).length,
      activeBas: new Set(attendance.filter((item) => item.activity_date === date).map((item) => item.ba_id)).size,
    })),
  };
}
