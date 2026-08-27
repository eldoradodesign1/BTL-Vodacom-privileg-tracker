import { getSupabaseClient, getSupabaseConfig } from './supabase';

export type SupervisorReportKind = 'daily' | 'weekly' | 'compiled';

export interface SupervisorReportComment {
  comment: string;
  aiGenerated: boolean;
  updatedAt: string;
}

export function cleanSupervisorComment(value: string | null | undefined): string {
  return (value || '')
    .replace(/^\s*(process|summary|synthèse|analyse|commentaire)\s*[:\-*#]+\s*/i, '')
    .replace(/\*{1,3}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function needsFrenchRewrite(value: string | null | undefined): boolean {
  const normalized = cleanSupervisorComment(value).toLowerCase();
  return /\b(not contacted|beforehand|unaware|merchant numbers|pricing mismatch|pricing|mismatch|articles?\s*>|merchants?\s+not)\b/.test(normalized);
}

export async function getMerchantSupervisorComment(startDate: string, endDate: string): Promise<SupervisorReportComment | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('campaign_supervisor_report_comments')
    .select('comment, ai_generated, updated_at')
    .eq('campaign_code', 'merchant')
    .eq('report_kind', 'compiled')
    .eq('starts_on', startDate)
    .eq('ends_on', endDate)
    .maybeSingle();
  if (error) throw new Error(`Lecture du commentaire impossible : ${error.message}`);
  const comment = cleanSupervisorComment(data?.comment);
  return comment ? { comment, aiGenerated: Boolean(data?.ai_generated), updatedAt: data?.updated_at || '' } : null;
}

export async function saveMerchantSupervisorComment(input: {
  startDate: string;
  endDate: string;
  comment: string;
  aiGenerated: boolean;
  agentComments: string[];
  metrics: Record<string, number>;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Configuration Supabase indisponible.');
  const comment = cleanSupervisorComment(input.comment);
  if (!comment) throw new Error('Le commentaire du superviseur est requis avant l’export.');
  const { error } = await client.rpc('save_campaign_supervisor_report_comment', {
    p_campaign_code: 'merchant',
    p_report_kind: 'compiled',
    p_starts_on: input.startDate,
    p_ends_on: input.endDate,
    p_comment: comment,
    p_ai_generated: input.aiGenerated,
    p_updated_by_user_id: null,
    p_source_comments: input.agentComments,
    p_metrics: input.metrics,
  });
  if (error) throw new Error(`Enregistrement du commentaire impossible : ${error.message}`);
}

export async function suggestMerchantSupervisorComment(input: {
  startDate: string;
  endDate: string;
  metrics: Record<string, number>;
  agentComments: string[];
}): Promise<string | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/supervisor-report-comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.anonKey },
    body: JSON.stringify({ campaign: 'merchant', kind: 'compiled', startsOn: input.startDate, endsOn: input.endDate, metrics: input.metrics, agentComments: input.agentComments }),
  });
  const body = await response.json().catch(() => ({})) as { comment?: string };
  return response.ok ? cleanSupervisorComment(body.comment) || null : null;
}
