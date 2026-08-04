import { User, UserRole, Shop, Checkin, Lead, DailyReport, NotificationItem, ChatMessage, ShopTargets, AgentMasterStatus } from '../types';
import { INITIAL_SHOPS, INITIAL_USERS, INITIAL_CHECKINS, INITIAL_LEADS, INITIAL_REPORTS, INITIAL_NOTIFICATIONS, INITIAL_CHAT } from '../data/initialData';
import { buildAgentReportHtml, generateAgentPDF, PDFReportData } from './pdfGenerator';
import { pushToGoogleSheetWebhook, getGSheetConfig, syncFromGoogleSheetUrl, fetchChatMessagesFromSheet } from './googleSheetsSync';
import { SHARED_CHAT_STORE } from '../sharedChatStore';
import { isSupabaseConfigured, syncLocalDataToSupabase, uploadPhotoToSupabase, fetchReportsFromSupabase } from './supabase';
import { fetchCheckinsFromSupabase } from './supabase';

const API_BASE_URL = '';

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

const SHARED_API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname || '127.0.0.1';
  return host === 'localhost' || host === '127.0.0.1' ? 'http://127.0.0.1:3001' : '';
})();

async function fetchSharedJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!SHARED_API_BASE) return null;
  try {
    const response = await fetch(`${SHARED_API_BASE}${path}`, {
      ...init,
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function syncSharedChatMessages(list: ChatMessage[]): void {
  saveItem(STORAGE_KEYS.CHAT, list);
  localStorage.setItem('vodacom_chat', JSON.stringify(list));
  localStorage.setItem('vodacom_chat_v5', JSON.stringify(list));
  localStorage.setItem('vodacom_chat_v4', JSON.stringify(list));
  try {
    SHARED_CHAT_STORE.load();
    SHARED_CHAT_STORE.messages = list;
    SHARED_CHAT_STORE.save();
  } catch {}
}

function syncSharedNotifications(list: NotificationItem[]): void {
  saveItem(STORAGE_KEYS.NOTIFS, list);
  try {
    SHARED_CHAT_STORE.load();
    SHARED_CHAT_STORE.notifications = list;
    SHARED_CHAT_STORE.save();
  } catch {}
}

export const DRIVE_FOLDERS = {
  REPORTS_FOLDER_URL: 'https://drive.google.com/drive/folders/1gYV6G84pJ0WyrVSmmk2-969ZJt9s1LBq?usp=drive_link',
  PHOTOS_FOLDER_URL: 'https://drive.google.com/drive/folders/1AVox_j8VMle_cDdDZrM-g0x7E7GkREtv?usp=drive_link',
  REPORTS_PHOTOS_URL: 'https://drive.google.com/drive/folders/1Xer27VuJuhd1C3DNJ9nyWhzDLaYPKRIS?usp=drive_link'
};

function requestBrowserNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve('denied');
  }

  if (window.Notification.permission === 'granted') {
    return Promise.resolve('granted');
  }

  if (window.Notification.permission === 'denied') {
    return Promise.resolve('denied');
  }

  return window.Notification.requestPermission();
}

function maybeShowBrowserNotification(message: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  try {
    new window.Notification('Vodacom Tracker', { body: message, icon: '/favicon.svg' });
  } catch {}
}

function emitAppToast(message: string, level: 'success' | 'error' = 'success'): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('vodacom-toast', {
      detail: { message, level }
    }));
  } catch {}
}

function syncUserUpdateToGSheet(user: User): void {
  pushToGoogleSheetWebhook({
    type: 'user-update',
    data: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      supervisorId: user.supervisorId || '',
      permanentShopId: user.permanentShopId || '',
      password: user.password || '',
      updated_at: new Date().toISOString()
    }
  }).then(() => {
    const cfg = getGSheetConfig();
    if (cfg.sheetCsvUrl) {
      syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
    }
  }).catch(() => {});
}

