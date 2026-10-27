import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle2, Circle, FileText, MapPin, ReceiptText, RefreshCw, Search, Store, UserRound, UsersRound, XCircle } from 'lucide-react';
import type { CampaignRun } from '../types';
import { clampMerchantActivityDate, getActiveCampaignRuns, getCampaignAssignmentsOverview, getMerchantCampaign, getMerchantMonitoring, MERCHANT_CAMPAIGN_START, merchantTodayIso, type MerchantTeamActivity } from '../utils/merchantCampaign';
import { DateIconPicker } from './DateIconPicker';
import { MerchantBAOperationsModal } from './Modals/MerchantBAOperationsModal';
import { MerchantVisitedPosModal } from './Modals/MerchantVisitedPosModal';
import { MerchantTransactionsDetailModal } from './Modals/MerchantTransactionsDetailModal';

type MerchantOperation = 'profile' | 'report' | 'location' | 'calendar';

export const MerchantMonitoringView: React.FC = () => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [date, setDate] = useState(merchantTodayIso());
  const [team, setTeam] = useState<MerchantTeamActivity[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'absent' | 'present' | 'closed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<{ mode: MerchantOperation; activity: MerchantTeamActivity } | null>(null);
  const [visitedPosActivity, setVisitedPosActivity] = useState<MerchantTeamActivity | null>(null);
  const [transactionActivity, setTransactionActivity] = useState<MerchantTeamActivity | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      const safeDate = clampMerchantActivityDate(date);
      if (safeDate !== date) setDate(safeDate);
      setRun(activeRun);

      if (!activeRun) {
        setTeam([]);
        return;
      }

      // Le monitoring est strictement limité aux BA affectés à la campagne active.
      // Le menu Gestion reste la source de vérité pour la liste complète et les affectations.
      const [monitoring, assignments] = await Promise.all([
        getMerchantMonitoring(activeRun.id, safeDate),
        getCampaignAssignmentsOverview(),
      ]);
      const assignedBaIds = new Set(
        assignments
          .filter((assignment) => assignment.campaignId === campaign.id && assignment.isActive)
          .map((assignment) => assignment.userId)
      );
      setTeam(monitoring.filter((item) => assignedBaIds.has(item.ba.id)));
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
      const haystack = `${item.ba.name} ${item.ba.phone} ${item.mfsNames.join(' ')}`.toLowerCase();
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
    if (item.status === 'present') return { label: 'En activité', icon: <Circle size={13} className="fill-current"/>, className: 'border-red-400/35 bg-red-500/15 text-red-300' };
    return { label: 'Absent', icon: <XCircle size={15}/>, className: 'border-red-400/35 bg-red-500/10 text-red-200' };
  };

  const actionButton = (item: MerchantTeamActivity, mode: MerchantOperation, label: string, Icon: React.ElementType, enabled = true) => (
    <button key={mode} type="button" onClick={() => enabled && setOperation({ mode, activity: item })} disabled={!enabled} title={label} className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${enabled ? 'border-white/10 bg-white/[0.05] text-gray-200 hover:border-red-300/35 hover:bg-red-400/10 hover:text-red-300' : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-gray-600'}`}><Icon size={16}/></button>
  );

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement du monitoring Merchant…</div>;

  return <div className="space-y-4 pb-4">
    <section className="glass-card relative overflow-hidden p-4 sm:p-5"><div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-red-400/[0.08] blur-3xl"/><div className="relative flex items-start justify-between gap-3"><div><p className="text-[0.75rem] font-black uppercase tracking-[0.18em] text-red-300/70">Pilotage opérationnel</p><h1 className="mt-1 text-xl font-black">Merchant Educational Campaign</h1><p className="mt-1 text-xs text-gray-400">Suivi quotidien des Brand Ambassadors</p></div><button onClick={() => void load()} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-300 transition hover:bg-white/10" title="Actualiser le monitoring"><RefreshCw size={17}/></button></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-3"><b className="block text-lg font-black text-red-300">{metrics.present}</b><span className="text-[0.6875rem] font-black uppercase text-gray-400">En activité</span></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3"><b className="block text-lg font-black text-emerald-200">{metrics.closed}</b><span className="text-[0.6875rem] font-black uppercase text-gray-400">Clôturés</span></div><div className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-3"><b className="block text-lg font-black text-red-200">{metrics.absent}</b><span className="text-[0.6875rem] font-black uppercase text-gray-400">Absents</span></div></div></section>
    {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}
    <section className="glass-card space-y-3 p-4">
      <div className="flex items-center gap-3"><UsersRound className="shrink-0 text-[var(--m-accent)]" size={20}/><div className="min-w-0"><h2 className="font-black">Équipe et performances</h2><p className="text-xs text-gray-400">{metrics.visited} POS visités · {metrics.transactions} transactions</p></div></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex min-h-[48px] items-center rounded-2xl border border-[var(--m-edge-soft)] bg-[var(--m-field)] px-1.5"><DateIconPicker value={date} min={MERCHANT_CAMPAIGN_START} max={merchantTodayIso()} onChange={setDate} className="flex min-w-0 flex-1 items-center" buttonClassName="h-10 w-10 shrink-0 rounded-xl border border-[var(--m-edge-soft)] text-[var(--m-accent)]" labelClassName="min-w-0 flex-1 truncate text-sm font-bold text-[var(--m-text)]" popoverAlign="left"/></div>
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-500" size={16}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BA ou téléphone" className="app-input min-h-[48px] w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div>
      </div>
      <div className="seg-control seg-control--stacked" role="group" aria-label="Filtrer par statut">{([{ id: 'all', label: 'Tous', count: metrics.present + metrics.closed + metrics.absent }, { id: 'present', label: 'En activité', count: metrics.present }, { id: 'closed', label: 'Clôturés', count: metrics.closed }, { id: 'absent', label: 'Absents', count: metrics.absent }] as const).map((filter) => <button key={filter.id} type="button" aria-pressed={status === filter.id} onClick={() => setStatus(filter.id)}><b>{filter.count}</b>{filter.label}</button>)}</div>
    </section>
    <section className="space-y-3">{filteredTeam.map((item) => { const info = statusInfo(item); const checkin = item.attendance?.checkin_at ? new Date(item.attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; const checkout = item.attendance?.checkout_at ? new Date(item.attendance.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'; const hasGps = typeof item.attendance?.checkin_latitude === 'number' || typeof item.attendance?.checkout_latitude === 'number'; return <article key={item.ba.id} className="glass-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" onClick={() => setOperation({ mode: 'profile', activity: item })} className="block max-w-full truncate text-left font-black text-white transition hover:text-red-300">{item.ba.name}</button><p className="mt-0.5 text-xs text-gray-400">{item.ba.phone}</p>{item.mfsNames.length > 0 && <p className="mt-1 line-clamp-1 text-[0.75rem] font-bold text-fuchsia-200">MFS · {item.mfsNames.join(' · ')}</p>}</div><div className="flex shrink-0 items-center gap-1.5">{actionButton(item, 'profile', 'Détail du BA', UserRound)}{actionButton(item, 'report', 'Aperçu du rapport', FileText, Boolean(item.attendance))}{actionButton(item, 'location', 'Localisation du pointage', MapPin, hasGps)}{actionButton(item, 'calendar', 'Registre de présence', CalendarDays)}<span className={`ml-1 inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[0.75rem] font-black uppercase ${info.className}`}>{info.icon}{info.label}</span></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><button type="button" onClick={() => setVisitedPosActivity(item)} className="rounded-2xl border border-red-300/20 bg-red-400/[0.06] p-2 transition hover:border-red-300/45 hover:bg-red-400/[0.12]" title="Voir les POS visités"><Store className="mx-auto mb-0.5 text-red-300" size={13}/><b className="block text-sm text-red-300">{item.visitedPosCount}</b><span className="text-[0.6875rem] font-black uppercase text-gray-400">POS</span></button><button type="button" onClick={() => setTransactionActivity(item)} className="rounded-2xl border border-amber-300/20 bg-amber-500/[0.06] p-2 transition hover:border-amber-300/45 hover:bg-amber-500/[0.12]" title="Voir les transactions"><ReceiptText className="mx-auto mb-0.5 text-amber-100" size={13}/><b className="block text-sm text-amber-100">{item.transactionCount}</b><span className="text-[0.6875rem] font-black uppercase text-gray-400">Transactions</span></button><button type="button" onClick={() => setTransactionActivity(item)} className="rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.06] p-2 transition hover:border-emerald-300/45 hover:bg-emerald-500/[0.12]" title="Voir les transactions et montants"><Banknote className="mx-auto mb-0.5 text-emerald-100" size={13}/><b className="block text-sm text-emerald-100">{item.totalAmount.toLocaleString('fr-FR')}</b><span className="text-[0.6875rem] font-black uppercase text-gray-400">Montant</span></button></div>{item.attendance && <div className="mt-3 flex items-center justify-between text-[0.75rem] font-bold text-gray-400"><span>Arrivée {checkin}</span><span className="text-white/20">•</span><span>Clôture {checkout}</span><button onClick={() => setOperation({ mode: 'location', activity: item })} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-red-300 transition hover:bg-red-400/10">Voir la carte</button></div>}</article>; })}{filteredTeam.length === 0 && <div className="glass-card p-6 text-center text-sm text-gray-400">Aucun Brand Ambassador ne correspond aux filtres sélectionnés.</div>}</section>
    <MerchantBAOperationsModal isOpen={Boolean(operation)} mode={operation?.mode || 'profile'} activity={operation?.activity || null} run={run} onClose={() => setOperation(null)}/>
    <MerchantVisitedPosModal isOpen={Boolean(visitedPosActivity)} activity={visitedPosActivity} run={run} onClose={() => setVisitedPosActivity(null)}/>
    <MerchantTransactionsDetailModal isOpen={Boolean(transactionActivity)} activity={transactionActivity} onClose={() => setTransactionActivity(null)}/>
  </div>;
};
