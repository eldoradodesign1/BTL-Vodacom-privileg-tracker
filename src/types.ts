export type UserRole = 'agent' | 'supervisor' | 'admin';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  password?: string;
  supervisorId?: string;
  permanentShopId: string;
  created_at?: string;
  last_login?: string;
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
