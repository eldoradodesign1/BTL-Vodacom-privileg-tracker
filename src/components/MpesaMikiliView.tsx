import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, CircleAlert, ChevronDown, FileText, MapPin, PlusCircle, RefreshCw, UsersRound, X, Zap } from 'lucide-react';
import type { User } from '../types';
import { runInBackground } from '../utils/backgroundOperations';
import {
  addMikiliClient,
  closeMikiliAttendance,
  getMikiliAttendance,
  getMikiliCampaign,
  getMikiliClientHistory,
  getMikiliClientsForDay,
  getMikiliLocations,
  mikiliDisplayExisting,
  mikiliDisplayService,
  mikiliDisplayTransaction,
  getMikiliEvidenceUrl,
  mikiliTodayIso,
  normalizeMikiliPhone,
  recordMikiliCheckin,
  uploadMikiliEvidence,
  type MikiliAttendance,
  type MikiliClient,
  type MikiliExistingUser,
  type MikiliLocation,
  type MikiliPresentedService,
  type MikiliTransactionType,
} from '../utils/mpesaMikili';

type Geo = { latitude: number; longitude: number; accuracy: number };
type WorkspaceTab = 'today' | 'clients' | 'archives';

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
    <div className="modal-sheet relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#10131d]/95 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#10131d]/95 px-5 py-4 backdrop-blur-xl">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-300 hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

