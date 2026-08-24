import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, ChevronDown, Loader2, MapPin, Plus, Store, X } from 'lucide-react';
import type { PointOfSale } from '../../types';
import { createMerchantPos } from '../../utils/merchantCampaign';

interface MerchantPosCreateModalProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (pos: PointOfSale) => void;
}

const pools: PointOfSale['pool'][] = ['Funa', 'Mont amba', 'Tshangu', 'Lukunga'];

export const MerchantPosCreateModal: React.FC<MerchantPosCreateModalProps> = ({ campaignId, isOpen, onClose, onCreated }) => {
  const [denomination, setDenomination] = useState('');
  const [agentNumber, setAgentNumber] = useState('');
  const [address, setAddress] = useState('');
  const [pool, setPool] = useState<PointOfSale['pool']>('Mont amba');
  const [activity, setActivity] = useState('');
  const [mfsName, setMfsName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) return;
    setDenomination('');
    setAgentNumber('');
    setAddress('');
    setPool('Mont amba');
    setActivity('');
    setMfsName('');
    setLatitude('');
    setLongitude('');
    setError('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const parseCoordinate = (value: string) => value.trim() === '' ? null : Number(value);
      const nextLatitude = parseCoordinate(latitude);
      const nextLongitude = parseCoordinate(longitude);
      if ((nextLatitude == null) !== (nextLongitude == null) || (nextLatitude != null && (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)))) {
        throw new Error('Renseignez les deux coordonnées GPS, ou laissez les deux champs vides.');
      }
      const created = await createMerchantPos({
        campaign_id: campaignId,
        denomination,
        agent_number: agentNumber,
        address,
        pool,
        activity,
        mfs_name: mfsName,
        latitude: nextLatitude,
        longitude: nextLongitude,
      });
      onCreated(created);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Création du POS impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-black/75 p-0 backdrop-blur-md sm:items-center sm:justify-center sm:p-4" onClick={() => !saving && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="merchant-pos-create-title" className="modal-sheet relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-cyan-200/20 bg-[#111725]/95 p-5 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <button type="button" onClick={onClose} disabled={saving} aria-label="Fermer" className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"><X size={19}/></button>
        <div className="pr-10">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/75">Référentiel Merchant</p>
          <h2 id="merchant-pos-create-title" className="mt-1 flex items-center gap-2 text-xl font-black text-white"><Store className="text-cyan-200" size={21}/>Nouveau POS</h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-400">Ce point sera disponible immédiatement dans la gestion et dans la recherche terrain des Brand Ambassadors.</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-3">
          {error && <div className="rounded-2xl border border-red-400/35 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-[1.35fr_0.9fr]">
            <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">Dénomination</span><div className="relative"><Building2 className="pointer-events-none absolute left-3 top-3 text-cyan-200/70" size={16}/><input required value={denomination} onChange={(event) => setDenomination(event.target.value)} placeholder="Ex. Boutique Kalamu" className="app-input w-full py-3 pl-10 pr-3 text-sm"/></div></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">Short-code / n° agent</span><input required value={agentNumber} onChange={(event) => setAgentNumber(event.target.value)} placeholder="Ex. 8000410000" className="app-input w-full py-3 px-3 text-sm"/></label>
          </div>
          <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">Adresse</span><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3 text-cyan-200/70" size={16}/><input required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Ex. Avenue du Commerce, Kinshasa" className="app-input w-full py-3 pl-10 pr-3 text-sm"/></div></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">Pool</span><div className="relative"><select value={pool} onChange={(event) => setPool(event.target.value as PointOfSale['pool'])} className="app-input w-full appearance-none py-3 pl-3 pr-8 text-sm">{pools.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-gray-400" size={15}/></div></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">Activité <em className="normal-case text-gray-600">facultatif</em></span><input value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Ex. Alimentation" className="app-input w-full py-3 px-3 text-sm"/></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">MFS <em className="normal-case text-gray-600">facultatif</em></span><input value={mfsName} onChange={(event) => setMfsName(event.target.value)} placeholder="Ex. M-Pesa" className="app-input w-full py-3 px-3 text-sm"/></label>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-2"><MapPin size={15} className="text-gray-400"/><span className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Position GPS <em className="normal-case text-gray-600">facultative</em></span></div><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Latitude" className="app-input w-full px-3 py-2.5 text-sm"/><input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Longitude" className="app-input w-full px-3 py-2.5 text-sm"/></div></div>
          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/35 bg-cyan-400/15 px-4 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-400/25 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={17}/> : <Plus size={17}/>} {saving ? 'Création…' : 'Créer le POS'}</button>
          <p className="flex items-center gap-1.5 text-center text-[10px] font-semibold leading-relaxed text-gray-500"><CheckCircle2 size={12} className="shrink-0 text-emerald-300/70"/>Le POS est créé comme actif dans le référentiel central.</p>
        </form>
      </section>
    </div>
  );
};
