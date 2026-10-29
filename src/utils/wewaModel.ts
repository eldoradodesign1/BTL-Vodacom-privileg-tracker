export const WEWA_CODE = 'activation-wewa';
// getRandomValues also works in an HTTP development preview.
export function wewaRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export type WewaMetric = 'registrations' | 'merchant_accounts' | 'app_installs';
export type IdentifierMode = 'either' | 'phone' | 'shortcode';
export interface WewaSettings {
  campaign_id: string;
  daily_registration_target: number;
  daily_merchant_target: number;
  daily_app_target: number;
  podium_metric: WewaMetric;
  identifier_mode: IdentifierMode;
  expected_in: string;
  expected_out: string;
}
export interface WewaStation {
  id: string; campaign_id: string; company: string; district: string; name: string;
  address: string | null; latitude: number | null; longitude: number | null; is_active: boolean;
}
export interface WewaRider {
  id: string; campaign_id: string; attendance_id: string; ba_id: string; station_id: string;
  activity_date: string; rider_name: string; phone: string | null; shortcode: string | null;
  had_mpesa_account: boolean; had_app: boolean; merchant_account_opened: boolean; app_installed: boolean;
  created_at?: string;
}
export interface WewaAttendance {
  id: string; campaign_id: string; ba_id: string; station_id: string; activity_date: string;
  status: 'open' | 'closed'; checkin_at: string; checkin_photo?: string;
  checkin_latitude: number; checkin_longitude: number; checkout_at: string | null; closing_comment: string | null;
}
export interface WewaReportRow {
  id: string; ba_id: string; agent: string; station_id: string; station: string; district: string;
  activity_date: string; had_mpesa_account: boolean; had_app: boolean;
  merchant_account_opened: boolean; app_installed: boolean;
}
export interface WewaReport {
  records: WewaReportRow[];
  attendance: Array<{ ba_id: string; agent: string; station_id: string; station: string; district: string; activity_date: string; status: string }>;
  settings: WewaSettings;
}
export const WEWA_METRICS: Record<WewaMetric, string> = {
  registrations: 'Motards enregistrés', merchant_accounts: 'Comptes marchands ouverts', app_installs: 'Applications installées',
};
export const wewaToday = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function normalizeWewaPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00243')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = '243' + digits.slice(1);
  else if (digits.length === 9) digits = '243' + digits;
  return /^243\d{9}$/.test(digits) ? '+' + digits : '';
}
export function wewaStats(rows: ReadonlyArray<Pick<WewaRider, 'merchant_account_opened' | 'app_installed'>>) {
  return { registrations: rows.length, merchant_accounts: rows.filter(r => r.merchant_account_opened).length, app_installs: rows.filter(r => r.app_installed).length };
}
export function wewaRank(rows: WewaReportRow[], metric: WewaMetric) {
  const agents = new Map<string, { id: string; name: string; rows: WewaReportRow[] }>();
  rows.forEach(row => { const entry = agents.get(row.ba_id) ?? { id: row.ba_id, name: row.agent, rows: [] }; entry.rows.push(row); agents.set(row.ba_id, entry); });
  return Array.from(agents.values()).map(entry => ({ id: entry.id, name: entry.name, ...wewaStats(entry.rows) }))
    .sort((a, b) => b[metric] - a[metric] || b.registrations - a.registrations || a.name.localeCompare(b.name, 'fr'));
}
