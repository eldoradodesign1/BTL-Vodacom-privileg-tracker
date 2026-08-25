import React, { useState } from 'react';
import { Banknote, CheckCircle2, Clipboard, ExternalLink, Phone, Store, X, XCircle } from 'lucide-react';
import type { MerchantFundRequest, User } from '../../types';
import { updateMerchantFundRequestStatus } from '../../utils/merchantCampaign';

interface MerchantFundRequestDecisionModalProps {
  request: MerchantFundRequest | null;
  currentUser: User;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_LABEL: Record<MerchantFundRequest['status'], string> = {
  pending: 'En attente', reviewed: 'Consultée', approved: 'Approuvée', rejected: 'Rejetée', cancelled: 'Annulée',
};

export const MerchantFundRequestDecisionModal: React.FC<MerchantFundRequestDecisionModalProps> = ({ request, currentUser, onClose, onUpdated }) => {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  if (!request) return null;
  const phone = request.ba_phone || request.ba?.phone || '';
  const isPending = request.status === 'pending';

  const copyPhone = async () => {
    if (!phone) { setFeedback('Aucun numéro BA n’est renseigné.'); return; }
    try {
      await navigator.clipboard.writeText(phone);
      setFeedback('Numéro BA copié dans le presse-papiers.');
    } catch {
      setFeedback(`Copiez ce numéro : ${phone}`);
    }
  };

  const launchPayment = () => {
    const dialer = 'tel:*1122%23';
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid) {
      window.location.href = dialer;
      return;
    }
    const fallback = window.setTimeout(() => {
      if (document.visibilityState === 'visible') window.location.href = dialer;
    }, 1800);
    const cancelFallback = () => window.clearTimeout(fallback);
    document.addEventListener('visibilitychange', cancelFallback, { once: true });
    window.location.href = 'intent://#Intent;scheme=mpesa;package=com.vodafone.mpesa.drc;end';
  };

  const decide = async (status: 'approved' | 'rejected') => {
    setSaving(true); setFeedback('');
    try {
      await updateMerchantFundRequestStatus(request.id, status, currentUser.id);
      if (status === 'approved') {
        await copyPhone();
        setFeedback(phone ? 'Demande approuvée. Numéro copié ; ouverture du parcours MyM‑Pesa RDC…' : 'Demande approuvée. Aucun numéro BA à copier.');
        window.setTimeout(launchPayment, 250);
      } else {
        setFeedback('Demande rejetée.');
      }
      onUpdated();
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Impossible de mettre à jour la demande.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[145] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fund-decision-title">
    <section className="glass-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-emerald-300/25 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
      <header className="modal-sticky-header flex items-start justify-between gap-4 p-4 sm:p-5"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Demande de fonds Merchant</p><h2 id="fund-decision-title" className="mt-1 text-lg font-black text-white">{request.ba?.name || 'Brand Ambassador'}</h2><p className="mt-1 text-xs text-gray-300">{new Date(request.requested_at).toLocaleString('fr-FR')}</p></div><button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button></header>
      <div className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.08] p-3"><span className="text-[9px] font-black uppercase text-emerald-100/70">Montant demandé</span><b className="mt-1 block text-xl font-black text-emerald-100">${Number(request.amount).toLocaleString('fr-FR')}</b></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3"><span className="text-[9px] font-black uppercase text-gray-500">Statut</span><b className={`mt-1 block text-xs font-black ${request.status === 'approved' ? 'text-emerald-200' : request.status === 'rejected' ? 'text-rose-200' : 'text-amber-100'}`}>{STATUS_LABEL[request.status]}</b></div></div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3"><span className="text-[9px] font-black uppercase text-gray-500">POS et MFS</span><b className="mt-1 block text-sm text-white">{request.point_of_sale?.denomination || 'POS non renseigné'}</b><p className="mt-1 text-[10px] text-gray-400">{request.point_of_sale?.agent_number || '—'} · {request.point_of_sale?.pool || '—'} · MFS : {request.mfs_name || 'Non renseigné'}</p></div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.06] p-3"><span className="text-[9px] font-black uppercase text-cyan-100/70">Numéro BA</span><div className="mt-1 flex items-center justify-between gap-3"><b className="min-w-0 truncate text-sm text-white">{phone || 'Non renseigné'}</b><button type="button" onClick={() => void copyPhone()} disabled={!phone} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-[9px] font-black uppercase text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40"><Clipboard size={13}/>Copier</button></div></div>
        {request.note && <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><span className="text-[9px] font-black uppercase text-gray-500">Note BA</span><p className="mt-1 text-sm leading-relaxed text-gray-200">{request.note}</p></div>}
        {feedback && <p className="rounded-2xl border border-emerald-300/25 bg-emerald-500/[0.08] p-3 text-xs font-semibold text-emerald-50">{feedback}</p>}
        {isPending && <div className="grid grid-cols-2 gap-3"><button type="button" disabled={saving} onClick={() => void decide('rejected')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/35 bg-rose-500/12 px-3 py-3 text-[10px] font-black uppercase text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-45"><XCircle size={16}/>Rejeter</button><button type="button" disabled={saving} onClick={() => void decide('approved')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/40 bg-emerald-500/15 px-3 py-3 text-[10px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-45"><CheckCircle2 size={16}/>{saving ? 'Validation…' : 'Valider'}</button></div>}
        {request.status === 'approved' && <button type="button" onClick={launchPayment} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-3 text-[10px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/25"><ExternalLink size={16}/>Ouvrir M‑Pesa RDC / *1122#</button>}
        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-gray-500"><Phone size={13} className="mt-0.5 shrink-0"/>L’application de paiement ou le composeur s’ouvre, mais l’appel et le paiement restent sous le contrôle du superviseur.</p>
      </div>
    </section>
  </div>;
};
