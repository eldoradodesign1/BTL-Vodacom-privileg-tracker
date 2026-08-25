import React, { useMemo, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import type { MerchantFundRequest } from '../../types';
import { buildFundRequestReportData, buildFundRequestReportHtml, exportFundRequestsExcel, exportFundRequestsPdf } from '../../utils/fundRequestReport';

interface MerchantFundRequestsReportModalProps {
  isOpen: boolean;
  requests: MerchantFundRequest[];
  onClose: () => void;
}

export const MerchantFundRequestsReportModal: React.FC<MerchantFundRequestsReportModalProps> = ({ isOpen, requests, onClose }) => {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState('');
  const report = useMemo(() => buildFundRequestReportData(requests), [requests]);
  const previewHtml = useMemo(() => buildFundRequestReportHtml(report), [report]);

  if (!isOpen) return null;
  const exportReport = async (format: 'pdf' | 'excel') => {
    setExporting(format); setError('');
    try {
      if (format === 'pdf') await exportFundRequestsPdf(report);
      else await exportFundRequestsExcel(report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de générer cet export.');
    } finally {
      setExporting(null);
    }
  };

  return <div className="fixed inset-0 z-[155] flex items-end justify-center bg-black/85 p-0 backdrop-blur-md sm:items-center sm:p-5" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fund-request-report-title">
    <section className="glass-card flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2rem] border border-emerald-300/30 shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
      <header className="modal-sticky-header flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-500/15 text-emerald-100"><BarChart3 size={20}/></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/70">Pilotage Merchant</p><h2 id="fund-request-report-title" className="mt-1 text-lg font-black text-white">Rapport des demandes de fonds</h2><p className="mt-1 text-xs text-gray-400">Aperçu HTML, synthèse financière, tendances et registre détaillé.</p></div></div>
        <div className="flex shrink-0 items-center gap-2"><button type="button" disabled={exporting !== null} onClick={() => void exportReport('pdf')} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/30 bg-rose-500/[0.12] px-2.5 py-2 text-[9px] font-black uppercase text-rose-100 transition hover:bg-rose-500/[0.20] disabled:opacity-45" title="Télécharger le rapport PDF"><FileText size={15}/>{exporting === 'pdf' ? 'PDF…' : 'PDF'}</button><button type="button" disabled={exporting !== null} onClick={() => void exportReport('excel')} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/30 bg-emerald-500/[0.12] px-2.5 py-2 text-[9px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/[0.20] disabled:opacity-45" title="Télécharger le rapport Excel"><FileSpreadsheet size={15}/>{exporting === 'excel' ? 'Excel…' : 'Excel'}</button><button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:bg-white/10" aria-label="Fermer"><X size={18}/></button></div>
      </header>
      {error && <div className="mx-4 mb-3 rounded-xl border border-rose-300/30 bg-rose-500/[0.10] px-3 py-2 text-xs font-bold text-rose-100 sm:mx-5">{error}</div>}
      <div className="flex items-center justify-between gap-3 border-y border-white/[0.08] bg-black/[0.14] px-4 py-2.5 text-[10px] sm:px-5"><span className="font-bold text-gray-400"><b className="text-white">{report.totalRequests}</b> demande{report.totalRequests > 1 ? 's' : ''} · <b className="text-emerald-200">${report.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> sollicités</span><span className="hidden font-bold text-gray-500 sm:block"><Download className="mr-1 inline" size={12}/>Les exports intègrent graphiques, synthèse et registre.</span></div>
      <div className="min-h-0 flex-1 bg-slate-950/50 p-2 sm:p-4"><iframe title="Aperçu HTML du rapport des demandes de fonds" srcDoc={previewHtml} className="h-full min-h-[60vh] w-full rounded-xl border border-white/10 bg-white shadow-inner sm:rounded-2xl" sandbox="allow-same-origin"/></div>
    </section>
  </div>;
};