function pushNotification(userId: string, message: string, type: string): NotificationItem {
  const item: NotificationItem = {
    id: generateUUID(),
    user_id: userId,
    message,
    type,
    is_read: false,
    timestamp: new Date().toISOString(),
    deleted: undefined
  };

  try {
    SHARED_CHAT_STORE.pushNotification(item);
  } catch {}

  const notifs = loadStoredArray<NotificationItem[]>(STORAGE_KEYS.NOTIFS, ['vodacom_notifs', 'vodacom_notifs_v5', 'vodacom_notifs_v4'], INITIAL_NOTIFICATIONS);
  notifs.unshift(item);
  saveItem(STORAGE_KEYS.NOTIFS, notifs);
  maybeShowBrowserNotification(message);
  void fetchSharedJson<NotificationItem>('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(item)
  });
  return item;
}

function loadStoredArray<T>(key: string, legacyKeys: string[], fallback: T): T {
  const tryParse = (raw: string | null): unknown => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const currentValue = tryParse(localStorage.getItem(key));
  if (Array.isArray(currentValue)) {
    return currentValue as T;
  }

  if (Array.isArray(fallback)) {
    for (const legacyKey of legacyKeys) {
      const legacyValue = tryParse(localStorage.getItem(legacyKey));
      if (Array.isArray(legacyValue)) {
        saveItem(key, legacyValue);
        return legacyValue as T;
      }
    }

    saveItem(key, fallback);
    return fallback;
  }

  if (currentValue !== null) {
    return currentValue as T;
  }

  saveItem(key, fallback);
  return fallback;
}

function mergeUsersWithSeedData(storedUsers: User[]): User[] {
  const merged: User[] = [...INITIAL_USERS];
  const indexByPhone = new Map<string, number>();

  merged.forEach((user, index) => {
    const key = normalizePhoneMSISDN(user.phone).toLowerCase();
    if (key) indexByPhone.set(key, index);
  });

  (Array.isArray(storedUsers) ? storedUsers : []).forEach((candidate) => {
    const key = normalizePhoneMSISDN(candidate.phone).toLowerCase();
    if (!key) {
      merged.push(candidate);
      return;
    }

    const existingIndex = indexByPhone.get(key);
    if (existingIndex === undefined) {
      merged.push(candidate);
      indexByPhone.set(key, merged.length - 1);
      return;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      ...candidate,
      id: candidate.id || existing.id,
      phone: candidate.phone || existing.phone,
      name: candidate.name || existing.name,
      role: candidate.role || existing.role,
      password: candidate.password ?? existing.password,
      supervisorId: candidate.supervisorId ?? existing.supervisorId,
      permanentShopId: candidate.permanentShopId ?? existing.permanentShopId,
      created_at: candidate.created_at || existing.created_at,
      last_login: candidate.last_login || existing.last_login
    };
  });

  return merged;
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
const transientCheckinPhotoCache = new Map<string, string>();

function checkinPhotoCacheKey(agentId: string, isoDate: string): string {
  return `${agentId}::${isoDate}`;
}

// Initialize seed data without wiping the user's persisted state on first load.
(function initializeSeedData() {
  try {
    const existingUsers = loadItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    if (!Array.isArray(existingUsers) || existingUsers.length === 0) {
      saveItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    }

    const existingShops = loadItem<Shop[]>(STORAGE_KEYS.SHOPS, INITIAL_SHOPS);
    if (!Array.isArray(existingShops) || existingShops.length === 0) {
      saveItem(STORAGE_KEYS.SHOPS, INITIAL_SHOPS);
    }
  } catch (err) {
    console.warn('Seed initialization exception:', err);
  }
})();

export function purgeAndResetEverything(): void {
  try {
    pdfCache.clear();
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHOP_ID);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHOP_NAME);
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

    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      saveItem(key, fallback);
      return fallback;
    }

    return parsed as T;
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
            if (
              'photo' in copy
              && typeof copy.photo === 'string'
              && copy.photo.length > 1000
              && copy.photo.startsWith('data:image')
            ) {
              delete copy.photo;
            }
            if (
              'pointage_photo' in copy
              && typeof copy.pointage_photo === 'string'
              && copy.pointage_photo.length > 1000
              && copy.pointage_photo.startsWith('data:image')
            ) {
              delete copy.pointage_photo;
            }
            if ('photos' in copy && Array.isArray(copy.photos)) {
              const keptPhotos = copy.photos.filter((p: unknown) => {
                if (typeof p !== 'string') return false;
                const value = p.trim();
                if (!value) return false;
                return !value.startsWith('data:image');
              });
              if (keptPhotos.length > 0) {
                copy.photos = keptPhotos;
              } else {
                delete copy.photos;
              }
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
  const storedUsers = loadItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
  if (!Array.isArray(storedUsers) || storedUsers.length === 0) {
    saveItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    return INITIAL_USERS;
  }

  const mergedUsers = mergeUsersWithSeedData(storedUsers);
  const needsWrite = JSON.stringify(mergedUsers) !== JSON.stringify(storedUsers);
  if (needsWrite) {
    saveItem(STORAGE_KEYS.USERS, mergedUsers);
  }
  return mergedUsers;
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

    emitAppToast(`Affectation mise à jour: ${before.name} → ${shop?.name || shopId}.`);
    syncUserUpdateToGSheet(users[index]);

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

    emitAppToast(`Superviseur mis à jour pour ${target.name}.`);
    syncUserUpdateToGSheet(users[index]);

    return true;
  }
  return false;
}

