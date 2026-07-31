import { User, Shop, Lead, DailyReport, NotificationItem, ChatMessage, Checkin } from '../types';

export const INITIAL_SHOPS: Shop[] = [
  { id: 'S001', name: "Shop Vodacom Gombe (30 Juin)", city: "Kinshasa", lat: -4.3033, long: 15.3015, type: 'Standard' },
  { id: 'S002', name: "Shop Vodacom Aéroport N'djili", city: "Kinshasa", lat: -4.3856, long: 15.4447, type: 'Airport' },
  { id: 'S003', name: "Shop Vodacom Limete", city: "Kinshasa", lat: -4.3541, long: 15.3412, type: 'Standard' },
  { id: 'S004', name: "Shop Vodacom Kintambo", city: "Kinshasa", lat: -4.3167, long: 15.2667, type: 'Standard' },
  { id: 'S005', name: "Shop Vodacom Matete", city: "Kinshasa", lat: -4.3889, long: 15.3611, type: 'Standard' },
  { id: 'S006', name: "Shop Vodacom Bandalungwa", city: "Kinshasa", lat: -4.3444, long: 15.2833, type: 'Standard' },
  { id: 'S007', name: "Shop Vodacom Masina", city: "Kinshasa", lat: -4.3917, long: 15.4111, type: 'Standard' },
  { id: 'S008', name: "Shop Vodacom Victoire (Kalamu)", city: "Kinshasa", lat: -4.3389, long: 15.3139, type: 'Standard' },
  { id: 'S009', name: "Shop Vodacom Huileries", city: "Kinshasa", lat: -4.3194, long: 15.3083, type: 'Standard' }
];

export const INITIAL_USERS: User[] = [
  { id: '0a6a2520-96bb-474d-87b6-b0eb8fc46cd6', phone: '0896332431', name: 'Eldo Bitulu', role: 'admin', permanentShopId: 'S001' },
  { id: 'adm-0001-4a11-a881-100000000001', phone: '0816701000', name: 'Bradley Izamaboko', role: 'admin', permanentShopId: 'S001' },
  { id: 'usr-8d3144f8', phone: '0810933351', name: 'Ruth Mafuta', role: 'admin', permanentShopId: 'S001' },
  { id: 'sup-0001-4a11-a881-100000000001', phone: '0812923941', name: 'Hervé Ntalu', role: 'supervisor', permanentShopId: 'S001' },
  { id: 'sup-0002-4a11-a881-100000000002', phone: '0810000001', name: 'Supervisor', role: 'supervisor', permanentShopId: 'S002' },
  { id: 'agt-0001-4a11-a881-200000000001', phone: '0821000001', name: 'Agent', role: 'agent', supervisorId: 'sup-0002-4a11-a881-100000000002', permanentShopId: 'S002' },
  { id: 'agt-0001-4a11-a881-200000000002', phone: '0821000002', name: 'Agent2', role: 'agent', supervisorId: 'sup-0002-4a11-a881-100000000002', permanentShopId: 'S002' },
  { id: 'agt-0001-4a11-a881-200000000004', phone: '0827666847', name: 'Djenny Fondo', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S001' },
  { id: 'agt-0001-4a11-a881-200000000005', phone: '0824895691', name: 'Harmonie Mbelani', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S001' },
  { id: 'agt-0001-4a11-a881-200000000006', phone: '0818974304', name: 'Theresianne Mbongo', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S002' },
  { id: 'agt-0001-4a11-a881-200000000007', phone: '0820877751', name: 'Grâce Nsiabamfumu Masiala', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S003' },
  { id: 'agt-0001-4a11-a881-200000000008', phone: '0813122553', name: 'Deborah Kenkani', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S004' },
  { id: 'agt-0001-4a11-a881-200000000009', phone: '0994691450', name: 'Vanessa Mpununu', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S005' },
  { id: 'agt-0001-4a11-a881-200000000010', phone: '0859371721', name: 'Ikali Ruth', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S006' },
  { id: 'agt-0001-4a11-a881-200000000011', phone: '0984991264', name: 'Ngwende Eurêka Grâce', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S007' },
  { id: 'agt-0001-4a11-a881-200000000012', phone: '0830035167', name: 'Christvie Lilenda', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S008' },
  { id: 'agt-0001-4a11-a881-200000000013', phone: '0990000036', name: 'Priskette Tshingila', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S009' },
  { id: 'agt-0001-4a11-a881-200000000014', phone: '0863318913', name: 'Keren Bonkuta', role: 'agent', supervisorId: 'sup-0001-4a11-a881-100000000001', permanentShopId: 'S009' }
];

export const INITIAL_CHECKINS: Checkin[] = [];
export const INITIAL_LEADS: Lead[] = [];
export const INITIAL_REPORTS: DailyReport[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_CHAT: ChatMessage[] = [];
