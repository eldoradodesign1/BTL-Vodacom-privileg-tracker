export interface FundRequestAlertPayload {
  id: string;
  baName: string;
  amount: number;
  posLabel: string;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  return audioContext;
}

export async function armFundRequestAlertAudio(): Promise<void> {
  try {
    const context = getAudioContext();
    if (context?.state === 'suspended') await context.resume();
  } catch {
    // Certains terminaux ne permettent de déverrouiller l’audio qu’après une interaction explicite.
  }
}

function playPattern(context: AudioContext): void {
  const pattern = [
    { offset: 0, frequency: 880, duration: 0.18 },
    { offset: 0.26, frequency: 1046.5, duration: 0.18 },
    { offset: 0.52, frequency: 880, duration: 0.18 },
    { offset: 0.78, frequency: 1174.7, duration: 0.28 },
    { offset: 1.22, frequency: 880, duration: 0.18 },
    { offset: 1.48, frequency: 1174.7, duration: 0.38 },
  ];
  const startAt = context.currentTime + 0.02;
  pattern.forEach(({ offset, frequency, duration }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, startAt + offset);
    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + duration + 0.02);
  });
}

export function emitFundRequestAlertSound(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([350, 120, 350, 120, 650, 140, 900]);
  }
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().then(() => playPattern(context)).catch(() => undefined);
      return;
    }
    playPattern(context);
  } catch {
    // L’alerte système reste disponible même si le moteur audio du navigateur est indisponible.
  }
}

export async function showFundRequestSystemNotification(request: FundRequestAlertPayload): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  const options: NotificationOptions = {
    body: `${request.baName} · $${request.amount.toLocaleString('fr-FR')} · ${request.posLabel}`,
    tag: `merchant-fund-${request.id}`,
    icon: '/favicon.png',
    badge: '/favicon.png',
    requireInteraction: true,
    silent: false,
  };
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Nouvelle demande de fonds', options);
      return;
    }
    new Notification('Nouvelle demande de fonds', options);
  } catch {
    try { new Notification('Nouvelle demande de fonds', options); } catch { /* Notification indisponible. */ }
  }
}
