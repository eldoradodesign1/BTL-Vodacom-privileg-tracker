import React from 'react';
import { BarChart3, UserRound } from 'lucide-react';
import type { User } from '../types';
import { canOpenReports, openMySpace, openReports } from '../utils/companionApps';

// Pile de boutons flottants, toujours à l'écran : Mon espace (tous), Rapports (sauf agents),
// puis l'action propre à la vue (ex. demandes de fonds Merchant), au plus près du pouce.

interface FloatingActionsProps {
  user: User;
  children?: React.ReactNode;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({ user, children }) => (
  <div className="fab-stack">
    <button type="button" onClick={() => openMySpace(user)} className="fab-link" aria-label="Mon espace" title="Mon espace">
      <UserRound className="h-5 w-5" aria-hidden="true" />
      <span className="fab-link__label">Mon espace</span>
    </button>
    {canOpenReports(user) && (
      <button type="button" onClick={() => openReports(user)} className="fab-link" aria-label="Rapports" title="Rapports">
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
        <span className="fab-link__label">Rapports</span>
      </button>
    )}
    {children}
  </div>
);

export default FloatingActions;
