import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, FileText, Filter, MapPin, Search, UserRound, UsersRound } from 'lucide-react';
import type { Campaign, CampaignRun, PointOfSale, User } from '../types';
import { getActiveCampaignRuns, getCampaignPos, getMerchantCampaign, getMerchantMonitoring, type MerchantTeamActivity } from '../utils/merchantCampaign';
import { MerchantBAOperationsModal } from './Modals/MerchantBAOperationsModal';

interface MerchantSupervisorViewProps { currentUser: User; }
type MerchantOperation = 'profile' | 'report' | 'location' | 'calendar';
const POOLS = ['Tous', 'Funa', 'Lukunga', 'Mont amba'] as const;
const todayIso = () => new Date().toISOString().slice(0, 10);

export const MerchantSupervisorView: React.FC<MerchantSupervisorViewProps> = () => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [pos, setPos] = useState<PointOfSale[]>([]);
  const [team, setTeam] = useState<MerchantTeamActivity[]>([]);
  const [query, setQuery] = useState('');
  const [pool, setPool] = useState<(typeof POOLS)[number]>('Tous');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<{ mode: MerchantOperation; activity: MerchantTeamActivity } | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const nextCampaign = await getMerchantCampaign();
      if (!nextCampaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const [runs, items] = await Promise.all([getActiveCampaignRuns(nextCampaign.id), getCampaignPos(nextCampaign.id)]);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      setCampaign(nextCampaign); setRun(activeRun); setPos(items); setTeam(activeRun ? await getMerchantMonitoring(activeRun.id, todayIso()) : []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return pos.filter((item) => { const matchesPool = pool === 'Tous' || item.pool === pool; const haystack = `${item.agent_number} ${item.denomination} ${item.address} ${item.mfs_name || ''}`.toLowerCase(); return matchesPool && (!needle || haystack.includes(needle)); }); }, [pos, pool, query]);
  const poolCounts = useMemo(() => POOLS.slice(1).map((name) => ({ name, count: pos.filter((item) => item.pool === name).length })), [pos]);
  const actionButton = (activity: MerchantTeamActivity, mode: MerchantOperation, label: string, Icon: React.ElementType, enabled = true) => <button type="button" key={mode} disabled={!enabled} onClick={() => enabled && setOperation({ mode, activity })} title={label} className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${enabled ? 'border-white/10 bg-white/[0.05] text-gray-200 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100' : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-gray-600'}`}><Icon size={16}/></button>;

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de la campagne Merchant…</div>;
  return <div className="space-y-4 pb-4">
    <section className="glass-card relative overflow-hidden p-4 sm:p-5"><div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-fuchsia-400/[0.08] blur-3xl"/><div className="pointer-events-none absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-orange-400/[0.06] blur-3xl"/><div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/70">Pilotage opérationnel</p><h1 className="mt-1 text-xl font-black tracking-tight">Merchant Educational Campaign</h1><p className="mt-2 text-xs font-semibold text-gray-400">Démarrage {run ? new Date(`${run.starts_on}T12:00:00`).toLocaleDateString('fr-FR') : 'à planifier'} · Objectif : 15 POS / BA / jour</p></div><div className="relative mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3"><b className="block text-lg font-black text-white">{pos.length}</b><span className="text-[9px] font-black uppercase text-gray-400">POS importés</span></div><div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-3"><b className="block text-lg font-black text-amber-200">{run?.daily_pos_target || 15}</b><span className="text-[9px] font-black uppercase text-gray-400">POS / BA / jour</span></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3"><b className="block text-lg font-black text-emerald-200">{run?.transactions_per_pos_target || 3}</b><span className="text-[9px] font-black uppercase text-gray-400">Transactions / POS</span></div></div></section>
    {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}
    <section className="glass-card grid grid-cols-1 gap-2 p-4 text-xs sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><span className="block text-[9px] font-black uppercase text-gray-500">Équipe active</span><b className="mt-1 block text-sm">{team.length} Brand Ambassadors</b><p className="mt-1 text-[10px] text-gray-400">Suivi global de la journée depuis Monitoring.</p></div><div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-3"><span className="block text-[9px] font-black uppercase text-gray-500">Mode de travail</span><b className="mt-1 block text-sm text-cyan-200">POS libre</b><p className="mt-1 text-[10px] text-gray-400">Les BA recherchent directement le POS concerné.</p></div></section>
    <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-2"><UsersRound className="text-cyan-200" size={19}/><div><h2 className="font-black">Gestion des Brand Ambassadors</h2><p className="text-xs text-gray-400">Accédez à la fiche, au rapport, à la carte et au registre de chaque BA.</p></div></div><div className="space-y-2">{team.map((activity) => <div key={activity.ba.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{activity.ba.name}</b><p className="mt-0.5 text-[10px] text-gray-400">{activity.ba.phone} · {activity.transactionCount} transactions aujourd’hui</p></div><div className="flex shrink-0 items-center gap-1.5">{actionButton(activity, 'profile', 'Détail BA', UserRound)}{actionButton(activity, 'report', 'Aperçu rapport', FileText, Boolean(activity.attendance))}{actionButton(activity, 'location', 'Carte GPS intégrée', MapPin, Boolean(activity.attendance?.checkin_latitude != null || activity.attendance?.checkout_latitude != null))}{actionButton(activity, 'calendar', 'Calendrier présence', CalendarDays)}{activity.status === 'closed' && <CheckCircle2 size={17} className="ml-1 text-emerald-300"/>}</div></div>)}{team.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-gray-500">Aucun Brand Ambassador n’est chargé pour la date courante.</p>}</div></section>
    <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-2"><UsersRound className="text-red-300" size={19}/><div><h2 className="font-black">Base POS complète</h2><p className="text-xs text-gray-400">Inventaire importé depuis la base Merchant Education.</p></div></div><div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Short code, nom, adresse ou MFS" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div><div className="flex gap-2 overflow-x-auto pb-1">{POOLS.map((item) => <button key={item} onClick={() => setPool(item)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${pool === item ? 'border-red-400 bg-red-500 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}>{item}{item !== 'Tous' ? ` · ${poolCounts.find((count) => count.name === item)?.count || 0}` : ` · ${pos.length}`}</button>)}</div><div className="max-h-[31rem] space-y-2 overflow-y-auto pr-1">{filtered.slice(0, 150).map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm">{item.denomination}</b><p className="mt-0.5 text-[10px] font-black uppercase text-red-300">{item.agent_number} · {item.pool}</p><p className="mt-1 text-[11px] text-gray-400">{item.address}</p>{item.mfs_name && <p className="mt-1 text-[10px] text-gray-500">MFS : {item.mfs_name}</p>}</div><Filter size={15} className="shrink-0 text-gray-500"/></div></article>)}</div>{filtered.length > 150 && <p className="text-center text-[10px] font-bold text-gray-500">Affichage des 150 premiers résultats sur {filtered.length}. Affinez votre recherche.</p>}</section>
    <MerchantBAOperationsModal isOpen={Boolean(operation)} mode={operation?.mode || 'profile'} activity={operation?.activity || null} run={run} onClose={() => setOperation(null)}/>
  </div>;
};
