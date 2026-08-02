import React, { useEffect, useMemo, useRef, useState } from 'react';

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

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const DateRangeKnobSlider: React.FC<DateRangeKnobSliderProps> = ({
  minDate,
  maxDate,
  startDate,
  endDate,
  onChange
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const minTs = useMemo(() => toTs(minDate), [minDate]);
  const maxTs = useMemo(() => toTs(maxDate), [maxDate]);
  const totalDays = useMemo(() => Math.max(1, Math.floor((maxTs - minTs) / DAY_MS) + 1), [minTs, maxTs]);

  const startIndex = useMemo(() => clamp(Math.floor((toTs(startDate) - minTs) / DAY_MS), 0, totalDays - 1), [startDate, minTs, totalDays]);
  const endIndex = useMemo(() => clamp(Math.floor((toTs(endDate) - minTs) / DAY_MS), 0, totalDays - 1), [endDate, minTs, totalDays]);

  const startPct = totalDays <= 1 ? 0 : (startIndex / (totalDays - 1)) * 100;
  const endPct = totalDays <= 1 ? 100 : (endIndex / (totalDays - 1)) * 100;

  const positionToIndex = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = x / rect.width;
    return clamp(Math.round(ratio * (totalDays - 1)), 0, totalDays - 1);
  };

  const setFromIndex = (which: 'start' | 'end', nextIndex: number) => {
    if (which === 'start') {
      const clampedStart = Math.min(nextIndex, endIndex);
      onChange({
        startDate: toIsoDate(minTs + clampedStart * DAY_MS),
        endDate
      });
      return;
    }

    const clampedEnd = Math.max(nextIndex, startIndex);
    onChange({
      startDate,
      endDate: toIsoDate(minTs + clampedEnd * DAY_MS)
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextIndex = positionToIndex(event.clientX);
      setFromIndex(dragging, nextIndex);
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
  }, [dragging, startIndex, endIndex, minTs, endDate, startDate]);

  const startLabel = new Date(`${startDate}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const endLabel = new Date(`${endDate}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  return (
    <div className="rounded-2xl border border-white/10 bg-black/50 p-3">
      <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase">
        <span className="rounded-lg border border-red-500/30 bg-red-600/15 px-2 py-1 text-red-300">Debut: {startLabel}</span>
        <span className="rounded-lg border border-blue-500/30 bg-blue-600/15 px-2 py-1 text-blue-300">Fin: {endLabel}</span>
      </div>

      <div
        ref={trackRef}
        className="relative h-10 cursor-pointer"
        onPointerDown={(event) => {
          const nextIndex = positionToIndex(event.clientX);
          const distToStart = Math.abs(nextIndex - startIndex);
          const distToEnd = Math.abs(nextIndex - endIndex);
          const target = distToStart <= distToEnd ? 'start' : 'end';
          setFromIndex(target, nextIndex);
          setDragging(target);
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10" />

        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-blue-500 shadow-[0_0_18px_rgba(239,68,68,0.45)]"
          style={{
            left: `${startPct}%`,
            width: `${Math.max(0, endPct - startPct)}%`
          }}
        />

        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragging('start');
          }}
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-300 bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.6)]"
          style={{ left: `${startPct}%` }}
          title="Date de debut"
        />

        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragging('end');
          }}
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-300 bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.65)]"
          style={{ left: `${endPct}%` }}
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
