export type UserRole = 'agent' | 'supervisor' | 'sub_admin' | 'admin' | 'super_admin';

export type UserCategory = 'hostess' | 'brand_ambassador' | 'operations';
export type CampaignType = 'hostess' | 'brand_ambassador';
export type CampaignContext = 'vodacom-privilege' | 'merchant-educational' | 'youth-f2f' | 'mpesa-mikili';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  password?: string;
  supervisorId?: string;
  permanentShopId: string | null;
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

export interface YouthUniversity {
  id: string;
  campaign_id: string;
  code: string;
  name: string;
  commune?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_validation_status: 'pending' | 'validated';
  source_url?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface YouthDailyAssignment {
  id: string;
  campaign_id: string;
  ba_id: string;
  university_id: string;
  activity_date: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string | null;
  assigned_by?: string | null;
  university?: YouthUniversity;
}

export interface YouthDailyAttendance {
  id: string;
  campaign_id: string;
  daily_assignment_id?: string | null;
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

export interface CampaignPause {
  id: string;
  campaign_id: string;
  starts_on: string;
  ends_on?: string | null;
  reason: string;
}
