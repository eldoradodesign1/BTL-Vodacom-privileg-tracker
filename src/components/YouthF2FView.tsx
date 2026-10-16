import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Camera, CheckCircle2, CircleAlert, FileCheck2, GraduationCap, MapPin, Medal, PauseCircle, PlusCircle, RefreshCw, Search, Trophy, UsersRound, X } from 'lucide-react';
import type { Campaign, User, YouthContactReport, YouthDailyAttendance, YouthRegion, YouthSubscriberType } from '../types';
import type { TabType } from './BottomNav';
import { runInBackground } from '../utils/backgroundOperations';
import {
  closeYouthAttendance,
  addYouthContact,
  getYouthContacts,
  getYouthAgents,
  getYouthAttendance,
  getYouthAttendanceHistory,
  getYouthCampaign,
  getYouthEvidenceUrl,
  recordYouthCheckin,
  uploadYouthEvidence,
  youthTodayIso,
  getYouthPodium,
  type YouthPodiumEntry,
} from '../utils/youthCampaign';

interface YouthF2FViewProps {
  currentUser: User;
  activeTab: TabType;
  campaignPaused?: boolean;
  pauseReason?: string;
  onCheckinPhotoChange?: (photoUrl: string) => void;
}

type Geo = { latitude: number; longitude: number; accuracy: number };

const YOUTH_ACTIONS = [['activation_bundle', 'Activation Bundles (50U)'], ['mpesa_account', 'Ouverture compte M-Pesa'], ['mpesa_app', 'Téléchargement application M-Pesa'], ['f2f_optin', 'Optin F2F'], ['other', 'Autre']] as const;
const YOUTH_ACTION_LABELS = { ...Object.fromEntries(YOUTH_ACTIONS), none: 'Aucun' } as Record<string, string>;
const YOUTH_SUBSCRIBER_TYPE_LABELS: Record<YouthSubscriberType, string> = {
  new_connection: 'Nouvel abonné (connexion)',
  existing_mpesa_no_app: 'Abonné M-Pesa sans application',
  existing_no_mpesa_no_app: 'Abonné sans M-Pesa ni application',
};

