export type BackgroundOperationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface BackgroundOperation {
  id: string;
  label: string;
  status: BackgroundOperationStatus;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

const BACKGROUND_OPERATIONS_KEY = 'btl_background_operations_v1';
const MAX_HISTORY = 40;

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

export function showOperationToast(message: string, level: 'success' | 'error' = 'success'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('vodacom-toast', { detail: { message, level } }));
}

export function runInBackground<T>(label: string, task: () => Promise<T>, messages: { queued?: string; success?: string; error?: string; onSuccess?: (result: T) => void; onError?: (error: Error) => void } = {}): BackgroundOperation {
  const operation: BackgroundOperation = {
    id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    status: 'queued',
    createdAt: Date.now(),
  };
  saveHistory([operation, ...getHistory()]);
  if (messages.queued) showOperationToast(messages.queued);

  window.setTimeout(() => {
    updateOperation(operation.id, { status: 'running' });
    void task()
      .then((result) => {
        updateOperation(operation.id, { status: 'succeeded', completedAt: Date.now() });
        messages.onSuccess?.(result);
        showOperationToast(messages.success || `${label} synchronisé.`);
      })
      .catch((caught) => {
        const error = caught instanceof Error ? caught : new Error('Erreur de synchronisation.');
        updateOperation(operation.id, { status: 'failed', completedAt: Date.now(), error: error.message });
        messages.onError?.(error);
        showOperationToast(messages.error || `${label} non synchronisé : ${error.message}`, 'error');
      });
  }, 0);

  return operation;
}

export function getBackgroundOperations(): BackgroundOperation[] {
  return getHistory();
}
