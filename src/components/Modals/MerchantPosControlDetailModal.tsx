import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Clock3, MapPin, ReceiptText, X } from 'lucide-react';
import type { MerchantPosControlItem } from '../../utils/merchantCampaign';
import { getMerchantEvidencePublicUrl } from '../../utils/merchantCampaign';
import { ImageLightboxModal, type LightboxImage } from './ImageLightboxModal';

interface MerchantPosControlDetailModalProps {
  item: MerchantPosControlItem | null;
  transactionsPerPosTarget: number;
  onClose: () => void;
}

export const MerchantPosControlDetailModal: React.FC<MerchantPosControlDetailModalProps> = ({ item, transactionsPerPosTarget, onClose }) => {
  const [arrivalPhoto, setArrivalPhoto] = useState('');
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  useEffect(() => {
    if (!item) return;
    let alive = true;
    setArrivalPhoto('');
    setProofs({});
    setLightbox(null);
    void Promise.all([
      getMerchantEvidencePublicUrl(item.visit?.arrival_photo_path),
      Promise.all(item.transactions.map(async (transaction) => [transaction.id, await getMerchantEvidencePublicUrl(transaction.evidence_path)] as const)),
    ]).then(([arrival, entries]) => {
      if (!alive) return;
      setArrivalPhoto(arrival);
      setProofs(Object.fromEntries(entries));
    }).catch(() => {
      if (!alive) return;
      setArrivalPhoto('');
      setProofs({});
    });
    return () => { alive = false; };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;
  const coords = item.visit?.latitude != null && item.visit?.longitude != null
    ? { lat: item.visit.latitude, lng: item.visit.longitude }
    : item.pos.latitude != null && item.pos.longitude != null
      ? { lat: item.pos.latitude, lng: item.pos.longitude }
      : null;
  const arrival = item.visit?.visited_at ? new Date(item.visit.visited_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Aucune arrivée enregistrée';
  const statusLabel = item.status === 'completed' ? 'Complété' : item.status === 'inactive' ? 'Non actif' : item.status === 'incomplete' ? 'Inachevé' : item.status === 'active' ? 'Actif' : 'À traiter';
  const statusClass = item.status === 'completed'
    ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'
    : item.status === 'inactive'
      ? 'border-amber-300/45 bg-amber-500/15 text-amber-100'
      : item.status === 'incomplete'
        ? 'border-rose-300/45 bg-rose-500/15 text-rose-100'
      : item.status === 'active'
        ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100'
        : 'border-violet-300/35 bg-violet-500/12 text-violet-100';

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
    <section className="modal-sheet max-h-[92vh] w-full overflow-y-auto rounded-t-[30px] border border-white/15 bg-[#111a2b]/95 p-4 shadow-2xl sm:max-w-xl sm:rounded-[30px]" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-label={`Détails du POS ${item.pos.denomination}`}>
      <div className="modal-sticky-header"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.17em] text-cyan-200">Détail opérationnel POS</p><h2 className="mt-1 truncate text-lg font-black text-white">{item.pos.denomination}</h2><p className="mt-1 text-xs text-gray-400">{item.pos.agent_number} · {item.pos.pool} · {item.pos.address}</p></div><button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" title="Fermer"><X size={18}/></button></div></div>
      <div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass}`}>{statusLabel}</span><span className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black text-gray-200">{item.status === 'inactive' ? 'Aucune transaction requise' : `${item.transactionCount}/${transactionsPerPosTarget} transactions`}</span>{item.ba && <span className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black text-gray-200">BA : {item.ba.name}</span>}</div>
      {item.status === 'incomplete' && <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold leading-relaxed text-rose-100">Ce POS actif a été quitté ou clôturé avant l’objectif. Il reste à {Math.max(0, transactionsPerPosTarget - item.transactionCount)} transaction{Math.max(0, transactionsPerPosTarget - item.transactionCount) > 1 ? 's' : ''} pour être complété.</p>}
      <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2"><Camera size={16} className="text-cyan-200"/><span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-200">Arrivée au POS</span></div><div className="grid grid-cols-[7rem_1fr] gap-3 p-3">{arrivalPhoto ? <button type="button" onClick={() => setLightbox({ url: arrivalPhoto, alt: `Arrivée à ${item.pos.denomination}` })} className="group relative h-24 overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left"><img src={arrivalPhoto} alt={`Arrivée à ${item.pos.denomination}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105"/><span className="absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-center text-[8px] font-black uppercase text-white opacity-0 transition group-hover:opacity-100">Agrandir</span></button> : <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20"><Camera size={22} className="text-gray-600"/></div>}<div className="min-w-0"><p className="flex items-center gap-1 text-xs font-bold text-white"><Clock3 size={14} className="text-cyan-200"/>{arrival}</p><p className="mt-1 text-[10px] text-gray-400">{item.visit?.accuracy_m != null ? `Précision GPS : ${Math.round(item.visit.accuracy_m)} m` : 'Précision GPS non disponible'}</p><p className="mt-1 text-[10px] text-gray-400">{item.ba ? `Visite enregistrée par ${item.ba.name}` : 'POS non encore attribué à une visite'}</p></div></div></section>
      {item.status === 'inactive' ? <section className="mt-4 overflow-hidden rounded-2xl border border-amber-300/20 bg-amber-500/[0.06]"><div className="flex items-center gap-2 border-b border-amber-300/15 px-3 py-2"><ReceiptText size={16} className="text-amber-200"/><span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Constat terrain</span></div><div className="p-3"><p className="text-[10px] font-black uppercase tracking-wide text-amber-200/70">Motif déclaré non actif</p><p className="mt-1 text-xs font-semibold leading-relaxed text-amber-50">{item.visit?.operational_note?.trim() || 'Commentaire non renseigné lors de la validation.'}</p></div></section> : <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2"><ReceiptText size={16} className="text-amber-200"/><span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-200">Transactions réalisées</span></div><div className="divide-y divide-white/[0.07]">{Array.from({ length: transactionsPerPosTarget }, (_, index) => item.transactions[index]).map((transaction, index) => <div key={transaction?.id || `pending-${index}`} className="flex items-center gap-3 p-3">{transaction && proofs[transaction.id] ? <button type="button" onClick={() => setLightbox({ url: proofs[transaction.id], alt: `Preuve transaction ${index + 1} · ${item.pos.denomination}` })} className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20"><img src={proofs[transaction.id]} alt={`Preuve transaction ${index + 1}`} className="h-full w-full object-cover transition group-hover:scale-110"/></button> : <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20">{transaction ? <ReceiptText size={16} className="text-amber-200"/> : <span className="text-xs font-black text-gray-600">T{index + 1}</span>}</div>}<div className="min-w-0 flex-1">{transaction ? <><p className="truncate text-xs font-black text-white">{transaction.client_number || transaction.transaction_reference || 'Transaction sans référence'}</p><p className="mt-0.5 text-[10px] text-gray-400">{Number(transaction.amount || 0).toLocaleString('fr-FR')} · {new Date(transaction.occurred_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p></> : <p className="text-xs font-bold text-gray-500">Transaction {index + 1} en attente</p>}</div>{transaction && <CheckCircle2 size={16} className="text-emerald-300"/>}</div>)}</div></section>}
      <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2"><MapPin size={16} className="text-rose-200"/><span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-200">Localisation</span></div>{coords ? <iframe title={`Carte de ${item.pos.denomination}`} src={`https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`} className="h-56 w-full border-0" loading="lazy"/> : <div className="p-5 text-center text-xs text-gray-500">Aucune coordonnée n’est disponible pour ce POS.</div>}</section>
    </section>
    <ImageLightboxModal image={lightbox} onClose={() => setLightbox(null)} />
  </div>;
};
