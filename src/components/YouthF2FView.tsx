import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Camera, CheckCircle2, ChevronRight, CircleAlert, FileCheck2, GraduationCap, MapPin, RefreshCw, ShieldCheck, UsersRound, X } from 'lucide-react';
import type { Campaign, User, YouthDailyAssignment, YouthDailyAttendance, YouthUniversity } from '../types';
import { runInBackground } from '../utils/backgroundOperations';
import {
  closeYouthAttendance,
  getYouthAgents,
  getYouthAssignment,
  getYouthAttendance,
  getYouthAttendanceHistory,
  getYouthCampaign,
  getYouthEvidenceUrl,
  getYouthUniversities,
  recordYouthCheckin,
  saveYouthAssignment,
  uploadYouthEvidence,
  youthTodayIso,
} from '../utils/youthCampaign';

interface YouthF2FViewProps {
  currentUser: User;
}

type Geo = { latitude: number; longitude: number; accuracy: number };
type WorkspaceTab = 'today' | 'archives';

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

function locationUrl(latitude?: number | null, longitude?: number | null): string {
  if (latitude == null || longitude == null) return '';
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
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

export const YouthF2FView: React.FC<YouthF2FViewProps> = ({ currentUser }) => {
  const today = useMemo(() => youthTodayIso(), []);
  const isOperator = currentUser.role !== 'agent';
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('today');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [universities, setUniversities] = useState<YouthUniversity[]>([]);
  const [assignment, setAssignment] = useState<YouthDailyAssignment | null>(null);
  const [attendance, setAttendance] = useState<YouthDailyAttendance | null>(null);
  const [history, setHistory] = useState<YouthDailyAttendance[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [operatorUniversityId, setOperatorUniversityId] = useState('');
  const [closingComment, setClosingComment] = useState('');
  const [checkinPending, setCheckinPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [localPhotoUrl, setLocalPhotoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const refresh = useCallback(async (withLoader = true) => {
    if (withLoader) setLoading(true);
    setError('');
    try {
      const currentCampaign = await getYouthCampaign();
      if (!currentCampaign) throw new Error('La campagne Youth F2F est introuvable.');
      const [nextUniversities, nextAssignment, nextAttendance, nextTeam] = await Promise.all([
        getYouthUniversities(currentCampaign.id),
        currentUser.role === 'agent' ? getYouthAssignment(currentUser.id, currentCampaign.id, today) : Promise.resolve(null),
        currentUser.role === 'agent' ? getYouthAttendance(currentUser.id, currentCampaign.id, today) : Promise.resolve(null),
        isOperator ? getYouthAgents(currentUser.role === 'supervisor' ? currentUser.id : undefined) : Promise.resolve([]),
      ]);
      setCampaign(currentCampaign);
      setUniversities(nextUniversities);
      setAssignment(nextAssignment);
      setAttendance(nextAttendance);
      setTeam(nextTeam);
      setSelectedUniversityId(nextAssignment?.university_id || nextUniversities[0]?.id || '');
      setOperatorUniversityId(nextUniversities[0]?.id || '');
      setSelectedAgentId((previous) => previous || nextTeam[0]?.id || '');
      setClosingComment(nextAttendance?.closing_comment || '');
      if (nextAttendance?.checkin_photo_path) {
        void getYouthEvidenceUrl(nextAttendance.checkin_photo_path).then(setPhotoUrl).catch(() => setPhotoUrl(''));
      } else {
        setPhotoUrl('');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement de Youth F2F impossible.');
    } finally {
      if (withLoader) setLoading(false);
    }
  }, [currentUser.id, currentUser.role, isOperator, today]);

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

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (workspaceTab === 'archives') void loadHistory(); }, [workspaceTab, loadHistory]);

  const isCheckedIn = Boolean(attendance?.checkin_at) || checkinPending;
  const isClosed = Boolean(attendance?.checkout_at);
  const selectedUniversity = universities.find((university) => university.id === selectedUniversityId) || assignment?.university || null;

  const handleAssignment = (agentId = currentUser.id, universityId = selectedUniversityId) => {
    if (!campaign || !universityId || !agentId) {
      setError('Sélectionnez un agent et une université avant de valider.');
      return;
    }
    const university = universities.find((item) => item.id === universityId);
    if (!university) return;
    setError('');
    setNotice(agentId === currentUser.id ? 'Université enregistrée localement. Synchronisation en arrière-plan…' : 'Affectation lancée en arrière-plan.');
    if (agentId === currentUser.id) {
      setAssignment((current) => ({
        id: current?.id || `local-youth-${today}`,
        campaign_id: campaign.id,
        ba_id: currentUser.id,
        university_id: university.id,
        activity_date: today,
        status: 'in_progress',
        assigned_by: currentUser.id,
        university,
      }));
    }
    runInBackground('Université Youth F2F', () => saveYouthAssignment({
      campaignId: campaign.id,
      baId: agentId,
      universityId,
      activityDate: today,
      assignedBy: currentUser.id,
    }), {
      queued: 'Affectation en cours de synchronisation.',
      success: 'Université du jour synchronisée.',
      onSuccess: (next) => {
        if (agentId === currentUser.id) {
          setAssignment(next);
          setSelectedUniversityId(next.university_id);
        }
        setNotice(agentId === currentUser.id ? 'Université du jour synchronisée.' : 'Affectation de l’agent synchronisée.');
      },
      onError: (caught) => {
        setError(caught.message);
        if (agentId === currentUser.id) void refresh(false);
      },
    });
  };

  const handleCheckin = (file: File) => {
    if (!campaign) return;
    if (!assignment || assignment.id.startsWith('local-')) {
      setError('Validez d’abord l’université du jour, puis attendez sa confirmation avant de pointer.');
      return;
    }
    if (isClosed) {
      setError('Cette journée est déjà clôturée. Consultez vos archives.');
      return;
    }
    const preview = URL.createObjectURL(file);
    setLocalPhotoUrl(preview);
    setCheckinPending(true);
    setError('');
    setNotice('Pointage enregistré sur cet appareil. Vous pouvez poursuivre pendant la synchronisation.');
    runInBackground('Pointage Youth F2F', async () => {
      const geo = await locate();
      const path = await uploadYouthEvidence(`${currentUser.id}/${today}/checkin-${Date.now()}.jpg`, file);
      const nextAttendance = await recordYouthCheckin({
        campaignId: campaign.id,
        assignmentId: assignment.id,
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
        void getYouthEvidenceUrl(path).then(setPhotoUrl).catch(() => setPhotoUrl(preview));
        setNotice('Pointage synchronisé avec photo et position GPS.');
      },
      onError: (caught) => {
        setCheckinPending(false);
        setLocalPhotoUrl('');
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
              <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Espace opérationnel</h1>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-300">{isOperator ? 'Pilotez les affectations d’université et suivez les activités terrain.' : `Bonjour ${currentUser.name.split(' ')[0]}. Choisissez votre université, pointez puis clôturez votre activité du jour.`}</p>
            </div>
          </div>
          <button type="button" onClick={() => void refresh(false)} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-2 text-cyan-100 transition hover:bg-white/10" title="Actualiser Youth F2F"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="flex rounded-2xl border border-white/10 bg-black/15 p-1">
        <button type="button" onClick={() => setWorkspaceTab('today')} className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${workspaceTab === 'today' ? 'bg-cyan-400/15 text-cyan-100 shadow-sm' : 'text-gray-500 hover:text-gray-200'}`}>Aujourd’hui</button>
        {!isOperator && <button type="button" onClick={() => setWorkspaceTab('archives')} className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${workspaceTab === 'archives' ? 'bg-cyan-400/15 text-cyan-100 shadow-sm' : 'text-gray-500 hover:text-gray-200'}`}>Archives</button>}
      </div>

      {error && <div className="flex gap-2 rounded-2xl border border-red-400/40 bg-red-950/35 p-3 text-xs font-semibold text-red-200"><CircleAlert className="mt-0.5 shrink-0" size={16}/><span>{error}</span></div>}
      {notice && <div className="flex gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-100"><CheckCircle2 className="mt-0.5 shrink-0" size={16}/><span>{notice}</span></div>}

      {workspaceTab === 'archives' && !isOperator ? (
        <section className="glass-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">Archives terrain</p><h2 className="mt-1 text-sm font-black text-white">Vos journées Youth F2F</h2></div><CalendarDays size={19} className="text-cyan-200"/></div>
          {loadingHistory ? <p className="py-6 text-center text-xs font-bold text-gray-500">Chargement des archives…</p> : history.length === 0 ? <p className="rounded-2xl border border-white/10 bg-black/10 p-4 text-center text-xs font-semibold text-gray-500">Aucune journée Youth F2F enregistrée pour le moment.</p> : <div className="space-y-2">{history.map((item) => <button key={item.id} type="button" onClick={() => { setAttendance(item); setWorkspaceTab('today'); }} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.07]"><span><b className="block text-xs text-white">{readableDate(item.activity_date)}</b><span className="mt-1 block text-[10px] text-gray-500">{item.checkout_at ? 'Journée clôturée' : 'Pointage enregistré'}</span></span><ChevronRight size={17} className="text-cyan-200"/></button>)}</div>}
        </section>
      ) : isOperator ? (
        <section className="glass-card p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-200/15 bg-violet-300/10 text-violet-200"><ShieldCheck size={19}/></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-100">Pilotage terrain</p><h2 className="mt-1 text-sm font-black text-white">Affectation quotidienne d’université</h2><p className="mt-1 text-[11px] leading-relaxed text-gray-400">Les affectations sont immédiatement utilisables par les agents pour le pointage photo/GPS et la clôture du jour.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Agent Youth</label><select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} className="app-input w-full rounded-2xl px-3 py-3 text-sm">{team.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></div><div><label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Université</label><select value={operatorUniversityId} onChange={(event) => setOperatorUniversityId(event.target.value)} className="app-input w-full rounded-2xl px-3 py-3 text-sm">{universities.map((university) => <option key={university.id} value={university.id}>{university.name} · {university.commune}</option>)}</select></div></div>
          <button type="button" disabled={!selectedAgentId || !operatorUniversityId} onClick={() => handleAssignment(selectedAgentId, operatorUniversityId)} className="btn-neon mt-3 w-full disabled:cursor-not-allowed disabled:opacity-45">Valider l’affectation du jour</button>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{universities.map((university) => <div key={university.id} className="rounded-2xl border border-white/10 bg-black/10 p-3"><p className="text-[10px] font-black text-cyan-100">{university.name}</p><p className="mt-1 text-[10px] leading-relaxed text-gray-500">{university.address || university.commune || 'Adresse à compléter'}</p></div>)}</div>
          {team.length === 0 && <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-xs font-semibold text-amber-100">Aucun agent Youth F2F n’est encore rattaché à ce superviseur.</p>}
        </section>
      ) : (
        <>
          <section className="glass-card p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">Université du jour</p><h2 className="mt-1 text-sm font-black text-white">{assignment?.university?.name || 'Choisissez votre site de sensibilisation'}</h2><p className="mt-1 text-[11px] text-gray-400">{readableDate(today)}</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100"><MapPin size={18}/></span></div>
            <select value={selectedUniversityId} disabled={isCheckedIn || isClosed} onChange={(event) => setSelectedUniversityId(event.target.value)} className="app-input w-full rounded-2xl px-3 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-55">{universities.map((university) => <option key={university.id} value={university.id}>{university.name} · {university.commune}</option>)}</select>
            {selectedUniversity?.address && <p className="mt-2 rounded-xl border border-white/[0.08] bg-black/10 px-3 py-2 text-[10px] font-semibold leading-relaxed text-gray-400">{selectedUniversity.address}</p>}
            {!isCheckedIn && <button type="button" disabled={!selectedUniversityId} onClick={() => handleAssignment()} className="mt-3 w-full rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45">Valider l’université du jour</button>}
          </section>

          {!isCheckedIn && <section className="glass-card p-5 text-center"><Camera className="mx-auto text-cyan-200" size={24}/><h2 className="mt-2 text-sm font-black text-white">Pointage du matin</h2><p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-gray-400">Prenez une photo sur votre lieu de sensibilisation. La localisation et l’horodatage sont enregistrés avec le pointage.</p><label className={`btn-neon mt-4 flex cursor-pointer items-center justify-center gap-2 ${!assignment || assignment.id.startsWith('local-') ? 'pointer-events-none opacity-45' : ''}`}><Camera size={16}/><span>Prendre ma photo de pointage</span><input type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleCheckin(file); event.currentTarget.value = ''; }} /></label>{(!assignment || assignment.id.startsWith('local-')) && <p className="mt-2 text-[10px] font-bold text-amber-200">Validez d’abord l’université sélectionnée.</p>}</section>}

          {isCheckedIn && <section className="glass-card overflow-hidden p-4 sm:p-5"><div className="flex items-start gap-3"><button type="button" onClick={() => setPreviewUrl(photoUrl || localPhotoUrl)} className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">{(photoUrl || localPhotoUrl) ? <img src={photoUrl || localPhotoUrl} alt="Pointage Youth F2F" className="h-full w-full object-cover"/> : <Camera size={22}/>}</button><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">Pointage validé</p><h2 className="mt-1 text-sm font-black text-white">{assignment?.university?.name || 'Université de sensibilisation'}</h2><p className="mt-1 text-[10px] text-gray-400">{attendance?.checkin_at ? new Date(attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Synchronisation en cours'} · Photo et GPS associés</p></div></div>{locationUrl(attendance?.checkin_latitude, attendance?.checkin_longitude) && <iframe title="Localisation du pointage Youth F2F" src={locationUrl(attendance?.checkin_latitude, attendance?.checkin_longitude)} className="mt-4 h-56 w-full rounded-2xl border border-white/10" loading="lazy"/>}</section>}

          {isCheckedIn && !isClosed && <section className="glass-card p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-200"><FileCheck2 size={19}/></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Rapport de clôture</p><h2 className="mt-1 text-sm font-black text-white">Clôturer votre journée</h2><p className="mt-1 text-[11px] leading-relaxed text-gray-400">Décrivez brièvement la sensibilisation réalisée. Le commentaire est requis pour clôturer.</p></div></div><textarea value={closingComment} onChange={(event) => setClosingComment(event.target.value)} rows={4} placeholder="Ex. Sensibilisation menée auprès des étudiants ; retours et incidents éventuels…" className="app-input mt-4 w-full resize-none rounded-2xl px-3 py-3 text-sm"/><button type="button" onClick={handleClose} className="mt-3 w-full rounded-2xl border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 transition hover:bg-amber-400/20">Clôturer ma journée</button></section>}

          {isClosed && <section className="glass-card border border-emerald-400/25 p-5 text-center"><CheckCircle2 className="mx-auto text-emerald-300" size={25}/><h2 className="mt-2 text-sm font-black text-white">Journée clôturée</h2><p className="mt-1 text-[11px] leading-relaxed text-gray-400">Votre rapport est conservé dans les archives Youth F2F. Vous pourrez consulter l’emplacement, la photo et le commentaire enregistrés.</p></section>}
        </>
      )}

      {previewUrl && <ModalShell title="Photo de pointage" onClose={() => setPreviewUrl('')}><img src={previewUrl} alt="Photo de pointage Youth F2F" className="w-full rounded-2xl border border-white/10 object-contain"/></ModalShell>}
    </section>
  );
};
