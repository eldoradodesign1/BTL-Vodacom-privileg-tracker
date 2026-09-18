import React, { useEffect, useMemo, useState } from 'react';
import { Archive, BarChart3, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, MapPin, RefreshCw, Trophy, UsersRound, Zap, Target, Settings2, ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { User } from '../types';
import {
  getMikiliCampaign,
  getMikiliCampaignClients,
  getMikiliPodium,
  getMikiliSupervisorRegions,
  getMikiliTargets,
  getMikiliTeam,
  mikiliTodayIso,
  saveMikiliTargets,
  type MikiliClient,
  type MikiliPodiumEntry,
  type MikiliRegion,
  type MikiliTeamMember,
  type MikiliTargets,
} from '../utils/mpesaMikili';
import { DateIconPicker } from './DateIconPicker';

interface Props {
  currentUser: User;
  activeTab: 'home' | 'tab2' | 'tab3' | 'chat' | 'pos' | 'admin';
}

const rankClasses = [
  'border-amber-300/35 bg-amber-400/[0.12] text-amber-100',
  'border-slate-200/25 bg-slate-200/[0.08] text-slate-100',
  'border-orange-300/25 bg-orange-500/[0.08] text-orange-100',
];

const START_DATE = '2026-09-01';
const CHART_COLORS = ['#ef4444', '#22c55e', '#f59e0b', '#38bdf8', '#a78bfa'];
const dayLabel = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });

