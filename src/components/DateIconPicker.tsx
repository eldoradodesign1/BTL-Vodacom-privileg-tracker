import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateIconPickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  className?: string;
  buttonClassName?: string;
  labelClassName?: string;
}

const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseIsoDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const DateIconPicker: React.FC<DateIconPickerProps> = ({
  value,
  onChange,
  min,
  max,
  className = '',
  buttonClassName = 'h-10 w-10 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 border border-white/10',
  labelClassName = 'text-[11px] font-black uppercase text-gray-200'
}) => {
  const selectedDate = parseIsoDate(value);
  const initialMonth = selectedDate || new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectedDate) {
      setMonthCursor(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [value]);

  const minDate = useMemo(() => parseIsoDate(min || ''), [min]);
  const maxDate = useMemo(() => parseIsoDate(max || ''), [max]);

  const monthLabel = monthCursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const selectedIso = value;
  const todayIso = toIsoDate(new Date());

  const isDisabled = (iso: string): boolean => {
    const day = parseIsoDate(iso);
    if (!day) return true;
    if (minDate && day < minDate) return true;
    if (maxDate && day > maxDate) return true;
    return false;
  };

  const displayLabel = selectedDate
    ? selectedDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : 'Choisir la date';

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex items-center justify-center ${buttonClassName}`}
        title="Choisir la date"
      >
        <CalendarDays className="w-4 h-4" />
      </button>
      <span className={`ml-2 ${labelClassName}`}>{displayLabel}</span>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
              className="h-8 w-8 rounded-lg bg-white/5 text-gray-200 hover:bg-white/10"
              title="Mois précédent"
            >
              <ChevronLeft className="mx-auto h-4 w-4" />
            </button>
            <span className="text-[11px] font-black uppercase text-white">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
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
                return <div key={`empty-${index}`} className="h-8" />;
              }

              const dayDate = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNumber);
              const iso = toIsoDate(dayDate);
              const selected = iso === selectedIso;
              const today = iso === todayIso;
              const disabled = isDisabled(iso);

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(iso);
                    setIsOpen(false);
                  }}
                  className={`h-8 rounded-lg text-[10px] font-black transition-all ${selected
                    ? 'bg-red-600 text-white'
                    : today
                      ? 'border border-amber-400/60 bg-amber-400/10 text-amber-300'
                      : 'bg-white/5 text-gray-200 hover:bg-white/10'} ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
