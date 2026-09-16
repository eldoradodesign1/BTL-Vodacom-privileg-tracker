import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangeKnobSliderProps {
  minDate: string;
  maxDate: string;
  startDate: string;
  endDate: string;
  onChange: (next: { startDate: string; endDate: string }) => void;
}

const DAY_MS = 86400000;

// Parse YYYY-MM-DD safely into [year, month, day]
const parseYmd = (iso: string): [number, number, number] => {
  if (!iso) {
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  }
  const parts = iso.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return [parts[0], parts[1], parts[2]];
  }
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()];
};

// Convert ISO string to UTC timestamp at midnight (immune to DST and timezone shift)
const toUtcMs = (iso: string): number => {
  const [y, m, d] = parseYmd(iso);
  return Date.UTC(y, m - 1, d);
};

// Format UTC timestamp to YYYY-MM-DD
const toYmd = (utcMs: number): string => {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Get today's ISO date in Africa/Kinshasa or local timezone
const getTodayIso = (): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Kinshasa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const roundPct = (pct: number): number => Math.round(pct * 1000) / 1000;

export const DateRangeKnobSlider: React.FC<DateRangeKnobSliderProps> = ({
  minDate,
  maxDate,
  startDate,
  endDate,
  onChange,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Active dragging handle: 'start' | 'end' | 'stacked' | null
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | 'stacked' | null>(null);
  // Track which knob is currently elevated (higher z-index)
  const [activeKnob, setActiveKnob] = useState<'start' | 'end'>('start');
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'end' | null>(null);

  // Today's date reference
  const todayIso = useMemo(() => getTodayIso(), []);

  // Safe normalized dates
  const safeMinIso = minDate || '2026-07-01';
  const safeMaxIso = maxDate >= safeMinIso ? maxDate : safeMinIso;

  const minUtc = useMemo(() => toUtcMs(safeMinIso), [safeMinIso]);
  const maxUtc = useMemo(() => toUtcMs(safeMaxIso), [safeMaxIso]);
  const totalDays = useMemo(() => Math.max(1, Math.round((maxUtc - minUtc) / DAY_MS) + 1), [minUtc, maxUtc]);

  const isoFromIndex = useCallback(
    (index: number): string => toYmd(minUtc + index * DAY_MS),
    [minUtc]
  );

  const indexFromIso = useCallback(
    (iso: string): number => {
      const utc = toUtcMs(iso);
      return clamp(Math.round((utc - minUtc) / DAY_MS), 0, totalDays - 1);
    },
    [minUtc, totalDays]
  );

  const indexToPct = useCallback(
    (index: number): number => {
      if (totalDays <= 1) return 0;
      return roundPct((index / (totalDays - 1)) * 100);
    },
    [totalDays]
  );

  const pctToIndex = useCallback(
    (pct: number): number => {
      if (totalDays <= 1) return 0;
      return clamp(Math.round((pct / 100) * (totalDays - 1)), 0, totalDays - 1);
    },
    [totalDays]
  );

  // Derive initial indices from props
  const rawStartIdx = indexFromIso(startDate);
  const rawEndIdx = indexFromIso(endDate);
  const startIndex = Math.min(rawStartIdx, rawEndIdx);
  const endIndex = Math.max(rawStartIdx, rawEndIdx);

  // Local visual percentage positions for 60fps / 120fps buttery smoothness
  const [startVisualPct, setStartVisualPct] = useState(() => indexToPct(startIndex));
  const [endVisualPct, setEndVisualPct] = useState(() => indexToPct(endIndex));

  // Refs to avoid stale closures in dragging listeners
  const startVisualPctRef = useRef(startVisualPct);
  const endVisualPctRef = useRef(endVisualPct);
  startVisualPctRef.current = startVisualPct;
  endVisualPctRef.current = endVisualPct;

  const lastEmittedStartRef = useRef(startDate);
  const lastEmittedEndRef = useRef(endDate);
  lastEmittedStartRef.current = startDate;
  lastEmittedEndRef.current = endDate;

  const pointerDownXRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Sync visual percentages when props change externally and not dragging
  useEffect(() => {
    if (draggingHandle) return;
    setStartVisualPct(indexToPct(startIndex));
    setEndVisualPct(indexToPct(endIndex));
  }, [startIndex, endIndex, draggingHandle, indexToPct]);

  // Calendar month state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [y, m] = parseYmd(startDate);
    return new Date(y, m - 1, 1);
  });

  // Close calendar on click outside or escape
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

  // Convert clientX to track percentage
  const positionToPct = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const x = clamp(clientX - rect.left, 0, rect.width);
    return roundPct(clamp((x / rect.width) * 100, 0, 100));
  }, []);

  // Dragging event handlers
  useEffect(() => {
    if (!draggingHandle) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        const nextPct = positionToPct(event.clientX);

        // Handle stacked handles (both at same point)
        let effectiveHandle = draggingHandle;
        if (effectiveHandle === 'stacked') {
          const deltaX = event.clientX - pointerDownXRef.current;
          if (deltaX < -3) {
            effectiveHandle = 'start';
            setDraggingHandle('start');
            setActiveKnob('start');
          } else if (deltaX > 3) {
            effectiveHandle = 'end';
            setDraggingHandle('end');
            setActiveKnob('end');
          } else {
            return; // Wait for clear movement direction
          }
        }

        if (effectiveHandle === 'start') {
          // Clamp start strictly between 0 and current endVisualPct
          // It CANNOT push or alter endVisualPct (no "l'un attire l'autre")
          const clampedPct = Math.min(nextPct, endVisualPctRef.current);
          setStartVisualPct(clampedPct);

          const nextIndex = pctToIndex(clampedPct);
          const nextIso = isoFromIndex(nextIndex);
          if (nextIso !== lastEmittedStartRef.current) {
            lastEmittedStartRef.current = nextIso;
            onChange({
              startDate: nextIso,
              endDate: lastEmittedEndRef.current,
            });
          }
        } else if (effectiveHandle === 'end') {
          // Clamp end strictly between current startVisualPct and 100
          // It CANNOT pull or alter startVisualPct (no "l'un attire l'autre")
          const clampedPct = Math.max(nextPct, startVisualPctRef.current);
          setEndVisualPct(clampedPct);

          const nextIndex = pctToIndex(clampedPct);
          const nextIso = isoFromIndex(nextIndex);
          if (nextIso !== lastEmittedEndRef.current) {
            lastEmittedEndRef.current = nextIso;
            onChange({
              startDate: lastEmittedStartRef.current,
              endDate: nextIso,
            });
          }
        }
      });
    };

    const handlePointerUp = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      setDraggingHandle(null);

      // Final snap to exact day index
      const finalStartIdx = pctToIndex(startVisualPctRef.current);
      const finalEndIdx = pctToIndex(endVisualPctRef.current);
      setStartVisualPct(indexToPct(finalStartIdx));
      setEndVisualPct(indexToPct(finalEndIdx));

      const finalStartIso = isoFromIndex(finalStartIdx);
      const finalEndIso = isoFromIndex(finalEndIdx);
      if (finalStartIso !== lastEmittedStartRef.current || finalEndIso !== lastEmittedEndRef.current) {
        lastEmittedStartRef.current = finalStartIso;
        lastEmittedEndRef.current = finalEndIso;
        onChange({ startDate: finalStartIso, endDate: finalEndIso });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggingHandle, isoFromIndex, indexToPct, pctToIndex, positionToPct, onChange]);

  // Track ticks (max 35 ticks for clean aesthetic)
  const tickIndices = useMemo(() => {
    if (totalDays <= 1) return [0];
    const step = totalDays <= 35 ? 1 : Math.ceil(totalDays / 35);
    const indices: number[] = [];
    for (let i = 0; i < totalDays; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== totalDays - 1) {
      indices.push(totalDays - 1);
    }
    return indices;
  }, [totalDays]);

  // Apply Today button
  const isTodayAvailable = todayIso >= safeMinIso;
  const isCurrentlyTodayOnly = startDate === todayIso && endDate === todayIso;

  const applyToday = () => {
    const targetIso = (todayIso >= safeMinIso && todayIso <= safeMaxIso)
      ? todayIso
      : (todayIso > safeMaxIso ? safeMaxIso : safeMinIso);

    const targetIdx = indexFromIso(targetIso);
    const targetPct = indexToPct(targetIdx);

    setStartVisualPct(targetPct);
    setEndVisualPct(targetPct);
    setCalendarTarget(null);
    setActiveKnob('end');

    lastEmittedStartRef.current = targetIso;
    lastEmittedEndRef.current = targetIso;
    onChange({ startDate: targetIso, endDate: targetIso });
  };

  // Calendar manual date selection
  const applyManualDate = (iso: string) => {
    if (calendarTarget === 'start') {
      const selectedUtc = toUtcMs(iso);
      const endUtc = toUtcMs(endDate);
      if (selectedUtc > endUtc) {
        // If start is picked after end, adjust end to match (user friendly!)
        onChange({ startDate: iso, endDate: iso });
      } else {
        onChange({ startDate: iso, endDate });
      }
      setCalendarTarget(null);
      return;
    }

    if (calendarTarget === 'end') {
      const selectedUtc = toUtcMs(iso);
      const startUtc = toUtcMs(startDate);
      if (selectedUtc < startUtc) {
        // If end is picked before start, adjust start to match (user friendly!)
        onChange({ startDate: iso, endDate: iso });
      } else {
        onChange({ startDate, endDate: iso });
      }
      setCalendarTarget(null);
    }
  };

  // French formatted labels
  const formatFrenchShort = (iso: string): string => {
    const [y, m, d] = parseYmd(iso);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const startLabel = formatFrenchShort(startDate);
  const endLabel = formatFrenchShort(endDate);
  const minLabel = formatFrenchShort(safeMinIso);
  const maxLabel = formatFrenchShort(safeMaxIso);

  // Calendar navigation
  const monthLabel = calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  // Track pointer down handler (clicks on track)
  const handleTrackPointerDown = (event: React.PointerEvent) => {
    const clickPct = positionToPct(event.clientX);
    const distToStart = Math.abs(clickPct - startVisualPct);
    const distToEnd = Math.abs(clickPct - endVisualPct);

    // If both handles are at the same position
    if (Math.abs(startVisualPct - endVisualPct) < 0.5) {
      pointerDownXRef.current = event.clientX;
      setDraggingHandle('stacked');
      return;
    }

    const chosenHandle = distToStart <= distToEnd ? 'start' : 'end';
    setActiveKnob(chosenHandle);
    pointerDownXRef.current = event.clientX;

    if (chosenHandle === 'start') {
      const clampedPct = Math.min(clickPct, endVisualPct);
      setStartVisualPct(clampedPct);
      setDraggingHandle('start');
      const nextIndex = pctToIndex(clampedPct);
      const nextIso = isoFromIndex(nextIndex);
      if (nextIso !== lastEmittedStartRef.current) {
        lastEmittedStartRef.current = nextIso;
        onChange({ startDate: nextIso, endDate: lastEmittedEndRef.current });
      }
    } else {
      const clampedPct = Math.max(clickPct, startVisualPct);
      setEndVisualPct(clampedPct);
      setDraggingHandle('end');
      const nextIndex = pctToIndex(clampedPct);
      const nextIso = isoFromIndex(nextIndex);
      if (nextIso !== lastEmittedEndRef.current) {
        lastEmittedEndRef.current = nextIso;
        onChange({ startDate: lastEmittedStartRef.current, endDate: nextIso });
      }
    }
  };

  const isDragging = draggingHandle !== null;
  const glideTransition = isDragging
    ? 'transition-none'
    : 'transition-[left,width] duration-200 ease-out';
  const knobGlideTransition = isDragging
    ? 'transition-none'
    : 'transition-[left,transform] duration-200 ease-out';

  return (
    <div ref={rootRef} className="relative rounded-2xl border border-white/10 bg-black/50 p-3 select-none">
      {/* Top action row: Start date button, Today quick-pick, End date button */}
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 text-[10px] font-black uppercase">
        <button
          type="button"
          onClick={() => {
            const [y, m] = parseYmd(startDate);
            setCalendarMonth(new Date(y, m - 1, 1));
            setCalendarTarget(calendarTarget === 'start' ? null : 'start');
          }}
          className={`inline-flex min-w-0 items-center gap-1 rounded-lg border px-2 py-1.5 transition ${
            calendarTarget === 'start'
              ? 'border-red-400 bg-red-600/30 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              : 'border-red-500/30 bg-red-600/15 text-red-300 hover:bg-red-600/25'
          }`}
          title="Sélectionner la date de début"
        >
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span className="truncate">Début · {startLabel}</span>
        </button>

        <button
          type="button"
          disabled={!isTodayAvailable}
          onClick={applyToday}
          className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase transition ${
            isCurrentlyTodayOnly
              ? 'border-amber-400 bg-amber-400/30 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.35)]'
              : 'border-amber-300/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 active:scale-95'
          } disabled:cursor-not-allowed disabled:opacity-35`}
          title={isTodayAvailable ? "Filtrer uniquement sur la journée d'aujourd'hui" : "Aujourd'hui est hors de la période"}
        >
          Aujourd’hui
        </button>

        <button
          type="button"
          onClick={() => {
            const [y, m] = parseYmd(endDate);
            setCalendarMonth(new Date(y, m - 1, 1));
            setCalendarTarget(calendarTarget === 'end' ? null : 'end');
          }}
          className={`inline-flex min-w-0 items-center justify-end gap-1 rounded-lg border px-2 py-1.5 transition ${
            calendarTarget === 'end'
              ? 'border-blue-400 bg-blue-600/30 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
              : 'border-blue-500/30 bg-blue-600/15 text-blue-300 hover:bg-blue-600/25'
          }`}
          title="Sélectionner la date de fin"
        >
          <span className="truncate">Fin · {endLabel}</span>
          <CalendarDays className="h-3 w-3 shrink-0" />
        </button>
      </div>

      {/* Popover Calendar */}
      {calendarTarget && (
        <div className="calendar-dock-stretch absolute right-3 top-11 z-50 w-72 rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl animate-pop">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              className="h-8 w-8 rounded-lg bg-white/5 text-gray-200 hover:bg-white/10 flex items-center justify-center transition"
              title="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-black uppercase text-white tracking-wider">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              className="h-8 w-8 rounded-lg bg-white/5 text-gray-200 hover:bg-white/10 flex items-center justify-center transition"
              title="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((label) => (
              <div key={label} className="py-1 text-center text-[9px] font-black uppercase text-gray-400">{label}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => {
              const dayNumber = index - startOffset + 1;
              if (dayNumber < 1 || dayNumber > daysInMonth) {
                return <div key={`cal-empty-${index}`} className="h-8" />;
              }

              const m = String(calendarMonth.getMonth() + 1).padStart(2, '0');
              const d = String(dayNumber).padStart(2, '0');
              const iso = `${calendarMonth.getFullYear()}-${m}-${d}`;

              const isSelected = iso === (calendarTarget === 'start' ? startDate : endDate);
              const isInRange = iso >= startDate && iso <= endDate;
              const isTodayCell = iso === todayIso;
              const isDisabled = iso < safeMinIso || iso > safeMaxIso;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => applyManualDate(iso)}
                  className={`relative h-8 rounded-lg text-[10px] font-black transition ${
                    isSelected
                      ? (calendarTarget === 'start' ? 'bg-red-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md')
                      : isInRange
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-white/5 text-gray-200 hover:bg-white/15'
                  } ${isDisabled ? 'cursor-not-allowed opacity-25' : 'hover:scale-105 active:scale-95'}`}
                >
                  {dayNumber}
                  {isTodayCell && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Shortcut to today inside calendar */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-between items-center text-[9px]">
            <button
              type="button"
              onClick={applyToday}
              className="text-amber-300 font-bold hover:underline"
            >
              → Sélectionner Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => setCalendarTarget(null)}
              className="text-gray-400 hover:text-white font-bold"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Dual slider track */}
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        className="relative h-10 cursor-pointer touch-none select-none flex items-center"
      >
        {/* Background rail */}
        <div className="absolute left-0 right-0 h-2 rounded-full bg-white/15" />

        {/* Ticks */}
        <div className="absolute left-0 right-0 h-4 pointer-events-none">
          {tickIndices.map((idx) => (
            <span
              key={`tick-${idx}`}
              className="absolute top-1/2 h-2.5 w-[1px] -translate-y-1/2 bg-white/20"
              style={{ left: `${indexToPct(idx)}%` }}
            />
          ))}
        </div>

        {/* Active Range Bar (between start and end) */}
        <div
          className={`absolute h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-blue-500 shadow-[0_0_18px_rgba(239,68,68,0.45)] pointer-events-none ${glideTransition}`}
          style={{
            left: `${startVisualPct}%`,
            width: `${Math.max(0, endVisualPct - startVisualPct)}%`,
          }}
        />

        {/* Start Knob (Red) */}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${
            activeKnob === 'start' ? 'z-30' : 'z-20'
          } ${knobGlideTransition}`}
          style={{ left: `${startVisualPct}%` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            setActiveKnob('start');
            pointerDownXRef.current = event.clientX;

            // If overlapping with end knob, allow directional dragging
            if (Math.abs(startVisualPct - endVisualPct) < 0.5) {
              setDraggingHandle('stacked');
            } else {
              setDraggingHandle('start');
            }
          }}
          title={`Début: ${startLabel}`}
        >
          <div className="h-6 w-6 rounded-full border-2 border-red-200 bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.7)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
        </div>

        {/* End Knob (Blue) */}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${
            activeKnob === 'end' ? 'z-30' : 'z-20'
          } ${knobGlideTransition}`}
          style={{ left: `${endVisualPct}%` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            setActiveKnob('end');
            pointerDownXRef.current = event.clientX;

            // If overlapping with start knob, allow directional dragging
            if (Math.abs(startVisualPct - endVisualPct) < 0.5) {
              setDraggingHandle('stacked');
            } else {
              setDraggingHandle('end');
            }
          }}
          title={`Fin: ${endLabel}`}
        >
          <div className="h-6 w-6 rounded-full border-2 border-blue-200 bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.7)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
        </div>
      </div>

      {/* Bottom Min / Max bounds display */}
      <div className="mt-1 flex items-center justify-between text-[9px] font-bold uppercase text-gray-400 pointer-events-none">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
};
