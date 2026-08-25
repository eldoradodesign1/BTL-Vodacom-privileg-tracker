import React from 'react';
import { Banknote, Download, X } from 'lucide-react';
import type { MerchantFundRequest } from '../../types';

interface MerchantFundRequestsModalProps {
  isOpen: boolean;
  requests: MerchantFundRequest[];
  onClose: () => void;
  onExport: () => void;
  onSelect: (request: MerchantFundRequest) => void;
}

const statusMeta = (status: MerchantFundRequest['status']) => status === 'approved'
  ? { label: 'Approuvée', className: 'bg-emerald-500/15 text-emerald-100 border-emerald-300/25' }
  : status === 'rejected'
    ? { label: 'Rejetée', className: 'bg-rose-500/15 text-rose-100 border-rose-300/25' }
    : status === 'reviewed'
      ? { label: 'Consultée', className: 'bg-cyan-500/15 text-cyan-100 border-cyan-300/25' }
      : status === 'cancelled'
        ? { label: 'Annulée', className: 'bg-white/10 text-gray-300 border-white/10' }
        : { label: 'Nouvelle', className: 'bg-amber-500/15 text-amber-100 border-amber-300/25' };

export const MerchantFundRequestsModal: React.FC<MerchantFundRequestsModalProps> = ({ isOpen, requests, onClose, onExport, onSelect }) => {
  if (!isOpen) return null;
  const pending = requests.filter((request) => request.status === 'pending').length;
  return <div className="fixed inset-0 z-[145] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fund-requests-title">
    <section className="glass-card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-emerald-300/25 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
      <header className="modal-sticky-header flex items-start justify-between gap-3 p-4 sm:p-5"><div className="flex min-w-0 items-center gap-2"><Banknote className="shrink-0 text-emerald-200" size={20}/><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/70">Pilotage Merchant</p><h2 id="fund-requests-title" className="mt-1 text-lg font-black text-white">Demandes de fonds</h2><p className="mt-1 text-xs text-gray-400">{pending ? `${pending} demande${pending > 1 ? 's' : ''} en attente de décision.` : 'Aucune demande en attente.'}</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={onExport} disabled={requests.length === 0} className="rounded-xl border border-emerald-300/35 bg-emerald-500/15 p-2 text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-40" aria-label="Exporter les demandes"><Download size={16}/></button><button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button></div></header>
      <div className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">{requests.map((request) => { const meta = statusMeta(request.status); return <button key={request.id} type="button" onClick={() => onSelect(request)} className="w-full rounded-2xl border border-white/10 bg-black/15 p-3 text-left transition hover:border-emerald-300/35 hover:bg-emerald-500/[0.05]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{request.ba?.name || 'BA Merchant'}</b><p className="mt-1 text-[10px] text-gray-400">{request.point_of_sale?.denomination || 'POS non renseigné'} · {request.point_of_sale?.agent_number || '—'} · {request.mfs_name || 'MFS non renseigné'}</p></div><div className="shrink-0 text-right"><b className="block text-sm text-emerald-200">${Number(request.amount).toLocaleString('fr-FR')}</b><span className={`mt-1 inline-block rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${meta.className}`}>{meta.label}</span></div></div><p className="mt-2 text-[10px] text-gray-500">{new Date(request.requested_at).toLocaleString('fr-FR')}</p>{request.note && <p className="mt-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs text-gray-300">{request.note}</p>}</button>; })}{requests.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-xs text-gray-500">Aucune demande de fonds enregistrée.</p>}</div>
    </section>
  </div>;
};
