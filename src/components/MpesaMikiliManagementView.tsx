import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, BarChart3, FileText, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, MapPin, RefreshCw, Trophy, UsersRound, UserRound, Zap, Target, Settings2, ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { User } from '../types';
import {
  getMikiliCampaign,
  getMikiliCampaignClients,
  getMikiliAttendanceRange,
  getMikiliPodium,
  getMikiliSupervisorRegions,
  getMikiliTargets,
  getMikiliTeam,
  mikiliTodayIso,
  saveMikiliTargets,
  type MikiliClient,
  type MikiliAttendance,
  type MikiliPodiumEntry,
  type MikiliRegion,
  type MikiliTeamMember,
  type MikiliTargets,
} from '../utils/mpesaMikili';
import { DateIconPicker } from './DateIconPicker';
import { DateRangeKnobSlider } from './DateRangeKnobSlider';
import { getLocationEmbedUrl } from '../utils/location';

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

const PresencePanel: React.FC<{
  attendance: MikiliAttendance[];
  startDate: string;
  endDate: string;
}> = ({ attendance, startDate, endDate }) => {
  const [month, setMonth] = useState(() => new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - offset + 1;
    if (day < 1 || day > days) return null;
    const iso = `${year}-${String(monthIndex + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const row = attendance.find(x => x.activity_date === iso);
    const inPeriod = iso >= startDate && iso <= endDate;
    const status = !inPeriod ? 'outside' : row?.status === 'closed' ? 'closed' : row?.checkin_at ? 'open' : 'absent';
    return { day, iso, status };
  });
  return <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] p-3">
    <div className="flex items-center justify-between mb-3">
      <button type="button" onClick={()=>setMonth(new Date(year,monthIndex-1,1))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-200" aria-label="Mois précédent"><ChevronLeft size={14}/></button>
      <div className="text-xs font-black uppercase text-white">{month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</div>
      <button type="button" onClick={()=>setMonth(new Date(year,monthIndex+1,1))} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-200" aria-label="Mois suivant"><ChevronRight size={14}/></button>
    </div>
    <div className="grid grid-cols-7 gap-1 mb-1">{['Lu','Ma','Me','Je','Ve','Sa','Di'].map(d=><span key={d} className="py-1 text-center text-[8px] font-black uppercase text-gray-600">{d}</span>)}</div>
    <div className="grid grid-cols-7 gap-1">
      {cells.map((cell,i)=>cell ? <div key={cell.iso} title={cell.status === 'closed' ? 'Rapport présenté' : cell.status === 'open' ? 'Pointage effectué · journée non clôturée' : cell.status === 'absent' ? 'Absent · aucun pointage' : 'Hors période'} className={`flex h-9 items-center justify-center rounded-lg border text-[10px] font-black ${cell.status==='closed'?'border-emerald-400/40 bg-emerald-500/25 text-emerald-200':cell.status==='open'?'border-blue-400/40 bg-blue-500/25 text-blue-200':cell.status==='absent'?'border-red-400/35 bg-red-500/20 text-red-200':'border-white/10 bg-white/5 text-gray-600'}`}>{cell.day}</div> : <div key={'e'+i} className="h-9"/>)}
    </div>
    <div className="mt-3 flex flex-wrap justify-center gap-3 text-[8px] font-black uppercase">
      <span className="text-emerald-200">● Rapport présenté</span><span className="text-blue-200">● Pointé · non clôturé</span><span className="text-red-200">● Absent</span>
    </div>
  </div>;
};

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
  const [selectedAgent, setSelectedAgent] = useState<MikiliTeamMember | null>(null);
  const [agentAttendance, setAgentAttendance] = useState<MikiliAttendance[]>([]);
  const [agentModal, setAgentModal] = useState<'profile' | 'presence' | 'location' | 'reports' | null>(null);
  const [reportsStart, setReportsStart] = useState(START_DATE);
  const [reportsEnd, setReportsEnd] = useState(today);
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

  const openAgentModal = async (member: MikiliTeamMember, modal: 'profile' | 'presence' | 'location' | 'reports') => {
    setSelectedAgent(member);
    setAgentModal(modal);
    if (modal === 'profile' || modal === 'presence') {
      try {
        const rows = await getMikiliAttendanceRange(campaignId, member.userId, START_DATE, today);
        setAgentAttendance(rows);
      } catch {
        setAgentAttendance([]);
      }
    }
  };
  const closeAgentModal = () => { setAgentModal(null); setSelectedAgent(null); };


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
        {isSupervisor && <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.10] via-white/[0.03] to-transparent p-4">
          <div className="flex items-center justify-between"><div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Vue superviseur</p><h2 className="mt-1 text-xl font-black text-white">Pulse de mon équipe</h2></div><span className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-100">{metrics.present}/{team.length} présents</span></div>
          <div className="mt-5 space-y-3">{[['Présence',metrics.present,Math.max(1,team.length)],['Clients',metrics.clients,Math.max(1,targets.dailyClients*Math.max(1,team.length))],['Transactions',metrics.transactions,Math.max(1,targets.dailyTransactions*Math.max(1,team.length))]].map(([label,value,target])=>{const pct=Math.min(100,Math.round(Number(value)/Number(target)*100));return <div key={String(label)}><div className="flex justify-between text-[9px] font-black uppercase"><span className="text-gray-400">{label}</span><span className="text-white">{value} <span className="text-gray-600">/ {target}</span></span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400" style={{width:pct+'%'}}/></div></div>})}</div>
          <div className="mt-4 grid grid-cols-3 gap-2">{team.slice(0,3).map((member,index)=><div key={member.userId} className="rounded-2xl border border-white/8 bg-black/15 p-3"><span className="text-[8px] font-black text-cyan-200/60">0{index+1}</span><b className="mt-1 block truncate text-[10px] text-white">{member.name}</b><span className="mt-1 block text-[8px] font-bold text-gray-500">{member.clients} clients · {member.transactions} Tx</span></div>)}</div>
        </section>}
        <section className="grid grid-cols-2 gap-2">
          <div className="glass-card p-4"><p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-500">Conversion</p><b className="mt-2 block text-3xl font-black text-emerald-200">{metrics.conversion}%</b><div className="mt-3 h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-emerald-400" style={{width:metrics.conversion+'%'}}/></div></div>
          <div className="glass-card p-4"><p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-500">Couverture</p><b className="mt-2 block text-3xl font-black text-cyan-100">{team.length ? Math.round(metrics.present/team.length*100) : 0}%</b><span className="mt-2 block text-[8px] font-bold text-gray-500">{metrics.present} / {team.length} BA présents</span></div>
        </section>

        {!isSupervisor && (        <section className="glass-card overflow-hidden p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Progression</p><h2 className="mt-1 text-lg font-black text-white">Le terrain depuis le 1er septembre</h2></div><ArrowUpRight size={20} className="text-cyan-200"/></div>
          <div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.07)"/><XAxis dataKey="label" tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#11141d',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,fontSize:11}}/><Line type="monotone" dataKey="clients" name="Clients" stroke="#ef4444" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="transactions" name="Transactions" stroke="#22c55e" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div>
        </section>

    )}
    {!isSupervisor && (    <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
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
        </section>)}

        {!isSupervisor && <section className="glass-card overflow-hidden p-4">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-200/80">Podium du jour</p><h2 className="mt-1 text-lg font-black text-white">La course Mikili</h2></div><Trophy size={21} className="text-amber-200"/></div>
          <div className="mt-3 grid grid-cols-3 gap-2">{[0,1,2].map((index) => { const entry=podium[index]; return <div key={entry?.userId || index} className={rankClasses[index] + ' min-h-24 rounded-2xl border p-3'}><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/15 text-[10px] font-black">{index+1}</span><b className="mt-2 block truncate text-[10px]">{entry?.name?.split(' ')[0] || '—'}</b><span className="mt-1 block text-[9px] font-bold opacity-80">{entry ? entry.transactions + ' Tx · ' + entry.clients + ' clients' : 'À saisir'}</span></div>; })}</div>
        </section>}
      </>}

      {activeTab === 'tab2' && <>
        <section className="flex items-center justify-between gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-2"><UsersRound size={18} className="text-red-200"/><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-500">Monitoring Mikili</p><h2 className="mt-0.5 text-sm font-black text-white">{dayLabel(date)} · {team.length} BA</h2></div></div><DateIconPicker value={date} min={START_DATE} max={today} onChange={setDate} className="flex min-w-0 items-center" buttonClassName="h-9 w-9 shrink-0 rounded-xl border border-red-300/20 bg-red-500/10 text-red-100" labelClassName="hidden sm:block truncate text-[9px] font-black uppercase text-gray-300"/></section>
        {!isSupervisor && <section className="glass-card overflow-hidden p-4">
          <div className="flex items-center justify-between"><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-200/80">Performance</p><h2 className="mt-1 text-lg font-black text-white">Podium du jour</h2></div><Trophy size={19} className="text-amber-200"/></div>
          <div className="mt-3 grid grid-cols-3 gap-2">{[0,1,2].map((index)=>{const entry=podium[index];return <div key={entry?.userId||index} className={`min-h-24 rounded-2xl border p-3 ${rankClasses[index]}`}><span className="text-[9px] font-black">{index+1}</span><b className="mt-2 block truncate text-[10px]">{entry?.name?.split(' ')[0]||'—'}</b><span className="mt-1 block text-[8px] font-bold opacity-70">{entry ? entry.transactions+' Tx · '+entry.clients+' clients' : 'À saisir'}</span></div>})}</div>
        </section>}

        <section className="space-y-2">
          {team.map((member) => {
            const status = member.attendance?.checkout_at ? 'Clôturé' : member.attendance?.checkin_at ? 'En action' : 'Absent';
            return (
              <article key={member.userId} className="glass-card overflow-hidden p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-white">{member.name}</h3>
                    <p className="mt-0.5 text-[10px] text-gray-500">{member.phone}</p>
                    <p className="mt-1 text-[9px] font-bold text-red-200">{member.locations.filter((item) => ['Kinshasa','Kongo-Central','Haut-Katanga'].includes(item)).join(' · ') || 'Lieu non renseigné'}</p>
                  </div>
                  <span className={status === 'Clôturé' ? 'rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-200' : status === 'En action' ? 'rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-100' : 'rounded-full border border-red-300/20 bg-red-500/10 px-2 py-1 text-[8px] font-black uppercase text-red-200'}>{status}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"><b className="block text-lg text-white">{member.clients}</b><span className="text-[8px] font-black uppercase text-gray-500">Clients</span></div>
                  <div className="rounded-2xl border border-emerald-300/10 bg-emerald-500/[0.04] p-3"><b className="block text-lg text-emerald-200">{member.transactions}</b><span className="text-[8px] font-black uppercase text-gray-500">Transactions</span></div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 text-[9px] text-gray-500">
                    <span>{member.attendance?.checkin_at ? 'Arrivée ' + new Date(member.attendance.checkin_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'Pas de pointage'}</span>
                  </div>
                  <div className="grid shrink-0 grid-cols-4 gap-1.5">
                    <button type="button" onClick={() => void openAgentModal(member,'profile')} title="Détail agent" aria-label="Détail agent" className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-400/35 bg-blue-500/10 text-blue-200 transition hover:bg-blue-500/20 active:scale-95"><UserRound size={14}/></button>
                    <button type="button" onClick={() => void openAgentModal(member,'presence')} title="Registre de présence" aria-label="Registre de présence" className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-400/35 bg-blue-500/10 text-blue-200 transition hover:bg-blue-500/20 active:scale-95"><CalendarDays size={14}/></button>
                    <button type="button" onClick={() => void openAgentModal(member,'location')} title="Pointage journalier" aria-label="Pointage journalier" className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-400/35 bg-blue-500/10 text-blue-200 transition hover:bg-blue-500/20 active:scale-95"><MapPin size={14}/></button>
                    <button type="button" onClick={() => { setSelectedAgent(member); setReportsStart(START_DATE); setReportsEnd(today); setAgentModal('reports'); }} title="Rapports" aria-label="Rapports" className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-400/35 bg-blue-500/10 text-blue-200 transition hover:bg-blue-500/20 active:scale-95"><FileText size={14}/></button>
                  </div>
                </div>
              </article>
            );
          })}
          {!team.length && <div className="glass-card p-8 text-center text-[10px] font-bold text-gray-500">Aucun BA rattaché à cette campagne.</div>}
        </section>
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
      {agentModal && selectedAgent && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md" onClick={closeAgentModal}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0a1220]/95 p-4 shadow-2xl animate-pop" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div><p className="text-[8px] font-black uppercase tracking-[.2em] text-blue-200/70">M-Pesa Mikili · {agentModal === 'profile' ? 'Détail agent' : agentModal === 'presence' ? 'Registre de présence' : agentModal === 'location' ? 'Localisation' : 'Rapports'}</p><h2 className="mt-1 text-lg font-black text-white">{selectedAgent.name}</h2></div>
              <button type="button" onClick={closeAgentModal} className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-gray-300">×</button>
            </div>

            {agentModal === 'profile' && <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/5 p-3"><b className="text-2xl text-white">{periodClients.filter(x=>x.agent_id===selectedAgent.userId).length}</b><span className="block text-[8px] font-black uppercase text-gray-500">Clients</span></div><div className="rounded-2xl bg-emerald-500/5 p-3"><b className="text-2xl text-emerald-200">{periodClients.filter(x=>x.agent_id===selectedAgent.userId&&x.transaction_done).length}</b><span className="block text-[8px] font-black uppercase text-gray-500">Transactions</span></div><div className="rounded-2xl bg-blue-500/5 p-3"><b className="text-2xl text-blue-200">{agentAttendance.filter(x=>x.checkin_at).length}</b><span className="block text-[8px] font-black uppercase text-gray-500">Pointages</span></div></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><p className="text-[8px] font-black uppercase text-gray-500">Courbe d’évolution</p><div className="mt-2 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={Array.from(new Set(periodClients.filter(x=>x.agent_id===selectedAgent.userId).map(x=>x.activity_date))).sort().map(d=>{const rows=periodClients.filter(x=>x.agent_id===selectedAgent.userId&&x.activity_date===d);return {label:d.slice(8)+'/'+d.slice(5,7),clients:rows.length,transactions:rows.filter(x=>x.transaction_done).length};})}><XAxis dataKey="label" tick={{fontSize:8,fill:'#6b7280'}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:8,fill:'#6b7280'}} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="clients" stroke="#ef4444" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="transactions" stroke="#22c55e" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div></div>
              <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-gray-400"><div className="rounded-xl bg-white/5 p-3">Pointages : <b className="text-white">{agentAttendance.filter(x=>x.checkin_at).length}</b></div><div className="rounded-xl bg-white/5 p-3">Journées clôturées : <b className="text-emerald-200">{agentAttendance.filter(x=>x.status==='closed').length}</b></div></div>
            </div>}

            {agentModal === 'presence' && <PresencePanel attendance={agentAttendance} startDate={START_DATE} endDate={today} />}

            {agentModal === 'location' && <div className="mt-4 space-y-3"><div className="rounded-2xl border border-blue-300/15 bg-blue-500/[.06] p-3"><p className="text-[8px] font-black uppercase text-blue-200/70">Pointage journalier</p><p className="mt-1 text-xs font-black text-white">{selectedAgent.attendance?.checkin_at ? new Date(selectedAgent.attendance.checkin_at).toLocaleString('fr-FR') : 'Aucun pointage'}</p><p className="mt-1 text-[9px] text-gray-500">{selectedAgent.attendance?.checkin_latitude != null ? `${Number(selectedAgent.attendance.checkin_latitude).toFixed(6)} · ${Number(selectedAgent.attendance.checkin_longitude).toFixed(6)} · ±${Math.round(selectedAgent.attendance.checkin_accuracy_m || 0)} m` : 'Coordonnées indisponibles'}</p></div><div className="h-80 overflow-hidden rounded-2xl border border-white/10"><iframe title="Localisation du pointage" className="h-full w-full border-0" src={getLocationEmbedUrl({shop:'M-Pesa Mikili',lat:selectedAgent.attendance?.checkin_latitude ?? undefined,long:selectedAgent.attendance?.checkin_longitude ?? undefined})}/></div></div>}

            {agentModal === 'reports' && <div className="mt-4 space-y-3"><DateRangeKnobSlider minDate={START_DATE} maxDate={today} startDate={reportsStart} endDate={reportsEnd} onChange={({startDate,endDate})=>{setReportsStart(startDate);setReportsEnd(endDate)}}/><div className="space-y-2">{Array.from(new Set(periodClients.filter(x=>x.agent_id===selectedAgent.userId&&x.activity_date>=reportsStart&&x.activity_date<=reportsEnd).map(x=>x.activity_date))).sort((a,b)=>b.localeCompare(a)).map(d=>{const rows=periodClients.filter(x=>x.agent_id===selectedAgent.userId&&x.activity_date===d);return <article key={d} className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><p className="text-[8px] font-black uppercase text-fuchsia-200/70">Rapport présenté</p><b className="text-xs text-white">{dayLabel(d)}</b><p className="mt-1 text-[9px] text-gray-500">{rows.length} clients · {rows.filter(x=>x.transaction_done).length} transactions</p></article>})}{!periodClients.some(x=>x.agent_id===selectedAgent.userId&&x.activity_date>=reportsStart&&x.activity_date<=reportsEnd)&&<div className="rounded-2xl bg-white/5 p-6 text-center text-[10px] text-gray-500">Aucun rapport présenté sur la période.</div>}</div></div>}
          </div>
        </div>
      )}

    </div>
  );
};
export default MpesaMikiliManagementView;
