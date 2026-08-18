import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, MapPin, RefreshCw, Search } from 'lucide-react';
import type { CampaignRun } from '../types';
import { getActiveCampaignRuns, getMerchantArchives, getMerchantCampaign, type MerchantArchiveSummary } from '../utils/merchantCampaign';

const todayIso = () => new Date().toISOString().slice(0, 10);
const mondayIso = () => {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().slice(0, 10);
};

function mapUrl(latitude?: number | null, longitude?: number | null) {
  return typeof latitude === 'number' && typeof longitude === 'number' ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
}

export const MerchantSupervisorArchivesView: React.FC = () => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [archives, setArchives] = useState<MerchantArchiveSummary[]>([]);
  const [startDate, setStartDate] = useState(mondayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      setRun(activeRun);
      setArchives(activeRun ? await getMerchantArchives(activeRun.id, startDate, endDate) : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement des archives Merchant impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [startDate, endDate]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return archives.filter((item) => !needle || `${item.ba.name} ${item.ba.phone} ${item.attendance.activity_date} ${item.attendance.closing_comment || ''}`.toLowerCase().includes(needle));
  }, [archives, query]);
  const totals = useMemo(() => ({
    reports: archives.length,
    pos: archives.reduce((total, item) => total + item.visitedPosCount, 0),
    transactions: archives.reduce((total, item) => total + item.transactionCount, 0),
    amount: archives.reduce((total, item) => total + item.totalAmount, 0),
  }), [archives]);

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement des archives Merchant…</div>;

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card relative overflow-hidden p-4"><div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-400/[0.08] blur-3xl" /><div className="relative flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Archives de rapports</p><h1 className="mt-1 text-xl font-black">Merchant Educational Campaign</h1><p className="mt-1 text-xs text-gray-400">{run?.name || 'Vague active'} · journées clôturées et preuves terrain</p></div><button onClick={() => void load()} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-300"><RefreshCw size={17}/></button></div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-white">{totals.reports}</b><span className="text-[8px] font-black uppercase text-gray-500">Rapports</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-cyan-100">{totals.pos}</b><span className="text-[8px] font-black uppercase text-gray-500">POS</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-amber-100">{totals.transactions}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-emerald-100">{totals.amount.toLocaleString('fr-FR')}</b><span className="text-[8px] font-black uppercase text-gray-500">Montant</span></div></div></section>
      {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}
      <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-2"><CalendarDays className="text-amber-200" size={19}/><div><h2 className="font-black">Période de consultation</h2><p className="text-xs text-gray-400">Filtrez les rapports journaliers réellement clôturés.</p></div></div><div className="grid grid-cols-2 gap-2"><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="app-input rounded-2xl px-3 py-3 text-sm"/><input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="app-input rounded-2xl px-3 py-3 text-sm"/></div><div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BA, téléphone, date ou commentaire" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div></section>
      <section className="space-y-3">{filtered.map((item) => { const arrival = item.attendance.checkin_at ? new Date(item.attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; const departure = item.attendance.checkout_at ? new Date(item.attendance.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; const arrivalMap = mapUrl(item.attendance.checkin_latitude, item.attendance.checkin_longitude); const departureMap = mapUrl(item.attendance.checkout_latitude, item.attendance.checkout_longitude); return <article key={item.attendance.id} className="glass-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">{new Date(`${item.attendance.activity_date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h3 className="mt-1 font-black text-white">{item.ba.name}</h3><p className="mt-0.5 text-xs text-gray-400">{item.ba.phone} · {arrival} → {departure}</p></div><span className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-200"><CheckCircle2 size={14}/>Clôturé</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-cyan-100">{item.visitedPosCount}</b><span className="text-[8px] font-black uppercase text-gray-500">POS</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-amber-100">{item.transactionCount}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-emerald-100">{item.totalAmount.toLocaleString('fr-FR')}</b><span className="text-[8px] font-black uppercase text-gray-500">Montant</span></div></div>{item.attendance.closing_comment && <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-gray-300"><div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase text-gray-500"><ClipboardList size={13}/>Commentaire BA</div>{item.attendance.closing_comment}</div>}<div className="mt-3 flex flex-wrap gap-2">{arrivalMap && <a href={arrivalMap} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-cyan-100"><MapPin size={12}/>GPS arrivée</a>}{departureMap && <a href={departureMap} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-emerald-100"><MapPin size={12}/>GPS clôture</a>}</div></article>; })}{filtered.length === 0 && <div className="glass-card p-7 text-center"><ClipboardList className="mx-auto text-gray-500" size={26}/><h2 className="mt-3 font-black">Aucun rapport clôturé</h2><p className="mt-1 text-xs text-gray-400">Les archives apparaîtront après la clôture d’une journée BA dans la période sélectionnée.</p></div>}</section>
    </div>
  );
};
