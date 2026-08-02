import React, { useEffect, useRef, useState } from 'react';
import { User, Shop, AgentMasterStatus } from '../types';
import { getSupervisorLiveView, getReports, getUsers, getLeads, updateUserShopAssignment, resolveStoredPhotoUrl, saveTargetDefinition, getEffectiveTargetsForDate } from '../utils/storage';
import { formatAgentLocationLine, getLocationEmbedUrl } from '../utils/location';
import { TabType } from './BottomNav';
import { Trophy, FileCheck, Eye, Search, Store, UserCheck, MapPin, Archive, NotebookText, Camera, Clock3, FileText, ChevronDown, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateIconPicker } from './DateIconPicker';

interface SupervisorViewProps {
  currentUser: User;
  activeTab?: TabType;
  shops: Shop[];
  onOpenPdfModal: (url: string) => void;
  onOpenAgentProfile?: (agent: AgentMasterStatus) => void;
  onOpenTodayClientsModal?: (agent: AgentMasterStatus) => void;
  onOpenLocationModal?: (agent: AgentMasterStatus) => void;
  onRefreshData?: () => void;
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({
  currentUser,
  activeTab = 'home',
  shops,
  onOpenPdfModal,
  onOpenAgentProfile,
  onOpenTodayClientsModal,
  onOpenLocationModal,
  onRefreshData
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Online' | 'Absent' | 'Clôturé'>('ALL');
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assigningShopId, setAssigningShopId] = useState<string>('');
  const [inlineAssignShop, setInlineAssignShop] = useState<Record<string, string>>({});
  const [targetPrivilegeStd, setTargetPrivilegeStd] = useState(20);
  const [targetPrivilegeAir, setTargetPrivilegeAir] = useState(20);
  const [targetRoamingStd, setTargetRoamingStd] = useState(3);
  const [targetRoamingAir, setTargetRoamingAir] = useState(15);
  const [targetBundleStd, setTargetBundleStd] = useState(10);
  const [targetBundleAir, setTargetBundleAir] = useState(10);
  const [isTargetsCardOpen, setIsTargetsCardOpen] = useState(false);
  const [draggedHostess, setDraggedHostess] = useState<{ agentId: string; fromShopId: string } | null>(null);
  const [dragOverShopId, setDragOverShopId] = useState<string | null>(null);
  const [selectedLocationAgent, setSelectedLocationAgent] = useState<{ id: string; name: string; shop: string; status?: 'Présent' | 'Clôturé' | 'Absent'; arrivalTime?: string; departureTime?: string; mapsIn?: string; mapsOut?: string; lat?: number; long?: number } | null>(null);
  const [showHomeCalendar, setShowHomeCalendar] = useState(false);
  const [homeCalendarMonth, setHomeCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const homeCalendarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showHomeCalendar) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!homeCalendarRef.current) return;
      if (!homeCalendarRef.current.contains(event.target as Node)) {
        setShowHomeCalendar(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowHomeCalendar(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showHomeCalendar]);

  const teamData = getSupervisorLiveView(currentUser.id, selectedDate);
  const allUsers = getUsers();
  const supervisedAgents = allUsers.filter(u => u.role === 'agent' && u.supervisorId === currentUser.id);

  const activeCount = teamData.filter(t => t.status !== 'Absent').length;
  const closedCount = teamData.filter(t => t.status === 'Clôturé').length;

  const getStatusPalette = (status: string) => {
    if (status === 'Clôturé') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (status === 'Présent') return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    return 'bg-red-500/20 text-red-400 border-red-500/40';
  };

  const formatIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const selectedHomeDate = (() => {
    const parsed = new Date(`${selectedDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  })();
  const selectedDateLabel = selectedHomeDate.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const monthLabel = homeCalendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const firstDayOfMonth = new Date(homeCalendarMonth.getFullYear(), homeCalendarMonth.getMonth(), 1);
  const daysInMonth = new Date(homeCalendarMonth.getFullYear(), homeCalendarMonth.getMonth() + 1, 0).getDate();
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const dayCells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - startOffset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    const dayDate = new Date(homeCalendarMonth.getFullYear(), homeCalendarMonth.getMonth(), dayNumber);
    return {
      dayNumber,
      iso: formatIsoDate(dayDate),
      isToday: formatIsoDate(dayDate) === formatIsoDate(new Date()),
      isSelected: formatIsoDate(dayDate) === selectedDate
    };
  });

  const handleSaveTarget = () => {
    const today = new Date().toISOString().split('T')[0];
    saveTargetDefinition({
      user_id: currentUser.id,
      date: today,
      target_privilege_std: targetPrivilegeStd,
      target_privilege_air: targetPrivilegeAir,
      target_roaming_std: targetRoamingStd,
      target_roaming_air: targetRoamingAir,
      target_bundle_std: targetBundleStd,
      target_bundle_air: targetBundleAir
    });
    if (onRefreshData) onRefreshData();
  };

  // Podium sorting only when there is real activity
  const sortedPodium = [...teamData]
    .filter(item => (item.stats.priv + item.stats.roam + item.stats.bund) > 0)
    .sort((a, b) => {
      const totalA = a.stats.priv + a.stats.roam + a.stats.bund;
      const totalB = b.stats.priv + b.stats.roam + b.stats.bund;
      return totalB - totalA;
    });

  const handleGenerateSupervisorReport = async () => {
    setLoading(true);
    const targetsByAgent = teamData.map((item) => {
      const assignedShopId =
        supervisedAgents.find((u) => u.id === item.id)?.permanentShopId
        || item.reportObj?.shop_id
        || '';
      return getEffectiveTargetsForDate(selectedDate, assignedShopId);
    });

    const dayTargets = targetsByAgent.reduce(
      (acc, target) => {
        acc.privilege += Number(target.privilege || 0);
        acc.roaming += Number(target.roaming || 0);
        acc.bundle += Number(target.bundle || 0);
        return acc;
      },
      { privilege: 0, roaming: 0, bundle: 0 }
    );

    const reports = teamData
      .filter(item => item.reportObj)
      .map(item => {
        const reportLeads = getLeads().filter(l => l.agent_id === item.id && l.timestamp.startsWith(selectedDate));
        return {
          agentName: item.name,
          shopName: item.shop,
          date: selectedDate,
          arrivalTime: item.reportObj?.arrival_time || '08:00',
          departureTime: item.reportObj?.departure_time || '17:30',
          mapsIn: item.reportObj?.maps_in || '',
          mapsOut: item.reportObj?.maps_out || '',
          totalPrivilege: item.reportObj?.priv ?? item.stats.priv,
          totalRoaming: item.reportObj?.roam ?? item.stats.roam,
          totalBundles: item.reportObj?.bund ?? item.stats.bund,
          targets: { privilege: 20, roaming: 20, bundle: 20 },
          leads: reportLeads.map(l => ({
            timestamp: l.timestamp,
            client_name: l.client_name,
            msisdn: l.msisdn,
            action_type: l.action_type
          })),
          pointagePhoto: resolveStoredPhotoUrl(item.reportObj?.pointage_photo || '') || '',
          photos: item.reportObj?.photos || [],
          comment: item.reportObj?.comment || '',
          evolutionData: [item.stats.priv, item.stats.priv + item.stats.roam, item.stats.priv + item.stats.roam + item.stats.bund]
        };
      });

    const payload = {
      supName: currentUser.name,
      date: selectedDate,
      dayTargets: {
        privilege: dayTargets.privilege,
        roaming: dayTargets.roaming,
        bundle: dayTargets.bundle,
        total: dayTargets.privilege + dayTargets.roaming + dayTargets.bundle,
        deployedCount: teamData.length
      },
      team: teamData,
      reports
    };
    setLoading(false);
    onOpenPdfModal(`preview-supervisor:${encodeURIComponent(JSON.stringify(payload))}`);
  };

  const handleAssignShopSubmit = (userId: string, shopId: string) => {
    updateUserShopAssignment(userId, shopId);
    setAssigningUserId(null);
    if (onRefreshData) onRefreshData();
  };

  const handleDropHostessOnShop = (targetShopId: string, payload?: { agentId: string; fromShopId: string } | null) => {
    const source = payload || draggedHostess;
    if (!source) return;

    const { agentId, fromShopId } = source;
    setDraggedHostess(null);
    setDragOverShopId(null);

    if (fromShopId === targetShopId) return;

    const agent = supervisedAgents.find((u) => u.id === agentId);
    const fromShop = shops.find((s) => s.id === fromShopId);
    const toShop = shops.find((s) => s.id === targetShopId);
    if (!agent || !toShop) return;

    const confirmed = window.confirm(
      `Confirmer l'affectation de ${agent.name} de ${fromShop?.name || 'shop actuel'} vers ${toShop.name} ?`
    );
    if (!confirmed) return;

    updateUserShopAssignment(agentId, targetShopId);
    // Force immediate local repaint so source/target shop cards reflect new assignment.
    setInlineAssignShop((prev) => ({ ...prev }));
    if (onRefreshData) onRefreshData();
  };

  // --- TAB 2: MONITORING ---
  if (activeTab === 'tab2') {
    const filteredTeam = teamData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.shop.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL'
        || (statusFilter === 'Online' && item.status === 'Présent')
        || (statusFilter === 'Absent' && item.status === 'Absent')
        || (statusFilter === 'Clôturé' && item.status === 'Clôturé');

      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-4 animate-pop pb-32">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Monitoring <span className="text-red-500">Équipe</span>
            </h1>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Suivi détaillé et historique individuel des hôtesses ({teamData.length})
            </p>
          </div>

          <DateIconPicker
            value={selectedDate}
            onChange={setSelectedDate}
            className="inline-flex items-center"
            buttonClassName="h-10 w-10 rounded-xl bg-black/60 border border-white/10 text-gray-200 hover:bg-white/10"
            labelClassName="text-[10px] font-black uppercase text-gray-200"
          />
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Rechercher une hôtesse ou un shop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-2xl pl-9 pr-3 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: 'Toutes' },
            { key: 'Online', label: 'En ligne' },
            { key: 'Absent', label: 'Absents' },
            { key: 'Clôturé', label: 'Clôturés' }
          ].map(option => {
            const isActive = statusFilter === option.key;
            return (
              <button
                key={option.key}
                onClick={() => setStatusFilter(option.key as 'ALL' | 'Online' | 'Absent' | 'Clôturé')}
                className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${
                  isActive
                    ? 'bg-red-600 text-white border-red-500 shadow-lg'
                    : 'bg-black/60 text-gray-300 border-white/10 hover:border-red-500/40 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Agent Cards */}
        <div className="space-y-3">
          {filteredTeam.map(item => {
            const statusBg = getStatusPalette(item.status);
            const totalLeads = item.stats.priv + item.stats.roam + item.stats.bund;

            return (
              <div
                key={item.id}
                className="glass-card p-4 border border-white/10 space-y-3 hover:border-red-500/30 transition-all cursor-pointer"
                onClick={() => {
                  if (onOpenAgentProfile) {
                    onOpenAgentProfile({
                      id: item.id,
                      name: item.name,
                      phone: '0810000000',
                      shop: item.shop,
                      shopId: '',
                      status: item.status,
                      trend: [4, 7, 5, 12, 18, 14, totalLeads]
                    });
                  }
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 w-full">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-black uppercase text-white">{item.name}</h3>
                      <select
                        value={inlineAssignShop[item.id] || ''}
                        onChange={(e) => {
                          const nextShopId = e.target.value;
                          if (!nextShopId) return;

                          const confirmed = window.confirm(`Affecter ${item.name} à ce shop ?`);
                          if (!confirmed) return;

                          updateUserShopAssignment(item.id, nextShopId);
                          setInlineAssignShop(prev => ({ ...prev, [item.id]: '' }));
                          if (onRefreshData) onRefreshData();
                        }}
                        className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-[10px] font-bold min-w-[120px]"
                      >
                        <option value="">shop...</option>
                        {shops.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[9px] font-bold text-gray-400 uppercase flex items-center flex-wrap gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-blue-400" />
                      <span>{formatAgentLocationLine({
                        shop: item.shop,
                        status: item.status,
                        arrivalTime: item.reportObj?.arrival_time,
                        departureTime: item.reportObj?.departure_time
                      })}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        if (item.status === 'Présent' || item.status === 'Clôturé') {
                          const agentForLocation: AgentMasterStatus = {
                            id: item.id,
                            name: item.name,
                            phone: '0810000000',
                            shop: item.shop,
                            shopId: '',
                            status: item.status,
                            trend: [0, 0, 0],
                            reportObj: item.reportObj,
                            stats: item.stats
                          };
                          if (onOpenLocationModal) onOpenLocationModal(agentForLocation);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border ${statusBg} ${(item.status === 'Présent' || item.status === 'Clôturé') ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                      title={item.status === 'Présent' ? 'Voir la localisation de pointage' : (item.status === 'Clôturé' ? 'Voir la localisation de clôture' : undefined)}
                    >
                      {item.status}
                    </button>

                    {onOpenAgentProfile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAgentProfile({
                            id: item.id,
                            name: item.name,
                            phone: '0810000000',
                            shop: item.shop,
                            shopId: '',
                            status: item.status,
                            trend: [4, 7, 5, 12, 18, 14, totalLeads]
                          });
                        }}
                        className={`p-1.5 ${statusBg} rounded-xl border transition-all shrink-0`}
                        title="Voir l'historique des rapports"
                      >
                        <NotebookText className="w-4 h-4" />
                      </button>
                    )}

                    {item.reportObj && (
                      <button
                        onClick={() => onOpenPdfModal(`report-id:${item.reportObj!.id}`)}
                        className={`p-1.5 ${statusBg} rounded-xl border transition-all shrink-0`}
                        title="Voir le rapport PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {item.status !== 'Absent' && (
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                    {[
                      { label: 'Privilège', value: item.stats.priv, colorClass: 'text-red-500' },
                      { label: 'Roaming', value: item.stats.roam, colorClass: 'text-amber-400' },
                      { label: 'Bundles', value: item.stats.bund, colorClass: 'text-blue-400' }
                    ].map(tile => (
                      <button
                        key={tile.label}
                        type="button"
                        onClick={() => {
                          if (item.status === 'Présent' || item.status === 'Clôturé') {
                            const agentForLocation: AgentMasterStatus = {
                              id: item.id,
                              name: item.name,
                              phone: '0810000000',
                              shop: item.shop,
                              shopId: '',
                              status: item.status,
                              trend: [0, 0, 0],
                              reportObj: item.reportObj,
                              stats: item.stats
                            };
                            if (onOpenLocationModal) onOpenLocationModal(agentForLocation);
                          }
                        }}
                        className={`bg-white/5 p-2 rounded-xl ${(item.status === 'Présent' || item.status === 'Clôturé') ? 'cursor-pointer hover:bg-white/10' : 'cursor-default'}`}
                      >
                        <span className="text-[8px] text-gray-400 uppercase block">{tile.label}</span>
                        <span className={`${tile.colorClass} text-xs`}>{tile.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- TAB 3: ARCHIVES ---
  if (activeTab === 'tab3') {
    const allReports = getReports();
    const teamAgentIds = supervisedAgents.map(a => a.id);
    const teamReports = allReports.filter(r => teamAgentIds.includes(r.agent_id));

    const filteredReports = teamReports.filter(r =>
      r.agent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.date.includes(searchQuery)
    );

    return (
      <div className="space-y-4 animate-pop pb-28">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Archives <span className="text-amber-400">Rapports</span>
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">
            Historique de tous les rapports présentés par vos hôtesses ({teamReports.length})
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Filtrer par nom, date ou shop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-2xl pl-9 pr-3 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Reports List */}
        <div className="space-y-3">
          {filteredReports.length === 0 ? (
            <div className="glass-card p-8 text-center text-gray-400">
              <Archive className="w-10 h-10 mx-auto text-gray-600 mb-2" />
              <p className="text-xs font-bold">Aucun rapport d'équipe archivé.</p>
            </div>
          ) : (
            filteredReports.map(rep => (
              <div key={rep.id} className="glass-card p-4 border border-white/10 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black uppercase text-red-500 block">Agent : {rep.agent_name}</span>
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

                {/* Stats Breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="bg-white/5 p-2 rounded-xl">
                    <span className="text-[8px] text-gray-400 uppercase block">Privilège</span>
                    <span className="text-red-500 text-xs">{rep.priv}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl">
                    <span className="text-[8px] text-gray-400 uppercase block">Roaming</span>
                    <span className="text-amber-400 text-xs">{rep.roam}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl">
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

  // --- TAB ADMIN: SHOPS & AFFECTATIONS (SUPERVISOR MODE) ---
  if (activeTab === 'admin') {
    return (
      <div className="space-y-4 animate-pop pb-28">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Shops & <span className="text-red-500">Affectations</span>
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">
            Gestion des affectations des hôtesses aux points de vente Vodacom
          </p>
        </div>

        <div className="glass-card border border-white/10 p-5 space-y-4">
          <button
            type="button"
            onClick={() => setIsTargetsCardOpen((prev) => !prev)}
            className="w-full flex items-center justify-between"
          >
            <div className="space-y-1 text-left">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-400">Définir les targets</h2>
              <p className="text-[10px] text-gray-400 font-semibold">Les cibles de privilège, roaming et bundle sont centralisées ici pour les superviseurs.</p>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-300 transition-transform ${isTargetsCardOpen ? 'rotate-180' : ''}`} />
          </button>

          {isTargetsCardOpen && (
            <>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Standard</p>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] font-black uppercase text-gray-400">Privilège
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={targetPrivilegeStd}
                        onChange={(e) => setTargetPrivilegeStd(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                      />
                    </label>
                    <label className="text-[9px] font-black uppercase text-gray-400">Roaming
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={targetRoamingStd}
                        onChange={(e) => setTargetRoamingStd(Math.max(0, Math.min(50, Number(e.target.value || 0))))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                      />
                    </label>
                    <label className="text-[9px] font-black uppercase text-gray-400">Bundle
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={targetBundleStd}
                        onChange={(e) => setTargetBundleStd(Math.max(0, Math.min(50, Number(e.target.value || 0))))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Aéroport</p>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] font-black uppercase text-gray-400">Privilège
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={targetPrivilegeAir}
                        onChange={(e) => setTargetPrivilegeAir(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                      />
                    </label>
                    <label className="text-[9px] font-black uppercase text-gray-400">Roaming
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={targetRoamingAir}
                        onChange={(e) => setTargetRoamingAir(Math.max(0, Math.min(50, Number(e.target.value || 0))))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                      />
                    </label>
                    <label className="text-[9px] font-black uppercase text-gray-400">Bundle
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={targetBundleAir}
                        onChange={(e) => setTargetBundleAir(Math.max(0, Math.min(50, Number(e.target.value || 0))))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <button onClick={handleSaveTarget} className="w-full rounded-xl bg-red-600 px-3 py-2.5 text-[10px] font-black uppercase text-white">
                Enregistrer les targets
              </button>
            </>
          )}
        </div>

        {/* Shops List */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase text-gray-400 tracking-wider">
            Shops Disponibles ({shops.length})
          </h2>

          {shops.map(shop => {
            const assignedAgents = supervisedAgents.filter(a => a.permanentShopId === shop.id);
            return (
              <div
                key={shop.id}
                className={`glass-card p-4 border space-y-3 transition-all ${
                  dragOverShopId === shop.id
                    ? 'border-amber-300 bg-amber-400/20 ring-2 ring-amber-300/60 shadow-[0_0_0_1px_rgba(252,211,77,0.45)]'
                    : draggedHostess
                      ? 'border-amber-400/40'
                      : 'border-white/10'
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverShopId(shop.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverShopId(shop.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  let payload: { agentId: string; fromShopId: string } | null = null;
                  try {
                      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                    if (raw) payload = JSON.parse(raw) as { agentId: string; fromShopId: string };
                  } catch {}
                  handleDropHostessOnShop(shop.id, payload);
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-black uppercase text-white flex items-center space-x-2">
                      <Store className="w-4 h-4 text-amber-400" />
                      <span>{shop.name}</span>
                    </h3>
                    <p className="text-[10px] text-gray-400 font-semibold">{shop.city} • Type: {shop.type}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-xl text-[9px] font-black uppercase border border-amber-500/40">
                    <UserCheck className="w-3 h-3" />
                    <span>{assignedAgents.length}</span>
                  </span>
                </div>

                {/* Assigned Agents badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assignedAgents.length === 0 ? (
                    <span className="text-[10px] text-gray-500 italic">Aucune hôtesse affectée à ce shop</span>
                  ) : (
                    assignedAgents.map(ag => (
                      <span
                        key={ag.id}
                        draggable
                        onDragStart={(e) => {
                          const payload = { agentId: ag.id, fromShopId: shop.id };
                          const payloadString = JSON.stringify(payload);
                          setDraggedHostess(payload);
                          setDragOverShopId(null);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('application/json', payloadString);
                          e.dataTransfer.setData('text/plain', payloadString);
                        }}
                        onDragEnd={() => {
                          setDraggedHostess(null);
                          setDragOverShopId(null);
                        }}
                        className="cursor-grab active:cursor-grabbing text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 text-gray-300 rounded-lg border border-white/10 flex items-center space-x-1"
                        title="Glisser-déposer vers un autre shop"
                      >
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>{ag.name}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reassignment Panel */}
        <div className="glass-card p-5 border border-white/10 space-y-4">
          <h2 className="text-xs font-black uppercase text-white tracking-wider flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-red-500" />
            <span>Affecter une Hôtesse à un Shop</span>
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Sélectionner l'hôte/hôtesse</label>
              <select
                value={assigningUserId || ''}
                onChange={(e) => setAssigningUserId(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
              >
                <option value="">-- Choisir une hôtesse --</option>
                {supervisedAgents.map(ag => {
                  const currentShop = shops.find(s => s.id === ag.permanentShopId);
                  return (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} (Shop actuel: {currentShop?.name || 'Non affecté'})
                    </option>
                  );
                })}
              </select>
            </div>

            {assigningUserId && (
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Sélectionner le nouveau Shop</label>
                <select
                  value={assigningShopId}
                  onChange={(e) => setAssigningShopId(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Choisir un shop Vodacom --</option>
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                  ))}
                </select>

                <button
                  disabled={!assigningShopId}
                  onClick={() => handleAssignShopSubmit(assigningUserId, assigningShopId)}
                  className="w-full mt-3 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase shadow-lg transition-all"
                >
                  Valider l'affectation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- TAB 1: HOME DASHBOARD ---
  return (
    <div className="space-y-6 animate-pop pb-28">
      {/* Supervisor Top Banner */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Supervision <span className="text-red-500">Live</span>
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            Suivi des activités d'équipe en temps réel
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div ref={homeCalendarRef} className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-2 py-1.5">
              <button
                type="button"
                onClick={() => {
                  setHomeCalendarMonth(new Date(selectedHomeDate.getFullYear(), selectedHomeDate.getMonth(), 1));
                  setShowHomeCalendar((prev) => !prev);
                }}
                className="h-12 w-12 rounded-2xl border border-white/15 bg-black/60 text-white flex items-center justify-center shadow-lg hover:bg-white/10 transition-all"
                title="Choisir la date"
              >
                <CalendarDays className="w-6 h-6 text-amber-300" />
              </button>
              <span className="text-[10px] sm:text-xs font-black uppercase text-amber-200 tracking-wide">
                {selectedDateLabel}
              </span>
            </div>

            {showHomeCalendar && (
              <div className="absolute right-0 top-16 z-40 w-80 rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setHomeCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                    title="Mois précédent"
                  >
                    <ChevronLeft className="w-4 h-4 mx-auto" />
                  </button>
                  <div className="text-xs font-black uppercase text-white tracking-wide">{monthLabel}</div>
                  <button
                    type="button"
                    onClick={() => setHomeCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                    title="Mois suivant"
                  >
                    <ChevronRight className="w-4 h-4 mx-auto" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((label) => (
                    <div key={label} className="text-center text-[10px] font-black uppercase text-gray-500 py-1">{label}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {dayCells.map((cell, index) => {
                    if (!cell) {
                      return <div key={`empty-${index}`} className="h-9" />;
                    }
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => {
                          setSelectedDate(cell.iso);
                          setShowHomeCalendar(false);
                        }}
                        className={`h-9 rounded-lg text-[11px] font-black transition-all ${cell.isSelected
                          ? 'bg-red-600 text-white'
                          : cell.isToday
                            ? 'border border-amber-400/60 bg-amber-400/10 text-amber-300'
                            : 'bg-white/5 text-gray-200 hover:bg-white/10'}`}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateSupervisorReport}
            disabled={loading}
            className="h-12 w-12 bg-red-600 hover:bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/30 transition-all disabled:opacity-60"
            title={loading ? 'Génération en cours' : 'Générer la synthèse PDF'}
          >
            <FileCheck className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Team KPI Bar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4 text-center border border-white/10">
          <span className="text-[9px] font-black uppercase text-gray-400 block mb-1">Hôtesses Actives</span>
          <span className="text-2xl font-black text-red-500">{activeCount} / {teamData.length}</span>
        </div>
        <div className="glass-card p-4 text-center border border-white/10">
          <span className="text-[9px] font-black uppercase text-gray-400 block mb-1">Clôtures Reçues</span>
          <span className="text-2xl font-black text-emerald-400">{closedCount}</span>
        </div>
      </div>

      {/* Podium Team */}
      <div className="glass-card border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center space-x-1.5">
            <Trophy className="w-4 h-4" />
            <span>🏆 Podium Performance Équipe</span>
          </h2>
        </div>

        <div className="space-y-2">
          {sortedPodium.length === 0 ? (
            <div className="text-[10px] text-gray-400 italic">Aucune activité réelle aujourd'hui pour le podium.</div>
          ) : (
            <>
              {sortedPodium.slice(0, 3).map((item, idx) => {
                const total = item.stats.priv + item.stats.roam + item.stats.bund;
                const colors = [
                  'border-amber-400/60 bg-amber-500/10 text-amber-400',
                  'border-slate-300/40 bg-slate-400/10 text-slate-300',
                  'border-amber-700/40 bg-amber-800/10 text-amber-600'
                ];
                const trophyName = idx === 0 ? 'Gold' : (idx === 1 ? 'Silver' : 'Bronze');
                return (
                  <div
                    key={item.id}
                    className={`podium-card p-3 rounded-2xl border flex items-center justify-between ${colors[idx] || 'border-white/10 bg-white/5'}`}
                    style={{ ['--podium-watermark' as string]: `url('/trophees/Trophee_${trophyName}.png')` }}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-black w-6 text-center">#{idx + 1}</span>
                      <div>
                        <p className="text-xs font-black uppercase text-white">{item.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{item.shop}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-white">{total}</span>
                      <span className="text-[8px] text-gray-400 font-bold uppercase block">Leads</span>
                    </div>
                  </div>
                );
              })}
              {sortedPodium.length > 3 && (
                <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-white">4e+ position</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">Autres agents actifs</p>
                    </div>
                    <span className="text-sm font-black text-white">{sortedPodium.length - 3}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Live Monitoring Summary Cards */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xs font-black uppercase text-gray-400 tracking-wider">
            Monitoring en direct ({teamData.length} Hôtesses)
          </h2>
          <span className="text-[10px] font-black uppercase text-amber-200">
            {selectedDateLabel}
          </span>
        </div>

        {teamData.map(item => {
          const statusBg = item.status === 'Clôturé' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            : (item.status === 'Présent' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40');
          const totalLeads = item.stats.priv + item.stats.roam + item.stats.bund;

          return (
            <div key={item.id} className="glass-card p-4 border border-white/10 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-black uppercase text-white">{item.name}</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{item.shop}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border ${statusBg}`}>
                    {item.status}
                  </span>

                  {item.reportObj && (
                    <button
                      onClick={() => onOpenPdfModal(`report-id:${item.reportObj!.id}`)}
                      className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-xl border border-red-500/30 transition-all"
                      title="Voir le rapport PDF"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}

                  {onOpenAgentProfile && (
                    <button
                      onClick={() => onOpenAgentProfile({
                        id: item.id,
                        name: item.name,
                        phone: '0810000000',
                        shop: item.shop,
                        shopId: '',
                        status: item.status,
                        trend: [4, 7, 5, 12, 18, 14, totalLeads]
                      })}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/10 transition-all"
                      title="Voir l'historique des rapports"
                    >
                      <NotebookText className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                <div className="bg-white/5 p-2 rounded-xl">
                  <span className="text-[8px] text-gray-400 uppercase block">Privilège</span>
                  <span className="text-white text-xs">{item.stats.priv}</span>
                </div>
                <div className="bg-white/5 p-2 rounded-xl">
                  <span className="text-[8px] text-gray-400 uppercase block">Roaming</span>
                  <span className="text-amber-400 text-xs">{item.stats.roam}</span>
                </div>
                <div className="bg-white/5 p-2 rounded-xl">
                  <span className="text-[8px] text-gray-400 uppercase block">Bundles</span>
                  <span className="text-blue-400 text-xs">{item.stats.bund}</span>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <select
                  value={inlineAssignShop[item.id] || ''}
                  onChange={(e) => setInlineAssignShop(prev => ({ ...prev, [item.id]: e.target.value }))}
                  className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white text-[10px] font-bold"
                >
                  <option value="">Affecter à un shop...</option>
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const shopId = inlineAssignShop[item.id];
                    if (!shopId) return;
                    updateUserShopAssignment(item.id, shopId);
                    if (onRefreshData) onRefreshData();
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase"
                >
                  Affecter
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
