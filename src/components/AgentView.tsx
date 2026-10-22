import React, { useState, useEffect, useRef } from 'react';
import { User, Shop, Lead, Checkin, DailyReport } from '../types';
import { getShopById, checkDailyStatus, addCheckin, getLeads, getCheckins, getSyncPendingCount, isMatchAgent, toISO, getUsers, resolveStoredPhotoUrl, getEffectiveTargetsForDate } from '../utils/storage';
import { TabType } from './BottomNav';
import { DayCard } from './ui/DayCard';
import { Trophy, MapPin, Camera, CheckCircle2, UserPlus, FileText, Users, Archive, Eye, Search, Filter, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { buildPointageFeedback } from '../utils/pointageStatus';
import { DateIconPicker } from './DateIconPicker';

interface AgentViewProps {
  currentUser: User;
  shops: Shop[];
  activeShopId: string;
  activeTab?: TabType;
  todayLeads: Lead[];
  todayCheckin: Checkin | null;
  agentReports: DailyReport[];
  onOpenLeadModal: () => void;
  onOpenReportModal: () => void;
  onOpenPdfModal: (url: string) => void;
  onRefreshData?: () => void;
  campaignPaused?: boolean;
  pauseReason?: string;
}

export const AgentView: React.FC<AgentViewProps> = ({
  currentUser,
  shops,
  activeShopId,
  activeTab = 'home',
  todayLeads,
  todayCheckin,
  agentReports,
  onOpenLeadModal,
  onOpenReportModal,
  onOpenPdfModal,
  onRefreshData,
  campaignPaused = false,
  pauseReason = ''
}) => {
  const [gpsInfo, setGpsInfo] = useState('');
  const startInputRef = useRef<HTMLInputElement>(null);
  const [geoBadge, setGeoBadge] = useState<{ text: string; status: 'ok' | 'warn' | 'unknown' } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(todayCheckin?.photo || null);
  const [checkinDoneLocal, setCheckinDoneLocal] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientActionFilter, setClientActionFilter] = useState('ALL');
  const todayStr = new Date().toISOString().split('T')[0];
  const [clientDateFilter, setClientDateFilter] = useState<string>(todayStr);
  useEffect(() => {
    const allCheckins = getCheckins();
    const myTodayIn = allCheckins
      .filter(c => c.agent_id === currentUser.id && toISO(c.timestamp) === todayStr && c.type === 'IN');
    const withPhoto = myTodayIn.find(c => !!(c.photo_drive_url || c.photo));
    const fallback = myTodayIn[0] || todayCheckin || null;
    const rawPhoto = withPhoto?.photo_drive_url || withPhoto?.photo || fallback?.photo_drive_url || fallback?.photo || null;
    const resolved = resolveStoredPhotoUrl(rawPhoto || '');
    setPhotoPreview(resolved || null);
  }, [currentUser.id, todayCheckin?.photo, todayStr]);

  const { checkinDone, reportDone } = checkDailyStatus(currentUser.id, todayStr);
  const feedback = buildPointageFeedback({ stage: checkinDone || checkinDoneLocal ? 'captured' : 'idle', gpsMessage: gpsInfo, geoBadge: geoBadge || undefined });

  const assignedShopId = currentUser.permanentShopId || activeShopId;
  const shopObj = shops.find((shop) => shop.id === assignedShopId) || getShopById(assignedShopId);
  const shopName = shopObj ? shopObj.name : 'Non affecté';

  const allUsers = getUsers();
  const sameTeamAgents = allUsers.filter(u => u.role === 'agent' && u.supervisorId === currentUser.supervisorId);
  const allAgents = allUsers.filter(u => u.role === 'agent');
  // getLeads() trie les contacts : on ne le rappelle pas à chaque agent.
  const rankingLeads = getLeads();
  const todayRankingLeads = rankingLeads.filter(lead => toISO(lead.timestamp) === todayStr);
  const activityRanking = sameTeamAgents
    .map(agent => {
      const total = todayRankingLeads.filter(l => l.agent_id === agent.id || l.agent_id === agent.name || isMatchAgent(l.agent_id, agent)).length;
      return { ...agent, total };
    })
    .filter(agent => agent.total > 0)
    .sort((a, b) => b.total - a.total);
  const globalActivityRanking = allAgents
    .map(agent => {
      const total = todayRankingLeads.filter(l => l.agent_id === agent.id || l.agent_id === agent.name || isMatchAgent(l.agent_id, agent)).length;
      return { ...agent, total };
    })
    .filter(agent => agent.total > 0)
    .sort((a, b) => b.total - a.total);
  const myTodayTotal = globalActivityRanking.find(agent => agent.id === currentUser.id)?.total ?? todayLeads.length;
  const myTodayRank = myTodayTotal > 0 ? globalActivityRanking.findIndex(agent => agent.id === currentUser.id) + 1 : 0;
  const podiumTier = myTodayRank === 1 ? 'gold' : (myTodayRank === 2 ? 'silver' : (myTodayRank === 3 ? 'bronze' : null));
  const podiumLabel = myTodayTotal > 0 ? `#${myTodayRank}` : 'Non classé';
  const showPodium = myTodayTotal > 0;
  const evolutionData = [...agentReports]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-6)
    .map(rep => ({
      label: rep.date.slice(5),
      value: rep.priv + rep.roam + rep.bund
    }));

  // All history leads registered by this agent
  const allAgentLeads = rankingLeads.filter(l => 
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

  const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || campaignPaused) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 320;
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
          const base64 = canvas.toDataURL('image/jpeg', 0.45);
          setPhotoPreview(base64);

          const recordCheckin = (lat: number, long: number, accuracy: number) => {
            const shopLat = shopObj?.lat;
            const shopLong = shopObj?.long;
            const distance = (typeof shopLat === 'number' && typeof shopLong === 'number')
              ? haversineDistanceMeters(lat, long, shopLat, shopLong)
              : -1;
            const isConforme = distance >= 0 && distance <= 200;

            addCheckin({
              agent_id: currentUser.id,
              type: 'IN',
              timestamp: new Date().toISOString(),
              lat,
              long,
              accuracy,
              photo: base64,
              distance_m: distance >= 0 ? distance : undefined,
              geo_status: distance < 0 ? 'inconnu' : (isConforme ? 'conforme' : 'hors_zone'),
              status: 'pending'
            });

            if (distance < 0) {
              setGeoBadge({ text: 'Donnees GPS non disponible', status: 'unknown' });
            } else if (isConforme) {
              setGeoBadge({ text: `A ${distance}m du shop - Conforme`, status: 'ok' });
            } else {
              setGeoBadge({ text: `Hors zone > 200m (actuel ${distance}m)`, status: 'warn' });
            }

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
              onClick={onOpenLeadModal}
              disabled={reportDone || campaignPaused}
              className={`px-3 py-2 rounded-2xl text-xs font-black uppercase flex items-center space-x-1 shadow-md transition-all ${
                reportDone || campaignPaused
                  ? 'bg-zinc-700/70 text-zinc-300 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>{campaignPaused ? 'Campagne en pause' : (reportDone ? 'Session clôturée' : '＋ Nouveau')}</span>
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
              <DateIconPicker
                value={clientDateFilter}
                onChange={setClientDateFilter}
                className="flex-1 inline-flex items-center"
                buttonClassName="h-10 w-10 rounded-xl bg-black/60 border border-white/10 text-gray-200 hover:bg-white/10"
                labelClassName="text-[10px] font-black uppercase text-gray-200"
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
            disabled={reportDone || campaignPaused}
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
                    onClick={() => onOpenPdfModal(`report-id:${rep.id}`)}
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

  // La page de démarrage est isolée: aucune logique post-pointage n'est remplacée.
  if (activeTab === 'home' && !(checkinDone || checkinDoneLocal)) return (
    <section className="agent-before-checkin agent-home-surface space-y-4 pb-6">
      <h1 className="pt-5 text-center text-lg font-black uppercase tracking-[0.08em] text-white">Vodacom Privilège</h1>
      {globalActivityRanking.slice(0, 3).some(Boolean) ? (
      <div className="px-5 pt-2"><div className="btl-podium-grid mt-4 grid grid-cols-3 items-end gap-2">{([2, 0, 1] as const).map((rankIndex) => { const entry = globalActivityRanking[rankIndex]; return <div key={rankIndex} className="min-w-0 text-center">
  <div className="btl-podium-avatar mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-black text-white">{entry ? entry.name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() : <Users size={18}/>}</div>
  <p className="mt-2 truncate text-[12px] font-black text-white" title={entry?.name || 'Place libre'}>{entry?.name || 'Place libre'}</p>
  <p className="mt-0.5 text-[11px] text-gray-300">{entry ? entry.total + ' clients' : '0 client'}</p>
  <div className={rankIndex === 0 ? 'mt-2 flex h-20 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/20 text-xl font-black text-amber-200' : rankIndex === 1 ? 'mt-2 flex h-14 items-center justify-center rounded-2xl border border-slate-300/20 bg-slate-300/15 text-lg font-black text-slate-200' : 'mt-2 flex h-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-400/15 text-lg font-black text-orange-200'}>{rankIndex + 1}</div>
</div>;})}</div></div>
      ) : (
      <div className="btl-podium-empty" role="status"><Trophy className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true"/><span>Classement du jour : personne n’a encore enregistré de client. Soyez le premier&nbsp;!</span></div>
      )}
      <div className="flex justify-center py-6" style={{minHeight:'min(43vh,380px)'}}>
        <button type="button" disabled={campaignPaused || reportDone} onClick={() => { handleCaptureClick(); startInputRef.current?.click(); }} aria-label="Démarrer la journée : prendre la photo de pointage" title="Démarrer la journée" className={`btl-power-button ${campaignPaused || reportDone ? 'btl-power-button--inactive' : 'btl-power-button--ready'} flex flex-col items-center justify-center gap-3 text-center text-white ${campaignPaused || reportDone ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`} style={{width:'min(65vw,250px)',aspectRatio:'1',borderRadius:'50%',background:'radial-gradient(circle at 35% 25%, rgba(105,28,51,.95),rgba(35,10,27,.98) 55%,#0e101b 100%)',border:'3px solid var(--theme-accent)',boxShadow:'0 0 0 9px rgba(251,113,133,.09),0 20px 55px rgba(0,0,0,.65),inset 0 2px 18px rgba(255,255,255,.12)'}}>
          <svg viewBox="0 0 24 24" width="100" height="100" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/><path d="M12 2v10"/></svg><span className="text-sm font-black uppercase tracking-widest">Démarrer la journée</span>
        </button>
        <input ref={startInputRef} type="file" accept="image/*" capture="user" className="hidden" tabIndex={-1} disabled={campaignPaused || reportDone} onChange={handleCameraChange}/>
      </div>
      {!campaignPaused && !reportDone && <p className="btl-start-hint">Touchez le bouton pour prendre votre photo de pointage. Votre position GPS est relevée automatiquement.</p>}
      {campaignPaused && <p className="text-center text-sm font-bold text-amber-200">Campagne en pause. Pointage indisponible.</p>}
      {feedback.primaryText && <p className="text-center text-[11px] text-gray-300">{feedback.primaryText}</p>}
    </section>
  );

  

  // RENDER TAB 1: HOME DASHBOARD
  return (
    <div className="agent-home-surface space-y-5 animate-pop pb-8">
      <p className="agent-greeting">Bonjour, <strong>{currentUser.name}</strong> · {shopName}</p>
      {(() => {
        const t = getEffectiveTargetsForDate(todayStr, activeShopId);
        const dailyTarget = Math.max((t?.privilege || 0) + (t?.roaming || 0) + (t?.bundle || 0), 0) || 20;
        const bundles = todayLeads.filter((lead) => lead.action_type === 'Activation Bundle').length;
        return (
          <DayCard
            statusLabel={reportDone ? 'Clôturée' : campaignPaused ? 'En pause' : 'En cours'}
            statusTone={reportDone ? 'closed' : campaignPaused ? 'paused' : 'live'}
            value={myTodayTotal}
            target={dailyTarget}
            unitLabel="clients"
            secondaryValue={bundles}
            secondaryLabel="bundles"
          />
        );
      })()}

      {campaignPaused && (
        <section className="glass-card border border-amber-300/35 bg-amber-500/[0.08] p-4 text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Campagne actuellement en pause</p>
          <p className="mt-1 text-xs font-semibold text-amber-50">Les pointages, saisies clients et rapports sont suspendus. Vos clients et archives restent consultables.</p>
          {pauseReason && <p className="mt-2 rounded-xl border border-amber-200/15 bg-black/15 px-3 py-2 text-[10px] font-bold text-amber-100">{pauseReason}</p>}
        </section>
      )}

      {showPodium && !(checkinDone || checkinDoneLocal) && (
        <div className={`rank-card-podium animate-pop ${podiumTier ? `podium-${podiumTier}` : 'podium-neutral'}`} style={podiumTier ? { ['--podium-watermark' as string]: `url('/Trophees/Trophee_${podiumTier === 'gold' ? 'Gold' : (podiumTier === 'silver' ? 'Silver' : 'Bronze')}.webp')` } : undefined}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-sm">
                <Trophy className={`w-8 h-8 ${podiumTier === 'gold' ? 'text-amber-400' : (podiumTier === 'silver' ? 'text-slate-300' : 'text-amber-700')}`} />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Position</span>
                <h3 className="text-lg font-black uppercase text-white">{podiumLabel}</h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Aujourd'hui</span>
              <span className="text-3xl font-black text-white">{myTodayTotal}</span>
            </div>
          </div>
        </div>
      )}

      {(checkinDone || checkinDoneLocal) && <section className="glass-card border border-amber-300/20 p-4" aria-label="Classement du jour">
        <div className="grid grid-cols-3 items-end gap-2">{([2,0,1] as const).map((rankIndex) => { const entry = globalActivityRanking[rankIndex]; return <div key={rankIndex} className="min-w-0 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-black text-white">{entry ? entry.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase() : <Users size={18}/>}</div>
          <p className="mt-2 truncate text-[10px] font-black text-white" title={entry?.name||'Place libre'}>{entry?.name||'Place libre'}</p>
          <p className="mt-0.5 text-[9px] text-gray-400">{entry ? entry.total+' clients' : '0 client'}</p>
          <div className={rankIndex===0?'mt-2 flex h-20 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/20 text-xl font-black text-amber-200':rankIndex===1?'mt-2 flex h-14 items-center justify-center rounded-2xl border border-slate-300/20 bg-slate-300/15 text-lg font-black text-slate-200':'mt-2 flex h-10 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-400/15 text-lg font-black text-orange-200'}>{rankIndex+1}</div>
        </div>;})}</div>
        {myTodayTotal>0 && myTodayRank>3 && <p className="mt-3 text-center text-[10px] text-gray-400">Votre rang : #{myTodayRank}</p>}
      </section>}

      {!(checkinDone || checkinDoneLocal) && !campaignPaused && (
        <div className="glass-card text-center p-6 border border-white/10">
          <h2 className="text-xs font-black uppercase tracking-widest text-red-500 mb-4">Pointage d'Arrivée GPS</h2>

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
            {feedback.primaryText && <p className={`text-[10px] font-black ${feedback.badgeStatus === 'warn' ? 'text-amber-400' : (feedback.badgeStatus === 'unknown' ? 'text-zinc-300' : 'text-emerald-400')}`}>{feedback.primaryText}</p>}
          </div>

          {photoPreview && (
            <div className="mt-4 flex justify-center">
              <img
                src={photoPreview}
                alt="Photo de pointage"
                className="w-32 h-32 object-cover rounded-2xl border-2 border-red-500/50 shadow-lg"
              />
            </div>
          )}

          {feedback.showBadge && feedback.badgeText && (
            <div className={`mt-3 inline-flex items-center px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase ${
              feedback.badgeStatus === 'ok'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : (feedback.badgeStatus === 'warn'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30')
            }`}>
              {feedback.badgeText}
            </div>
          )}
        </div>
      )}

      {/* Avant le pointage, conserver l'interface existante. */}
      {!(checkinDone || checkinDoneLocal) && (
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onOpenLeadModal}
          disabled={reportDone || campaignPaused}
          className={`glass-card p-6 flex flex-col items-center justify-center space-y-2 text-center transition-all group ${
            reportDone || campaignPaused ? 'opacity-60 cursor-not-allowed' : 'hover:border-red-500/50'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserPlus className="w-6 h-6" />
          </div>
          <span className="text-xs font-black uppercase text-white">{reportDone ? 'Session clôturée' : 'Saisie Client'}</span>
          <span className="text-[9px] text-gray-400 font-semibold">{reportDone ? 'Rapport déjà envoyé' : 'Opt-in & Bundles'}</span>
        </button>

        <button
          onClick={onOpenReportModal}
          disabled={reportDone || campaignPaused}
          className={`glass-card p-6 flex flex-col items-center justify-center space-y-2 text-center transition-all group ${
            reportDone || campaignPaused ? 'opacity-60 cursor-not-allowed' : 'hover:border-red-500/50'
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

      )}
      {(checkinDone || checkinDoneLocal) && <button type="button" onClick={onOpenReportModal} disabled={reportDone || campaignPaused} className="agent-closure-action flex w-full items-center justify-center gap-3 rounded-3xl px-5 py-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"><FileText size={21}/>{reportDone ? 'Journée clôturée' : 'Clôturer'}</button>}
      <div className="glass-card p-4 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Évolution</p>
            <p className="text-xs font-black uppercase text-white">Derniers rapports</p>
          </div>
          <span className="text-[10px] font-black uppercase text-red-400">{evolutionData.length} jours</span>
        </div>
        <div className="mt-3 h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionData}>
              <XAxis dataKey="label" stroke="#71717a" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '10px', fontSize: '11px' }} />
              <Line type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={2.2} dot={{ r: 3, fill: '#f43f5e' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
