import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Banknote, CheckCircle2, RefreshCw, Target, TrendingUp, UsersRound } from 'lucide-react';
import { CampaignProgressGauge } from './CampaignProgressGauge';
import { TargetBars, TargetRings, TrendChart, WelcomeHeader } from './DashboardKit';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CampaignRun } from '../types';
import { getActiveCampaignRuns, getMerchantCampaign, getMerchantDashboardSummary, type MerchantDashboardSummary } from '../utils/merchantCampaign';

interface MerchantAdminDashboardProps {
  onOpenManagement: () => void;
  podiumSlot?: React.ReactNode;
  userName?: string;
  pendingFundRequestCount?: number;
  onOpenFundRequests?: () => void;
}

const percentageColor = (value: number) => value >= 85 ? 'text-emerald-200' : value >= 50 ? 'text-amber-200' : 'text-rose-200';

export const MerchantAdminDashboard: React.FC<MerchantAdminDashboardProps> = ({ userName = '', onOpenManagement, podiumSlot, pendingFundRequestCount = 0, onOpenFundRequests }) => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [summary, setSummary] = useState<MerchantDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kinshasa' });
  const [date, setDate] = useState(todayIso);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      if (!activeRun) throw new Error('Aucune vague Merchant active n’est disponible.');
      const metrics = await getMerchantDashboardSummary(activeRun, date);
      setRun(activeRun);
      setSummary(metrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement du dashboard Merchant impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [date]);


  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement du pilotage Merchant…</div>;
  if (!summary || !run) return <div className="glass-card p-6 text-center text-sm text-rose-200">{error || 'Les indicateurs Merchant sont indisponibles.'}</div>;

  const statusColors: Record<string, string> = { 'Complétés': 'var(--m-chart-1)', 'Actifs': 'var(--m-chart-2)', 'Inachevés': 'var(--m-chart-3)', 'Non actifs': 'var(--m-muted)' };
  const touched = summary.donut.filter((item) => item.name !== 'À couvrir');
  const covered = touched.reduce((sum, item) => sum + item.value, 0);
  const campaignTarget = summary.targets.campaign_pos_target;
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  return <div className="campaign-home pb-4">
    <WelcomeHeader
      eyebrow="Merchant Education · pilotage"
      name={userName || 'équipe'}
      subtitle="Couverture POS et cadence des Brand Ambassadors"
      date={date}
      minDate={run.starts_on || undefined}
      maxDate={todayIso}
      onDateChange={setDate}
      onRefresh={() => void load()}
    />

    {error && <div className="rounded-2xl border border-rose-400/40 bg-rose-950/45 p-3 text-sm font-semibold text-rose-100">{error}</div>}

    <CampaignProgressGauge
      title="Couverture"
      subtitle="POS de la base ciblée · toute la campagne"
      modes={[
        { key: 'coverage', label: 'Couverture', value: covered, target: campaignTarget, unit: 'POS' },
        ...touched.map((item) => ({ key: item.name, label: item.name, value: item.value, target: campaignTarget, unit: 'POS', color: statusColors[item.name] })),
      ]}
      legend={touched.map((item) => ({ label: item.name, value: item.value, color: statusColors[item.name] || 'var(--m-chart-1)' }))}
      note={`${Math.max(0, campaignTarget - covered).toLocaleString('fr-FR')} POS restent à couvrir.`}
    >
      <button type="button" onClick={onOpenManagement} className="flex w-full items-center justify-between rounded-[18px] bg-[var(--m-tile)] px-3 py-2.5 text-sm font-semibold text-[var(--m-text)]">
        Régler les objectifs de campagne
        <Target className="h-4 w-4 text-[var(--m-muted)]" aria-hidden="true" />
      </button>
    </CampaignProgressGauge>

    <TargetRings
      title="Indicateurs du jour"
      subtitle={dayLabel}
      rings={[
        { label: 'POS visités', value: summary.visitedToday, target: summary.activeBas * summary.targets.daily_pos_target, color: 'var(--m-chart-1)' },
        { label: 'Transactions', value: summary.transactionsToday, target: summary.visitedToday * summary.targets.transactions_per_pos_target, color: 'var(--m-chart-2)' },
        { label: 'Équipe active', value: summary.activeBas, target: summary.teamSize, color: 'var(--m-chart-3)', caption: `${summary.activeBas} / ${summary.teamSize} BA pointés` },
      ]}
    />

    {onOpenFundRequests && <button type="button" onClick={onOpenFundRequests} className="glass-card flex w-full items-center justify-between gap-3 !px-4 !py-3 text-left">
      <span className="flex items-center gap-3">
        <Banknote className="h-5 w-5 text-[var(--m-accent)]" aria-hidden="true"/>
        <span><b className="block text-sm font-bold text-[var(--m-text)]">Demandes de fonds</b><span className="block text-xs text-[var(--m-text-2)]">Ouvrir le registre et traiter les demandes BA</span></span>
      </span>
      <span className={`relative rounded-xl border px-3 py-1.5 text-sm font-bold ${pendingFundRequestCount ? 'border-amber-300/40 bg-amber-500/20 text-amber-100' : 'border-[var(--m-edge-soft)] bg-[var(--m-tile)] text-[var(--m-muted)]'}`}>{pendingFundRequestCount || '0'}{pendingFundRequestCount > 0 && <i className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400"/>}</span>
    </button>}

    <TrendChart
      title="Cadence des visites"
      subtitle="POS visités par jour face à l’objectif des BA pointés"
      views={[{
        key: 'days',
        label: '30 jours',
        labels: summary.timeline.map((point) => point.label),
        series: [{ key: 'visits', label: 'Visites', values: summary.timeline.map((point) => point.visits) }],
        target: summary.timeline.map((point) => point.target),
        targetLabel: 'Objectif',
      }]}
    />

    <TargetBars
      title="BA face à l’objectif"
      subtitle={`POS visités le ${dayLabel} · trait = objectif journalier`}
      rows={summary.byBa.filter((row) => row.pos > 0 || row.transactions > 0).map((row) => ({ key: row.id, label: row.name, value: row.pos, target: row.target }))}
      emptyText="Aucune visite enregistrée ce jour."
    />

    {podiumSlot}
  </div>;
};
