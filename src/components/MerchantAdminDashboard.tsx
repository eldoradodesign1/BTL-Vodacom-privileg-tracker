import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, RefreshCw, Target, TrendingUp, UsersRound } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CampaignRun } from '../types';
import { getActiveCampaignRuns, getMerchantCampaign, getMerchantDashboardSummary, type MerchantDashboardSummary } from '../utils/merchantCampaign';

interface MerchantAdminDashboardProps {
  onOpenManagement: () => void;
}

const percentageColor = (value: number) => value >= 85 ? 'text-emerald-200' : value >= 50 ? 'text-amber-200' : 'text-rose-200';

export const MerchantAdminDashboard: React.FC<MerchantAdminDashboardProps> = ({ onOpenManagement }) => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [summary, setSummary] = useState<MerchantDashboardSummary | null>(null);
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
      if (!activeRun) throw new Error('Aucune vague Merchant active n’est disponible.');
      const metrics = await getMerchantDashboardSummary(activeRun);
      setRun(activeRun);
      setSummary(metrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement du dashboard Merchant impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const donutTotal = useMemo(() => summary?.donut.reduce((total, item) => total + item.value, 0) || 0, [summary]);

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement du pilotage Merchant…</div>;
  if (!summary || !run) return <div className="glass-card p-6 text-center text-sm text-rose-200">{error || 'Les indicateurs Merchant sont indisponibles.'}</div>;

  return <div className="space-y-4 pb-4">
    <section className="glass-card relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-14 -top-12 h-48 w-48 rounded-full bg-fuchsia-400/[0.10] blur-3xl"/>
      <div className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-cyan-400/[0.08] blur-3xl"/>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/80">Pilotage Merchant</p>
          <h1 className="mt-1 text-xl font-black tracking-tight">Exécution de campagne</h1>
          <p className="mt-1 text-xs text-gray-400">Objectifs, couverture POS et cadence des Brand Ambassadors.</p>
        </div>
        <button type="button" onClick={() => void load()} title="Actualiser le dashboard" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-200 transition hover:bg-white/10"><RefreshCw size={17}/></button>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
        <button type="button" onClick={onOpenManagement} className="rounded-2xl border border-violet-300/25 bg-violet-500/[0.08] p-3 text-left transition hover:bg-violet-500/[0.13]">
          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-violet-100"><Target size={12}/> Objectif campagne</span>
          <b className="mt-1 block text-xl font-black text-white">{summary.targets.campaign_pos_target}</b>
          <span className="text-[9px] font-bold text-gray-400">POS configurés</span>
        </button>
        <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/[0.08] p-3">
          <span className="flex items-center justify-center gap-1 text-[9px] font-black uppercase text-cyan-100"><UsersRound size={12}/> Équipe active</span>
          <b className="mt-1 block text-xl font-black text-white">{summary.activeBas}/{summary.teamSize}</b>
          <span className="text-[9px] font-bold text-gray-400">BA pointés</span>
        </div>
        <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/[0.08] p-3">
          <span className="flex items-center justify-center gap-1 text-[9px] font-black uppercase text-emerald-100"><Activity size={12}/> Exécution jour</span>
          <b className={`mt-1 block text-xl font-black ${percentageColor(summary.dailyExecutionRate)}`}>{summary.dailyExecutionRate}%</b>
          <span className="text-[9px] font-bold text-gray-400">{summary.visitedToday} POS visités</span>
        </div>
      </div>
    </section>

    {error && <div className="rounded-2xl border border-rose-400/40 bg-rose-950/45 p-3 text-xs font-bold text-rose-100">{error}</div>}

    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <article className="glass-card relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-violet-400/[0.12] blur-3xl"/>
        <div className="relative flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">Anneau de couverture</p><h2 className="mt-1 text-sm font-black">État des POS</h2></div><span className={`rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black ${percentageColor(summary.campaignExecutionRate)}`}>{summary.campaignExecutionRate}%</span></div>
        <div className="relative mt-2 h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={84} paddingAngle={4} cornerRadius={9}>{summary.donut.map((entry) => <Cell key={entry.name} fill={entry.color} style={{ filter: `drop-shadow(0 0 7px ${entry.color}80)` }}/>)}</Pie><Tooltip contentStyle={{ backgroundColor: '#0b1020', borderColor: '#374151', borderRadius: '14px', fontSize: '11px' }}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="text-2xl font-black text-white">{summary.campaignExecutionRate}%</b><span className="text-[9px] font-black uppercase text-gray-400">Couverture</span></div></div>
        <div className="flex justify-center gap-2 text-[9px] font-black uppercase">{summary.donut.map((item) => <span key={item.name} className="flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-gray-300"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}/>{item.name} {item.value}</span>)}</div>
      </article>
      <article className="glass-card relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -left-10 -bottom-12 h-32 w-32 rounded-full bg-cyan-400/[0.10] blur-3xl"/>
        <div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Histogramme de cadence</p><h2 className="mt-1 text-sm font-black">POS réalisés par BA</h2><p className="mt-1 text-[10px] text-gray-400">Barre cyan : réalisé · barre mauve : objectif journalier.</p></div>
        <div className="relative mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.byBa} margin={{ top: 10, right: 4, left: -22, bottom: 8 }}><CartesianGrid stroke="#ffffff15" vertical={false}/><XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ backgroundColor: '#0b1020', borderColor: '#374151', borderRadius: '14px', fontSize: '11px' }}/><Bar dataKey="pos" name="POS réalisés" fill="#38bdf8" radius={[7,7,0,0]}/><Bar dataKey="target" name="Objectif" fill="#a78bfa" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div>
      </article>
    </section>

    <section className="glass-card relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-14 -bottom-16 h-44 w-44 rounded-full bg-emerald-400/[0.08] blur-3xl"/>
      <div className="relative flex items-center gap-2"><TrendingUp className="text-emerald-200" size={18}/><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Courbe de progression</p><h2 className="mt-1 text-sm font-black">POS visités sur les 7 derniers jours</h2></div></div>
      <div className="relative mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={summary.timeline} margin={{ top: 12, right: 8, left: -20, bottom: 3 }}><CartesianGrid stroke="#ffffff12" vertical={false}/><XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ backgroundColor: '#0b1020', borderColor: '#374151', borderRadius: '14px', fontSize: '11px' }}/><Legend wrapperStyle={{ fontSize: '10px' }}/><Line type="monotone" dataKey="visits" name="POS visités" stroke="#34d399" strokeWidth={3} dot={{ r: 4, fill: '#34d399' }} activeDot={{ r: 6 }}/><Line type="monotone" dataKey="target" name="Objectif actif" stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 5" dot={false}/></LineChart></ResponsiveContainer></div>
      <div className="relative mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px]"><span className="font-bold text-gray-400">Transactions aujourd’hui</span><b className="text-emerald-100">{summary.transactionsToday.toLocaleString('fr-FR')}</b><span className="font-bold text-gray-400">Objectifs pilotables dans Gestion</span><CheckCircle2 size={15} className="text-emerald-300"/></div>
    </section>
  </div>;
};
