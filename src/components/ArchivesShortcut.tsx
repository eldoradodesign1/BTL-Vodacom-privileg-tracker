import React from 'react';
import { FolderOpen } from 'lucide-react';

// Avant le pointage, la barre de navigation est masquée : ce bouton ouvre les archives,
// et la barre réapparaît pour passer aux clients. L'appli écoute l'événement « btl:open-tab ».
export const ArchivesShortcut: React.FC = () => (
  <button
    type="button"
    onClick={() => window.dispatchEvent(new CustomEvent('btl:open-tab', { detail: { tab: 'tab3' } }))}
    className="mx-auto inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--m-edge-soft)] bg-[var(--m-tile)] px-4 text-sm font-semibold text-[var(--m-text)]"
  >
    <FolderOpen className="h-4 w-4 text-[var(--m-accent)]" aria-hidden="true" />
    Consulter les archives
  </button>
);

export default ArchivesShortcut;
