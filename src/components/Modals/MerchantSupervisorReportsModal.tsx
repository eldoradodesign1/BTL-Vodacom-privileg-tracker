import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Download, FileText, RefreshCw, X } from 'lucide-react';
import type { CampaignRun } from '../../types';
import { getMerchantSupervisorReport, type MerchantSupervisorReport, type MerchantSupervisorReportKind } from '../../utils/merchantCampaign';

interface MerchantSupervisorReportsModalProps {
  isOpen: boolean;
  run: CampaignRun | null;
  onClose: () => void;
}

const reportLabels: Record<MerchantSupervisorReportKind, string> = {
  daily: 'Journalier',
  weekly: 'Hebdomadaire',
  compiled: 'Compilé',
};

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export const MerchantSupervisorReportsModal: React.FC<MerchantSupervisorReportsModalProps> = ({ isOpen, run, onClose }) => {
  const [kind, setKind] = useState<MerchantSupervisorReportKind>('daily');
  const [report, setReport] = useState<MerchantSupervisorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    if (!run) return;
    setLoading(true);
    setError('');
    try {
      setReport(await getMerchantSupervisorReport(run, kind));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de préparer le rapport Merchant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, kind, run?.id]);

  const exportPdf = async () => {
    if (!printRef.current || !report) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(printRef.current, { backgroundColor: '#0c111c', scale: 2, useCORS: true });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let offset = 0;
      let remaining = imageHeight;
      const image = canvas.toDataURL('image/png');
      while (remaining > 0) {
        pdf.addImage(image, 'PNG', 0, offset, pageWidth, imageHeight);
        remaining -= pageHeight;
        if (remaining > 0) {
          pdf.addPage();
          offset -= pageHeight;
        }
      }
      pdf.save(`rapport-merchant-${kind}-${report.startsOn}-${report.endsOn}.pdf`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export PDF impossible.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;
  const maxPos = Math.max(1, ...(report?.daily.map((item) => item.pos) || [1]));

  return <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0b101a] p-4 shadow-2xl sm:rounded-[2rem] sm:p-5" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Rapports superviseur</p><h2 className="mt-1 text-xl font-black text-white">Pilotage Merchant</h2><p className="mt-1 text-xs text-gray-400">Aperçu HTML et export PDF depuis les données terrain réelles.</p></div>
        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{(Object.keys(reportLabels) as MerchantSupervisorReportKind[]).map((option) => <button key={option} type="button" onClick={() => setKind(option)} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase transition ${kind === option ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'}`}>{reportLabels[option]}</button>)}</div>
      {error && <div className="mt-4 rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}
      {loading && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-xs font-black uppercase tracking-[0.16em] text-gray-400">Préparation du rapport…</div>}
      {report && !loading && <div ref={printRef} className="mt-5 overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_92%_0%,rgba(34,211,238,0.16),transparent_33%),linear-gradient(145deg,#101827,#0b101a)] p-4 text-white sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200">Merchant Educational Campaign</p><h3 className="mt-1 text-lg font-black">Rapport {reportLabels[report.kind].toLowerCase()}</h3><p className="mt-1 text-[11px] text-gray-300">Du {formatDate(report.startsOn)} au {formatDate(report.endsOn)}</p></div><div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-right"><b className="block text-xl font-black text-cyan-100">{report.totals.executionRate}%</b><span className="text-[8px] font-black uppercase text-cyan-200/75">Exécution POS</span></div></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-cyan-100">{report.totals.pos}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">POS visités</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-amber-100">{report.totals.transactions}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">Transactions</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-emerald-100">{report.totals.activeBas}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">BA actifs</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><b className="text-lg text-fuchsia-100">{report.totals.amount.toLocaleString('fr-FR')}</b><span className="mt-1 block text-[8px] font-black uppercase text-gray-400">Montant cumulé</span></div></div>
        <section className="mt-5"><div className="flex items-center gap-2"><BarChart3 size={16} className="text-cyan-200"/><h4 className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Activité de la période</h4></div><div className="mt-3 flex h-28 items-end gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">{report.daily.map((item) => <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><div className="w-full rounded-t-lg bg-gradient-to-t from-cyan-500/45 to-cyan-200" style={{ height: `${Math.max(8, Math.round((item.pos / maxPos) * 74))}px` }}/><span className="text-[8px] font-bold text-gray-400">{item.date.slice(8, 10)}</span></div>)}</div></section>
        <section className="mt-5"><h4 className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Performance par Brand Ambassador</h4><div className="mt-3 overflow-hidden rounded-2xl border border-white/10"><table className="w-full text-left text-[10px]"><thead className="bg-white/[0.06] text-[8px] font-black uppercase tracking-[0.1em] text-gray-400"><tr><th className="px-3 py-2">BA</th><th className="px-2 py-2 text-center">POS</th><th className="px-2 py-2 text-center">Tx</th><th className="px-3 py-2 text-right">Montant</th></tr></thead><tbody>{report.byBa.map((item) => <tr key={item.id} className="border-t border-white/[0.06]"><td className="px-3 py-2 font-bold text-white">{item.name}</td><td className="px-2 py-2 text-center text-cyan-100">{item.pos}</td><td className="px-2 py-2 text-center text-amber-100">{item.transactions}</td><td className="px-3 py-2 text-right text-emerald-100">{item.amount.toLocaleString('fr-FR')}</td></tr>)}{report.byBa.length === 0 && <tr><td colSpan={4} className="px-3 py-5 text-center text-gray-400">Aucune activité validée sur cette période.</td></tr>}</tbody></table></div></section>
        <p className="mt-5 text-[8px] font-bold uppercase tracking-[0.12em] text-gray-500">Objectifs de référence : {report.targets.daily_pos_target} POS / BA / jour · {report.targets.transactions_per_pos_target} transactions / POS.</p>
      </div>}
      <div className="mt-4 flex justify-between gap-3"><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-gray-300 transition hover:bg-white/10"><RefreshCw size={14}/>Actualiser</button><button type="button" disabled={!report || exporting} onClick={() => void exportPdf()} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-500/20 px-3 py-2 text-[10px] font-black uppercase text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-50"><Download size={14}/>{exporting ? 'Export…' : 'Exporter PDF'}</button></div>
    </div>
  </div>;
};
