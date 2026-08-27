import React, { useMemo, useState } from 'react';
import { Banknote, BarChart3, LoaderCircle, Search, Trash2, X } from 'lucide-react';
import type { MerchantFundRequest } from '../../types';
import { MERCHANT_CAMPAIGN_START, merchantTodayIso } from '../../utils/merchantCampaign';
import { DateRangeKnobSlider } from '../DateRangeKnobSlider';
import { DetailPdfExportButton } from './DetailPdfExportButton';

interface MerchantFundRequestsModalProps {
  isOpen: boolean;
  requests: MerchantFundRequest[];
  canArchiveRejected?: boolean;
  onClose: () => void;
  onOpenReport: (requests: MerchantFundRequest[]) => void;
  onSelect: (request: MerchantFundRequest) => void;
  onArchiveRejected?: () => Promise<number>;
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

const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR');
const requestDay = (request: MerchantFundRequest) => request.requested_at.slice(0, 10);

export const MerchantFundRequestsModal: React.FC<MerchantFundRequestsModalProps> = ({
  isOpen, requests, canArchiveRejected = false, onClose, onOpenReport, onSelect, onArchiveRejected,
}) => {
  const today = merchantTodayIso();
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState(MERCHANT_CAMPAIGN_START);
  const [endDate, setEndDate] = useState(today);
  const [archiveConfirmationOpen, setArchiveConfirmationOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const filteredRequests = useMemo(() => {
    const search = normalize(query.trim());
    return requests.filter((request) => {
      const inPeriod = requestDay(request) >= startDate && requestDay(request) <= endDate;
      if (!inPeriod) return false;
      if (!search) return true;
      const haystack = [
        request.ba?.name,
        request.ba?.phone,
        request.ba_phone,
        request.supervisor?.name,
        request.mfs_name,
        request.point_of_sale?.denomination,
        request.point_of_sale?.agent_number,
        request.point_of_sale?.pool,
        request.note,
        statusMeta(request.status).label,
        request.amount,
      ].map(normalize).join(' ');
      return haystack.includes(search);
    });
  }, [requests, query, startDate, endDate]);

  const pending = filteredRequests.filter((request) => request.status === 'pending').length;
  const rejectedCount = requests.filter((request) => request.status === 'rejected').length;
  const filtersActive = query.trim() || startDate !== MERCHANT_CAMPAIGN_START || endDate !== today;

  const archiveRejected = async () => {
    if (!onArchiveRejected) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await onArchiveRejected();
      setArchiveConfirmationOpen(false);
    } catch (caught) {
      setArchiveError(caught instanceof Error ? caught.message : 'Archivage des demandes rejetées impossible.');
    } finally {
      setArchiving(false);
    }
  };

  if (!isOpen) return null;
  const detailDocument = { title: 'Demandes de fonds', subtitle: `${filteredRequests.length} demande${filteredRequests.length > 1 ? 's' : ''} affichée${filteredRequests.length > 1 ? 's' : ''} · ${startDate} au ${endDate}`, filename: `demandes-fonds-${startDate}-${endDate}`, sections: [{ title: 'Demandes affichées', rows: filteredRequests.map((request, index) => ({ label: `#${index + 1} · ${request.ba?.name || 'Brand Ambassador'}`, value: `${request.point_of_sale?.denomination || 'POS non renseigné'} · ${request.mfs_name || 'MFS non renseigné'} · $${Number(request.amount || 0).toLocaleString('fr-FR')} · ${statusMeta(request.status).label}` })) }] };
  return <div className="fixed inset-0 z-[145] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fund-requests-title">
    <section className="glass-card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-emerald-300/25 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
      <header className="modal-sticky-header flex items-start justify-between gap-3 p-4 sm:p-5"><div className="flex min-w-0 items-center gap-2"><Banknote className="shrink-0 text-emerald-200" size={20}/><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/70">Pilotage Merchant</p><h2 id="fund-requests-title" className="mt-1 text-lg font-black text-white">Demandes de fonds</h2><p className="mt-1 text-xs text-gray-400">{pending ? `${pending} demande${pending > 1 ? 's' : ''} en attente dans la sélection.` : 'Aucune demande en attente dans la sélection.'}</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={() => onOpenReport(filteredRequests)} disabled={filteredRequests.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-2.5 py-2 text-[9px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-40" aria-label="Ouvrir le rapport des demandes filtrées"><BarChart3 size={15}/>Rapport</button><DetailPdfExportButton document={detailDocument}/><button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button></div></header>

      {canArchiveRejected && rejectedCount > 0 && <section className="border-y border-rose-300/15 bg-rose-500/[0.045] px-4 py-3 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-100">Hygiène du registre</p><p className="mt-1 text-[10px] leading-relaxed text-gray-400">{rejectedCount} demande{rejectedCount > 1 ? 's rejetées' : ' rejetée'} sera{rejectedCount > 1 ? 'ont' : ''} archivée{rejectedCount > 1 ? 's' : ''} hors du flux et des calculs actifs.</p></div><button type="button" onClick={() => { setArchiveError(''); setArchiveConfirmationOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-[9px] font-black uppercase text-rose-100 transition hover:bg-rose-500/25"><Trash2 size={14}/>Archiver les rejetées</button></div>{archiveConfirmationOpen && <div className="mt-3 rounded-2xl border border-rose-300/25 bg-black/25 p-3"><p className="text-xs font-bold text-rose-50">Retirer ces {rejectedCount} demandes rejetées du registre actif ? Elles restent conservées dans l’archive technique, mais ne seront plus servies dans l’application ni les exports courants.</p>{archiveError && <p className="mt-2 text-[10px] font-bold text-rose-200">{archiveError}</p>}<div className="mt-3 flex gap-2"><button type="button" disabled={archiving} onClick={() => setArchiveConfirmationOpen(false)} className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-black uppercase text-gray-300">Annuler</button><button type="button" disabled={archiving} onClick={() => void archiveRejected()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-300/45 bg-rose-500/20 px-3 py-2 text-[9px] font-black uppercase text-rose-50 disabled:opacity-45">{archiving && <LoaderCircle size={13} className="animate-spin"/>}{archiving ? 'Archivage…' : 'Confirmer'}</button></div></div>}</section>}

      <section className="space-y-3 border-b border-white/[0.08] bg-black/[0.16] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">Recherche et période</p><p className="mt-1 text-[10px] text-gray-400">{filteredRequests.length}/{requests.length} demande{requests.length > 1 ? 's' : ''} affichée{filteredRequests.length > 1 ? 's' : ''}</p></div>{filtersActive && <button type="button" onClick={() => { setQuery(''); setStartDate(MERCHANT_CAMPAIGN_START); setEndDate(today); }} className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[9px] font-black uppercase text-gray-300 transition hover:bg-white/10">Réinitialiser</button>}</div><div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BA, téléphone, POS, MFS, note ou statut" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div><DateRangeKnobSlider minDate={MERCHANT_CAMPAIGN_START} maxDate={today} startDate={startDate} endDate={endDate} onChange={({ startDate: nextStart, endDate: nextEnd }) => { setStartDate(nextStart); setEndDate(nextEnd); }}/></section>
      <div className="space-y-2 p-4 sm:p-5">{filteredRequests.map((request) => { const meta = statusMeta(request.status); return <button key={request.id} type="button" onClick={() => onSelect(request)} className="w-full rounded-2xl border border-white/10 bg-black/15 p-3 text-left transition hover:border-emerald-300/35 hover:bg-emerald-500/[0.05]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{request.ba?.name || 'BA Merchant'}</b><p className="mt-1 text-[10px] text-gray-400">{request.point_of_sale?.denomination || 'POS non renseigné'} · {request.point_of_sale?.agent_number || '—'} · {request.mfs_name || 'MFS non renseigné'}</p></div><div className="shrink-0 text-right"><b className="block text-sm text-emerald-200">${Number(request.amount).toLocaleString('fr-FR')}</b><span className={`mt-1 inline-block rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${meta.className}`}>{meta.label}</span></div></div><p className="mt-2 text-[10px] text-gray-500">{new Date(request.requested_at).toLocaleString('fr-FR')}</p>{request.note && <p className="mt-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs text-gray-300">{request.note}</p>}</button>; })}{filteredRequests.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-xs text-gray-500">Aucune demande ne correspond à cette recherche ou à cette période.</p>}</div>
    </section>
  </div>;
};
