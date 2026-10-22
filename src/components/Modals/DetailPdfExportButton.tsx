import React, { useState } from 'react';
import { FileText, LoaderCircle } from 'lucide-react';
import type { DetailPdfDocument } from '../../utils/contextDetailPdf';

interface Props {
  document: DetailPdfDocument;
  className?: string;
}

export const DetailPdfExportButton: React.FC<Props> = ({ document, className = '' }) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setExporting(true);
    setError('');
    try {
      const { exportContextDetailPdf } = await import('../../utils/contextDetailPdf');
      await exportContextDetailPdf(document);
    } catch {
      setError('Export PDF impossible. Réessayez.');
    } finally {
      setExporting(false);
    }
  };
  return <div className="relative">
    <button type="button" onClick={() => void download()} disabled={exporting} title="Exporter ce détail en PDF" aria-label="Exporter ce détail en PDF" className={`flex h-10 w-10 items-center justify-center rounded-xl border border-red-300/30 bg-red-400/[0.10] text-red-300 transition hover:bg-red-400/[0.20] disabled:opacity-50 ${className}`}>{exporting ? <LoaderCircle size={17} className="animate-spin"/> : <FileText size={17}/>}</button>
    {error && <p className="absolute right-0 top-11 z-30 w-40 rounded-xl border border-rose-300/30 bg-(--m-sheet) px-2 py-1.5 text-right text-[9px] font-bold text-rose-100 shadow-xl">{error}</p>}
  </div>;
};
