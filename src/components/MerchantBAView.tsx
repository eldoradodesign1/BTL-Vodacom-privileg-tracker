import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Camera, CheckCircle2, FileCheck2, MapPin, Medal, PlusCircle, Trophy, UsersRound } from 'lucide-react';
import type { BADailyAttendance, BAPosVisit, BATransaction, CampaignRun, PointOfSale, User } from '../types';
import {
  getActiveCampaignRuns,
  getCampaignPos,
  getDailyAttendance,
  getMerchantCampaign,
  getMerchantEvidencePublicUrl,
  getMerchantStandings,
  canUseMerchantGpsFallback,
  getLastKnownMerchantLocation,
  finalizePriorMerchantDays,
  getPosVisitsForDay,
  getTransactionsForDay,
  MERCHANT_CAMPAIGN_CODE,
  recordCheckin,
  closeDailyAttendance,
  uploadMerchantEvidence,
  updateMerchantAttendanceMfs,
  type MerchantPodiumEntry,
} from '../utils/merchantCampaign';
import { toISO } from '../utils/storage';
import { MerchantPosCommandPalette } from './Modals/MerchantPosCommandPalette';
import { MerchantClosingReportModal } from './Modals/MerchantClosingReportModal';
import { MerchantTransactionModal } from './Modals/MerchantTransactionModal';
import { MerchantMfsPicker } from './Modals/MerchantMfsPicker';
import { MerchantFundRequestModal } from './Modals/MerchantFundRequestModal';
import { OTHER_MFS_VALUE } from '../data/merchantMfs';
import { runInBackground } from '../utils/backgroundOperations';
import { warmMerchantAgentWorkspace } from '../utils/merchantWarmup';

