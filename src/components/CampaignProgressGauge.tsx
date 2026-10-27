import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Jauge segmentée commune aux campagnes : un menu choisit l'indicateur (total ou un type d'activité),
// la jauge compare le réalisé à l'objectif cumulé. Les couleurs viennent de la matière du thème.

export interface ProgressMode {
  key: string;
  label: string;
  value: number;
  target: number;
  unit: string;
  /** Couleur propre au type d'activité ; le total garde le dégradé de la matière. */
  color?: string;
}

export interface ProgressLegendItem {
  label: string;
  value: number;
  color: string;
}

export const SegmentedGauge: React.FC<{ value: number; total: number; unit: string; color?: string; emptyLabel?: string }> = ({ value, total, unit, color, emptyLabel = 'objectif non défini' }) => {
  const fraction = total > 0 ? Math.min(value / total, 1) : 0;
  const cx = 150;
  const cy = 150;
  const segments = 26;
  const sweep = 115;
  const lit = Math.round(fraction * segments);
  const needle = ((-sweep + fraction * 2 * sweep) * Math.PI) / 180;
  const percent = total > 0 ? Math.round((value / total) * 1000) / 10 : null;
  const from = color || 'var(--m-chart-1)';
  const to = color ? `color-mix(in oklab, ${color} 55%, white)` : 'var(--m-chart-2)';
  return (
    <svg viewBox="0 -14 300 214" className="mx-auto block h-auto w-full max-w-[26rem]" role="img" aria-label={percent === null ? 'Objectif non défini' : `${percent} % de l’objectif`}>
      {Array.from({ length: 61 }, (_, index) => {
        const angle = ((-sweep + index * ((2 * sweep) / 60)) * Math.PI) / 180;
        const major = index % 10 === 0;
        const inner = major ? 128 : 131;
        return <line key={`t${index}`} x1={cx + inner * Math.sin(angle)} y1={cy - inner * Math.cos(angle)} x2={cx + 137 * Math.sin(angle)} y2={cy - 137 * Math.cos(angle)} strokeWidth={major ? 1.6 : 1} style={{ stroke: 'var(--m-muted)', opacity: major ? 0.9 : 0.45 }} />;
      })}
      {Array.from({ length: segments }, (_, index) => {
        const degrees = -sweep + (index + 0.5) * ((2 * sweep) / segments);
        const mix = Math.round((1 - index / (segments - 1)) * 100);
        const style = index < lit
          ? { fill: `color-mix(in oklab, ${from} ${mix}%, ${to})`, filter: `drop-shadow(0 0 4px color-mix(in srgb, ${from} 45%, transparent))` }
          : { fill: 'var(--m-track)' };
        return <rect key={`s${index}`} x={-6.5} y={-120} width={13} height={42} rx={6.5} transform={`translate(${cx} ${cy}) rotate(${degrees})`} style={style} />;
      })}
      {percent !== null && (
        <>
          <line x1={cx + 98 * Math.sin(needle)} y1={cy - 98 * Math.cos(needle)} x2={cx + 136 * Math.sin(needle)} y2={cy - 136 * Math.cos(needle)} strokeWidth={2.4} strokeLinecap="round" style={{ stroke: 'var(--m-text)' }} />
          <circle cx={cx + 136 * Math.sin(needle)} cy={cy - 136 * Math.cos(needle)} r={5} style={{ fill: 'var(--m-text)', filter: `drop-shadow(0 0 6px ${to})` }} />
        </>
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={38} fontWeight={800} letterSpacing={-1} style={{ fill: 'var(--m-text)' }}>{percent === null ? '—' : `${String(percent).replace('.', ',')} %`}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={13} style={{ fill: 'var(--m-text-2)' }}>{total > 0 ? `${value.toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')} ${unit}` : `${value.toLocaleString('fr-FR')} ${unit} · ${emptyLabel}`}</text>
      {([['0', -sweep], ['50', 0], ['100', sweep]] as const).map(([label, degrees]) => {
        const angle = (degrees * Math.PI) / 180;
        return <text key={label} x={cx + 145.5 * Math.sin(angle)} y={cy - 150 * Math.cos(angle) + (degrees === 0 ? 4 : 14)} textAnchor="middle" fontSize={11} style={{ fill: 'var(--m-muted)' }}>{label}</text>;
      })}
    </svg>
  );
};

interface CampaignProgressGaugeProps {
  title: string;
  subtitle: string;
  modes: ProgressMode[];
  legend?: ProgressLegendItem[];
  legendCaption?: string;
  note?: string;
  /** Texte sous le chiffre quand l'objectif vaut zéro. */
  emptyLabel?: string;
  children?: React.ReactNode;
}

export const CampaignProgressGauge: React.FC<CampaignProgressGaugeProps> = ({ title, subtitle, modes, legend, legendCaption, note, emptyLabel, children }) => {
  const [modeKey, setModeKey] = useState(modes[0]?.key || '');
  const [open, setOpen] = useState(false);
  const mode = modes.find((item) => item.key === modeKey) || modes[0];
  if (!mode) return null;
  return (
    <section className="glass-card space-y-3 !p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[var(--m-text)]">{title}</h3>
          <p className="text-xs text-[var(--m-text-2)]">{subtitle}</p>
        </div>
        {modes.length > 1 && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--m-edge-soft)] bg-[var(--m-tile)] px-3 text-sm font-bold text-[var(--m-text)]"
            >
              {mode.label}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div role="menu" className="app-popover absolute right-0 top-11 z-50 grid w-52 gap-0.5 border p-2">
                  {modes.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={item.key === mode.key}
                      onClick={() => { setModeKey(item.key); setOpen(false); }}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[var(--m-text)] hover:bg-[var(--m-tile)]"
                    >
                      <i className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color || 'linear-gradient(135deg, var(--m-chart-1), var(--m-chart-2))' }} />
                      {item.label}
                      {item.key === mode.key && <Check className="ml-auto h-4 w-4 text-[var(--m-accent)]" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <SegmentedGauge value={mode.value} total={mode.target} unit={mode.unit} color={mode.color} emptyLabel={emptyLabel} />
      {legend && legend.length > 0 && (
        <>
          {legendCaption && <p className="mx-auto w-full max-w-[26rem] text-xs text-[var(--m-text-2)]">{legendCaption}</p>}
          <div className="mx-auto grid w-full max-w-[26rem] gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${legend.length > 3 ? 7 : 5.5}rem, 1fr))` }}>
            {legend.map((item) => (
              <div key={item.label} className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-2">
                <i className="row-span-2 block h-3 w-3 rounded-full" style={{ background: item.color }} />
                <b className="text-base font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{item.value.toLocaleString('fr-FR')}</b>
                <span className="truncate text-xs text-[var(--m-muted)]">{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {children}
      {note && <p className="text-xs text-[var(--m-muted)]">{note}</p>}
    </section>
  );
};

export default CampaignProgressGauge;
