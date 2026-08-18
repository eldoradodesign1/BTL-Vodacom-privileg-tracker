import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, MapPin, RefreshCw, Search, UsersRound, XCircle } from 'lucide-react';
import type { CampaignRun } from '../types';
import { getActiveCampaignRuns, getMerchantCampaign, getMerchantMonitoring, type MerchantTeamActivity } from '../utils/merchantCampaign';

const todayIso = () => new Date().toISOString().slice(0, 10);

function openMap(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
  window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank', 'noopener,noreferrer');
}

export const MerchantMonitoringView: React.FC = () => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [date, setDate] = useState(todayIso());
  const [team, setTeam] = useState<MerchantTeamActivity[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'absent' | 'present' | 'closed'>('all');
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
      setTeam(activeRun ? await getMerchantMonitoring(activeRun.id, date) : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement du monitoring impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [date]);

  const filteredTeam = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return team.filter((item) => {
      const matchesStatus = status === 'all' || item.status === status;
      const haystack = `${item.ba.name} ${item.ba.phone}`.toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [query, status, team]);

  const metrics = useMemo(() => ({
    present: team.filter((item) => item.status === 'present').length,
    closed: team.filter((item) => item.status === 'closed').length,
    absent: team.filter((item) => item.status === 'absent').length,
    visited: team.reduce((total, item) => total + item.visitedPosCount, 0),
    transactions: team.reduce((total, item) => total + item.transactionCount, 0),
  }), [team]);

  const statusInfo = (item: MerchantTeamActivity) => {
    if (item.status === 'closed') return { label: 'Clôturé', icon: <CheckCircle2 size={15}/>, className: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200' };
    if (item.status === 'present') return { label: 'En activité', icon: <Circle size={13} className="fill-current"/>, className: 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100' };
    return { label: 'Absent', icon: <XCircle size={15}/>, className: 'border-red-400/35 bg-red-500/10 text-red-200' };
  };

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement du monitoring Merchant…</div>;

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="relative flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Monitoring terrain</p><h1 className="mt-1 text-xl font-black">Merchant Educational Campaign</h1><p className="mt-1 text-xs text-gray-400">{run?.name || 'Vague active'} · suivi quotidien des Brand Ambassadors</p></div><button onClick={() => void load()} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-300"><RefreshCw size={17}/></button></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-3"><b className="block text-lg font-black text-cyan-100">{metrics.present}</b><span className="text-[9px] font-black uppercase text-gray-400">En activité</span></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3"><b className="block text-lg font-black text-emerald-200">{metrics.closed}</b><span className="text-[9px] font-black uppercase text-gray-400">Clôturés</span></div><div className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-3"><b className="block text-lg font-black text-red-200">{metrics.absent}</b><span className="text-[9px] font-black uppercase text-gray-400">Absents</span></div></div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}

      <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-3"><UsersRound className="text-cyan-200" size={20}/><div><h2 className="font-black">Équipe et performances</h2><p className="text-xs text-gray-400">{metrics.visited} POS visités · {metrics.transactions} transactions pour la date sélectionnée.</p></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="app-input rounded-2xl px-3 py-3 text-sm"/><div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un BA ou un téléphone" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div></div><div className="flex gap-2 overflow-x-auto pb-1">{([{ id: 'all', label: 'Tous' }, { id: 'present', label: 'En activité' }, { id: 'closed', label: 'Clôturés' }, { id: 'absent', label: 'Absents' }] as const).map((filter) => <button key={filter.id} onClick={() => setStatus(filter.id)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${status === filter.id ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-400'}`}>{filter.label}</button>)}</div></section>

      <section className="space-y-3">{filteredTeam.map((item) => { const info = statusInfo(item); const checkin = item.attendance?.checkin_at ? new Date(item.attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; const checkout = item.attendance?.checkout_at ? new Date(item.attendance.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; return <article key={item.ba.id} className="glass-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-white">{item.ba.name}</h3><p className="mt-0.5 text-xs text-gray-400">{item.ba.phone}</p></div><span className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase ${info.className}`}>{info.icon}{info.label}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-cyan-100">{item.visitedPosCount}</b><span className="text-[8px] font-black uppercase text-gray-500">POS</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-amber-100">{item.transactionCount}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-emerald-100">{item.totalAmount.toLocaleString('fr-FR')}</b><span className="text-[8px] font-black uppercase text-gray-500">Montant</span></div></div>{item.attendance && <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-400"><span>Arrivée {checkin}</span><span className="text-white/20">•</span><span>Clôture {checkout}</span>{typeof item.attendance.checkin_latitude === 'number' && <button onClick={() => openMap(item.attendance?.checkin_latitude, item.attendance?.checkin_longitude)} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-cyan-100"><MapPin size={12}/>GPS arrivée</button>}{typeof item.attendance.checkout_latitude === 'number' && <button onClick={() => openMap(item.attendance?.checkout_latitude, item.attendance?.checkout_longitude)} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-emerald-100"><MapPin size={12}/>GPS clôture</button>}</div>}</article>; })}{filteredTeam.length === 0 && <div className="glass-card p-6 text-center text-sm text-gray-400">Aucun Brand Ambassador ne correspond aux filtres sélectionnés.</div>}</section>
    </div>
  );
};