export function getDefaultPasswordForRole(role: UserRole): string {
  return 'password';
}

function normalizeLoginToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-\.\+]/g, '');
}

async function hashPasswordAsync(value: string): Promise<string> {
  const normalized = value.trim();
  if (!normalized) return '';
  try {
    const bytes = new TextEncoder().encode(normalized);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return normalized;
  }
}

function doesProvidedPasswordMatch(user: User, providedRaw: string): boolean {
  const provided = providedRaw.trim();
  if (!provided) return false;

  const providedNormalized = provided.toLowerCase();
  const customPass = user.password ? user.password.trim() : '';
  if (customPass.length > 0) {
    const storedNormalized = customPass.trim().toLowerCase();
    return storedNormalized === providedNormalized;
  }

  const defaultPass = getDefaultPasswordForRole(user.role);
  return defaultPass.toLowerCase() === providedNormalized;
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
  const cleanRaw = normalizeLoginToken(phone);

  const found = users.find(u => {
    const uNorm = normalizePhoneMSISDN(u.phone);
    const uRaw = normalizeLoginToken(u.phone);
    const uId = normalizeLoginToken(u.id);
    const uName = normalizeLoginToken(u.name);
    return (
      (targetPhone && uNorm === targetPhone) ||
      (cleanRaw && uRaw === cleanRaw) ||
      (cleanRaw && uId === cleanRaw) ||
      (cleanRaw && uName.includes(cleanRaw))
    );
  });

  if (!found) {
    return { success: false, message: 'Identifiants incorrects (MSISDN non enregistré).' };
  }

  const provided = (password_hash || '').trim().toLowerCase();
  if (!provided) {
    return { success: false, message: 'Mot de passe requis.' };
  }

  const customPassword = (found.password || '').trim().toLowerCase();
  const roleDefaultPassword = getDefaultPasswordForRole(found.role).toLowerCase();
  const acceptedPasswords = customPassword ? [customPassword] : [roleDefaultPassword];

  if (!acceptedPasswords.some(candidate => candidate && candidate === provided)) {
    return { success: false, message: 'Mot de passe incorrect.' };
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

export function saveTargetDefinition(payload: {
  user_id: string;
  date: string;
  target_privilege_std: number;
  target_privilege_air: number;
  target_roaming_std: number;
  target_roaming_air: number;
  target_bundle_std: number;
  target_bundle_air: number;
}): void {
  const key = `vodacom_targets_${payload.user_id}_${payload.date}`;
  const current = loadItem<Record<string, unknown>>(key, {});
  const next = {
    ...current,
    ...payload,
    updated_at: new Date().toISOString()
  };
  saveItem(key, next);
}

export function getEffectiveTargetsForDate(date: string, shopId?: string): ShopTargets {
  const shop = shopId ? getShopById(shopId) : undefined;
  const isAirport = shop?.type === 'Airport';
  const key = `vodacom_targets_${date}`;
  const targetData = loadItem<Record<string, unknown>>(key, {});
  const privilege = isAirport ? Number(targetData.target_privilege_air ?? 20) : Number(targetData.target_privilege_std ?? 20);
  const roaming = isAirport ? Number(targetData.target_roaming_air ?? 15) : Number(targetData.target_roaming_std ?? 3);
  const bundle = isAirport ? Number(targetData.target_bundle_air ?? 10) : Number(targetData.target_bundle_std ?? 10);
  return { privilege, roaming, bundle };
}

// --- CHECKINS ---
export function getCheckins(): Checkin[] {
  return loadItem(STORAGE_KEYS.CHECKINS, INITIAL_CHECKINS)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function refreshCheckinsFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const rows = await fetchCheckinsFromSupabase();

  saveItem(
    STORAGE_KEYS.CHECKINS,
    rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  );
}

export function addCheckin(checkinData: Omit<Checkin, 'id'>): Checkin {
  const checkins = getCheckins();
  const newCheckin: Checkin = {
    ...checkinData,
    status: checkinData.status === 'pending' ? 'pending' : (checkinData.type === 'IN' ? 'pending' : (checkinData.status || 'synced')),
    id: generateUUID()
  };

  // Keep a transient copy to avoid visual loss before Drive URL sync completes.
  if (
    newCheckin.type === 'IN'
    && typeof newCheckin.photo === 'string'
    && newCheckin.photo.startsWith('data:image')
  ) {
    transientCheckinPhotoCache.set(
      checkinPhotoCacheKey(newCheckin.agent_id, toISO(newCheckin.timestamp)),
      newCheckin.photo
    );
  }

  checkins.unshift(newCheckin);
  saveItem(STORAGE_KEYS.CHECKINS, checkins);

  void (async () => {
    try {
      if (isSupabaseConfigured()) {
        let nextCheckin: Checkin = { ...newCheckin };
        if (newCheckin.type === 'IN' && typeof newCheckin.photo === 'string' && newCheckin.photo.startsWith('data:image')) {
          const photoUrl = await uploadPhotoToSupabase(newCheckin.photo, 'photos', 'checkins');
          nextCheckin = { ...nextCheckin, photo_drive_url: photoUrl, photo: null as unknown as string };
        }

        await syncLocalDataToSupabase({
          checkins: [nextCheckin]
        });
      }
    } catch (error) {
      console.warn('Supabase checkin sync failed', error);
    }
  })();

  pushToGoogleSheetWebhook({
    type: 'checkin',
    data: newCheckin,
    folders: {
      photos: DRIVE_FOLDERS.PHOTOS_FOLDER_URL
    }
  }).then((confirmed) => {
    if (confirmed) {
      const cfg = getGSheetConfig();
      if (cfg.sheetCsvUrl) {
        syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
      }
      return;
    }

    // Keep a pending flag if webhook confirmation failed.
    const latest = getCheckins();
    const idx = latest.findIndex((c) => c.id === newCheckin.id);
    if (idx >= 0 && latest[idx].status !== 'pending') {
      latest[idx] = { ...latest[idx], status: 'pending' };
      saveCheckins(latest);
    }
  }).catch(() => {});
  return newCheckin;
}

export function checkDailyStatus(agentId: string, dateISO: string) {
  const checkins = getCheckins();
  const reports = getReports();
  const users = getUsers();

  const targetDate = toISO(dateISO);
  const currentUser = users.find((user) => user.id === agentId);
  const normalizeIdentity = (value: string | undefined | null): string => {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  };
  const identityKeys = new Set<string>([
    normalizeIdentity(agentId),
    normalizeIdentity(currentUser?.id),
    normalizeIdentity(currentUser?.name),
    normalizeIdentity(currentUser?.phone)
  ].filter(Boolean));

  const hasCheckin = checkins.some((record) => {
    if (toISO(record.timestamp) !== targetDate) return false;
    if (record.type !== 'IN') return false;
    const recordKey = normalizeIdentity(record.agent_id);
    return recordKey ? identityKeys.has(recordKey) : false;
  });
  const hasReport = reports.some((record) => {
    if (toISO(record.date) !== targetDate) return false;
    const recordKey = normalizeIdentity(record.agent_id);
    return recordKey ? identityKeys.has(recordKey) : false;
  });

  return { checkinDone: hasCheckin, reportDone: hasReport };
}

export function resolveStoredPhotoUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('data:image') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.includes('drive.google.com') || value.includes('googleusercontent.com')) {
    return value;
  }
  if (value.length > 10 && !value.includes(' ')) {
    return `https://lh3.googleusercontent.com/d/${value}`;
  }
  return value;
}

