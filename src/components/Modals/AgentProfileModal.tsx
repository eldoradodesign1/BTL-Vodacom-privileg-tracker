import React from 'react';
import { AgentMasterStatus, DailyReport } from '../../types';
import { getReportPdf } from '../../utils/storage';
import { Phone, FileSpreadsheet, X, Eye } from 'lucide-react';

interface AgentProfileModalProps {
  isOpen: boolean;
  agent: AgentMasterStatus | null;
  agentReports: DailyReport[];
  onClose: () => void;
  onOpenPdf: (url: string) => void;
  onCompileAgent: (agentId: string) => void;
}

export const AgentProfileModal: React.FC<AgentProfileModalProps> = ({
  isOpen,
  agent,
  agentReports,
  onClose,
  onOpenPdf,
  onCompileAgent
}) => {
  if (!isOpen || !agent) return null;

  const initials = agent.name
    ? agent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'AG';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop">
      <div className="modal-sheet relative w-full max-w-lg">
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-red-600/20 border-2 border-red-500/40 text-red-500 font-black text-xl flex items-center justify-center mb-3">
            {initials}
          </div>
          <h2 className="text-xl font-black uppercase text-white tracking-wider">{agent.name}</h2>
          <p className="text-xs text-gray-400 font-bold uppercase">{agent.shop} • MSISDN: {agent.phone}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => onCompileAgent(agent.id)}
            className="btn-neon btn-red text-xs py-3 flex items-center justify-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>COMPILER (PDF)</span>
          </button>

          <a
            href={`tel:${agent.phone}`}
            className="btn-neon btn-dark text-xs py-3 flex items-center justify-center space-x-1.5 text-center text-white text-decoration-none"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>APPELER</span>
          </a>
        </div>

        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">
            Historique des Rapports ({agentReports.length})
          </h3>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {agentReports.length === 0 ? (
              <p className="text-center text-xs text-gray-500 italic py-4">Aucun rapport disponible pour cet agent.</p>
            ) : (
              agentReports.map(rep => (
                <div key={rep.id} className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-white">{rep.date}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">
                      Priv: {rep.priv} | Roam: {rep.roam} | Bund: {rep.bund}
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      const url = await getReportPdf(rep);
                      onOpenPdf(url);
                    }}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-[10px] font-black uppercase flex items-center space-x-1 transition-all"
                  >
                    <Eye className="w-3 h-3" />
                    <span>VOIR</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