function locate(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La géolocalisation est indisponible sur cet appareil.'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy || 0) }),
      () => reject(new Error('La localisation est nécessaire pour continuer.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

const FIELD = 'mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm font-semibold text-white outline-none transition focus:border-red-400/50';

export interface MpesaMikiliViewProps {
  currentUser: User;
  activeTab: 'home' | 'tab2' | 'tab3' | 'chat' | 'pos' | 'admin';
}

export const MpesaMikiliView: React.FC<MpesaMikiliViewProps> = ({ currentUser, activeTab }) => {
  const today = useMemo(() => mikiliTodayIso(), []);
  const [campaignId, setCampaignId] = useState('');
  const [locations, setLocations] = useState<MikiliLocation[]>([]);
  const [attendance, setAttendance] = useState<MikiliAttendance | null>(null);
  const [todayClients, setTodayClients] = useState<MikiliClient[]>([]);
  const [history, setHistory] = useState<MikiliClient[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isClientOpen, setIsClientOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [closingComment, setClosingComment] = useState('');
  const [checkinPending, setCheckinPending] = useState(false);
  const [checkinPhotoUrl, setCheckinPhotoUrl] = useState('');
  const checkinInputRef = useRef<HTMLInputElement | null>(null);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [locationRegion, setLocationRegion] = useState<'Kinshasa' | 'Kongo-Central' | 'Haut-Katanga' | ''>('');
  const [existingUser, setExistingUser] = useState<MikiliExistingUser | ''>('');
  const [presentedService, setPresentedService] = useState<MikiliPresentedService | ''>('');
  const [transactionDone, setTransactionDone] = useState<boolean | null>(null);
  const [transactionType, setTransactionType] = useState<MikiliTransactionType>('na');
  const [transactionReference, setTransactionReference] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);

  const isCheckedIn = Boolean(attendance?.checkin_at) || checkinPending;
  const isClosed = Boolean(attendance?.checkout_at);
  const mikiliRegions = ['Kinshasa', 'Kongo-Central', 'Haut-Katanga'] as const;
  const refresh = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const campaign = await getMikiliCampaign();
      if (!campaign) throw new Error('La campagne M-Pesa Mikili est introuvable.');
      setCampaignId(campaign.id);
      const [nextLocations, nextAttendance, nextClients] = await Promise.all([
        getMikiliLocations(campaign.id),
        getMikiliAttendance(currentUser.id, campaign.id, today),
        getMikiliClientsForDay(currentUser.id, campaign.id, today),
      ]);
      setLocations(nextLocations);
      setAttendance(nextAttendance);
      setTodayClients(nextClients);
      setClosingComment(nextAttendance?.closing_comment || '');

    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement de M-Pesa Mikili impossible.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentUser.id, today]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const path = attendance?.checkin_photo_path;
    if (!path) { setCheckinPhotoUrl(''); return; }
    void getMikiliEvidenceUrl(path).then((url) => { if (!cancelled) setCheckinPhotoUrl(url); }).catch(() => { if (!cancelled) setCheckinPhotoUrl(''); });
    return () => { cancelled = true; };
  }, [attendance?.checkin_photo_path]);

  useEffect(() => {
    if (activeTab !== 'tab3' || !campaignId || historyLoaded) return;
    setHistoryLoaded(true);
    void getMikiliClientHistory(currentUser.id, campaignId).then(setHistory).catch((caught) => {
      setHistoryLoaded(false);
      setError(caught instanceof Error ? caught.message : 'Impossible de charger les archives.');
    });
  }, [activeTab, campaignId, currentUser.id, historyLoaded]);

  const handleCheckin = (file: File) => {
    if (!campaignId || isClosed) return;
    setCheckinPending(true);
    setError('');
    setNotice('Déverrouillage de la journée enregistré sur cet appareil. Synchronisation en arrière-plan…');
    runInBackground('Pointage M-Pesa Mikili', async () => {
      const geo = await locate();
      const path = await uploadMikiliEvidence(`${currentUser.id}/${today}/checkin-${Date.now()}.jpg`, file);
      const nextAttendance = await recordMikiliCheckin({ campaignId, baId: currentUser.id, activityDate: today, checkinAt: new Date().toISOString(), latitude: geo.latitude, longitude: geo.longitude, accuracy: geo.accuracy, photoPath: path });
      return nextAttendance;
    }, {
      queued: 'Déverrouillage M-Pesa Mikili lancé en arrière-plan.',
      success: 'Journée M-Pesa Mikili déverrouillée.',
      onSuccess: (next) => { setAttendance(next); setCheckinPending(false); setNotice('Journée déverrouillée avec photo et position GPS.'); },
      onError: (caught) => { setCheckinPending(false); setNotice(''); setError(caught.message); },
    });
  };

  const resetClientForm = () => {
    setClientName(''); setClientPhone(''); setLocationId(''); setLocationRegion(''); setExistingUser(''); setPresentedService(''); setTransactionDone(null); setTransactionType('na'); setTransactionReference('');
  };

  const visibleLocations = useMemo(() => locationRegion ? locations.filter((item) => item.region === locationRegion && item.name !== 'NA') : [], [locations, locationRegion]);

  const togglePresentedService = (service: 'send' | 'receive') => {
    setPresentedService((current) => {
      if (current === service) return '';
      if ((current === 'send' && service === 'receive') || (current === 'receive' && service === 'send')) return 'both';
      if (current === 'both') return service === 'send' ? 'receive' : 'send';
      return service;
    });
  };

  const toggleTransactionType = (type: 'send' | 'receive') => {
    setTransactionType((current) => {
      if (current === type) return 'na';
      if ((current === 'send' && type === 'receive') || (current === 'receive' && type === 'send')) return 'both';
      if (current === 'both') return type === 'send' ? 'receive' : 'send';
      return type;
    });
  };

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaignId || !attendance?.id || !isCheckedIn || isClosed) return setError('Effectuez le pointage de début de journée avant d’enregistrer un client.');
    if (!clientName.trim()) return setError('Le nom du client est obligatoire.');
    const normalizedPhone = normalizeMikiliPhone(clientPhone);
    if (!normalizedPhone || normalizedPhone.replace(/\D/g, '').length < 9) return setError('Saisissez un numéro de téléphone valide.');
    if (!locationId || !existingUser || !presentedService || transactionDone === null) return setError('Complétez tous les champs obligatoires.');
    if (transactionDone && !transactionType) return setError('Précisez le type de transaction.');
    setSaving(true); setError('');
    try {
      const next = await addMikiliClient({ campaign_id: campaignId, attendance_id: attendance.id, agent_id: currentUser.id, activity_date: today, location_id: locationId, client_name: clientName.trim(), client_phone: normalizedPhone, existing_mikili_user: existingUser, presented_service: presentedService, transaction_done: transactionDone, transaction_type: transactionDone ? transactionType : 'na', transaction_reference: transactionDone ? transactionReference : null });
      setTodayClients((current) => [next, ...current]);
      setIsClientOpen(false); resetClientForm(); setNotice('Client M-Pesa Mikili enregistré.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally { setSaving(false); }
  };

  const closeDay = async () => {
    if (!attendance?.id || isClosed) return;
    if (!closingComment.trim()) return setError('Le commentaire de clôture est obligatoire.');
    setSaving(true); setError('');
    try {
      const geo = await locate();
      const next = await closeMikiliAttendance({ attendanceId: attendance.id, checkoutAt: new Date().toISOString(), latitude: geo.latitude, longitude: geo.longitude, accuracy: geo.accuracy, comment: closingComment });
      setAttendance(next); setNotice('Journée M-Pesa Mikili clôturée.'); setIsReportOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Clôture impossible.');
    } finally { setSaving(false); }
  };

  const txCount = todayClients.filter((item) => item.transaction_done).length;
  const existingCount = todayClients.filter((item) => item.existing_mikili_user === 'yes').length;

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de votre journée M-Pesa Mikili…</div>;

  return (
    <div className="space-y-4 pb-6">
      {error && <div className="glass-card border border-red-400/30 bg-red-500/[0.08] p-3 text-xs font-bold text-red-100"><CircleAlert size={16} className="mr-2 inline" />{error}</div>}
      {notice && <div className="glass-card border border-emerald-300/25 bg-emerald-500/[0.07] p-3 text-xs font-bold text-emerald-100"><CheckCircle2 size={16} className="mr-2 inline" />{notice}</div>}

      {activeTab === 'home' && <>
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-red-500/[0.24] via-white/[0.06] to-transparent p-5 shadow-2xl shadow-red-950/30">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-red-100"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> M-Pesa Mikili</div>
              <h1 className="text-[2rem] font-black leading-none tracking-tight text-white">Bonjour,<br /><span className="text-red-300">{currentUser.name.split(' ')[0]}.</span></h1>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <div className="flex h-16 w-16 shrink-0 rotate-3 items-center justify-center rounded-[1.4rem] border border-white/15 bg-black/20 text-red-200 shadow-xl"><MapPin size={28} /></div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Mission du jour</p><p className="mt-1 text-lg font-black text-white">{todayClients.length} client{todayClients.length > 1 ? 's' : ''}</p></div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300"><UsersRound size={22} /></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3"><b className="block text-xl font-black text-white">{existingCount}</b><span className="text-[8px] font-black uppercase tracking-wider text-gray-500">Déjà Mikili</span></div>
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/[0.035] p-3"><b className="block text-xl font-black text-emerald-200">{txCount}</b><span className="text-[8px] font-black uppercase tracking-wider text-gray-500">Transactions</span></div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Départ</p><p className="mt-1 text-sm font-black text-white">{attendance?.checkin_at ? 'Journée déverrouillée' : checkinPending ? 'Check-in en cours…' : 'Prêt à partir ?'}</p></div>{attendance?.checkin_at && <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[8px] font-black uppercase text-emerald-200">GPS ✓</span>}</div>
          {isCheckedIn ? (
            <div className="relative overflow-hidden rounded-[1.5rem] border border-emerald-300/15 bg-black/30">
              {checkinPhotoUrl ? <img src={checkinPhotoUrl} alt="Check-in M-Pesa Mikili" className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center bg-gradient-to-br from-red-500/20 to-emerald-500/10"><Camera size={34} className="animate-pulse text-white/70" /></div>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10"><span className="text-[9px] font-black uppercase tracking-widest text-white">{checkinPending ? 'Check-in en attente' : 'Check-in validé'}</span><CheckCircle2 size={18} className="text-emerald-300" /></div>
            </div>
          ) : (
            <button type="button" onClick={() => checkinInputRef.current?.click()} disabled={isClosed} className="group flex w-full items-center gap-4 rounded-[1.5rem] border border-dashed border-red-300/25 bg-red-500/[0.06] p-4 text-left transition hover:bg-red-500/10 active:scale-[0.99] disabled:opacity-40">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white shadow-lg shadow-red-500/25 transition group-hover:rotate-3"><Camera size={25} /></span>
              <span><b className="block text-sm font-black text-white">Déverrouiller ma journée</b><span className="mt-1 block text-[9px] font-semibold text-gray-500">Photo + position GPS</span></span>
            </button>
          )}
          <input ref={checkinInputRef} type="file" accept="image/*" capture="user" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) handleCheckin(file); }} className="hidden" />
        </section>

        <button type="button" onClick={() => { setError(''); setIsClientOpen(true); }} disabled={!isCheckedIn || isClosed} className="group relative flex w-full items-center justify-between overflow-hidden rounded-[2rem] border border-red-300/20 bg-red-500 p-5 text-left shadow-xl shadow-red-500/15 transition hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-35">
          <span className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <span><b className="block text-lg font-black text-white">Nouveau client</b><span className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-red-100">Ajouter une interaction +</span></span><PlusCircle size={30} className="text-white transition group-hover:rotate-90" />
        </button>

        <section className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { if (attendance?.checkin_at && !isClosed) setIsReportOpen(true); }} className="glass-card flex min-h-24 flex-col justify-between p-4 text-left transition hover:-translate-y-0.5"><FileText size={19} className="text-red-300" /><span className="text-[10px] font-black uppercase tracking-wide text-gray-300">Mon bilan</span></button>
          <div className="glass-card flex min-h-24 flex-col justify-between p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-widest text-gray-500">État</span><span className={isClosed ? 'h-2 w-2 rounded-full bg-gray-500' : isCheckedIn ? 'h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]' : 'h-2 w-2 rounded-full bg-amber-400'} /></div><span className="text-[10px] font-black uppercase text-gray-300">{isClosed ? 'Journée close' : isCheckedIn ? 'En action' : 'À démarrer'}</span></div>
        </section>
      </>}

      {activeTab === 'tab2' && <section className="space-y-3">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-red-500/[0.16] to-transparent p-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-200">Carnet terrain</p><div className="mt-1 flex items-end justify-between"><h2 className="text-2xl font-black text-white">{todayClients.length} clients</h2><button type="button" onClick={() => void refresh(false)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-300"><RefreshCw size={16} /></button></div></div>
        {todayClients.length === 0 ? <div className="glass-card p-8 text-center"><UsersRound size={28} className="mx-auto text-gray-600" /><p className="mt-3 text-xs font-bold text-gray-500">Le carnet est encore vide.</p></div> : todayClients.map((item) => <article key={item.id} className="group relative overflow-hidden rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-4 transition hover:bg-white/[0.06]"><div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-red-500/[0.07] blur-2xl" /><div className="relative flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-white">{item.client_name}</h3><p className="mt-1 text-[10px] font-semibold text-gray-500">{item.client_phone} · {item.location?.name || 'Lieu non renseigné'}</p></div><span className={item.transaction_done ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-[8px] font-black uppercase text-emerald-200' : 'rounded-full bg-white/8 px-2 py-1 text-[8px] font-black uppercase text-gray-400'}>{item.transaction_done ? 'Transaction' : 'Sensibilisé'}</span></div><div className="relative mt-3 flex flex-wrap gap-1.5"><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[8px] font-bold text-gray-400">{mikiliDisplayExisting(item.existing_mikili_user)}</span><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[8px] font-bold text-gray-400">{mikiliDisplayService(item.presented_service)}</span>{item.transaction_done && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-bold text-emerald-200">{mikiliDisplayTransaction(item.transaction_type)}</span>}</div></article>)}
      </section>}

      {activeTab === 'tab3' && <section className="space-y-3">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-500/[0.12] to-transparent p-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-200">Mémoire terrain</p><h2 className="mt-1 text-2xl font-black text-white">Archives</h2><p className="mt-1 text-[10px] font-semibold text-gray-500">Vos interactions précédentes.</p></div>
        {history.length === 0 ? <div className="glass-card p-8 text-center"><FileText size={28} className="mx-auto text-gray-600" /><p className="mt-3 text-xs font-bold text-gray-500">Aucune trace pour le moment.</p></div> : history.map((item) => <article key={item.id} className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-white">{item.client_name}</h3><p className="mt-1 text-[9px] font-semibold text-gray-500">{item.activity_date} · {item.location?.name || 'Lieu non renseigné'}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-black uppercase text-gray-400">{item.transaction_done ? 'Transaction' : 'Sensibilisation'}</span></div><p className="mt-3 text-[10px] text-gray-500">{item.client_phone} · {mikiliDisplayService(item.presented_service)}</p></article>)}
      </section>}

      {isClientOpen && <ModalShell title="Nouveau contact" onClose={() => !saving && setIsClientOpen(false)}><form onSubmit={saveClient} className="space-y-5">
        <div className="rounded-[1.7rem] border border-red-300/15 bg-red-500/[0.06] p-4"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-200">Nouvelle interaction</p><p className="mt-1 text-xs font-semibold text-gray-400">Quelques gestes, et c’est enregistré.</p></div>
        <div className="grid grid-cols-2 gap-3"><div className="col-span-2"><label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Nom</label><input className={FIELD} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nom complet" /></div><div className="col-span-2"><label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Téléphone</label><input className={FIELD} inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="08XXXXXXXX" /></div></div>
        <div className="space-y-3"><label className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Où ?</label><div className="grid grid-cols-3 gap-2">{mikiliRegions.map((region) => <button key={region} type="button" onClick={() => { setLocationRegion(region); setLocationId(''); setLocationOpen(false); }} className={locationRegion === region ? 'rounded-2xl border border-red-400/60 bg-red-500/20 px-2 py-3 text-[8px] font-black uppercase text-white shadow-lg' : 'rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-3 text-[8px] font-black uppercase text-gray-400'}>{region}</button>)}</div>
          {locationRegion && <div className="relative"><button type="button" aria-haspopup="listbox" aria-expanded={locationOpen} onClick={() => setLocationOpen((open) => !open)} className={FIELD + ' flex items-center justify-between text-left ' + (locationId ? 'text-white' : 'text-gray-500')}><span>{locations.find((item) => item.id === locationId)?.name || 'Choisir le lieu'}</span><ChevronDown size={17} strokeWidth={2.4} className={locationOpen ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>{locationOpen && <div role="listbox" className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto custom-scrollbar rounded-2xl border border-white/15 bg-[#11141d] p-2 shadow-2xl">{visibleLocations.map((item) => <button key={item.id} type="button" role="option" aria-selected={locationId === item.id} onClick={() => { setLocationId(item.id); setLocationOpen(false); }} className={locationId === item.id ? 'w-full rounded-xl bg-red-500/20 px-3 py-2.5 text-left text-[10px] font-black text-white' : 'w-full rounded-xl px-3 py-2.5 text-left text-[10px] font-black text-gray-300 hover:bg-white/10'}>{item.name}</button>)}</div>}</div>}
        </div>
        <div className="space-y-3"><label className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">M-Pesa Mikili</label><div className="grid grid-cols-3 gap-2">{([['yes','Oui'],['no','Non'],['unknown','Ne connaît pas']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setExistingUser(value)} className={existingUser === value ? 'min-h-14 rounded-2xl border border-red-400/60 bg-red-500/20 px-2 text-[9px] font-black text-white' : 'min-h-14 rounded-2xl border border-white/10 bg-white/[0.03] px-2 text-[9px] font-black text-gray-400'}>{label}</button>)}</div></div>
        <div className="space-y-3 rounded-[1.7rem] border border-white/8 bg-black/15 p-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Ce que vous avez présenté</p><p className="mt-1 text-[9px] text-gray-600">Plusieurs choix possibles</p></div><div className="grid grid-cols-2 gap-2">{([['send','Envoi vers l’étranger'],['receive','Réception depuis l’étranger']] as const).map(([value,label]) => { const checked = presentedService === value || presentedService === 'both'; return <button key={value} type="button" role="checkbox" aria-checked={checked} onClick={() => togglePresentedService(value)} className={checked ? 'flex min-h-16 items-center gap-2 rounded-2xl border border-red-400/60 bg-red-500/15 px-3 text-left text-[9px] font-black text-white' : 'flex min-h-16 items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.025] px-3 text-left text-[9px] font-black text-gray-500'}><span className={checked ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-300 bg-red-500 text-white' : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/20'}>{checked ? '✓' : ''}</span>{label}</button>; })}</div></div>
        <div className="space-y-3 rounded-[1.7rem] border border-emerald-400/10 bg-emerald-500/[0.025] p-4"><div className="flex items-center gap-2"><Zap size={14} className="text-emerald-300" /><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200/80">Résultat</p></div><button type="button" role="switch" aria-checked={transactionDone === true} onClick={() => { const next = transactionDone !== true; setTransactionDone(next); if (!next) setTransactionType('na'); }} className={transactionDone === true ? 'flex w-full items-center gap-3 rounded-2xl border border-emerald-400/50 bg-emerald-500/[0.12] p-3 text-left text-white' : 'flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left text-gray-400'}><span className={transactionDone === true ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white' : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-gray-600'}><Zap size={19} fill={transactionDone === true ? 'currentColor' : 'none'} /></span><span className="flex-1"><b className="block text-[10px] font-black">Transaction effectuée</b><span className="text-[8px] text-gray-600">{transactionDone === true ? 'Oui, une opération a été réalisée' : 'Activer si le client a transigé'}</span></span><span className={transactionDone === true ? 'relative h-6 w-11 rounded-full bg-emerald-500 p-1' : 'relative h-6 w-11 rounded-full bg-white/10 p-1'}><span className={transactionDone === true ? 'block h-4 w-4 translate-x-5 rounded-full bg-white shadow transition-transform' : 'block h-4 w-4 rounded-full bg-white shadow transition-transform'} /></span></button>
          {transactionDone && <div className="rounded-2xl border border-emerald-400/10 bg-black/15 p-3"><p className="mb-2 text-[8px] font-black uppercase tracking-widest text-gray-600">Type</p><div className="grid grid-cols-2 gap-2">{([['send','Envoi'],['receive','Réception']] as const).map(([value,label]) => { const checked = transactionType === value || transactionType === 'both'; return <button key={value} type="button" role="checkbox" aria-checked={checked} onClick={() => toggleTransactionType(value)} className={checked ? 'rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2.5 text-[9px] font-black text-emerald-100' : 'rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[9px] font-black text-gray-500'}>{checked ? '✓ ' : ''}{label}</button>; })}</div></div>}
        </div>
        {transactionDone && <div><label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Référence</label><input className={FIELD} value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="Référence de transaction" /></div>}
        <button type="submit" disabled={saving} className="group flex w-full items-center justify-center gap-2 rounded-[1.5rem] bg-red-500 px-4 py-4 text-xs font-black uppercase tracking-wide text-white shadow-xl shadow-red-500/20 transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50"><CheckCircle2 size={18} />{saving ? 'Enregistrement…' : 'C’est parti !'}</button>
      </form></ModalShell>}

      {isReportOpen && <ModalShell title="Mon bilan" onClose={() => !saving && setIsReportOpen(false)}><div className="space-y-4"><div className="rounded-[1.7rem] border border-white/10 bg-gradient-to-br from-red-500/[0.12] to-transparent p-4"><p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Aujourd’hui</p><div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/[0.04] p-3 text-center"><b className="block text-xl text-white">{todayClients.length}</b><span className="text-[8px] font-black uppercase text-gray-500">Clients</span></div><div className="rounded-2xl bg-white/[0.04] p-3 text-center"><b className="block text-xl text-white">{existingCount}</b><span className="text-[8px] font-black uppercase text-gray-500">Mikili</span></div><div className="rounded-2xl bg-emerald-500/[0.06] p-3 text-center"><b className="block text-xl text-emerald-200">{txCount}</b><span className="text-[8px] font-black uppercase text-gray-500">Trans.</span></div></div></div><div><label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Note de fin de journée *</label><textarea className={FIELD + ' min-h-28'} value={closingComment} onChange={(e) => setClosingComment(e.target.value)} placeholder="Un mot sur votre journée…" disabled={isClosed} /></div><button type="button" onClick={() => void closeDay()} disabled={saving || isClosed} className="w-full rounded-[1.5rem] bg-red-500 px-4 py-4 text-xs font-black uppercase tracking-wide text-white disabled:opacity-40">{saving ? 'Clôture…' : isClosed ? 'Journée clôturée ✓' : 'Terminer la journée'}</button></div></ModalShell>}
    </div>
  );
};
