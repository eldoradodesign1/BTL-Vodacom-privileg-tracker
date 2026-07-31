import * as XLSX from 'xlsx';
import { Lead, DailyReport, Checkin, User, Shop, UserRole } from '../types';
import { getLeads, getReports, getCheckins, getUsers, getShops, saveLeads, saveReports, saveCheckins, saveUsers, saveShops } from './storage';

const GSHEET_CONFIG_KEY = 'vodacom_gsheet_config';

export interface GSheetConfig {
  sheetCsvUrl: string; // e.g. https://docs.google.com/spreadsheets/d/e/.../pub?output=csv or spreadsheet URL
  webhookUrl: string;  // e.g. Google Apps Script Webhook URL
  autoSync: boolean;
  lastSyncedAt?: string;
}

export function getGSheetConfig(): GSheetConfig {
  try {
    const saved = localStorage.getItem(GSHEET_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    sheetCsvUrl: '',
    webhookUrl: '',
    autoSync: true,
    lastSyncedAt: undefined
  };
}

export function saveGSheetConfig(cfg: GSheetConfig) {
  localStorage.setItem(GSHEET_CONFIG_KEY, JSON.stringify(cfg));
}

/**
 * Robust CSV parser handling delimiters (comma, semicolon, tab) and quotes
 */
export function parseCsvRows(csvText: string): string[][] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  const header = lines[0];
  let delimiter = ',';
  const semiCount = (header.match(/;/g) || []).length;
  const commaCount = (header.match(/,/g) || []).length;
  const tabCount = (header.match(/\t/g) || []).length;

  if (semiCount >= commaCount && semiCount >= tabCount && semiCount > 0) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount && tabCount > 0) delimiter = '\t';

  return lines.map(line => {
    const row: string[] = [];
    let cell = '';
    let inside = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inside && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inside = !inside;
        }
      } else if (c === delimiter && !inside) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    row.push(cell.trim());
    return row.map(v => v.replace(/^"|"$/g, '').trim());
  });
}

/**
 * Clean phone numbers to DRC standard format (e.g. 0818889900)
 */
function normalizePhone(raw: string): string {
  if (!raw) return '';
  let clean = raw.replace(/[^\d+]/g, '');
  if (clean.length >= 8 && clean.length <= 9 && !clean.startsWith('0') && !clean.startsWith('+')) {
    clean = '0' + clean;
  }
  return clean;
}

/**
 * Parse Users table from CSV / Sheet rows
 */
export function parseUsersFromRows(rows: string[][]): User[] {
  if (rows.length < 2) return [];

  // Find header row for Users
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i].map(c => c.toLowerCase().trim());
    if (h.includes('password_hash') || h.includes('full_name') || (h.includes('role') && (h.includes('msisdn') || h.includes('phone')))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map(c => c.toLowerCase().trim());
  const idIdx = headers.findIndex(h => h === 'id' || h === 'user_id');
  const phoneIdx = headers.findIndex(h => h === 'msisdn' || h === 'phone' || h === 'tel' || h === 'mobile');
  const nameIdx = headers.findIndex(h => h === 'full_name' || h === 'name' || h === 'nom');
  const passIdx = headers.findIndex(h => h === 'password_hash' || h === 'password' || h === 'pass');
  const roleIdx = headers.findIndex(h => h === 'role' || h === 'type_user');
  const supIdx = headers.findIndex(h => h === 'supervisor_id' || h === 'sup_id' || h === 'supervisor');
  const shopIdx = headers.findIndex(h => h === 'permanent_shop_id' || h === 'shop_id' || h === 'shop');

  const users: User[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every(c => !c)) continue;

    // Stop if encountering a new header row for another table
    const firstCell = (row[0] || '').toLowerCase();
    if (firstCell === 'timestamp' || firstCell === 'id shop' || firstCell === 'shop_id' && row[1]?.toLowerCase() === 'month') {
      break;
    }

    const phone = normalizePhone(phoneIdx >= 0 ? row[phoneIdx] : row[1] || '');
    const name = (nameIdx >= 0 ? row[nameIdx] : row[2] || '').trim();
    if (!phone && !name) continue;
    if (name.toLowerCase() === 'full_name' || name.toLowerCase() === 'nom agent') continue;

    const id = (idIdx >= 0 && row[idIdx]) ? row[idIdx] : `usr-${i}`;
    const password = (passIdx >= 0 && row[passIdx]) ? row[passIdx] : undefined;
    let role: UserRole = 'agent';
    const rawRole = (roleIdx >= 0 ? row[roleIdx] : '').toLowerCase();
    if (rawRole.includes('admin')) role = 'admin';
    else if (rawRole.includes('sup')) role = 'supervisor';
    else role = 'agent';

    const supervisorId = (supIdx >= 0 && row[supIdx]) ? row[supIdx] : undefined;
    const permanentShopId = (shopIdx >= 0 && row[shopIdx]) ? row[shopIdx] : 'S001';

    users.push({
      id,
      phone,
      name,
      role,
      password,
      supervisorId,
      permanentShopId
    });
  }

  return users;
}

