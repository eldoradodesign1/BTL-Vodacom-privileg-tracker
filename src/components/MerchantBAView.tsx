import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, FileCheck2, MapPin, Medal, PlusCircle, Trophy } from 'lucide-react';
import type { BADailyAttendance, BAPosVisit, BATransaction, CampaignRun, PointOfSale, User } from '../types';
import {
  getActiveCampaignRuns,
  getCampaignPos,
  getDailyAttendance,
  getMerchantCampaign,
  getMerchantEvidencePublicUrl,
  getMerchantStandings,
  getPosVisitsForDay,
  getTransactionsForDay,
  MERCHANT_CAMPAIGN_CODE,
  recordCheckin,
  closeDailyAttendance,
  uploadMerchantEvidence,
  type MerchantPodiumEntry,
} from '../utils/merchantCampaign';
import { toISO } from '../utils/storage';
import { MerchantPosCommandPalette } from './Modals/MerchantPosCommandPalette';
import { MerchantClosingReportModal } from './Modals/MerchantClosingReportModal';
import { MerchantTransactionModal } from './Modals/MerchantTransactionModal';

interface MerchantBAViewProps {
  currentUser: User;
  onPointagePhotoRecorded?: (storagePath: string) => void;
  openTransactionRequested?: boolean;
  onTransactionRequestHandled?: () => void;
}

type Geo = { latitude: number; longitude: number; accuracy: number };

