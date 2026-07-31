import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Printer, FileText, AlertCircle } from 'lucide-react';

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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [useFallbackView, setUseFallbackView] = useState(false);

  useEffect(() => {
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
        setBlobUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.warn('Could not convert base64 to Blob URL:', err);
        setBlobUrl(pdfUrl);
      }
    } else {
      setBlobUrl(pdfUrl);
    }
  }, [pdfUrl]);

  if (!isOpen || !pdfUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = blobUrl || pdfUrl;
    link.download = `Vodacom_Rapport_Officiel_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (blobUrl) {
      const win = window.open(blobUrl, '_blank');
      if (win) {
        win.focus();
        win.print();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-2 sm:p-6 animate-pop">
      <div className="w-full max-w-4xl h-[92vh] bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
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
              href={blobUrl || pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all"
              title="Ouvrir dans une nouvelle fenêtre"
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
          {useFallbackView ? (
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
                  <p className="text-sm font-black text-zinc-800">Le rapport PDF est disponible pour téléchargement direct.</p>
                  <p className="text-xs text-zinc-500 mt-1">Cliquez sur le bouton rouge "Télécharger PDF" ci-dessus pour ouvrir le fichier complet.</p>
                </div>
              </div>
            </div>
          ) : (
            /* Direct Object / Embed / Iframe viewer */
            <div className="w-full h-full relative bg-zinc-800">
              <object
                data={blobUrl || pdfUrl}
                type="application/pdf"
                className="w-full h-full"
              >
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-white space-y-4">
                  <AlertCircle className="w-12 h-12 text-red-500 animate-bounce" />
                  <h3 className="text-base font-black uppercase">Aperçu PDF Direct Indisponible dans cet iFrame</h3>
                  <p className="text-xs text-gray-400 max-w-md">
                    Votre navigateur limite l'affichage inline des fichiers PDF. Vous pouvez télécharger directement le document ou afficher sa version synthétique.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase shadow-lg"
                    >
                      Télécharger PDF (.pdf)
                    </button>
                    <button
                      onClick={() => setUseFallbackView(true)}
                      className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-black uppercase"
                    >
                      Aperçu Synthétique
                    </button>
                  </div>
                </div>
              </object>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
