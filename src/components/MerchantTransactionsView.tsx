import React, { useEffect, useState } from 'react';
import { Banknote, CalendarDays, Hash, Plus, RefreshCw, Smartphone } from 'lucide-react';
import type { BATransaction, CampaignRun, User } from '../types';
import { getActiveCampaignRuns, getMerchantCampaign, getTransactionsForBA } from '../utils/merchantCampaign';

interface MerchantTransactionsViewProps {
  currentUser: User;
  onRecordTransaction: () => void;
}

export const MerchantTransactionsView: React.FC<MerchantTransactionsViewProps> = ({ currentUser, onRecordTransaction }) => {
  const [transactions, setTransactions] = useState<BATransaction[]>([]);
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('Campagne Merchant introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      setRun(activeRun);
      setTransactions(await getTransactionsForBA(currentUser.id, activeRun?.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [currentUser.id]);

  const totalAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement des transactions…</div>;

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card relative overflow-hidden border border-cyan-300/20 p-4">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Merchant Educational Campaign</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-white">Mes transactions</h1>
              <p className="mt-1 max-w-xs text-xs font-semibold leading-relaxed text-gray-300">Historique des transactions enregistrées{run ? ` · ${run.name}` : ''}</p>
            </div>
            <button type="button" onClick={() => void refresh()} aria-label="Actualiser les transactions" className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-cyan-100 transition-colors hover:bg-white/10"><RefreshCw size={16}/></button>
          </div>
          <button type="button" onClick={onRecordTransaction} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/30 bg-cyan-300/10 px-4 py-3 text-xs font-black uppercase tracking-wide text-cyan-50 transition-all hover:bg-cyan-300/20">
            <Plus size={17} /> Enregistrer un POS / une transaction
          </button>
          <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 rounded-2xl border border-white/[0.08] bg-black/10 text-center">
            <div className="p-3"><b className="block text-lg font-black text-white">{transactions.length}</b><span className="text-[9px] font-black uppercase text-gray-400">Transactions</span></div>
            <div className="p-3"><b className="block text-lg font-black text-emerald-300">{totalAmount.toLocaleString('fr-FR')}</b><span className="text-[9px] font-black uppercase text-gray-400">Montant total</span></div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
      {!error && transactions.length === 0 && <div className="glass-card p-8 text-center text-sm text-gray-400">Aucune transaction enregistrée pour le moment.</div>}
      {transactions.map((transaction) => <article key={transaction.id} className="glass-card space-y-3 p-4"><div className="flex gap-3"><div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-200"><Banknote size={20}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="truncate text-sm font-black">{transaction.point_of_sale?.denomination || 'Marchand non renseigné'}</h2><span className="shrink-0 text-sm font-black text-emerald-300">{Number(transaction.amount).toLocaleString('fr-FR')}</span></div><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-cyan-200">Short-code · {transaction.point_of_sale?.agent_number || transaction.pos_id}</p><p className="mt-1 text-[11px] text-gray-400">{transaction.point_of_sale?.pool || 'Pool non renseigné'} · {new Date(transaction.occurred_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div><div className="grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-xl bg-white/[0.04] p-2 text-gray-300"><Smartphone className="mb-1 h-3.5 w-3.5 text-cyan-200"/><span className="block text-gray-500">N° client</span><b>{transaction.client_number || 'Non renseigné'}</b></div><div className="rounded-xl bg-white/[0.04] p-2 text-gray-300"><Hash className="mb-1 h-3.5 w-3.5 text-cyan-200"/><span className="block text-gray-500">Référence</span><b>{transaction.transaction_reference || 'À compléter'}</b></div></div>{transaction.comment && <p className="rounded-xl border border-white/8 bg-white/[0.03] p-2 text-xs text-gray-300">{transaction.comment}</p>}</article>)}
      <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-gray-500"><CalendarDays size={13}/> Les références transactionnelles peuvent être complétées ultérieurement.</div>
    </div>
  );
};