export function getTodayCheckinPhoto(agentId: string): string | null {
  const checkins = getCheckins();
  const today = toISO(new Date());

  const todayIns = checkins.filter(
    (r) => r.agent_id === agentId && toISO(r.timestamp) === today && r.type === 'IN'
  );

  const withPhoto = todayIns.find((r) => !!(r.photo_drive_url || r.photo));
  const preferred = withPhoto || todayIns[0];
  const photoValue = preferred?.photo_drive_url || preferred?.photo;
  const resolved = resolveStoredPhotoUrl(photoValue);
  if (resolved) return resolved;

  const anyTodayWithPhoto = checkins.find(
    (r) => r.agent_id === agentId && toISO(r.timestamp) === today && !!(r.photo_drive_url || r.photo)
  );
  const anyResolved = resolveStoredPhotoUrl(anyTodayWithPhoto?.photo_drive_url || anyTodayWithPhoto?.photo || '');
  if (anyResolved) return anyResolved;

  const cached = transientCheckinPhotoCache.get(checkinPhotoCacheKey(agentId, today));
  return cached || null;
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

export async function refreshReportsFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const reports = await fetchReportsFromSupabase();
  saveReports(reports);
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

  const leadDate = toISO(leadData.timestamp || new Date().toISOString());
  const { reportDone } = checkDailyStatus(leadData.agent_id, leadDate);
  if (reportDone) {
    throw new Error('Session cloturee: impossible d\'enregistrer un nouveau client apres envoi du rapport.');
  }

  const leads = getLeads();
  const newLead: Lead = {
    ...leadData,
    status: leadData.status || 'pending',
    id: generateUUID()
  };
  leads.unshift(newLead);
  saveItem(STORAGE_KEYS.LEADS, leads);
  void (async () => {
    try {
      if (isSupabaseConfigured()) {
        await syncLocalDataToSupabase({
          leads: [newLead]
        });
      }
    } catch (error) {
      console.warn('Supabase lead sync failed', error);
    }
  })();
  pushToGoogleSheetWebhook({ type: 'lead', data: newLead }).then((confirmed) => {
    if (confirmed) {
      const latest = getLeads();
      const idx = latest.findIndex((lead) => lead.id === newLead.id);
      if (idx >= 0 && latest[idx].status !== 'synced') {
        latest[idx] = { ...latest[idx], status: 'synced' };
        saveLeads(latest);
      }

      const cfg = getGSheetConfig();
      if (cfg.sheetCsvUrl) {
        syncFromGoogleSheetUrl(cfg.sheetCsvUrl).catch(() => {});
      }
      return;
    }

    const latest = getLeads();
    const idx = latest.findIndex((lead) => lead.id === newLead.id);
    if (idx >= 0 && latest[idx].status !== 'pending') {
      latest[idx] = { ...latest[idx], status: 'pending' };
      saveLeads(latest);
    }
  }).catch(() => {});
  return newLead;
}

