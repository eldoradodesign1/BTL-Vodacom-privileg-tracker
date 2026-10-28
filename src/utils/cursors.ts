import type { ThemeMode } from './themes';

// Curseurs précieux, teintés par la matière : flèche, main, texte, interdit, déplacement.
// Vectoriels (nets à toute densité), générés pour le thème actif et posés en variables CSS sur <body>.
// Chaque forme : halo clair (lisible sur fond sombre), liseré sombre, dégradé de métal, facette de lumière, filet clair intérieur, ombre douce.

type Tone = { hi: string; mid: string; low: string; edge: string };

const TONES: Record<ThemeMode, Tone> = {
  anthracite: { hi: '#8d939f', mid: '#3a3e46', low: '#121418', edge: '#050607' },
  silver: { hi: '#f6f8fb', mid: '#aab1bd', low: '#5b6270', edge: '#2b3038' },
  diamond: { hi: '#ffffff', mid: '#e1e8f3', low: '#9ba9c1', edge: '#56637b' },
  sapphire: { hi: '#86b6ff', mid: '#2158e6', low: '#0a2378', edge: '#06123f' },
  tanzanite: { hi: '#b7adff', mid: '#5b44e0', low: '#26178a', edge: '#140b4d' },
  aiguemarine: { hi: '#95eaff', mid: '#1aa6cf', low: '#0a5470', edge: '#052f40' },
  turquoise: { hi: '#95f3e4', mid: '#17b3a0', low: '#0a5f58', edge: '#053531' },
  emeraude: { hi: '#84f0bc', mid: '#14a866', low: '#07502f', edge: '#032a19' },
  jade: { hi: '#e0f8ea', mid: '#84cda7', low: '#2f8a62', edge: '#1a5a3e' },
  amethyste: { hi: '#d8b9ff', mid: '#8a3ff0', low: '#3d1288', edge: '#210848' },
  rubis: { hi: '#ff94aa', mid: '#d01b45', low: '#6e0a20', edge: '#3d0511' },
  jaspe: { hi: '#ffd8c6', mid: '#e08a66', low: '#a24a2a', edge: '#6a2b16' },
  ambre: { hi: '#ffd685', mid: '#d98a14', low: '#7a3f04', edge: '#452202' },
  citrine: { hi: '#fff2b0', mid: '#f0bd2e', low: '#a87a06', edge: '#6b4c03' },
};

type Shape = {
  paths: Array<{ d: string; evenodd?: boolean }>;
  hotspot: [number, number];
  fallback: string;
};

const SHAPES = {
  default: {
    paths: [{ d: 'M5 3.2 L5 24.6 L10.3 19.7 L13.9 27.7 L17.3 26.2 L13.8 18.4 L21 18.4 Z' }],
    hotspot: [5, 3],
    fallback: 'default',
  },
  pointer: {
    paths: [{ d: 'M12.2 2.6c1.1 0 1.9.9 1.9 2V12c.4-.6 1.1-.9 1.8-.9 1 0 1.8.7 1.9 1.6.4-.5 1-.8 1.7-.8 1 0 1.8.8 1.8 1.8.4-.4.9-.6 1.5-.6 1 0 1.7.8 1.7 1.7V20c0 4.2-3 7.5-7.2 7.5h-2.7c-2.4 0-4.4-1.1-5.7-3L5 19.1c-.6-.9-.4-2.1.5-2.7.8-.5 1.9-.4 2.5.4l2.3 2.6V4.6c0-1.1.8-2 1.9-2Z' }],
    hotspot: [12, 3],
    fallback: 'pointer',
  },
  text: {
    paths: [{ d: 'M11 5h3.1c.9 0 1.5.3 1.9.8.4-.5 1-.8 1.9-.8H21v1.8h-2.5c-.9 0-1.4.5-1.4 1.4V15h1.8v2h-1.8v6.6c0 .9.5 1.4 1.4 1.4H21v1.8h-3.1c-.9 0-1.5-.3-1.9-.8-.4.5-1 .8-1.9.8H11V25h2.5c.9 0 1.4-.5 1.4-1.4V17h-1.8v-2h1.8V8.2c0-.9-.5-1.4-1.4-1.4H11Z' }],
    hotspot: [16, 16],
    fallback: 'text',
  },
  notAllowed: {
    paths: [
      { d: 'M16 5A11 11 0 1 1 15.99 5ZM16 8.4A7.6 7.6 0 1 0 16.01 8.4Z', evenodd: true },
      { d: 'M9.28 11.55 20.46 22.72 22.72 20.46 11.55 9.28Z' },
    ],
    hotspot: [16, 16],
    fallback: 'not-allowed',
  },
  move: {
    paths: [{ d: 'M16 2.5 20.2 7h-2.9v7.7H25v-2.9l4.5 4.2-4.5 4.2v-2.9h-7.7V25h2.9L16 29.5 11.8 25h2.9v-7.7H7v2.9L2.5 16 7 11.8v2.9h7.7V7h-2.9Z' }],
    hotspot: [16, 16],
    fallback: 'move',
  },
} satisfies Record<string, Shape>;

export type CursorKind = keyof typeof SHAPES;

const svgFor = ({ paths }: Shape, tone: Tone) => {
  const shapes = paths.map(({ d, evenodd }) => `<path d="${d}"${evenodd ? ' fill-rule="evenodd" clip-rule="evenodd"' : ''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">`
    + `<defs>`
    + `<linearGradient id="m" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stop-color="${tone.hi}"/><stop offset=".48" stop-color="${tone.mid}"/><stop offset="1" stop-color="${tone.low}"/></linearGradient>`
    + `<linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".4" stop-color="#fff" stop-opacity=".14"/><stop offset=".41" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>`
    + `<clipPath id="c">${shapes}</clipPath>`
    + `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.1" stdDeviation="1" flood-color="#000" flood-opacity=".42"/></filter>`
    + `</defs>`
    + `<g filter="url(#s)"><g fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.8" stroke-linejoin="round">${shapes}</g><g fill="url(#m)" stroke="${tone.edge}" stroke-width="1.3" stroke-linejoin="round" paint-order="stroke">${shapes}</g></g>`
    + `<g fill="url(#f)">${shapes}</g>`
    + `<g clip-path="url(#c)" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linejoin="round">${shapes}</g>`
    + `</svg>`;
};

export const cursorValue = (kind: CursorKind, theme: ThemeMode) => {
  const shape: Shape = SHAPES[kind];
  const uri = `data:image/svg+xml,${encodeURIComponent(svgFor(shape, TONES[theme] || TONES.sapphire))}`;
  return `url("${uri}") ${shape.hotspot[0]} ${shape.hotspot[1]}, ${shape.fallback}`;
};

const VARIABLES: Record<CursorKind, string> = {
  default: '--cursor-default',
  pointer: '--cursor-pointer',
  text: '--cursor-text',
  notAllowed: '--cursor-not-allowed',
  move: '--cursor-move',
};

export const applyCursors = (theme: ThemeMode) => {
  (Object.keys(VARIABLES) as CursorKind[]).forEach((kind) => document.body.style.setProperty(VARIABLES[kind], cursorValue(kind, theme)));
};
