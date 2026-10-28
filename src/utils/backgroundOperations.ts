export type BackgroundOperationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface BackgroundOperation {
  id: string;
  label: string;
  status: BackgroundOperationStatus;
  createdAt: number;
  completedAt?: number;
  error?: string;
  attempts?: number;
}

/** Contexte transmis à chaque tentative : `key` reste identique d’un renvoi à l’autre. */
export interface BackgroundTaskContext {
  key: string;
  attempt: number;
}

const BACKGROUND_OPERATIONS_KEY = 'btl_background_operations_v1';
const MAX_HISTORY = 40;
// Renvois espacés : 2 s, 5 s, 10 s, 20 s puis toutes les 30 s, pendant ~15 min.
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];
const RETRY_MAX_DELAY_MS = 30_000;
const RETRY_WINDOW_MS = 15 * 60_000;

function getHistory(): BackgroundOperation[] {
  try {
    const raw = localStorage.getItem(BACKGROUND_OPERATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as BackgroundOperation[] : [];
  } catch {
    return [];
  }
}

function saveHistory(operations: BackgroundOperation[]): void {
  try {
    localStorage.setItem(BACKGROUND_OPERATIONS_KEY, JSON.stringify(operations.slice(0, MAX_HISTORY)));
  } catch {
    // L’historique ne doit jamais bloquer le travail terrain.
  }
}

function updateOperation(id: string, patch: Partial<BackgroundOperation>): void {
  saveHistory(getHistory().map((operation) => operation.id === id ? { ...operation, ...patch } : operation));
}

function newOperationKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Une coupure réseau (ou un serveur momentanément indisponible) mérite un
 * renvoi automatique ; une règle métier refusée (quota, POS déjà pris…) non.
 */
export function isTransientError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error || '');
  return /failed to fetch|fetch failed|networkerror|network request|load failed|network error|timed? ?out|timeout|aborterror|aborted|econn|socket|upstream|gateway|\b50[234]\b|\b52[24]\b|service unavailable|offline/i.test(message);
}

function waitForRetry(delay: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener('online', finish);
      document.removeEventListener('visibilitychange', onVisible);
      resolve();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') finish(); };
    const timer = window.setTimeout(finish, delay);
    // Le retour du réseau ou de l’appli au premier plan relance tout de suite.
    window.addEventListener('online', finish);
    document.addEventListener('visibilitychange', onVisible);
  });
}

export function showOperationToast(message: string, level: 'success' | 'error' = 'success'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('vodacom-toast', { detail: { message, level } }));
}

export function runInBackground<T>(label: string, task: (context: BackgroundTaskContext) => Promise<T>, messages: { queued?: string; success?: string; error?: string; onSuccess?: (result: T) => void; onError?: (error: Error) => void } = {}): BackgroundOperation {
  const operation: BackgroundOperation = {
    id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    status: 'queued',
    createdAt: Date.now(),
  };
  const key = newOperationKey();
  saveHistory([operation, ...getHistory()]);
  if (messages.queued) showOperationToast(messages.queued);

  const attemptTask = async (attempt: number): Promise<void> => {
    updateOperation(operation.id, { status: 'running', attempts: attempt });
    try {
      const result = await task({ key, attempt });
      updateOperation(operation.id, { status: 'succeeded', completedAt: Date.now(), error: undefined });
      messages.onSuccess?.(result);
      showOperationToast(messages.success || `${label} synchronisé.`);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error('Erreur de synchronisation.');
      const withinWindow = Date.now() - operation.createdAt < RETRY_WINDOW_MS;
      if (isTransientError(error) && withinWindow) {
        updateOperation(operation.id, { status: 'queued', error: error.message });
        console.warn(`${label} : nouvelle tentative automatique`, error);
        await waitForRetry(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_MAX_DELAY_MS);
        return attemptTask(attempt + 1);
      }
      updateOperation(operation.id, { status: 'failed', completedAt: Date.now(), error: error.message });
      messages.onError?.(error);
      showOperationToast(messages.error || `${label} non synchronisé : ${error.message}`, 'error');
    }
  };

  window.setTimeout(() => { void attemptTask(1); }, 0);

  return operation;
}

export function getBackgroundOperations(): BackgroundOperation[] {
  return getHistory();
}