// --- REPORTS ---
export function getReports(): DailyReport[] {
  const rawReports: DailyReport[] = loadItem(STORAGE_KEYS.REPORTS, []);

  const reports = rawReports.map(r => ({
    ...r,
    pdf_url: pdfCache.get(r.id) || r.pdf_url
  }));

  return reports.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function addReport(reportData: Omit<DailyReport, 'id'>): DailyReport {
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

  void (async () => {
    try {
      if (isSupabaseConfigured()) {
        await syncLocalDataToSupabase({
          reports: [newReport]
        });
      }
    } catch (error) {
      console.error('Supabase report sync failed', error);
      throw error;
    }
  })();
  
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
  const pointagePhoto = resolveStoredPhotoUrl(pointageIn?.photo_drive_url || pointageIn?.photo || report.pointage_photo) || '';

  const evolutionSeries = buildAgentEvolutionSeries(report.agent_id, report.agent_name, report.date, targets);

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
    comment: report.comment || '',
    evolutionTargetData: evolutionSeries.evolutionTargetData,
    evolutionActivationData: evolutionSeries.evolutionActivationData
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

  const evolutionSeries = buildAgentEvolutionSeries(report.agent_id, report.agent_name, report.date, targets);

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
    pointagePhoto: resolveStoredPhotoUrl(report.pointage_photo || pointageIn?.photo_drive_url || pointageIn?.photo) || '',
    photos: report.photos || [],
    comment: report.comment || '',
    evolutionTargetData: evolutionSeries.evolutionTargetData,
    evolutionActivationData: evolutionSeries.evolutionActivationData
  };
}