function locate(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La géolocalisation est indisponible sur cet appareil.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy || 0),
      }),
      () => reject(new Error('La localisation est requise pour valider ce pointage.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function readableDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
    <div className="modal-sheet relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#10131d]/95 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#10131d]/92 px-5 py-4 backdrop-blur-xl">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-300 transition hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

export const YouthF2FView: React.FC<YouthF2FViewProps> = ({ currentUser, activeTab, campaignPaused = false, pauseReason = '', onCheckinPhotoChange }) => {
  const today = useMemo(() => youthTodayIso(), []);
  const isOperator = currentUser.role !== 'agent';
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [attendance, setAttendance] = useState<YouthDailyAttendance | null>(null);
  const [history, setHistory] = useState<YouthDailyAttendance[]>([]);
  const [contacts, setContacts] = useState<YouthContactReport[]>([]);
  const [clientHistory, setClientHistory] = useState<YouthContactReport[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [podium, setPodium] = useState<YouthPodiumEntry[]>([]);
  const [podiumLoading, setPodiumLoading] = useState(false);
  const [team, setTeam] = useState<User[]>([]);
  const [closingComment, setClosingComment] = useState('');
  const [checkinPending, setCheckinPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [localPhotoUrl, setLocalPhotoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRegion, setContactRegion] = useState<YouthRegion>('Kinshasa');
  const [subscriberType, setSubscriberType] = useState<YouthSubscriberType | ''>('');
  const [contactActions, setContactActions] = useState<string[]>([]);

  const refresh = useCallback(async (withLoader = true) => {
    if (withLoader) setLoading(true);
    setPodiumLoading(true);
    setError('');
    try {
      const currentCampaign = await getYouthCampaign();
      if (!currentCampaign) throw new Error('La campagne Youth F2F est introuvable.');
      const [nextAttendance, nextTeam, nextContacts, nextPodium] = await Promise.all([
        currentUser.role === 'agent' ? getYouthAttendance(currentUser.id, currentCampaign.id, today) : Promise.resolve(null),
        isOperator ? getYouthAgents(currentUser.role === 'supervisor' ? currentUser.id : undefined) : Promise.resolve([]),
        currentUser.role === 'agent' ? getYouthContacts(currentUser.id, currentCampaign.id, today) : Promise.resolve([]),
        currentUser.role === 'agent' ? getYouthPodium(currentCampaign.id, today, currentUser.id, currentUser.name).catch(() => []) : Promise.resolve([]),
      ]);
      setCampaign(currentCampaign);
      setAttendance(nextAttendance);
      setTeam(nextTeam);
      setContacts(nextContacts);
      setPodium(nextPodium);
      setClosingComment(nextAttendance?.closing_comment || '');
      if (nextAttendance?.checkin_photo_path) {
        void getYouthEvidenceUrl(nextAttendance.checkin_photo_path).then((url) => {
          setPhotoUrl(url);
          onCheckinPhotoChange?.(url);
        }).catch(() => {
          setPhotoUrl('');
          onCheckinPhotoChange?.('');
        });
      } else {
        setPhotoUrl('');
        onCheckinPhotoChange?.('');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement de Youth F2F impossible.');
    } finally {
      setPodiumLoading(false);
      if (withLoader) setLoading(false);
    }
  }, [currentUser.id, currentUser.name, currentUser.role, isOperator, onCheckinPhotoChange, today]);

  const loadHistory = useCallback(async () => {
    if (!campaign || currentUser.role !== 'agent') return;
    setLoadingHistory(true);
    try {
      setHistory(await getYouthAttendanceHistory(currentUser.id, campaign.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger les archives.');
    } finally {
      setLoadingHistory(false);
    }
  }, [campaign, currentUser.id, currentUser.role]);

  const loadClientHistory = useCallback(async () => {
    if (!campaign || currentUser.role !== 'agent') return;
    setLoadingClients(true);
    try {
      setClientHistory(await getYouthContacts(currentUser.id, campaign.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger les clients.');
    } finally {
      setLoadingClients(false);
    }
  }, [campaign, currentUser.id, currentUser.role]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (activeTab === 'tab3') void loadHistory(); }, [activeTab, loadHistory]);
  useEffect(() => { if (activeTab === 'tab2') void loadClientHistory(); }, [activeTab, loadClientHistory]);

  const isCheckedIn = Boolean(attendance?.checkin_at) || checkinPending;
  const isClosed = Boolean(attendance?.checkout_at);
  const youthActions = YOUTH_ACTIONS;
  const filteredClientHistory = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase('fr');
    if (!query) return clientHistory;
    return clientHistory.filter((item) => [item.subscriber_name, item.subscriber_phone, item.region, YOUTH_SUBSCRIBER_TYPE_LABELS[item.subscriber_type], ...item.actions.map((action) => YOUTH_ACTION_LABELS[action] || action)].join(' ').toLocaleLowerCase('fr').includes(query));
  }, [clientHistory, clientSearch]);
  const rankedPodium = podium.filter((entry) => entry.contacts > 0).slice(0, 3);
  const myPodiumEntry = podium.find((entry) => entry.baId === currentUser.id) || null;
  const resetContactForm = () => { setContactName(''); setContactPhone(''); setSubscriberType(''); setContactActions([]); };
  const saveContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaign || !attendance?.id || !isCheckedIn || isClosed) return setError('Effectuez le pointage avant d’enregistrer un contact.');
    if (!contactName.trim() || contactPhone.replace(/\D/g, '').length < 10 || !subscriberType || contactActions.length === 0) return setError('Complétez le nom, le téléphone, le type d’abonné et les actions.');
    setContactSaving(true); setError('');
    try {
      const next = await addYouthContact({ campaignId: campaign.id, attendanceId: attendance.id, baId: currentUser.id, activityDate: today, region: contactRegion, subscriberType, subscriberPhone: contactPhone.trim(), subscriberName: contactName, actions: contactActions });
      setContacts((current) => [next, ...current]); setClientHistory((current) => [next, ...current.filter((item) => item.id !== next.id)]); if (campaign) void getYouthPodium(campaign.id, today, currentUser.id, currentUser.name).then(setPodium).catch(() => undefined); setIsContactOpen(false); resetContactForm(); setNotice('Contact Youth F2F enregistré.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement du contact impossible.'); } finally { setContactSaving(false); }
  };

  const handleCheckin = (file: File) => {
    if (!campaign) return;
    if (isClosed) {
      setError('Cette journée est déjà clôturée. Consultez vos archives.');
      return;
    }
    const preview = URL.createObjectURL(file);
    setLocalPhotoUrl(preview);
    onCheckinPhotoChange?.(preview);
    setCheckinPending(true);
    setError('');
    setNotice('Pointage enregistré sur cet appareil. Vous pouvez poursuivre pendant la synchronisation.');
    runInBackground('Pointage Youth F2F', async () => {
      const geo = await locate();
      const path = await uploadYouthEvidence(`${currentUser.id}/${today}/checkin-${Date.now()}.jpg`, file);
      const nextAttendance = await recordYouthCheckin({
        campaignId: campaign.id,
        assignmentId: null,
        baId: currentUser.id,
        activityDate: today,
        checkinAt: new Date().toISOString(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
        photoPath: path,
      });
      return { attendance: nextAttendance, path };
    }, {
      queued: 'Pointage Youth F2F lancé en arrière-plan.',
      success: 'Pointage Youth F2F synchronisé.',
      onSuccess: ({ attendance: nextAttendance, path }) => {
        setAttendance(nextAttendance);
        setCheckinPending(false);
        void getYouthEvidenceUrl(path).then((url) => { setPhotoUrl(url); onCheckinPhotoChange?.(url); }).catch(() => { setPhotoUrl(preview); onCheckinPhotoChange?.(preview); });
        setNotice('Pointage synchronisé avec photo et position GPS.');
      },
      onError: (caught) => {
        setCheckinPending(false);
        setLocalPhotoUrl('');
        onCheckinPhotoChange?.('');
        setError(caught.message);
      },
    });
  };

  const handleClose = () => {
    if (!attendance || !campaign || isClosed) return;
    if (!closingComment.trim()) {
      setError('Le commentaire de clôture est obligatoire.');
      return;
    }
    const previous = attendance;
    const closedAt = new Date().toISOString();
    setAttendance({ ...attendance, status: 'closed', checkout_at: closedAt, closing_comment: closingComment.trim() });
    setError('');
    setNotice('Clôture enregistrée localement. Synchronisation en arrière-plan…');
    setIsClosingOpen(false);
    runInBackground('Clôture Youth F2F', async () => {
      const geo = await locate();
      return closeYouthAttendance({
        attendanceId: attendance.id,
        checkoutAt: closedAt,
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
        comment: closingComment,
      });
    }, {
      queued: 'Clôture en cours de synchronisation.',
      success: 'Journée Youth F2F clôturée.',
      onSuccess: (next) => { setAttendance(next); setNotice('Journée clôturée et synchronisée.'); },
      onError: (caught) => { setAttendance(previous); setError(caught.message); },
    });
  };

  if (loading) return <div className="glass-card p-6 text-center text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">Chargement de Youth F2F…</div>;

  return (
    <section className="animate-fade-in space-y-4 pb-4">
      <div className="glass-card relative overflow-hidden border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.66),rgba(18,24,39,0.74),rgba(30,41,59,0.62))] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100"><GraduationCap size={23} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Youth F2F · Force de frappe</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">{isOperator ? 'Espace opérationnel' : `Bonjour, ${currentUser.name.split(' ')[0]}`}</h1>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-300">{readableDate(today)} · Suivi de votre activité terrain.</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <button type="button" onClick={() => void refresh(false)} className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-cyan-100 transition hover:bg-white/10" title="Actualiser Youth F2F" aria-label="Actualiser Youth F2F"><RefreshCw size={16} /></button>
            {activeTab === 'home' && !isOperator && !campaignPaused && isCheckedIn && (
              <button type="button" onClick={() => (photoUrl || localPhotoUrl) && setPreviewUrl(photoUrl || localPhotoUrl)} disabled={!(photoUrl || localPhotoUrl)} style={{ transform: 'rotate(-3deg)' }} className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-cyan-200/25 bg-slate-950/70 text-cyan-100 shadow-xl disabled:cursor-default">
                {(photoUrl || localPhotoUrl) ? <img src={photoUrl || localPhotoUrl} alt="Pointage" className="h-full w-full object-cover" /> : <Camera size={24} />}
              </button>
            )}
          </div>
        </div>

        {activeTab === 'home' && !isOperator && !campaignPaused && (
          <div className="relative mt-5 border-t border-white/10 pt-4">
            {podiumLoading ? <p className="py-5 text-center text-xs text-gray-400">Mise à jour du podium…</p> : (
              <div className="mt-4 grid grid-cols-3 items-end gap-2">
                {([2, 0, 1] as const).map((rankIndex) => {
                  const entry = rankedPodium[rankIndex];
                  return <div key={rankIndex} className="min-w-0 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-black text-white">{entry ? entry.name.trim().split(/\s+/).slice(0, 2).map((name) => name[0] || '').join('').toUpperCase() : <UsersRound size={18} />}</div>
                    <p className="mt-2 truncate text-[10px] font-black text-white" title={entry?.name || 'Place libre'}>{entry?.name || 'Place libre'}</p>
                    <p className="mt-0.5 text-[9px] text-slate-300">{entry?.contacts || 0} contacts</p>
                    <div className={rankIndex === 0 ? 'mt-2 flex h-20 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/20 text-xl font-black text-amber-200' : rankIndex === 1 ? 'mt-2 flex h-14 items-center justify-center rounded-2xl border border-slate-300/20 bg-slate-300/15 text-lg font-black text-slate-200' : 'mt-2 flex h-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-400/15 text-lg font-black text-orange-200'}>{rankIndex + 1}</div>
                  </div>;
                })}
              </div>
            )}
            {myPodiumEntry && !rankedPodium.some((entry) => entry.baId === currentUser.id) && <p className="mt-3 text-center text-[10px] text-slate-400">{myPodiumEntry.rank ? 'Votre rang : #' + myPodiumEntry.rank + ' · ' + myPodiumEntry.contacts + ' contact(s)' : 'Vous : 0 contact enregistré aujourd’hui.'}</p>}
          </div>
        )}
      </div>

      {campaignPaused && activeTab === 'home' && !isOperator && <section className="glass-card border border-amber-300/30 bg-amber-400/[0.07] p-5 text-center"><PauseCircle className="mx-auto text-amber-200" size={25}/><h2 className="mt-2 text-sm font-black text-white">Campagne Youth F2F en pause</h2><p className="mt-2 text-[11px] leading-relaxed text-gray-300">Les nouvelles saisies terrain sont temporairement suspendues. Vos clients et archives restent consultables.</p>{pauseReason && <p className="mt-2 text-xs font-bold text-amber-100">{pauseReason}</p>}</section>}
      {error && <div className="flex gap-2 rounded-2xl border border-red-400/40 bg-red-950/35 p-3 text-xs font-semibold text-red-200"><CircleAlert className="mt-0.5 shrink-0" size={16}/><span>{error}</span></div>}
      {notice && <div className="flex gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-100"><CheckCircle2 className="mt-0.5 shrink-0" size={16}/><span>{notice}</span></div>}

      {activeTab === 'tab2' && !isOperator && <section className="glass-card space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">Youth F2F</p><h2 className="mt-1 text-sm font-black text-white">Mes Clients · {clientHistory.length}</h2></div><UsersRound size={20} className="text-cyan-200"/></div>
        <div className="relative"><Search size={15} className="absolute left-3 top-3 text-gray-500"/><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Rechercher un nom, un numéro ou une région…" className="app-input w-full rounded-xl py-2.5 pl-9 pr-3 text-xs"/></div>
        <button type="button" onClick={() => { setError(''); setIsContactOpen(true); }} disabled={!isCheckedIn || isClosed || campaignPaused} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"><PlusCircle size={16}/>{isClosed ? 'Journée clôturée' : campaignPaused ? 'Campagne en pause' : isCheckedIn ? 'Ajouter un contact' : 'Pointer avant d’ajouter un client'}</button>
        {loadingClients ? <p className="py-6 text-center text-xs font-bold text-gray-500">Chargement des clients…</p> : filteredClientHistory.length === 0 ? <div className="rounded-2xl border border-white/10 bg-black/10 p-5 text-center text-xs font-semibold text-gray-500">{clientHistory.length ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client enregistré pour le moment.'}</div> : <div className="space-y-2">{filteredClientHistory.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-xs text-white">{item.subscriber_name}</b><a href={`tel:${item.subscriber_phone}`} className="mt-0.5 block text-[10px] text-cyan-200">{item.subscriber_phone}</a></div><span className="shrink-0 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] px-2 py-1 text-[8px] font-black uppercase text-cyan-100">{item.region.replaceAll('_', ' ')}</span></div><p className="mt-2 text-[10px] font-semibold text-gray-300">{YOUTH_SUBSCRIBER_TYPE_LABELS[item.subscriber_type]}</p><p className="mt-1 text-[9px] leading-relaxed text-gray-500">{item.actions.map((action) => YOUTH_ACTION_LABELS[action] || action).join(' · ') || 'Aucune action renseignée'}{item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString('fr-FR')}` : ''}</p></article>)}</div>}
      </section>}

      {activeTab === 'tab3' && !isOperator && <section className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">Youth F2F</p><h2 className="mt-1 text-sm font-black text-white">Archives terrain</h2></div><CalendarDays size={19} className="text-cyan-200"/></div>
        {loadingHistory ? <p className="py-6 text-center text-xs font-bold text-gray-500">Chargement des archives…</p> : history.length === 0 ? <p className="rounded-2xl border border-white/10 bg-black/10 p-4 text-center text-xs font-semibold text-gray-500">Aucune journée Youth F2F enregistrée pour le moment.</p> : <div className="space-y-2">{history.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-white">{readableDate(item.activity_date)}</b><span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${item.checkout_at ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-100'}`}>{item.checkout_at ? 'Clôturée' : item.checkin_at ? 'Pointée' : 'Sans pointage'}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-gray-400"><span>Arrivée · {item.checkin_at ? new Date(item.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span><span>Départ · {item.checkout_at ? new Date(item.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>{item.closing_comment && <p className="mt-2 rounded-xl bg-black/15 p-2 text-[10px] leading-relaxed text-gray-300">{item.closing_comment}</p>}<div className="mt-2 flex flex-wrap gap-2">{item.checkin_photo_path && <button type="button" onClick={() => { void getYouthEvidenceUrl(item.checkin_photo_path).then(setPreviewUrl).catch((caught) => setError(caught instanceof Error ? caught.message : 'Photo indisponible.')); }} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] font-black uppercase text-cyan-200">Voir la photo</button>}{item.checkin_latitude != null && item.checkin_longitude != null && <a href={`https://www.google.com/maps?q=${item.checkin_latitude},${item.checkin_longitude}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] font-black uppercase text-cyan-200">Position GPS</a>}</div></article>)}</div>}
      </section>}


      {activeTab === 'home' && !isOperator && !campaignPaused && (
        !isCheckedIn ? (
          <label className="btn-neon flex w-full cursor-pointer items-center justify-center gap-3 rounded-3xl px-5 py-5 text-center text-base font-black shadow-xl">
            <Camera size={22} />
            <span>Démarrer la journée</span>
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleCheckin(file); event.currentTarget.value = ''; }} />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={isClosed} onClick={() => { setError(''); setIsContactOpen(true); }} className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-3xl border border-cyan-300/25 bg-cyan-400/10 p-3 text-center text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45">
                <PlusCircle size={38} strokeWidth={1.5} /><span className="text-xs font-black">Nouveau contact</span><span className="text-[9px] text-slate-400">{contacts.length} contact(s) aujourd’hui</span>
              </button>
              <button type="button" disabled={isClosed} onClick={() => setIsClosingOpen(true)} className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-3xl border border-amber-300/25 bg-amber-400/10 p-3 text-center text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-45">
                <FileCheck2 size={38} strokeWidth={1.5} /><span className="text-xs font-black">Rapport de clôture</span><span className="text-[9px] text-slate-400">{isClosed ? 'Journée clôturée' : 'Clôturer la journée'}</span>
              </button>
            </div>
            {isClosed && <p className="text-center text-[11px] font-bold text-emerald-200">Journée clôturée · Rapport et GPS archivés</p>}
          </div>
        )
      )}

      {isOperator && <section className="glass-card p-4 sm:p-5"><div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-200/15 bg-violet-300/10 text-violet-200"><UsersRound size={19}/></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-100">Suivi Youth F2F</p><h2 className="mt-1 text-sm font-black text-white">Agents affectés à la campagne</h2></div></div>{team.length === 0 ? <p className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-xs font-semibold text-amber-100">Aucun agent Youth F2F n’est encore rattaché à ce périmètre.</p> : <div className="space-y-2">{team.map((agent) => <div key={agent.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-3"><span><b className="block text-xs text-white">{agent.name}</b><span className="text-[10px] text-gray-500">{agent.phone}</span></span><span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-100">BA Youth</span></div>)}</div>}</section>}

      {previewUrl && <ModalShell title="Photo de pointage" onClose={() => setPreviewUrl('')}><img src={previewUrl} alt="Photo de pointage Youth F2F" className="w-full rounded-2xl border border-white/10 object-contain"/></ModalShell>}

      {isClosingOpen && !isClosed && <ModalShell title="Rapport de clôture Youth" onClose={() => setIsClosingOpen(false)}>
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-gray-300">Décris brièvement la sensibilisation réalisée. Le commentaire est obligatoire pour clôturer.</p>
          <textarea value={closingComment} onChange={(event) => setClosingComment(event.target.value)} rows={5} placeholder="Ex. Sensibilisation menée auprès du public ; retours et incidents éventuels…" className="app-input w-full resize-none rounded-2xl px-3 py-3 text-sm" />
          <button type="button" onClick={handleClose} className="w-full rounded-2xl border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 transition hover:bg-amber-400/20">Clôturer ma journée</button>
        </div>
      </ModalShell>
      {isContactOpen && <ModalShell title="Nouveau contact Youth" onClose={() => !contactSaving && setIsContactOpen(false)}>
        <form onSubmit={saveContact} className="space-y-5">
          <input aria-label="Nom de l’abonné" value={contactName} onChange={(event) => setContactName(event.target.value)} className="app-input w-full rounded-2xl px-4 py-3 text-sm" placeholder="Nom de l’abonné" />
          <div className="grid grid-cols-2 gap-3">
            <input aria-label="Numéro de téléphone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} inputMode="tel" maxLength={13} className="app-input min-w-0 w-full rounded-2xl px-3 py-3 text-sm" placeholder="Numéro de téléphone" />
            <select aria-label="Région" value={contactRegion} onChange={(event) => setContactRegion(event.target.value as YouthRegion)} className="app-input min-w-0 w-full rounded-2xl px-3 py-3 text-sm">{(['Bandundu','Equateur','Kongo_Central','Kinshasa','Province_Orientale','H_Lualaba','H_Katanga','Kasai_Occidental','Kasai_Oriental','Maniema','Nord_Kivu','Sud_Kivu'] as YouthRegion[]).map((region) => <option key={region} value={region}>{region.replaceAll('_', ' ')}</option>)}</select>
          </div>
          <div>
            <p className="mb-3 text-[11px] font-black text-white">Type d’abonné</p>
            <div className="grid grid-cols-3 gap-2">
              {([['existing_no_mpesa_no_app','Sans M-Pesa, sans appli'],['existing_mpesa_no_app','M-Pesa sans appli'],['new_connection','Nouvel abonné']] as const).map(([value,label]) => <button type="button" key={value} onClick={() => setSubscriberType(value)} aria-pressed={subscriberType === value} style={{ minHeight: 84 }} className={`flex min-w-0 items-center justify-center rounded-2xl border px-2 py-3 text-center text-[10px] font-bold leading-relaxed transition ${subscriberType === value ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-gray-300'}`}>{label}</button>)}
            </div>
          </div>
          <div>
            <p className="mb-3 text-[11px] font-black text-white">Actions prises</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
              {youthActions.map(([value,label]) => {
                const selected = contactActions.includes(value);
                const shortLabel = ({ activation_bundle: 'Activation bundle', mpesa_account: 'Ouverture compte M-Pesa', mpesa_app: 'Téléchargement appli M-Pesa', f2f_optin: 'Opt-in F2F', other: 'Autre' } as Record<string, string>)[value] || label;
                return <button type="button" key={value} aria-pressed={selected} onClick={() => setContactActions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current.filter((item) => item !== 'none'), value])} style={{ minHeight: 78, overflowWrap: 'anywhere' }} className={`flex min-w-0 items-center justify-center rounded-2xl border px-1 py-2 text-center text-[9px] font-bold leading-snug transition ${selected ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-gray-300'}`}>{shortLabel}</button>;
              })}
            </div>
          </div>
          <button type="submit" disabled={contactSaving} className="btn-neon w-full rounded-2xl px-4 py-4 text-sm font-black disabled:opacity-50">{contactSaving ? 'Enregistrement…' : 'Enregistrer le contact'}</button>
        </form>
      </ModalShell>
    </section>
  );
};
