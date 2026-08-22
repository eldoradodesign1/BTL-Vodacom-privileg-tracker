import { getGeminiApiKey } from './appConfig';

export interface TransactionOcrResult {
  transactionId: string | null;
  available: boolean;
}

function toBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const match = raw.match(/^data:(.+);base64,(.+)$/);
      if (!match) return reject(new Error('Format image non pris en charge.'));
      resolve({ mimeType: match[1], data: match[2] });
    };
    reader.onerror = () => reject(new Error('Lecture de la capture impossible.'));
    reader.readAsDataURL(file);
  });
}

function extractIdentifier(value: string): string | null {
  const normalized = value.trim();
  if (!normalized || /null|illisible|non visible|inconnu/i.test(normalized)) return null;
  const direct = normalized.match(/[A-Z0-9][A-Z0-9\-_/]{4,}/i);
  return direct ? direct[0] : null;
}

export async function identifyTransactionReference(file: File): Promise<TransactionOcrResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return { transactionId: null, available: false };
  const image = await toBase64(file);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      contents: [{
        role: 'user',
        parts: [
          { text: 'Analyse cette capture de transaction. Retourne uniquement un objet JSON {"transactionId":"..."} avec le numéro ou identifiant de transaction lisible. Si aucun identifiant n’est clairement visible, retourne {"transactionId":null}. Ne devine jamais.' },
          { inlineData: { mimeType: image.mimeType, data: image.data } }
        ]
      }]
    })
  });
  if (!response.ok) throw new Error('Analyse OCR indisponible.');
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  try {
    const parsed = JSON.parse(text) as { transactionId?: string | null };
    return { transactionId: extractIdentifier(parsed.transactionId || ''), available: true };
  } catch {
    return { transactionId: extractIdentifier(text), available: true };
  }
}
