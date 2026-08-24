import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDot, FileText, Filter, MapPin, Plus, Save, Search, Target, UserRound, UsersRound } from 'lucide-react';
import type { CampaignRun, User } from '../types';
import { getActiveCampaignRuns, getMerchantCampaign, getMerchantMonitoring, getMerchantPosControl, updateMerchantTargetSettings, type MerchantPosControlItem, type MerchantTeamActivity } from '../utils/merchantCampaign';
import { MerchantBAOperationsModal } from './Modals/MerchantBAOperationsModal';
import { MerchantPosControlDetailModal } from './Modals/MerchantPosControlDetailModal';
import { MerchantPosCreateModal } from './Modals/MerchantPosCreateModal';

interface MerchantSupervisorViewProps { currentUser: User; }
type MerchantOperation = 'profile' | 'report' | 'location' | 'calendar';
type PosFilter = 'all' | 'pending' | 'active' | 'completed';
const POOLS = ['Tous', 'Funa', 'Lukunga', 'Mont amba', 'Tshangu'] as const;
const todayIso = () => new Date().toISOString().slice(0, 10);
const POS_PAGE_SIZE = 60;

export const MerchantSupervisorView: React.FC<MerchantSupervisorViewProps> = () => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [team, setTeam] = useState<MerchantTeamActivity[]>([]);
  const [controls, setControls] = useState<MerchantPosControlItem[]>([]);
  const [query, setQuery] = useState('');
  const [pool, setPool] = useState<(typeof POOLS)[number]>('Tous');
  const [stateFilter, setStateFilter] = useState<PosFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [operation, setOperation] = useState<{ mode: MerchantOperation; activity: MerchantTeamActivity } | null>(null);
  const [selectedPos, setSelectedPos] = useState<MerchantPosControlItem | null>(null);
  const [isCreatePosOpen, setIsCreatePosOpen] = useState(false);
  const [posPage, setPosPage] = useState(1);
  const [targets, setTargets] = useState({ daily_pos_target: 15, transactions_per_pos_target: 3 });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const nextCampaign = await getMerchantCampaign();
      if (!nextCampaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(nextCampaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      if (!activeRun) throw new Error('Aucune vague Merchant active n’est disponible.');
      const [nextTeam, nextControls] = await Promise.all([getMerchantMonitoring(activeRun.id, todayIso()), getMerchantPosControl(activeRun)]);
      setRun(activeRun); setTeam(nextTeam); setControls(nextControls);
      setTargets({
        daily_pos_target: Number(activeRun.daily_pos_target || 15),
        transactions_per_pos_target: Number(activeRun.transactions_per_pos_target || 3),
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { setPosPage(1); }, [query, pool, stateFilter]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return controls.filter((item) => {
      const matchesPool = pool === 'Tous' || item.pos.pool === pool;
      const matchesState = stateFilter === 'all' || item.status === stateFilter;
      const haystack = `${item.pos.agent_number} ${item.pos.denomination} ${item.pos.address} ${item.pos.mfs_name || ''} ${item.ba?.name || ''}`.toLowerCase();
      return matchesPool && matchesState && (!needle || haystack.includes(needle));
    });
  }, [controls, pool, query, stateFilter]);
  const inventoryCounts = useMemo(() => {
    const pools = Object.fromEntries(POOLS.slice(1).map((name) => [name, 0])) as Record<string, number>;
    const statuses: Record<PosFilter, number> = { all: controls.length, pending: 0, active: 0, completed: 0 };
    controls.forEach((item) => {
      if (pools[item.pos.pool] !== undefined) pools[item.pos.pool] += 1;
      statuses[item.status] += 1;
    });
    return { pools, statuses };
  }, [controls]);
  const totalPosPages = Math.max(1, Math.ceil(filtered.length / POS_PAGE_SIZE));
  const safePosPage = Math.min(posPage, totalPosPages);
  const paginatedPos = filtered.slice((safePosPage - 1) * POS_PAGE_SIZE, safePosPage * POS_PAGE_SIZE);
  const actionButton = (activity: MerchantTeamActivity, mode: MerchantOperation, label: string, Icon: React.ElementType, enabled = true) => <button type="button" key={mode} disabled={!enabled} onClick={() => enabled && setOperation({ mode, activity })} title={label} className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${enabled ? 'border-white/10 bg-white/[0.05] text-gray-200 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100' : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-gray-600'}`}><Icon size={16}/></button>;
  const statusMeta = (item: MerchantPosControlItem) => item.status === 'completed'
    ? { label: 'Complété', className: 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100', icon: CheckCircle2 }
    : item.status === 'active'
      ? { label: 'Actif', className: 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100', icon: CircleDot }
      : { label: 'À faire', className: 'border-violet-300/35 bg-violet-500/12 text-violet-100', icon: CircleDot };

  const saveTargets = async () => {
    if (!run) return;
    setSaving(true); setError('');
    try {
      const updated = await updateMerchantTargetSettings(run.id, targets);
      setRun(updated);
      setTargets({ daily_pos_target: updated.daily_pos_target, transactions_per_pos_target: updated.transactions_per_pos_target });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement des objectifs impossible.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de la Gestion Merchant…</div>;
  return <div className="space-y-4 pb-4">
    <section className="glass-card relative overflow-hidden p-4 sm:p-5"><div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-fuchsia-400/[0.08] blur-3xl"/><div className="pointer-events-none absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-cyan-400/[0.07] blur-3xl"/><div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70">Gestion Merchant</p><h1 className="mt-1 text-xl font-black tracking-tight">Objectifs et couverture POS</h1><p className="mt-2 text-xs font-semibold text-gray-400">Paramétrez les références qui alimentent les taux d’exécution et pilotez chaque POS de la campagne.</p></div></section>
    {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}

    <section className="glass-card relative overflow-hidden p-4"><div className="pointer-events-none absolute -right-8 -bottom-12 h-36 w-36 rounded-full bg-violet-400/[0.10] blur-3xl"/><div className="relative flex items-center gap-2"><Target className="text-violet-200" size={19}/><div><h2 className="font-black">Objectifs de campagne</h2><p className="text-xs text-gray-400">Les indicateurs s’appuient sur le référentiel POS et la cadence choisie.</p></div></div><div className="relative mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-cyan-300/20 bg-cyan-500/[0.07] p-3"><span className="block text-[9px] font-black uppercase tracking-[0.1em] text-cyan-100/75">POS campagne</span><b className="mt-1 block text-xl font-black text-white">{controls.length}</b><span className="block text-[9px] font-bold text-cyan-100/55">Référentiel synchronisé</span></div>{([{ key: 'daily_pos_target', label: 'POS / BA / jour', helper: 'Cadence quotidienne', min: 1 }, { key: 'transactions_per_pos_target', label: 'Transactions / POS', helper: 'Complétion POS', min: 1 }] as const).map((field) => <label key={field.key} className="group rounded-xl border border-violet-300/20 bg-black/[0.22] p-3 transition focus-within:border-violet-200/60 focus-within:bg-violet-500/[0.08]"><span className="block text-[9px] font-black uppercase tracking-[0.1em] text-gray-400 transition group-focus-within:text-violet-100">{field.label}</span><input type="number" min={field.min} value={targets[field.key]} onChange={(event) => setTargets((current) => ({ ...current, [field.key]: Math.max(field.min, Number(event.target.value || field.min)) }))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/45 px-2 py-1.5 text-center text-xl font-black text-white outline-none transition focus:border-violet-300/60 focus:ring-1 focus:ring-violet-300/25"/><span className="mt-1 block text-[9px] font-bold text-gray-500">{field.helper}</span></label>)}</div><div className="relative mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void saveTargets()} className="inline-flex items-center gap-2 rounded-xl border border-violet-300/35 bg-violet-500/20 px-3 py-2 text-[10px] font-black uppercase text-violet-100 transition hover:bg-violet-500/30 disabled:opacity-50"><Save size={14}/>{saving ? 'Mise à jour…' : 'Enregistrer les objectifs'}</button></div></section>

    <section className="glass-card overflow-hidden transition-colors hover:bg-white/[0.035]"><button type="button" onClick={() => setAgentsOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left"><div className="flex items-center gap-2"><UsersRound className="text-cyan-200" size={19}/><div><h2 className="font-black">Agents Merchant</h2><p className="text-xs text-gray-400">Répertoire opérationnel rétractable · {team.length} BA</p></div></div>{agentsOpen ? <ChevronUp className="text-gray-300"/> : <ChevronDown className="text-gray-300"/>}</button>{agentsOpen && <div className="space-y-2 border-t border-white/10 p-4 pt-3">{team.map((activity) => <div key={activity.ba.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{activity.ba.name}</b><p className="mt-0.5 text-[10px] text-gray-400">{activity.ba.phone} · {activity.visitedPosCount} POS · {activity.transactionCount} transactions</p></div><div className="flex shrink-0 items-center gap-1.5">{actionButton(activity, 'profile', 'Détail BA', UserRound)}{actionButton(activity, 'report', 'Aperçu rapport', FileText, Boolean(activity.attendance))}{actionButton(activity, 'location', 'Carte GPS intégrée', MapPin, Boolean(activity.attendance?.checkin_latitude != null || activity.attendance?.checkout_latitude != null))}{actionButton(activity, 'calendar', 'Calendrier présence', CalendarDays)}{activity.status === 'closed' && <CheckCircle2 size={17} className="ml-1 text-emerald-300"/>}</div></div>)}{team.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-gray-500">Aucun Brand Ambassador n’est chargé pour la date courante.</p>}</div>}</section>

    <section className="merchant-inventory-shell glass-card space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Filter className="shrink-0 text-rose-200" size={19}/><div><h2 className="font-black">Inventaire et suivi des POS</h2><p className="text-xs text-gray-400">Un POS est complété à {targets.transactions_per_pos_target} transactions ; sinon il reste actif dès la première arrivée.</p></div></div><button type="button" onClick={() => setIsCreatePosOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase text-cyan-100 transition hover:bg-cyan-400/20"><Plus size={14}/>Nouveau POS</button></div><div className="grid grid-cols-3 gap-2 text-center">{([{ id: 'pending', label: 'À faire', value: inventoryCounts.statuses.pending, className: 'border-violet-300/25 bg-violet-500/[0.08] text-violet-100' }, { id: 'active', label: 'Actifs', value: inventoryCounts.statuses.active, className: 'border-cyan-300/25 bg-cyan-500/[0.08] text-cyan-100' }, { id: 'completed', label: 'Complétés', value: inventoryCounts.statuses.completed, className: 'border-emerald-300/25 bg-emerald-500/[0.08] text-emerald-100' }] as const).map((stat) => <button key={stat.id} type="button" onClick={() => setStateFilter(stat.id)} className={`rounded-2xl border p-2 transition ${stat.className} ${stateFilter === stat.id ? 'ring-1 ring-white/70' : 'opacity-80 hover:opacity-100'}`}><b className="block text-base font-black">{stat.value}</b><span className="text-[8px] font-black uppercase">{stat.label}</span></button>)}</div><div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Short code, nom, adresse, MFS ou BA" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div><div className="flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setStateFilter('all')} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${stateFilter === 'all' ? 'border-rose-300/50 bg-rose-500/20 text-rose-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>Tous · {controls.length}</button>{POOLS.map((item) => <button type="button" key={item} onClick={() => setPool(item)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${pool === item ? 'border-rose-300/50 bg-rose-500/20 text-rose-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>{item}{item !== 'Tous' ? ` · ${inventoryCounts.pools[item] || 0}` : ''}</button>)}</div><div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">{paginatedPos.map((item) => { const meta = statusMeta(item); const StatusIcon = meta.icon; return <button type="button" key={item.pos.id} onClick={() => setSelectedPos(item)} className="group w-full rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-rose-300/35 hover:bg-white/[0.055]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{item.pos.denomination}</b><p className="mt-0.5 text-[10px] font-black uppercase text-rose-200">{item.pos.agent_number} · {item.pos.pool}</p><p className="mt-1 line-clamp-1 text-[11px] text-gray-400">{item.pos.address}</p>{item.ba && <p className={`mt-1 text-[10px] font-bold ${item.status === 'completed' ? 'text-emerald-200' : 'text-cyan-200'}`}>{item.status === 'completed' ? 'Complété par ' : 'Actif avec '}{item.ba.name}</p>}</div><div className="flex shrink-0 flex-col items-end gap-2"><span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[9px] font-black uppercase ${meta.className}`}><StatusIcon size={12}/>{meta.label}</span><span className="rounded-lg bg-black/20 px-2 py-1 text-[10px] font-black text-gray-200">{item.transactionCount}/{targets.transactions_per_pos_target} Tx</span></div></div></button>; })}</div>{filtered.length > 0 && <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2"><p className="text-[10px] font-bold text-gray-400">{(safePosPage - 1) * POS_PAGE_SIZE + 1}–{Math.min(safePosPage * POS_PAGE_SIZE, filtered.length)} sur {filtered.length} POS</p><div className="flex items-center gap-1"><button type="button" onClick={() => setPosPage((page) => Math.max(1, page - 1))} disabled={safePosPage === 1} aria-label="Page précédente" className="rounded-lg border border-white/10 p-1.5 text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={14}/></button><span className="min-w-14 text-center text-[10px] font-black text-gray-200">{safePosPage}/{totalPosPages}</span><button type="button" onClick={() => setPosPage((page) => Math.min(totalPosPages, page + 1))} disabled={safePosPage === totalPosPages} aria-label="Page suivante" className="rounded-lg border border-white/10 p-1.5 text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight size={14}/></button></div></div>}</section>
    <MerchantBAOperationsModal isOpen={Boolean(operation)} mode={operation?.mode || 'profile'} activity={operation?.activity || null} run={run} onClose={() => setOperation(null)}/>
    <MerchantPosControlDetailModal item={selectedPos} transactionsPerPosTarget={targets.transactions_per_pos_target} onClose={() => setSelectedPos(null)}/>
    {run && <MerchantPosCreateModal campaignId={run.campaign_id} isOpen={isCreatePosOpen} onClose={() => setIsCreatePosOpen(false)} onCreated={() => { setIsCreatePosOpen(false); void load(); }}/>}
  </div>;
};