export function getReportPreviewHtml(report: DailyReport): string {
  return buildAgentReportHtml(buildReportPreviewData(report));
}

// --- NOTIFICATIONS ---
export function getNotifications(userId: string): NotificationItem[] {
  const notifs = loadStoredArray<NotificationItem[]>(STORAGE_KEYS.NOTIFS, ['vodacom_notifs', 'vodacom_notifs_v5', 'vodacom_notifs_v4'], INITIAL_NOTIFICATIONS);
  return notifs.filter(n => n.user_id === userId);
}

export function markNotifsAsRead(userId: string): void {
  const notifs = loadStoredArray<NotificationItem[]>(STORAGE_KEYS.NOTIFS, ['vodacom_notifs', 'vodacom_notifs_v5', 'vodacom_notifs_v4'], INITIAL_NOTIFICATIONS);
  const updated = notifs.map(n => n.user_id === userId ? { ...n, is_read: true } : n);
  saveItem(STORAGE_KEYS.NOTIFS, updated);
}

export function clearNotifications(userId: string): void {
  const notifs = loadStoredArray<NotificationItem[]>(STORAGE_KEYS.NOTIFS, ['vodacom_notifs', 'vodacom_notifs_v5', 'vodacom_notifs_v4'], INITIAL_NOTIFICATIONS);
  const updated = notifs.filter(n => n.user_id !== userId);
  saveItem(STORAGE_KEYS.NOTIFS, updated);
}

// --- CHAT ---
export async function getChatMessages(): Promise<ChatMessage[]> {
  try {
    const sharedMessages = await fetchChatMessagesFromSheet();
    if (sharedMessages && Array.isArray(sharedMessages)) {
      const normalized = sharedMessages.filter(message => !message.deleted);
      syncSharedChatMessages(normalized);
      return normalized;
    }
  } catch {}

  return loadStoredArray<ChatMessage[]>(STORAGE_KEYS.CHAT, ['vodacom_chat', 'vodacom_chat_v5', 'vodacom_chat_v4'], INITIAL_CHAT).filter(message => !message.deleted);
}

export async function sendChatMessage(sender: User, message: string): Promise<ChatMessage> {
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

  const currentMsgs = await getChatMessages();
  const nextMsgs = [...currentMsgs, newMsg];
  syncSharedChatMessages(nextMsgs);
  void pushToGoogleSheetWebhook({ type: 'chat', data: newMsg });

  if (sender.role === 'admin') {
    recipients.forEach(uid => {
      pushNotification(uid, `Nouveau message admin de ${sender.name}.`, 'chat-admin');
    });
  }

  return newMsg;
}

export async function deleteChatMessage(messageId: string, actor: User): Promise<boolean> {
  if (actor.role !== 'admin') return false;

  const deletedAt = new Date().toISOString();

  const msgs = await getChatMessages();
  const updated = msgs.map(message =>
    message.id === messageId
      ? {
          ...message,
          deleted: true,
          deleted_by: actor.id,
          deleted_at: deletedAt
        }
      : message
  );

  syncSharedChatMessages(updated);

  try {
    await pushToGoogleSheetWebhook({
      action: 'deleteChatMessage',
      type: 'chat-delete',
      tab: 'Chat',
      id: messageId,
      deleted_by: actor.id,
      deleted_at: deletedAt
    });
  } catch {}

  return true;
}

