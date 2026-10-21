import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

interface AgentDockActionProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

// Le bouton conserve le callback et les protections de sa campagne.
// Seule sa position visuelle est partagée avec la navigation.
export const AgentDockAction: React.FC<AgentDockActionProps> = ({ label, onClick, disabled, title }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const lastTouchActivation = useRef(0);
  useLayoutEffect(() => {
    setTarget(document.getElementById('agent-dock-action-slot'));
  }, []);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;

    const handleNativePointerDown = (event: PointerEvent) => {
    // Certains webviews mobiles annulent le click synthétique lorsque le bouton
    // dépasse visuellement du dock. Le pointerdown, lui, est bien délivré.
    // Cela arrive aussi avec certains navigateurs embarqués qui annoncent une
    // souris : tout appui principal est donc traité de façon identique.
    if (disabled || event.button !== 0) return;
    lastTouchActivation.current = performance.now();
    onClick();
    };

    button.addEventListener('pointerdown', handleNativePointerDown);
    return () => button.removeEventListener('pointerdown', handleNativePointerDown);
  }, [disabled, onClick, target]);

  const handleClick = () => {
    // Le navigateur peut encore émettre un click après le pointerdown tactile.
    // Il est volontairement ignoré pour que l’ouverture ne soit jamais doublée.
    if (performance.now() - lastTouchActivation.current < 700) return;
    onClick();
  };

  return target ? createPortal(
    <button ref={buttonRef} type="button" className="agent-dock-action" onClick={handleClick} disabled={disabled} aria-label={label} title={title || label}>
      <Plus size={30} strokeWidth={2.5} aria-hidden="true" />
    </button>,
    target,
  ) : null;
};
