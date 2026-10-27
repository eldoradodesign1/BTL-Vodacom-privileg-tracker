import React, { useRef } from 'react';

// Curseur vertical : piste épaisse arrondie, remplissage en dégradé de la matière, repère blanc en guise de poignée.
// Valeur continue au glisser ; flèches (1), Page haut/bas (10), Début/Fin au clavier.

interface VerticalSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Texte affiché au-dessus de la piste (valeur arrondie et unité). */
  display: string;
  onChange: (value: number) => void;
}

export const VerticalSlider: React.FC<VerticalSliderProps> = ({ label, value, min, max, display, onChange }) => {
  const track = useRef<HTMLDivElement>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const ratio = (value - min) / (max - min || 1);

  const fromPointer = (clientY: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    onChange(clamp(min + (1 - (clientY - box.top) / box.height) * (max - min)));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const span = max - min;
    const steps: Record<string, number> = { ArrowUp: span / 100, ArrowRight: span / 100, ArrowDown: -span / 100, ArrowLeft: -span / 100, PageUp: span / 10, PageDown: -span / 10 };
    if (event.key in steps) onChange(clamp(value + steps[event.key]));
    else if (event.key === 'Home') onChange(min);
    else if (event.key === 'End') onChange(max);
    else return;
    event.preventDefault();
  };

  return (
    <div className="vslider">
      <span className="vslider__value" aria-hidden="true">{display}</span>
      <div
        ref={track}
        className="vslider__track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-valuetext={display}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); fromPointer(event.clientY); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event.clientY); }}
        style={{ ['--fill' as string]: `${ratio * 100}%` }}
      >
        <i className="vslider__fill" />
        <b className="vslider__thumb" />
      </div>
      <span className="vslider__label">{label}</span>
    </div>
  );
};

export default VerticalSlider;
