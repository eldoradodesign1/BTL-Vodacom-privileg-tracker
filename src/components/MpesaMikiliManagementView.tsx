import React, { useEffect, useMemo, useState } from 'react';
import { Archive, BarChart3, FileText, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, MapPin, RefreshCw, Trophy, UsersRound, Zap, Target, Settings2, ArrowUpRight } from 'lucide-react';
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
  const [monitorSection, setMonitorSection] = useState<'agents' | 'presence' | 'checkins' | 'reports'>('agents');
  const isSupervisor = currentUser.role === 'supervisor';

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

      {activeTab === 'home' && <>
        <section className="relative overflow-hidden rounded-[2rem] border border-red-300/15 bg-gradient-to-br from-red-500/[0.20] via-white/[0.05] to-transparent p-5 shadow-2xl shadow-red-950/20">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/20 blur-3xl"/>
          <div className="relative flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-red-200">M-Pesa Mikili · pilotage</p><h1 className="mt-1 text-3xl font-black tracking-tight text-white">{isSupervisor ? 'Mon équipe terrain' : 'Cockpit Mikili'}</h1><p className="mt-1 text-[10px] font-semibold text-gray-400">{isSupervisor && regions.length ? regions.join(' · ') : 'Pilotage de la sensibilisation et des transactions'}</p></div><button type="button" onClick={() => void load(false)} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-gray-200 transition hover:bg-white/10 active:scale-95" title="Actualiser"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''}/></button></div>
          <div className="relative mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 p-2"><DateIconPicker value={date} min={START_DATE} max={today} onChange={setDate} className="flex min-w-0 flex-1 items-center" buttonClassName="h-10 w-10 shrink-0 rounded-xl border border-red-300/20 bg-red-500/10 text-red-100" labelClassName="truncate text-[10px] font-black uppercase text-gray-200"/><button type="button" onClick={() => setDate(today)} className={date === today ? 'rounded-xl border border-red-300/50 bg-red-500/20 px-3 py-2 text-[9px] font-black uppercase text-red-100' : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase text-gray-400'}>Aujourd’hui</button></div>
        </section>
        <section className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.025] px-4 py-3">
          <div className="flex items-stretch divide-x divide-white/10 overflow-x-auto">{[['Présents',metrics.present,UsersRound,'text-cyan-100'],['Clients',metrics.clients,UsersRound,'text-white'],['Transactions',metrics.transactions,Zap,'text-emerald-200'],['Conversion',metrics.conversion+'%',BarChart3,'text-amber-100']].map(([label,value,Icon,tone])=>{const I=Icon as React.ElementType;return <div key={String(label)} className="min-w-[105px] flex-1 px-3 first:pl-0 last:pr-0"><div className="flex items-center gap-2"><I size={14} className={String(tone)}/><span className="text-[8px] font-black uppercase tracking-[0.16em] text-gray-500">{label}</span></div><b className="mt-1 block text-2xl font-black text-white">{value as React.ReactNode}</b></div>})}</div>
        </section>
        <section className="glass-card overflow-hidden p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Progression</p><h2 className="mt-1 text-lg font-black text-white">Le terrain depuis le 1er septembre</h2></div><ArrowUpRight size={20} className="text-cyan-200"/></div>
          <div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.07)"/><XAxis dataKey="label" tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#11141d',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,fontSize:11}}/><Line type="monotone" dataKey="clients" name="Clients" stroke="#ef4444" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="transactions" name="Transactions" stroke="#22c55e" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[
            ['Transactions', donutData.transactions],
            ['Types d’interactions', donutData.interactions],
            ['Profil des clients', donutData.clients],
          ].map(([title, data]) => {
            const values = data as Array<{ name: string; value: number }>;
            return <div key={String(title)} className="glass-card min-w-0 overflow-hidden p-4">
              <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">{title as React.ReactNode}</p><p className="mt-1 text-[9px] text-gray-600">{selectedDayClients.length} interactions · {dayLabel(date)}</p></div><BarChart3 size={17} className="text-red-200"/></div>
              <div className="relative mt-1 h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={values} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={3} stroke="none">{values.map((entry,index)=><Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:'#11141d',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,fontSize:11}}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="text-xl font-black text-white">{values.reduce((sum,item)=>sum+item.value,0)}</b><span className="text-[8px] font-black uppercase text-gray-500">Total</span></div></div>
              <div className="flex flex-wrap justify-center gap-2">{values.map((item,index)=><span key={item.name} className="text-[8px] font-bold text-gray-500"><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{background:CHART_COLORS[index % CHART_COLORS.length]}}/>{item.name} · {item.value}</span>)}</div>
            </div>;
          })}
        </section>

        <section className="glass-card overflow-hidden p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-200/80">Podium du jour</p><h2 className="mt-1 text-lg font-black text-white">La course Mikili</h2></div><Trophy size={21} className="text-amber-200"/></div>
          <div className="mt-3 grid grid-cols-3 gap-2">{[0,1,2].map((index) => { const entry=podium[index]; return <div key={entry?.userId || index} className={rankClasses[index] + ' min-h-24 rounded-2xl border p-3'}><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/15 text-[10px] font-black">{index+1}</span><b className="mt-2 block truncate text-[10px]">{entry?.name?.split(' ')[0] || '—'}</b><span className="mt-1 block text-[9px] font-bold opacity-80">{entry ? entry.transactions + ' Tx · ' + entry.clients + ' clients' : 'À saisir'}</span></div>; })}</div>
        </section>
      </>}

      {activeTab === 'tab2' && <>
        <section className="flex items-center justify-between gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-2"><UsersRound size={18} className="text-red-200"/><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-500">Monitoring Mikili</p><h2 className="mt-0.5 text-sm font-black text-white">{dayLabel(date)} · {team.length} BA</h2></div></div><DateIconPicker value={date} min={START_DATE} max={today} onChange={setDate} className="flex min-w-0 items-center" buttonClassName="h-9 w-9 shrink-0 rounded-xl border border-red-300/20 bg-red-500/10 text-red-100" labelClassName="hidden sm:block truncate text-[9px] font-black uppercase text-gray-300"/></section>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[
            ['agents','Détail agent',UsersRound],['presence','Registre de présence',CheckCircle2],['checkins','Pointage journalier',MapPin],['reports','Rapports',Archive]
          ].map(([key,label,Icon]) => { const I=Icon as React.ElementType; const active=monitorSection===key; return <button key={String(key)} type="button" onClick={()=>setMonitorSection(key as typeof monitorSection)} className={`rounded-2xl border px-2 py-3 text-left transition ${active ? 'border-red-300/40 bg-red-500/12 text-red-100 shadow-lg shadow-red-950/10' : 'border-white/10 bg-white/[0.025] text-gray-500 hover:bg-white/[0.06]'}`}><I size={15}/><span className="mt-2 block text-[8px] font-black uppercase leading-tight tracking-wide">{label}</span></button>; })}
        </div>
        {monitorSection === 'agents' && <section className="space-y-2">{team.map((member) => {
          const status = member.attendance?.checkout_at ? 'Clôturé' : member.attendance?.checkin_at ? 'En action' : 'Absent';
          return <article key={member.userId} className="glass-card overflow-hidden p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black text-white">{member.name}</h3><p className="mt-0.5 text-[10px] text-gray-500">{member.phone}</p><p className="mt-1 text-[9px] font-bold text-red-200">{member.locations.filter((item) => ['Kinshasa','Kongo-Central','Haut-Katanga'].includes(item)).join(' · ') || 'Lieu non renseigné'}</p></div><span className={status === 'Clôturé' ? 'rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-200' : status === 'En action' ? 'rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-100' : 'rounded-full border border-red-300/20 bg-red-500/10 px-2 py-1 text-[8px] font-black uppercase text-red-200'}>{status}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"><b className="block text-lg text-white">{member.clients}</b><span className="text-[8px] font-black uppercase text-gray-500">Clients</span></div><div className="rounded-2xl border border-emerald-300/10 bg-emerald-500/[0.04] p-3"><b className="block text-lg text-emerald-200">{member.transactions}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions</span></div></div><div className="mt-3 flex items-center justify-between text-[9px] text-gray-500"><span>{member.attendance?.checkin_at ? 'Arrivée ' + new Date(member.attendance.checkin_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'Pas de pointage'}</span><ChevronRight size={14}/></div></article>;
        })}</section>}
        {monitorSection === 'presence' && <section className="space-y-2">{team.map((member) => { const present=Boolean(member.attendance?.checkin_at); const closed=Boolean(member.attendance?.checkout_at); return <article key={member.userId} className="glass-card flex items-center justify-between gap-3 p-3"><div className="min-w-0"><b className="block truncate text-xs text-white">{member.name}</b><span className="text-[8px] uppercase text-gray-500">{present ? 'Présent' : 'Absent'}{closed ? ' · Journée clôturée' : ''}</span></div><span className={closed ? 'rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-200' : present ? 'rounded-full bg-cyan-500/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-100' : 'rounded-full bg-red-500/10 px-2 py-1 text-[8px] font-black uppercase text-red-200'}>{closed ? 'Clôturé' : present ? 'Présent' : 'Absent'}</span></article>; })}</section>}
        {monitorSection === 'checkins' && <section className="space-y-2">{team.map((member) => <article key={member.userId} className="glass-card p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><b className="block truncate text-xs text-white">{member.name}</b><span className="text-[8px] uppercase text-gray-500">{member.attendance?.checkin_at ? 'Pointé à ' + new Date(member.attendance.checkin_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'Aucun pointage'}</span></div><MapPin size={17} className={member.attendance?.checkin_at ? 'text-cyan-200' : 'text-gray-600'}/></div>{member.attendance?.checkin_latitude != null && <div className="mt-2 text-[8px] font-bold text-gray-500">{Number(member.attendance.checkin_latitude).toFixed(5)} · {Number(member.attendance.checkin_longitude).toFixed(5)}{member.attendance.checkin_accuracy_m ? ' · ±' + Math.round(member.attendance.checkin_accuracy_m) + ' m' : ''}</div>}</article>)}</section>}
        {monitorSection === 'reports' && <section className="space-y-2">{Array.from(new Set(periodClients.map((item) => item.activity_date))).sort((a,b)=>b.localeCompare(a)).map((reportDate) => { const rows=periodClients.filter((item)=>item.activity_date===reportDate); const tx=rows.filter((item)=>item.transaction_done).length; return <article key={reportDate} className="glass-card flex items-center justify-between gap-3 p-3"><div><b className="block text-xs text-white">Rapport terrain · {dayLabel(reportDate)}</b><span className="text-[8px] font-bold uppercase text-gray-500">{new Set(rows.map((item)=>item.agent_id)).size} BA · {rows.length} clients · {tx} transactions</span></div><FileText size={17} className="text-fuchsia-200"/></article>; })}</section>}
      </>}
      
      {activeTab === 'tab3' && <>
        <section className="flex items-center justify-between gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-2"><Archive size={18} className="text-fuchsia-200"/><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-500">Archives</p><h2 className="mt-0.5 text-sm font-black text-white">Rapports présentés</h2></div></div><DateIconPicker value={date} min={START_DATE} max={today} onChange={setDate} className="flex min-w-0 items-center" buttonClassName="h-9 w-9 shrink-0 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100" labelClassName="hidden sm:block truncate text-[9px] font-black uppercase text-gray-300"/></section>
        <section className="space-y-2">
          {Array.from(new Set(periodClients.map((item) => item.activity_date))).sort((a,b)=>b.localeCompare(a)).map((reportDate) => {
            const rows=periodClients.filter((item)=>item.activity_date===reportDate);
            const tx=rows.filter((item)=>item.transaction_done).length;
            const baCount=new Set(rows.map((item)=>item.agent_id)).size;
            return <article key={reportDate} className="glass-card group flex items-center gap-3 p-4 transition hover:border-fuchsia-300/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.08] text-fuchsia-200"><FileText size={19}/></div>
              <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70">Rapport terrain</p><h3 className="mt-0.5 text-sm font-black text-white">{dayLabel(reportDate)}</h3><p className="mt-1 text-[9px] font-bold text-gray-500">{baCount} BA · {rows.length} clients sensibilisés · {tx} transactions</p></div>
              <span className="rounded-xl border border-emerald-300/15 bg-emerald-500/[0.06] px-2 py-1 text-[8px] font-black uppercase text-emerald-200">Présenté</span>
            </article>;
          })}
          {!periodClients.length && <div className="glass-card p-8 text-center text-[10px] font-bold text-gray-500">Aucun rapport terrain sur cette période.</div>}
        </section>
      </>}

      {activeTab === 'admin' && <>
        <section className="glass-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-200">Gestion · M-Pesa Mikili</p><h2 className="mt-1 text-2xl font-black text-white">Paramètres terrain</h2><p className="mt-2 text-xs leading-relaxed text-gray-400">Gestion dédiée à Mikili : objectifs, population et périmètres. Cette vue ne consomme aucune donnée Privilège.</p></div><Settings2 size={24} className="text-red-200"/></div></section>
        <section className="glass-card p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-500">Targets quotidiennes</p><h2 className="mt-1 text-lg font-black text-white">Donner le cap aux BA</h2></div><Target size={20} className="text-amber-200"/></div><div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ['Clients / jour', draftTargets.dailyClients, 'dailyClients', UsersRound],
            ['Transactions / jour', draftTargets.dailyTransactions, 'dailyTransactions', Zap],
          ].map(([label,value,key,Icon]) => { const I=Icon as React.ElementType; const field=key as keyof MikiliTargets; return <div key={String(key)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center gap-2"><I size={15} className="text-red-200"/><span className="text-[8px] font-black uppercase tracking-wider text-gray-500">{label}</span></div><div className="mt-2 flex items-center justify-between gap-2"><button type="button" onClick={()=>setDraftTargets((prev)=>({...prev,[field]:Math.max(0,Number(value)-1)}))} className="h-9 w-9 rounded-xl border border-white/10 bg-black/20 text-lg font-black text-gray-300">−</button><b className="text-2xl font-black text-white">{value as React.ReactNode}</b><button type="button" onClick={()=>setDraftTargets((prev)=>({...prev,[field]:Number(value)+1}))} className="h-9 w-9 rounded-xl border border-red-300/20 bg-red-500/10 text-lg font-black text-red-100">+</button></div></div>; })}
        </div><button type="button" onClick={()=>void saveTargets()} disabled={savingTargets} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-40"><CheckCircle2 size={15}/>{savingTargets?'Enregistrement…':'Enregistrer les targets'}</button></section>
        <section className="glass-card p-4"><div className="flex items-center justify-between"><div><h2 className="font-black text-white">Population campagne</h2><p className="text-[9px] text-gray-500">{team.length} BA affectés sur le périmètre affiché.</p></div><UsersRound size={19} className="text-cyan-200"/></div><div className="mt-3 space-y-2">{regionSummary.length ? regionSummary.map(([region, stats]) => <div key={region} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-3"><span className="text-[10px] font-black uppercase text-gray-300">{region}</span><span className="text-[9px] font-bold text-gray-500">{stats.clients} clients · {stats.transactions} Tx</span></div>) : <p className="rounded-2xl bg-white/[0.03] p-4 text-[10px] font-semibold text-gray-500">Les régions apparaîtront dès que les premières interactions terrain seront enregistrées.</p>}</div></section>
      </>}
    </div>
  );
};
export default MpesaMikiliManagementView;
