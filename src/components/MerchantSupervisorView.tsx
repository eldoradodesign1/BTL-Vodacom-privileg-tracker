import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Search, UsersRound } from 'lucide-react';
import type { Campaign, CampaignRun, PointOfSale, User } from '../types';
import { getActiveCampaignRuns, getCampaignPos, getMerchantCampaign } from '../utils/merchantCampaign';

interface MerchantSupervisorViewProps {
  currentUser: User;
}

const POOLS = ['Tous', 'Funa', 'Lukunga', 'Mont amba'] as const;

export const MerchantSupervisorView: React.FC<MerchantSupervisorViewProps> = () => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [pos, setPos] = useState<PointOfSale[]>([]);
  const [query, setQuery] = useState('');
  const [pool, setPool] = useState<(typeof POOLS)[number]>('Tous');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const nextCampaign = await getMerchantCampaign();
        if (!nextCampaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
        const [runs, items] = await Promise.all([
          getActiveCampaignRuns(nextCampaign.id),
          getCampaignPos(nextCampaign.id),
        ]);
        setCampaign(nextCampaign);
        setRun(runs.find((item) => item.status === 'active') || runs[0] || null);
        setPos(items);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pos.filter((item) => {
      const matchesPool = pool === 'Tous' || item.pool === pool;
      const haystack = `${item.agent_number} ${item.denomination} ${item.address} ${item.mfs_name || ''}`.toLowerCase();
      return matchesPool && (!needle || haystack.includes(needle));
    });
  }, [pos, pool, query]);

  const poolCounts = useMemo(() => POOLS.slice(1).map((name) => ({ name, count: pos.filter((item) => item.pool === name).length })), [pos]);

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de la campagne Merchant…</div>;

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card overflow-hidden p-0">
        <div className="bg-gradient-to-br from-violet-800 via-fuchsia-700 to-orange-500 p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">Pilotage opérationnel</p>
          <h1 className="mt-1 text-xl font-black tracking-tight">Merchant Educational Campaign</h1>
          <p className="mt-2 text-xs font-semibold text-white/80">{run ? `${run.name} · démarrage ${new Date(`${run.starts_on}T12:00:00`).toLocaleDateString('fr-FR')}` : 'Vague à planifier'} · Objectif : 15 POS / BA / jour</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 bg-black/15 text-center">
          <div className="p-3"><b className="block text-lg font-black">{pos.length}</b><span className="text-[9px] font-black uppercase text-gray-400">POS importés</span></div>
          <div className="p-3"><b className="block text-lg font-black text-amber-300">{run?.daily_pos_target || 15}</b><span className="text-[9px] font-black uppercase text-gray-400">POS / BA / jour</span></div>
          <div className="p-3"><b className="block text-lg font-black text-emerald-300">{run?.transactions_per_pos_target || 3}</b><span className="text-[9px] font-black uppercase text-gray-400">Transactions / POS</span></div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}

      <section className="glass-card grid grid-cols-2 gap-2 p-4 text-xs"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><span className="block text-[9px] font-black uppercase text-gray-500">Équipe active</span><b className="mt-1 block text-sm">6 Brand Ambassadors</b></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><span className="block text-[9px] font-black uppercase text-gray-500">Mode de travail</span><b className="mt-1 block text-sm text-cyan-200">POS libre</b><p className="mt-1 text-[10px] text-gray-400">Les BA recherchent directement le POS concerné.</p></div></section>

      <section className="glass-card space-y-3 p-4">
        <div className="flex items-center gap-2"><UsersRound className="text-red-300" size={19}/><div><h2 className="font-black">Base POS complète</h2><p className="text-xs text-gray-400">Inventaire importé depuis la base Merchant Education.</p></div></div>
        <div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Short code, nom, adresse ou MFS" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{POOLS.map((item) => <button key={item} onClick={() => setPool(item)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${pool === item ? 'border-red-400 bg-red-500 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}>{item}{item !== 'Tous' ? ` · ${poolCounts.find((count) => count.name === item)?.count || 0}` : ` · ${pos.length}`}</button>)}</div>
        <div className="max-h-[31rem] space-y-2 overflow-y-auto pr-1">{filtered.slice(0, 150).map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm">{item.denomination}</b><p className="mt-0.5 text-[10px] font-black uppercase text-red-300">{item.agent_number} · {item.pool}</p><p className="mt-1 text-[11px] text-gray-400">{item.address}</p>{item.mfs_name && <p className="mt-1 text-[10px] text-gray-500">MFS : {item.mfs_name}</p>}</div><Filter size={15} className="shrink-0 text-gray-500"/></div></article>)}</div>
        {filtered.length > 150 && <p className="text-center text-[10px] font-bold text-gray-500">Affichage des 150 premiers résultats sur {filtered.length}. Affinez votre recherche.</p>}
      </section>
    </div>
  );
};
