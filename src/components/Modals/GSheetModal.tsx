import React, { useState, useRef } from 'react';
import { X, RefreshCw, FileSpreadsheet, Download, CheckCircle, ExternalLink, Link as LinkIcon, ShieldCheck, Upload, Trash2 } from 'lucide-react';
import { getGSheetConfig, saveGSheetConfig, syncFromGoogleSheetUrl, exportDatabaseToCsv, parseXlsxBuffer } from '../../utils/googleSheetsSync';
import { purgeAndResetEverything } from '../../utils/storage';

interface GSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess: () => void;
}

export const GSheetModal: React.FC<GSheetModalProps> = ({
  isOpen,
  onClose,
  onSyncSuccess
}) => {
  const [config, setConfig] = useState(getGSheetConfig());
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveAndSync = async () => {
    setLoading(true);
    setStatusMsg(null);
    saveGSheetConfig(config);

    if (config.sheetCsvUrl) {
      const res = await syncFromGoogleSheetUrl(config.sheetCsvUrl);
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message });
        onSyncSuccess();
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } else {
      setStatusMsg({ type: 'success', text: 'Paramètres Google Sheets enregistrés avec succès.' });
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = parseXlsxBuffer(buffer);
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message });
        onSyncSuccess();
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Erreur de lecture du fichier : ${err.message || err}` });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadCsv = () => {
    const csvContent = exportDatabaseToCsv();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Vodacom_Base_Donnees_GSheet_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop">
      <div className="modal-sheet relative w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-white tracking-wider">
              Import & Synchro <span className="text-emerald-400">Multi-Onglets</span>
            </h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              Chargement direct Fichier Excel (.xlsx) ou Lien Google Sheets
            </p>
          </div>
        </div>

        {statusMsg && (
          <div className={`p-3.5 rounded-2xl border mb-4 text-xs font-bold flex items-center space-x-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Direct Excel File Upload Section */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
            <label className="text-xs font-black uppercase text-emerald-400 block mb-2 flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Importer un Fichier Excel complet (.xlsx)</span>
            </label>
            <p className="text-[11px] text-gray-300 mb-3">
              Permet de parcourir et charger automatiquement tous les onglets (Users, Shops, Leads, DailyReports) à partir d'un fichier Excel.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{loading ? 'Traitement du fichier...' : 'Sélectionner Fichier .XLSX / .CSV'}</span>
            </button>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
              Ou Lien Google Sheets Publié (Import Web)
            </label>
            <div className="relative">
              <LinkIcon className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              <input
                type="url"
                value={config.sheetCsvUrl}
                onChange={(e) => setConfig({ ...config, sheetCsvUrl: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="w-full bg-black/60 border border-white/10 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Dans Google Sheets : <b className="text-gray-300">Fichier &gt; Partager &gt; Publier sur le web</b>.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
              URL Webhook Apps Script (Export temps réel)
            </label>
            <input
              type="url"
              value={config.webhookUrl}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-black/60 border border-white/10 rounded-2xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-gray-300">Auto-synchronisation en arrière-plan</span>
              <input
                type="checkbox"
                checked={config.autoSync}
                onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>
            {config.lastSyncedAt && (
              <p className="text-[10px] text-emerald-400 font-bold">
                Dernière synchro : {new Date(config.lastSyncedAt).toLocaleString('fr-FR')}
              </p>
            )}
          </div>

          {/* Apps Script Helper Code */}
          <details className="p-3.5 bg-zinc-900 border border-white/10 rounded-2xl group">
            <summary className="text-xs font-black uppercase text-amber-400 cursor-pointer flex items-center justify-between">
              <span>📜 Code Google Apps Script (Webhook + Drive Photos)</span>
              <span className="text-[10px] text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 space-y-2 text-[11px] text-gray-300">
              <p>Copiez ce code dans votre projet <b>Google Apps Script</b> (Fichier Code.gs) pour gérer l'envoi des photos sur Google Drive et l'écriture dans la feuille Checkins :</p>
              <pre className="p-3 bg-black/90 border border-white/10 rounded-xl text-[10px] text-emerald-300 overflow-x-auto select-all font-mono">
{`function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || data.event || data.type;
    if (action === 'processCheckin' || data.type === 'checkin' || data.tab === 'Checkins') {
      return ContentService.createTextOutput(JSON.stringify(processCheckin(data))).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify(processLead(data))).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function processCheckin(d) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let photoUrl = "";
    if (d.photo && d.photo.startsWith("data:image")) {
      try {
        const config = ss.getSheetByName("Config").getDataRange().getValues();
        const folderRow = config.find(r => String(r[0]).trim() === "PHOTOS_FOLDER_ID");
        if (folderRow && folderRow[1]) {
          const folderId = String(folderRow[1]).trim();
          const folder = DriveApp.getFolderById(folderId);
          const contentType = d.photo.split(",")[0].split(":")[1].split(";")[0];
          const bytes = Utilities.base64Decode(d.photo.split(",")[1]);
          const blob = Utilities.newBlob(bytes, contentType, "Pointage_" + (d.agent_id || "agent") + "_" + Date.now() + ".jpg");
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          photoUrl = file.getUrl();
        }
      } catch (errDrive) { console.error("Drive err: " + errDrive.message); }
    } else if (d.photo && d.photo.startsWith("http")) {
      photoUrl = d.photo;
    }
    const sheet = ss.getSheetByName("Checkins");
    if (!sheet) return { success: false, message: "Onglet Checkins introuvable" };
    sheet.appendRow([
      d.id || d.uuid || Utilities.getUuid(),
      d.assignment_id || "",
      d.agent_id || "",
      d.type || "IN",
      d.timestamp || new Date().toISOString(),
      d.lat || 0,
      d.long || d.lng || 0,
      d.accuracy || 0,
      photoUrl || d.photo || "",
      d.device || "Mobile App",
      d.status || "synced"
    ]);
    return { success: true, photoUrl: photoUrl };
  } catch (e) { return { success: false, message: e.message }; }
}`}
              </pre>
            </div>
          </details>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleSaveAndSync}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Connexion...' : 'Synchroniser URL GSheet'}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 transition-all border border-white/10"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exporter Base CSV</span>
            </button>
          </div>

          <div className="pt-2 border-t border-white/10">
            <button
              onClick={() => {
                if (window.confirm("Êtes-vous sûr de vouloir effectuer un reset complet ? Cela effacera toutes les données en cache et vous déconnectera.")) {
                  purgeAndResetEverything();
                  window.location.reload();
                }
              }}
              className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 transition-all border border-red-500/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>Vider le Cache & Reset Total (Déconnexion)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
