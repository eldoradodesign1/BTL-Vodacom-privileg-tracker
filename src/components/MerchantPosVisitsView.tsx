import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Hash, Image, LoaderCircle, MapPin, PlusCircle, RefreshCw, Smartphone, Store, X } from 'lucide-react';
import type { BAPosVisit, CampaignRun, PointOfSale, User } from '../types';
import { getActiveCampaignRuns, getCampaignPos, getDailyAttendance, getMerchantCampaign, getMerchantEvidencePublicUrl, getPosVisitsForBA, getPosVisitsForDay, markMerchantPosVisitActive, markMerchantPosVisitInactive } from '../utils/merchantCampaign';
import { DateIconPicker } from './DateIconPicker';
import { MerchantPosValidationModal } from './Modals/MerchantPosValidationModal';
import { toISO } from '../utils/storage';
import { runInBackground } from '../utils/backgroundOperations';
import { DetailPdfExportButton } from './Modals/DetailPdfExportButton';

interface MerchantPosVisitsViewProps {
  currentUser: User;
  campaignPaused?: boolean;
}

type VisitWithProof = BAPosVisit & { photoUrl?: string };

const transactionSlots = (visit: BAPosVisit, target = 3) => Array.from({ length: target }, (_, index) => visit.transactions?.[index] || null);

