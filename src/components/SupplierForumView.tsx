import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Clock3, ExternalLink, MapPin, ShieldCheck, Users, X, XCircle } from 'lucide-react';
import type { Campaign, User } from '../types';
import {
  type EventAttendance,
  getEventAttendance,
  getEventPhotoUrl,
  getEventTeam,
  saveEventArrival,
  saveEventDeparture,
  supplierForumDate,
  SUPPLIER_FORUM_DATE,
  SUPPLIER_FORUM_ARRIVAL_DEADLINE,
  SUPPLIER_FORUM_DEPARTURE_TIME,
} from '../utils/eventCampaign';

interface Props { currentUser: User; campaign: Campaign | null; onRefreshData?: () => void; }
type TeamRow = { user: User; attendance: EventAttendance | null };

const kinshasaNow = () => new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit' });
const formatPointageTime = (value?: string | null) => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Non pointé';
const mapUrl = (latitude?: number | null, longitude?: number | null) => latitude != null && longitude != null ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed` : '';

async function locate() {
  if (!navigator.geolocation) return { latitude: null, longitude: null, accuracy: null };
  return new Promise<{ latitude: number | null; longitude: number | null; accuracy: number | null }>((resolve) => navigator.geolocation.getCurrentPosition((pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy || 0) }), () => resolve({ latitude: null, longitude: null, accuracy: null }), { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 }));
}
async function compress(file: File): Promise<Blob> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Photo illisible.')); reader.onload = () => { const img = new Image(); img.onerror = () => reject(new Error('Photo illisible.')); img.onload = () => { const canvas = document.createElement('canvas'); const scale = Math.min(1, 900 / Math.max(img.width, img.height)); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale)); const ctx = canvas.getContext('2d'); if (!ctx) return reject(new Error('Compression photo indisponible.')); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Compression photo impossible.')), 'image/jpeg', 0.72); }; img.src = String(reader.result); }; reader.readAsDataURL(file); }); }

export const SupplierForumView: React.FC<Props> = ({ currentUser, campaign, onRefreshData }) => {
  const isManager = ['admin', 'super_admin', 'supervisor', 'sub_admin'].includes(currentUser.role);
  const [attendance, setAttendance] = useState<EventAttendance | null>(null);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [selectedHostess, setSelectedHostess] = useState<TeamRow | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<{ arrival: string; departure: string }>({ arrival: '', departure: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoKind, setPhotoKind] = useState<'arrival' | 'departure' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = supplierForumDate();
  const isEventDay = today === SUPPLIER_FORUM_DATE;

  const refresh = async () => {
    if (!campaign) return;
    setLoading(true);
    try {
      if (isManager) setTeam(await getEventTeam(campaign.id));
      else setAttendance(await getEventAttendance(campaign.id, currentUser.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible de charger l’Event.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [campaign?.id, currentUser.id, isManager]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedHostess) { setSelectedPhotos({ arrival: '', departure: '' }); return undefined; }
    void Promise.all([getEventPhotoUrl(selectedHostess.attendance?.checkin_photo_path), getEventPhotoUrl(selectedHostess.attendance?.checkout_photo_path)]).then(([arrival, departure]) => {
      if (!cancelled) setSelectedPhotos({ arrival, departure });
    }).catch(() => { if (!cancelled) setSelectedPhotos({ arrival: '', departure: '' }); });
    return () => { cancelled = true; };
  }, [selectedHostess]);

  const onPhoto = async (file: File) => {
    if (!campaign || !isEventDay || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const photo = await compress(file); const geo = await locate(); const at = new Date().toISOString();
      if (photoKind === 'arrival') { setAttendance(await saveEventArrival({ eventId: campaign.id, agentId: currentUser.id, date: SUPPLIER_FORUM_DATE, at, ...geo, photo })); setNotice(`Arrivée enregistrée à ${kinshasaNow()}.`); }
      else if (attendance) { setAttendance(await saveEventDeparture({ attendanceId: attendance.id, at, ...geo, photo })); setNotice(`Départ enregistré à ${kinshasaNow()}.`); }
      onRefreshData?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); setPhotoKind(null); }
  };

  if (!campaign) return <section className="glass-card p-6 text-center text-sm text-red-200">L’Event n’est pas disponible.</section>;

  if (isManager) return <section className="space-y-4">
    <div className="glass-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Event · 25 septembre 2026</p><h1 className="mt-2 text-xl font-black text-white">{campaign.name}</h1><p className="mt-1 text-xs text-gray-400">Pointages arrivée 09:00 · départ 15:00</p></div><ShieldCheck className="h-8 w-8 text-cyan-300" /></div></div>
    <div className="glass-card p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-xs font-black uppercase tracking-widest text-white">Suivi des hôtesses</h2><p className="mt-1 text-[10px] text-gray-500">Cliquez sur un nom pour ouvrir sa fiche de pointage.</p></div><span className="rounded-full border border-cyan-300/25 px-2 py-1 text-[10px] font-black text-cyan-200">{team.length}</span></div>
      {loading ? <p className="text-xs text-gray-400">Chargement…</p> : team.map((entry) => { const row = entry.attendance; return <button key={entry.user.id} type="button" onClick={() => setSelectedHostess(entry)} className="mb-2 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.06]"><span className="min-w-0"><b className="block truncate text-xs font-bold text-white">{entry.user.full_name || entry.user.name}</b><span className="mt-1 flex items-center gap-1 text-[10px] text-gray-500"><Clock3 size={11}/>Arrivée : {formatPointageTime(row?.checkin_at)} · Départ : {formatPointageTime(row?.checkout_at)}</span></span><span className={`ml-3 shrink-0 text-[10px] font-black uppercase ${row?.status === 'closed' ? 'text-emerald-300' : row?.checkin_at ? 'text-cyan-300' : 'text-gray-500'}`}>{row?.status === 'closed' ? 'Départ pointé' : row?.checkin_at ? 'Arrivée pointée' : 'En attente'}</span></button>; })}
    </div>
    {selectedHostess && <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true"><section className="modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl"><header className="modal-sticky-header flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Fiche hôtesse · Supplier Forum</p><h2 className="mt-1 text-lg font-black text-white">{selectedHostess.user.full_name || selectedHostess.user.name}</h2><p className="mt-1 text-[10px] text-gray-400">{selectedHostess.user.phone || 'Téléphone non renseigné'}</p></div><button type="button" onClick={() => setSelectedHostess(null)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300" aria-label="Fermer"><X size={18}/></button></header><div className="mt-5 space-y-4">{selectedHostess.attendance ? <><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] p-3"><span className="text-[9px] font-black uppercase text-cyan-200/70">Arrivée</span><b className="mt-1 block text-sm text-white">{formatPointageTime(selectedHostess.attendance.checkin_at)}</b></div><div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-3"><span className="text-[9px] font-black uppercase text-amber-200/70">Départ</span><b className="mt-1 block text-sm text-white">{formatPointageTime(selectedHostess.attendance.checkout_at)}</b></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[10px] text-gray-300"><b className="block text-[9px] uppercase text-gray-500">Localisation arrivée</b><span className="mt-1 block">{selectedHostess.attendance.checkin_latitude != null && selectedHostess.attendance.checkin_longitude != null ? `${selectedHostess.attendance.checkin_latitude}, ${selectedHostess.attendance.checkin_longitude}` : 'Non disponible'}</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[10px] text-gray-300"><b className="block text-[9px] uppercase text-gray-500">Localisation départ</b><span className="mt-1 block">{selectedHostess.attendance.checkout_latitude != null && selectedHostess.attendance.checkout_longitude != null ? `${selectedHostess.attendance.checkout_latitude}, ${selectedHostess.attendance.checkout_longitude}` : 'Non disponible'}</span></div></div>{selectedPhotos.arrival && <img src={selectedPhotos.arrival} alt="Photo d'arrivée" className="max-h-64 w-full rounded-2xl object-cover" />}{selectedPhotos.departure && <img src={selectedPhotos.departure} alt="Photo de départ" className="max-h-64 w-full rounded-2xl object-cover" />}{mapUrl(selectedHostess.attendance.checkin_latitude, selectedHostess.attendance.checkin_longitude) && <div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-cyan-200"><MapPin size={15}/>Carte du pointage d’arrivée</div><iframe title="Localisation du pointage d’arrivée" src={mapUrl(selectedHostess.attendance.checkin_latitude, selectedHostess.attendance.checkin_longitude)} className="h-64 w-full rounded-2xl border border-white/10" loading="lazy" /> <a href={`https://www.google.com/maps?q=${selectedHostess.attendance.checkin_latitude},${selectedHostess.attendance.checkin_longitude}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-cyan-200">Ouvrir la carte <ExternalLink size={12}/></a></div>}</> : <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">Aucun pointage enregistré pour cette hôtesse.</div>}</div></section></div>}
  </section>;

  const canArrival = isEventDay && !attendance?.checkin_at; const canDeparture = isEventDay && !!attendance?.checkin_at && attendance.status !== 'closed';
  return <section className="space-y-4"><div className="glass-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Event · 25 septembre 2026</p><h1 className="mt-2 text-xl font-black text-white">{campaign.name}</h1><p className="mt-1 text-xs text-gray-400">Supervision : Alpha Okito · Activité 09:30–14:30</p></div><Users className="h-8 w-8 text-cyan-300" /></div>{!isEventDay && <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">Le pointage sera disponible le 25 septembre 2026. Arrivée attendue à 09:00 et départ à 15:00.</div>}</div><div className="glass-card p-5"><div className="mb-4 flex items-center gap-3"><Clock3 className="h-5 w-5 text-cyan-300" /><div><h2 className="text-sm font-black uppercase text-white">Pointage de l’Event</h2><p className="text-[11px] text-gray-400">Une photo et la localisation sont enregistrées à chaque passage.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={!canArrival || saving} onClick={() => { setPhotoKind('arrival'); inputRef.current?.click(); }} className={`rounded-2xl border px-4 py-4 text-left transition ${canArrival ? 'border-cyan-300/30 bg-cyan-400/10 hover:bg-cyan-400/15' : 'border-white/10 bg-white/5 opacity-60'}`}><Camera className="mb-2 h-5 w-5 text-cyan-300" /><b className="block text-xs font-black uppercase text-white">{attendance?.checkin_at ? 'Arrivée enregistrée' : 'Pointer l’arrivée'}</b><span className="mt-1 block text-[10px] text-gray-400">{attendance?.checkin_at ? formatPointageTime(attendance.checkin_at) : `Avant ${SUPPLIER_FORUM_ARRIVAL_DEADLINE}`}</span></button><button type="button" disabled={!canDeparture || saving} onClick={() => { setPhotoKind('departure'); inputRef.current?.click(); }} className={`rounded-2xl border px-4 py-4 text-left transition ${canDeparture ? 'border-amber-300/30 bg-amber-400/10 hover:bg-amber-400/15' : 'border-white/10 bg-white/5 opacity-60'}`}><MapPin className="mb-2 h-5 w-5 text-amber-300" /><b className="block text-xs font-black uppercase text-white">{attendance?.status === 'closed' ? 'Départ enregistré' : 'Pointer le départ'}</b><span className="mt-1 block text-[10px] text-gray-400">{attendance?.checkout_at ? formatPointageTime(attendance.checkout_at) : `À partir de ${SUPPLIER_FORUM_DEPARTURE_TIME}`}</span></button></div><input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onPhoto(file); }} />{saving && <p className="mt-4 text-xs font-bold text-cyan-200">Synchronisation du pointage…</p>}{notice && <p className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" />{notice}</p>}{error && <p className="mt-4 flex items-center gap-2 text-xs font-bold text-red-300"><XCircle className="h-4 w-4" />{error}</p>}</div></section>;
};
