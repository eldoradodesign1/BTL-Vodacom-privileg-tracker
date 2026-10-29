import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { invalidateMerchantCache } from './merchantCampaign';

// Tables de terrain suivies en direct par les vues de pilotage. Une saisie
// faite sur un téléphone d’agent est signalée aux superviseurs par Supabase
// Realtime ; à défaut (publication absente, réseau qui bloque le WebSocket),
// un relevé léger prend le relais tant que l’appli est visible.
export const LIVE_TABLES = [
  'checkins',
  'leads',
  'daily_reports',
  'ba_daily_attendance',
  'ba_transactions',
  'ba_pos_visits',
  'merchant_fund_requests',
  'mpesa_mikili_daily_attendance',
  'mpesa_mikili_clients',
  'youth_daily_attendance',
  'youth_contact_reports',
  'event_attendance',
] as const;
export type LiveTable = typeof LIVE_TABLES[number];

export const LIVE_CHANGE_EVENT = 'btl:live-change';
export type LiveChangeDetail = { tables: LiveTable[]; source: 'realtime' | 'poll' | 'resume' };

const EMIT_DEBOUNCE_MS = 600;
// Sans WebSocket, relevé toutes les 20 s. Avec, un relevé de sécurité par
// minute couvre un événement manqué (le canal s’abonne sans erreur même si une
// table n’est pas publiée : l’appli ne peut pas le détecter seule).
const FALLBACK_POLL_MS = 20_000;
const SAFETY_POLL_MS = 60_000;

// Les lectures Merchant du jour sont mises en cache sur l’appareil du
// superviseur : elles doivent être oubliées dès qu’une saisie arrive.
const MERCHANT_CACHE_SCOPES: Partial<Record<LiveTable, string[]>> = {
  ba_daily_attendance: ['activity:', 'monitoring:', 'attendance:'],
  ba_transactions: ['activity:', 'monitoring:', 'transactions:'],
  ba_pos_visits: ['activity:', 'monitoring:', 'visits'],
};

let channel: RealtimeChannel | null = null;
let subscribers = 0;
let realtimeReady = false;
let pendingTables = new Set<LiveTable>();
let pendingSource: LiveChangeDetail['source'] = 'realtime';
let emitTimer: number | null = null;
let pollTimer: number | null = null;
let lastEventAt = 0;

function invalidateFor(tables: Iterable<LiveTable>): void {
  const scopes = new Set<string>();
  for (const table of tables) (MERCHANT_CACHE_SCOPES[table] || []).forEach((scope) => scopes.add(scope));
  scopes.forEach((scope) => invalidateMerchantCache(scope));
}

function queueChange(tables: Iterable<LiveTable>, source: LiveChangeDetail['source']): void {
  for (const table of tables) pendingTables.add(table);
  if (source !== 'realtime') pendingSource = source;
  if (emitTimer !== null) return;
  emitTimer = window.setTimeout(() => {
    emitTimer = null;
    const detail: LiveChangeDetail = { tables: Array.from(pendingTables), source: pendingSource };
    pendingTables = new Set();
    pendingSource = 'realtime';
    lastEventAt = Date.now();
    invalidateFor(detail.tables);
    window.dispatchEvent(new CustomEvent<LiveChangeDetail>(LIVE_CHANGE_EVENT, { detail }));
  }, EMIT_DEBOUNCE_MS);
}

function refreshEverything(source: LiveChangeDetail['source']): void {
  queueChange(LIVE_TABLES, source);
}

function onVisibility(): void {
  // Un téléphone en veille coupe le WebSocket : au retour, tout est relu.
  if (document.visibilityState === 'visible') refreshEverything('resume');
}

function onOnline(): void {
  refreshEverything('resume');
}

function tick(): void {
  if (document.visibilityState !== 'visible') return;
  const interval = realtimeReady ? SAFETY_POLL_MS : FALLBACK_POLL_MS;
  if (Date.now() - lastEventAt >= interval) refreshEverything('poll');
}

function openChannel(): void {
  const client = getSupabaseClient();
  if (!client) return;
  let next = client.channel('btl-live-field-data');
  LIVE_TABLES.forEach((table) => {
    next = next.on('postgres_changes', { event: '*', schema: 'public', table }, () => queueChange([table], 'realtime'));
  });
  let subscribedOnce = false;
  channel = next.subscribe((status) => {
    const wasReady = realtimeReady;
    realtimeReady = status === 'SUBSCRIBED';
    // Après une reconnexion, des événements ont pu être manqués.
    if (realtimeReady && !wasReady && subscribedOnce) refreshEverything('resume');
    if (realtimeReady) subscribedOnce = true;
  });
}

function start(): void {
  lastEventAt = Date.now();
  try { openChannel(); } catch (error) { console.warn('Realtime indisponible, relevé périodique actif.', error); }
  pollTimer = window.setInterval(tick, 5_000);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
}

function stop(): void {
  if (channel) void channel.unsubscribe();
  channel = null;
  realtimeReady = false;
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
  if (emitTimer !== null) window.clearTimeout(emitTimer);
  emitTimer = null;
  pendingTables = new Set();
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('online', onOnline);
}

/** Démarre la surveillance en direct ; renvoie la fonction d’arrêt. */
export function startLiveSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  subscribers += 1;
  if (subscribers === 1) start();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    subscribers -= 1;
    if (subscribers === 0) stop();
  };
}

export function isLiveSyncRealtime(): boolean {
  return realtimeReady;
}

/**
 * Relance `onChange` (sans écran de chargement) quand l’une des tables suivies
 * change ailleurs. Le rappel le plus récent est toujours utilisé.
 */
export function useLiveRefresh(tables: readonly LiveTable[], onChange: (tables: LiveTable[]) => void, enabled = true): void {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;
  const key = tables.join(',');
  useEffect(() => {
    if (!enabled) return;
    const watched = new Set(key.split(',') as LiveTable[]);
    const listener = (event: Event) => {
      const changed = (event as CustomEvent<LiveChangeDetail>).detail?.tables || [];
      const relevant = changed.filter((table) => watched.has(table));
      if (relevant.length) callbackRef.current(relevant);
    };
    window.addEventListener(LIVE_CHANGE_EVENT, listener);
    return () => window.removeEventListener(LIVE_CHANGE_EVENT, listener);
  }, [key, enabled]);
}
