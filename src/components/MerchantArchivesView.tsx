import React, { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarDays, CheckCircle2, Clock3, FileText, MapPin, RefreshCw, ShoppingBag, X } from 'lucide-react';
import type { BADailyAttendance, BATransaction, User } from '../types';
import { getActiveCampaignRuns, getAttendanceHistoryForBA, getMerchantCampaign, getTransactionsForBA } from '../utils/merchantCampaign';
import { DetailPdfExportButton } from './Modals/DetailPdfExportButton';

interface MerchantArchivesViewProps {
  currentUser: User;
}

const formatActivityDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

export const MerchantArchivesView: React.FC<MerchantArchivesViewProps> = ({ currentUser }) => {
  const [reports, setReports] = useState<BADailyAttendance[]>([]);
  const [transactions, setTransactions] = useState<BATransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState<BADailyAttendance | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('Campagne Merchant introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      const [nextReports, nextTransactions] = await Promise.all([
        getAttendanceHistoryForBA(currentUser.id, activeRun?.id),
        getTransactionsForBA(currentUser.id, activeRun?.id),
      ]);
      setReports(nextReports);
      setTransactions(nextTransactions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les archives.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [currentUser.id]);

  const transactionsByDate = useMemo(() => {
    const grouped = new Map<string, BATransaction[]>();
    transactions.forEach((transaction) => {
      const date = new Date(transaction.occurred_at).toLocaleDateString('en-CA');
      grouped.set(date, [...(grouped.get(date) || []), transaction]);
    });
    return grouped;
  }, [transactions]);

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement des archives…</div>;

  return (
    <div className="space-y-4 pb-4">
      <section className="glass-card relative overflow-hidden border border-amber-300/15 p-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Merchant Educational Campaign</p><h1 className="mt-1 text-xl font-black text-white">Mes archives</h1><p className="mt-1 text-xs font-semibold text-gray-300">Rapports journaliers clôturés</p></div>
          <button type="button" onClick={() => void refresh()} aria-label="Actualiser les archives" className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-amber-100 transition-colors hover:bg-white/10"><RefreshCw size={16}/></button>
        </div>
        <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/10 p-3"><Archive className="text-amber-200" size={19}/><div><b className="block text-lg font-black text-white">{reports.length}</b><span className="text-[9px] font-black uppercase text-gray-400">Rapports clôturés</span></div></div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/50 bg-red-950/50 p-3 text-xs font-bold text-red-200">{error}</div>}
      {!error && reports.length === 0 && <div className="glass-card p-8 text-center text-gray-400"><Archive className="mx-auto mb-2 h-10 w-10 text-gray-600"/><p className="text-xs font-bold">Aucun rapport journalier archivé pour le moment.</p><p className="mt-1 text-[11px]">Vos journées apparaîtront ici après leur clôture.</p></div>}
      {reports.map((report) => {
        const dayTransactions = transactionsByDate.get(report.activity_date) || [];
        const total = dayTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const posCount = new Set(dayTransactions.map((item) => item.pos_id)).size;
        return <button type="button" key={report.id} onClick={() => setSelectedReport(report)} className="glass-card w-full space-y-3 border border-white/[0.08] p-4 text-left transition hover:border-amber-300/35 hover:bg-amber-500/[0.04]"><div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-wide text-amber-300">Rapport clôturé</span><h2 className="mt-1 text-sm font-black text-white">{formatActivityDate(report.activity_date)}</h2><p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400"><Clock3 size={12}/> {report.checkin_at ? new Date(report.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} → {report.checkout_at ? new Date(report.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div><CheckCircle2 className="text-emerald-300" size={20}/></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[0.04] p-2"><ShoppingBag className="mx-auto mb-1 h-3.5 w-3.5 text-cyan-200"/><b className="block text-sm">{posCount}</b><span className="text-[9px] uppercase text-gray-500">POS</span></div><div className="rounded-xl bg-white/[0.04] p-2"><FileText className="mx-auto mb-1 h-3.5 w-3.5 text-amber-200"/><b className="block text-sm">{dayTransactions.length}</b><span className="text-[9px] uppercase text-gray-500">Transactions</span></div><div className="rounded-xl bg-white/[0.04] p-2"><CalendarDays className="mx-auto mb-1 h-3.5 w-3.5 text-emerald-200"/><b className="block text-sm">{total.toLocaleString('fr-FR')}</b><span className="text-[9px] uppercase text-gray-500">Montant</span></div></div>{report.closing_comment && <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-300">{report.closing_comment}</p>}{report.checkout_latitude !== null && report.checkout_longitude !== null && <p className="flex items-center gap-1 text-[10px] text-gray-500"><MapPin size={12}/> Position de clôture GPS enregistrée</p>}</button>;
      })}
      {selectedReport && (() => { const dayTransactions = transactionsByDate.get(selectedReport.activity_date) || []; const total = dayTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0); const detailDocument = { title: 'Rapport journalier BA', subtitle: formatActivityDate(selectedReport.activity_date), filename: `rapport-ba-${selectedReport.activity_date}`, sections: [{ title: 'Pointage et activité', rows: [{ label: 'Date', value: formatActivityDate(selectedReport.activity_date) }, { label: 'Arrivée', value: selectedReport.checkin_at ? new Date(selectedReport.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null }, { label: 'Clôture', value: selectedReport.checkout_at ? new Date(selectedReport.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null }, { label: 'POS', value: new Set(dayTransactions.map((item) => item.pos_id)).size }, { label: 'Transactions', value: dayTransactions.length }, { label: 'Montant', value: total.toLocaleString('fr-FR') }, { label: 'Coordonnées clôture', value: selectedReport.checkout_latitude != null && selectedReport.checkout_longitude != null ? `${selectedReport.checkout_latitude}, ${selectedReport.checkout_longitude}` : null }] }, { title: 'Commentaire de clôture', text: selectedReport.closing_comment || 'Aucun commentaire renseigné.' }, ...(dayTransactions.length ? [{ title: 'Transactions', rows: dayTransactions.map((transaction, index) => ({ label: `#${index + 1} · ${transaction.point_of_sale?.denomination || 'POS Merchant'}`, value: `${transaction.client_number || 'Client non renseigné'} · ${transaction.transaction_reference || 'Référence non renseignée'} · ${Number(transaction.amount || 0).toLocaleString('fr-FR')}` })) }] : [])] }; return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={() => setSelectedReport(null)}><section className="modal-sheet max-h-[92vh] w-full max-w-xl overflow-y-auto p-5 sm:rounded-3xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Aperçu du rapport journalier"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">Aperçu du rapport</p><h2 className="mt-1 text-lg font-black">{formatActivityDate(selectedReport.activity_date)}</h2><p className="mt-1 text-[11px] text-gray-400">Pointage {selectedReport.checkin_at ? new Date(selectedReport.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} · Clôture {selectedReport.checkout_at ? new Date(selectedReport.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div><div className="flex shrink-0 items-center gap-2"><DetailPdfExportButton document={detailDocument}/><button type="button" onClick={() => setSelectedReport(null)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button></div></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] p-3"><b className="block text-lg text-cyan-100">{new Set(dayTransactions.map((item) => item.pos_id)).size}</b><span className="text-[8px] font-black uppercase text-gray-400">POS</span></div><div className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.05] p-3"><b className="block text-lg text-amber-100">{dayTransactions.length}</b><span className="text-[8px] font-black uppercase text-gray-400">Transactions</span></div><div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.05] p-3"><b className="block text-lg text-emerald-100">{total.toLocaleString('fr-FR')}</b><span className="text-[8px] font-black uppercase text-gray-400">Montant</span></div></div><section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">Commentaire de clôture</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{selectedReport.closing_comment || 'Aucun commentaire renseigné.'}</p></section><section className="mt-4 overflow-hidden rounded-2xl border border-white/10"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-black uppercase text-cyan-100"><FileText size={14}/>Dernières transactions</div>{dayTransactions.slice(0, 8).map((transaction) => <div key={transaction.id} className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2 text-xs last:border-b-0"><div><b className="text-white">{transaction.point_of_sale?.denomination || 'POS Merchant'}</b><p className="mt-0.5 text-[10px] text-gray-500">Client {transaction.client_number || '—'} · {transaction.transaction_reference || 'Réf. non renseignée'}</p></div><b className="text-emerald-100">{Number(transaction.amount || 0).toLocaleString('fr-FR')}</b></div>)}{dayTransactions.length === 0 && <p className="p-5 text-center text-sm text-gray-400">Aucune transaction enregistrée.</p>}</section>{selectedReport.checkout_latitude != null && selectedReport.checkout_longitude != null && <section className="mt-4 overflow-hidden rounded-2xl border border-white/10"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-black uppercase text-rose-100"><MapPin size={14}/>Localisation de clôture</div><iframe title="Carte de clôture" src={`https://www.google.com/maps?q=${selectedReport.checkout_latitude},${selectedReport.checkout_longitude}&output=embed`} className="h-56 w-full border-0" loading="lazy" referrerPolicy="no-referrer"/></section>}</section></div>; })()}
    </div>
  );
};
