import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isSupabaseConfigured } from './utils/supabase';

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

attachClickSound();

console.log('Supabase config check:', isSupabaseConfigured());
console.log('Supabase URL present:', Boolean(import.meta.env.VITE_SUPABASE_URL));
console.log('Supabase anon key present:', Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
