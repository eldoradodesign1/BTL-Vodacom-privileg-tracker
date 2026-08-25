import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, CircleOff, Command, MapPin, Save, Store, X, Zap } from 'lucide-react';
import type { BAPosVisit, CampaignRun, PointOfSale, User } from '../../types';
import { MERCHANT_CAMPAIGN_CODE, recordPosArrival, updateMerchantPosMfs, uploadMerchantEvidence } from '../../utils/merchantCampaign';
import { OTHER_MFS_VALUE, sameMerchantMfs } from '../../data/merchantMfs';
import { MerchantMfsPicker } from './MerchantMfsPicker';
import { MerchantPosCommandPalette } from './MerchantPosCommandPalette';
import { ImageLightboxModal, type LightboxImage } from './ImageLightboxModal';

interface MerchantPosValidationModalProps {
  isOpen: boolean;
  currentUser: User;
  run: CampaignRun | null;
  positions: PointOfSale[];
  visits: BAPosVisit[];
  activityDate: string;
  onClose: () => void;
  onValidated: (visit: BAPosVisit) => void;
}

type Geo = { latitude: number; longitude: number; accuracy: number };
type OperationalStatus = 'active' | 'inactive';

function locate(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La localisation est indisponible sur cet appareil.'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy || 0) }),
      () => reject(new Error('La localisation GPS est nécessaire pour valider le POS.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export const MerchantPosValidationModal: React.FC<MerchantPosValidationModalProps> = ({
  isOpen, currentUser, run, positions, visits, activityDate, onClose, onValidated,
}) => {
  const [selectedPos, setSelectedPos] = useState<PointOfSale | null>(null);
  const [mfsSelection, setMfsSelection] = useState('');
  const [otherMfsName, setOtherMfsName] = useState('');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>('active');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [note, setNote] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const existingVisit = useMemo(() => selectedPos ? visits.find((visit) => visit.pos_id === selectedPos.id) || null : null, [selectedPos, visits]);
  const filteredPositions = useMemo(() => mfsSelection && mfsSelection !== OTHER_MFS_VALUE ? positions.filter((pos) => sameMerchantMfs(pos.mfs_name, mfsSelection)) : positions, [mfsSelection, positions]);
  const availableMfsNames = useMemo(() => positions.map((pos) => pos.mfs_name || '').filter(Boolean), [positions]);
  const selectedMfsName = mfsSelection === OTHER_MFS_VALUE ? otherMfsName.trim() : mfsSelection;

  const chooseMfs = (value: string) => {
    setMfsSelection(value);
    if (value !== OTHER_MFS_VALUE) setOtherMfsName('');
    if (selectedPos && value !== OTHER_MFS_VALUE && value && !sameMerchantMfs(selectedPos.mfs_name, value)) setSelectedPos(null);
    setError('');
  };

  const choosePos = (pos: PointOfSale) => {
    setSelectedPos(pos);
    setMfsSelection(pos.mfs_name?.trim() || '');
    setOtherMfsName('');
    setError('');
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setSelectedPos(null);
    setMfsSelection('');
    setOtherMfsName('');
    setOperationalStatus('active');
    setPhoto(null);
    setPreview('');
    setNote('');
    setError('');
    setIsComplete(false);
    setLightbox(null);
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choosePhoto = (file: File | null) => {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setError('');
  };

  const validate = async () => {
    setError('');
    if (!run || !selectedPos) return setError('Sélectionnez le POS à valider.');
    if (existingVisit) return setError('Ce POS a déjà été validé dans votre journée.');
    if (!photo) return setError('Prenez une photo du POS avec son numéro marchand visible.');
    if (mfsSelection === OTHER_MFS_VALUE && !selectedMfsName) return setError('Saisissez le nom du MFS concerné.');
    if (operationalStatus === 'inactive' && !note.trim()) return setError('Expliquez pourquoi ce POS est déclaré non actif.');
    setSaving(true);
    try {
      if (mfsSelection === OTHER_MFS_VALUE && selectedMfsName && !sameMerchantMfs(selectedPos.mfs_name, selectedMfsName)) await updateMerchantPosMfs(selectedPos.id, selectedMfsName);
      const geo = await locate();
      const path = await uploadMerchantEvidence(
        MERCHANT_CAMPAIGN_CODE,
        `${currentUser.id}/${activityDate}/pos-validation-${selectedPos.id}-${Date.now()}.jpg`,
        photo,
      );
      const now = new Date().toISOString();
      const visit = await recordPosArrival({
        daily_assignment_id: null,
        campaign_run_id: run.id,
        ba_id: currentUser.id,
        pos_id: selectedPos.id,
        activity_date: activityDate,
        visited_at: now,
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy_m: geo.accuracy,
        arrival_photo_path: path,
        status: 'visited',
        operational_status: operationalStatus,
        operational_confirmed_at: now,
        operational_note: note.trim() || null,
        comment: null,
      });
      onValidated(visit);
      setIsComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation du POS impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  const currentStatus = existingVisit?.operational_status === 'inactive' ? 'inactive' : 'active';

  return <div className="fixed inset-0 z-[135] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="merchant-pos-validation-title">
    <section className="modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl">
      <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-200"><Store size={21}/></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Merchant · Mes POS</p><h2 id="merchant-pos-validation-title" className="mt-1 text-lg font-black">Ajouter un POS</h2></div></div><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 disabled:opacity-40" aria-label="Fermer"><X size={18}/></button></div>
      {isComplete ? <div className="py-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={30}/></div><h3 className="mt-4 text-lg font-black">POS validé</h3><p className="mx-auto mt-2 max-w-sm text-sm text-gray-400">{operationalStatus === 'inactive' ? 'POS signalé non actif : il compte comme POS couvert et aucune activation n’est attendue.' : 'POS actif : vous pouvez maintenant y enregistrer jusqu’à trois transactions.'}</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={reset} className="rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.07] px-4 py-3 text-xs font-black uppercase text-emerald-100">Ajouter un POS</button><button type="button" onClick={onClose} className="btn-neon btn-red px-4 py-3 text-xs">Terminé</button></div></div> : <div className="mt-5 space-y-3">
        {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
        <MerchantMfsPicker value={mfsSelection} onChange={chooseMfs} disabled={saving} accent="emerald" availableNames={availableMfsNames}/>
        {mfsSelection === OTHER_MFS_VALUE && <input value={otherMfsName} onChange={(event) => { setOtherMfsName(event.target.value); setError(''); }} disabled={saving} placeholder="Nom complet du MFS" className="app-input w-full rounded-2xl px-4 py-3 text-sm" />}
        <button type="button" onClick={() => setIsPaletteOpen(true)} disabled={saving} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.07] p-3 text-left disabled:opacity-40"><div className="flex min-w-0 items-center gap-3"><Command className="shrink-0 text-emerald-200" size={19}/><div className="min-w-0"><span className="block text-[10px] font-black uppercase text-emerald-100/70">POS à valider</span><b className="block truncate text-sm">{selectedPos ? `${selectedPos.agent_number} · ${selectedPos.denomination}` : 'Rechercher un POS'}</b><span className="block truncate text-[11px] text-gray-400">{selectedPos ? `${selectedPos.address} · ${selectedPos.pool}${selectedPos.mfs_name ? ` · ${selectedPos.mfs_name}` : ''}` : mfsSelection && mfsSelection !== OTHER_MFS_VALUE ? `${filteredPositions.length} POS disponibles pour ce MFS` : 'Short-code, marchand, adresse, pool ou MFS'}</span></div></div><span className="shrink-0 rounded-xl border border-emerald-200/30 px-2 py-1 text-[10px] font-black text-emerald-100">RECHERCHER</span></button>
        {existingVisit && <div className={`rounded-2xl border p-3 text-xs font-semibold ${currentStatus === 'inactive' ? 'border-amber-300/35 bg-amber-500/10 text-amber-100' : 'border-emerald-300/30 bg-emerald-500/[0.08] text-emerald-100'}`}><b className="block text-[10px] font-black uppercase tracking-[0.12em]">POS déjà validé</b><p className="mt-1">Ce POS est déjà enregistré comme {currentStatus === 'inactive' ? 'non actif' : 'actif'} dans votre journée.</p></div>}
        {selectedPos && !existingVisit && <><section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">État constaté sur place</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setOperationalStatus('active')} className={`rounded-2xl border p-3 text-left transition ${operationalStatus === 'active' ? 'border-emerald-300/55 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/[0.06]'}`}><Zap size={17}/><b className="mt-2 block text-xs">POS actif</b><span className="mt-1 block text-[10px] leading-relaxed opacity-75">Trois activations sont attendues pour ce POS.</span></button><button type="button" onClick={() => setOperationalStatus('inactive')} className={`rounded-2xl border p-3 text-left transition ${operationalStatus === 'inactive' ? 'border-amber-300/55 bg-amber-500/15 text-amber-100' : 'border-white/10 bg-black/20 text-gray-400 hover:bg-white/[0.06]'}`}><CircleOff size={17}/><b className="mt-2 block text-xs">POS non actif</b><span className="mt-1 block text-[10px] leading-relaxed opacity-75">Il compte comme couvert, sans activations exigées.</span></button></div></section>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { choosePhoto(event.target.files?.[0] || null); event.currentTarget.value = ''; }} />
          {preview ? <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/5"><button type="button" onClick={() => setLightbox({ url: preview, alt: 'Aperçu de la validation POS' })} className="group relative block h-36 w-full overflow-hidden text-left" aria-label="Ouvrir la photo du POS en plein écran"><img src={preview} alt="Aperçu de la validation POS" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-3 pb-3 pt-8 text-[10px] font-black uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">Voir en entier</span></button><button type="button" onClick={() => photoInputRef.current?.click()} disabled={saving} className="w-full border-t border-white/10 px-3 py-2 text-[10px] font-black uppercase text-emerald-100 transition hover:bg-white/[0.06] disabled:opacity-40">Modifier la photo</button></div> : <button type="button" onClick={() => photoInputRef.current?.click()} disabled={saving} className="flex min-h-32 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/5 transition hover:border-emerald-200/50 hover:bg-white/10 disabled:opacity-40"><span className="flex items-center gap-2 text-xs font-black uppercase text-emerald-100"><Camera size={16}/>Prendre la photo du POS</span></button>}
          <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} required={operationalStatus === 'inactive'} placeholder={operationalStatus === 'inactive' ? 'Pourquoi le POS est-il non actif ? (obligatoire)' : 'Observation terrain (optionnel)'} className="app-input min-h-20 w-full rounded-2xl p-3 text-sm" />
          <p className="rounded-xl bg-black/20 px-3 py-2 text-[10px] font-semibold text-gray-400"><MapPin size={13} className="mr-1 inline text-cyan-200"/>La validation enregistre l’heure, votre position GPS et la photo de preuve.</p>
          <button type="button" disabled={saving || !photo || (operationalStatus === 'inactive' && !note.trim())} onClick={() => void validate()} className="btn-neon btn-red flex w-full items-center justify-center gap-2 disabled:opacity-40"><Save size={16}/><span>{saving ? 'Validation…' : 'Valider ce POS'}</span></button>
        </>}
      </div>}
    </section>
    <MerchantPosCommandPalette isOpen={isPaletteOpen} positions={filteredPositions} selectedPosId={selectedPos?.id} onClose={() => setIsPaletteOpen(false)} onSelect={choosePos}/>
    <ImageLightboxModal image={lightbox} onClose={() => setLightbox(null)} />
  </div>;
};
