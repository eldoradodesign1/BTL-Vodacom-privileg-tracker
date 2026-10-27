import React from 'react';
import { Banknote } from 'lucide-react';

// Demandes de fonds Merchant : bouton flottant toujours à l'écran, pastille = demandes en attente.

interface FundRequestsFabProps {
  pendingCount: number;
  onOpen: () => void;
}

export const FundRequestsFab: React.FC<FundRequestsFabProps> = ({ pendingCount, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="fund-fab"
    aria-label={pendingCount ? `Demandes de fonds : ${pendingCount} en attente` : 'Demandes de fonds'}
    title="Demandes de fonds"
  >
    <Banknote className="h-6 w-6" aria-hidden="true" />
    {pendingCount > 0 && <span className="fund-fab__badge">{pendingCount > 99 ? '99+' : pendingCount}</span>}
  </button>
);

export default FundRequestsFab;
