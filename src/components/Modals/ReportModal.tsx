import React, { useState } from 'react';
import { User, Lead } from '../../types';
import { getTargetsByShop, getShopById, addReport, addCheckin } from '../../utils/storage';
import { generateAgentPDF } from '../../utils/pdfGenerator';
import { FileText, Plus, X, Image as ImageIcon } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  currentUser: User;
  todayLeads: Lead[];
  activeShopId: string;
  onClose: () => void;
  onReportGenerated: (pdfUrl: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  currentUser,
  todayLeads,
  activeShopId,
  onClose,
  onReportGenerated
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportDate, setReportDate] = useState(todayStr);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const privCount = todayLeads.filter(l => l.action_type.includes('Privilège')).length;
  const roamCount = todayLeads.filter(l => l.action_type.includes('Roaming')).length;
  const bundCount = todayLeads.filter(l => l.action_type.includes('Bundle')).length;

  const shopIdToUse = activeShopId || currentUser.permanentShopId;
  const shopObj = getShopById(shopIdToUse);
  const shopName = shopObj ? shopObj.name : "Vodacom Shop";
  const targets = getTargetsByShop(shopIdToUse);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach((file: File) => {
      if (photos.length >= 3) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxDim = 400;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) { h *= maxDim / w; w = maxDim; }
          } else {
            if (h > maxDim) { w *= maxDim / h; h = maxDim; }
          }
          canvas.width = w;
          canvas.height = h;
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL('image/jpeg', 0.5);
            setPhotos(prev => [...prev.slice(0, 2), base64]);
          }
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSendReport = async () => {
    setLoading(true);

    // Auto silent OUT check-in
    addCheckin({
      agent_id: currentUser.id,
      type: 'OUT',
      timestamp: new Date().toISOString(),
      lat: shopObj?.lat || -4.3033,
      long: shopObj?.long || 15.3015,
      accuracy: 5,
      status: 'synced'
    });

    const nowTimeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const pdfDataUrl = await generateAgentPDF({
      agentName: currentUser.name,
      shopName,
      date: reportDate,
      arrivalTime: '08:00',
      departureTime: nowTimeStr,
      mapsIn: `https://www.google.com/maps/search/?api=1&query=${shopObj?.lat || -4.3033},${shopObj?.long || 15.3015}`,
      mapsOut: `https://www.google.com/maps/search/?api=1&query=${shopObj?.lat || -4.3033},${shopObj?.long || 15.3015}`,
      totalPrivilege: privCount,
      totalRoaming: roamCount,
      totalBundles: bundCount,
      targets,
      leads: todayLeads,
      photos,
      comment
    });

    addReport({
      date: reportDate,
      agent_id: currentUser.id,
      agent_name: currentUser.name,
      shop_id: shopIdToUse,
      shop_name: shopName,
      priv: privCount,
      roam: roamCount,
      bund: bundCount,
      amount: 0,
      comment,
      pdf_url: pdfDataUrl,
      photos
    });

    setLoading(false);
    onReportGenerated(pdfDataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop">
      <div className="modal-sheet relative w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black uppercase text-red-500 tracking-wider">Clôture de Session</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Génération du Rapport PDF d'activité</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Date d'activité</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm font-bold text-center focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="text-[8px] font-black uppercase text-gray-400">Privilège</span>
              <p className="text-lg font-black text-white">{privCount}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
              <span className="text-[8px] font-black uppercase text-gray-400">Roaming</span>
              <p className="text-lg font-black text-amber-400">{roamCount}</p>
            </div>
            <div className="bg-red-600/20 border border-red-500/30 p-3 rounded-2xl">
              <span className="text-[8px] font-black uppercase text-red-400">Bundles</span>
              <p className="text-lg font-black text-red-500">{bundCount}</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Preuves Photos (Max 3)</label>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, idx) => (
                <div key={idx} className="aspect-square rounded-2xl bg-cover bg-center relative border border-white/20 overflow-hidden" style={{ backgroundImage: `url(${p})` }}>
                  <button
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <label className="aspect-square rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-gray-400 hover:text-white cursor-pointer bg-white/5 hover:bg-white/10 transition-all">
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-[9px] font-black uppercase">Photo</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Observations / Remarques</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Saisissez ici les observations de la journée..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs h-24 focus:outline-none focus:border-red-500"
            />
          </div>

          <button
            onClick={handleSendReport}
            disabled={loading}
            className="btn-neon btn-red w-full mt-4 flex items-center justify-center space-x-2"
          >
            <FileText className="w-4 h-4" />
            <span>{loading ? 'GÉNÉRATION DU PDF...' : 'GÉNÉRER LE RAPPORT PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
