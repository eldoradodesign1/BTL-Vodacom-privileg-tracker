import React from 'react';
import { ArrowLeftRight } from 'lucide-react';

type StatusTone = 'live' | 'paused' | 'closed';

export interface DayCardProps {
  title?: string;
  statusLabel: string;
  statusTone?: StatusTone;
  value: number;
  target: number;
  unitLabel: string;
  secondaryValue: number;
  secondaryLabel: string;
}

// Jauge en arc de 240° (ouverte vers le bas) : lisible, légère, sans bibliothèque.
const SWEEP = 240;
const START = 150;
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};
const arcPath = (cx: number, cy: number, r: number, from: number, to: number) => {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

export const DayCard: React.FC<DayCardProps> = ({
  title = 'Ma journée', statusLabel, statusTone = 'live', value, target, unitLabel,
  secondaryValue, secondaryLabel,
}) => {
  const ratio = target > 0 ? Math.min(value / target, 1) : 0;
  const end = START + SWEEP * ratio;
  return (
    <section className="day-card" aria-label={title}>
      <header className="day-card__head">
        <h2 className="day-card__title">{title}</h2>
        <span className={`day-card__pill day-card__pill--${statusTone}`}><i aria-hidden="true" />{statusLabel}</span>
      </header>
      <div className="day-card__body">
        <div className="day-card__gauge" role="img" aria-label={`${value} sur ${target} ${unitLabel}`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="dayCardGauge" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--m-accent-2)" />
                <stop offset="100%" stopColor="var(--m-accent)" />
              </linearGradient>
            </defs>
            <path d={arcPath(60, 60, 48, START, START + SWEEP)} className="day-card__track" />
            {ratio > 0 && <path d={arcPath(60, 60, 48, START, Math.max(end, START + 1))} className="day-card__fill" />}
          </svg>
          <div className="day-card__figure">
            <strong>{value}<span> / {target}</span></strong>
            <small>{unitLabel}</small>
          </div>
        </div>
        <div className="day-card__tile">
          <ArrowLeftRight size={20} aria-hidden="true" />
          <strong>{secondaryValue}</strong>
          <small>{secondaryLabel}</small>
        </div>
      </div>
    </section>
  );
};
