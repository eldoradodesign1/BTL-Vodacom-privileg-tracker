import { User, UserRole, Shop, Checkin, Lead, DailyReport, NotificationItem, ChatMessage, ShopTargets, AgentMasterStatus } from '../types';
import { INITIAL_SHOPS, INITIAL_USERS, INITIAL_CHECKINS, INITIAL_LEADS, INITIAL_REPORTS, INITIAL_NOTIFICATIONS, INITIAL_CHAT } from '../data/initialData';
import { buildAgentReportHtml, generateAgentPDF, PDFReportData } from './pdfGenerator';
import { pushToGoogleSheetWebhook, getGSheetConfig, syncFromGoogleSheetUrl } from './googleSheetsSync';

const STORAGE_KEYS = {
  USERS: 'vodacom_users_v6',
  SHOPS: 'vodacom_shops_v6',
  CHECKINS: 'vodacom_checkins_v6',
  LEADS: 'vodacom_leads_v6',
  REPORTS: 'vodacom_reports_v6',
  NOTIFS: 'vodacom_notifs_v6',
  CHAT: 'vodacom_chat_v6',
  CURRENT_USER: 'vodacom_user',
  ACTIVE_SHOP_ID: 'active_shop_id',
  ACTIVE_SHOP_NAME: 'active_shop_name'
};

export const DRIVE_FOLDERS = {
  REPORTS_FOLDER_URL: 'https://drive.google.com/drive/folders/1gYV6G84pJ0WyrVSmmk2-969ZJt9s1LBq?usp=drive_link',
  PHOTOS_FOLDER_URL: 'https://drive.google.com/drive/folders/1AVox_j8VMle_cDdDZrM-g0x7E7GkREtv?usp=drive_link',
  REPORTS_PHOTOS_URL: 'https://drive.google.com/drive/folders/1Xer27VuJuhd1C3DNJ9nyWhzDLaYPKRIS?usp=drive_link'
};

function pushNotification(userId: string, message: string, type: string): NotificationItem {
  const notifs = loadItem<NotificationItem[]>(STORAGE_KEYS.NOTIFS, INITIAL_NOTIFICATIONS);
  const item: NotificationItem = {
    id: generateUUID(),
    user_id: userId,
    message,
    type,
    is_read: false,
    timestamp: new Date().toISOString()
  };
  notifs.unshift(item);
  saveItem(STORAGE_KEYS.NOTIFS, notifs);
  return item;
}

function findSupervisorForAgent(agentId: string): User | undefined {
  const users = getUsers();
  const agent = users.find(u => u.id === agentId);
  if (!agent?.supervisorId) return undefined;
  return users.find(u => u.id === agent.supervisorId);
}

function getAllAdmins(): User[] {
  return getUsers().filter(u => u.role === 'admin');
}

export function getSyncPendingCount(): number {
  const pendingLeads = getLeads().filter(l => l.status === 'pending').length;
  const pendingCheckins = getCheckins().filter(c => c.status === 'pending').length;
  return pendingLeads + pendingCheckins;
}

export function runScheduledDailyReminders(now: Date = new Date()): void {
  const key = `vodacom_last_reminders_${toISO(now)}`;
  const sent = loadItem<Record<string, boolean>>(key, {});
  const hh = now.getHours();
  const mm = now.getMinutes();
  const users = getUsers().filter(u => u.role === 'agent');

  const maybeSend = (id: string, shouldSend: boolean, message: string, type: string) => {
    if (!shouldSend || sent[id]) return;
    pushNotification(id, message, type);
    sent[id] = true;
  };

  users.forEach(agent => {
    const status = checkDailyStatus(agent.id, toISO(now));
    maybeSend(
      `${agent.id}_845_checkin`,
      hh === 8 && mm >= 45 && mm < 55 && !status.checkinDone,
      'Rappel: veuillez effectuer votre pointage d\'arrivee avant 08:55.',
      'reminder-checkin'
    );
    maybeSend(
      `${agent.id}_855_checkin_urgent`,
      hh === 8 && mm >= 55 && !status.checkinDone,
      'URGENT: pointage non effectue. Merci de pointer immediatement.',
      'reminder-checkin-urgent'
    );
    maybeSend(
      `${agent.id}_1745_report`,
      hh === 17 && mm >= 45 && !status.reportDone,
      'Rappel cloture: merci de generer et envoyer votre rapport journalier.',
      'reminder-report'
    );
  });

  saveItem(key, sent);
}