/**
 * Parse Shops table from CSV / Sheet rows
 */
export function parseShopsFromRows(rows: string[][]): Shop[] {
  if (rows.length < 2) return [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i].map(c => c.toLowerCase().trim());
    if ((h.includes('id') || h.includes('shop_id')) && (h.includes('name') || h.includes('nom shop') || h.includes('city'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map(c => c.toLowerCase().trim());
  const idIdx = headers.findIndex(h => h === 'id' || h === 'shop_id' || h === 'code');
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'nom' || h === 'nom shop');
  const cityIdx = headers.findIndex(h => h === 'city' || h === 'ville');
  const typeIdx = headers.findIndex(h => h === 'type');

  const shops: Shop[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every(c => !c)) continue;

    const id = (idIdx >= 0 && row[idIdx]) ? row[idIdx] : `S00${i}`;
    const name = (nameIdx >= 0 && row[nameIdx]) ? row[nameIdx] : '';
    if (!id || !name || name.toLowerCase() === 'name' || name.toLowerCase() === 'nom shop') continue;

    const city = (cityIdx >= 0 && row[cityIdx]) ? row[cityIdx] : 'Kinshasa';
    const isAirport = (typeIdx >= 0 && row[typeIdx]) ? row[typeIdx].toLowerCase().includes('air') : name.toLowerCase().includes('aéroport');

    shops.push({
      id,
      name,
      city,
      type: isAirport ? 'Airport' : 'Standard'
    });
  }

  return shops;
}

/**
 * Parse Leads table from CSV / Sheet rows
 */
export function parseLeadsFromCsv(csvText: string): Lead[] {
  const rows = parseCsvRows(csvText);
  return parseLeadsFromRows(rows);
}

export function parseLeadsFromRows(rows: string[][]): Lead[] {
  if (rows.length < 2) return [];

  // Find header row for Leads
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const h = rows[i].map(c => c.toLowerCase().trim());
    if (h.includes('msisdn') || h.includes('nom client') || h.includes('client_name') || h.includes('type action') || h.includes('action_type') || h.includes('timestamp') || h.includes('horodateur')) {
      // Ensure it's not the Users header
      if (!h.includes('password_hash') && !h.includes('permanent_shop_id')) {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map(h => h.toLowerCase().trim());

  // Dynamic header indexing
  let timeIdx = headers.findIndex(h => h === 'timestamp' || h === 'date' || h.includes('horodateur'));
  let agentIdx = headers.findIndex(h => h === 'agent_id' || h === 'id agent' || h === 'agent' || h.includes('hotesse'));
  let shopIdx = headers.findIndex(h => h === 'shop_id' || h === 'id shop' || h === 'shop' || h.includes('boutique'));
  let clientIdx = headers.findIndex(h => h === 'client_name' || h === 'nom client' || h === 'client' || h === 'nom' || h.includes('customer'));
  let phoneIdx = headers.findIndex(h => h === 'msisdn' || h === 'phone' || h === 'tel' || h === 'mobile');
  let actionIdx = headers.findIndex(h => h === 'type' || h === 'action_type' || h === 'type action' || h.includes('action') || h.includes('offre') || h.includes('bundle') || h.includes('privil'));

  // Positional fallbacks for standard Leads tab:
  if (timeIdx === -1) timeIdx = 0;
  if (agentIdx === -1) agentIdx = 1;
  if (shopIdx === -1) shopIdx = 3;
  if (clientIdx === -1) clientIdx = 5;
  if (phoneIdx === -1) phoneIdx = 6;
  if (actionIdx === -1) actionIdx = 7;

  const users = getUsers();
  const shops = getShops();
  const defaultAgent = users.find(u => u.role === 'agent') || users[0];
  const defaultShop = shops[0];

  const leads: Lead[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every(c => c === '')) continue;

    // Stop if encountering Users header or section separator
    const firstCell = (row[0] || '').toLowerCase();
    if (firstCell === 'password_hash' || firstCell === 'full_name' || (firstCell === 'id' && row[1]?.toLowerCase() === 'msisdn')) {
      break;
    }

    const timestampVal = row[timeIdx] || new Date().toISOString();
    const rawAgent = row[agentIdx] || defaultAgent?.id;
    const rawShop = row[shopIdx] || defaultShop?.id;
    const rawClient = row[clientIdx] || '';
    const rawPhone = row[phoneIdx] || '';
    const rawAction = row[actionIdx] || 'Opt-in Privilège';

    // Skip header noise or empty/invalid content
    const invalidKeywords = ['synced', 'pending', 'statut', 'status', 'timestamp', 'date', 'type action', 'id', 'full_name', 'password_hash', 'nom agent', 'id agent'];
    if (!rawClient || !rawPhone) continue;
    if (invalidKeywords.includes(rawClient.toLowerCase()) || invalidKeywords.includes(rawPhone.toLowerCase())) continue;

    // Ignore hex password hashes mistakenly placed in client_name
    if (rawClient.length > 50 && /^[a-f0-9]+$/i.test(rawClient)) continue;

    const cleanPhone = normalizePhone(rawPhone);
    if (cleanPhone.length < 8) continue;

    let agentIdVal = rawAgent;
    const matchU = users.find(u => u.id === rawAgent || u.name.toLowerCase() === rawAgent.toLowerCase() || u.name.toLowerCase().includes(rawAgent.toLowerCase()));
    if (matchU) agentIdVal = matchU.id;

    let shopIdVal = rawShop;
    const matchS = shops.find(s => s.id === rawShop || s.name.toLowerCase() === rawShop.toLowerCase() || s.name.toLowerCase().includes(rawShop.toLowerCase()));
    if (matchS) shopIdVal = matchS.id;

    let parsedDate = timestampVal;
    try {
      if (timestampVal.includes('/') || timestampVal.includes('-') || timestampVal.includes('T')) {
        const d = new Date(timestampVal);
        if (!isNaN(d.getTime())) parsedDate = d.toISOString();
      }
    } catch {}

    let normAction: 'Opt-in Privilège' | 'Opt-in Roaming' | 'Activation Bundle' = 'Opt-in Privilège';
    const lowerAct = rawAction.toLowerCase();
    if (lowerAct.includes('roam')) normAction = 'Opt-in Roaming';
    else if (lowerAct.includes('bund') || lowerAct.includes('pack')) normAction = 'Activation Bundle';
    else normAction = 'Opt-in Privilège';

    const rawId = (row[0] && row[0] !== timestampVal && row[0].length > 5 && !row[0].includes('2026-')) ? row[0] : `ld-gsheet-${i}-${Date.now()}`;

    leads.push({
      id: rawId,
      timestamp: parsedDate,
      agent_id: agentIdVal,
      shop_id: shopIdVal,
      client_name: rawClient,
      msisdn: cleanPhone,
      action_type: normAction,
      status: 'synced'
    });
  }

  return leads;
}

/**
 * Parse Checkins table from CSV / Sheet rows
 */
export function parseCheckinsFromRows(rows: string[][]): Checkin[] {
  if (rows.length < 2) return [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i].map(c => c.toLowerCase().trim());
    if (h.includes('agent_id') && (h.includes('type') || h.includes('timestamp') || h.includes('lat') || h.includes('photo'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map(h => h.toLowerCase().trim());

  let idIdx = headers.findIndex(h => h === 'id' || h === 'checkin_id');
  let assignIdx = headers.findIndex(h => h === 'assignment_id');
  let agentIdx = headers.findIndex(h => h === 'agent_id' || h === 'agent');
  let typeIdx = headers.findIndex(h => h === 'type');
  let timeIdx = headers.findIndex(h => h === 'timestamp' || h === 'date');
  let latIdx = headers.findIndex(h => h === 'lat' || h === 'latitude');
  let longIdx = headers.findIndex(h => h === 'long' || h === 'lng' || h === 'longitude');
  let accIdx = headers.findIndex(h => h === 'accuracy' || h === 'acc');
  let photoIdx = headers.findIndex(h => h === 'photo' || h === 'photo_url');
  let deviceIdx = headers.findIndex(h => h === 'device');
  let statusIdx = headers.findIndex(h => h === 'status');

  if (idIdx === -1) idIdx = 0;
  if (assignIdx === -1) assignIdx = 1;
  if (agentIdx === -1) agentIdx = 2;
  if (typeIdx === -1) typeIdx = 3;
  if (timeIdx === -1) timeIdx = 4;
  if (latIdx === -1) latIdx = 5;
  if (longIdx === -1) longIdx = 6;
  if (accIdx === -1) accIdx = 7;
  if (photoIdx === -1) photoIdx = 8;
  if (deviceIdx === -1) deviceIdx = 9;
  if (statusIdx === -1) statusIdx = 10;

  const checkins: Checkin[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3 || row.every(c => c === '')) continue;

    const agentId = row[agentIdx] || '';
    if (!agentId || agentId.toLowerCase() === 'agent_id') continue;

    const id = row[idIdx] || `chk-gsheet-${i}-${Date.now()}`;
    const type = (row[typeIdx]?.toUpperCase() === 'OUT') ? 'OUT' : 'IN';
    const timestamp = row[timeIdx] || new Date().toISOString();
    const lat = parseFloat(row[latIdx]) || 0;
    const long = parseFloat(row[longIdx]) || 0;
    const accuracy = parseFloat(row[accIdx]) || 0;
    const photo = row[photoIdx] || '';
    const device = row[deviceIdx] || 'Mobile App';
    const status = row[statusIdx] || '';

    checkins.push({
      id,
      assignment_id: row[assignIdx] || undefined,
      agent_id: agentId,
      type,
      timestamp,
      lat,
      long,
      accuracy,
      photo: (photo.startsWith('http') || photo.startsWith('data:')) ? photo : undefined,
      device,
      status: status.toLowerCase() === 'pending' ? 'pending' : 'synced'
    });
  }

  return checkins;
}

/**
 * Parse DailyReports table from CSV / Sheet rows
 */
export function parseReportsFromRows(rows: string[][]): DailyReport[] {
  if (rows.length < 2) return [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i].map(c => c.toLowerCase().trim());
    if (h.includes('privilege_count') || h.includes('roaming_count') || h.includes('bundle_count') || (h.includes('date') && h.includes('agent_id'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map(h => h.toLowerCase().trim());
  const reports: DailyReport[] = [];

  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('jour'));
  const agentIdx = headers.findIndex(h => h.includes('agent') || h.includes('hotesse') || h.includes('nom'));
  const privIdx = headers.findIndex(h => h.includes('priv') || h.includes('opt-in'));
  const roamIdx = headers.findIndex(h => h.includes('roam'));
  const bundIdx = headers.findIndex(h => h.includes('bund') || h.includes('pack'));
  const amountIdx = headers.findIndex(h => h.includes('montant') || h.includes('amount') || h.includes('ca'));
  const commentIdx = headers.findIndex(h => h.includes('comment') || h.includes('remarque') || h.includes('note'));

  const users = getUsers();
  const shops = getShops();
  const defaultAgent = users.find(u => u.role === 'agent') || users[0];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const dateVal = (dateIdx >= 0 && row[dateIdx]) ? row[dateIdx] : new Date().toISOString().split('T')[0];
    const privVal = (privIdx >= 0 && row[privIdx]) ? (parseInt(row[privIdx], 10) || 0) : 0;
    const roamVal = (roamIdx >= 0 && row[roamIdx]) ? (parseInt(row[roamIdx], 10) || 0) : 0;
    const bundVal = (bundIdx >= 0 && row[bundIdx]) ? (parseInt(row[bundIdx], 10) || 0) : 0;
    const amountVal = (amountIdx >= 0 && row[amountIdx]) ? (parseFloat(row[amountIdx]) || 0) : 0;
    const commentVal = (commentIdx >= 0 && row[commentIdx]) ? row[commentIdx] : 'Rapport synchronisé depuis Google Sheet';

    let agentObj = defaultAgent;
    if (agentIdx >= 0 && row[agentIdx]) {
      const match = users.find(u => u.name.toLowerCase().includes(row[agentIdx].toLowerCase()) || u.id === row[agentIdx]);
      if (match) agentObj = match;
    }
    const shopObj = (agentObj.permanentShopId ? shops.find(s => s.id === agentObj.permanentShopId) : null) || shops[0];

    reports.push({
      id: `gsheet-rep-${i}-${Date.now()}`,
      date: dateVal,
      agent_id: agentObj.id,
      agent_name: agentObj.name,
      shop_id: shopObj.id,
      shop_name: shopObj.name,
      priv: privVal,
      roam: roamVal,
      bund: bundVal,
      amount: amountVal,
      comment: commentVal,
      arrival_time: '08:00',
      departure_time: '17:00'
    });
  }

  return reports;
}

/**
 * Parses an Excel (.xlsx / .xls) ArrayBuffer containing multiple worksheets
 */
export function parseXlsxBuffer(buffer: ArrayBuffer): { success: boolean; count: number; message: string } {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    let totalImported = 0;
    const summaryParts: string[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      if (rows.length < 2) continue;

      const normName = sheetName.toLowerCase().trim();

      if (normName.includes('user') || normName.includes('utilisateur')) {
        const users = parseUsersFromRows(rows);
        if (users.length > 0) {
          saveUsers(users);
          totalImported += users.length;
          summaryParts.push(`${users.length} utilisateur(s)`);
        }
      } else if (normName.includes('shop') || normName.includes('boutique')) {
        const shops = parseShopsFromRows(rows);
        if (shops.length > 0) {
          saveShops(shops);
          totalImported += shops.length;
          summaryParts.push(`${shops.length} shop(s)`);
        }
      } else if (normName.includes('lead') || normName.includes('client') || normName.includes('opt-in') || normName.includes('activat')) {
        const leads = parseLeadsFromRows(rows);
        if (leads.length > 0) {
          const existing = getLeads();
          const existingKeys = new Set(existing.map(l => `${l.msisdn}_${l.client_name.toLowerCase()}`));
          const newLeads = leads.filter(l => !existingKeys.has(`${l.msisdn}_${l.client_name.toLowerCase()}`));
          saveLeads([...existing, ...newLeads]);
          totalImported += newLeads.length;
          summaryParts.push(`${newLeads.length} lead(s)`);
        }
      } else if (normName.includes('report') || normName.includes('rapport')) {
        const reports = parseReportsFromRows(rows);
        if (reports.length > 0) {
          saveReports(reports);
          totalImported += reports.length;
          summaryParts.push(`${reports.length} rapport(s)`);
        }
      }
    }

    if (totalImported > 0) {
      return {
        success: true,
        count: totalImported,
        message: `Fichier Excel (.xlsx) importé avec succès : ${summaryParts.join(', ')} !`
      };
    }

    // Fallback: try parsing first worksheet as Leads
    const firstWs = wb.Sheets[wb.SheetNames[0]];
    const firstRows: string[][] = XLSX.utils.sheet_to_json(firstWs, { header: 1, raw: false, defval: '' });
    const fallbackLeads = parseLeadsFromRows(firstRows);

    if (fallbackLeads.length > 0) {
      saveLeads(fallbackLeads);
      return {
        success: true,
        count: fallbackLeads.length,
        message: `${fallbackLeads.length} lead(s) importé(s) depuis la première feuille Excel !`
      };
    }

    return {
      success: false,
      count: 0,
      message: 'Fichier Excel lu mais aucune donnée valide (Users/Shops/Leads) n\'a été extraite.'
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Erreur d'analyse du fichier Excel : ${err.message || err}`
    };
  }
}

/**
 * Multi-Tab Fetching from Google Sheets URL
 */
export async function syncFromGoogleSheetUrl(url: string): Promise<{ success: boolean; count: number; message: string }> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return { success: false, count: 0, message: 'Veuillez saisir l\'URL de votre Google Sheet.' };
  }

  if (trimmedUrl.includes('script.google.com/u/') || trimmedUrl.includes('/projects/')) {
    return {
      success: false,
      count: 0,
      message: 'Attention : L\'URL saisie est une URL Apps Script. Pour l\'import, publiez votre Google Sheet via Fichier > Partager > Publier sur le web (Format CSV).'
    };
  }

  // Extract Spreadsheet ID if standard Google Sheets URL format
  let spreadsheetId: string | null = null;
  const match = trimmedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    spreadsheetId = match[1];
  }

  let totalSynced = 0;
  const parts: string[] = [];

  try {
    // If we have a Spreadsheet ID, fetch specific sheets directly via Google Sheets CSV API
    if (spreadsheetId && !trimmedUrl.includes('/pub?')) {
      const tabsToFetch = [
        { name: 'Users', type: 'users' },
        { name: 'Shops', type: 'shops' },
        { name: 'Leads', type: 'leads' },
        { name: 'Checkins', type: 'checkins' },
        { name: 'DailyReports', type: 'reports' }
      ];

      for (const tab of tabsToFetch) {
        try {
          const tabUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}`;
          const res = await fetch(tabUrl, { cache: 'no-store' });
          if (res.ok) {
            const csvText = await res.text();
            const rows = parseCsvRows(csvText);
            if (tab.type === 'users') {
              const users = parseUsersFromRows(rows);
              if (users.length > 0) {
                saveUsers(users);
                totalSynced += users.length;
                parts.push(`${users.length} utilisateurs`);
              }
            } else if (tab.type === 'shops') {
              const shops = parseShopsFromRows(rows);
              if (shops.length > 0) {
                saveShops(shops);
                totalSynced += shops.length;
                parts.push(`${shops.length} shops`);
              }
            } else if (tab.type === 'leads') {
              const leads = parseLeadsFromRows(rows);
              if (leads.length > 0) {
                const existing = getLeads();
                const existingKeys = new Set(existing.map(l => `${l.msisdn}_${l.client_name.toLowerCase()}`));
                const newLeads = leads.filter(l => !existingKeys.has(`${l.msisdn}_${l.client_name.toLowerCase()}`));
                saveLeads([...existing, ...newLeads]);
                totalSynced += newLeads.length;
                parts.push(`${newLeads.length} leads`);
              }
            } else if (tab.type === 'checkins') {
              const checkins = parseCheckinsFromRows(rows);
              if (checkins.length > 0) {
                const existing = getCheckins();
                const existingIds = new Set(existing.map(c => c.id));
                const newCheckins = checkins.filter(c => !existingIds.has(c.id));
                saveCheckins([...existing, ...newCheckins]);
                totalSynced += newCheckins.length;
                parts.push(`${newCheckins.length} pointages`);
              }
            } else if (tab.type === 'reports') {
              const reports = parseReportsFromRows(rows);
              if (reports.length > 0) {
                saveReports(reports);
                totalSynced += reports.length;
                parts.push(`${reports.length} rapports`);
              }
            }
          }
        } catch (e) {
          console.warn(`Tab fetch notice [${tab.name}]:`, e);
        }
      }
    }

    // Direct published CSV fetch or fallback
    const res = await fetch(trimmedUrl, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Lien Google Sheet introuvable (Erreur 404). Vérifiez que la feuille est bien publiée sur le Web au format CSV.');
      }
      throw new Error(`Google Sheet fetch error HTTP ${res.status}`);
    }
    const text = await res.text();
    const rows = parseCsvRows(text);

    const parsedUsers = parseUsersFromRows(rows);
    if (parsedUsers.length > 0) {
      saveUsers(parsedUsers);
      totalSynced += parsedUsers.length;
      parts.push(`${parsedUsers.length} utilisateurs`);
    }

    const parsedShops = parseShopsFromRows(rows);
    if (parsedShops.length > 0) {
      saveShops(parsedShops);
      totalSynced += parsedShops.length;
      parts.push(`${parsedShops.length} shops`);
    }

    const newLeads = parseLeadsFromRows(rows);
    if (newLeads.length > 0) {
      const existingLeads = getLeads();
      const existingKeys = new Set(existingLeads.map(l => `${l.msisdn}_${l.client_name.toLowerCase()}`));
      const leadsToAdd = newLeads.filter(l => !existingKeys.has(`${l.msisdn}_${l.client_name.toLowerCase()}`));

      if (leadsToAdd.length > 0) {
        saveLeads([...existingLeads, ...leadsToAdd]);
        totalSynced += leadsToAdd.length;
        parts.push(`${leadsToAdd.length} leads`);
      }
    }

    const cfg = getGSheetConfig();
    cfg.lastSyncedAt = new Date().toISOString();
    saveGSheetConfig(cfg);

    if (totalSynced > 0) {
      return {
        success: true,
        count: totalSynced,
        message: `Synchronisation Google Sheets réussie : ${parts.join(', ')} !`
      };
    } else {
      return {
        success: true,
        count: 0,
        message: 'Feuille Google Sheet analysée. Aucune nouvelle donnée à mettre à jour.'
      };
    }
  } catch (err: any) {
    console.warn('GSheet Sync failed:', err);
    return { success: false, count: 0, message: `${err.message || 'Lien invalide ou non publié sur le web'}` };
  }
}

/**
 * Export current local database as a downloadable CSV
 */
export function exportDatabaseToCsv(): string {
  const leads = getLeads();
  const users = getUsers();
  const shops = getShops();

  const userMap = new Map(users.map(u => [u.id, u.name]));
  const shopMap = new Map(shops.map(s => [s.id, s.name]));

  const headers = ['Timestamp', 'ID Agent', 'Nom Agent', 'ID Shop', 'Nom Shop', 'Nom Client', 'MSISDN', 'Type Action', 'Statut'];
  const rows = leads.map(l => [
    l.timestamp,
    l.agent_id,
    userMap.get(l.agent_id) || 'Agent',
    l.shop_id,
    shopMap.get(l.shop_id) || 'Shop',
    `"${l.client_name.replace(/"/g, '""')}"`,
    l.msisdn,
    `"${l.action_type.replace(/"/g, '""')}"`,
    l.status || 'synced'
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Push lead or report payload to Google Apps Script Webhook
 */
export async function pushToGoogleSheetWebhook(payload: any): Promise<boolean> {
  const cfg = getGSheetConfig();
  if (!cfg.webhookUrl) return false;

  try {
    const users = getUsers();
    const shops = getShops();
    let enrichedPayload = payload;

    const leadObj = payload.type === 'lead' && payload.data ? payload.data : (payload.client_name ? payload : null);
    const checkinObj = payload.type === 'checkin' && payload.data ? payload.data : (payload.lat !== undefined && payload.agent_id && !payload.client_name ? payload : null);

    if (leadObj) {
      const l = leadObj;
      const agent = users.find(u => u.id === l.agent_id);
      const shop = shops.find(s => s.id === l.shop_id);
      
      const leadId = (l.id && l.id.length >= 30 && l.id.includes('-') && !l.id.startsWith('ld-')) 
        ? l.id 
        : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-lead`);

      enrichedPayload = {
        id: leadId,
        uuid: leadId,
        timestamp: l.timestamp || new Date().toISOString(),
        agent_id: l.agent_id,
        shop_id: l.shop_id,
        client_name: l.client_name,
        msisdn: l.msisdn,
        action_type: l.action_type,
        bundle_type: '',
        amount: 0,
        action: 'processLead',
        type: 'lead',
        event: 'NEW_LEAD',
        tab: 'Leads',
        target_sheet: 'Leads',
        sheet_name: 'Leads',
        agent_name: agent?.name || '',
        shop_name: shop?.name || '',
        status: 'synced'
      };
    } else if (checkinObj) {
      const c = checkinObj;
      const agent = users.find(u => u.id === c.agent_id);

      const checkinId = (c.id && c.id.length >= 30 && c.id.includes('-') && !c.id.startsWith('chk-')) 
        ? c.id 
        : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-checkin`);

      enrichedPayload = {
        id: checkinId,
        uuid: checkinId,
        assignment_id: c.assignment_id || '',
        agent_id: c.agent_id,
        type: c.type || 'IN',
        timestamp: c.timestamp || new Date().toISOString(),
        lat: c.lat || 0,
        long: c.long ?? c.lng ?? 0,
        accuracy: c.accuracy || 0,
        photo: c.photo || '',
        device: c.device || 'Mobile App',
        status: c.status || '',
        action: 'processCheckin',
        event: 'NEW_CHECKIN',
        tab: 'Checkins',
        target_sheet: 'Checkins',
        sheet_name: 'Checkins',
        agent_name: agent?.name || ''
      };
    }

    await fetch(cfg.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload)
    });
    return true;
  } catch (err) {
    console.warn('Webhook push error:', err);
    return false;
  }
}
