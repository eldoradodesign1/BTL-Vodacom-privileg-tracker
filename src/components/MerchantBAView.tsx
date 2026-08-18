import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, ClipboardList, Command, MapPin, RefreshCw, Send, ShoppingBag } from 'lucide-react';
import type { BADailyAttendance, BATransaction, CampaignRun, PointOfSale, User } from '../types';
import {
  createTransaction,
  getActiveCampaignRuns,
  getCampaignPos,
  getDailyAttendance,
  getMerchantCampaign,
  getTransactionsForDay,
  MERCHANT_CAMPAIGN_CODE,
  recordCheckin,
  closeDailyAttendance,
  uploadMerchantEvidence,
} from '../utils/merchantCampaign';
import { toISO } from '../utils/storage';
import { MerchantPosCommandPalette } from './Modals/MerchantPosCommandPalette';

interface MerchantBAViewProps {
  currentUser: User;
}

type Geo = { latitude: number; longitude: number; accuracy: number };

function locate(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La géolocalisation est indisponible.'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy || 0) }),
      () => reject(new Error('La localisation est nécessaire pour continuer.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export const MerchantBAView: React.FC<MerchantBAViewProps> = ({ currentUser }) => {
  const today = toISO(new Date());
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [positions, setPositions] = useState<PointOfSale[]>([]);
  const [attendance, setAttendance] = useState<BADailyAttendance | null>(null);
  const [transactions, setTransactions] = useState<BATransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPos, setSelectedPos] = useState<PointOfSale | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [comment, setComment] = useState('');
  const [closingComment, setClosingComment] = useState('');
  const [transactionPhoto, setTransactionPhoto] = useState<File | null>(null);
  const [checkinPhoto, setCheckinPhoto] = useState<File | null>(null);
  const checkinInput = useRef<HTMLInputElement | null>(null);
  const transactionInput = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const active = runs.find((item) => item.status === 'active') || runs[0] || null;
      setRun(active);
      if (!active) {
        setPositions([]);
        setAttendance(null);
        setTransactions([]);
        return;
      }
      const [nextPositions, nextAttendance, nextTransactions] = await Promise.all([
        getCampaignPos(campaign.id),
        getDailyAttendance(currentUser.id, active.id, today),
        getTransactionsForDay(currentUser.id, active.id, today),
      ]);
      setPositions(nextPositions);
      setAttendance(nextAttendance);
      setTransactions(nextTransactions);
      setSelectedPos((current) => current ? nextPositions.find((pos) => pos.id === current.id) || null : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement de la journée impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [currentUser.id]);

  const visitedCount = useMemo(() => new Set(transactions.map((transaction) => transaction.pos_id)).size, [transactions]);
  const transactionTarget = 45;

  const withAction = async (action: () => Promise<void>) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckin = () => void withAction(async () => {
    if (!run) throw new Error('Aucune vague active.');
    if (!checkinPhoto) throw new Error('Prenez la photo de pointage avant de valider.');
    const geo = await locate();
    const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${today}/checkin-${Date.now()}.jpg`, checkinPhoto);
    await recordCheckin({ campaign_run_id: run.id, ba_id: currentUser.id, activity_date: today, status: 'open', checkin_at: new Date().toISOString(), checkin_latitude: geo.latitude, checkin_longitude: geo.longitude, checkin_accuracy_m: geo.accuracy, checkin_photo_path: path });
    setCheckinPhoto(null);
    setSuccess('Pointage du matin enregistré avec photo et position GPS.');
  });

  const recordTransaction = () => void withAction(async () => {
    if (!run) throw new Error('Aucune vague active.');
    if (!selectedPos) throw new Error('Recherchez et sélectionnez un POS.');
    if (!clientNumber.trim()) throw new Error('Saisissez le numéro du client.');
    if (!transactionPhoto) throw new Error('Ajoutez la capture de la transaction.');
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Saisissez un montant valide.');
    const geo = await locate();
    const path = await uploadMerchantEvidence(MERCHANT_CAMPAIGN_CODE, `${currentUser.id}/${today}/transaction-${Date.now()}.jpg`, transactionPhoto);
    await createTransaction({
      campaign_run_id: run.id,
      ba_id: currentUser.id,
      pos_id: selectedPos.id,
      pos_visit_id: null,
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
    setAmount('');
    setReference('');
    setClientNumber('');
    setComment('');
    setTransactionPhoto(null);
    setSuccess('Transaction enregistrée avec le POS, le client et la position GPS.');
  });

  const closeDay = () => void withAction(async () => {
    if (!attendance) throw new Error('Le pointage du matin est requis avant la clôture.');
    const geo = await locate();
    await closeDailyAttendance(attendance.id, { checkout_at: new Date().toISOString(), checkout_latitude: geo.latitude, checkout_longitude: geo.longitude, checkout_accuracy_m: geo.accuracy, closing_comment: closingComment.trim() || null, status: 'closed' });
    setSuccess('Journée clôturée avec succès.');
  });

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de votre journée…</div>;

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card overflow-hidden border border-red-500/20 p-0"><div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 p-5 text-white"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Merchant Educational Campaign</p><h1 className="mt-1 text-xl font-black tracking-tight">Bonjour, {currentUser.name.split(' ')[0]}</h1><p className="mt-2 text-xs font-semibold text-white/80">{new Date(`${today}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · Objectif : 15 POS / 45 transactions</p></div><div className="grid grid-cols-3 divide-x divide-white/10 bg-black/15 text-center"><div className="p-3"><b className="block text-lg font-black">15</b><span className="text-[9px] font-black uppercase text-gray-400">Objectif POS</span></div><div className="p-3"><b className="block text-lg font-black text-emerald-400">{visitedCount}</b><span className="text-[9px] font-black uppercase text-gray-400">POS visités</span></div><div className="p-3"><b className="block text-lg font-black text-amber-300">{transactions.length}/{transactionTarget}</b><span className="text-[9px] font-black uppercase text-gray-400">Transactions</span></div></div></section>

      {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-200">{success}</div>}

      {!attendance?.checkin_at ? <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-3"><div className="rounded-2xl bg-red-500/15 p-3 text-red-300"><Camera size={20}/></div><div><h2 className="font-black">Pointage du matin</h2><p className="text-xs text-gray-400">Photo obligatoire, GPS et horodatage automatiques.</p></div></div><input ref={checkinInput} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => setCheckinPhoto(event.target.files?.[0] || null)} /><button type="button" onClick={() => checkinInput.current?.click()} className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase">{checkinPhoto ? `Photo prête : ${checkinPhoto.name}` : 'Prendre la photo de pointage'}</button><button type="button" disabled={saving || !checkinPhoto} onClick={handleCheckin} className="btn-neon btn-red w-full disabled:opacity-40">{saving ? 'Validation…' : 'Valider mon pointage'}</button></section> : <section className="glass-card flex items-center gap-3 border border-emerald-500/25 p-4"><CheckCircle2 className="text-emerald-400"/><div><b className="text-sm">Pointage validé</b><p className="text-xs text-gray-400">{new Date(attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · GPS enregistré</p></div></section>}

      {attendance?.checkin_at && !attendance.checkout_at && <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-200"><ShoppingBag size={20}/></div><div><h2 className="font-black">Enregistrer une transaction</h2><p className="text-xs text-gray-400">Recherchez librement le POS, puis ajoutez les preuves de la transaction.</p></div></div><button type="button" onClick={() => setIsPaletteOpen(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.07] p-3 text-left"><div className="flex min-w-0 items-center gap-3"><Command className="shrink-0 text-cyan-200" size={19}/><div className="min-w-0"><span className="block text-[10px] font-black uppercase text-cyan-100/70">POS sélectionné</span><b className="block truncate text-sm">{selectedPos ? `${selectedPos.agent_number} · ${selectedPos.denomination}` : 'Rechercher un POS'}</b><span className="block truncate text-[11px] text-gray-400">{selectedPos ? `${selectedPos.address} · ${selectedPos.pool}` : 'Short-code, marchand, adresse, pool ou MFS'}</span></div></div><span className="shrink-0 rounded-xl border border-cyan-200/30 px-2 py-1 text-[10px] font-black text-cyan-100">RECHERCHER</span></button><div className="grid grid-cols-2 gap-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Montant" className="app-input rounded-2xl px-4 py-3 text-sm"/><input value={clientNumber} onChange={(event) => setClientNumber(event.target.value)} inputMode="tel" placeholder="N° client" className="app-input rounded-2xl px-4 py-3 text-sm"/></div><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="N° transaction (optionnel)" className="app-input w-full rounded-2xl px-4 py-3 text-sm"/><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Commentaire (optionnel)" className="app-input w-full rounded-2xl px-4 py-3 text-sm"/><input ref={transactionInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => setTransactionPhoto(event.target.files?.[0] || null)} /><button type="button" onClick={() => transactionInput.current?.click()} className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase">{transactionPhoto ? `Capture prête : ${transactionPhoto.name}` : 'Ajouter la capture de transaction'}</button><button type="button" disabled={saving || !transactionPhoto} onClick={recordTransaction} className="btn-neon btn-red w-full disabled:opacity-40">{saving ? 'Enregistrement…' : 'Enregistrer la transaction'}</button></section>}

      {attendance?.checkin_at && !attendance.checkout_at && <section className="glass-card space-y-3 p-4"><div className="flex items-center gap-3"><ClipboardList className="text-red-300"/><div><h2 className="font-black">Clôture de journée</h2><p className="text-xs text-gray-400">Point GPS, indicateurs et commentaire BA.</p></div></div><textarea value={closingComment} onChange={(event) => setClosingComment(event.target.value)} placeholder="Commentaire de clôture (optionnel)" className="app-input min-h-24 w-full rounded-2xl p-4 text-sm"/><button type="button" disabled={saving} onClick={closeDay} className="btn-neon btn-red w-full"><Send size={16}/><span>{saving ? 'Clôture…' : 'Clôturer la journée'}</span></button></section>}

      {attendance?.checkout_at && <section className="glass-card border border-emerald-500/25 p-4 text-center"><CheckCircle2 className="mx-auto text-emerald-400"/><b className="mt-2 block">Journée clôturée</b><p className="mt-1 text-xs text-gray-400">{transactions.length} transactions enregistrées pour {visitedCount} POS visités.</p></section>}
      <MerchantPosCommandPalette isOpen={isPaletteOpen} positions={positions} selectedPosId={selectedPos?.id} onClose={() => setIsPaletteOpen(false)} onSelect={setSelectedPos} />
    </div>
  );
};
