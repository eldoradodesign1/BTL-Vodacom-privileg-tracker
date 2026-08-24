import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, Clock3, Image, MapPin, Store, X } from 'lucide-react';
import type { BAPosVisit, CampaignRun } from '../../types';
import type { MerchantTeamActivity } from '../../utils/merchantCampaign';
import { getMerchantEvidencePublicUrl, getPosVisitsForDay } from '../../utils/merchantCampaign';
import { ImageLightboxModal, type LightboxImage } from './ImageLightboxModal';

type VisitWithPhoto = BAPosVisit & { photoUrl?: string };

interface MerchantVisitedPosModalProps {
  isOpen: boolean;
  activity: MerchantTeamActivity | null;
  run: CampaignRun | null;
  onClose: () => void;
}

const visitTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
const visitMoment = (value?: string | null) => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const MerchantVisitedPosModal: React.FC<MerchantVisitedPosModalProps> = ({ isOpen, activity, run, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visits, setVisits] = useState<VisitWithPhoto[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<VisitWithPhoto | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);

  const activityDate = activity?.attendance?.activity_date || '';

  useEffect(() => {
    if (!isOpen || !activity || !run || !activityDate) return;
    setLoading(true);
    setError('');
    setSelectedVisit(null);
    setLightbox(null);
    void getPosVisitsForDay(activity.ba.id, run.id, activityDate)
      .then(async (items) => Promise.all(items.map(async (visit) => ({
        ...visit,
        photoUrl: visit.arrival_photo_path ? await getMerchantEvidencePublicUrl(visit.arrival_photo_path) : '',
      }))))
      .then(setVisits)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Impossible de charger les POS visités.'))
      .finally(() => setLoading(false));
  }, [activity?.ba.id, activityDate, isOpen, run?.id]);

  const mapUrl = useMemo(() => selectedVisit?.latitude != null && selectedVisit?.longitude != null
    ? `https://www.google.com/maps?q=${selectedVisit.latitude},${selectedVisit.longitude}&z=16&output=embed`
    : '', [selectedVisit?.latitude, selectedVisit?.longitude]);

  if (!isOpen || !activity) return null;

  const isInactive = selectedVisit?.operational_status === 'inactive';
  const title = selectedVisit ? 'Détail du POS' : 'POS visités';
  const subtitle = selectedVisit
    ? `${selectedVisit.point_of_sale?.denomination || 'POS Merchant'} · ${selectedVisit.point_of_sale?.agent_number || selectedVisit.pos_id}`
    : `${activity.ba.name} · ${activityDate || 'Date non renseignée'}`;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
      <section className="modal-sheet relative w-full max-w-xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="merchant-visited-pos-title">
        <div className="modal-handle" />
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={18}/></button>
        <div className="mb-5 flex items-start gap-3 pr-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">{selectedVisit ? <Store size={21}/> : <Store size={21}/>}</div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/70">Suivi terrain</p><h2 id="merchant-visited-pos-title" className="mt-1 text-lg font-black text-white">{title}</h2><p className="mt-0.5 text-[11px] font-bold uppercase text-gray-400">{subtitle}</p></div>
        </div>

        {loading ? <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement des POS…</div> : error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">{error}</div> : selectedVisit ? <div className="space-y-3">
          <button type="button" onClick={() => setSelectedVisit(null)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-black uppercase text-gray-200 transition hover:bg-white/10"><ChevronLeft size={15}/> Liste des POS</button>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">{selectedVisit.photoUrl ? <button type="button" onClick={() => setLightbox({ url: selectedVisit.photoUrl || '', alt: `Photo d’arrivée ${selectedVisit.point_of_sale?.denomination || 'POS Merchant'}` })} className="group relative block h-52 w-full overflow-hidden text-left" aria-label="Ouvrir la photo d’arrivée en plein écran"><img src={selectedVisit.photoUrl} alt={`Photo d’arrivée ${selectedVisit.point_of_sale?.denomination || ''}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-3 pb-3 pt-8 text-[10px] font-black uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">Voir en entier</span></button> : <div className="flex h-52 flex-col items-center justify-center text-sm text-gray-500"><Image className="mb-2" size={24}/>Photo indisponible</div>}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center gap-2 text-emerald-200"><Clock3 size={16}/><span className="text-[10px] font-black uppercase tracking-wide">Arrivée</span></div><b className="mt-1 block text-base text-white">{visitMoment(selectedVisit.visited_at)}</b><div className="mt-4 flex items-center gap-2 text-cyan-200"><MapPin size={16}/><span className="text-[10px] font-black uppercase tracking-wide">GPS</span></div><p className="mt-1 text-sm text-gray-300">{selectedVisit.accuracy_m != null ? `Précision ± ${Math.round(Number(selectedVisit.accuracy_m))} m` : 'Précision non renseignée'}</p></div>
          </div>
          <div className={`rounded-2xl border p-4 ${isInactive ? 'border-amber-300/30 bg-amber-500/[0.08]' : 'border-emerald-300/20 bg-emerald-500/[0.05]'}`}><div className="flex items-center gap-2"><>{isInactive ? <AlertTriangle size={17} className="text-amber-200"/> : <CheckCircle2 size={17} className="text-emerald-200"/>}</><h3 className="text-sm font-black text-white">{isInactive ? 'POS validé non actif' : 'POS actif'}</h3></div><p className={`mt-2 text-xs leading-relaxed ${isInactive ? 'text-amber-100/85' : 'text-emerald-100/85'}`}>{isInactive ? 'Ce POS compte comme couvert et ne requiert aucune activation.' : `${selectedVisit.transactions?.length || 0}/3 transactions enregistrées pour ce POS.`}</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Transactions</p>{selectedVisit.transactions?.length ? <div className="space-y-2">{selectedVisit.transactions.map((transaction) => <div key={transaction.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-xs"><div><p className="font-bold text-white">Client {transaction.client_number || 'non renseigné'}</p><p className="text-[10px] text-gray-500">{transaction.transaction_reference || 'Référence à compléter'}</p></div><b className="text-emerald-100">{Number(transaction.amount || 0).toLocaleString('fr-FR')}</b></div>)}</div> : <p className="text-xs text-gray-500">Aucune transaction enregistrée pour ce POS.</p>}</div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"><div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-cyan-100"><MapPin size={15}/> Localisation d’arrivée</div>{mapUrl ? <iframe title={`Carte ${selectedVisit.point_of_sale?.denomination || 'POS'}`} src={mapUrl} className="h-64 w-full border-0" loading="lazy" allowFullScreen/> : <div className="p-6 text-center text-sm text-gray-500">Coordonnées GPS indisponibles pour ce POS.</div>}</div>
        </div> : <div className="space-y-2">{visits.map((visit) => { const inactive = visit.operational_status === 'inactive'; const transactionCount = visit.transactions?.length || 0; return <button key={visit.id} type="button" onClick={() => setSelectedVisit(visit)} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.06]"><div className="flex gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">{visit.photoUrl ? <img src={visit.photoUrl} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-gray-500"><Image size={18}/></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-black text-white">{visit.point_of_sale?.denomination || 'POS Merchant'}</h3><p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-cyan-100">{visit.point_of_sale?.agent_number || visit.pos_id}</p></div><span className="shrink-0 text-[10px] font-black text-amber-100">{visitTime(visit.visited_at)}</span></div><p className="mt-1 truncate text-[11px] text-gray-400">{visit.point_of_sale?.address || 'Adresse non renseignée'}</p><p className={`mt-1 text-[10px] font-black uppercase ${inactive ? 'text-amber-200' : transactionCount >= 3 ? 'text-emerald-200' : 'text-cyan-100'}`}>{inactive ? 'Non actif · couvert' : `${transactionCount}/3 transactions`}</p></div></div></button>; })}{visits.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-gray-400">Aucun POS visité par ce BA pour cette date.</div>}</div>}
      </section>
      <ImageLightboxModal image={lightbox} onClose={() => setLightbox(null)} />
    </div>,
    document.body,
  );
};
