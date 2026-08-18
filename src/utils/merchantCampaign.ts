import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BADailyAttendance,
  BATransaction,
  Campaign,
  CampaignRun,
  PointOfSale,
} from '../types';
import { getSupabaseConfig } from './supabase';

export const MERCHANT_CAMPAIGN_CODE = 'merchant-educational-campaign';

function getMerchantClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) throw new Error('La configuration Supabase est indisponible.');

  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
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
  const client = getMerchantClient();
  const { data, error } = await client
    .from('campaigns')
    .select('*')
    .eq('code', MERCHANT_CAMPAIGN_CODE)
    .maybeSingle();
  fail(error, 'Impossible de charger la campagne');
  return data as Campaign | null;
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
  const client = getMerchantClient();
  const { data, error } = await client
    .from('campaign_runs')
    .select('*')
    .eq('campaign_id', campaignId)
    .in('status', ['draft', 'active'])
    .order('starts_on', { ascending: false });
  fail(error, 'Impossible de charger les vagues de campagne');
  return (data || []) as CampaignRun[];
}

export async function getDailyAttendance(baId: string, runId: string, activityDate: string): Promise<BADailyAttendance | null> {
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
}

export async function getTransactionsForDay(baId: string, runId: string, activityDate: string): Promise<BATransaction[]> {
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

export async function getCampaignPos(campaignId: string, pool?: string): Promise<PointOfSale[]> {
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
}

export async function recordCheckin(input: Omit<BADailyAttendance, 'id' | 'created_at' | 'updated_at' | 'checkout_at' | 'checkout_latitude' | 'checkout_longitude' | 'checkout_accuracy_m' | 'closing_comment'>): Promise<BADailyAttendance> {
  const client = getMerchantClient();
  const { data, error } = await client
    .from('ba_daily_attendance')
    .upsert(input, { onConflict: 'campaign_run_id,ba_id,activity_date' })
    .select()
    .single();
  fail(error, 'Impossible d’enregistrer le pointage du matin');
  return data as BADailyAttendance;
}

export async function closeDailyAttendance(id: string, input: Pick<BADailyAttendance, 'checkout_at' | 'checkout_latitude' | 'checkout_longitude' | 'checkout_accuracy_m' | 'closing_comment' | 'status'>): Promise<BADailyAttendance> {
  const client = getMerchantClient();
  const { data, error } = await client
    .from('ba_daily_attendance')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  fail(error, 'Impossible de clôturer la journée');
  return data as BADailyAttendance;
}

export async function createTransaction(input: Omit<BATransaction, 'id' | 'created_at' | 'updated_at'>): Promise<BATransaction> {
  const client = getMerchantClient();
  const { data, error } = await client.from('ba_transactions').insert(input).select().single();
  fail(error, 'Impossible d’enregistrer la transaction');
  return data as BATransaction;
}

export async function uploadMerchantEvidence(campaignId: string, relativePath: string, file: Blob): Promise<string> {
  const client = getMerchantClient();
  const path = `${campaignId}/${relativePath}`;
  const { error } = await client.storage.from('ba-evidence').upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
  fail(error, 'Impossible de téléverser la preuve');
  return path;
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
