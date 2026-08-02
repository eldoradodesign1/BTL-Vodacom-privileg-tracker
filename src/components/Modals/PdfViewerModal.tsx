import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Printer, FileText } from 'lucide-react';
import { getReportPdf, getReportPreviewHtml, getReports } from '../../utils/storage';
import { DailyReport } from '../../types';
import { buildAdminBatchReportHtml, buildSupervisorReportHtml, generateAdminBatchPDF, generateSupervisorPDF, PDFAdminBatchData, PDFSupervisorData } from '../../utils/pdfGenerator';

interface PdfViewerModalProps {
  isOpen: boolean;
  pdfUrl: string | null;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  pdfUrl,
  onClose
}) => {
  const [activeReport, setActiveReport] = useState<DailyReport | null>(null);
  const [activeSupervisorPreview, setActiveSupervisorPreview] = useState<PDFSupervisorData | null>(null);
  const [activeAdminPreview, setActiveAdminPreview] = useState<PDFAdminBatchData | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [useFallbackView, setUseFallbackView] = useState(false);

  const getDriveFileId = (url: string): string | null => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return match?.[1] || null;
  };

  const buildPreviewUrl = (rawUrl: string): string => {
    if (/^https?:\/\//i.test(rawUrl) && rawUrl.includes('drive.google.com')) {
      const fileId = getDriveFileId(rawUrl);
      if (fileId) {
        // Stable inline renderer for Drive files inside iframe.
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    return rawUrl;
  };

  useEffect(() => {
    let objectUrlToRevoke: string | null = null;
    setUseFallbackView(false);
    setActiveReport(null);
    setActiveSupervisorPreview(null);
    setActiveAdminPreview(null);
    setPreviewHtml(null);

    if (pdfUrl && pdfUrl.startsWith('preview-supervisor:')) {
      const encoded = pdfUrl.replace('preview-supervisor:', '');
      try {
        const payload = JSON.parse(decodeURIComponent(encoded)) as PDFSupervisorData;
        setActiveSupervisorPreview(payload);
        setPreviewHtml(buildSupervisorReportHtml(payload));
      } catch {
        setPreviewHtml(null);
      }
      setDownloadUrl(null);
      setPreviewUrl(null);
      return;
    }

    if (pdfUrl && pdfUrl.startsWith('preview-admin-batch:')) {
      const encoded = pdfUrl.replace('preview-admin-batch:', '');
      try {
        const payload = JSON.parse(decodeURIComponent(encoded)) as PDFAdminBatchData;
        setActiveAdminPreview(payload);
        setPreviewHtml(buildAdminBatchReportHtml(payload));
      } catch {
        setPreviewHtml(null);
      }
      setDownloadUrl(null);
      setPreviewUrl(null);
      return;
    }

    if (pdfUrl && pdfUrl.startsWith('report-id:')) {
      const reportId = pdfUrl.replace('report-id:', '').trim();
      const report = getReports().find(r => r.id === reportId) || null;
      setActiveReport(report);
      if (report) {
        setPreviewHtml(getReportPreviewHtml(report));
      }
      setDownloadUrl(null);
      setPreviewUrl(null);
      return;
    }

    if (pdfUrl && pdfUrl.startsWith('data:application/pdf;base64,')) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        const binaryStr = window.atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        objectUrlToRevoke = url;
        setDownloadUrl(url);
        setPreviewUrl(url);
      } catch (err) {
        console.warn('Could not convert base64 to Blob URL:', err);
        setDownloadUrl(pdfUrl);
        setPreviewUrl(buildPreviewUrl(pdfUrl));
      }
    } else if (pdfUrl && /^https?:\/\//i.test(pdfUrl)) {
      setDownloadUrl(pdfUrl);
      setPreviewUrl(buildPreviewUrl(pdfUrl));
    } else {
      setDownloadUrl(pdfUrl);
      setPreviewUrl(pdfUrl ? buildPreviewUrl(pdfUrl) : null);
    }

    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [pdfUrl]);

  if (!isOpen || !pdfUrl) return null;

  const handleDownload = () => {
    if (activeSupervisorPreview) {
      generateSupervisorPDF(activeSupervisorPreview).then((url) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `Vodacom_Supervision_${activeSupervisorPreview.date}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }).catch(() => {});
      return;
    }

    if (activeAdminPreview) {
      generateAdminBatchPDF(activeAdminPreview).then((url) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `Vodacom_Synthese_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }).catch(() => {});
      return;
    }

    if (activeReport) {
      getReportPdf(activeReport).then((url) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `Vodacom_Rapport_Officiel_${activeReport.date}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }).catch(() => {});
      return;
    }

    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Vodacom_Rapport_Officiel_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (activeSupervisorPreview) {
      generateSupervisorPDF(activeSupervisorPreview).then((url) => {
        const win = window.open(url, '_blank');
        if (win) {
          win.focus();
          win.print();
        }
      }).catch(() => {});
      return;
    }

    if (activeAdminPreview) {
      generateAdminBatchPDF(activeAdminPreview).then((url) => {
        const win = window.open(url, '_blank');
        if (win) {
          win.focus();
          win.print();
        }
      }).catch(() => {});
      return;
    }

    if (activeReport) {
      getReportPdf(activeReport).then((url) => {
        const win = window.open(url, '_blank');
        if (win) {
          win.focus();
          win.print();
        }
      }).catch(() => {});
      return;
    }

    if (downloadUrl) {
      const win = window.open(downloadUrl, '_blank');
      if (win) {
        win.focus();
        win.print();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-2 sm:p-6 animate-pop" onClick={onClose}>
      <div className="w-full max-w-4xl h-[92vh] bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-900 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-red-500">
              Rapport PDF Officiel Vodacom Privilège
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center space-x-1.5 transition-all shadow-md shadow-red-600/30"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all"
              title="Imprimer"
            >
              <Printer className="w-4 h-4" />
            </button>

            <a
              href={activeReport ? '#' : (downloadUrl || pdfUrl || '#')}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all"
              title="Ouvrir dans une nouvelle fenêtre"
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                if (activeReport) {
                  e.preventDefault();
                  getReportPdf(activeReport).then((url) => {
                    window.open(url, '_blank');
                  }).catch(() => {});
                }
                if (activeSupervisorPreview || activeAdminPreview) {
                  e.preventDefault();
                  if (activeSupervisorPreview) {
                    generateSupervisorPDF(activeSupervisorPreview).then((url) => window.open(url, '_blank')).catch(() => {});
                  }
                  if (activeAdminPreview) {
                    generateAdminBatchPDF(activeAdminPreview).then((url) => window.open(url, '_blank')).catch(() => {});
                  }
                }
              }}
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Content */}
        <div className="flex-1 bg-zinc-900 relative overflow-hidden flex flex-col">
          {(activeReport || activeSupervisorPreview || activeAdminPreview) && previewHtml ? (
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-zinc-100">
              <iframe
                title="Aperçu HTML du rapport"
                srcDoc={previewHtml}
                className="w-full h-full min-h-[70vh] rounded-2xl border border-zinc-200 bg-white"
                sandbox="allow-same-origin allow-popups"
              />
            </div>
          ) : (useFallbackView || !previewUrl) ? (
            /* Fallback formatted preview if PDF iframe isn't supported by browser sandbox */
            <div className="flex-1 p-8 overflow-y-auto bg-white text-zinc-900">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="border-b-4 border-red-600 pb-4 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-red-600 uppercase tracking-widest">Vodacom Congo (RDC)</span>
                    <h1 className="text-2xl font-black text-zinc-900 uppercase">Rapport d'Activité Officiel</h1>
                    <p className="text-xs text-zinc-500">Document généré automatiquement le {new Date().toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-red-600 text-white text-xs font-black rounded-lg uppercase">DOCUMENT VALIDE</span>
                  </div>
                </div>

                <div className="bg-zinc-100 p-4 rounded-2xl border border-zinc-200 grid grid-cols-2 gap-4 text-xs font-bold">
                  <div>
                    <span className="text-zinc-400 text-[10px] uppercase block">Statut Document</span>
                    <span className="text-emerald-600 font-black">✔ Signé & Transmis à la Direction</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[10px] uppercase block">Fichier Téléchargeable</span>
                    <button onClick={handleDownload} className="text-red-600 underline font-black">
                      Télécharger le fichier PDF complet (.pdf)
                    </button>
                  </div>
                </div>

                <div className="text-center py-6">
                  <FileText className="w-16 h-16 text-red-600 mx-auto mb-2" />
                  <p className="text-sm font-black text-zinc-800">
                    {previewUrl ? 'Le rapport PDF est disponible pour téléchargement direct.' : 'Aucun aperçu PDF disponible pour ce rapport.'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {previewUrl ? 'Cliquez sur le bouton rouge "Télécharger PDF" ci-dessus pour ouvrir le fichier complet.' : 'Le rapport va être regénéré lors de la prochaine ouverture.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Direct Object / Embed / Iframe viewer */
            <div className="w-full h-full relative bg-zinc-800">
              <iframe
                key={previewUrl}
                src={previewUrl}
                className="w-full h-full"
                title="Aperçu Rapport PDF"
              />
              <div className="absolute bottom-4 right-4">
                <button
                  onClick={() => setUseFallbackView(true)}
                  className="px-3 py-2 bg-black/60 hover:bg-black/75 text-white rounded-xl text-[10px] font-black uppercase border border-white/20"
                >
                  Aperçu synthétique
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
