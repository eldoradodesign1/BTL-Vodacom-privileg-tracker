import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CheckCircle2, FileText, MapPin, UserRound, X } from 'lucide-react';
import type { CampaignRun } from '../../types';
import type { MerchantTeamActivity } from '../../utils/merchantCampaign';
import { getMerchantBAActivityDetail } from '../../utils/merchantCampaign';

type MerchantOperation = 'profile' | 'report' | 'location' | 'calendar';

interface MerchantBAOperationsModalProps {
  isOpen: boolean;
  mode: MerchantOperation;
  activity: MerchantTeamActivity | null;
  run: CampaignRun | null;
  onClose: () => void;
}

const formatNumber = (value: number) => Number(value || 0).toLocaleString('fr-FR');
const formatDate = (value?: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

export const MerchantBAOperationsModal: React.FC<MerchantBAOperationsModalProps> = ({ isOpen, mode, activity, run, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [attendances, setAttendances] = useState<Awaited<ReturnType<typeof getMerchantBAActivityDetail>>['attendances']>([]);
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof getMerchantBAActivityDetail>>['transactions']>([]);
  const [locationMoment, setLocationMoment] = useState<'checkin' | 'checkout'>('checkin');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen || !activity) return;
    setLoading(true);
    setLocationMoment(activity.attendance?.checkout_latitude != null ? 'checkout' : 'checkin');
    void getMerchantBAActivityDetail(activity.ba.id, run?.id)
      .then(({ attendances: attendanceHistory, transactions: transactionHistory }) => {
        setAttendances(attendanceHistory);
        setTransactions(transactionHistory);
      })
      .finally(() => setLoading(false));
  }, [isOpen, activity?.ba.id, run?.id]);

  const selectedDayTransactions = useMemo(() => {
    if (!activity?.attendance) return [];
    return transactions.filter((transaction) => transaction.occurred_at.slice(0, 10) === activity.attendance?.activity_date);
  }, [activity?.attendance?.activity_date, transactions]);

  const mapCoordinates = useMemo(() => {
    const attendance = activity?.attendance;
    if (!attendance) return null;
    const latitude = locationMoment === 'checkout' ? attendance.checkout_latitude : attendance.checkin_latitude;
    const longitude = locationMoment === 'checkout' ? attendance.checkout_longitude : attendance.checkin_longitude;
    return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null;
  }, [activity?.attendance, locationMoment]);

  const calendarCells = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const days = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - startOffset + 1;
      if (day < 1 || day > days) return null;
      const iso = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = attendances.find((attendance) => attendance.activity_date === iso)?.status || 'absent';
      return { day, iso, status };
    });
  }, [attendances, calendarMonth]);

  if (!isOpen || !activity) return null;

  const attendance = activity.attendance;
  const title = mode === 'profile' ? 'Fiche Brand Ambassador' : mode === 'report' ? 'Aperçu du rapport' : mode === 'location' ? 'Localisation de pointage' : 'Registre de présence';
  const subtitle = `${activity.ba.name} · ${activity.ba.phone}`;

  const statusClass = activity.status === 'closed'
    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
    : activity.status === 'present'
      ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100'
      : 'border-red-400/35 bg-red-500/10 text-red-100';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
      <div className="modal-sheet relative w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <button onClick={onClose} className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={18}/></button>
        <div className="mb-5 flex items-start gap-3 pr-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
            {mode === 'profile' ? <UserRound size={21}/> : mode === 'report' ? <FileText size={21}/> : mode === 'location' ? <MapPin size={21}/> : <CalendarDays size={21}/>} 
          </div>
          <div><h2 className="text-lg font-black text-white">{title}</h2><p className="mt-0.5 text-[11px] font-bold uppercase text-gray-400">{subtitle}</p></div>
        </div>

        {loading ? <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement…</div> : <>
          {mode === 'profile' && <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Statut du {formatDate(attendance?.activity_date)}</p><p className="mt-1 font-black text-white">{attendance ? `Pointage ${formatTime(attendance.checkin_at)}` : 'Aucun pointage enregistré'}</p></div><span className={`rounded-xl border px-3 py-1 text-[10px] font-black uppercase ${statusClass}`}>{activity.status === 'closed' ? 'Clôturé' : activity.status === 'present' ? 'En activité' : 'Absent'}</span></div>
            <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="block text-lg text-cyan-100">{activity.visitedPosCount}</b><span className="text-[9px] font-black uppercase text-gray-500">POS</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="block text-lg text-amber-100">{activity.transactionCount}</b><span className="text-[9px] font-black uppercase text-gray-500">Transactions</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="block text-lg text-emerald-100">{formatNumber(activity.totalAmount)}</b><span className="text-[9px] font-black uppercase text-gray-500">Montant</span></div></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Dernières transactions</p>{transactions.slice(0, 4).map((transaction) => <div key={transaction.id} className="flex items-center justify-between border-t border-white/5 py-2 first:border-0"><div><p className="text-xs font-bold text-white">{transaction.point_of_sale?.denomination || 'POS Merchant'}</p><p className="text-[10px] text-gray-500">{transaction.point_of_sale?.agent_number || '—'} · Client {transaction.client_number || '—'}</p></div><b className="text-xs text-emerald-100">{formatNumber(transaction.amount)}</b></div>)}{transactions.length === 0 && <p className="text-xs text-gray-500">Aucune transaction disponible.</p>}</div>
          </div>}

          {mode === 'report' && <div className="space-y-3">
            {!attendance ? <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">Aucun rapport quotidien n’est disponible pour cette date.</div> : <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Rapport du jour</p><p className="mt-1 text-base font-black text-white">{formatDate(attendance.activity_date)}</p></div><CheckCircle2 className={attendance.status === 'closed' ? 'text-emerald-300' : 'text-cyan-200'} size={24}/></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-black/20 p-3 text-gray-300">Arrivée <b className="float-right text-white">{formatTime(attendance.checkin_at)}</b></div><div className="rounded-xl bg-black/20 p-3 text-gray-300">Clôture <b className="float-right text-white">{formatTime(attendance.checkout_at)}</b></div></div></div>
              <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="block text-lg text-cyan-100">{activity.visitedPosCount}</b><span className="text-[9px] font-black uppercase text-gray-500">POS</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="block text-lg text-amber-100">{selectedDayTransactions.length}</b><span className="text-[9px] font-black uppercase text-gray-500">Transactions</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="block text-lg text-emerald-100">{formatNumber(selectedDayTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</b><span className="text-[9px] font-black uppercase text-gray-500">Montant</span></div></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Commentaire de clôture</p><p className="mt-2 text-sm text-gray-200">{attendance.closing_comment || 'Aucun commentaire renseigné.'}</p></div>
            </>}
          </div>}

          {mode === 'location' && <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><button onClick={() => setLocationMoment('checkin')} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${locationMoment === 'checkin' ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-400'}`}>GPS arrivée</button><button onClick={() => setLocationMoment('checkout')} disabled={!attendance?.checkout_at} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${locationMoment === 'checkout' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-gray-400 disabled:opacity-40'}`}>GPS clôture</button></div>{mapCoordinates ? <div className="overflow-hidden rounded-2xl border border-white/10"><iframe title={`Carte ${activity.ba.name}`} src={`https://www.google.com/maps?q=${mapCoordinates.latitude},${mapCoordinates.longitude}&output=embed`} className="h-72 w-full border-0" loading="lazy" referrerPolicy="no-referrer"/></div> : <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-gray-400">Aucune coordonnée disponible pour ce pointage.</div>}</div>}

          {mode === 'calendar' && <div><div className="mb-4 flex items-center justify-between"><button onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200">Précédent</button><p className="text-sm font-black uppercase text-white">{calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p><button onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200">Suivant</button></div><div className="mb-1 grid grid-cols-7 gap-1">{['Lu','Ma','Me','Je','Ve','Sa','Di'].map((day) => <div key={day} className="py-1 text-center text-[9px] font-black uppercase text-gray-500">{day}</div>)}</div><div className="grid grid-cols-7 gap-1">{calendarCells.map((cell, index) => { if (!cell) return <div key={index} className="h-10"/>; const colors = cell.status === 'closed' ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100' : cell.status === 'open' ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-100' : cell.status === 'alerted' ? 'border-amber-400/40 bg-amber-500/20 text-amber-100' : 'border-white/10 bg-white/[0.04] text-gray-500'; return <div key={cell.iso} title={`${cell.iso} · ${cell.status === 'closed' ? 'Clôturé' : cell.status === 'open' ? 'Présent' : cell.status === 'alerted' ? 'Alerté' : 'Absent'}`} className={`flex h-10 items-center justify-center rounded-xl border text-xs font-black ${colors}`}>{cell.day}</div>; })}</div><div className="mt-4 flex flex-wrap justify-center gap-3 text-[9px] font-black uppercase text-gray-400"><span>Vert · Clôturé</span><span>Bleu · Présent</span><span>Ambre · Alerté</span><span>Gris · Absent</span></div></div>}
        </>}
      </div>
    </div>,
    document.body
  );
};
