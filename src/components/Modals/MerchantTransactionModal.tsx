import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Command, MapPin, Save, Store, X } from 'lucide-react';
import type { BAPosVisit, CampaignRun, PointOfSale, User } from '../../types';
import { createTransaction, MERCHANT_CAMPAIGN_CODE, recordPosArrival, uploadMerchantEvidence } from '../../utils/merchantCampaign';
import { MerchantPosCommandPalette } from './MerchantPosCommandPalette';

interface MerchantTransactionModalProps {
  isOpen: boolean;
  currentUser: User;
  run: CampaignRun | null;
  positions: PointOfSale[];
  visits: BAPosVisit[];
  activityDate: string;
  onClose: () => void;
  onRecorded: () => void;
  onPosArrivalRecorded: (visit: BAPosVisit) => void;
}

type Geo = { latitude: number; longitude: number; accuracy: number };

function locate(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La géolocalisation est indisponible.'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy || 0) }),
      () => reject(new Error('La localisation est nécessaire pour enregistrer la transaction.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export const MerchantTransactionModal: React.FC<MerchantTransactionModalProps> = ({
  isOpen,
  currentUser,
  run,
  positions,
  visits,
  activityDate,
  onClose,
  onRecorded,
  onPosArrivalRecorded,
}) => {
  const [selectedPos, setSelectedPos] = useState<PointOfSale | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [comment, setComment] = useState('');
  const [transactionPhoto, setTransactionPhoto] = useState<File | null>(null);
  const [arrivalPhoto, setArrivalPhoto] = useState<File | null>(null);
  const [createdVisit, setCreatedVisit] = useState<BAPosVisit | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const transactionInputRef = useRef<HTMLInputElement | null>(null);
  const arrivalInputRef = useRef<HTMLInputElement | null>(null);

  const existingVisit = useMemo(() => selectedPos ? visits.find((visit) => visit.pos_id === selectedPos.id) || null : null, [selectedPos, visits]);
  const posVisit = createdVisit || existingVisit;

  const resetForm = () => {
    setSelectedPos(null);
    setAmount('');
    setReference('');
    setClientNumber('');
    setComment('');
    setTransactionPhoto(null);
    setArrivalPhoto(null);
    setCreatedVisit(null);
    setError('');
    setIsComplete(false);
  };

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen]);

  const choosePos = (pos: PointOfSale) => {
    setSelectedPos(pos);
    setCreatedVisit(null);
    setArrivalPhoto(null);
    setError('');
  };

  const saveArrival = async () => {
    setError('');
    if (!run || !selectedPos) {
      setError('Sélectionnez un POS avant d’enregistrer son arrivée.');
      return;
    }
    if (!arrivalPhoto) {
      setError('Ajoutez la photo d’arrivée du POS.');
      return;
    }

    setSaving(true);
    try {
      const geo = await locate();
      const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${activityDate}/pos-arrival-${selectedPos.id}-${Date.now()}.jpg`, arrivalPhoto);
      const visit = await recordPosArrival({
        daily_assignment_id: null,
        campaign_run_id: run.id,
        ba_id: currentUser.id,
        pos_id: selectedPos.id,
        activity_date: activityDate,
        visited_at: new Date().toISOString(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy_m: geo.accuracy,
        arrival_photo_path: path,
        status: 'visited',
        comment: null,
      });
      setCreatedVisit(visit);
      onPosArrivalRecorded(visit);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Arrivée au POS impossible.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setError('');
    if (!run || !selectedPos || !posVisit) {
      setError('Validez d’abord votre arrivée au POS avec la photo et la position GPS.');
      return;
    }
    if (!clientNumber.trim()) {
      setError('Saisissez le numéro du client.');
      return;
    }
    if (!transactionPhoto) {
      setError('Ajoutez la capture de la transaction.');
      return;
    }
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Saisissez un montant valide.');
      return;
    }

    setSaving(true);
    try {
      const geo = await locate();
      const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${activityDate}/transaction-${Date.now()}.jpg`, transactionPhoto);
      await createTransaction({
        campaign_run_id: run.id,
        ba_id: currentUser.id,
        pos_id: selectedPos.id,
        pos_visit_id: posVisit.id,
        transaction_reference: reference.trim() || null,
        client_number: clientNumber.trim(),
        amount: numericAmount,
        evidence_path: path,
        occurred_at: new Date().toISOString(),
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy_m: geo.accuracy,
        comment: comment.trim() || null,
        status: 'recorded',
      });
      setIsComplete(true);
      onRecorded();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transaction impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="merchant-transaction-title">
      <section className="modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-200"><Command size={21} /></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Merchant</p><h2 id="merchant-transaction-title" className="mt-1 text-lg font-black">Nouvelle transaction</h2></div></div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 disabled:opacity-40" aria-label="Fermer"><X size={18} /></button>
        </div>

        {isComplete ? (
          <div className="py-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={30} /></div><h3 className="mt-4 text-lg font-black">Transaction enregistrée</h3><p className="mt-2 text-sm text-gray-400">La capture est liée au POS et à son pointage d’arrivée photo/GPS.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={resetForm} className="rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.07] px-4 py-3 text-xs font-black uppercase text-cyan-100">Nouvelle transaction</button><button type="button" onClick={onClose} className="btn-neon btn-red px-4 py-3 text-xs">Terminé</button></div></div>
        ) : (
          <div className="mt-5 space-y-3">
            {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
            <button type="button" onClick={() => setIsPaletteOpen(true)} disabled={saving} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.07] p-3 text-left disabled:opacity-40"><div className="flex min-w-0 items-center gap-3"><Command className="shrink-0 text-cyan-200" size={19}/><div className="min-w-0"><span className="block text-[10px] font-black uppercase text-cyan-100/70">POS sélectionné</span><b className="block truncate text-sm">{selectedPos ? `${selectedPos.agent_number} · ${selectedPos.denomination}` : 'Rechercher un POS'}</b><span className="block truncate text-[11px] text-gray-400">{selectedPos ? `${selectedPos.address} · ${selectedPos.pool}` : 'Short-code, marchand, adresse, pool ou MFS'}</span></div></div><span className="shrink-0 rounded-xl border border-cyan-200/30 px-2 py-1 text-[10px] font-black text-cyan-100">RECHERCHER</span></button>

            {selectedPos && !posVisit && <section className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-4"><div className="flex items-center gap-2 text-amber-100"><Store size={17}/><b className="text-xs uppercase tracking-wide">Arrivée au nouveau POS</b></div><p className="mt-2 text-xs leading-relaxed text-gray-300">Prenez une photo du POS. L’heure et votre position GPS seront enregistrées avant la première transaction.</p><input ref={arrivalInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { setArrivalPhoto(event.target.files?.[0] || null); event.currentTarget.value = ''; }} /><button type="button" onClick={() => arrivalInputRef.current?.click()} disabled={saving} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/30 bg-white/5 px-4 py-3 text-xs font-black uppercase text-amber-100 transition hover:bg-white/10 disabled:opacity-40"><Camera size={16}/>{arrivalPhoto ? 'Photo d’arrivée confirmée' : 'Prendre la photo du POS'}</button>{arrivalPhoto && <button type="button" disabled={saving} onClick={saveArrival} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-xs font-black uppercase text-slate-950 transition hover:bg-amber-200 disabled:opacity-40"><MapPin size={16}/>{saving ? 'Pointage de l’arrivée…' : 'Valider l’arrivée au POS'}</button>}</section>}

            {selectedPos && posVisit && <><div className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-2 text-[11px] font-bold text-emerald-200"><CheckCircle2 size={15}/> Arrivée POS validée à {posVisit.visited_at ? new Date(posVisit.visited_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'maintenant'}.</div><div className="grid grid-cols-2 gap-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} disabled={saving} inputMode="decimal" placeholder="Montant" className="app-input rounded-2xl px-4 py-3 text-sm"/><input value={clientNumber} onChange={(event) => setClientNumber(event.target.value)} disabled={saving} inputMode="tel" placeholder="N° client" className="app-input rounded-2xl px-4 py-3 text-sm"/></div><input value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} placeholder="N° transaction (optionnel)" className="app-input w-full rounded-2xl px-4 py-3 text-sm"/><input value={comment} onChange={(event) => setComment(event.target.value)} disabled={saving} placeholder="Commentaire (optionnel)" className="app-input w-full rounded-2xl px-4 py-3 text-sm"/><input ref={transactionInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { setTransactionPhoto(event.target.files?.[0] || null); event.currentTarget.value = ''; }} /><button type="button" onClick={() => transactionInputRef.current?.click()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase transition hover:bg-white/10 disabled:opacity-40"><Camera size={16}/>{transactionPhoto ? 'Capture confirmée — prête à enregistrer' : 'Ajouter la capture de transaction'}</button>{transactionPhoto && <p className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-2 text-center text-[11px] font-bold text-emerald-200">{transactionPhoto.name}</p>}<button type="button" disabled={saving || !transactionPhoto} onClick={save} className="btn-neon btn-red flex w-full items-center justify-center gap-2 disabled:opacity-40"><Save size={16}/><span>{saving ? 'Enregistrement…' : 'Enregistrer la transaction'}</span></button></>}
          </div>
        )}
      </section>
      <MerchantPosCommandPalette isOpen={isPaletteOpen} positions={positions} selectedPosId={selectedPos?.id} onClose={() => setIsPaletteOpen(false)} onSelect={choosePos} />
    </div>
  );
};
