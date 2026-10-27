import { publicUrl } from './assets';

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

// Opacité des cartes (0 = verre, 100 = opaque), réglée dans l'onglet Thèmes et gardée sur l'appareil.
const SOLIDITY_KEY = 'vodacom_ui_solidity';

export const getCardSolidity = (): number => {
  try {
    const value = Number(localStorage.getItem(SOLIDITY_KEY));
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  } catch {
    return 0;
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

/** Pose la matière sur le document : attribut, fond soie et podium. */
export const applyThemeToDocument = (theme: ThemeMode) => {
  document.body.dataset.theme = theme;
  document.body.style.setProperty('--m-silk-image', `url("${publicUrl(`theme-backgrounds/silk-${theme}.jpg`)}")`);
  document.body.style.setProperty('--m-podium-image', `url("${publicUrl(`theme-backgrounds/${podiumAssetFor(theme)}`)}")`);
};

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Change de matière avec un dévoilement circulaire depuis le point touché.
 * Sans View Transitions (ou avec « réduire les animations »), le changement est immédiat.
 */
export const transitionTheme = (theme: ThemeMode, commit: () => void, origin?: { x: number; y: number }) => {
  const doc = document as ViewTransitionDocument;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced) {
    applyThemeToDocument(theme);
    commit();
    return;
  }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const root = document.documentElement.style;
  root.setProperty('--reveal-x', `${x}px`);
  root.setProperty('--reveal-y', `${y}px`);
  root.setProperty('--reveal-r', `${radius}px`);
  doc.startViewTransition(() => {
    applyThemeToDocument(theme);
    commit();
  });
};
