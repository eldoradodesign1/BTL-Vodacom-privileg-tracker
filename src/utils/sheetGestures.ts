/**
 * Glisser pour fermer les feuilles modales sur mobile.
 *
 * Principes (Apple, « Designing Fluid Interfaces ») :
 *  - la feuille suit le doigt 1:1 pendant le geste ;
 *  - au relâchement, on projette l'élan pour décider (fermer ou revenir) ;
 *  - le retour se fait avec un léger ressort, la sortie suit la direction du geste.
 *
 * La saisie se fait uniquement sur la poignée ou l'en-tête de la feuille, jamais sur le contenu qui défile.
 * La fermeture réelle est déléguée à la feuille elle-même (bouton « Fermer » ou fond), pour ne rien casser.
 */

const DECELERATION = 0.998;
const HYSTERESIS_PX = 10;
const GRIP_SELECTOR = '.modal-handle, .modal-sticky-header, .modal-grip';

/** Position d'arrêt projetée à partir de la vitesse de relâchement (px/s). */
const project = (velocity: number): number => ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCompact = () => window.matchMedia('(max-width: 639px)').matches;

export function installSheetGestures(): void {
  if (typeof document === 'undefined') return;

  let sheet: HTMLElement | null = null;
  let pointerId = -1;
  let startY = 0;
  let offset = 0;
  let grabbed = false;
  let samples: Array<{ y: number; t: number }> = [];

  const reset = () => {
    if (sheet) {
      sheet.style.willChange = '';
      sheet.style.transition = '';
    }
    sheet = null;
    grabbed = false;
    offset = 0;
    samples = [];
  };

  const springBack = (el: HTMLElement, from: number) => {
    if (prefersReducedMotion()) {
      el.style.transform = '';
      return;
    }
    const animation = el.animate(
      [{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }],
      { duration: 340, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.12)' },
    );
    el.style.transform = '';
    animation.onfinish = () => { el.style.transform = ''; };
  };

  const dismiss = (el: HTMLElement, from: number, velocity: number) => {
    const distance = el.getBoundingClientRect().height + 48;
    const closeNow = () => {
      const closeButton = el.querySelector<HTMLElement>('button[aria-label="Fermer"], button[aria-label="Fermer la fenêtre"]');
      const overlay = el.parentElement;
      if (closeButton) closeButton.click();
      else overlay?.click();
      // Si la feuille refuse de se fermer (formulaire protégé), on la ramène.
      window.setTimeout(() => {
        if (document.body.contains(el)) {
          el.style.transform = `translateY(${distance}px)`;
          springBack(el, distance);
        }
      }, 160);
    };
    if (prefersReducedMotion()) { closeNow(); return; }
    const duration = Math.max(160, Math.min(320, ((distance - from) / Math.max(velocity, 600)) * 1000));
    const animation = el.animate(
      [{ transform: `translateY(${from}px)` }, { transform: `translateY(${distance}px)` }],
      { duration, easing: 'cubic-bezier(0.32, 0, 0.67, 0)', fill: 'forwards' },
    );
    animation.onfinish = closeNow;
  };

  document.addEventListener('pointerdown', (event) => {
    if (!isCompact() || event.button > 0) return;
    const target = event.target as HTMLElement | null;
    const grip = target?.closest(GRIP_SELECTOR);
    const candidate = target?.closest<HTMLElement>('.modal-sheet');
    if (!grip || !candidate) return;
    if (target?.closest('button, a, input, select, textarea, label')) return;
    sheet = candidate;
    pointerId = event.pointerId;
    startY = event.clientY;
    samples = [{ y: event.clientY, t: performance.now() }];
    grabbed = false;
    offset = 0;
  }, { passive: true });

  document.addEventListener('pointermove', (event) => {
    if (!sheet || event.pointerId !== pointerId) return;
    const raw = event.clientY - startY;
    if (!grabbed) {
      if (Math.abs(raw) < HYSTERESIS_PX) return;
      if (raw < 0) { reset(); return; }
      grabbed = true;
      sheet.style.transition = 'none';
      sheet.style.willChange = 'transform';
      try { sheet.setPointerCapture(pointerId); } catch { /* capture facultative */ }
    }
    offset = Math.max(0, raw - HYSTERESIS_PX);
    sheet.style.transform = `translateY(${offset}px)`;
    const now = performance.now();
    samples.push({ y: event.clientY, t: now });
    samples = samples.filter((sample) => now - sample.t <= 120);
  }, { passive: true });

  const end = (event: PointerEvent) => {
    if (!sheet || event.pointerId !== pointerId) return;
    const el = sheet;
    const wasGrabbed = grabbed;
    const from = offset;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const velocity = first && last && last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0;
    reset();
    if (!wasGrabbed) return;
    const projected = from + project(velocity);
    if (projected > el.getBoundingClientRect().height * 0.45 || velocity > 900) dismiss(el, from, Math.max(velocity, 0));
    else springBack(el, from);
  };

  document.addEventListener('pointerup', end, { passive: true });
  document.addEventListener('pointercancel', end, { passive: true });
}
