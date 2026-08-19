import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, MapPin, Search, X } from 'lucide-react';
import type { PointOfSale } from '../../types';

interface MerchantPosCommandPaletteProps {
  isOpen: boolean;
  positions: PointOfSale[];
  selectedPosId?: string;
  onClose: () => void;
  onSelect: (pos: PointOfSale) => void;
}

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const MerchantPosCommandPalette: React.FC<MerchantPosCommandPaletteProps> = ({
  isOpen,
  positions,
  selectedPosId,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  const matches = useMemo(() => {
    const normalizedQuery = normalize(query);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (!tokens.length) return positions.slice(0, 24);

    return positions.filter((pos) => {
      const haystack = normalize([pos.agent_number, pos.denomination, pos.address, pos.pool, pos.mfs_name || '', pos.activity || ''].join(' '));
      return haystack.includes(normalizedQuery) || tokens.every((token) => haystack.includes(token));
    }).slice(0, 40);
  }, [positions, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end bg-black/75 p-0 backdrop-blur-md sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
      <section className="modal-sheet w-full max-w-xl overflow-hidden p-0 sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-cyan-200"><Command size={18}/><div><h2 className="text-sm font-black">Rechercher un POS</h2><p className="text-[10px] text-gray-400">Short-code, marchand, adresse, pool ou MFS</p></div></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18}/></button>
        </div>
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.06] px-3 py-2.5"><Search size={17} className="text-cyan-200"/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. 800044, boutique, Gombe…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"/></div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {matches.length === 0 ? <div className="p-8 text-center text-xs text-gray-400">Aucun POS ne correspond à cette recherche.</div> : matches.map((pos) => {
            const isSelected = pos.id === selectedPosId;
            return <button key={pos.id} type="button" onClick={() => { onSelect(pos); onClose(); }} className={`mb-1 w-full rounded-2xl border p-3 text-left transition ${isSelected ? 'border-cyan-300/70 bg-cyan-400/10' : 'border-white/8 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.06]'}`}>
              <div className="flex gap-3"><div className="rounded-xl bg-white/10 p-2 text-cyan-200"><MapPin size={16}/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><b className="truncate text-sm text-white">{pos.denomination}</b><span className="shrink-0 text-[10px] font-black text-cyan-200">{pos.agent_number}</span></div><p className="mt-1 truncate text-[11px] text-gray-400">{pos.address}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">{pos.pool}{pos.mfs_name ? ` · ${pos.mfs_name}` : ''}</p></div></div>
            </button>;
          })}
        </div>
        <div className="border-t border-white/10 px-4 py-2 text-[10px] text-gray-500">{positions.length} POS disponibles · recherche partielle et insensible à la casse</div>
      </section>
    </div>
  );
};