// In-memory cache for heavy PDF Data URLs to avoid exceeding localStorage quota (5MB limit)
const pdfCache = new Map<string, string>();

// One-time automatic cache purge to disconnect active user session and purge residual mock data
(function autoPurgeOldMockCache() {
  try {
    const HAS_PURGED = localStorage.getItem('vodacom_purged_v6');
    if (!HAS_PURGED) {
      pdfCache.clear();
      localStorage.clear();
      localStorage.setItem('vodacom_purged_v6', 'true');
    }
  } catch (err) {
    console.warn('Auto purge exception:', err);
  }
})();

export function purgeAndResetEverything(): void {
  try {
    pdfCache.clear();
    localStorage.clear();
    saveItem(STORAGE_KEYS.LEADS, []);
    saveItem(STORAGE_KEYS.REPORTS, []);
    saveItem(STORAGE_KEYS.CHECKINS, []);
    saveItem(STORAGE_KEYS.NOTIFS, []);
    saveItem(STORAGE_KEYS.CHAT, []);
    saveItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    saveItem(STORAGE_KEYS.SHOPS, INITIAL_SHOPS);
    localStorage.setItem('vodacom_purged_v6', 'true');
  } catch (e) {
    console.error('Error during full purge:', e);
  }
}

function loadItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveItem<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage save quota notice, sanitizing items:', e);
    try {
      if (Array.isArray(data)) {
        const cleaned = data.map(item => {
          if (typeof item === 'object' && item !== null) {
            const copy: any = { ...item };
            if ('pdf_url' in copy) delete copy.pdf_url;
            if ('photo' in copy && typeof copy.photo === 'string' && copy.photo.length > 1000) {
              delete copy.photo;
            }
            if ('photos' in copy && Array.isArray(copy.photos)) {
              delete copy.photos;
            }
            return copy;
          }
          return item;
        });
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    } catch (err2) {
      console.error('Critical storage fallback error:', err2);
    }
  }
}

export function toISO(dateVal?: Date | string): string {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (trimmed.includes('T')) return trimmed.split('T')[0];
    const firstPart = trimmed.split(' ')[0];
    if (firstPart.includes('-')) {
      const parts = firstPart.split('-');
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
    if (firstPart.includes('/')) {
      const parts = firstPart.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.substring(0, 10);
    }
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {}
  } else if (dateVal instanceof Date) {
    try {
      return dateVal.toISOString().split('T')[0];
    } catch {}
  }
  return new Date().toISOString().split('T')[0];
}

// --- USERS ---
export function getUsers(): User[] {
  return loadItem(STORAGE_KEYS.USERS, INITIAL_USERS);
}

export function saveUsers(users: User[]): void {
  saveItem(STORAGE_KEYS.USERS, users);
}

export function saveUser(user: Omit<User, 'id'>): User {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: 'usr-' + Math.random().toString(36).substring(2, 9),
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  saveItem(STORAGE_KEYS.USERS, users);

  if (newUser.role === 'agent' && newUser.supervisorId) {
    const sup = users.find(u => u.id === newUser.supervisorId);
    if (sup) {
      pushNotification(
        sup.id,
        `Nouvel agent cree et assigne a votre equipe: ${newUser.name}.`,
        'agent-created'
      );
    }
  }

  return newUser;
}

export function updateUserShopAssignment(userId: string, shopId: string): boolean {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index !== -1) {
    const before = users[index];
    users[index].permanentShopId = shopId;
    saveItem(STORAGE_KEYS.USERS, users);

    const shop = getShopById(shopId);
    if (before.role === 'agent') {
      pushNotification(
        before.id,
        `Nouvelle affectation shop: ${shop?.name || shopId}.`,
        'assignment-shop'
      );
      if (before.supervisorId) {
        pushNotification(
          before.supervisorId,
          `Affectation mise a jour pour ${before.name}: ${shop?.name || shopId}.`,
          'assignment-agent'
        );
      }
    }

    return true;
  }
  return false;
}