export const MerchantPosVisitsView: React.FC<MerchantPosVisitsViewProps> = ({ currentUser, campaignPaused = false }) => {
  const today = toISO(new Date());
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [visits, setVisits] = useState<VisitWithProof[]>([]);
  const [positions, setPositions] = useState<PointOfSale[]>([]);
  const [mfsName, setMfsName] = useState('');
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<VisitWithProof | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; label: string } | null>(null);
  const [loadingPhotoVisitId, setLoadingPhotoVisitId] = useState<string | null>(null);
  const [inactiveNote, setInactiveNote] = useState('');
  const [markingInactive, setMarkingInactive] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [inactiveError, setInactiveError] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [showHistory, setShowHistory] = useState(false);

  const refresh = async (scope: 'day' | 'history' = showHistory ? 'history' : 'day', activityDate = selectedDate) => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('Campagne Merchant introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      setRun(activeRun);
      if (!activeRun) { setVisits([]); return; }
      const [nextVisits, nextPositions, nextAttendance] = await Promise.all([
        scope === 'history' ? getPosVisitsForBA(currentUser.id, activeRun.id) : getPosVisitsForDay(currentUser.id, activeRun.id, activityDate),
        getCampaignPos(campaign.id),
        getDailyAttendance(currentUser.id, activeRun.id, today),
      ]);
      const enrichedVisits = scope === 'history'
        ? nextVisits.map((visit) => ({ ...visit, photoUrl: '' }))
        : await Promise.all(nextVisits.map(async (visit) => ({ ...visit, photoUrl: visit.arrival_photo_path ? await getMerchantEvidencePublicUrl(visit.arrival_photo_path) : '' })));
      setPositions(nextPositions);
      setMfsName(nextAttendance?.mfs_name?.trim() || '');
      setVisits(enrichedVisits);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger vos POS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [currentUser.id]);

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de vos POS…</div>;

  const mapsUrl = selectedVisit?.latitude != null && selectedVisit?.longitude != null
    ? `https://www.google.com/maps?q=${selectedVisit.latitude},${selectedVisit.longitude}&z=16&output=embed`
    : '';
  const transactionTarget = Number(run?.transactions_per_pos_target || 3);
  const visibleVisits = visits;
  const isTodayView = !showHistory && selectedDate === today;
  const openVisit = (visit: VisitWithProof) => {
    setSelectedVisit(visit);
    if (visit.photoUrl || !visit.arrival_photo_path) return;
    setLoadingPhotoVisitId(visit.id);
    void getMerchantEvidencePublicUrl(visit.arrival_photo_path)
      .then((photoUrl) => {
        const enrichedVisit = { ...visit, photoUrl };
        setVisits((current) => current.map((item) => item.id === visit.id ? enrichedVisit : item));
        setSelectedVisit((current) => current?.id === visit.id ? enrichedVisit : current);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Impossible de charger la photo du POS.'))
      .finally(() => setLoadingPhotoVisitId((current) => current === visit.id ? null : current));
  };

  const markSelectedVisitInactive = () => {
    if (!selectedVisit) return;
    if ((selectedVisit.transactions?.length || 0) > 0) {
      setInactiveError('Ce POS possède déjà au moins une transaction et ne peut plus être déclaré non actif.');
      return;
    }
    const visitId = selectedVisit.id;
    const note = inactiveNote;
    setMarkingInactive(true); setInactiveError(''); setSelectedVisit(null); setInactiveNote('');
    runInBackground('Déclaration POS non actif', () => markMerchantPosVisitInactive(visitId, note), {
      queued: 'Déclaration POS lancée en arrière-plan.',
      success: 'POS marqué non actif et synchronisé.',
      onSuccess: () => { setMarkingInactive(false); void refresh(); },
      onError: (caught) => { setMarkingInactive(false); setInactiveError(caught.message); },
    });
  };

  const markSelectedVisitActive = () => {
    if (!selectedVisit) return;
    const visitId = selectedVisit.id;
    setReactivating(true); setInactiveError(''); setSelectedVisit(null);
    runInBackground('Réactivation du POS', () => markMerchantPosVisitActive(visitId), {
      queued: 'Réactivation POS lancée en arrière-plan.',
      success: 'POS réactivé et disponible à nouveau.',
      onSuccess: () => { setReactivating(false); void refresh(); },
      onError: (caught) => { setReactivating(false); setInactiveError(caught.message); },
    });
  };

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card relative overflow-hidden border border-emerald-300/20 p-4">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Merchant Educational Campaign</p><h1 className="mt-1 text-xl font-black text-white">Mes POS</h1>{mfsName && <p className="mt-1 text-[10px] font-bold text-fuchsia-200">MFS du jour · {mfsName}</p>}</div>
          <div className="flex shrink-0 items-center gap-2">{campaignPaused ? <span className="rounded-2xl border border-amber-300/30 bg-amber-500/[0.10] px-3 py-2 text-[9px] font-black uppercase text-amber-100">Campagne en pause</span> : isTodayView && <button type="button" onClick={() => setIsValidationOpen(true)} className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300/30 bg-emerald-500/[0.10] px-3 py-2 text-[10px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/[0.18]"><PlusCircle size={15}/>Ajouter POS</button>}<button type="button" onClick={() => void refresh()} aria-label="Actualiser mes POS" className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-emerald-100 transition-colors hover:bg-white/10"><RefreshCw size={16}/></button></div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 divide-x divide-white/10 rounded-2xl border border-white/[0.08] bg-black/10 text-center"><div className="p-3"><b className="block text-lg font-black text-emerald-300">{visibleVisits.length}</b><span className="text-[9px] font-black uppercase text-gray-400">POS affichés</span></div><div className="p-3"><b className="block text-lg font-black text-amber-200">{visibleVisits.reduce((total, visit) => total + (visit.transactions?.length || 0), 0)}/{visibleVisits.filter((visit) => visit.operational_status !== 'inactive').length * transactionTarget}</b><span className="text-[9px] font-black uppercase text-gray-400">Transactions attendues</span></div></div>
      </section>

      <section className="glass-card space-y-3 p-3"><div className="flex gap-2"><DateIconPicker value={selectedDate} onChange={(date) => { setSelectedDate(date); setShowHistory(false); void refresh('day', date); }} className="inline-flex" buttonClassName="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.05] text-emerald-100" labelClassName="hidden"/><div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-bold text-gray-400">{showHistory ? 'Tous les POS déjà visités' : 'POS de la date sélectionnée'}</div></div><div className="flex gap-2"><button type="button" onClick={() => { setSelectedDate(today); setShowHistory(false); void refresh('day', today); }} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${isTodayView ? 'border-emerald-300/45 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-gray-400'}`}>Aujourd’hui</button><button type="button" onClick={() => { const next = !showHistory; setShowHistory(next); void refresh(next ? 'history' : 'day', selectedDate); }} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${showHistory ? 'border-violet-300/35 bg-violet-400/[0.08] text-violet-100' : 'border-white/10 bg-white/5 text-gray-400'}`}>{showHistory ? 'Historique complet' : 'Voir tout l’historique'}</button></div></section>
      {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
      {!error && visibleVisits.length === 0 && <div className="glass-card p-8 text-center"><Store className="mx-auto mb-3 text-gray-500" size={28}/><p className="text-sm font-bold text-gray-300">Aucun POS pour cette période.</p><p className="mt-2 text-xs leading-relaxed text-gray-500">Choisissez une autre date ou consultez tout l’historique de vos visites.</p></div>}

      {visibleVisits.map((visit) => {
        const transactionCount = visit.transactions?.length || 0;
        return <article key={visit.id} role="button" tabIndex={0} onClick={() => openVisit(visit)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openVisit(visit); } }} className="glass-card cursor-pointer overflow-hidden p-0 transition-all hover:border-emerald-300/40 hover:bg-emerald-400/[0.04] active:scale-[0.99]" aria-label={`Ouvrir les détails du POS ${visit.point_of_sale?.denomination || visit.pos_id}`}>
          <div className="flex gap-3 p-4"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">{visit.photoUrl ? <img src={visit.photoUrl} alt={`Photo d’arrivée ${visit.point_of_sale?.denomination || ''}`} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-gray-500"><Image size={22}/></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-black">{visit.point_of_sale?.denomination || 'POS Merchant'}</h2><p className="mt-1 truncate text-[11px] font-bold uppercase tracking-wide text-emerald-200">Short-code · {visit.point_of_sale?.agent_number || visit.pos_id}</p></div><div className="shrink-0 text-right"><div className="flex items-center justify-end gap-1 text-xs font-black text-amber-200"><Clock3 size={13}/>{visit.visited_at ? new Date(visit.visited_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</div><p className="mt-1 text-[10px] text-gray-500">Arrivée</p></div></div><p className="mt-2 truncate text-[11px] text-gray-400">{visit.point_of_sale?.address || 'Adresse non renseignée'} · {visit.point_of_sale?.pool || 'Pool non renseigné'}</p></div></div>
          {visit.operational_status === 'inactive' ? <div className="border-t border-amber-300/20 bg-amber-500/[0.06] px-4 py-2 text-center text-[10px] font-black uppercase tracking-wide text-amber-100">POS non actif · couverture validée</div> : <><div className="grid grid-cols-3 border-t border-white/[0.08] bg-black/10 text-center">{transactionSlots(visit, transactionTarget).map((transaction, index) => <div key={`${visit.id}-${index}`} className="border-r border-white/[0.08] p-2 last:border-r-0"><span className="block text-[9px] font-black uppercase text-gray-500">T{index + 1}</span>{transaction ? <CheckCircle2 className="mx-auto mt-1 text-emerald-300" size={15}/> : <span className="mt-1 block text-xs font-black text-gray-500">—</span>}</div>)}</div>{visit.status === 'incomplete' && <div className="border-t border-rose-300/20 bg-rose-500/[0.07] px-4 py-2 text-center text-[10px] font-black uppercase tracking-wide text-rose-100">POS actif inachevé · objectif non atteint</div>}</>}
          <div className="flex items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-wide"><span className={visit.operational_status === 'inactive' ? 'text-amber-200' : transactionCount >= transactionTarget ? 'text-emerald-200' : visit.status === 'incomplete' ? 'text-rose-200' : 'text-amber-200'}>{visit.operational_status === 'inactive' ? 'POS non actif · aucune activation requise' : visit.status === 'incomplete' ? `Inachevé · ${transactionCount}/${transactionTarget} transactions` : `${transactionCount}/${transactionTarget} transactions`}</span><span className="text-emerald-200">Détails & carte</span></div>
        </article>;
      })}

      {selectedVisit && (() => { const detailDocument = { title: 'Détail POS visité', subtitle: `${selectedVisit.point_of_sale?.denomination || 'POS Merchant'} · ${selectedDate}`, filename: `pos-visite-${selectedVisit.point_of_sale?.agent_number || selectedVisit.id}`, sections: [{ title: 'POS et visite', rows: [{ label: 'POS', value: selectedVisit.point_of_sale?.denomination }, { label: 'Short-code', value: selectedVisit.point_of_sale?.agent_number || selectedVisit.pos_id }, { label: 'Adresse', value: selectedVisit.point_of_sale?.address }, { label: 'Pool', value: selectedVisit.point_of_sale?.pool }, { label: 'Arrivée', value: selectedVisit.visited_at ? new Date(selectedVisit.visited_at).toLocaleString('fr-FR') : null }, { label: 'Statut', value: selectedVisit.operational_status === 'inactive' ? 'Non actif · couvert' : selectedVisit.status === 'incomplete' ? 'Inachevé' : 'Actif' }, { label: 'Coordonnées', value: selectedVisit.latitude != null && selectedVisit.longitude != null ? `${selectedVisit.latitude}, ${selectedVisit.longitude}` : null }] }, ...(selectedVisit.operational_status === 'inactive' ? [{ title: 'Motif déclaré', text: selectedVisit.operational_note?.trim() || 'Aucun motif renseigné.' }] : [{ title: 'Transactions', rows: (selectedVisit.transactions || []).map((transaction, index) => ({ label: `Transaction ${index + 1}`, value: `${transaction.client_number || 'Client non renseigné'} · ${Number(transaction.amount || 0).toLocaleString('fr-FR')}` })) }]) ] }; return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6" onClick={() => setSelectedVisit(null)} role="dialog" aria-modal="true" aria-labelledby="merchant-pos-detail-title"><section className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-emerald-300/25 p-4 shadow-2xl sm:p-5" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Visite POS</p><h2 id="merchant-pos-detail-title" className="mt-1 text-base font-black">{selectedVisit.point_of_sale?.denomination || 'POS Merchant'}</h2><p className="mt-1 text-xs text-gray-400">{selectedVisit.point_of_sale?.agent_number || selectedVisit.pos_id} · {selectedVisit.point_of_sale?.address || 'Adresse non renseignée'}</p></div><div className="flex shrink-0 items-center gap-2"><DetailPdfExportButton document={detailDocument}/><button type="button" onClick={() => setSelectedVisit(null)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">{selectedVisit.photoUrl ? <button type="button" onClick={() => setPhotoPreview({ url: selectedVisit.photoUrl || '', label: `Photo d’arrivée · ${selectedVisit.point_of_sale?.denomination || 'POS Merchant'}` })} className="group relative block h-52 w-full overflow-hidden text-left" aria-label="Ouvrir la photo de pointage en plein écran"><img src={selectedVisit.photoUrl} alt={`Photo d’arrivée ${selectedVisit.point_of_sale?.denomination || ''}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-3 pb-3 pt-8 text-[10px] font-black uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">Voir en entier</span></button> : selectedVisit.arrival_photo_path && loadingPhotoVisitId === selectedVisit.id ? <div className="flex h-52 flex-col items-center justify-center text-sm font-bold text-emerald-100"><LoaderCircle className="mb-2 animate-spin" size={24}/>Chargement de la photo…</div> : <div className="flex h-52 flex-col items-center justify-center text-sm text-gray-500"><Image className="mb-2" size={24}/>Photo indisponible</div>}</div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center gap-2 text-emerald-200"><Clock3 size={16}/><span className="text-[10px] font-black uppercase tracking-wide">Heure d’arrivée</span></div><b className="mt-1 block text-lg">{selectedVisit.visited_at ? new Date(selectedVisit.visited_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Non renseignée'}</b><div className="mt-4 flex items-center gap-2 text-cyan-200"><MapPin size={16}/><span className="text-[10px] font-black uppercase tracking-wide">Précision GPS</span></div><p className="mt-1 text-sm text-gray-300">{selectedVisit.accuracy_m != null ? `${Math.round(Number(selectedVisit.accuracy_m))} m` : 'Non renseignée'}</p></div></div>
        {selectedVisit.operational_status !== 'inactive' && !campaignPaused && ((selectedVisit.transactions?.length || 0) > 0 ? <section className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/[0.06] p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Statut opérationnel verrouillé</p><p className="mt-1 text-[10px] leading-relaxed text-gray-400">Une transaction est déjà enregistrée sur ce POS. Il ne peut plus être déclaré non actif.</p></section> : <section className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/[0.07] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Déclarer le POS non actif</p><p className="mt-1 text-[10px] leading-relaxed text-gray-400">Si le POS est fermé ou ne fonctionne plus, renseignez ce constat pour qu’il soit couvert sans transactions.</p></div><button type="button" disabled={markingInactive || !inactiveNote.trim()} onClick={markSelectedVisitInactive} className="shrink-0 rounded-xl border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-[9px] font-black uppercase text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-45">{markingInactive ? 'Validation…' : 'Marquer non actif'}</button></div><textarea value={inactiveNote} onChange={(event) => setInactiveNote(event.target.value)} rows={2} placeholder="Constat obligatoire : pourquoi ce POS est non actif ?" className="app-input mt-3 w-full resize-none rounded-xl px-3 py-2.5 text-sm"/>{inactiveError && <p className="mt-2 text-[10px] font-bold text-rose-200">{inactiveError}</p>}</section>)}
        <section className={`mt-4 rounded-2xl border p-4 ${selectedVisit.operational_status === 'inactive' ? 'border-amber-300/25 bg-amber-500/[0.08]' : 'border-white/10 bg-white/[0.03]'}`}><div className="flex items-center justify-between"><h3 className="text-sm font-black">{selectedVisit.operational_status === 'inactive' ? 'POS validé non actif' : 'Les 3 transactions attendues'}</h3><span className={`text-xs font-black ${selectedVisit.operational_status === 'inactive' ? 'text-amber-200' : 'text-amber-200'}`}>{selectedVisit.operational_status === 'inactive' ? '0 requise' : `${selectedVisit.transactions?.length || 0}/3`}</span></div>{selectedVisit.operational_status === 'inactive' ? <div className="mt-2 space-y-3"><p className="text-xs leading-relaxed text-amber-100/80">Ce POS compte comme couvert dans votre journée. Aucune activation n’est requise et il ne vous pénalise pas dans l’objectif transactionnel.</p><div className="rounded-xl border border-amber-200/15 bg-black/15 px-3 py-2.5"><p className="text-[9px] font-black uppercase tracking-wide text-amber-200/80">Motif déclaré</p><p className="mt-1 text-xs leading-relaxed text-amber-50">{selectedVisit.operational_note?.trim() || 'Aucun motif renseigné.'}</p></div>{!campaignPaused && <button type="button" disabled={reactivating} onClick={markSelectedVisitActive} className="w-full rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2.5 text-[10px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-45">{reactivating ? 'Réactivation…' : 'Marquer le POS actif'}</button>}{inactiveError && <p className="text-[10px] font-bold text-rose-200">{inactiveError}</p>}</div> : <div className="mt-3 space-y-2">{transactionSlots(selectedVisit).map((transaction, index) => <div key={`${selectedVisit.id}-detail-${index}`} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-xs"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] font-black text-gray-300">{index + 1}</span>{transaction ? <span className="font-bold text-gray-200">Client {transaction.client_number || 'non renseigné'}</span> : <span className="text-gray-500">Transaction à enregistrer</span>}</div>{transaction ? <span className="font-black text-emerald-300">{Number(transaction.amount).toLocaleString('fr-FR')}</span> : <span className="text-gray-600">—</span>}</div>)}</div>}</section>
        <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs font-black uppercase tracking-wide text-cyan-100"><MapPin size={15}/> Localisation d’arrivée</div>{mapsUrl ? <iframe title={`Carte ${selectedVisit.point_of_sale?.denomination || 'POS'}`} src={mapsUrl} className="h-64 w-full border-0" loading="lazy" allowFullScreen /> : <div className="p-6 text-center text-sm text-gray-500">Coordonnées GPS indisponibles pour ce POS.</div>}</section>
      </section></div>; })()}
      {photoPreview && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={photoPreview.label} onClick={() => setPhotoPreview(null)}><button type="button" onClick={() => setPhotoPreview(null)} className="absolute right-5 top-5 rounded-full border border-white/15 bg-black/50 p-3 text-white transition hover:bg-white/15" aria-label="Fermer la photo"><X size={20}/></button><img src={photoPreview.url} alt={photoPreview.label} className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-2xl" onClick={(event) => event.stopPropagation()}/><p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wide text-white/85">{photoPreview.label}</p></div>}
      <MerchantPosValidationModal isOpen={isValidationOpen && !campaignPaused && isTodayView} currentUser={currentUser} run={run} positions={positions} visits={visits} activityDate={today} mfsName={mfsName} onClose={() => setIsValidationOpen(false)} onValidated={() => { setIsValidationOpen(false); void refresh(); }} />
    </div>
  );
};