export const MpesaMikiliManagementView: React.FC<Props> = ({ currentUser, activeTab }) => {
  const today = mikiliTodayIso();
  const [campaignId, setCampaignId] = useState('');
  const [date, setDate] = useState(today);
  const [team, setTeam] = useState<MikiliTeamMember[]>([]);
  const [podium, setPodium] = useState<MikiliPodiumEntry[]>([]);
  const [archiveClients, setArchiveClients] = useState<MikiliClient[]>([]);
  const [regions, setRegions] = useState<MikiliRegion[]>([]);
  const [periodClients, setPeriodClients] = useState<MikiliClient[]>([]);
  const [targets, setTargets] = useState<MikiliTargets>({ dailyClients: 0, dailyTransactions: 0 });
  const [draftTargets, setDraftTargets] = useState<MikiliTargets>({ dailyClients: 0, dailyTransactions: 0 });
  const [savingTargets, setSavingTargets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const isSupervisor = currentUser.role === 'supervisor' || currentUser.role === 'sub_admin';
  const isGlobal = !isSupervisor || currentUser.role === 'sub_admin';

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const campaign = await getMikiliCampaign();
      if (!campaign) throw new Error('La campagne M-Pesa Mikili est introuvable.');
      setCampaignId(campaign.id);
      const scopeRegions = isSupervisor && currentUser.role !== 'sub_admin'
        ? await getMikiliSupervisorRegions(campaign.id, currentUser.id)
        : [];
      setRegions(scopeRegions);
      const [nextTeam, nextPodium, nextTargets, nextClients] = await Promise.all([
        getMikiliTeam(campaign.id, date, isSupervisor && currentUser.role !== 'sub_admin' ? { supervisorId: currentUser.id, regions: scopeRegions } : {}),
        getMikiliPodium(campaign.id, date, 10),
        getMikiliTargets(campaign.id),
        getMikiliCampaignClients(campaign.id, START_DATE, today),
      ]);
      const teamIds = new Set(nextTeam.map((member) => member.userId));
      const scopedClients = isSupervisor && currentUser.role !== 'sub_admin' ? nextClients.filter((client) => teamIds.has(client.agent_id)) : nextClients;
      setTeam(nextTeam);
      setPodium(nextPodium);
      setTargets(nextTargets);
      setDraftTargets(nextTargets);
      setPeriodClients(scopedClients);
      setArchiveClients(scopedClients);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement M-Pesa Mikili impossible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, [date, currentUser.id, activeTab]);

  const metrics = useMemo(() => {
    const present = team.filter((item) => Boolean(item.attendance?.checkin_at)).length;
    const closed = team.filter((item) => Boolean(item.attendance?.checkout_at)).length;
    const clients = team.reduce((sum, item) => sum + item.clients, 0);
    const transactions = team.reduce((sum, item) => sum + item.transactions, 0);
    return { present, closed, absent: Math.max(0, team.length - present), clients, transactions, conversion: clients ? Math.round((transactions / clients) * 100) : 0 };
  }, [team]);

  const regionSummary = useMemo(() => {
    const map = new Map<string, { clients: number; transactions: number }>();
    team.forEach((member) => member.locations.filter((item) => ['Kinshasa', 'Kongo-Central', 'Haut-Katanga'].includes(item)).forEach((region) => {
      const row = map.get(region) || { clients: 0, transactions: 0 };
      row.clients += member.clients;
      row.transactions += member.transactions;
      map.set(region, row);
    }));
    return Array.from(map.entries()).sort((a, b) => b[1].transactions - a[1].transactions);
  }, [team]);

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; clients: number; transactions: number }>();
    const cursor = new Date(START_DATE + 'T12:00:00');
    const end = new Date(today + 'T12:00:00');
    while (cursor <= end) {
      const iso = cursor.toISOString().slice(0, 10);
      map.set(iso, { date: iso, clients: 0, transactions: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    periodClients.forEach((item) => {
      const row = map.get(item.activity_date);
      if (row) { row.clients += 1; if (item.transaction_done) row.transactions += 1; }
    });
    return Array.from(map.values()).map((row) => ({ ...row, label: row.date.slice(8) + '/' + row.date.slice(5, 7) }));
  }, [periodClients, today]);

  const selectedDayClients = useMemo(() => periodClients.filter((item) => item.activity_date === date), [periodClients, date]);

  const donutData = useMemo(() => ({
    transactions: [
      { name: 'Transactions', value: selectedDayClients.filter((x) => x.transaction_done).length },
      { name: 'Sans transaction', value: selectedDayClients.filter((x) => !x.transaction_done).length },
    ],
    interactions: [
      { name: 'Envoi', value: selectedDayClients.filter((x) => x.presented_service === 'send' || x.presented_service === 'both').length },
      { name: 'Réception', value: selectedDayClients.filter((x) => x.presented_service === 'receive' || x.presented_service === 'both').length },
    ],
    clients: [
      { name: 'Déjà utilisateur', value: selectedDayClients.filter((x) => x.existing_mikili_user === 'yes').length },
      { name: 'Non utilisateur', value: selectedDayClients.filter((x) => x.existing_mikili_user === 'no').length },
      { name: 'Ne connaît pas', value: selectedDayClients.filter((x) => x.existing_mikili_user === 'unknown').length },
    ],
  }), [selectedDayClients]);

  const saveTargets = async () => {
    if (!campaignId) return;
    setSavingTargets(true);
    setError('');
    try { await saveMikiliTargets(campaignId, draftTargets); setTargets(draftTargets); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer les objectifs.'); }
    finally { setSavingTargets(false); }
  };

  const transactionBreakdown = useMemo(() => {
    const source = activeTab === 'tab3' ? archiveClients.filter((item) => item.activity_date === date) : [];
    return {
      send: source.filter((item) => item.transaction_done && (item.transaction_type === 'send' || item.transaction_type === 'both')).length,
      receive: source.filter((item) => item.transaction_done && (item.transaction_type === 'receive' || item.transaction_type === 'both')).length,
    };
  }, [archiveClients, date, activeTab]);

  if (loading) return <div className="glass-card p-7 text-center text-xs font-black uppercase tracking-[0.18em] text-gray-400">Chargement du cockpit M-Pesa Mikili…</div>;

  return (
    <div className="space-y-4 pb-6">
      {error && <div className="glass-card flex items-center gap-2 border border-red-400/30 bg-red-500/[0.08] p-3 text-xs font-bold text-red-100"><CircleAlert size={16}/>{error}</div>}

      <section className="relative overflow-hidden rounded-[2rem] border border-red-300/15 bg-gradient-to-br from-red-500/[0.22] via-white/[0.05] to-transparent p-5 shadow-2xl shadow-red-950/25">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/20 blur-3xl"/>
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-red-200">M-Pesa Mikili · pilotage</p>
            <h1 className="mt-1 text-2xl font-black text-white">{isSupervisor ? 'Mon équipe terrain' : 'Cockpit opérationnel'}</h1>
            <p className="mt-1 text-[10px] font-semibold text-gray-400">{isSupervisor && regions.length ? regions.join(' · ') : 'Sensibilisation et transactions hors boutique'}</p>
          </div>
          <button type="button" onClick={() => void load(false)} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-gray-200 transition hover:bg-white/10 active:scale-95" title="Actualiser"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''}/></button>
        </div>
        <div className="relative mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 p-2">
          <DateIconPicker value={date} min={START_DATE} max={today} onChange={setDate} className="flex min-w-0 flex-1 items-center" buttonClassName="h-10 w-10 shrink-0 rounded-xl border border-red-300/20 bg-red-500/10 text-red-100" labelClassName="truncate text-[10px] font-black uppercase text-gray-200"/>
          <button type="button" onClick={() => setDate(today)} className={date === today ? 'rounded-xl border border-red-300/50 bg-red-500/20 px-3 py-2 text-[9px] font-black uppercase text-red-100' : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-gray-400'}>Aujourd’hui</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['BA actifs', metrics.present, UsersRound, 'text-cyan-100'],
          ['Clients', metrics.clients, UsersRound, 'text-white'],
          ['Transactions', metrics.transactions, Zap, 'text-emerald-200'],
          ['Conversion', metrics.conversion + '%', BarChart3, 'text-amber-100'],
        ].map(([label, value, Icon, tone]) => {
          const IconComponent = Icon as React.ElementType;
          return <div key={String(label)} className="glass-card relative overflow-hidden p-3"><IconComponent size={15} className={String(tone)}/><b className="mt-2 block text-xl font-black text-white">{value as React.ReactNode}</b><span className="text-[8px] font-black uppercase tracking-wider text-gray-500">{label}</span></div>;
        })}
      </section>

      {activeTab === 'home' && <>
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['BA présents', metrics.present, UsersRound, 'text-cyan-100'],
            ['Clients', metrics.clients, UsersRound, 'text-white'],
            ['Transactions', metrics.transactions, Zap, 'text-emerald-200'],
            ['Conversion', metrics.conversion + '%', BarChart3, 'text-amber-100'],
          ].map(([label, value, Icon, tone]) => { const I = Icon as React.ElementType; return <div key={String(label)} className="glass-card p-3"><I size={15} className={String(tone)}/><b className="mt-2 block text-xl font-black text-white">{value as React.ReactNode}</b><span className="text-[8px] font-black uppercase tracking-wider text-gray-500">{label}</span></div>; })}
        </section>

        <section className="glass-card overflow-hidden p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Progression</p><h2 className="mt-1 text-lg font-black text-white">Le terrain depuis le 1er septembre</h2></div><ArrowUpRight size={20} className="text-cyan-200"/></div>
          <div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.07)"/><XAxis dataKey="label" tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#11141d',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,fontSize:11}}/><Line type="monotone" dataKey="clients" name="Clients" stroke="#ef4444" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="transactions" name="Transactions" stroke="#22c55e" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          donuts
        </section>

        <section className="glass-card overflow-hidden p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-200/80">Podium du jour</p><h2 className="mt-1 text-lg font-black text-white">La course Mikili</h2></div><Trophy size={21} className="text-amber-200"/></div>
          <div className="mt-3 grid grid-cols-3 gap-2">{[0,1,2].map((index) => { const entry=podium[index]; return <div key={entry?.userId || index} className={rankClasses[index] + ' min-h-24 rounded-2xl border p-3'}><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/15 text-[10px] font-black">{index+1}</span><b className="mt-2 block truncate text-[10px]">{entry?.name?.split(' ')[0] || '—'}</b><span className="mt-1 block text-[9px] font-bold opacity-80">{entry ? entry.transactions + ' Tx · ' + entry.clients + ' clients' : 'À saisir'}</span></div>; })}</div>
        </section>
      </>      {activeTab === 'tab2' && <>
        <section className="glass-card p-4"><div className="flex items-center gap-2"><UsersRound size={19} className="text-red-200"/><div><h2 className="font-black text-white">Monitoring M-Pesa Mikili</h2><p className="text-[9px] text-gray-500">{dayLabel(date)} · {team.length} BA affectés à la campagne</p></div></div></section>
        <section className="space-y-2">{team.map((member) => {
          const status = member.attendance?.checkout_at ? 'Clôturé' : member.attendance?.checkin_at ? 'En action' : 'Absent';
          return <article key={member.userId} className="glass-card overflow-hidden p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black text-white">{member.name}</h3><p className="mt-0.5 text-[10px] text-gray-500">{member.phone}</p><p className="mt-1 text-[9px] font-bold text-red-200">{member.locations.filter((item) => ['Kinshasa','Kongo-Central','Haut-Katanga'].includes(item)).join(' · ') || 'Lieu non renseigné'}</p></div><span className={status === 'Clôturé' ? 'rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-200' : status === 'En action' ? 'rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-100' : 'rounded-full border border-red-300/20 bg-red-500/10 px-2 py-1 text-[8px] font-black uppercase text-red-200'}>{status}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"><b className="block text-lg text-white">{member.clients}</b><span className="text-[8px] font-black uppercase text-gray-500">Clients</span></div><div className="rounded-2xl border border-emerald-300/10 bg-emerald-500/[0.04] p-3"><b className="block text-lg text-emerald-200">{member.transactions}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions</span></div></div><div className="mt-3 flex items-center justify-between text-[9px] text-gray-500"><span>{member.attendance?.checkin_at ? 'Arrivée ' + new Date(member.attendance.checkin_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'Pas de pointage'}</span><ChevronRight size={14}/></div></article>;
        })}</section>
      </>}

      {activeTab === 'tab3' && <>
        <section className="glass-card p-4"><div className="flex items-center gap-2"><Archive size={19} className="text-fuchsia-200"/><div><h2 className="font-black text-white">Archives Mikili</h2><p className="text-[9px] text-gray-500">{archiveClients.length} interactions chargées · date d’analyse {dayLabel(date)}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white/[0.04] p-3"><b className="block text-lg text-white">{archiveClients.filter((item) => item.activity_date === date).length}</b><span className="text-[8px] font-black uppercase text-gray-500">Clients du jour</span></div><div className="rounded-2xl bg-emerald-500/[0.05] p-3"><b className="block text-lg text-emerald-200">{archiveClients.filter((item) => item.activity_date === date && item.transaction_done).length}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions du jour</span></div></div></section>
        <section className="glass-card p-4"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Synthèse transactions</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-red-300/15 bg-red-500/[0.06] p-3"><b className="block text-xl text-red-100">{transactionBreakdown.send}</b><span className="text-[8px] font-black uppercase text-gray-500">Envois</span></div><div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.06] p-3"><b className="block text-xl text-cyan-100">{transactionBreakdown.receive}</b><span className="text-[8px] font-black uppercase text-gray-500">Réceptions</span></div></div></section>
        <section className="space-y-2">{archiveClients.filter((item) => item.activity_date === date).slice(0, 100).map((item) => <article key={item.id} className="glass-card p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><b className="block truncate text-xs text-white">{item.client_name}</b><span className="text-[9px] text-gray-500">{item.client_phone} · {item.location?.name || 'Lieu non renseigné'}</span></div><span className={item.transaction_done ? 'rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-200' : 'rounded-full bg-white/5 px-2 py-1 text-[8px] font-black uppercase text-gray-500'}>{item.transaction_done ? 'Transaction' : 'Sensibilisé'}</span></div></article>)}</section>
      </>}

      {activeTab === 'admin' && <>
        <section className="glass-card p-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-200">Campagne active</p><h2 className="mt-1 text-2xl font-black text-white">M-Pesa Mikili</h2><p className="mt-2 text-xs leading-relaxed text-gray-400">Cette interface utilise exclusivement les affectations M-Pesa Mikili, ses pointages, ses lieux terrain et ses interactions clients. Aucun chiffre Privilège / Hôtesse n’est injecté ici.</p></section>
        <section className="glass-card p-4"><div className="flex items-center justify-between"><div><h2 className="font-black text-white">Population campagne</h2><p className="text-[9px] text-gray-500">{team.length} BA affectés sur le périmètre affiché.</p></div><CheckCircle2 size={19} className="text-emerald-200"/></div><div className="mt-3 space-y-2">{regionSummary.length ? regionSummary.map(([region, stats]) => <div key={region} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-3"><span className="text-[10px] font-black uppercase text-gray-300">{region}</span><span className="text-[9px] font-bold text-gray-500">{stats.clients} clients · {stats.transactions} Tx</span></div>) : <p className="rounded-2xl bg-white/[0.03] p-4 text-[10px] font-semibold text-gray-500">Les régions apparaîtront dès que les premières interactions terrain seront enregistrées.</p>}</div></section>
      </>}
    </div>
  );
};
export default MpesaMikiliManagementView;
