import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { loadSharedRuntimeConfig } from './utils/appConfig';
import './index.css';
import { installSheetGestures } from './utils/sheetGestures';

installSheetGestures();

let audioContext: AudioContext | null = null;

const playClickSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext) {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.0001;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.03, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.12);
    oscillator.stop(audioContext.currentTime + 0.13);
  } catch {
    // Ignore audio issues on unsupported browsers.
  }
};

const attachClickSound = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('click', playClickSound, { passive: true });
};

if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
  attachClickSound();
}

if ('serviceWorker' in navigator) {
  let refreshingAfterUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingAfterUpdate) return;
    refreshingAfterUpdate = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    void navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).then((registration) => {
      void registration.update();
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }).catch(() => {
      // L'application reste totalement fonctionnelle si le cache PWA est indisponible.
    });
  });
}

class AppRenderBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: Error) {
    console.error('BTL Tracker: erreur de rendu interceptée.', error);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <main role="alert" style={{
        minHeight: '100dvh', padding: '22vh 22px 30px', textAlign: 'center',
        color: '#fff', fontFamily: 'system-ui, sans-serif',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Erreur d'affichage</h1>
        <p style={{ margin: '16px auto', maxWidth: '340px', lineHeight: 1.5 }}>
          L'interface a rencontré une erreur. Tes données restent conservées.
        </p>
        <button type="button" style={{
          background: '#fb7185', border: 0, borderRadius: '14px',
          padding: '14px 24px', fontWeight: 800, color: '#180e13',
        }} onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set('recovery', String(Date.now()));
          window.location.replace(url.href);
        }}>Rafraîchir l'application</button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRenderBoundary>
      <App />
    </AppRenderBoundary>
  </StrictMode>,
);

// La configuration partagée rafraîchit ensuite le cache, sans jamais bloquer le premier rendu PWA.
void loadSharedRuntimeConfig();
