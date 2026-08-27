import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, LoaderCircle, X } from 'lucide-react';
import type { MerchantTransactionReportRecord } from '../../utils/merchantTransactionsReport';
import { buildMerchantTransactionsReportHtml, exportMerchantTransactionsPdf, exportMerchantTransactionsXlsx } from '../../utils/merchantTransactionsReport';

interface MerchantTransactionsReportModalProps {
  isOpen: boolean;
  records: MerchantTransactionReportRecord[];
  startsOn: string;
  endsOn: string;
  generatedBy?: string;
  onClose: () => void;
}

export const MerchantTransactionsReportModal: React.FC<MerchantTransactionsReportModalProps> = ({ isOpen, records, startsOn, endsOn, generatedBy, onClose }) => {
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState('');
  const reportInput = useMemo(() => ({ records, startsOn, endsOn, generatedBy }), [endsOn, generatedBy, records, startsOn]);
  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setError(''); setExporting(format);
    try {
      if (format === 'pdf') await exportMerchantTransactionsPdf(reportInput);
      else await exportMerchantTransactionsXlsx(reportInput);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Export impossible.'); }
    finally { setExporting(null); }
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={onClose}>
    <section className="modal-sheet max-h-[94vh] w-full max-w-5xl overflow-y-auto p-0 sm:rounded-3xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Rapport transactions Merchant">
      <header className="modal-sticky-header flex items-center justify-between gap-3 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-200/70">Gestion Merchant · Tx</p><h2 className="mt-1 text-lg font-black text-white">Rapport des transactions</h2><p className="mt-0.5 text-[11px] text-gray-400">Aperçu des {records.length} transaction{records.length > 1 ? 's' : ''} correspondant aux filtres actifs.</p></div><div className="flex shrink-0 items-center gap-2"><button type="button" disabled={exporting !== null} onClick={() => void handleExport('pdf')} title="Exporter en PDF" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300/25 bg-rose-500/[0.1] text-rose-100 transition hover:bg-rose-500/[0.2] disabled:opacity-50">{exporting === 'pdf' ? <LoaderCircle className="animate-spin" size={16}/> : <FileText size={16}/>}</button><button type="button" disabled={exporting !== null} onClick={() => void handleExport('xlsx')} title="Exporter en Excel" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-500/[0.1] text-emerald-100 transition hover:bg-emerald-500/[0.2] disabled:opacity-50">{exporting === 'xlsx' ? <LoaderCircle className="animate-spin" size={16}/> : <FileSpreadsheet size={16}/>}</button><button type="button" onClick={onClose} aria-label="Fermer" className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-gray-300 transition hover:bg-white/10 hover:text-white"><X size={18}/></button></div></header>
      <div className="space-y-3 p-4 sm:p-5">{error && <p className="rounded-2xl border border-rose-300/25 bg-rose-500/[0.08] p-3 text-xs font-semibold text-rose-100">{error}</p>}<div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl"><iframe title="Aperçu du rapport transactions Merchant" className="h-[64vh] w-full bg-white" srcDoc={buildMerchantTransactionsReportHtml(reportInput)}/></div><p className="flex items-center gap-2 px-1 text-[10px] font-semibold text-gray-500"><Download size={13}/>PDF prêt au partage · Excel avec feuilles source et indicateurs calculés par formules.</p></div>
    </section>
  </div>;
};

export default MerchantTransactionsReportModal;
