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

  const visibleLocations = useMemo(() => locationRegion ? locations.filter((item) => item.region === locationRegion) : [], [locations, locationRegion]);

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
    <div className="space-y-4 pb-4">
      {error && <div className="glass-card border border-red-400/35 bg-red-500/[0.08] p-3 text-xs font-bold text-red-100"><CircleAlert size={16} className="mr-2 inline" />{error}</div>}
      {notice && <div className="glass-card border border-emerald-300/25 bg-emerald-500/[0.07] p-3 text-xs font-bold text-emerald-100"><CheckCircle2 size={16} className="mr-2 inline" />{notice}</div>}

      {activeTab === 'home' && <>
        <section className="glass-card relative overflow-hidden border border-red-300/15 p-5">
          <div className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full bg-red-500/[0.09] blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200/80">M-Pesa Mikili · Brand Ambassador</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Bonjour, {currentUser.name.split(' ')[0]}</h1>
            <p className="mt-1 text-xs font-semibold text-gray-300">{new Date(`${today}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </section>

        <section className="glass-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Déverrouillage de la journée</p><p className="mt-1 text-sm font-black text-white">{attendance?.checkin_at ? 'Journée déverrouillée' : checkinPending ? 'Synchronisation…' : 'À effectuer'}</p></div>
            <button type="button" onClick={() => checkinInputRef.current?.click()} disabled={isCheckedIn || isClosed} className="rounded-2xl border border-red-300/25 bg-red-500/15 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-100 disabled:opacity-40"><Camera size={16} className="mr-1 inline" />{isCheckedIn ? 'Pointé' : 'Pointer'}</button>
          </div>
          <input ref={checkinInputRef} type="file" accept="image/*" capture="user" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) handleCheckin(file); }} className="hidden" />
          {attendance?.checkin_at && <p className="mt-3 text-[10px] font-semibold text-gray-400">Pointage à {new Date(attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · GPS enregistré</p>}
        </section>

        <section className="glass-card p-4">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Activité du jour</p><p className="mt-1 text-lg font-black text-white">{todayClients.length} client{todayClients.length > 1 ? 's' : ''}</p></div><div className="text-right text-[10px] font-bold text-gray-400">{existingCount} utilisateur{existingCount > 1 ? 's' : ''} Mikili<br />{txCount} transaction{txCount > 1 ? 's' : ''}</div></div>
          <button type="button" onClick={() => { setError(''); setIsClientOpen(true); }} disabled={!isCheckedIn || isClosed} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"><PlusCircle size={17} /> Ajouter client</button>
        </section>

        <section className="glass-card p-4">
          <div className="flex items-center gap-2"><FileText size={17} className="text-red-300" /><p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-300">Rapport journalier</p></div>
          <p className="mt-2 text-xs font-semibold text-gray-400">{isClosed ? 'Votre journée est clôturée.' : 'Consultez le récapitulatif puis clôturez la journée.'}</p>
          <button type="button" onClick={() => setIsReportOpen(true)} disabled={!attendance?.checkin_at || isClosed} className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-40">Ouvrir le rapport</button>
        </section>
      </>}

      {activeTab === 'tab2' && <section className="space-y-3"><div className="glass-card p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200">Mes clients</p><h2 className="mt-1 text-xl font-black text-white">Aujourd’hui</h2></div><button type="button" onClick={() => void refresh(false)} className="rounded-xl border border-white/10 p-2 text-gray-300"><RefreshCw size={16} /></button></div></div>{todayClients.length === 0 ? <div className="glass-card p-6 text-center text-xs font-semibold text-gray-400">Aucun client enregistré aujourd’hui.</div> : todayClients.map((item) => <article key={item.id} className="glass-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-white">{item.client_name}</h3><p className="mt-1 text-[11px] font-semibold text-gray-400">{item.client_phone} · {item.location?.name || 'Lieu non renseigné'}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.transaction_done ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'}`}>{item.transaction_done ? 'Transaction' : 'Sensibilisé'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-gray-400"><span>Déjà utilisateur : <b className="text-gray-200">{mikiliDisplayExisting(item.existing_mikili_user)}</b></span><span>Service : <b className="text-gray-200">{mikiliDisplayService(item.presented_service)}</b></span></div>{item.transaction_done && <p className="mt-2 text-[10px] font-bold text-emerald-200">{mikiliDisplayTransaction(item.transaction_type)}{item.transaction_reference ? ` · Réf. ${item.transaction_reference}` : ''}</p>}</article>)}</section>}

      {activeTab === 'tab3' && <section className="space-y-3"><div className="glass-card p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200">Archives</p><h2 className="mt-1 text-xl font-black text-white">Historique M-Pesa Mikili</h2><p className="mt-1 text-[10px] font-semibold text-gray-400">Clients enregistrés sur vos journées précédentes et actuelle.</p></div>{history.length === 0 ? <div className="glass-card p-6 text-center text-xs font-semibold text-gray-400">Aucun historique disponible.</div> : history.map((item) => <article key={item.id} className="glass-card p-4"><div className="flex items-start justify-between"><div><h3 className="text-sm font-black text-white">{item.client_name}</h3><p className="mt-1 text-[10px] font-semibold text-gray-400">{item.activity_date} · {item.location?.name || 'Lieu non renseigné'}</p></div><span className="text-[9px] font-black uppercase text-gray-400">{item.transaction_done ? 'Transaction' : 'Sensibilisation'}</span></div><p className="mt-2 text-[10px] text-gray-400">{item.client_phone} · {mikiliDisplayService(item.presented_service)}</p></article>)}</section>}

      {isClientOpen && <ModalShell title="Ajouter un client · M-Pesa Mikili" onClose={() => !saving && setIsClientOpen(false)}><form onSubmit={saveClient} className="space-y-4">
        <div><label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Nom du client *</label><input className={FIELD} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nom complet" /></div>
        <div><label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Numéro de téléphone *</label><input className={FIELD} inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="08XXXXXXXX" /></div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Lieu d’activité *</label>
          <div className="grid grid-cols-3 gap-2">
            {mikiliRegions.map((region) => (
              <button key={region} type="button" onClick={() => { setLocationRegion(region); setLocationId(''); setLocationOpen(false); }}
                className={`rounded-2xl border px-2 py-3 text-[9px] font-black uppercase tracking-tight transition active:scale-[0.98] ${locationRegion === region ? 'border-red-400/60 bg-red-500/20 text-white shadow-lg shadow-red-500/10' : 'border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.07]'}`}>
                {region}
              </button>
            ))}
          </div>
          {locationRegion && <div className="relative">
            <button type="button" aria-haspopup="listbox" aria-expanded={locationOpen} onClick={() => setLocationOpen((open) => !open)} className={`${FIELD} flex items-center justify-between text-left ${locationId ? 'text-white' : 'text-gray-500'}`}>
              <span>{locations.find((item) => item.id === locationId)?.name || 'Choisir une localisation'}</span>
              <ChevronDown size={17} strokeWidth={2.4} className={`transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
            </button>
            {locationOpen && <div role="listbox" className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto custom-scrollbar rounded-2xl border border-white/15 bg-[#11141d] p-2 shadow-2xl backdrop-blur-2xl">
              {visibleLocations.map((item) => <button key={item.id} type="button" role="option" aria-selected={locationId === item.id} onClick={() => { setLocationId(item.id); setLocationOpen(false); }} className={`w-full rounded-xl px-3 py-2.5 text-left text-[10px] font-black transition ${locationId === item.id ? 'bg-red-500/20 text-white' : 'text-gray-300 hover:bg-white/10'}`}>{item.name}</button>)}
            </div>}
          </div>}
        </div>
        <div><label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Le client est-il déjà utilisateur de M-Pesa Mikili ? *</label><div className="grid grid-cols-3 gap-2 mt-2">{([['yes','OUI'],['no','NON'],['unknown','Ne connaît pas le service']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setExistingUser(value)} className={`rounded-2xl border px-2 py-3 text-[10px] font-black ${existingUser === value ? 'border-red-400/60 bg-red-500/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-400'}`}>{label}</button>)}</div></div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Service M-Pesa Mikili présenté *</label>
          <div className="mt-2 space-y-2">
            {([['send','Envoi vers l’étranger'],['receive','Réception depuis l’étranger']] as const).map(([value,label]) => {
              const checked = presentedService === value || presentedService === 'both';
              return <button key={value} type="button" role="checkbox" aria-checked={checked} onClick={() => togglePresentedService(value)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-[10px] font-black transition ${checked ? 'border-red-400/60 bg-red-500/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-400'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-red-400 bg-red-500 text-white' : 'border-white/20 bg-black/20'}`}>{checked ? '✓' : ''}</span>{label}
              </button>;
            })}
          </div>
        </div>
        <div className="relative pt-4">
          <div className="pointer-events-none absolute left-0 right-0 top-0 border-t border-white/10" />
          <div className="mb-3 flex items-center gap-2">
            <Zap size={14} className="text-emerald-300" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200/80">Action du client</span>
          </div>
          <button type="button" role="switch" aria-checked={transactionDone === true} onClick={() => { const next = transactionDone !== true; setTransactionDone(next); if (!next) setTransactionType('na'); }} className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${transactionDone === true ? 'border-emerald-400/50 bg-emerald-500/[0.12] text-white shadow-lg shadow-emerald-500/10' : 'border-white/10 bg-white/[0.025] text-gray-400 hover:bg-white/[0.06]'}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${transactionDone === true ? 'border-emerald-300/60 bg-emerald-500 text-white' : 'border-white/15 bg-black/20 text-gray-500'}`}>
              <Zap size={18} fill={transactionDone === true ? 'currentColor' : 'none'} />
            </span>
            <span className="min-w-0 flex-1"><b className="block text-[11px] font-black">Transaction effectuée</b><span className="mt-0.5 block text-[9px] font-semibold text-gray-500">{transactionDone === true ? 'Oui · le client a effectué une transaction' : 'Activer si une transaction a été réalisée'}</span></span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full p-1 transition ${transactionDone === true ? 'bg-emerald-500' : 'bg-white/10'}`}><span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${transactionDone === true ? 'translate-x-5' : 'translate-x-0'}`} /></span>
          </button>
        </div>
        {transactionDone && <><div>
          <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Type de transaction *</label>
          <div className="mt-2 space-y-2">
            {([['send','Envoi vers l’étranger'],['receive','Réception depuis l’étranger']] as const).map(([value,label]) => {
              const checked = transactionType === value || transactionType === 'both';
              return <button key={value} type="button" role="checkbox" aria-checked={checked} onClick={() => toggleTransactionType(value)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-[10px] font-black transition ${checked ? 'border-red-400/60 bg-red-500/20 text-white' : 'border-white/10 bg-white/[0.03] text-gray-400'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-red-400 bg-red-500 text-white' : 'border-white/20 bg-black/20'}`}>{checked ? '✓' : ''}</span>{label}
              </button>;
            })}
          </div>
        </div><div><label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Référence de la transaction</label><input className={FIELD} value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="Référence" /></div></>}
        <button type="submit" disabled={saving} className="w-full rounded-2xl bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer le client'}</button>
      </form></ModalShell>}

      {isReportOpen && <ModalShell title="Rapport journalier · M-Pesa Mikili" onClose={() => !saving && setIsReportOpen(false)}><div className="space-y-3"><div className="grid grid-cols-3 gap-2"><div className="glass-card p-3 text-center"><b className="block text-xl text-white">{todayClients.length}</b><span className="text-[9px] font-black uppercase text-gray-400">Clients</span></div><div className="glass-card p-3 text-center"><b className="block text-xl text-white">{existingCount}</b><span className="text-[9px] font-black uppercase text-gray-400">Déjà utilisateurs</span></div><div className="glass-card p-3 text-center"><b className="block text-xl text-white">{txCount}</b><span className="text-[9px] font-black uppercase text-gray-400">Transactions</span></div></div><div><label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Commentaire de clôture *</label><textarea className={`${FIELD} min-h-28`} value={closingComment} onChange={(e) => setClosingComment(e.target.value)} placeholder="Commentaire de fin de journée" disabled={isClosed} /></div><button type="button" onClick={() => void closeDay()} disabled={saving || isClosed} className="w-full rounded-2xl bg-red-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-40">{saving ? 'Clôture…' : isClosed ? 'Journée déjà clôturée' : 'Clôturer la journée'}</button></div></ModalShell>}
    </div>
  );
};
