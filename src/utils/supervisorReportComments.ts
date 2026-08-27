import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabase';

export type SupervisorCommentCampaign = 'merchant' | 'privilege';
export type SupervisorCommentKind = 'daily' | 'weekly' | 'compiled';

interface SupervisorCommentRecord {
  comment: string;
  aiGenerated: boolean;
  updatedAt: string;
}

function client() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Configuration Supabase indisponible.');
  return createClient(config.url, config.anonKey, { auth: { persistSession: false } });
}

export async function getSupervisorReportComment(campaign: SupervisorCommentCampaign, kind: SupervisorCommentKind, startsOn: string, endsOn: string): Promise<SupervisorCommentRecord | null> {
  const { data, error } = await client()
    .from('campaign_supervisor_report_comments')
    .select('comment,ai_generated,updated_at')
    .eq('campaign_code', campaign)
    .eq('report_kind', kind)
    .eq('starts_on', startsOn)
    .eq('ends_on', endsOn)
    .maybeSingle();
  if (error) throw new Error(`Lecture du commentaire impossible : ${error.message}`);
  if (!data?.comment?.trim()) return null;
  return { comment: data.comment.trim(), aiGenerated: Boolean(data.ai_generated), updatedAt: data.updated_at };
}

export async function saveSupervisorReportComment(input: { campaign: SupervisorCommentCampaign; kind: SupervisorCommentKind; startsOn: string; endsOn: string; comment: string; aiGenerated?: boolean; userId?: string; sourceComments?: string[]; metrics?: Record<string, string | number> }): Promise<void> {
  const value = input.comment.trim();
  if (!value) throw new Error('Le commentaire du superviseur est requis avant l’export.');
  const { error } = await client().rpc('save_campaign_supervisor_report_comment', {
    p_campaign_code: input.campaign,
    p_report_kind: input.kind,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_comment: value,
    p_ai_generated: Boolean(input.aiGenerated),
    p_updated_by_user_id: input.userId || null,
    p_source_comments: input.sourceComments || [],
    p_metrics: input.metrics || {},
  });
  if (error) throw new Error(`Enregistrement du commentaire impossible : ${error.message}`);
}

export async function suggestSupervisorReportComment(input: { campaign: SupervisorCommentCampaign; kind: SupervisorCommentKind; startsOn: string; endsOn: string; userId?: string; metrics: Record<string, string | number>; agentComments: string[] }): Promise<string | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/supervisor-report-comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.anonKey },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({})) as { comment?: string | null };
  if (!response.ok || !data.comment?.trim()) return null;
  return data.comment.trim();
}