export function updateUserSupervisor(userId: string, supervisorId: string): boolean {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index !== -1) {
    users[index].supervisorId = supervisorId;
    saveItem(STORAGE_KEYS.USERS, users);

    const target = users[index];
    if (target.role === 'agent') {
      pushNotification(
        target.id,
        'Votre superviseur de reference a ete mis a jour.',
        'assignment-supervisor'
      );
      pushNotification(
        supervisorId,
        `Un agent vous est maintenant assigne: ${target.name}.`,
        'assignment-agent'
      );
    }

    return true;
  }
  return false;
}

export function getDefaultPasswordForRole(role: UserRole): string {
  if (role === 'admin') return 'admin';
  if (role === 'supervisor') return 'test';
  return 'password';
}

function doesProvidedPasswordMatch(user: User, providedRaw: string): boolean {
  const provided = providedRaw.trim();
  if (!provided) return false;

  const customPass = user.password ? user.password.trim() : '';
  if (customPass.length > 0) {
    // If a custom password exists for the user, only this secret is valid.
    return provided === customPass;
  }

  // Fallback only for legacy users without explicit password.
  const defaultPass = getDefaultPasswordForRole(user.role);
  return provided === defaultPass;
}

export function updateUserPassword(userId: string, oldPass: string, newPass: string): { success: boolean; message: string } {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    return { success: false, message: "Utilisateur introuvable." };
  }
  if (!doesProvidedPasswordMatch(users[index], oldPass)) {
    return { success: false, message: "L'ancienne clé de sécurité est incorrecte." };
  }
  const cleanNew = newPass.trim();
  if (cleanNew.length < 4) {
    return { success: false, message: "La nouvelle clé doit contenir au moins 4 caractères." };
  }

  users[index].password = cleanNew;
  saveItem(STORAGE_KEYS.USERS, users);

  // Persist password changes to Users sheet through Apps Script webhook.
  pushToGoogleSheetWebhook({
    type: 'user-update',
    data: {
      id: users[index].id,
      phone: users[index].phone,
      name: users[index].name,
      role: users[index].role,
      supervisorId: users[index].supervisorId || '',
      permanentShopId: users[index].permanentShopId,
      password: users[index].password,
      updated_at: new Date().toISOString()
    }
  }).then(() => {
    const cfg = getGSheetConfig();
    if (cfg.sheetCsvUrl) {
      syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
    }
  }).catch(() => {});

  return { success: true, message: "Clé de sécurité mise à jour avec succès !" };
}

export function normalizePhoneMSISDN(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^\d]/g, '');
  if (clean.startsWith('243')) clean = '0' + clean.substring(3);
  if (clean.length === 9 && !clean.startsWith('0')) clean = '0' + clean;
  return clean;
}

export function authenticate(phone: string, password_hash: string): { success: boolean; user?: User; message?: string } {
  const users = getUsers();
  const targetPhone = normalizePhoneMSISDN(phone);
  const cleanRaw = phone.trim().toLowerCase();

  const found = users.find(u => {
    const uNorm = normalizePhoneMSISDN(u.phone);
    const uRaw = u.phone.trim().replace(/[\s\-\.]/g, '');
    return (
      (targetPhone && uNorm === targetPhone) ||
      (cleanRaw && uRaw === cleanRaw) ||
      (cleanRaw && u.id.toLowerCase() === cleanRaw) ||
      (cleanRaw && u.name.toLowerCase().includes(cleanRaw))
    );
  });

  if (!found) {
    return { success: false, message: "Identifiants incorrects (MSISDN non enregistré)." };
  }
  
  const isMatch = doesProvidedPasswordMatch(found, password_hash);

  if (!isMatch) {
    return { success: false, message: `Mot de passe / Clé de sécurité incorrecte pour le compte ${found.role.toUpperCase()}.` };
  }
  return { success: true, user: found };
}

// --- SHOPS ---
export function getShops(): Shop[] {
  return loadItem(STORAGE_KEYS.SHOPS, INITIAL_SHOPS);
}

export function saveShops(shops: Shop[]): void {
  saveItem(STORAGE_KEYS.SHOPS, shops);
}

export function saveShop(name: string, city: string, type: 'Airport' | 'Standard'): Shop {
  const shops = getShops();
  const newShop: Shop = {
    id: 'shp-' + Math.random().toString(36).substring(2, 9),
    name,
    city,
    type
  };
  shops.push(newShop);
  saveItem(STORAGE_KEYS.SHOPS, shops);

  getUsers()
    .filter(u => u.role === 'supervisor')
    .forEach(sup => {
      pushNotification(sup.id, `Nouveau shop cree: ${newShop.name} (${newShop.city}).`, 'shop-created');
    });

  return newShop;
}

