import React, { useLayoutEffect, useState } from 'react';
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
  useLayoutEffect(() => {
    setTarget(document.getElementById('agent-dock-action-slot'));
  }, []);

  return target ? createPortal(
    <button type="button" className="agent-dock-action" onClick={onClick} disabled={disabled} aria-label={label} title={title || label}>
      <Plus size={30} strokeWidth={2.5} aria-hidden="true" />
    </button>,
    target,
  ) : null;
};
