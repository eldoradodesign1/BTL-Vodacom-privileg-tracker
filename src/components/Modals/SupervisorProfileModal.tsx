import React from 'react';
import { User } from '../../types';
import { Users, Phone, X, User as UserIcon, FileSpreadsheet } from 'lucide-react';
import { DetailPdfExportButton } from './DetailPdfExportButton';

export interface SupervisorHostessSummary {
  id: string;
  name: string;
  shop: string;
  totalPriv: number;
  totalRoam: number;
  totalBund: number;
}

interface SupervisorProfileModalProps {
  isOpen: boolean;
  supervisor: User | null;
  hostesses: SupervisorHostessSummary[];
  onClose: () => void;
  onCompile: () => void;
  onOpenHostessDetails: (hostessId: string) => void;
}

export const SupervisorProfileModal: React.FC<SupervisorProfileModalProps> = ({
  isOpen,
  supervisor,
  hostesses,
  onClose,
  onCompile,
  onOpenHostessDetails
}) => {
  if (!isOpen || !supervisor) return null;

  const totals = hostesses.reduce(
    (acc, hostess) => ({
      priv: acc.priv + hostess.totalPriv,
      roam: acc.roam + hostess.totalRoam,
      bund: acc.bund + hostess.totalBund
    }),
    { priv: 0, roam: 0, bund: 0 }
  );

  const detailDocument = { title: 'Fiche superviseur', subtitle: supervisor.name, filename: `superviseur-${supervisor.name}`, sections: [{ title: 'Superviseur', rows: [{ label: 'Nom', value: supervisor.name }, { label: 'Téléphone', value: supervisor.phone }, { label: 'Hôtesses affectées', value: hostesses.length }] }, { title: 'Totaux équipe', rows: [{ label: 'Privilège', value: totals.priv }, { label: 'Roaming', value: totals.roam }, { label: 'Bundle', value: totals.bund }] }, { title: 'Hôtesses', rows: hostesses.map((hostess) => ({ label: hostess.name, value: `${hostess.shop} · Privilège ${hostess.totalPriv} · Roaming ${hostess.totalRoam} · Bundle ${hostess.totalBund}` })) }] };
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop overflow-y-auto"
      onClick={onClose}
    >
      <div className="modal-sheet relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <div className="absolute top-5 right-5 flex items-center gap-2"><DetailPdfExportButton document={detailDocument}/><button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button></div>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-red-600/20 border-2 border-red-500/40 text-red-500 font-black text-xl flex items-center justify-center mb-3 overflow-hidden">
            {supervisor.name
              ? supervisor.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
              : 'SP'}
          </div>
          <h2 className="text-xl font-black uppercase text-white tracking-wider">{supervisor.name}</h2>
          <p className="text-xs text-gray-400 font-bold uppercase">MSISDN: {supervisor.phone}</p>
        </div>

        <div className="flex justify-center mb-4">
          <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border-amber-500/40">
            {hostesses.length} hôtesse(s) affectée(s)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={onCompile}
            className="btn-neon btn-red text-xs py-3 flex items-center justify-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>COMPILER (PDF)</span>
          </button>

          <a
            href={`tel:${supervisor.phone}`}
            className="btn-neon btn-dark text-xs py-3 flex items-center justify-center space-x-1.5 text-center text-white text-decoration-none"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>APPELER</span>
          </a>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Totaux de l'équipe</p>
            <div className="flex items-center gap-1 text-amber-400">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase">{hostesses.length} hôtesses</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-xl bg-black/35 px-2 py-1 text-center">
              <p className="text-[8px] font-black uppercase text-gray-400">Privilège</p>
              <p className="text-[10px] font-black text-red-400">{totals.priv}</p>
            </div>
            <div className="rounded-xl bg-black/35 px-2 py-1 text-center">
              <p className="text-[8px] font-black uppercase text-gray-400">Roaming</p>
              <p className="text-[10px] font-black text-amber-300">{totals.roam}</p>
            </div>
            <div className="rounded-xl bg-black/35 px-2 py-1 text-center">
              <p className="text-[8px] font-black uppercase text-gray-400">Bundle</p>
              <p className="text-[10px] font-black text-blue-300">{totals.bund}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Liste des hôtesses</h3>

          {hostesses.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-[10px] font-semibold text-gray-400">
              Aucune hôtesse affectée à ce superviseur.
            </p>
          ) : (
            hostesses.map((hostess) => (
              <div key={hostess.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-black uppercase text-white">{hostess.name}</p>
                    <p className="truncate text-[9px] font-bold uppercase text-gray-400">{hostess.shop}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenHostessDetails(hostess.id)}
                    className="p-1.5 rounded-xl border border-white/15 bg-black/30 text-gray-200 hover:text-white hover:bg-white/10"
                    title={`Voir le détail de ${hostess.name}`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <div className="rounded-xl bg-black/35 px-2 py-1 text-center">
                    <p className="text-[8px] font-black uppercase text-gray-400">Privilège</p>
                    <p className="text-[10px] font-black text-red-400">{hostess.totalPriv}</p>
                  </div>
                  <div className="rounded-xl bg-black/35 px-2 py-1 text-center">
                    <p className="text-[8px] font-black uppercase text-gray-400">Roaming</p>
                    <p className="text-[10px] font-black text-amber-300">{hostess.totalRoam}</p>
                  </div>
                  <div className="rounded-xl bg-black/35 px-2 py-1 text-center">
                    <p className="text-[8px] font-black uppercase text-gray-400">Bundle</p>
                    <p className="text-[10px] font-black text-blue-300">{hostess.totalBund}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
