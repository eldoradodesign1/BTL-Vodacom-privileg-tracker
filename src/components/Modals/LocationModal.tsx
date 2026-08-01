import React from 'react';
import { X, MapPin } from 'lucide-react';
import { formatAgentLocationLine, getLocationEmbedUrl, AgentLocationDetails } from '../../utils/location';

interface LocationModalProps {
  isOpen: boolean;
  agent: (AgentLocationDetails & { id: string; name: string }) | null;
  onClose: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, agent, onClose }) => {
  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop">
      <div className="modal-sheet relative w-full max-w-lg">
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

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
                arrivalTime: agent.arrivalTime,
                departureTime: agent.departureTime
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
