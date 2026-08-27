import React from 'react';
import { X, MapPin } from 'lucide-react';
import { formatAgentLocationLine, getLocationEmbedUrl, AgentLocationDetails } from '../../utils/location';
import { DetailPdfExportButton } from './DetailPdfExportButton';

interface LocationModalProps {
  isOpen: boolean;
  agent: (AgentLocationDetails & { id: string; name: string }) | null;
  onClose: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, agent, onClose }) => {
  if (!isOpen || !agent) return null;

  const detailDocument = { title: 'Localisation agent', subtitle: agent.name, filename: `localisation-${agent.name}`, sections: [{ title: 'Pointage', rows: [{ label: 'Agent', value: agent.name }, { label: 'Boutique', value: agent.shop }, { label: 'Statut', value: agent.status }, { label: 'Arrivée', value: agent.arrivalTime || agent.reportObj?.arrival_time }, { label: 'Clôture', value: agent.departureTime || agent.reportObj?.departure_time }, { label: 'Coordonnées', value: typeof agent.lat === 'number' && typeof agent.long === 'number' ? `${agent.lat}, ${agent.long}` : 'Non disponibles' }] }] };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop" onClick={onClose}>
      <div className="modal-sheet relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="absolute top-5 right-5 flex items-center gap-2"><DetailPdfExportButton document={detailDocument}/><button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button></div>

        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase text-white">Localisation</h2>
            <p className="text-[11px] font-bold uppercase text-gray-400">{agent.name}</p>
            <p className="text-[10px] font-bold uppercase text-gray-300 mt-1">
              {formatAgentLocationLine({
                shop: agent.shop,
                status: agent.status,
                arrivalTime: agent.arrivalTime || agent.reportObj?.arrival_time,
                departureTime: agent.departureTime || agent.reportObj?.departure_time
              })}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <iframe
            title={`Localisation ${agent.name}`}
            src={getLocationEmbedUrl(agent)}
            className="w-full h-64 border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
};