function locate(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La géolocalisation est indisponible.'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy || 0) }),
      () => reject(new Error('La localisation est nécessaire pour continuer.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export const MerchantBAView: React.FC<MerchantBAViewProps> = ({ currentUser, onPointagePhotoRecorded, openTransactionRequested = false, onTransactionRequestHandled }) => {
  const today = toISO(new Date());
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [positions, setPositions] = useState<PointOfSale[]>([]);
  const [attendance, setAttendance] = useState<BADailyAttendance | null>(null);
  const [checkinDoneLocal, setCheckinDoneLocal] = useState(false);
  const [transactions, setTransactions] = useState<BATransaction[]>([]);
  const [posVisits, setPosVisits] = useState<BAPosVisit[]>([]);
  const [standings, setStandings] = useState<MerchantPodiumEntry[]>([]);
  const [podiumPhotoUrls, setPodiumPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isClosingReportOpen, setIsClosingReportOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  const refresh = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const active = runs.find((item) => item.status === 'active') || runs[0] || null;
      setRun(active);
      if (!active) {
        setPositions([]);
        setAttendance(null);
        setTransactions([]);
        setPosVisits([]);
        setStandings([]);
        setPodiumPhotoUrls({});
        return;
      }
      const [nextPositions, nextAttendance, nextTransactions, nextVisits, nextStandings] = await Promise.all([
        getCampaignPos(campaign.id),
        getDailyAttendance(currentUser.id, active.id, today),
        getTransactionsForDay(currentUser.id, active.id, today),
        getPosVisitsForDay(currentUser.id, active.id, today),
        getMerchantStandings(active.id, today),
      ]);
      setPositions(nextPositions);
      setAttendance(nextAttendance);
      setTransactions(nextTransactions);
      setPosVisits(nextVisits);
      setStandings(nextStandings);
      const topPhotoEntries = await Promise.all(nextStandings.slice(0, 3).map(async (entry) => {
        const storagePath = entry.activity.attendance?.checkin_photo_path;
        if (!storagePath) return [entry.activity.ba.id, ''] as const;
        try {
          return [entry.activity.ba.id, await getMerchantEvidencePublicUrl(storagePath)] as const;
        } catch {
          return [entry.activity.ba.id, ''] as const;
        }
      }));
      setPodiumPhotoUrls(Object.fromEntries(topPhotoEntries));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement de la journée impossible.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    setCheckinDoneLocal(false);
    void refresh();
  }, [currentUser.id]);

  const visitedCount = useMemo(() => posVisits.length, [posVisits]);
  const posTarget = run?.daily_pos_target || 15;
  const transactionsPerPosTarget = run?.transactions_per_pos_target || 3;
  const inactivePosCount = useMemo(() => posVisits.filter((visit) => visit.operational_status === 'inactive').length, [posVisits]);
  const transactionTarget = Math.max(0, (posTarget - inactivePosCount) * transactionsPerPosTarget);
  const isCheckedIn = Boolean(attendance?.checkin_at) || checkinDoneLocal;
  const isClosed = Boolean(attendance?.checkout_at);
  const leaders = standings.slice(0, 3);
  const personalStanding = standings.find((entry) => entry.activity.ba.id === currentUser.id) || null;

  const withAction = async (action: () => Promise<void>) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckin = async (photo: File) => {
    if (!run) {
      setError('Aucune vague active.');
      return;
    }

    // Same immediate feedback as the hostess flow: once the camera confirms the picture,
    // the pointage block disappears while the GPS proof is being persisted.
    setSaving(true);
    setError('');
    setSuccess('Photo confirmée. Enregistrement du pointage GPS…');
    setCheckinDoneLocal(true);
    try {
      const geo = await locate();
      const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${today}/checkin-${Date.now()}.jpg`, photo);
      await recordCheckin({ campaign_run_id: run.id, ba_id: currentUser.id, activity_date: today, status: 'open', checkin_at: new Date().toISOString(), checkin_latitude: geo.latitude, checkin_longitude: geo.longitude, checkin_accuracy_m: geo.accuracy, checkin_photo_path: path });
      onPointagePhotoRecorded?.(path);
      setSuccess('Pointage du matin enregistré avec photo et position GPS.');
      await refresh();
    } catch (caught) {
      setCheckinDoneLocal(false);
      setSuccess('');
      setError(caught instanceof Error ? caught.message : 'Pointage impossible.');
    } finally {
      setSaving(false);
    }
  };

  const openTransactionFlow = () => {
    setError('');
    if (!isCheckedIn) {
      setError('Validez d’abord votre pointage du matin pour enregistrer une transaction.');
      return;
    }
    if (isClosed) {
      setError('Cette journée est déjà clôturée. Consultez les archives pour revoir son rapport.');
      return;
    }
    setIsTransactionModalOpen(true);
  };

  useEffect(() => {
    if (!openTransactionRequested || loading) return;
    onTransactionRequestHandled?.();
    setError('');
    if (!isCheckedIn) {
      setError('Validez d’abord votre pointage du matin pour enregistrer une transaction.');
      return;
    }
    if (isClosed) {
      setError('Cette journée est déjà clôturée. Consultez les archives pour revoir son rapport.');
      return;
    }
    setIsTransactionModalOpen(true);
  }, [openTransactionRequested, loading, isCheckedIn, isClosed, onTransactionRequestHandled]);

  const openReportFlow = () => {
    setError('');
    if (!attendance?.checkin_at) {
      setError('Validez d’abord votre pointage du matin avant d’ouvrir le rapport de clôture.');
      return;
    }
    if (isClosed) {
      setError('Cette journée est déjà clôturée. Consultez les archives pour revoir son rapport.');
      return;
    }
    setIsClosingReportOpen(true);
  };

  const closeDay = (closingComment: string) => void withAction(async () => {
    if (!attendance) throw new Error('Le pointage du matin est requis avant la clôture.');
    const geo = await locate();
    await closeDailyAttendance(attendance.id, { checkout_at: new Date().toISOString(), checkout_latitude: geo.latitude, checkout_longitude: geo.longitude, checkout_accuracy_m: geo.accuracy, closing_comment: closingComment.trim() || null, status: 'closed' });
    setIsClosingReportOpen(false);
    setSuccess('Journée clôturée avec succès.');
  });

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de votre journée…</div>;

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card relative overflow-hidden border border-cyan-300/15 p-4">
        <div className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-36 w-36 rounded-full bg-red-500/[0.08] blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Merchant Educational Campaign</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Bonjour, {currentUser.name.split(' ')[0]}</h1>
          <p className="mt-1 text-xs font-semibold text-gray-300">{new Date(`${today}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · Objectif : {posTarget} POS / {transactionTarget} transactions</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"><b className="block text-lg font-black text-white">{posTarget}</b><span className="text-[9px] font-black uppercase text-gray-400">Objectif POS</span></div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"><b className="block text-lg font-black text-emerald-300">{visitedCount}</b><span className="text-[9px] font-black uppercase text-gray-400">POS visités</span></div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"><b className="block text-lg font-black text-amber-200">{transactions.length}/{transactionTarget}</b><span className="text-[9px] font-black uppercase text-gray-400">Transactions</span></div>
          </div>
        </div>
      </section>

      <section className="glass-card relative overflow-hidden border border-amber-300/20 p-3">
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-amber-400/[0.10] blur-2xl"/>
        <div className="relative flex items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-500/[0.10] text-amber-200"><Trophy size={15}/></div><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">Podium du jour</p><p className="text-[10px] text-gray-400">Classement par volume Merchant</p></div></div>
        <div className="relative mt-3 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((index) => { const entry = leaders[index]; const isCurrent = entry?.activity.ba.id === currentUser.id; const photoUrl = entry ? podiumPhotoUrls[entry.activity.ba.id] : ''; const color = index === 0 ? 'border-amber-300/35 bg-amber-500/[0.11] text-amber-100' : index === 1 ? 'border-slate-200/25 bg-slate-200/[0.08] text-slate-100' : 'border-orange-300/25 bg-orange-500/[0.08] text-orange-100'; return <div key={entry?.activity.ba.id || `empty-${index}`} className={`relative min-w-0 overflow-hidden rounded-lg border p-2 ${color} ${isCurrent ? 'ring-1 ring-cyan-200/70' : ''}`}>{photoUrl && <img src={photoUrl} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-10"/>}<div className="relative">{entry ? <><div className="flex items-center justify-between gap-1"><span className="flex h-5 w-5 items-center justify-center rounded-lg bg-black/15 text-[9px] font-black">{index + 1}</span>{isCurrent && <Medal size={13} className="text-cyan-100"/>}</div><b className="mt-1 block truncate text-[10px]">{entry.activity.ba.name.split(' ')[0]}</b><span className="mt-0.5 block text-[9px] font-bold opacity-75">{entry.activity.transactionCount} Tx · {entry.activity.visitedPosCount} POS</span></> : <><span className="flex h-5 w-5 items-center justify-center rounded-lg bg-black/10 text-[9px] font-black">{index + 1}</span><span className="mt-2 block text-[9px] font-bold opacity-50">À saisir</span></>}</div></div>; })}</div>
        <div className="relative mt-2 rounded-xl border border-white/[0.08] bg-black/10 px-2.5 py-2 text-[10px] font-semibold text-gray-300">{personalStanding ? <><b className="text-white">Vous #{personalStanding.rank}</b> avec <b className="text-amber-100">{personalStanding.activity.transactionCount} transactions</b> et <b className="text-cyan-100">{personalStanding.activity.visitedPosCount} POS</b>{personalStanding.isLocked ? <span className="ml-1 text-amber-200">· place verrouillée</span> : ''}.</> : standings.length ? <>Vous n’êtes pas encore classé. Enregistrez votre premier POS pour entrer dans le classement.</> : <>Le podium attend le premier POS visité aujourd’hui.</>}</div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-200">{success}</div>}

      <section className="grid grid-cols-2 gap-4">
        <button type="button" onClick={openTransactionFlow} disabled={isClosed} className={`glass-card group flex min-h-36 flex-col items-center justify-center space-y-2 p-6 text-center transition-all ${isClosed ? 'cursor-not-allowed opacity-60' : 'hover:border-cyan-300/45 active:scale-[0.98]'}`}><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200 transition-transform group-hover:scale-110"><PlusCircle size={24}/></div><span className="text-xs font-black uppercase text-white">{isClosed ? 'Journée clôturée' : 'Nouvelle transaction'}</span><span className="text-[9px] font-semibold text-gray-400">POS, montant, client & capture</span></button>
        <button type="button" onClick={openReportFlow} disabled={isClosed} className={`glass-card group flex min-h-36 flex-col items-center justify-center space-y-2 p-6 text-center transition-all ${isClosed ? 'cursor-not-allowed opacity-60' : 'hover:border-amber-300/45 active:scale-[0.98]'}`}><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200 transition-transform group-hover:scale-110"><FileCheck2 size={24}/></div><span className="text-xs font-black uppercase text-white">{isClosed ? 'Journée clôturée' : 'Mon rapport'}</span><span className="text-[9px] font-semibold text-gray-400">Clôture, GPS & synthèse</span></button>
      </section>

      {!isCheckedIn && <section className="glass-card p-6 text-center"><h2 className="mb-4 text-xs font-black uppercase tracking-widest text-red-400">Pointage d’arrivée GPS</h2><div className="space-y-3"><label className="btn-neon btn-red flex cursor-pointer items-center justify-center gap-2"><Camera size={16}/><span>Déverrouiller la journée (prendre photo)</span><input type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { const photo = event.target.files?.[0]; if (photo) void handleCheckin(photo); event.currentTarget.value = ''; }} /></label></div></section>}

      {isClosed && <section className="glass-card border border-emerald-500/25 p-4 text-center"><CheckCircle2 className="mx-auto text-emerald-400"/><b className="mt-2 block">Journée clôturée</b><p className="mt-1 text-xs text-gray-400">{transactions.length} transactions enregistrées pour {visitedCount} POS visités. Retrouvez le rapport dans vos archives.</p></section>}
      <MerchantClosingReportModal isOpen={isClosingReportOpen} isSaving={saving} posCount={visitedCount} transactionCount={transactions.length} posTarget={posTarget} transactionsPerPosTarget={transactionsPerPosTarget} inactivePosCount={inactivePosCount} onClose={() => setIsClosingReportOpen(false)} onSubmit={closeDay} />
      <MerchantTransactionModal isOpen={isTransactionModalOpen} currentUser={currentUser} run={run} positions={positions} visits={posVisits} activityDate={today} onClose={() => setIsTransactionModalOpen(false)} onRecorded={() => { setSuccess('Transaction enregistrée avec le POS, le client et la position GPS.'); void refresh(false); }} onPosArrivalRecorded={(visit) => { setPosVisits((current) => current.some((item) => item.id === visit.id) ? current : [visit, ...current]); setSuccess('Arrivée au POS enregistrée avec photo, heure et position GPS.'); void refresh(false); }} />
    </div>
  );
};
