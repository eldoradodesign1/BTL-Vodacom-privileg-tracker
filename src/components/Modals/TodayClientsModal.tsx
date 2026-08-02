import React from 'react';
import { Lead } from '../../types';
import { X, Users } from 'lucide-react';

interface TodayClientsModalProps {
  isOpen: boolean;
  agent: { name: string; shop: string } | null;
  dayLeads: Lead[];
  onClose: () => void;
}

export const TodayClientsModal: React.FC<TodayClientsModalProps> = ({
  isOpen,
  agent,
  dayLeads,
  onClose
}) => {
  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop" onClick={onClose}>
      <div className="modal-sheet relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase text-white">Clients du jour</h2>
            <p className="text-[10px] font-bold uppercase text-gray-400">{agent.name} • {agent.shop}</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {dayLeads.length === 0 ? (
            <div className="text-center text-xs text-gray-500 italic py-6">Aucun client saisi aujourd'hui.</div>
          ) : (
            dayLeads.map(ld => (
              <div key={ld.id} className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black text-white">{ld.client_name}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{ld.action_type}</p>
                </div>
                <span className="text-[10px] font-black text-red-400 shrink-0">{ld.msisdn}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
