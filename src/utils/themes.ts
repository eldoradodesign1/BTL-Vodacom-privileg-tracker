import { publicUrl } from './assets';
import { applyCursors } from './cursors';

// Catalogue des matières : les pierres précieuses et métaux de l'appli. Le CSS de chaque matière vit dans styles/themes.css.

export type ThemeMode =
  | 'anthracite' | 'silver' | 'diamond'
  | 'sapphire' | 'tanzanite' | 'aiguemarine' | 'turquoise'
  | 'emeraude' | 'jade' | 'amethyste'
  | 'rubis' | 'jaspe' | 'ambre' | 'citrine';

export interface ThemeOption {
  key: ThemeMode;
  label: string;
  light: boolean;
}

/** Ordre d'affichage : les métaux, puis les pierres par famille de couleur. */
export const THEME_OPTIONS: ThemeOption[] = [
  { key: 'anthracite', label: 'Anthracite', light: false },
  { key: 'silver', label: 'Silver', light: false },
  { key: 'diamond', label: 'Diamond', light: true },
  { key: 'sapphire', label: 'Sapphire', light: false },
  { key: 'tanzanite', label: 'Tanzanite', light: false },
  { key: 'aiguemarine', label: 'Aigue-marine', light: false },
  { key: 'turquoise', label: 'Turquoise', light: false },
  { key: 'emeraude', label: 'Émeraude', light: false },
  { key: 'jade', label: 'Jade', light: true },
  { key: 'amethyste', label: 'Améthyste', light: false },
  { key: 'rubis', label: 'Rubis', light: false },
  { key: 'jaspe', label: 'Jaspe', light: true },
  { key: 'ambre', label: 'Ambre', light: false },
  { key: 'citrine', label: 'Citrine', light: true },
];

export const isThemeMode = (value: unknown): value is ThemeMode => THEME_OPTIONS.some((option) => option.key === value);
export const isLightTheme = (theme: ThemeMode) => THEME_OPTIONS.find((option) => option.key === theme)?.light ?? false;

/** Image du podium et filtre associé : les thèmes clairs reprennent le podium Diamond, les chauds celui d'Ambre. */
export const podiumAssetFor = (theme: ThemeMode) => (
  isLightTheme(theme) ? 'podium-diamond.jpg'
    : theme === 'ambre' || theme === 'rubis' ? 'podium-ambre.jpg'
      : 'podium-silver.jpg'
);

// Opacité des cartes (0 = vitre givrée, 50 = apparence de référence, 100 = opaque), réglée dans l'onglet Thèmes et gardée sur l'appareil.
const SOLIDITY_KEY = 'vodacom_ui_solidity';

export const getCardSolidity = (): number => {
  try {
    const stored = localStorage.getItem(SOLIDITY_KEY);
    const value = stored === null ? 50 : Number(stored);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
  } catch {
    return 50;
  }
};

let solidityWrite: number | undefined;

/** Applique l'opacité tout de suite ; l'enregistrement sur l'appareil attend la fin du geste. */
export const applyCardSolidity = (value: number) => {
  document.body.style.setProperty('--ui-solidity', `${value}%`);
  document.body.style.setProperty('--ui-solidity-n', String(value));
  window.clearTimeout(solidityWrite);
  solidityWrite = window.setTimeout(() => {
    try { localStorage.setItem(SOLIDITY_KEY, String(value)); } catch { /* préférence locale facultative */ }
  }, 250);
};

// Flou d'arrière-plan des cartes, de la barre et de l'en-tête (px). Sans réglage, chaque matière garde le sien.
const BLUR_KEY = 'vodacom_ui_blur';
export const DEFAULT_BLUR = 38;

export const getBackdropBlur = (): number | null => {
  try {
    const stored = localStorage.getItem(BLUR_KEY);
    if (stored === null) return null;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(60, Math.max(0, value)) : null;
  } catch {
    return null;
  }
};

let blurWrite: number | undefined;

export const applyBackdropBlur = (value: number | null) => {
  if (value === null) document.body.style.removeProperty('--ui-blur');
  else document.body.style.setProperty('--ui-blur', `${value}px`);
  window.clearTimeout(blurWrite);
  if (value === null) return;
  blurWrite = window.setTimeout(() => {
    try { localStorage.setItem(BLUR_KEY, String(value)); } catch { /* préférence locale facultative */ }
  }, 250);
};

// Ombre portée et lueur externe des cartes et de la barre (0 à 100 ; 50 = apparence de référence).
const levelSetting = (key: string, cssVar: string) => {
  let pending: number | undefined;
  return {
    get: (): number => {
      try {
        const stored = localStorage.getItem(key);
        const value = stored === null ? 50 : Number(stored);
        return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
      } catch {
        return 50;
      }
    },
    apply: (value: number) => {
      document.body.style.setProperty(cssVar, String(value));
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        try { localStorage.setItem(key, String(value)); } catch { /* préférence locale facultative */ }
      }, 250);
    },
  };
};

export const shadowLevel = levelSetting('vodacom_ui_shadow', '--ui-shadow-n');
export const glowLevel = levelSetting('vodacom_ui_glow', '--ui-glow-n');

/** Pose la matière sur le document : attribut, fond soie et podium. */
export const applyThemeToDocument = (theme: ThemeMode) => {
  document.body.dataset.theme = theme;
  document.body.style.setProperty('--m-silk-image', `url("${publicUrl(`theme-backgrounds/silk-${theme}.jpg`)}")`);
  document.body.style.setProperty('--m-podium-image', `url("${publicUrl(`theme-backgrounds/${podiumAssetFor(theme)}`)}")`);
  applyCursors(theme);
};

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/** Change de matière en fondu enchaîné ; immédiat sans View Transitions ou avec « réduire les animations ». */
export const transitionTheme = (theme: ThemeMode, commit: () => void) => {
  const doc = document as ViewTransitionDocument;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const update = () => { applyThemeToDocument(theme); commit(); };
  if (!doc.startViewTransition || reduced) update();
  else doc.startViewTransition(update);
};
