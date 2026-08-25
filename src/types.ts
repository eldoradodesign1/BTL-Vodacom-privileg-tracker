export type UserRole = 'agent' | 'supervisor' | 'sub_admin' | 'admin' | 'super_admin';

export type UserCategory = 'hostess' | 'brand_ambassador' | 'operations';
export type CampaignType = 'hostess' | 'brand_ambassador';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  password?: string;
  supervisorId?: string;
  permanentShopId: string;
  userCategory?: UserCategory;
  authUserId?: string;
  created_at?: string;
  last_login?: string;
}

export interface Campaign {
  id: string;
  code: string;
  name: string;
  campaign_type: CampaignType;
  status: 'draft' | 'active' | 'archived';
  starts_on?: string | null;
  ends_on?: string | null;
  daily_pos_target?: number | null;
  transactions_per_pos_target?: number | null;
}

export interface CampaignPause {
  id: string;
  campaign_id: string;
  starts_on: string;
  ends_on?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignRun {
  id: string;
  campaign_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: 'draft' | 'active' | 'closed' | 'archived';
  daily_pos_target: number;
  transactions_per_pos_target: number;
  campaign_pos_target?: number;
}

export interface PointOfSale {
  id: string;
  campaign_id: string;
  denomination: string;
  agent_number: string;
  address: string;
  activity?: string | null;
  mfs_name?: string | null;
  pool: 'Funa' | 'Mont amba' | 'Tshangu' | 'Lukunga';
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
}

export interface BADailyAssignment {
  id: string;
  campaign_run_id: string;
  activity_date: string;
  ba_id: string;
  pos_id: string;
  status: 'planned' | 'in_progress' | 'visited' | 'not_visited' | 'cancelled';
  source: 'manual' | 'csv' | 'xlsx';
  assigned_by?: string | null;
  origin_assignment_id?: string | null;
  carried_from_date?: string | null;
  carry_reason?: string | null;
  point_of_sale?: PointOfSale;
}

export interface BADailyAttendance {
  id: string;
  campaign_run_id: string;
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
  mfs_name?: string | null;
}

export interface BAPosVisit {
  id: string;
  daily_assignment_id?: string | null;
  campaign_run_id: string;
  ba_id: string;
  pos_id: string;
  activity_date: string;
  visited_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_m?: number | null;
  arrival_photo_path?: string | null;
  status: 'planned' | 'visited' | 'incomplete' | 'alerted' | 'not_visited';
  operational_status?: 'active' | 'inactive';
  operational_confirmed_at?: string | null;
  operational_note?: string | null;
  comment?: string | null;
  point_of_sale?: PointOfSale;
  transactions?: BATransaction[];
}

export interface BATransaction {
  id: string;
  campaign_run_id: string;
  ba_id: string;
  pos_id: string;
  pos_visit_id?: string | null;
  transaction_reference?: string | null;
  client_number?: string | null;
  amount: number;
  evidence_path: string;
  occurred_at: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_m?: number | null;
  comment?: string | null;
  status: 'recorded' | 'verified' | 'rejected';
  point_of_sale?: Pick<PointOfSale, 'agent_number' | 'denomination' | 'pool'>;
}

export interface Shop {
  id: string;
  name: string;
  city: string;
  lat?: number;
  long?: number;
  type: 'Airport' | 'Standard';
}

export interface Checkin {
  id: string;
  assignment_id?: string;
  agent_id: string;
  type: 'IN' | 'OUT';
  timestamp: string;
  lat: number;
  long: number;
  accuracy: number;
  photo?: string;
  photo_drive_url?: string;
  distance_m?: number;
  geo_status?: 'conforme' | 'hors_zone' | 'inconnu';
  device?: string;
  status: 'pending' | 'synced';
}

export interface Lead {
  id: string;
  timestamp: string;
  agent_id: string;
  shop_id: string;
  client_name: string;
  msisdn: string;
  action_type: 'Opt-in Privilège' | 'Opt-in Roaming' | 'Activation Bundle' | string;
  bundle_type?: string;
  amount?: number;
  status?: 'pending' | 'synced';
}

export interface DailyReport {
  id: string;
  date: string;
  agent_id: string;
  agent_name: string;
  shop_id: string;
  shop_name: string;
  priv: number;
  roam: number;
  bund: number;
  amount: number;
  comment: string;
  pdf_url?: string;
  photos?: string[];
  arrival_time?: string;
  departure_time?: string;
  pointage_photo?: string;
  maps_in?: string;
  maps_out?: string;
  drive_pdf_url?: string;
  report_photos_drive_urls?: string[];
}

export interface NotificationItem {
  deleted: any;
  id: string;
  user_id: string;
  message: string;
  type: string;
  is_read: boolean;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  message: string;
  timestamp: string;
  created_at?: string;
  deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  read_by?: string[];
}

export interface ShopTargets {
  privilege: number;
  roaming: number;
  bundle: number;
}

export interface AgentMasterStatus {
  id: string;
  name: string;
  phone: string;
  shop: string;
  shopId: string;
  status: 'Clôturé' | 'Présent' | 'Absent';
  trend: number[];
  reportUrl?: string;
  reportObj?: DailyReport;
  stats?: {
    priv: number;
    roam: number;
    bund: number;
  };
}