export function markChatAsRead(userId: string): void {
  const msgs = loadStoredArray<ChatMessage[]>(STORAGE_KEYS.CHAT, ['vodacom_chat', 'vodacom_chat_v5', 'vodacom_chat_v4'], INITIAL_CHAT);
  const updated = msgs.map(m => {
    if (m.sender_id === userId || m.deleted) return m;
    const readBy = m.read_by || [];
    if (readBy.includes(userId)) return m;
    return { ...m, read_by: [...readBy, userId] };
  });
  saveItem(STORAGE_KEYS.CHAT, updated);
}

export function getUnreadChatCount(userId: string): number {
  const msgs = loadStoredArray<ChatMessage[]>(STORAGE_KEYS.CHAT, ['vodacom_chat', 'vodacom_chat_v5', 'vodacom_chat_v4'], INITIAL_CHAT);
  return msgs.filter(m => !m.deleted && m.sender_id !== userId && !(m.read_by || []).includes(userId)).length;
}

export function isMatchAgent(recordAgent: string | undefined, user: User | undefined): boolean {
  if (!recordAgent || !user) return false;

  const r = String(recordAgent || '').trim().toLowerCase();
  const uid = String(user.id || '').trim().toLowerCase();
  const uname = String(user.name || '').trim().toLowerCase();

  if (!uid && !uname) return false;

  return r === uid || r === uname || r.includes(uname) || uname.includes(r);
}

function buildAgentEvolutionSeries(agentId: string, agentName: string, reportDate: string, targets: { privilege: number; roaming: number; bundle: number }): { evolutionTargetData: number[]; evolutionActivationData: number[] } {
  const allLeads = getLeads();
  const matchingLeads = allLeads.filter(l => {
    const recordAgent = l.agent_id || '';
    return recordAgent === agentId || recordAgent === agentName || isMatchAgent(recordAgent, { id: agentId, name: agentName, role: 'agent' } as User);
  });

  const sortedDates = Array.from(new Set(
    matchingLeads.map(l => toISO(l.timestamp)).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  const datesToInclude = sortedDates.includes(reportDate) ? sortedDates : [...sortedDates, reportDate].filter(Boolean).sort((a, b) => a.localeCompare(b));

  if (datesToInclude.length === 0) {
    return { evolutionTargetData: [], evolutionActivationData: [] };
  }

  const targetTotal = Math.max(1, (targets.privilege || 0) + (targets.roaming || 0) + (targets.bundle || 0));
  const evolutionTargetData = datesToInclude.map(() => targetTotal);
  const evolutionActivationData = datesToInclude.map((date) => {
    const dayLeads = matchingLeads.filter(l => toISO(l.timestamp) === date);
    return dayLeads.length;
  });

  return { evolutionTargetData, evolutionActivationData };
}

// --- AGENT MASTER LIST & SUPERVISOR LIVE VIEW ---
export function getAdminMasterList(dateISO?: string): AgentMasterStatus[] {
  const users = getUsers();
  const checkins = getCheckins();
  const reports = getReports();
  const leads = getLeads();
  const shops = getShops();
  const targetDate = dateISO || toISO(new Date());

  const agents = users.filter(u => u.role === 'agent');

  return agents.map(agent => {
    const hasIn = checkins.some(c => (c.agent_id === agent.id || c.agent_id === agent.name || isMatchAgent(c.agent_id, agent)) && toISO(c.timestamp) === targetDate && c.type === 'IN');
    const todayReport = reports.find(r => (r.agent_id === agent.id || r.agent_id === agent.name || isMatchAgent(r.agent_id, agent)) && toISO(r.date) === targetDate);

    const shopObj = shops.find(s => s.id === agent.permanentShopId);
    const shopName = shopObj ? shopObj.name : 'Non affecté';

    const agentTodayLeads = leads.filter(l => (l.agent_id === agent.id || l.agent_id === agent.name || isMatchAgent(l.agent_id, agent)) && toISO(l.timestamp) === targetDate);
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
    { name: 'Privilège', value: priv, color: 'var(--theme-accent)' },
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
