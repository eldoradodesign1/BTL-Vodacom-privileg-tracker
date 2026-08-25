import React, { useEffect, useState } from 'react';
import { ArrowLeft, Banknote, ImageIcon, MapPin, ReceiptText, Smartphone, X } from 'lucide-react';
import type { BATransaction } from '../../types';
import type { MerchantTeamActivity } from '../../utils/merchantCampaign';
import { getMerchantEvidencePublicUrl } from '../../utils/merchantCampaign';
import { ImageLightboxModal, type LightboxImage } from './ImageLightboxModal';

interface MerchantTransactionsDetailModalProps {
  isOpen: boolean;
  activity: MerchantTeamActivity | null;
  initialTransaction?: BATransaction | null;
  onClose: () => void;
}

const amount = (value: number) => Number(value || 0).toLocaleString('fr-FR');
const time = (value: string) => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const MerchantTransactionsDetailModal: React.FC<MerchantTransactionsDetailModalProps> = ({ isOpen, activity, initialTransaction = null, onClose }) => {
  const [selected, setSelected] = useState<BATransaction | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  useEffect(() => { if (isOpen) { setSelected(initialTransaction); setEvidenceUrl(''); setLightbox(null); } }, [isOpen, activity?.ba.id, initialTransaction]);
  useEffect(() => {
    if (!selected?.evidence_path) { setEvidenceUrl(''); return; }
    let active = true;
    void getMerchantEvidencePublicUrl(selected.evidence_path).then((url) => { if (active) setEvidenceUrl(url); }).catch(() => { if (active) setEvidenceUrl(''); });
    return () => { active = false; };
  }, [selected?.evidence_path]);

  if (!isOpen || !activity) return null;
  const transactions = activity.transactions;

  return <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
    <section className="modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Transactions du Brand Ambassador">
      <div className="modal-sticky-header"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200">{selected ? <ReceiptText size={20}/> : <Banknote size={20}/>}</div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200/70">Transactions Merchant</p><h2 className="mt-1 text-lg font-black">{selected ? selected.point_of_sale?.denomination || 'Détail transaction' : `${transactions.length} transaction${transactions.length > 1 ? 's' : ''}`}</h2><p className="mt-0.5 text-[11px] text-gray-400">{activity.ba.name}</p></div></div><button type="button" onClick={selected ? () => setSelected(null) : onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white" aria-label={selected ? 'Retour à la liste' : 'Fermer'}>{selected ? <ArrowLeft size={18}/> : <X size={18}/>}</button></div></div>
      {!selected ? <div className="mt-5 space-y-2">{transactions.map((transaction) => <button type="button" key={transaction.id} onClick={() => setSelected(transaction)} className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-amber-300/35 hover:bg-amber-500/[0.06]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{transaction.point_of_sale?.denomination || 'POS Merchant'}</b><p className="mt-1 text-[10px] font-bold text-gray-400">{transaction.point_of_sale?.agent_number || '—'} · {time(transaction.occurred_at)}</p><p className="mt-1 truncate text-[10px] text-gray-500">Client {transaction.client_number || '—'} · Réf. {transaction.transaction_reference || 'Non renseignée'}</p></div><b className="shrink-0 text-sm text-emerald-100">{amount(transaction.amount)}</b></div></button>)}{transactions.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-gray-400">Aucune transaction pour cette journée.</div>}</div> : <div className="mt-5 space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><span className="text-[9px] font-black uppercase text-gray-500">Montant</span><b className="mt-1 block text-lg text-emerald-100">{amount(selected.amount)}</b></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><span className="text-[9px] font-black uppercase text-gray-500">Heure</span><b className="mt-1 block text-lg text-amber-100">{time(selected.occurred_at)}</b></div></div><div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm"><p><span className="text-gray-500">POS · </span><b>{selected.point_of_sale?.agent_number || '—'} · {selected.point_of_sale?.denomination || 'Merchant'}</b></p><p className="mt-2"><span className="text-gray-500">Référence · </span>{selected.transaction_reference || 'Non renseignée'}</p><p className="mt-2 flex items-center gap-1"><Smartphone size={13} className="text-cyan-200"/><span>{selected.client_number || 'Numéro client non renseigné'}</span></p>{selected.comment && <p className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-xs leading-relaxed text-gray-300">{selected.comment}</p>}</div>{evidenceUrl && <button type="button" onClick={() => setLightbox({ url: evidenceUrl, alt: 'Preuve de transaction' })} className="group relative block h-44 w-full overflow-hidden rounded-2xl border border-white/10"><img src={evidenceUrl} alt="Preuve de transaction" className="h-full w-full object-cover transition group-hover:scale-[1.03]"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-[10px] font-black uppercase text-white"><ImageIcon className="mr-1 inline" size={13}/>Voir la preuve</span></button>}{typeof selected.latitude === 'number' && typeof selected.longitude === 'number' && <div className="overflow-hidden rounded-2xl border border-white/10"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-black uppercase text-rose-100"><MapPin size={13}/>Localisation</div><iframe title="Localisation de la transaction" src={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}&output=embed`} className="h-56 w-full border-0" loading="lazy" referrerPolicy="no-referrer"/></div>}</div>}
    </section>
    <ImageLightboxModal image={lightbox} onClose={() => setLightbox(null)}/>
  </div>;
};
