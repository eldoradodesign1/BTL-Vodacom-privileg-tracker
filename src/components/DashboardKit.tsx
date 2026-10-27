import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { DateIconPicker } from './DateIconPicker';

// Briques communes des accueils de campagne, dans cet ordre : bienvenue, jauge (CampaignProgressGauge),
// anneaux des targets, courbe de progression, barres face à l'objectif. Couleurs : matière du thème.

const useWidth = (fallback: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
};

const formatNumber = (value: number) => value.toLocaleString('fr-FR');

/** Menu de choix compact (période, indicateur) qui se matérialise au-dessus du contenu. */
export const ChoiceMenu: React.FC<{ options: Array<{ key: string; label: string }>; value: string; onChange: (key: string) => void }> = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.key === value) || options[0];
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--m-edge-soft)] bg-[var(--m-tile)] px-3 text-sm font-bold text-[var(--m-text)]"
      >
        {current?.label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="app-popover absolute right-0 top-11 z-50 grid w-48 gap-0.5 border p-2">
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={option.key === current?.key}
                onClick={() => { onChange(option.key); setOpen(false); }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--m-text)] hover:bg-[var(--m-tile)]"
              >
                {option.label}
                {option.key === current?.key && <Check className="ml-auto h-4 w-4 text-[var(--m-accent)]" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface WelcomeHeaderProps {
  eyebrow: string;
  name: string;
  subtitle: string;
  date?: string;
  minDate?: string;
  maxDate?: string;
  onDateChange?: (date: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** En-tête d'accueil : salutation, rôle de l'écran, date consultée. */
export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ eyebrow, name, subtitle, date, minDate, maxDate, onDateChange, onRefresh, refreshing }) => (
  <section data-slot="welcome" className="glass-card space-y-4 !p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--m-accent)]">{eyebrow}</p>
        <h1 className="mt-1 text-[1.75rem] font-extrabold leading-tight tracking-tight text-[var(--m-text)]">
          Bonjour, <span className="text-[var(--m-accent)]">{name.split(/\s+/)[0]}.</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--m-text-2)]">{subtitle}</p>
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} aria-label="Actualiser" className="app-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
    {date && onDateChange && (
      <div className="flex items-center gap-2 rounded-[18px] bg-[var(--m-tile)] p-2">
        <DateIconPicker
          value={date}
          min={minDate}
          max={maxDate}
          onChange={onDateChange}
          className="flex min-w-0 flex-1 items-center"
          buttonClassName="h-10 w-10 shrink-0 rounded-xl border"
          labelClassName="truncate text-sm font-bold text-[var(--m-text)]"
          popoverAlign="left"
        />
        {maxDate && date !== maxDate && (
          <button type="button" onClick={() => onDateChange(maxDate)} className="shrink-0 rounded-xl border border-[var(--m-edge-soft)] px-3 py-2 text-sm font-bold text-[var(--m-accent)]">
            Aujourd’hui
          </button>
        )}
      </div>
    )}
  </section>
);

export interface TargetRing {
  label: string;
  value: number;
  target: number;
  color?: string;
  /** Texte sous l'anneau ; par défaut « réalisé / target ». */
  caption?: string;
}

const Ring: React.FC<TargetRing> = ({ label, value, target, color = 'var(--m-chart-1)', caption }) => {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const fraction = target > 0 ? Math.min(value / target, 1) : 0;
  const percent = target > 0 ? Math.round((value / target) * 100) : null;
  return (
    <div className="grid min-w-0 justify-items-center gap-1.5 rounded-[18px] bg-[var(--m-tile)] px-2 py-3 text-center">
      <span className="w-full truncate text-xs font-semibold text-[var(--m-text-2)]">{label}</span>
      <svg viewBox="0 0 88 88" className="h-24 w-24" role="img" aria-label={percent === null ? `${label} : ${value}, objectif non défini` : `${label} : ${percent} %`}>
        <circle cx={44} cy={44} r={radius} fill="none" strokeWidth={9} style={{ stroke: 'var(--m-track)' }} />
        {fraction > 0 && <circle
          cx={44}
          cy={44}
          r={radius}
          fill="none"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${fraction * circumference} ${circumference}`}
          transform="rotate(-90 44 44)"
          style={{ stroke: color, filter: `drop-shadow(0 0 4px color-mix(in srgb, ${color} 55%, transparent))`, transition: 'stroke-dasharray 400ms cubic-bezier(0.2, 0.9, 0.3, 1)' }}
        />}
        <text x={44} y={44} textAnchor="middle" fontSize={17} fontWeight={800} style={{ fill: 'var(--m-text)' }}>{formatNumber(value)}</text>
        <text x={44} y={59} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--m-muted)' }}>{percent === null ? '—' : `${percent} %`}</text>
      </svg>
      <span className="w-full truncate text-xs text-[var(--m-muted)]">{caption ?? (target > 0 ? `${formatNumber(value)} / ${formatNumber(target)}` : 'Sans objectif')}</span>
    </div>
  );
};

/** Anneaux des targets du jour consulté. */
export const TargetRings: React.FC<{ title: string; subtitle?: string; rings: TargetRing[] }> = ({ title, subtitle, rings }) => (
  <section data-slot="rings" className="glass-card space-y-3 !p-5">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-base font-bold text-[var(--m-text)]">{title}</h3>
      {subtitle && <span className="shrink-0 text-xs font-semibold text-[var(--m-text-2)]">{subtitle}</span>}
    </div>
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${rings.length === 4 ? 2 : Math.min(rings.length, 3)}, minmax(0, 1fr))` }}>
      {rings.map((ring) => <Ring key={ring.label} {...ring} />)}
    </div>
  </section>
);

