import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangeKnobSliderProps {
  minDate: string;
  maxDate: string;
  startDate: string;
  endDate: string;
  onChange: (next: { startDate: string; endDate: string }) => void;
}

const DAY_MS = 86400000;

const toIsoDate = (ts: number): string => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toTs = (iso: string): number => new Date(`${iso}T00:00:00`).getTime();
const parseIso = (iso: string): Date | null => {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const roundPct = (pct: number): number => Math.round(pct * 10000) / 10000;

export const DateRangeKnobSlider: React.FC<DateRangeKnobSliderProps> = ({
  minDate,
  maxDate,
  startDate,
  endDate,
  onChange
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'end' | null>(null);

  const minTs = useMemo(() => toTs(minDate), [minDate]);
  const maxTs = useMemo(() => toTs(maxDate), [maxDate]);
  const totalDays = useMemo(() => Math.max(1, Math.floor((maxTs - minTs) / DAY_MS) + 1), [minTs, maxTs]);

  const startIndex = useMemo(() => clamp(Math.floor((toTs(startDate) - minTs) / DAY_MS), 0, totalDays - 1), [startDate, minTs, totalDays]);
  const endIndex = useMemo(() => clamp(Math.floor((toTs(endDate) - minTs) / DAY_MS), 0, totalDays - 1), [endDate, minTs, totalDays]);

  const indexToPct = (index: number): number => {
    if (totalDays <= 1) return 0;
    return roundPct((index / (totalDays - 1)) * 100);
  };

  const pctToIndex = (pct: number): number => {
    if (totalDays <= 1) return 0;
    return clamp(Math.round((pct / 100) * (totalDays - 1)), 0, totalDays - 1);
  };

  const [startVisualPct, setStartVisualPct] = useState(indexToPct(startIndex));
  const [endVisualPct, setEndVisualPct] = useState(indexToPct(endIndex));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const seed = parseIso(startDate) || new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  useEffect(() => {
    if (dragging) return;
    setStartVisualPct(indexToPct(startIndex));
    setEndVisualPct(indexToPct(endIndex));
  }, [startIndex, endIndex, dragging]);

  useEffect(() => {
    if (!calendarTarget) return;

    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setCalendarTarget(null);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCalendarTarget(null);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [calendarTarget]);

  const positionToPct = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = x / rect.width;
    return roundPct(clamp(ratio * 100, 0, 100));
  };

  const setFromPct = (which: 'start' | 'end', nextPct: number) => {
    const safePct = roundPct(clamp(nextPct, 0, 100));

    if (which === 'start') {
      const clampedPct = Math.min(safePct, endVisualPct);
      const nextIndex = Math.min(pctToIndex(clampedPct), pctToIndex(endVisualPct));
      setStartVisualPct(clampedPct);
      onChange({
        startDate: toIsoDate(minTs + nextIndex * DAY_MS),
        endDate
      });
      return;
    }

    const clampedPct = Math.max(safePct, startVisualPct);
    const nextIndex = Math.max(pctToIndex(clampedPct), pctToIndex(startVisualPct));
    setEndVisualPct(clampedPct);
    onChange({
      startDate,
      endDate: toIsoDate(minTs + nextIndex * DAY_MS)
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextPct = positionToPct(event.clientX);
      setFromPct(dragging, nextPct);
    };

    const handlePointerUp = () => {
      setDragging(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, minTs, endDate, startDate, startVisualPct, endVisualPct]);

  const tickIndices = useMemo(() => {
    if (totalDays <= 1) return [0];
    const stepDays = totalDays <= 45 ? 1 : Math.ceil(totalDays / 45);
    const indices: number[] = [];
    for (let i = 0; i < totalDays; i += stepDays) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== totalDays - 1) {
      indices.push(totalDays - 1);
    }
    return indices;
  }, [totalDays]);

  const startBound = parseIso(minDate);
  const endBound = parseIso(maxDate);

  const isDisabledIso = (iso: string): boolean => {
    const day = parseIso(iso);
    if (!day) return true;
    if (startBound && day < startBound) return true;
    if (endBound && day > endBound) return true;

    if (calendarTarget === 'start') {
      return day > (parseIso(endDate) || day);
    }
    if (calendarTarget === 'end') {
      return day < (parseIso(startDate) || day);
    }
    return false;
  };

  const applyManualDate = (iso: string) => {
    if (calendarTarget === 'start') {
      const startTs = toTs(iso);
      const endTs = toTs(endDate);
      onChange({
        startDate: startTs <= endTs ? iso : endDate,
        endDate
      });
      setCalendarTarget(null);
      return;
    }

    if (calendarTarget === 'end') {
      const startTs = toTs(startDate);
      const endTs = toTs(iso);
      onChange({
        startDate,
        endDate: endTs >= startTs ? iso : startDate
      });
      setCalendarTarget(null);
    }
  };

  const monthLabel = calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const startLabel = new Date(`${startDate}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const endLabel = new Date(`${endDate}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const glideClass = dragging
    ? ''
    : 'transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';
  const knobGlideClass = dragging
    ? ''
    : 'transition-[left,transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';

  return (
    <div ref={rootRef} className="relative rounded-2xl border border-white/10 bg-black/50 p-3">
      <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase">
        <button
          type="button"
          onClick={() => {
            const seed = parseIso(startDate) || new Date();
            setCalendarMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
            setCalendarTarget(calendarTarget === 'start' ? null : 'start');
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-600/15 px-2 py-1 text-red-300"
        >
          <CalendarDays className="h-3 w-3" />
          <span>Debut: {startLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const seed = parseIso(endDate) || new Date();
            setCalendarMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
            setCalendarTarget(calendarTarget === 'end' ? null : 'end');
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-600/15 px-2 py-1 text-blue-300"
        >
          <CalendarDays className="h-3 w-3" />
          <span>Fin: {endLabel}</span>
        </button>
      </div>

      {calendarTarget && (
        <div className="absolute right-3 top-11 z-50 w-72 rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              className="h-8 w-8 rounded-lg bg-white/5 text-gray-200 hover:bg-white/10"
              title="Mois précédent"
            >
              <ChevronLeft className="mx-auto h-4 w-4" />
            </button>
            <span className="text-[11px] font-black uppercase text-white">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              className="h-8 w-8 rounded-lg bg-white/5 text-gray-200 hover:bg-white/10"
              title="Mois suivant"
            >
              <ChevronRight className="mx-auto h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((label) => (
              <div key={label} className="py-1 text-center text-[9px] font-black uppercase text-gray-500">{label}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => {
              const dayNumber = index - startOffset + 1;
              if (dayNumber < 1 || dayNumber > daysInMonth) {
                return <div key={`cal-empty-${index}`} className="h-8" />;
              }

              const dayDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNumber);
              const iso = toIsoDate(dayDate.getTime());
              const isSelected = iso === (calendarTarget === 'start' ? startDate : endDate);
              const disabled = isDisabledIso(iso);

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => applyManualDate(iso)}
                  className={`h-8 rounded-lg text-[10px] font-black transition-all ${isSelected
                    ? 'bg-red-600 text-white'
                    : 'bg-white/5 text-gray-200 hover:bg-white/10'} ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        ref={trackRef}
        className="relative h-10 cursor-pointer"
        onPointerDown={(event) => {
          const nextPct = positionToPct(event.clientX);
          const distToStart = Math.abs(nextPct - startVisualPct);
          const distToEnd = Math.abs(nextPct - endVisualPct);
          const target = distToStart <= distToEnd ? 'start' : 'end';
          setFromPct(target, nextPct);
          setDragging(target);
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10" />

        <div className="absolute left-0 right-0 top-1/2 h-4 -translate-y-1/2">
          {tickIndices.map((idx) => (
            <span
              key={`tick-${idx}`}
              className="absolute top-1/2 h-3 w-[1px] -translate-y-1/2 bg-white/25"
              style={{ left: `${indexToPct(idx)}%` }}
            />
          ))}
        </div>

        <div
          className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-blue-500 shadow-[0_0_18px_rgba(239,68,68,0.45)] will-change-[left,width] ${glideClass}`}
          style={{
            left: `${startVisualPct}%`,
            width: `${Math.max(0, endVisualPct - startVisualPct)}%`
          }}
        />

        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragging('start');
          }}
          className={`absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-300 bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.6)] will-change-[left] ${knobGlideClass}`}
          style={{ left: `${startVisualPct}%` }}
          title="Date de debut"
        />

        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragging('end');
          }}
          className={`absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-300 bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.65)] will-change-[left] ${knobGlideClass}`}
          style={{ left: `${endVisualPct}%` }}
          title="Date de fin"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] font-bold uppercase text-gray-500">
        <span>{new Date(`${minDate}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
        <span>{new Date(`${maxDate}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
      </div>
    </div>
  );
};