export function getShopById(shopId: string): Shop | undefined {
  return getShops().find(s => s.id === shopId);
}

export function getTargetsByShop(shopId: string): ShopTargets {
  const shop = getShopById(shopId);
  const isAirport = shop && shop.type === 'Airport';
  if (isAirport) {
    return { privilege: 10, roaming: 15, bundle: 20 };
  }
  return { privilege: 20, roaming: 3, bundle: 20 };
}

// --- CHECKINS ---
export function getCheckins(): Checkin[] {
  const items: Checkin[] = loadItem(STORAGE_KEYS.CHECKINS, INITIAL_CHECKINS);
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addCheckin(checkinData: Omit<Checkin, 'id'>): Checkin {
  const checkins = getCheckins();
  const newCheckin: Checkin = {
    ...checkinData,
    id: generateUUID()
  };
  checkins.unshift(newCheckin);
  saveItem(STORAGE_KEYS.CHECKINS, checkins);
  pushToGoogleSheetWebhook({
    type: 'checkin',
    data: newCheckin,
    folders: {
      photos: DRIVE_FOLDERS.PHOTOS_FOLDER_URL
    }
  }).then(() => {
    const cfg = getGSheetConfig();
    if (cfg.sheetCsvUrl) {
      syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
    }
  }).catch(() => {});
  return newCheckin;
}

export function checkDailyStatus(agentId: string, dateISO: string) {
  const checkins = getCheckins();
  const reports = getReports();

  const targetDate = toISO(dateISO);
  const hasCheckin = checkins.some(r => r.agent_id === agentId && toISO(r.timestamp) === targetDate);
  const hasReport = reports.some(r => r.agent_id === agentId && toISO(r.date) === targetDate);

  return { checkinDone: hasCheckin, reportDone: hasReport };
}

export function getTodayCheckinPhoto(agentId: string): string | null {
  const checkins = getCheckins();
  const today = toISO(new Date());
  const found = checkins.find(r => r.agent_id === agentId && toISO(r.timestamp) === today && r.type === 'IN');
  if (!found?.photo) return null;

  const raw = found.photo;
  if (raw.startsWith('data:image') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (raw.length > 10 && !raw.includes(' ')) {
    return `https://drive.google.com/uc?id=${raw}`;
  }
  return raw;
}

// --- LEADS ---
export function getLeads(): Lead[] {
  const items: Lead[] = loadItem(STORAGE_KEYS.LEADS, INITIAL_LEADS);
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function saveLeads(leads: Lead[]): void {
  saveItem(STORAGE_KEYS.LEADS, leads);
}

export function saveReports(reports: DailyReport[]): void {
  saveItem(STORAGE_KEYS.REPORTS, reports);
}

export function saveCheckins(checkins: Checkin[]): void {
  saveItem(STORAGE_KEYS.CHECKINS, checkins);
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function addLead(leadData: Omit<Lead, 'id'>): Lead {
  if (!leadData.client_name?.trim()) {
    throw new Error('Le nom client est obligatoire.');
  }
  if (!leadData.msisdn?.trim()) {
    throw new Error('Le numero client est obligatoire.');
  }

  const leads = getLeads();
  const newLead: Lead = {
    ...leadData,
    id: generateUUID()
  };
  leads.unshift(newLead);
  saveItem(STORAGE_KEYS.LEADS, leads);
  pushToGoogleSheetWebhook({ type: 'lead', data: newLead }).then(() => {
    const cfg = getGSheetConfig();
    if (cfg.sheetCsvUrl) {
      syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
    }
  }).catch(() => {});
  return newLead;
}

// --- REPORTS ---
export function getReports(): DailyReport[] {
  const rawReports: DailyReport[] = loadItem(STORAGE_KEYS.REPORTS, INITIAL_REPORTS);
  const reports = rawReports.map(r => ({
    ...r,
    pdf_url: pdfCache.get(r.id) || r.pdf_url
  }));
  return reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function addReport(reportData: Omit<DailyReport, 'id'>): DailyReport {
  const reports = getReports();
  const newId = 'rep-' + Math.random().toString(36).substring(2, 9);

  if (reportData.pdf_url) {
    pdfCache.set(newId, reportData.pdf_url);
  }

  const newReport: DailyReport = {
    ...reportData,
    id: newId
  };

  reports.push(newReport);

  // Strip heavy pdf_url from localStorage payload to keep key size minimal (<10KB)
  const sanitizedReports = reports.map(r => {
    const copy = { ...r };
    delete copy.pdf_url;
    return copy;
  });

  saveItem(STORAGE_KEYS.REPORTS, sanitizedReports);
  pushToGoogleSheetWebhook({
    type: 'report',
    data: newReport,
    folders: {
      reports: DRIVE_FOLDERS.REPORTS_FOLDER_URL,
      reportPhotos: DRIVE_FOLDERS.REPORTS_PHOTOS_URL
    }
  }).then(() => {
    const cfg = getGSheetConfig();
    if (cfg.sheetCsvUrl) {
      syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
    }
  }).catch(() => {});

  const supervisor = findSupervisorForAgent(newReport.agent_id);
  if (supervisor) {
    pushNotification(
      supervisor.id,
      `${newReport.agent_name} a envoye son rapport du ${newReport.date}.`,
      'report-submitted'
    );
  }
  getAllAdmins().forEach(admin => {
    pushNotification(
      admin.id,
      `Rapport recu: ${newReport.agent_name} (${newReport.shop_name}) - ${newReport.date}.`,
      'report-submitted'
    );
  });

  return newReport;
}

/**
 * On-demand PDF fetcher/generator.
 * If cached in memory, returns immediately.
 * Otherwise, reconstructs PDF data and generates PDF on the fly.
 */
export async function getReportPdf(report: DailyReport): Promise<string> {
  if (report.drive_pdf_url && report.drive_pdf_url.startsWith('http')) {
    return report.drive_pdf_url;
  }

  if (pdfCache.has(report.id)) {
    return pdfCache.get(report.id)!;
  }
  if (report.pdf_url && report.pdf_url.startsWith('data:')) {
    pdfCache.set(report.id, report.pdf_url);
    return report.pdf_url;
  }

  const shopObj = getShopById(report.shop_id);
  const targets = getTargetsByShop(report.shop_id);
  const allLeads = getLeads();
  const allCheckins = getCheckins();
  const reportLeads = allLeads.filter(l => l.agent_id === report.agent_id && toISO(l.timestamp) === toISO(report.date));
  const pointageIn = allCheckins.find(c => c.agent_id === report.agent_id && toISO(c.timestamp) === toISO(report.date) && c.type === 'IN');
  const pointagePhoto = pointageIn?.photo || report.pointage_photo || '';

  const generatedUrl = await generateAgentPDF({
    agentName: report.agent_name,
    shopName: report.shop_name || shopObj?.name || 'Vodacom Shop',
    date: report.date,
    arrivalTime: report.arrival_time || '08:00',
    departureTime: report.departure_time || '17:30',
    mapsIn: report.maps_in || `https://www.google.com/maps/search/?api=1&query=${shopObj?.lat || -4.3033},${shopObj?.long || 15.3015}`,
    mapsOut: report.maps_out || `https://www.google.com/maps/search/?api=1&query=${shopObj?.lat || -4.3033},${shopObj?.long || 15.3015}`,
    totalPrivilege: report.priv,
    totalRoaming: report.roam,
    totalBundles: report.bund,
    targets,
    leads: reportLeads.map(l => ({
      timestamp: l.timestamp,
      client_name: l.client_name,
      msisdn: l.msisdn,
      action_type: l.action_type
    })),
    pointagePhoto,
    photos: report.photos || [],
    comment: report.comment || ''
  });

  pdfCache.set(report.id, generatedUrl);

  // If report has no Drive URL yet, push generated PDF for remote save and future preview.
  const pushed = await pushToGoogleSheetWebhook({
    type: 'report',
    data: {
      ...report,
      pdf_url: generatedUrl,
      pointage_photo: pointagePhoto
    },
    folders: {
      reports: DRIVE_FOLDERS.REPORTS_FOLDER_URL,
      reportPhotos: DRIVE_FOLDERS.REPORTS_PHOTOS_URL
    }
  }).catch(() => false);

  if (pushed) {
    const updated = getReports().find(r => r.id === report.id);
    if (updated?.drive_pdf_url && updated.drive_pdf_url.startsWith('http')) {
      return updated.drive_pdf_url;
    }
  }

  if (pushed) {
    const cfg = getGSheetConfig();
    if (cfg.sheetCsvUrl) {
      syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
    }
  }

  return generatedUrl;
}

function buildReportPreviewData(report: DailyReport): PDFReportData {
  const shopObj = getShopById(report.shop_id);
  const targets = getTargetsByShop(report.shop_id);
  const allLeads = getLeads();
  const allCheckins = getCheckins();
  const reportLeads = allLeads.filter(l => l.agent_id === report.agent_id && toISO(l.timestamp) === toISO(report.date));
  const pointageIn = allCheckins.find(c => c.agent_id === report.agent_id && toISO(c.timestamp) === toISO(report.date) && c.type === 'IN');

  return {
    agentName: report.agent_name,
    shopName: report.shop_name || shopObj?.name || 'Vodacom Shop',
    date: report.date,
    arrivalTime: report.arrival_time || '08:00',
    departureTime: report.departure_time || '17:30',
    mapsIn: report.maps_in || `https://www.google.com/maps/search/?api=1&query=${shopObj?.lat || -4.3033},${shopObj?.long || 15.3015}`,
    mapsOut: report.maps_out || `https://www.google.com/maps/search/?api=1&query=${shopObj?.lat || -4.3033},${shopObj?.long || 15.3015}`,
    totalPrivilege: report.priv,
    totalRoaming: report.roam,
    totalBundles: report.bund,
    targets,
    leads: reportLeads.map(l => ({
      timestamp: l.timestamp,
      client_name: l.client_name,
      msisdn: l.msisdn,
      action_type: l.action_type
    })),
    pointagePhoto: report.pointage_photo || pointageIn?.photo || '',
    photos: report.photos || [],
    comment: report.comment || ''
  };
}

export function getReportPreviewHtml(report: DailyReport): string {
  return buildAgentReportHtml(buildReportPreviewData(report));
}

// --- NOTIFICATIONS ---
export function getNotifications(userId: string): NotificationItem[] {
  const notifs: NotificationItem[] = loadItem(STORAGE_KEYS.NOTIFS, INITIAL_NOTIFICATIONS);
  return notifs.filter(n => n.user_id === userId);
}

export function markNotifsAsRead(userId: string): void {
  const notifs: NotificationItem[] = loadItem(STORAGE_KEYS.NOTIFS, INITIAL_NOTIFICATIONS);
  const updated = notifs.map(n => n.user_id === userId ? { ...n, is_read: true } : n);
  saveItem(STORAGE_KEYS.NOTIFS, updated);
}

export function clearNotifications(userId: string): void {
  const notifs: NotificationItem[] = loadItem(STORAGE_KEYS.NOTIFS, INITIAL_NOTIFICATIONS);
  const updated = notifs.filter(n => n.user_id !== userId);
  saveItem(STORAGE_KEYS.NOTIFS, updated);
}

// --- CHAT ---
export function getChatMessages(): ChatMessage[] {
  return loadItem(STORAGE_KEYS.CHAT, INITIAL_CHAT).filter(m => !m.deleted);
}

export function sendChatMessage(sender: User, message: string): ChatMessage {
  const msgs = getChatMessages();
  const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const users = getUsers();
  const recipients = users.filter(u => u.id !== sender.id).map(u => u.id);
  const newMsg: ChatMessage = {
    id: 'msg-' + Math.random().toString(36).substring(2, 9),
    sender_id: sender.id,
    sender_name: sender.name,
    sender_role: sender.role,
    message,
    timestamp: timeStr,
    created_at: new Date().toISOString(),
    read_by: [sender.id]
  };
  msgs.push(newMsg);
  saveItem(STORAGE_KEYS.CHAT, msgs);

  if (sender.role === 'admin') {
    recipients.forEach(uid => {
      pushNotification(uid, `Nouveau message admin de ${sender.name}.`, 'chat-admin');
    });
  }

  return newMsg;
}

export function deleteChatMessage(messageId: string, actor: User): boolean {
  if (actor.role !== 'admin') return false;
  const msgs = loadItem<ChatMessage[]>(STORAGE_KEYS.CHAT, INITIAL_CHAT);
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx === -1) return false;
  msgs[idx] = {
    ...msgs[idx],
    deleted: true,
    deleted_by: actor.id,
    deleted_at: new Date().toISOString()
  };
  saveItem(STORAGE_KEYS.CHAT, msgs);
  return true;
}

export function markChatAsRead(userId: string): void {
  const msgs = loadItem<ChatMessage[]>(STORAGE_KEYS.CHAT, INITIAL_CHAT);
  const updated = msgs.map(m => {
    if (m.sender_id === userId || m.deleted) return m;
    const readBy = m.read_by || [];
    if (readBy.includes(userId)) return m;
    return { ...m, read_by: [...readBy, userId] };
  });
  saveItem(STORAGE_KEYS.CHAT, updated);
}

export function getUnreadChatCount(userId: string): number {
  const msgs = loadItem<ChatMessage[]>(STORAGE_KEYS.CHAT, INITIAL_CHAT);
  return msgs.filter(m => !m.deleted && m.sender_id !== userId && !(m.read_by || []).includes(userId)).length;
}

export function isMatchAgent(recordAgent: string | undefined, user: User | undefined): boolean {
  if (!recordAgent || !user) return false;
  const r = recordAgent.trim().toLowerCase();
  const uid = user.id.trim().toLowerCase();
  const uname = user.name.trim().toLowerCase();
  return r === uid || r === uname || r.includes(uname) || uname.includes(r);
}

// --- AGENT MASTER LIST & SUPERVISOR LIVE VIEW ---
export function getAdminMasterList(): AgentMasterStatus[] {
  const users = getUsers();
  const checkins = getCheckins();
  const reports = getReports();
  const leads = getLeads();
  const shops = getShops();
  const today = toISO(new Date());

  const agents = users.filter(u => u.role === 'agent');

  return agents.map(agent => {
    const hasIn = checkins.some(c => (c.agent_id === agent.id || c.agent_id === agent.name || isMatchAgent(c.agent_id, agent)) && toISO(c.timestamp) === today && c.type === 'IN');
    const todayReport = reports.find(r => (r.agent_id === agent.id || r.agent_id === agent.name || isMatchAgent(r.agent_id, agent)) && toISO(r.date) === today);

    const shopObj = shops.find(s => s.id === agent.permanentShopId);
    const shopName = shopObj ? shopObj.name : 'Non affecté';

    const agentTodayLeads = leads.filter(l => (l.agent_id === agent.id || l.agent_id === agent.name || isMatchAgent(l.agent_id, agent)) && toISO(l.timestamp) === today);
    const priv = agentTodayLeads.filter(l => String(l.action_type).includes('Privil')).length;
    const roam = agentTodayLeads.filter(l => String(l.action_type).includes('Roam')).length;
    const bund = agentTodayLeads.filter(l => String(l.action_type).includes('Bund') || String(l.action_type).includes('Pack')).length;

    const agentAllLeads = leads.filter(l => l.agent_id === agent.id || l.agent_id === agent.name || isMatchAgent(l.agent_id, agent));
    const trend: number[] = [4, 7, 5, 12, 18, 14, agentAllLeads.length];

    let status: 'Clôturé' | 'Présent' | 'Absent' = 'Absent';
    if (todayReport) status = 'Clôturé';
    else if (hasIn) status = 'Présent';

    return {
      id: agent.id,
      name: agent.name,
      phone: agent.phone,
      shop: shopName,
      shopId: agent.permanentShopId,
      status,
      trend,
      reportUrl: todayReport ? todayReport.pdf_url : undefined,
      reportObj: todayReport,
      stats: { priv, roam, bund }
    };
  });
}

export function getSupervisorLiveView(supervisorId: string, dateISO?: string) {
  const targetDate = dateISO || toISO(new Date());
  const users = getUsers();
  const checkins = getCheckins();
  const reports = getReports();
  const leads = getLeads();
  const shops = getShops();

  const myAgents = users.filter(u => u.role === 'agent' && u.supervisorId === supervisorId);

  return myAgents.map(a => {
    const hasIn = checkins.find(c => c.agent_id === a.id && toISO(c.timestamp) === targetDate && c.type === 'IN');
    const hasRep = reports.find(r => r.agent_id === a.id && toISO(r.date) === targetDate);
    const aLeads = leads.filter(l => l.agent_id === a.id && toISO(l.timestamp) === targetDate);

    const shopObj = shops.find(s => s.id === a.permanentShopId);
    const shopName = shopObj ? shopObj.name : 'Non affecté';

    let status: 'Clôturé' | 'Présent' | 'Absent' = 'Absent';
    if (hasRep) status = 'Clôturé';
    else if (hasIn) status = 'Présent';

    return {
      id: a.id,
      name: a.name,
      shop: shopName,
      status,
      reportUrl: hasRep?.pdf_url || null,
      reportObj: hasRep || null,
      stats: {
        priv: aLeads.filter(l => l.action_type.includes('Privilège')).length,
        roam: aLeads.filter(l => l.action_type.includes('Roaming')).length,
        bund: aLeads.filter(l => l.action_type.includes('Bundle')).length
      }
    };
  });
}

export function getDashboardData(filters: { start?: string; end?: string; agentId?: string }) {
  const leads = getLeads();
  const users = getUsers();
  const start = filters.start || '1900-01-01';
  const end = filters.end || '2100-01-01';
  const agentId = filters.agentId || '';

  let priv = 0, roam = 0, bund = 0, total = 0;
  const daily: Record<string, number> = {};

  leads.forEach(l => {
    const d = toISO(l.timestamp);
    if (d >= start && d <= end && (agentId === '' || l.agent_id === agentId)) {
      total++;
      if (l.action_type.includes('Privilège')) priv++;
      else if (l.action_type.includes('Roaming')) roam++;
      else bund++;
      daily[d] = (daily[d] || 0) + 1;
    }
  });

  const pieData = [
    { name: 'Privilège', value: priv, color: '#E60000' },
    { name: 'Roaming', value: roam, color: '#FFD700' },
    { name: 'Bundles', value: bund, color: '#3b82f6' }
  ];

  const sortedDates = Object.keys(daily).sort();
  const lineData = sortedDates.map(date => ({
    date,
    value: daily[date]
  }));

  return {
    kpi: {
      totalLeads: total,
      presence: users.filter(u => u.role === 'agent').length
    },
    pieData,
    lineData
  };
}

export function buildPayrollPresenceSummary(dateISO: string) {
  const users = getUsers();
  const shops = getShops();
  const reports = getReports().filter(r => toISO(r.date) === toISO(dateISO));
  const checkins = getCheckins().filter(c => toISO(c.timestamp) === toISO(dateISO) && c.type === 'IN');
  const leads = getLeads().filter(l => toISO(l.timestamp) === toISO(dateISO));

  const supervisors = users.filter(u => u.role === 'supervisor');
  const rows: Array<{
    supervisor: string;
    shop: string;
    agent: string;
    presence: 'Present' | 'Absent';
    reportSent: 'Oui' | 'Non';
    retardsMinutes: number;
    totalLeads: number;
  }> = [];

  users
    .filter(u => u.role === 'agent')
    .forEach(agent => {
      const sup = supervisors.find(s => s.id === agent.supervisorId);
      const shop = shops.find(s => s.id === agent.permanentShopId);
      const inCheck = checkins.find(c => c.agent_id === agent.id);
      const report = reports.find(r => r.agent_id === agent.id);
      const totalLeads = leads.filter(l => l.agent_id === agent.id).length;

      let retardsMinutes = 0;
      if (inCheck) {
        const t = new Date(inCheck.timestamp);
        const mins = t.getHours() * 60 + t.getMinutes();
        retardsMinutes = Math.max(0, mins - (8 * 60 + 45));
      }

      rows.push({
        supervisor: sup?.name || 'Sans superviseur',
        shop: shop?.name || 'Non affecte',
        agent: agent.name,
        presence: inCheck ? 'Present' : 'Absent',
        reportSent: report ? 'Oui' : 'Non',
        retardsMinutes,
        totalLeads
      });
    });

  return rows.sort((a, b) => {
    if (a.supervisor !== b.supervisor) return a.supervisor.localeCompare(b.supervisor);
    if (a.shop !== b.shop) return a.shop.localeCompare(b.shop);
    return a.agent.localeCompare(b.agent);
  });
}