export interface TrendSeries {
  key: string;
  label: string;
  values: number[];
  color?: string;
}

export interface TrendView {
  key: string;
  label: string;
  labels: string[];
  series: TrendSeries[];
  target?: number[];
  targetLabel?: string;
}

const smoothPath = (points: Array<[number, number]>) => {
  if (points.length === 0) return '';
  let path = `M${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    // Tangentes adoucies, bornées verticalement pour ne pas passer sous zéro entre deux points nuls.
    const c1y = Math.min(Math.max(p1[1] + (p2[1] - p0[1]) / 6, Math.min(p1[1], p2[1])), Math.max(p1[1], p2[1]));
    const c2y = Math.min(Math.max(p2[1] - (p3[1] - p1[1]) / 6, Math.min(p1[1], p2[1])), Math.max(p1[1], p2[1]));
    path += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${c1y} ${p2[0] - (p3[0] - p1[0]) / 6} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return path;
};

/** Courbe de progression : aire en dégradé, objectif en pointillé, bulle de lecture au pic ou au survol. */
export const TrendChart: React.FC<{ title: string; subtitle?: string; views: TrendView[] }> = ({ title, subtitle, views }) => {
  const [viewKey, setViewKey] = useState(views[0]?.key || '');
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width } = useWidth(520);
  const gradientId = useRef(`trend-${Math.random().toString(36).slice(2, 8)}`).current;
  const view = views.find((item) => item.key === viewKey) || views[0];
  if (!view) return null;
  const height = 190;
  const left = 32;
  const right = 10;
  const top = 26;
  const bottom = 24;
  const count = view.labels.length;
  const all = [...view.series.flatMap((serie) => serie.values), ...(view.target || [])];
  // Graduations rondes (1, 2, 2,5 ou 5 × 10ⁿ) : quatre intervalles égaux.
  const rough = Math.max(4, ...all) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const ratio = rough / magnitude;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10) * magnitude;
  const max = step * 4;
  const x = (index: number) => left + (count > 1 ? (index * (width - left - right)) / (count - 1) : (width - left - right) / 2);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const main = view.series[0];
  const peak = main ? main.values.indexOf(Math.max(...main.values)) : 0;
  const focus = hover ?? (main && main.values[peak] > 0 ? peak : null);
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor((width - left - right) / 54))));
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const index = Math.round(((px - left) / (width - left - right)) * (count - 1));
    setHover(Math.min(Math.max(index, 0), count - 1));
  };
  const tooltip = focus === null ? '' : [view.labels[focus], ...view.series.map((serie) => `${formatNumber(serie.values[focus] || 0)} ${serie.label.toLowerCase()}`)].join(' · ');
  const tooltipWidth = Math.min(width - left - right, tooltip.length * 6.2 + 20);
  return (
    <section data-slot="trend" className="glass-card space-y-2 !p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[var(--m-text)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--m-text-2)]">{subtitle}</p>}
        </div>
        {views.length > 1 && <ChoiceMenu options={views.map((item) => ({ key: item.key, label: item.label }))} value={view.key} onChange={(key) => { setViewKey(key); setHover(null); }} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--m-text-2)]">
        {view.series.map((serie, index) => (
          <span key={serie.key} className="inline-flex items-center gap-1.5">
            <i className="block h-2.5 w-2.5 rounded-full" style={{ background: serie.color || (index === 0 ? 'var(--m-chart-1)' : 'var(--m-chart-3)') }} />{serie.label}
          </span>
        ))}
        {view.target && <span className="inline-flex items-center gap-1.5"><i className="block w-3.5 border-t-2 border-dotted border-[var(--m-text-2)]" />{view.targetLabel || 'Objectif'}</span>}
      </div>
      <div ref={ref}>
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full touch-pan-y" role="img" aria-label={`${title} · ${view.label}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: main?.color || 'var(--m-chart-1)', stopOpacity: 0.5 }} />
              <stop offset="1" style={{ stopColor: main?.color || 'var(--m-chart-1)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {Array.from({ length: 5 }, (_, index) => (max / 4) * index).map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} style={{ stroke: 'var(--m-edge-soft)' }} />
              <text x={left - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} style={{ fill: 'var(--m-muted)' }}>{formatNumber(Math.round(tick))}</text>
            </g>
          ))}
          {view.labels.map((label, index) => (index % labelEvery === 0 || index === count - 1) && (index === count - 1 || count - 1 - index >= labelEvery / 2)
            ? <text key={index} x={x(index)} y={height - 6} textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'} fontSize={11} style={{ fill: 'var(--m-muted)' }}>{label}</text>
            : null)}
          {main && count > 1 && (
            <path d={`${smoothPath(main.values.map((value, index) => [x(index), y(value)] as [number, number]))} L${x(count - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${gradientId})`} />
          )}
          {view.target && count > 1 && (
            <path d={smoothPath(view.target.map((value, index) => [x(index), y(value)] as [number, number]))} fill="none" strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" style={{ stroke: 'var(--m-text-2)' }} />
          )}
          {view.series.map((serie, index) => (
            <path key={serie.key} d={smoothPath(serie.values.map((value, point) => [x(point), y(value)] as [number, number]))} fill="none" strokeWidth={index === 0 ? 2.4 : 1.8} style={{ stroke: serie.color || (index === 0 ? 'var(--m-chart-1)' : 'var(--m-chart-3)') }} />
          ))}
          {focus !== null && (
            <g>
              <line x1={x(focus)} x2={x(focus)} y1={top} y2={y(0)} strokeDasharray="3 3" style={{ stroke: 'var(--m-text-2)', opacity: 0.55 }} />
              {view.series.map((serie, index) => (
                <circle key={serie.key} cx={x(focus)} cy={y(serie.values[focus] || 0)} r={index === 0 ? 4.5 : 3.5} strokeWidth={2} style={{ fill: 'var(--m-text)', stroke: serie.color || (index === 0 ? 'var(--m-chart-1)' : 'var(--m-chart-3)') }} />
              ))}
              <g transform={`translate(${Math.min(Math.max(x(focus) - tooltipWidth / 2, left), width - right - tooltipWidth)} 2)`}>
                <rect width={tooltipWidth} height={20} rx={10} style={{ fill: 'var(--m-sheet)', stroke: 'var(--m-hair)' }} />
                <text x={tooltipWidth / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--m-text)' }}>{tooltip}</text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </section>
  );
};