interface MerchantBAViewProps {
  currentUser: User;
  onPointagePhotoRecorded?: (storagePath: string) => void;
  openTransactionRequested?: boolean;
  onTransactionRequestHandled?: () => void;
  campaignPaused?: boolean;
  pauseReason?: string;
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

export const MerchantBAView: React.FC<MerchantBAViewProps> = ({ currentUser, onPointagePhotoRecorded, openTransactionRequested = false, onTransactionRequestHandled, campaignPaused = false, pauseReason = '' }) => {
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
  const [isFundRequestOpen, setIsFundRequestOpen] = useState(false);
  const [mfsChoice, setMfsChoice] = useState('');
  const [otherMfsName, setOtherMfsName] = useState('');

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
      setMfsChoice(nextAttendance?.mfs_name || '');
      if (nextAttendance?.mfs_name && nextAttendance.mfs_name !== OTHER_MFS_VALUE) setOtherMfsName('');
      setTransactions(nextTransactions);
      setPosVisits(nextVisits);
      setStandings(nextStandings);
      // La mise à jour des journées précédentes ne doit jamais retarder
      // l’ouverture de l’espace agent sur un réseau lent.
      void finalizePriorMerchantDays(active.id, currentUser.id, today, Number(active.transactions_per_pos_target || 3)).catch(() => undefined);
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
  const mfsName = attendance?.mfs_name?.trim() || '';
  const hasMfs = Boolean(mfsName);
  const leaders = standings.slice(0, 3);
  const personalStanding = standings.find((entry) => entry.activity.ba.id === currentUser.id) || null;

  const resolveGeoForPatience = async (): Promise<{ geo: Geo; fallback: boolean }> => {
    try {
      return { geo: await locate(), fallback: false };
    } catch (gpsError) {
      if (!run || !canUseMerchantGpsFallback(currentUser.id)) throw gpsError;
      const lastKnown = await getLastKnownMerchantLocation(currentUser.id, run.id);
      if (!lastKnown) throw new Error('Aucune dernière localisation connue n’est encore disponible pour valider ce pointage.');
      return { geo: lastKnown, fallback: true };
    }
  };

  const handleCheckin = (photo: File) => {
    if (campaignPaused) return;
    if (!run) {
      setError('Aucune vague active.');
      return;
    }
    const activeRun = run;
    setError('');
    setSuccess('Pointage enregistré sur cet appareil. Vous pouvez poursuivre pendant la synchronisation.');
    setCheckinDoneLocal(true);
    runInBackground('Pointage du matin', async () => {
      const { geo, fallback } = await resolveGeoForPatience();
      const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${today}/checkin-${Date.now()}.jpg`, photo);
      const nextAttendance = await recordCheckin({ campaign_run_id: activeRun.id, ba_id: currentUser.id, activity_date: today, status: 'open', checkin_at: new Date().toISOString(), checkin_latitude: geo.latitude, checkin_longitude: geo.longitude, checkin_accuracy_m: geo.accuracy, checkin_photo_path: path });
      return { attendance: nextAttendance, path, fallback };
    }, {
      queued: 'Pointage lancé en arrière-plan.',
      success: 'Pointage synchronisé.',
      onSuccess: ({ attendance: nextAttendance, path, fallback }) => {
        setAttendance(nextAttendance);
        onPointagePhotoRecorded?.(path);
        setSuccess(fallback ? 'Pointage synchronisé avec la dernière position GPS connue.' : 'Pointage synchronisé avec photo et position GPS.');
        warmMerchantAgentWorkspace({ campaignId: MERCHANT_CAMPAIGN_CODE, runId: activeRun.id, baId: currentUser.id, activityDate: today });
      },
      onError: (error) => {
        setCheckinDoneLocal(false);
        setSuccess('');
        setError(error.message);
      },
    });
  };

  const saveMfs = () => {
    if (campaignPaused) { setError('La campagne est actuellement en pause.'); return; }
    if (!attendance) { setError('Le pointage est encore en cours de synchronisation.'); return; }
    const selectedMfs = (mfsChoice === OTHER_MFS_VALUE ? otherMfsName : mfsChoice).trim();
    if (!selectedMfs) { setError('Sélectionnez ou renseignez le MFS qui vous accompagne.'); return; }
    const previousAttendance = attendance;
    setError('');
    setAttendance({ ...attendance, mfs_name: selectedMfs });
    setSuccess(`MFS confirmé localement : ${selectedMfs}.`);
    runInBackground('MFS du jour', () => updateMerchantAttendanceMfs(attendance.id, selectedMfs), {
      queued: 'MFS en cours de synchronisation.',
      success: 'MFS synchronisé.',
      onSuccess: (nextAttendance) => setAttendance(nextAttendance),
      onError: (error) => { setAttendance(previousAttendance); setError(error.message); },
    });
  };

  const openTransactionFlow = () => {
    if (campaignPaused) return;
    setError('');
    if (!isCheckedIn) {
      setError('Validez d’abord votre pointage du matin pour enregistrer une transaction.');
      return;
    }
    if (isClosed) {
      setError('Cette journée est déjà clôturée. Consultez les archives pour revoir son rapport.');
      return;
    }
    if (!hasMfs) {
      setError('Renseignez d’abord le MFS qui vous accompagne pour déverrouiller les transactions.');
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
    if (!hasMfs) {
      setError('Renseignez d’abord le MFS qui vous accompagne pour déverrouiller les transactions.');
      return;
    }
    setIsTransactionModalOpen(true);
  }, [openTransactionRequested, loading, isCheckedIn, isClosed, hasMfs, onTransactionRequestHandled]);

  const openReportFlow = () => {
    if (campaignPaused) return;
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

  const closeDay = (closingComment: string) => {
    if (campaignPaused) { setError('La campagne est actuellement en pause.'); return; }
    if (!attendance) { setError('Le pointage du matin est requis avant la clôture.'); return; }
    const previousAttendance = attendance;
    const checkoutAt = new Date().toISOString();
    setIsClosingReportOpen(false);
    setAttendance({ ...attendance, checkout_at: checkoutAt, closing_comment: closingComment.trim(), status: 'closed' });
    setSuccess('Clôture enregistrée sur cet appareil. Vous pouvez poursuivre pendant la synchronisation.');
    runInBackground('Clôture de journée', async () => {
      const { geo, fallback } = await resolveGeoForPatience();
      const nextAttendance = await closeDailyAttendance(attendance.id, { checkout_at: checkoutAt, checkout_latitude: geo.latitude, checkout_longitude: geo.longitude, checkout_accuracy_m: geo.accuracy, closing_comment: closingComment.trim(), status: 'closed' });
      return { attendance: nextAttendance, fallback };
    }, {
      queued: 'Clôture lancée en arrière-plan.',
      success: 'Journée clôturée et synchronisée.',
      onSuccess: ({ attendance: nextAttendance, fallback }) => {
        setAttendance(nextAttendance);
        setSuccess(fallback ? 'Journée clôturée avec la dernière position GPS connue.' : 'Journée clôturée avec succès.');
      },
      onError: (error) => { setAttendance(previousAttendance); setError(error.message); },
    });
  };

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de votre journée…</div>;

  if (!isCheckedIn) return (
    <section className="agent-before-checkin agent-home-surface space-y-4 pb-6">
      <h1 className="pt-5 text-center text-lg font-black uppercase tracking-[0.06em] text-white">Merchant Educational Campaign</h1>
      <div className="px-5 pt-2"><div className="agent-podium-grid mt-4 grid grid-cols-3 items-end gap-2">{([2,0,1] as const).map(rankIndex => { const entry=leaders[rankIndex]; const name=entry?.activity.ba.name||''; const photo=entry?podiumPhotoUrls[entry.activity.ba.id]:''; return <div key={rankIndex} className="min-w-0 text-center"><div className="agent-podium-avatar mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xs font-black text-white">{photo?<img src={photo} alt="" className="h-full w-full object-cover"/>:name?name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase():<UsersRound size={18}/>}</div><p className="mt-2 truncate text-[10px] font-black text-white" title={name||'Place libre'}>{name||'Place libre'}</p><p className="mt-0.5 text-[9px] text-gray-400">{entry?entry.activity.transactionCount+' Tx · '+entry.activity.visitedPosCount+' POS':'0 Tx'}</p><div className={rankIndex===0?'mt-2 flex h-20 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/20 text-xl font-black text-amber-200':rankIndex===1?'mt-2 flex h-14 items-center justify-center rounded-2xl border border-slate-300/20 bg-slate-300/15 text-lg font-black text-slate-200':'mt-2 flex h-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-400/15 text-lg font-black text-orange-200'}>{rankIndex+1}</div></div>;})}</div></div>
      <div className="flex justify-center py-6" style={{minHeight:'min(43vh,380px)'}}>
        <label aria-label="Démarrer la journée" title="Démarrer la journée" className={`agent-start-power flex flex-col items-center justify-center gap-3 text-center text-white ${run&&!campaignPaused?'cursor-pointer':'cursor-not-allowed opacity-45'}`} style={{width:'min(65vw,250px)',aspectRatio:'1',borderRadius:'50%',background:'radial-gradient(circle at 35% 25%,rgba(105,28,51,.95),rgba(35,10,27,.98) 55%,#0e101b 100%)',border:'3px solid var(--theme-accent)',boxShadow:'0 0 0 9px rgba(251,113,133,.09),0 20px 55px rgba(0,0,0,.65),inset 0 2px 18px rgba(255,255,255,.12)'}}>
          <svg viewBox="0 0 24 24" width="100" height="100" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/><path d="M12 2v10"/></svg><span className="text-xs font-black uppercase tracking-widest">Démarrer la journée</span>
          <input type="file" accept="image/*" capture="user" className="hidden" disabled={!run||campaignPaused} onChange={event=>{const file=event.target.files?.[0];if(file)handleCheckin(file);event.currentTarget.value='';}}/>
        </label>
      </div>
      {campaignPaused&&<p className="text-center text-xs font-bold text-amber-200">Campagne en pause. Pointage indisponible.</p>}
      {!run&&<p className="text-center text-xs font-bold text-amber-200">Aucune vague active pour le moment.</p>}
      {error&&<p className="text-center text-xs font-bold text-red-200">{error}</p>}
      {success&&<p className="text-center text-xs font-bold text-emerald-200">{success}</p>}
    </section>
  );

  return (
    <div className="agent-home-surface space-y-4 pb-4">
      {campaignPaused && <section className="glass-card border border-amber-300/35 bg-amber-500/[0.08] p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Campagne actuellement en pause</p><p className="mt-1 text-xs font-semibold text-amber-50">Les pointages, validations MFS, POS, transactions et clôtures sont suspendus. Vos données restent consultables.</p>{pauseReason && <p className="mt-2 rounded-xl border border-amber-200/15 bg-black/15 px-3 py-2 text-[10px] font-bold text-amber-100">{pauseReason}</p>}</section>}
      <section className="glass-card relative overflow-hidden border border-cyan-300/15 p-4">
        <div className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-36 w-36 rounded-full bg-red-500/[0.08] blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Merchant Educational Campaign</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Bonjour, {currentUser.name.split(' ')[0]}</h1>
          <p className="mt-1 text-xs font-semibold text-gray-300">{new Date(`${today}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · Objectif : {posTarget} POS / {transactionTarget} transactions</p>{hasMfs && <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/[0.08] px-2.5 py-1 text-[10px] font-black text-fuchsia-100"><UsersRound size={13}/>MFS · {mfsName}</p>}
        </div>
      </section>

      {!isCheckedIn && <section className="glass-card relative overflow-hidden border border-amber-300/20 p-3">
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-amber-400/[0.10] blur-2xl"/>
        <div className="relative flex items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-500/[0.10] text-amber-200"><Trophy size={15}/></div><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">Podium du jour</p><p className="text-[10px] text-gray-400">Classement par volume Merchant</p></div></div>
        <div className="relative mt-3 grid grid-cols-3 gap-1.5">{[0, 1, 2].map((index) => { const entry = leaders[index]; const isCurrent = entry?.activity.ba.id === currentUser.id; const photoUrl = entry ? podiumPhotoUrls[entry.activity.ba.id] : ''; const color = index === 0 ? 'border-amber-300/35 bg-amber-500/[0.11] text-amber-100' : index === 1 ? 'border-slate-200/25 bg-slate-200/[0.08] text-slate-100' : 'border-orange-300/25 bg-orange-500/[0.08] text-orange-100'; return <div key={entry?.activity.ba.id || `empty-${index}`} className={`relative min-w-0 overflow-hidden rounded-lg border p-2 ${color} ${isCurrent ? 'ring-1 ring-cyan-200/70' : ''}`}>{photoUrl && <img src={photoUrl} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-10"/>}<div className="relative">{entry ? <><div className="flex items-center justify-between gap-1"><span className="flex h-5 w-5 items-center justify-center rounded-lg bg-black/15 text-[9px] font-black">{index + 1}</span>{isCurrent && <Medal size={13} className="text-cyan-100"/>}</div><b className="mt-1 block truncate text-[10px]">{entry.activity.ba.name.split(' ')[0]}</b><span className="mt-0.5 block text-[9px] font-bold opacity-75">{entry.activity.transactionCount} Tx · {entry.activity.visitedPosCount} POS</span></> : <><span className="flex h-5 w-5 items-center justify-center rounded-lg bg-black/10 text-[9px] font-black">{index + 1}</span><span className="mt-2 block text-[9px] font-bold opacity-50">À saisir</span></>}</div></div>; })}</div>
        <div className="relative mt-2 rounded-xl border border-white/[0.08] bg-black/10 px-2.5 py-2 text-[10px] font-semibold text-gray-300">{personalStanding ? <><b className="text-white">Vous #{personalStanding.rank}</b> avec <b className="text-amber-100">{personalStanding.activity.transactionCount} transactions</b> et <b className="text-cyan-100">{personalStanding.activity.visitedPosCount} POS</b>{personalStanding.isLocked ? <span className="ml-1 text-amber-200">· place verrouillée</span> : ''}.</> : standings.length ? <>Vous n’êtes pas encore classé. Enregistrez votre premier POS pour entrer dans le classement.</> : <>Le podium attend le premier POS visité aujourd’hui.</>}</div>
      </section>}

      {isCheckedIn && <section className="glass-card overflow-hidden border border-amber-300/20 p-4" aria-label="Classement du jour">
        <div className="grid grid-cols-3 items-end gap-2">{([2,0,1] as const).map((rankIndex) => {
          const entry = leaders[rankIndex]; const photo = entry ? podiumPhotoUrls[entry.activity.ba.id] : '';
          const name = entry?.activity.ba.name || '';
          return <div key={rankIndex} className="min-w-0 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xs font-black text-white">{photo ? <img src={photo} alt="" className="h-full w-full object-cover"/> : name ? name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase() : <UsersRound size={18}/>}</div>
            <p className="mt-2 truncate text-[10px] font-black text-white" title={name || 'Place libre'}>{name || 'Place libre'}</p>
            <p className="mt-0.5 text-[9px] text-gray-400">{entry ? entry.activity.transactionCount+' Tx · '+entry.activity.visitedPosCount+' POS' : '0 Tx'}</p>
            <div className={rankIndex===0?'mt-2 flex h-20 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/20 text-xl font-black text-amber-200':rankIndex===1?'mt-2 flex h-14 items-center justify-center rounded-2xl border border-slate-300/20 bg-slate-300/15 text-lg font-black text-slate-200':'mt-2 flex h-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-400/15 text-lg font-black text-orange-200'}>{rankIndex+1}</div>
          </div>;
        })}</div>
        {personalStanding && !leaders.some(entry=>entry.activity.ba.id===currentUser.id) && <p className="mt-3 text-center text-[10px] text-gray-400">Votre rang : #{personalStanding.rank}</p>}
      </section>}

      {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-200">{success}</div>}

      {!isCheckedIn && !campaignPaused && <section className="glass-card p-6 text-center"><p className="mb-4 text-xs font-black uppercase tracking-widest text-red-400">Démarrer ma journée</p><div className="space-y-3"><label className="btn-neon btn-red flex cursor-pointer items-center justify-center gap-2"><Camera size={16}/><span>Prendre ma photo de pointage</span><input type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { const photo = event.target.files?.[0]; if (photo) void handleCheckin(photo); event.currentTarget.value = ''; }} /></label></div></section>}

      {isCheckedIn && !isClosed && !campaignPaused && <section className="glass-card relative overflow-hidden border border-fuchsia-300/20 p-4"><div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-fuchsia-400/[0.09] blur-3xl"/><div className="relative"><div className="mb-3 flex items-center gap-2"><UsersRound className="text-fuchsia-200" size={18}/><div><h2 className="text-sm font-black">MFS qui vous accompagne</h2><p className="text-[10px] text-gray-400">Validez le MFS avant d’enregistrer des transactions.</p></div></div><MerchantMfsPicker value={mfsChoice} onChange={(value) => { setMfsChoice(value); if (value !== OTHER_MFS_VALUE) setOtherMfsName(''); }} accent="emerald"/>{mfsChoice === OTHER_MFS_VALUE && <input value={otherMfsName} onChange={(event) => setOtherMfsName(event.target.value)} placeholder="Nom du MFS" className="app-input mt-2 w-full rounded-2xl px-3 py-3 text-sm"/>}<button type="button" onClick={saveMfs} disabled={!(mfsChoice === OTHER_MFS_VALUE ? otherMfsName.trim() : mfsChoice.trim())} className="mt-3 w-full rounded-2xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-3 text-[10px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-45">{hasMfs ? 'Mettre à jour le MFS' : 'Confirmer le MFS'}</button></div></section>}

      {isCheckedIn && !campaignPaused && <section className="space-y-3">
        <button type="button" onClick={openReportFlow} disabled={isClosed} className="agent-closure-action flex w-full items-center justify-center gap-3 rounded-3xl px-5 py-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"><FileCheck2 size={21}/>{isClosed ? 'Journée clôturée' : 'Clôturer'}</button>
        <button type="button" onClick={() => setIsFundRequestOpen(true)} disabled={!hasMfs || isClosed} className={`glass-card group flex min-h-24 items-center justify-center gap-3 p-4 text-left transition-all ${!hasMfs || isClosed ? 'cursor-not-allowed opacity-60' : 'hover:border-emerald-300/45 active:scale-[0.98]'}`}><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200 transition-transform group-hover:scale-110"><Banknote size={22}/></div><span><b className="block text-xs font-black uppercase text-white">Demande de fonds</b><span className="mt-1 block text-[9px] font-semibold text-gray-400">POS, MFS et BA préremplis</span></span></button>
      </section>}
      {isClosed && <section className="glass-card border border-emerald-500/25 p-4 text-center"><CheckCircle2 className="mx-auto text-emerald-400"/><b className="mt-2 block">Journée clôturée</b><p className="mt-1 text-xs text-gray-400">{transactions.length} transactions enregistrées pour {visitedCount} POS visités. Retrouvez le rapport dans vos archives.</p></section>}
      <MerchantFundRequestModal isOpen={isFundRequestOpen} currentUser={currentUser} run={run} positions={positions} visits={posVisits} mfsName={mfsName} onClose={() => setIsFundRequestOpen(false)} onSubmitted={() => setSuccess('Demande de fonds envoyée à votre superviseur.')} />
      <MerchantClosingReportModal isOpen={isClosingReportOpen} isSaving={saving} posCount={visitedCount} transactionCount={transactions.length} posTarget={posTarget} transactionsPerPosTarget={transactionsPerPosTarget} inactivePosCount={inactivePosCount} onClose={() => setIsClosingReportOpen(false)} onSubmit={closeDay} />
      <MerchantTransactionModal isOpen={isTransactionModalOpen} currentUser={currentUser} run={run} positions={positions} visits={posVisits} activityDate={today} mfsName={mfsName} onClose={() => setIsTransactionModalOpen(false)} onRecorded={(transaction) => { setTransactions((current) => current.some((item) => item.id === transaction.id) ? current : [transaction, ...current]); setSuccess('Transaction synchronisée avec le POS, le client et la position GPS.'); }} onPosArrivalRecorded={(visit) => { setPosVisits((current) => current.some((item) => item.id === visit.id) ? current : [visit, ...current]); setSuccess('Arrivée POS synchronisée avec photo, heure et position GPS.'); }} />
    </div>
  );
};
