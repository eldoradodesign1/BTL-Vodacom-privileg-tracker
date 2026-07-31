import React, { useState, useEffect } from 'react';
import { User, Lead, Checkin, DailyReport } from '../types';
import { getShopById, checkDailyStatus, addCheckin, getReportPdf, getLeads, getCheckins, isMatchAgent, toISO } from '../utils/storage';
import { formatDriveImageUrl, getGSheetConfig, syncFromGoogleSheetUrl } from '../utils/googleSheetsSync';
import { TabType } from './BottomNav';
import { Trophy, MapPin, Camera, CheckCircle2, UserPlus, FileText, Users, Archive, Eye, Search, Filter, RefreshCw } from 'lucide-react';

interface AgentViewProps {
  currentUser: User;
  activeShopId: string;
  activeTab?: TabType;
  todayLeads: Lead[];
  todayCheckin: Checkin | null;
  agentReports: DailyReport[];
  onOpenLeadModal: () => void;
  onOpenReportModal: () => void;
  onOpenPdfModal: (url: string) => void;
  onRefreshData?: () => void;
}

export const AgentView: React.FC<AgentViewProps> = ({
  currentUser,
  activeShopId,
  activeTab = 'home',
  todayLeads,
  todayCheckin,
  agentReports,
  onOpenLeadModal,
  onOpenReportModal,
  onOpenPdfModal,
  onRefreshData
}) => {
  const [gpsInfo, setGpsInfo] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(todayCheckin?.photo || null);
  const [checkinDoneLocal, setCheckinDoneLocal] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientActionFilter, setClientActionFilter] = useState('ALL');
  const todayStr = new Date().toISOString().split('T')[0];
  const [clientDateFilter, setClientDateFilter] = useState<string>(todayStr);
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);

  const handleManualSync = async () => {
    setIsSyncingGSheet(true);
    try {
      const cfg = getGSheetConfig();
      if (cfg.sheetCsvUrl) {
        await syncFromGoogleSheetUrl(cfg.sheetCsvUrl);
        if (onRefreshData) onRefreshData();
      }
    } catch {} finally {
      setIsSyncingGSheet(false);
    }
  };

  useEffect(() => {
    const allCheckins = getCheckins();
    const myToday = allCheckins.find(c => c.agent_id === currentUser.id && c.timestamp.startsWith(todayStr));
    const rawPhoto = myToday?.photo || todayCheckin?.photo || null;
    setPhotoPreview(rawPhoto ? formatDriveImageUrl(rawPhoto) : null);
  }, [currentUser.id, todayCheckin?.photo, todayStr]);

  const { checkinDone, reportDone } = checkDailyStatus(currentUser.id, todayStr);

  const shopObj = getShopById(activeShopId || currentUser.permanentShopId);
  const shopName = shopObj ? shopObj.name : "Vodacom Flagship Gombe";

  // All history leads registered by this agent
  const allAgentLeads = getLeads().filter(l => 
    l.agent_id === currentUser.id || 
    l.agent_id === currentUser.name || 
    isMatchAgent(l.agent_id, currentUser)
  );

  const filteredLeads = allAgentLeads.filter(l => {
    const matchesSearch = l.client_name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
                          l.msisdn.includes(clientSearchTerm);
    const matchesFilter = clientActionFilter === 'ALL' || l.action_type.includes(clientActionFilter);
    const matchesDate = !clientDateFilter || toISO(l.timestamp) === clientDateFilter || l.timestamp.startsWith(clientDateFilter);
    return matchesSearch && matchesFilter && matchesDate;
  });

  const handleCaptureClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsInfo(`GPS OK (+/- ${pos.coords.accuracy.toFixed(0)}m) - Lat: ${pos.coords.latitude.toFixed(5)}, Long: ${pos.coords.longitude.toFixed(5)}`);
        },
        () => {
          setGpsInfo('GPS indisponible (mode simulé actif)');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 600;
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
          const base64 = canvas.toDataURL('image/jpeg', 0.6);
          setPhotoPreview(base64);

          const recordCheckin = (lat: number, long: number, accuracy: number) => {
            addCheckin({
              agent_id: currentUser.id,
              type: 'IN',
              timestamp: new Date().toISOString(),
              lat,
              long,
              accuracy,
              photo: base64,
              status: 'synced'
            });
            setCheckinDoneLocal(true);
            if (onRefreshData) onRefreshData();
          };

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                recordCheckin(
                  pos.coords.latitude,
                  pos.coords.longitude,
                  Math.round(pos.coords.accuracy || 5)
                );
              },
              () => {
                recordCheckin(shopObj?.lat || -4.3033, shopObj?.long || 15.3015, 15);
              },
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
          } else {
            recordCheckin(shopObj?.lat || -4.3033, shopObj?.long || 15.3015, 15);
          }
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // RENDER TAB 2: MES CLIENTS
  if (activeTab === 'tab2') {
    return (
      <div className="space-y-4 animate-pop pb-32">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Mes <span className="text-red-500">Clients</span>
            </h1>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Historique complet des enregistrements réalisés ({allAgentLeads.length})
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncingGSheet}
              className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-black uppercase flex items-center space-x-1.5 shadow-md transition-all"
              title="Actualiser en direct depuis Google Sheet"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingGSheet ? 'Synchro...' : 'Live GSheet'}</span>
            </button>

            <button
              onClick={onOpenLeadModal}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase flex items-center space-x-1 shadow-md shadow-red-600/30"
            >
              <UserPlus className="w-4 h-4" />
              <span>＋ Nouveau</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="glass-card p-3 border border-white/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Rechercher par Nom ou MSISDN..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Date Selector */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <input
                type="date"
                value={clientDateFilter}
                onChange={(e) => setClientDateFilter(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-2 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500 flex-1"
              />
              <button
                onClick={() => setClientDateFilter(todayStr)}
                className={`px-2 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border ${
                  clientDateFilter === todayStr ? 'bg-red-600 text-white border-red-500' : 'bg-white/5 text-gray-400 border-white/10'
                }`}
                title="Aujourd'hui"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setClientDateFilter('')}
                className={`px-2 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border ${
                  !clientDateFilter ? 'bg-red-600 text-white border-red-500' : 'bg-white/5 text-gray-400 border-white/10'
                }`}
                title="Toutes les dates"
              >
                Toutes
              </button>
            </div>
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-1">
            {['ALL', 'Privilège', 'Roaming', 'Bundle'].map(f => (
              <button
                key={f}
                onClick={() => setClientActionFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${
                  clientActionFilter === f
                    ? 'bg-red-600 text-white border-red-500'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                }`}
              >
                {f === 'ALL' ? 'Tous les produits' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Clients List */}
        <div className="space-y-2">
          {filteredLeads.length === 0 ? (
            <div className="glass-card p-6 text-center text-gray-400 space-y-3">
              <Users className="w-10 h-10 mx-auto text-gray-500" />
              <p className="text-xs font-bold">
                {allAgentLeads.length > 0 && clientDateFilter
                  ? `Aucun client trouvé pour la date sélectionnée.`
                  : 'Aucun client trouvé.'}
              </p>
              {allAgentLeads.length > 0 && clientDateFilter && (
                <button
                  onClick={() => setClientDateFilter('')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md"
                >
                  Voir l'historique complet ({allAgentLeads.length} clients)
                </button>
              )}
            </div>
          ) : (
            filteredLeads.map(lead => {
              const leadShop = getShopById(lead.shop_id);
              return (
                <div key={lead.id} className="glass-card p-4 border border-white/10 flex justify-between items-center hover:border-red-500/30 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-xs font-black text-white">{lead.client_name}</p>
                      <span className="text-[9px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                        {lead.msisdn}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-semibold flex items-center space-x-1">
                      <span>📍 {leadShop?.name || 'Shop Vodacom'}</span>
                      <span>•</span>
                      <span>{new Date(lead.timestamp).toLocaleDateString('fr-FR')}</span>
                    </p>
                  </div>

                  <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-red-600/20 text-red-400 rounded-xl border border-red-500/30">
                    {lead.action_type}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // RENDER TAB 3: MES ARCHIVES
  if (activeTab === 'tab3') {
    return (
      <div className="space-y-4 animate-pop pb-32">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Mes <span className="text-amber-400">Archives</span>
            </h1>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Historique de tous vos rapports journaliers présentés ({agentReports.length})
            </p>
          </div>

          <button
            onClick={onOpenReportModal}
            disabled={reportDone}
            className={`px-3 py-2 bg-amber-500 text-black rounded-2xl text-xs font-black uppercase flex items-center space-x-1 shadow-md ${
              reportDone ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Rapport</span>
          </button>
        </div>

        {/* Reports Archive List */}
        <div className="space-y-3">
          {agentReports.length === 0 ? (
            <div className="glass-card p-8 text-center text-gray-400">
              <Archive className="w-10 h-10 mx-auto text-gray-600 mb-2" />
              <p className="text-xs font-bold">Aucun rapport archivé pour le moment.</p>
            </div>
          ) : (
            agentReports.map(rep => (
              <div key={rep.id} className="glass-card p-4 border border-white/10 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black uppercase text-amber-400 block">Rapport Clôturé</span>
                    <h3 className="text-xs font-black uppercase text-white">{rep.date}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{rep.shop_name}</p>
                  </div>

                  <button
                    onClick={async () => {
                      const url = await getReportPdf(rep);
                      onOpenPdfModal(url);
                    }}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center space-x-1.5 shadow-md shadow-red-600/30 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>VOIR PDF</span>
                  </button>
                </div>

                {/* Report Key Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-[8px] text-gray-400 uppercase block">Privilège</span>
                    <span className="text-red-500 text-xs">{rep.priv}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-[8px] text-gray-400 uppercase block">Roaming</span>
                    <span className="text-amber-400 text-xs">{rep.roam}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-[8px] text-gray-400 uppercase block">Bundles</span>
                    <span className="text-blue-400 text-xs">{rep.bund}</span>
                  </div>
                </div>

                {rep.comment && (
                  <p className="text-[10px] text-gray-300 italic bg-black/40 p-2 rounded-xl border border-white/5">
                    "{rep.comment}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // RENDER TAB 1: HOME DASHBOARD
  return (
    <div className="space-y-6 animate-pop pb-32">
      {/* Welcome Banner */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Bonjour,<br />
            <span className="text-red-500">{currentUser.name}</span>
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-1 flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            <span>MISSION : <strong className="text-white">{shopName}</strong></span>
          </p>
        </div>

        <div className="glass-card px-4 py-2 rounded-2xl border border-white/10">
          <span className="text-[8px] font-black uppercase text-gray-400 block">📍 Shop Actif</span>
          <span className="text-xs font-black uppercase text-red-500">{shopObj?.city || 'Kinshasa'}</span>
        </div>
      </div>

      {/* Podium National Rank */}
      <div className="rank-card-podium podium-1 animate-pop">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Position National</span>
              <h3 className="text-lg font-black uppercase text-white">#1 Hôtesse du Mois</h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Aujourd'hui</span>
            <span className="text-3xl font-black text-white">{todayLeads.length}</span>
          </div>
        </div>
      </div>

      {/* Pointage Unique Arrivée */}
      <div className="glass-card text-center p-6 border border-white/10">
        <h2 className="text-xs font-black uppercase tracking-widest text-red-500 mb-4">Pointage d'Arrivée GPS</h2>

        {checkinDone || checkinDoneLocal ? (
          <div className="btn-neon bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 pointer-events-none">
            <CheckCircle2 className="w-5 h-5" />
            <span>POINTAGE EFFECTUÉ (GPS OK)</span>
          </div>
        ) : (
          <div className="space-y-3">
            <label
              onClick={handleCaptureClick}
              className="btn-neon btn-red cursor-pointer flex items-center justify-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>Déverrouiller le shop (Prendre photo)</span>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleCameraChange}
                className="hidden"
              />
            </label>
            {gpsInfo && <p className="text-[10px] font-black text-emerald-400">{gpsInfo}</p>}
          </div>
        )}

        {photoPreview && (
          <div className="mt-4 flex justify-center">
            <img
              src={photoPreview}
              alt="Photo de pointage"
              className="w-32 h-32 object-cover rounded-2xl border-2 border-red-500/50 shadow-lg"
            />
          </div>
        )}
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onOpenLeadModal}
          className="glass-card p-6 flex flex-col items-center justify-center space-y-2 text-center hover:border-red-500/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserPlus className="w-6 h-6" />
          </div>
          <span className="text-xs font-black uppercase text-white">Saisie Client</span>
          <span className="text-[9px] text-gray-400 font-semibold">Opt-in & Bundles</span>
        </button>

        <button
          onClick={onOpenReportModal}
          disabled={reportDone}
          className={`glass-card p-6 flex flex-col items-center justify-center space-y-2 text-center transition-all group ${
            reportDone ? 'opacity-60 cursor-not-allowed' : 'hover:border-red-500/50'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6" />
          </div>
          <span className="text-xs font-black uppercase text-white">
            {reportDone ? 'Session Clôturée' : 'Mon Rapport'}
          </span>
          <span className="text-[9px] text-gray-400 font-semibold">PDF & Synthèse</span>
        </button>
      </div>
    </div>
  );
};
