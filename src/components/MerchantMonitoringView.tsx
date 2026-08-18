import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Circle, FileText, MapPin, RefreshCw, Search, UserRound, UsersRound, XCircle } from 'lucide-react';
import type { CampaignRun } from '../types';
import { getActiveCampaignRuns, getMerchantCampaign, getMerchantMonitoring, type MerchantTeamActivity } from '../utils/merchantCampaign';
import { DateIconPicker } from './DateIconPicker';
import { MerchantBAOperationsModal } from './Modals/MerchantBAOperationsModal';

type MerchantOperation = 'profile' | 'report' | 'location' | 'calendar';
const todayIso = () => new Date().toISOString().slice(0, 10);

export const MerchantMonitoringView: React.FC = () => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [date, setDate] = useState(todayIso());
  const [team, setTeam] = useState<MerchantTeamActivity[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'absent' | 'present' | 'closed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<{ mode: MerchantOperation; activity: MerchantTeamActivity } | null>(null);

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

  const actionButton = (item: MerchantTeamActivity, mode: MerchantOperation, label: string, Icon: React.ElementType, enabled = true) => (
    <button key={mode} type="button" onClick={() => enabled && setOperation({ mode, activity: item })} disabled={!enabled} title={label} className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${enabled ? 'border-white/10 bg-white/[0.05] text-gray-200 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100' : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-gray-600'}`}><Icon size={16}/></button>
  );

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement du monitoring Merchant…</div>;

  return <div className="space-y-4 pb-4">
    <section className="glass-card relative overflow-hidden p-4 sm:p-5"><div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-cyan-400/[0.08] blur-3xl"/><div className="relative flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Pilotage opérationnel</p><h1 className="mt-1 text-xl font-black">Merchant Educational Campaign</h1><p className="mt-1 text-xs text-gray-400">Suivi quotidien des Brand Ambassadors</p></div><button onClick={() => void load()} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-300 transition hover:bg-white/10" title="Actualiser le monitoring"><RefreshCw size={17}/></button></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-3"><b className="block text-lg font-black text-cyan-100">{metrics.present}</b><span className="text-[9px] font-black uppercase text-gray-400">En activité</span></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3"><b className="block text-lg font-black text-emerald-200">{metrics.closed}</b><span className="text-[9px] font-black uppercase text-gray-400">Clôturés</span></div><div className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-3"><b className="block text-lg font-black text-red-200">{metrics.absent}</b><span className="text-[9px] font-black uppercase text-gray-400">Absents</span></div></div></section>
    {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}
    <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-3"><UsersRound className="text-cyan-200" size={20}/><div><h2 className="font-black">Équipe et performances</h2><p className="text-xs text-gray-400">{metrics.visited} POS visités · {metrics.transactions} transactions pour la date sélectionnée.</p></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(15rem,auto)_1fr]"><div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-1"><DateIconPicker value={date} onChange={setDate} className="flex min-w-0 flex-1 items-center" buttonClassName="h-10 w-10 shrink-0 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100 transition hover:bg-cyan-400/15" labelClassName="truncate text-[10px] font-black uppercase text-gray-200" popoverAlign="left"/><button type="button" onClick={() => setDate(todayIso())} className={`ml-2 rounded-xl border px-2.5 py-2 text-[9px] font-black uppercase transition ${date === todayIso() ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'}`}>Aujourd’hui</button></div><div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un BA ou un téléphone" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div></div><div className="flex gap-2 overflow-x-auto pb-1">{([{ id: 'all', label: 'Tous' }, { id: 'present', label: 'En activité' }, { id: 'closed', label: 'Clôturés' }, { id: 'absent', label: 'Absents' }] as const).map((filter) => <button key={filter.id} onClick={() => setStatus(filter.id)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${status === filter.id ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-400'}`}>{filter.label}</button>)}</div></section>
    <section className="space-y-3">{filteredTeam.map((item) => { const info = statusInfo(item); const checkin = item.attendance?.checkin_at ? new Date(item.attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; const checkout = item.attendance?.checkout_at ? new Date(item.attendance.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; const hasGps = typeof item.attendance?.checkin_latitude === 'number' || typeof item.attendance?.checkout_latitude === 'number'; return <article key={item.ba.id} className="glass-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black text-white">{item.ba.name}</h3><p className="mt-0.5 text-xs text-gray-400">{item.ba.phone}</p></div><div className="flex shrink-0 items-center gap-1.5">{actionButton(item, 'profile', 'Détail du BA', UserRound)}{actionButton(item, 'report', 'Aperçu du rapport', FileText, Boolean(item.attendance))}{actionButton(item, 'location', 'Localisation du pointage', MapPin, hasGps)}{actionButton(item, 'calendar', 'Registre de présence', CalendarDays)}<span className={`ml-1 inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase ${info.className}`}>{info.icon}{info.label}</span></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-cyan-100">{item.visitedPosCount}</b><span className="text-[8px] font-black uppercase text-gray-500">POS</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-amber-100">{item.transactionCount}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions</span></div><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2"><b className="block text-sm text-emerald-100">{item.totalAmount.toLocaleString('fr-FR')}</b><span className="text-[8px] font-black uppercase text-gray-500">Montant</span></div></div>{item.attendance && <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-gray-400"><span>Arrivée {checkin}</span><span className="text-white/20">•</span><span>Clôture {checkout}</span><button onClick={() => setOperation({ mode: 'location', activity: item })} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-cyan-100 transition hover:bg-cyan-400/10">Voir la carte</button></div>}</article>; })}{filteredTeam.length === 0 && <div className="glass-card p-6 text-center text-sm text-gray-400">Aucun Brand Ambassador ne correspond aux filtres sélectionnés.</div>}</section>
    <MerchantBAOperationsModal isOpen={Boolean(operation)} mode={operation?.mode || 'profile'} activity={operation?.activity || null} run={run} onClose={() => setOperation(null)}/>
  </div>;
};