export interface TargetBar {
  key: string;
  label: string;
  value: number;
  target: number;
}

/** Barres face à l'objectif : longueur = réalisé, trait = target. Classées du plus avancé au moins avancé. */
export const TargetBars: React.FC<{ title: string; subtitle?: string; rows: TargetBar[]; unit?: string; limit?: number; emptyText?: string; action?: React.ReactNode }> = ({ title, subtitle, rows, unit = '', limit = 6, emptyText = 'Aucune donnée pour ce jour.', action }) => {
  const [expanded, setExpanded] = useState(false);
  const scale = Math.max(1, ...rows.map((row) => Math.max(row.value, row.target)));
  const ratio = (row: TargetBar) => (row.target > 0 ? row.value / row.target : row.value > 0 ? 1 : 0);
  const sorted = [...rows].sort((a, b) => ratio(b) - ratio(a) || b.value - a.value);
  const visible = expanded ? sorted : sorted.slice(0, limit);
  return (
    <section data-slot="bars" className="glass-card space-y-3 !p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[var(--m-text)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--m-text-2)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {rows.length === 0 ? <p className="text-sm text-[var(--m-text-2)]">{emptyText}</p> : (
        <div className="space-y-3.5">
          {visible.map((row) => (
            <div key={row.key} className="grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-[var(--m-text)]">{row.label}</span>
              <div className="relative h-2.5 rounded-full bg-[var(--m-track)]">
                <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(row.value / scale) * 100}%`, background: 'linear-gradient(90deg, var(--m-chart-3), var(--m-chart-1))' }} />
                {row.target > 0 && <b className="absolute -bottom-1 -top-1 w-0.5 rounded bg-[var(--m-text)]" style={{ left: `calc(${(row.target / scale) * 100}% - 1px)` }} />}
              </div>
              <span className="text-right font-bold tabular-nums text-[var(--m-text)]">{formatNumber(row.value)}<span className="font-medium text-[var(--m-muted)]">{row.target > 0 ? ` / ${formatNumber(row.target)}` : ''}{unit ? ` ${unit}` : ''}</span></span>
            </div>
          ))}
        </div>
      )}
      {rows.length > limit && (
        <button type="button" onClick={() => setExpanded((state) => !state)} className="text-sm font-semibold text-[var(--m-accent)]">
          {expanded ? 'Afficher moins' : `Afficher les ${rows.length}`}
        </button>
      )}
    </section>
  );
};
