import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Command, ImageIcon, MapPin, Save, Sparkles, Store, X } from 'lucide-react';
import type { BAPosVisit, CampaignRun, PointOfSale, User } from '../../types';
import { createTransaction, MERCHANT_CAMPAIGN_CODE, recordPosArrival, uploadMerchantEvidence } from '../../utils/merchantCampaign';
import { MerchantPosCommandPalette } from './MerchantPosCommandPalette';
import { cleanPhoneNumber, formatMsisdn, isValidMsisdn } from '../../utils/phoneValidator';
import { identifyTransactionReference } from '../../utils/geminiOcr';
import { ImageLightboxModal, type LightboxImage } from './ImageLightboxModal';

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
type OcrState = 'idle' | 'scanning' | 'found' | 'unreadable' | 'date_mismatch' | 'unavailable';

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

const previewFor = (file: File) => URL.createObjectURL(file);

export const MerchantTransactionModal: React.FC<MerchantTransactionModalProps> = ({
  isOpen, currentUser, run, positions, visits, activityDate, onClose, onRecorded, onPosArrivalRecorded,
}) => {
  const [selectedPos, setSelectedPos] = useState<PointOfSale | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [comment, setComment] = useState('');
  const [transactionPhoto, setTransactionPhoto] = useState<File | null>(null);
  const [arrivalPhoto, setArrivalPhoto] = useState<File | null>(null);
  const [arrivalPreview, setArrivalPreview] = useState('');
  const [transactionPreview, setTransactionPreview] = useState('');
  const [ocrState, setOcrState] = useState<OcrState>('idle');
  const [createdVisit, setCreatedVisit] = useState<BAPosVisit | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const transactionInputRef = useRef<HTMLInputElement | null>(null);
  const arrivalInputRef = useRef<HTMLInputElement | null>(null);
  const referenceLatestRef = useRef('');
  const clientNumberLatestRef = useRef('');

  const existingVisit = useMemo(() => selectedPos ? visits.find((visit) => visit.pos_id === selectedPos.id) || null : null, [selectedPos, visits]);
  const posVisit = createdVisit || existingVisit;
  const hasUnreadableReference = reference === 'N° transaction illisible' || reference === 'N° transaction — date non conforme' || ocrState === 'unreadable' || ocrState === 'date_mismatch';

  const releasePreview = (url: string) => { if (url) URL.revokeObjectURL(url); };
  const resetForm = () => {
    releasePreview(arrivalPreview);
    releasePreview(transactionPreview);
    referenceLatestRef.current = '';
    clientNumberLatestRef.current = '';
    setSelectedPos(null); setAmount(''); setReference(''); setClientNumber(''); setComment('');
    setTransactionPhoto(null); setArrivalPhoto(null); setArrivalPreview(''); setTransactionPreview('');
    setOcrState('idle'); setCreatedVisit(null); setError(''); setIsComplete(false); setLightbox(null);
  };

  useEffect(() => { if (isOpen) resetForm(); }, [isOpen]);
  useEffect(() => { referenceLatestRef.current = reference; }, [reference]);
  useEffect(() => { clientNumberLatestRef.current = clientNumber; }, [clientNumber]);
  useEffect(() => () => { releasePreview(arrivalPreview); releasePreview(transactionPreview); }, [arrivalPreview, transactionPreview]);

  const choosePos = (pos: PointOfSale) => {
    setSelectedPos(pos); setCreatedVisit(null); releasePreview(arrivalPreview); setArrivalPhoto(null); setArrivalPreview(''); setError('');
  };

  const chooseArrivalPhoto = (file: File | null) => {
    if (!file) return;
    releasePreview(arrivalPreview);
    setArrivalPhoto(file);
    setArrivalPreview(previewFor(file));
    setError('');
  };

  const chooseTransactionPhoto = (file: File | null) => {
    if (!file) return;
    releasePreview(transactionPreview);
    setTransactionPhoto(file);
    setTransactionPreview(previewFor(file));
    setError('');
    if (referenceLatestRef.current.trim() && clientNumberLatestRef.current.trim()) {
      setOcrState('idle');
      return;
    }
    setOcrState('scanning');
    void identifyTransactionReference(file, activityDate).then((result) => {
      const referenceWasEntered = Boolean(referenceLatestRef.current.trim());
      if (!result.available) { if (!referenceWasEntered) setOcrState('unavailable'); return; }
      if (result.status === 'date_mismatch') {
        if (!referenceWasEntered) {
          const alert = 'N° transaction — date non conforme';
          referenceLatestRef.current = alert;
          setReference(alert);
          setOcrState('date_mismatch');
        }
        return;
      }
      if (result.clientNumber && !clientNumberLatestRef.current.trim()) {
        const suggestedNumber = formatMsisdn(cleanPhoneNumber(result.clientNumber));
        clientNumberLatestRef.current = suggestedNumber;
        setClientNumber(suggestedNumber);
      }
      if (result.transactionId && !referenceWasEntered) {
        referenceLatestRef.current = result.transactionId;
        setReference(result.transactionId);
        setOcrState('found');
        return;
      }
      if (!referenceWasEntered) {
        const unreadable = 'N° transaction illisible';
        referenceLatestRef.current = unreadable;
        setReference(unreadable);
        setOcrState('unreadable');
        return;
      }
      setOcrState('idle');
    }).catch(() => { if (!referenceLatestRef.current.trim()) setOcrState('unavailable'); });
  };

  const saveArrival = async () => {
    setError('');
    if (!run || !selectedPos) return setError('Sélectionnez un POS avant d’enregistrer son arrivée.');
    if (!arrivalPhoto) return setError('Ajoutez la photo d’arrivée du POS.');
    setSaving(true);
    try {
      const geo = await locate();
      const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${activityDate}/pos-arrival-${selectedPos.id}-${Date.now()}.jpg`, arrivalPhoto);
      const visit = await recordPosArrival({ daily_assignment_id: null, campaign_run_id: run.id, ba_id: currentUser.id, pos_id: selectedPos.id, activity_date: activityDate, visited_at: new Date().toISOString(), latitude: geo.latitude, longitude: geo.longitude, accuracy_m: geo.accuracy, arrival_photo_path: path, status: 'visited', comment: null });
      setCreatedVisit(visit); onPosArrivalRecorded(visit);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Arrivée au POS impossible.'); }
    finally { setSaving(false); }
  };

  const save = async () => {
    setError('');
    if (!run || !selectedPos || !posVisit) return setError('Validez d’abord votre arrivée au POS avec la photo et la position GPS.');
    if (!clientNumber.trim()) return setError('Saisissez le numéro du client.');
    if (!isValidMsisdn(clientNumber)) return setError('Format numéro client invalide : utilisez 081… ou +24381….');
    if (!transactionPhoto) return setError('Ajoutez la capture de la transaction.');
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Saisissez un montant valide.');
    setSaving(true);
    try {
      const geo = await locate();
      const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${activityDate}/transaction-${Date.now()}.jpg`, transactionPhoto);
      await createTransaction({ campaign_run_id: run.id, ba_id: currentUser.id, pos_id: selectedPos.id, pos_visit_id: posVisit.id, transaction_reference: hasUnreadableReference ? null : reference.trim() || null, client_number: formatMsisdn(cleanPhoneNumber(clientNumber)), amount: numericAmount, evidence_path: path, occurred_at: new Date().toISOString(), latitude: geo.latitude, longitude: geo.longitude, accuracy_m: geo.accuracy, comment: comment.trim() || null, status: 'recorded' }, Number(run.transactions_per_pos_target || 3));
      setIsComplete(true); onRecorded();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Transaction impossible.'); }
    finally { setSaving(false); }
  };

  if (!isOpen) return null;
  const photoButtonClass = 'group relative flex min-h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/5 transition hover:border-cyan-200/50 hover:bg-white/10 disabled:opacity-40';

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="merchant-transaction-title">
    <section className="modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl">
      <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-200"><Command size={21}/></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Merchant</p><h2 id="merchant-transaction-title" className="mt-1 text-lg font-black">Nouvelle transaction</h2></div></div><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10 disabled:opacity-40" aria-label="Fermer"><X size={18}/></button></div>
      {isComplete ? <div className="py-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={30}/></div><h3 className="mt-4 text-lg font-black">Transaction enregistrée</h3><p className="mt-2 text-sm text-gray-400">La capture est liée au POS et à son pointage d’arrivée photo/GPS.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={resetForm} className="rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.07] px-4 py-3 text-xs font-black uppercase text-cyan-100">Nouvelle transaction</button><button type="button" onClick={onClose} className="btn-neon btn-red px-4 py-3 text-xs">Terminé</button></div></div> : <div className="mt-5 space-y-3">
        {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
        <button type="button" onClick={() => setIsPaletteOpen(true)} disabled={saving} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.07] p-3 text-left disabled:opacity-40"><div className="flex min-w-0 items-center gap-3"><Command className="shrink-0 text-cyan-200" size={19}/><div className="min-w-0"><span className="block text-[10px] font-black uppercase text-cyan-100/70">POS sélectionné</span><b className="block truncate text-sm">{selectedPos ? `${selectedPos.agent_number} · ${selectedPos.denomination}` : 'Rechercher un POS'}</b><span className="block truncate text-[11px] text-gray-400">{selectedPos ? `${selectedPos.address} · ${selectedPos.pool}` : 'Short-code, marchand, adresse, pool ou MFS'}</span></div></div><span className="shrink-0 rounded-xl border border-cyan-200/30 px-2 py-1 text-[10px] font-black text-cyan-100">RECHERCHER</span></button>
        {selectedPos && !posVisit && <section className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-4"><div className="flex items-center gap-2 text-amber-100"><Store size={17}/><b className="text-xs uppercase tracking-wide">Arrivée au nouveau POS</b></div><p className="mt-2 text-xs leading-relaxed text-gray-300">Prenez une photo du POS, avec le numéro marchand bien visible.</p><input ref={arrivalInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { chooseArrivalPhoto(event.target.files?.[0] || null); event.currentTarget.value = ''; }}/><button type="button" onClick={() => arrivalInputRef.current?.click()} disabled={saving} className={`${photoButtonClass} mt-3`}>{arrivalPreview ? <><img src={arrivalPreview} alt="Aperçu de l’arrivée au POS" onClick={(event) => { event.stopPropagation(); setLightbox({ url: arrivalPreview, alt: 'Aperçu de l’arrivée au POS' }); }} className="h-32 w-full cursor-zoom-in object-cover"/><span className="absolute inset-0 flex items-end justify-center bg-black/0 pb-2 text-[10px] font-black uppercase text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">Modifier la photo</span></> : <span className="flex items-center gap-2 text-xs font-black uppercase text-amber-100"><Camera size={16}/>Prendre la photo du POS</span>}</button>{arrivalPhoto && <button type="button" disabled={saving} onClick={saveArrival} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-xs font-black uppercase text-slate-950 transition hover:bg-amber-200 disabled:opacity-40"><MapPin size={16}/>{saving ? 'Pointage de l’arrivée…' : 'Valider l’arrivée au POS'}</button>}</section>}
        {selectedPos && posVisit && <><div className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-2 text-[11px] font-bold text-emerald-200"><CheckCircle2 size={15}/> Arrivée POS validée à {posVisit.visited_at ? new Date(posVisit.visited_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'maintenant'}.</div><div className="grid grid-cols-2 gap-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} disabled={saving} inputMode="decimal" placeholder="Montant" className="app-input rounded-2xl px-4 py-3 text-sm"/><input value={clientNumber} onChange={(event) => { clientNumberLatestRef.current = event.target.value; setClientNumber(event.target.value); }} disabled={saving} inputMode="tel" placeholder="N° client 081… ou +24381…" className={`app-input rounded-2xl px-4 py-3 text-sm ${clientNumber && !isValidMsisdn(clientNumber) ? 'border-amber-400/70 text-amber-100' : ''}`}/></div><input value={reference} onChange={(event) => { referenceLatestRef.current = event.target.value; setReference(event.target.value); setOcrState('idle'); }} disabled={saving} placeholder="N° transaction (optionnel)" className={`app-input w-full rounded-2xl px-4 py-3 text-sm ${hasUnreadableReference ? 'border-amber-400/80 bg-amber-500/10 text-amber-100 placeholder:text-amber-200/70' : ''}`}/>{ocrState === 'date_mismatch' ? <p className="text-[10px] font-bold text-amber-200">La date visible dans la capture ne correspond pas au jour de transaction : vérifiez avant d’enregistrer.</p> : hasUnreadableReference && <p className="text-[10px] font-bold text-amber-200">Identifiant non détecté</p>}<input value={comment} onChange={(event) => setComment(event.target.value)} disabled={saving} placeholder="Commentaire (optionnel)" className="app-input w-full rounded-2xl px-4 py-3 text-sm"/><input ref={transactionInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { chooseTransactionPhoto(event.target.files?.[0] || null); event.currentTarget.value = ''; }}/><button type="button" onClick={() => transactionInputRef.current?.click()} disabled={saving} className={photoButtonClass}>{transactionPreview ? <><img src={transactionPreview} alt="Aperçu de la capture de transaction" onClick={(event) => { event.stopPropagation(); setLightbox({ url: transactionPreview, alt: 'Aperçu de la capture de transaction' }); }} className="h-36 w-full cursor-zoom-in object-cover"/><span className="absolute inset-0 flex items-end justify-center bg-black/0 pb-2 text-[10px] font-black uppercase text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">Modifier la capture</span></> : <span className="flex items-center gap-2 text-xs font-black uppercase text-gray-200"><ImageIcon size={16}/>Ajouter la capture de transaction</span>}</button>{ocrState === 'scanning' && <p className="flex items-center gap-2 text-[10px] font-bold text-cyan-200"><Sparkles size={13} className="animate-pulse"/>Analyse de l’identifiant et du numéro client par Gemini…</p>}{ocrState === 'found' && <p className="flex items-center gap-2 text-[10px] font-bold text-emerald-200"><Sparkles size={13}/>Informations détectées et proposées dans les champs.</p>}<button type="button" disabled={saving || !transactionPhoto} onClick={save} className="btn-neon btn-red flex w-full items-center justify-center gap-2 disabled:opacity-40"><Save size={16}/><span>{saving ? 'Enregistrement…' : 'Enregistrer la transaction'}</span></button></>}
      </div>}
    </section>
    <MerchantPosCommandPalette isOpen={isPaletteOpen} positions={positions} selectedPosId={selectedPos?.id} onClose={() => setIsPaletteOpen(false)} onSelect={choosePos}/>
    <ImageLightboxModal image={lightbox} onClose={() => setLightbox(null)} />
  </div>;
};
