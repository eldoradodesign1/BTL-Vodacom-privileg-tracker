import { getRuntimeSupabaseConfig } from './appConfig';

export type TransactionOcrStatus = 'identified' | 'unreadable' | 'date_mismatch' | 'not_configured' | 'unavailable' | 'invalid_image';

export interface TransactionOcrResult {
  transactionId: string | null;
  available: boolean;
  status: TransactionOcrStatus;
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Lecture de la capture impossible.'));
    reader.readAsDataURL(file);
  });
}

export async function identifyTransactionReference(file: File, transactionDate: string): Promise<TransactionOcrResult> {
  const config = getRuntimeSupabaseConfig();
  if (!config) return { transactionId: null, available: false, status: 'not_configured' };
  const imageDataUrl = await toDataUrl(file);
  const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/merchant-transaction-ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.anonKey },
    body: JSON.stringify({ imageDataUrl, transactionDate }),
  });
  const payload = await response.json() as { transactionId?: string | null; status?: TransactionOcrStatus };
  const status = payload.status || 'unavailable';
  if (!response.ok) return { transactionId: null, available: false, status };
  return {
    transactionId: payload.transactionId?.trim() || null,
    available: status !== 'not_configured' && status !== 'unavailable',
    status,
  };
}
