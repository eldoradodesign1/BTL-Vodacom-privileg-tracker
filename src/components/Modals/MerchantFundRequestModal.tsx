import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, ChevronDown, Search, Send, Store, X } from 'lucide-react';
import type { BAPosVisit, CampaignRun, PointOfSale, User } from '../../types';
import { createMerchantFundRequest, MERCHANT_FUND_REQUEST_POS_QUOTA } from '../../utils/merchantCampaign';

interface MerchantFundRequestModalProps {
  isOpen: boolean;
  currentUser: User;
  run: CampaignRun | null;
  positions: PointOfSale[];
  visits: BAPosVisit[];
  mfsName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export const MerchantFundRequestModal: React.FC<MerchantFundRequestModalProps> = ({ isOpen, currentUser, run, positions, visits, mfsName, onClose, onSubmitted }) => {
  const [posId, setPosId] = useState('');
  const [amount, setAmount] = useState('4.5');
  const [baPhone, setBaPhone] = useState(currentUser.phone || '');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [showPosList, setShowPosList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inactivePosIds = useMemo(() => new Set(visits.filter((visit) => visit.operational_status === 'inactive').map((visit) => visit.pos_id)), [visits]);
  const filteredPositions = useMemo(() => {
    const normalizedMfs = mfsName.trim().toLowerCase();
    const source = normalizedMfs ? positions.filter((pos) => (pos.mfs_name || '').trim().toLowerCase() === normalizedMfs) : positions;
    const needle = query.trim().toLowerCase();
    return source.filter((pos) => !inactivePosIds.has(pos.id) && (!needle || `${pos.denomination} ${pos.agent_number} ${pos.pool}`.toLowerCase().includes(needle)));
  }, [inactivePosIds, mfsName, positions, query]);
  const selectedPos = positions.find((pos) => pos.id === posId) || null;

  useEffect(() => {
    if (!isOpen) return;
    const mostRecentVisit = [...visits].filter((visit) => visit.operational_status !== 'inactive').sort((a, b) => String(b.visited_at || '').localeCompare(String(a.visited_at || '')))[0];
    const fallback = mostRecentVisit?.pos_id || (mfsName ? positions.find((pos) => !inactivePosIds.has(pos.id) && (pos.mfs_name || '').trim().toLowerCase() === mfsName.trim().toLowerCase())?.id : positions.find((pos) => !inactivePosIds.has(pos.id))?.id) || '';
    setPosId(fallback);
    setAmount('4.5');
    setBaPhone(currentUser.phone || '');
    setNote('');
    setQuery('');
    setShowPosList(false);
    setError('');
  }, [isOpen, visits, positions, mfsName, inactivePosIds]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!run) { setError('Aucune vague Merchant active.'); return; }
    if (!posId) { setError('Sélectionnez le POS concerné.'); return; }
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Indiquez un montant valide.'); return; }
    if (numericAmount > MERCHANT_FUND_REQUEST_POS_QUOTA) { setError(`Le quota maximal est de ${MERCHANT_FUND_REQUEST_POS_QUOTA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $ par POS.`); return; }
    setSaving(true);
    setError('');
    try {
      await createMerchantFundRequest({
        campaign_run_id: run.id,
        ba_id: currentUser.id,
        supervisor_id: currentUser.supervisorId || null,
        pos_id: posId,
        mfs_name: mfsName || null,
        ba_phone: baPhone.trim() || null,
        amount: numericAmount,
        note: [baPhone.trim() && baPhone.trim() !== (currentUser.phone || '').trim() ? `N° BA renseigné : ${baPhone.trim()}` : '', note.trim()].filter(Boolean).join(' · ') || null,
      });
      onSubmitted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’envoyer la demande de fonds.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[135] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fund-request-title">
    <section className="glass-card max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-emerald-300/25 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
      <header className="modal-sticky-header flex items-start justify-between gap-4 p-4 sm:p-5">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Merchant Educational Campaign</p><h2 id="fund-request-title" className="mt-1 text-lg font-black text-white">Demande de fonds</h2><p className="mt-1 text-xs text-gray-300">Les informations préremplies restent éditables avant envoi.</p></div>
        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button>
      </header>
      <div className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3"><span className="text-[9px] font-black uppercase text-gray-500">BA</span><b className="mt-1 block text-xs text-white">{currentUser.name}</b></div><label className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3"><span className="text-[9px] font-black uppercase text-gray-500">Numéro BA</span><input value={baPhone} onChange={(event) => setBaPhone(event.target.value)} inputMode="tel" placeholder="Numéro BA" className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none placeholder:text-gray-600"/><span className="mt-1 block text-[8px] text-gray-500">Modifiable ; la variation est ajoutée à la note.</span></label></div>
        <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/[0.06] px-3 py-2"><span className="text-[9px] font-black uppercase text-fuchsia-200/75">MFS qui accompagne</span><b className="mt-1 block text-xs text-fuchsia-50">{mfsName || 'MFS non renseigné'}</b></div>
        <div><label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-gray-400">POS concerné</label><button type="button" onClick={() => setShowPosList((value) => !value)} className="app-input flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm"><span className="min-w-0"><b className="block truncate text-white">{selectedPos?.denomination || 'Sélectionner un POS'}</b><span className="mt-0.5 block truncate text-[10px] text-gray-400">{selectedPos ? `${selectedPos.agent_number} · ${selectedPos.pool}` : 'Dernier POS renseigné proposé'}</span></span><ChevronDown size={18} className="shrink-0 text-emerald-200"/></button>{showPosList && <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90"><div className="relative border-b border-white/10"><Search size={15} className="absolute left-3 top-3 text-gray-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un POS" className="w-full bg-transparent py-2.5 pl-9 pr-3 text-xs text-white outline-none"/></div><div className="max-h-48 overflow-y-auto p-1.5">{filteredPositions.map((pos) => <button key={pos.id} type="button" onClick={() => { setPosId(pos.id); setShowPosList(false); }} className={`w-full rounded-xl px-3 py-2.5 text-left transition ${pos.id === posId ? 'bg-emerald-400/15 text-emerald-50' : 'hover:bg-white/[0.06] text-gray-200'}`}><b className="block text-xs">{pos.denomination}</b><span className="mt-0.5 block text-[10px] opacity-70">{pos.agent_number} · {pos.pool}</span></button>)}{filteredPositions.length === 0 && <p className="p-3 text-xs text-gray-500">Aucun POS ne correspond au MFS sélectionné.</p>}</div></div>}</div>
        <div><label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-gray-400">Montant demandé ($) <span className="normal-case text-emerald-200">· quota POS : {MERCHANT_FUND_REQUEST_POS_QUOTA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $</span></label><div className="relative"><Banknote size={17} className="absolute left-3 top-3.5 text-emerald-200"/><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Ex. 4,5" className="app-input w-full rounded-2xl py-3 pl-9 pr-3 text-sm"/></div></div>
        <div><label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-gray-400">Note <span className="normal-case text-gray-500">(facultatif)</span></label><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Précision utile pour le superviseur" className="app-input w-full resize-none rounded-2xl px-3 py-3 text-sm"/></div>
        {error && <p className="rounded-2xl border border-red-400/40 bg-red-950/40 p-3 text-xs font-bold text-red-200">{error}</p>}
        <button type="button" onClick={() => void submit()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/45 bg-emerald-400/15 px-4 py-3.5 text-xs font-black uppercase tracking-wide text-emerald-50 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-45"><Send size={16}/>{saving ? 'Envoi…' : 'Envoyer la demande'}</button>
      </div>
    </section>
  </div>;
};
