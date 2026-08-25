import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserRoundSearch, UsersRound, X } from 'lucide-react';
import { MERCHANT_MFS_OPTIONS, OTHER_MFS_VALUE, merchantMfsLabel, normalizeMerchantMfs } from '../../data/merchantMfs';

interface MerchantMfsPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  accent?: 'emerald' | 'cyan';
  availableNames?: string[];
}

export const MerchantMfsPicker: React.FC<MerchantMfsPickerProps> = ({ value, onChange, disabled = false, accent = 'cyan', availableNames = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const palette = accent === 'emerald'
    ? 'border-emerald-300/30 bg-emerald-400/[0.07] text-emerald-100'
    : 'border-cyan-300/30 bg-cyan-400/[0.07] text-cyan-100';
  const softText = accent === 'emerald' ? 'text-emerald-200' : 'text-cyan-200';

  const options = useMemo(() => {
    const byKey = new Map<string, string>();
    [...MERCHANT_MFS_OPTIONS, ...availableNames.filter(Boolean)].forEach((name) => byKey.set(normalizeMerchantMfs(name), name.trim()));
    return Array.from(byKey.values()).sort((left, right) => left.localeCompare(right, 'fr'));
  }, [availableNames]);
  const filtered = useMemo(() => {
    const needle = normalizeMerchantMfs(query);
    return needle ? options.filter((name) => normalizeMerchantMfs(name).includes(needle)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  return <>
    <button type="button" onClick={() => setIsOpen(true)} disabled={disabled} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-40 ${palette}`}>
      <div className="flex min-w-0 items-center gap-3"><UsersRound className="shrink-0" size={19}/><div className="min-w-0"><span className="block text-[10px] font-black uppercase opacity-70">MFS concerné</span><b className="block truncate text-sm">{merchantMfsLabel(value)}</b><span className="block truncate text-[11px] text-gray-400">{value === OTHER_MFS_VALUE ? 'Saisissez le nom du MFS' : value ? 'Les POS sont filtrés selon ce MFS' : 'Sélectionnez un MFS ou recherchez tous les POS'}</span></div></div>
      <span className="shrink-0 rounded-xl border border-current/30 px-2 py-1 text-[10px] font-black">CHOISIR</span>
    </button>
    {isOpen && <div className="fixed inset-0 z-[145] flex items-end bg-black/75 p-0 backdrop-blur-md sm:items-center sm:justify-center sm:p-4" onClick={() => setIsOpen(false)}>
      <section className="modal-sheet w-full max-w-xl overflow-hidden p-0 sm:rounded-3xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sélectionner un MFS">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className={`flex items-center gap-2 ${softText}`}><UserRoundSearch size={18}/><div><h2 className="text-sm font-black">Sélectionner un MFS</h2><p className="text-[10px] text-gray-400">Le choix limite la liste des POS disponibles.</p></div></div><button type="button" onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-gray-400 transition hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={18}/></button></div>
        <div className="border-b border-white/10 p-3"><div className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 ${palette}`}><Search size={17}/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un MFS…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"/></div></div>
        <div className="max-h-[60vh] overflow-y-auto p-2"><button type="button" onClick={() => { onChange(''); setIsOpen(false); }} className={`mb-1 w-full rounded-2xl border p-3 text-left transition ${!value ? 'border-white/45 bg-white/[0.09]' : 'border-white/8 bg-white/[0.025] hover:bg-white/[0.06]'}`}><b className="text-sm text-white">Tous les MFS</b><span className="mt-1 block text-[10px] text-gray-400">Afficher tout le référentiel POS</span></button>{filtered.map((name) => <button key={name} type="button" onClick={() => { onChange(name); setIsOpen(false); }} className={`mb-1 w-full rounded-2xl border p-3 text-left transition ${normalizeMerchantMfs(value) === normalizeMerchantMfs(name) ? 'border-white/45 bg-white/[0.09]' : 'border-white/8 bg-white/[0.025] hover:bg-white/[0.06]'}`}><b className="text-sm text-white">{name}</b></button>)}{filtered.length === 0 && <p className="p-6 text-center text-xs text-gray-400">Aucun MFS ne correspond à cette recherche.</p>}<button type="button" onClick={() => { onChange(OTHER_MFS_VALUE); setIsOpen(false); }} className={`mt-1 w-full rounded-2xl border p-3 text-left transition ${value === OTHER_MFS_VALUE ? 'border-amber-300/55 bg-amber-500/[0.12]' : 'border-amber-300/20 bg-amber-500/[0.05] hover:bg-amber-500/[0.1]'}`}><b className="text-sm text-amber-100">Autre MFS</b><span className="mt-1 block text-[10px] text-amber-100/70">Saisir un nom manuellement et afficher tous les POS</span></button></div>
      </section>
    </div>}
  </>;
};
