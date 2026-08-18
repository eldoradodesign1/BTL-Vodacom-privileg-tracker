import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shop, AgentMasterStatus, User } from '../types';
import { getAdminMasterList, getCheckins, getDashboardData, getLeads, getReports, getUsers, toISO, updateUserShopAssignment, updateUserSupervisor, resolveStoredPhotoUrl, saveTargetDefinition } from '../utils/storage';
import { TabType } from './BottomNav';
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { UserPlus, Store, FileSpreadsheet, Eye, User as UserIcon, UserCheck, FileText, Search, Filter, MapPin, Clock3, Pencil, X, Check, Circle, CalendarDays, ChevronLeft, ChevronRight, FileX2 } from 'lucide-react';
import { formatAgentLocationLine } from '../utils/location';
import { SupervisorProfileModal, SupervisorHostessSummary } from './Modals/SupervisorProfileModal';
import { DateIconPicker } from './DateIconPicker';
import { DateRangeKnobSlider } from './DateRangeKnobSlider';

interface AdminViewProps {
  currentUser: User;
  shops: Shop[];
  activeTab?: TabType;
  homeTabPressCount?: number;
  onRequestTabChange?: (tab: TabType) => void;
  onSimulateRole: (role: any) => void;
  onOpenUserModal: () => void;
  onOpenShopModal: () => void;
  onOpenAgentProfile: (agent: AgentMasterStatus) => void;
  onOpenPdfModal: (url: string) => void;
  onOpenTodayClientsModal?: (agent: AgentMasterStatus) => void;
  onOpenLocationModal?: (agent: AgentMasterStatus) => void;
  onRefreshData?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  shops,
  activeTab = 'admin',
  homeTabPressCount = 0,
  onRequestTabChange,
  onSimulateRole,
  onOpenUserModal,
  onOpenShopModal,
  onOpenAgentProfile,
  onOpenPdfModal,
  onOpenTodayClientsModal,
  onOpenLocationModal,
  onRefreshData
}) => {
  const [subTab, setSubTab] = useState<'manage' | 'monitoring' | 'stats' | 'leads' | 'reports'>(
    activeTab === 'home' ? 'stats' : (activeTab === 'tab3' ? 'reports' : (activeTab === 'admin' ? 'manage' : 'monitoring'))
  );
  const [manageSection, setManageSection] = useState<'hostess' | 'supervisors' | 'shops' | 'targets'>('hostess');
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const allLeads = getLeads();
  const todayIso = toISO(new Date());
  const allLeadDates = [...new Set(allLeads.map(l => toISO(l.timestamp)))].sort();
  const firstLeadDate = allLeadDates[0] || todayIso;
  const dayMs = 86400000;
  const minTs = new Date(`${firstLeadDate}T00:00:00`).getTime();
  const maxTs = new Date(`${todayIso}T00:00:00`).getTime();
  const maxOffset = Math.max(0, Math.floor((maxTs - minTs) / dayMs));
  const offsetToDate = (offset: number) => toISO(new Date(minTs + (Math.max(0, Math.min(maxOffset, offset)) * dayMs)));
  const [leadStartOffset, setLeadStartOffset] = useState(0);
  const [leadEndOffset, setLeadEndOffset] = useState(maxOffset);
  const [monitoringDate, setMonitoringDate] = useState(todayIso);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Online' | 'Absent' | 'Clôturé'>('ALL');
  const [supFilter, setSupFilter] = useState('ALL');
  const [reportsFilterTerm, setReportsFilterTerm] = useState('');
  const [inlineAssignShop, setInlineAssignShop] = useState<Record<string, string>>({});
  const [draggedHostess, setDraggedHostess] = useState<{ agentId: string; fromShopId: string } | null>(null);
  const [dragOverShopId, setDragOverShopId] = useState<string | null>(null);
  const [shopAssignmentModal, setShopAssignmentModal] = useState<{ agentId: string; agentName: string; currentShopId: string; selectedShopId: string } | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [presenceCalendarAgentId, setPresenceCalendarAgentId] = useState<string | null>(null);
  const [presenceCalendarPosition, setPresenceCalendarPosition] = useState<{ top: number; left: number } | null>(null);
  const [presenceCalendarMonth, setPresenceCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const getStatusPalette = (status: string) => {
    if (status === 'Clôturé') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (status === 'Présent') return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    return 'bg-red-500/20 text-red-400 border-red-500/40';
  };
  const getStatusIcon = (status: string) => {
    if (status === 'Clôturé') return <Check className="w-4 h-4" />;
    if (status === 'Présent') return <Circle className="w-3.5 h-3.5 fill-current" />;
    return <X className="w-4 h-4" />;
  };
  const getStatusActionTitle = (status: string) => {
    if (status === 'Présent') return 'Voir la localisation de pointage';
    if (status === 'Clôturé') return 'Voir la localisation de clôture';
    return 'Absent';
  };
  const formatIsoDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const getAgentStatusForDate = (agent: AgentMasterStatus, isoDate: string): 'Absent' | 'Présent' | 'Clôturé' => {
    const hasReport = allReports.some((report) => (
      (report.agent_id === agent.id || report.agent_id === agent.name) && toISO(report.date) === isoDate
    ));
    if (hasReport) return 'Clôturé';

    const hasCheckin = allCheckins.some((checkin) => (
      (checkin.agent_id === agent.id || checkin.agent_id === agent.name) && toISO(checkin.timestamp) === isoDate && checkin.type === 'IN'
    ));
    return hasCheckin ? 'Présent' : 'Absent';
  };
  const getStatusCalendarCellClass = (status: 'Absent' | 'Présent' | 'Clôturé') => {
    if (status === 'Clôturé') return 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40';
    if (status === 'Présent') return 'bg-blue-500/25 text-blue-300 border-blue-500/40';
    return 'bg-red-500/20 text-red-300 border-red-500/35';
  };
  const activityStartIso = '2026-07-23';
  const isInsideActivityPeriod = (isoDate: string) => isoDate >= activityStartIso && isoDate <= todayIso;
  const [targetPrivilegeStd, setTargetPrivilegeStd] = useState(20);
  const [targetPrivilegeAir, setTargetPrivilegeAir] = useState(20);
  const [targetRoamingStd, setTargetRoamingStd] = useState(3);
  const [targetRoamingAir, setTargetRoamingAir] = useState(15);
  const [targetBundleStd, setTargetBundleStd] = useState(10);
  const [targetBundleAir, setTargetBundleAir] = useState(10);

  // User Assignment State
  const [assignUser, setAssignUser] = useState('');
  const [assignShop, setAssignShop] = useState('');
  const [assignSupervisor, setAssignSupervisor] = useState('');

  const masterList = getAdminMasterList();
  const monitoringMasterList = getAdminMasterList(monitoringDate);
  const allCheckins = getCheckins();
  const dashboardData = getDashboardData({ start: startDate, end: endDate, agentId: selectedAgentId });
  const allReports = getReports();
  const allUsers = getUsers();
  const supervisors = allUsers.filter(u => u.role === 'supervisor');
  const agents = allUsers.filter(u => u.role === 'agent' && u.userCategory !== 'brand_ambassador');
  const hostessIds = new Set(agents.map((agent) => agent.id));
  const hostessList = masterList
    .filter((agent) => hostessIds.has(agent.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const supervisorsById = supervisors.reduce<Record<string, string>>((acc, sup) => {
    acc[sup.id] = sup.name;
    return acc;
  }, {});
  const reportDateList = [...new Set(allReports.map((r) => toISO(r.date)))].sort();
  const consolidationMinDate = reportDateList[0] || todayIso;
  const consolidationMaxDate = reportDateList[reportDateList.length - 1] || todayIso;
  const consolidationStartDate = startDate < consolidationMinDate
    ? consolidationMinDate
    : (startDate > consolidationMaxDate ? consolidationMaxDate : startDate);
  const consolidationEndDate = endDate < consolidationMinDate
    ? consolidationMinDate
    : (endDate > consolidationMaxDate ? consolidationMaxDate : endDate);
  const filteredReportsForPeriod = allReports
    .filter((report) => report.date >= consolidationStartDate && report.date <= consolidationEndDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  const filteredReportsDisplay = filteredReportsForPeriod.filter((report) => {
    const q = reportsFilterTerm.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${report.agent_name} ${report.shop_name || ''} ${report.date}`.toLowerCase();
    return haystack.includes(q);
  });
  const usersById = allUsers.reduce<Record<string, User>>((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});
  const agentTotalsById = allReports.reduce<Record<string, { priv: number; roam: number; bund: number }>>((acc, report) => {
    if (!acc[report.agent_id]) {
      acc[report.agent_id] = { priv: 0, roam: 0, bund: 0 };
    }
    acc[report.agent_id].priv += report.priv || 0;
    acc[report.agent_id].roam += report.roam || 0;
    acc[report.agent_id].bund += report.bund || 0;
    return acc;
  }, {});
  const sortedSupervisors = [...supervisors].sort((a, b) => a.name.localeCompare(b.name));
  const supervisorSummaries = sortedSupervisors.map((supervisor) => {
    const assignedAgents = hostessList.filter((agent) => usersById[agent.id]?.supervisorId === supervisor.id);
    const assignedAgentIds = new Set(assignedAgents.map((agent) => agent.id));
    const lastReport = allReports.find((report) => assignedAgentIds.has(report.agent_id));
    return {
      supervisor,
      assignedAgents,
      lastReportDate: lastReport?.date || ''
    };
  });
  const selectedSupervisor = selectedSupervisorId
    ? supervisors.find((sup) => sup.id === selectedSupervisorId) || null
    : null;
  const selectedSupervisorHostesses: SupervisorHostessSummary[] = selectedSupervisor
    ? hostessList
      .filter((agent) => usersById[agent.id]?.supervisorId === selectedSupervisor.id)
      .map((agent) => {
        const totals = agentTotalsById[agent.id] || { priv: 0, roam: 0, bund: 0 };
        return {
          id: agent.id,
          name: agent.name,
          shop: agent.shop,
          totalPriv: totals.priv,
          totalRoam: totals.roam,
          totalBund: totals.bund
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const filteredMasterList = monitoringMasterList.filter(agent => {
    if (!hostessIds.has(agent.id)) return false;
    const srcUser = allUsers.find(u => u.id === agent.id);
    const supId = srcUser?.supervisorId || '';
    const matchesSearch = !searchTerm
      || agent.name.toLowerCase().includes(searchTerm.toLowerCase())
      || agent.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL'
      || (statusFilter === 'Online' && agent.status === 'Présent')
      || (statusFilter === 'Absent' && agent.status === 'Absent')
      || (statusFilter === 'Clôturé' && agent.status === 'Clôturé');
    const matchesSup = supFilter === 'ALL' || supId === supFilter;
    return matchesSearch && matchesStatus && matchesSup;
  });
  const rangeStart = Math.min(leadStartOffset, leadEndOffset);
  const rangeEnd = Math.max(leadStartOffset, leadEndOffset);
  const leadRangeStartDate = offsetToDate(rangeStart);
  const leadRangeEndDate = offsetToDate(rangeEnd);
  const filteredLeads = allLeads.filter(ld => {
    const d = toISO(ld.timestamp);
    return d >= leadRangeStartDate && d <= leadRangeEndDate;
  });
  // Sync internal subTab when activeTab changes
  React.useEffect(() => {
    if (activeTab === 'home') setSubTab('stats');
    else if (activeTab === 'tab3') setSubTab('reports');
    else if (activeTab === 'admin') setSubTab('manage');
    else if (activeTab === 'tab2') setSubTab('monitoring');
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab === 'home') {
      setSubTab('stats');
    }
  }, [homeTabPressCount, activeTab]);

  React.useEffect(() => {
    if (subTab !== 'manage') {
      setSelectedSupervisorId(null);
    }
  }, [subTab]);

  useEffect(() => {
    if (!presenceCalendarAgentId) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPresenceCalendarAgentId(null);
        setPresenceCalendarPosition(null);
      }
    };

    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [presenceCalendarAgentId]);

  const handleGenerateBatchPDF = async () => {
    setLoading(true);
    const selectedReports = filteredReportsForPeriod;

    const periodLeads = allLeads.filter(l => {
      const date = toISO(l.timestamp).slice(0, 10);
      return date >= startDate && date <= endDate;
    });

    const rows = selectedReports.map(r => ({
      date: r.date,
      agent: r.agent_name,
      priv: r.priv,
      roam: r.roam,
      bund: r.bund
    }));

    const totals = periodLeads.reduce(
      (acc, lead) => {
        if (lead.action_type === 'Privilège') {
          acc.privilege += 1;
        } else if (lead.action_type === 'Roaming') {
          acc.roaming += 1;
        } else if (lead.action_type === 'Bundle') {
          acc.bundles += 1;
        }

        return acc;
      },
      { privilege: 0, roaming: 0, bundles: 0 }
    );

    const reports = selectedReports.map(report => ({
      agentName: report.agent_name,
      shopName: report.shop_name || 'Vodacom Shop',
      date: report.date,
      arrivalTime: report.arrival_time || '08:00',
      departureTime: report.departure_time || '17:30',
      mapsIn: report.maps_in || '',
      mapsOut: report.maps_out || '',
      totalPrivilege: report.priv,
      totalRoaming: report.roam,
      totalBundles: report.bund,
      targets: { privilege: 20, roaming: 20, bundle: 20 },
      leads: allLeads.filter(l => l.agent_id === report.agent_id && toISO(l.timestamp) === report.date).map(l => ({
        timestamp: l.timestamp,
        client_name: l.client_name,
        msisdn: l.msisdn,
        action_type: l.action_type
      })),
      pointagePhoto: resolveStoredPhotoUrl(report.pointage_photo || '') || '',
      photos: report.photos || [],
      comment: report.comment || '',
      evolutionData: [report.priv, report.priv + report.roam, report.priv + report.roam + report.bund]
    }));

    const groups = [
      {
        supervisor: 'Administration',
        agentCount: new Set(selectedReports.map(r => r.agent_id)).size,
        totalLeads: periodLeads.length,
        totalPrivilege: totals.privilege,
        totalRoaming: totals.roaming,
        totalBundles: totals.bundles
      }
    ];

    const payload = {
      period: `${startDate} au ${endDate}`,
      title: `Compilation ${startDate} → ${endDate}`,
      rows,
      totals,
      reports,
      groups
    };

    setLoading(false);
    onOpenPdfModal(`preview-admin-batch:${encodeURIComponent(JSON.stringify(payload))}`);
  };

  const handleSaveAssignments = () => {
    if (!assignUser) return;
    // Apply supervisor first so any subsequent shop notification is sent to the current supervisor.
    if (assignSupervisor) updateUserSupervisor(assignUser, assignSupervisor);
    if (assignShop) updateUserShopAssignment(assignUser, assignShop);
    setAssignUser('');
    setAssignShop('');
    setAssignSupervisor('');
    if (onRefreshData) onRefreshData();
  };

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

  const handleDropHostessOnShop = (targetShopId: string, payload?: { agentId: string; fromShopId: string } | null) => {
    const source = payload || draggedHostess;
    if (!source) return;

    const { agentId, fromShopId } = source;
    setDraggedHostess(null);
    setDragOverShopId(null);

    if (fromShopId === targetShopId) return;

    const agent = agents.find((u) => u.id === agentId);
    const fromShop = shops.find((s) => s.id === fromShopId);
    const toShop = shops.find((s) => s.id === targetShopId);
    if (!agent || !toShop) return;

    const confirmed = window.confirm(
      `Confirmer l'affectation de ${agent.name} de ${fromShop?.name || 'shop actuel'} vers ${toShop.name} ?`
    );
    if (!confirmed) return;

    updateUserShopAssignment(agentId, targetShopId);
    // Trigger immediate repaint for source/target cards.
    setInlineAssignShop((prev) => ({ ...prev }));
    if (onRefreshData) onRefreshData();
  };

  const handleCompileSupervisor = (supervisor: User) => {
    const assignedAgentIds = new Set(
      hostessList
        .filter((agent) => usersById[agent.id]?.supervisorId === supervisor.id)
        .map((agent) => agent.id)
    );

    const selectedReports = allReports
      .filter((report) => assignedAgentIds.has(report.agent_id))
      .sort((a, b) => a.date.localeCompare(b.date));

    const rows = selectedReports.map((report) => ({
      date: report.date,
      agent: report.agent_name,
      priv: report.priv,
      roam: report.roam,
      bund: report.bund
    }));

    const totals = rows.reduce(
      (acc, row) => ({
        privilege: acc.privilege + row.priv,
        roaming: acc.roaming + row.roam,
        bundles: acc.bundles + row.bund
      }),
      { privilege: 0, roaming: 0, bundles: 0 }
    );

    const reports = selectedReports.map((report) => ({
      agentName: report.agent_name,
      shopName: report.shop_name || 'Vodacom Shop',
      date: report.date,
      arrivalTime: report.arrival_time || '08:00',
      departureTime: report.departure_time || '17:30',
      mapsIn: report.maps_in || '',
      mapsOut: report.maps_out || '',
      totalPrivilege: report.priv,
      totalRoaming: report.roam,
      totalBundles: report.bund,
      targets: { privilege: 20, roaming: 20, bundle: 20 },
      leads: allLeads
        .filter((lead) => lead.agent_id === report.agent_id && toISO(lead.timestamp) === report.date)
        .map((lead) => ({
          timestamp: lead.timestamp,
          client_name: lead.client_name,
          msisdn: lead.msisdn,
          action_type: lead.action_type
        })),
      pointagePhoto: resolveStoredPhotoUrl(report.pointage_photo || '') || '',
      photos: report.photos || [],
      comment: report.comment || '',
      evolutionData: [report.priv, report.priv + report.roam, report.priv + report.roam + report.bund]
    }));

    const payload = {
      period: `${selectedReports[0]?.date || '-'} au ${selectedReports[selectedReports.length - 1]?.date || '-'}`,
      title: `Compilation Superviseur ${supervisor.name}`,
      rows,
      totals,
      reports,
      groups: [
        {
          supervisor: supervisor.name,
          agentCount: assignedAgentIds.size,
          totalLeads: totals.privilege + totals.roaming + totals.bundles,
          totalPrivilege: totals.privilege,
          totalRoaming: totals.roaming,
          totalBundles: totals.bundles
        }
      ]
    };

    onOpenPdfModal(`preview-admin-batch:${encodeURIComponent(JSON.stringify(payload))}`);
  };

  const openShopAssignmentModal = (agent: AgentMasterStatus) => {
    setShopAssignmentModal({
      agentId: agent.id,
      agentName: agent.name,
      currentShopId: agent.shopId || '',
      selectedShopId: agent.shopId || ''
    });
  };

  const saveShopAssignment = () => {
    if (!shopAssignmentModal) return;
    updateUserShopAssignment(shopAssignmentModal.agentId, shopAssignmentModal.selectedShopId);
    setShopAssignmentModal(null);
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="space-y-6 animate-pop pb-32">
      {subTab === 'manage' && (
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setManageSection('hostess')}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              manageSection === 'hostess' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <UserPlus className="w-3.5 h-3.5" />
              <span>HOT.</span>
            </span>
          </button>
          <button
            onClick={() => setManageSection('supervisors')}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              manageSection === 'supervisors' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span>SUP.</span>
            </span>
          </button>
          <button
            onClick={() => setManageSection('shops')}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              manageSection === 'shops' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <Store className="w-3.5 h-3.5" />
              <span>Shops</span>
            </span>
          </button>
          <button
            onClick={() => setManageSection('targets')}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              manageSection === 'targets' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Target</span>
            </span>
          </button>
        </div>
      )}

      {/* --- SUB-TAB 1: GESTION --- */}
      {subTab === 'manage' && (
        <div className="space-y-4 animate-pop">
          {manageSection === 'hostess' && (
            <div className="glass-card p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-amber-400">Hôtesses ({hostessList.length})</h2>
              </div>

              <div className="space-y-2">
                {hostessList.map(agent => {
                  const srcUser = allUsers.find(u => u.id === agent.id);
                  const supervisorName = srcUser?.supervisorId ? (supervisorsById[srcUser.supervisorId] || 'Non assigné') : 'Non assigné';
                  const statusBg = getStatusPalette(agent.status);

                  return (
                    <div key={agent.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black uppercase text-white">{agent.name}</p>
                        <p className="truncate text-[9px] font-bold uppercase text-gray-400">
                          {agent.shop} • SUP: {supervisorName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-1 rounded-xl text-[9px] font-black uppercase border ${statusBg}`}>
                          {agent.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenAgentProfile(agent)}
                          className={`p-1.5 rounded-xl border transition-all ${statusBg} hover:opacity-90`}
                          title={`Voir l'historique de ${agent.name}`}
                        >
                          <UserIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {manageSection === 'supervisors' && (
            <div className="glass-card p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-amber-400">Superviseurs ({supervisorSummaries.length})</h2>
              </div>

              <div className="space-y-2">
                {supervisorSummaries.map((item) => (
                  <div key={item.supervisor.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black uppercase text-white">{item.supervisor.name}</p>
                      <p className="truncate text-[9px] font-bold uppercase text-gray-400">
                        {item.assignedAgents.length} hôtesse(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-1 rounded-xl text-[9px] font-black uppercase border border-blue-500/40 bg-blue-500/20 text-blue-300">
                        {item.lastReportDate ? `Dernier ${item.lastReportDate}` : 'Aucun rapport'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedSupervisorId(item.supervisor.id)}
                        className="p-1.5 rounded-xl border border-white/15 bg-black/30 text-gray-200 hover:text-white hover:bg-white/10"
                        title={`Voir le détail de ${item.supervisor.name}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {manageSection === 'shops' && (
            <div className="space-y-4">
              <div className="glass-card p-4 border border-white/10 space-y-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4" />
                  <span>Affectations Shop & Superviseur</span>
                </h2>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Sélectionner une hôtesse</label>
                    <select
                      value={assignUser}
                      onChange={(e) => setAssignUser(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
                    >
                      <option value="">-- Choisir une hôtesse --</option>
                      {agents.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {assignUser && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Affecter au Shop</label>
                        <select
                          value={assignShop}
                          onChange={(e) => setAssignShop(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
                        >
                          <option value="">-- Conserver shop --</option>
                          {shops.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Affecter au Superviseur</label>
                        <select
                          value={assignSupervisor}
                          onChange={(e) => setAssignSupervisor(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
                        >
                          <option value="">-- Conserver sup --</option>
                          {supervisors.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {assignUser && (
                    <button
                      onClick={handleSaveAssignments}
                      className="w-full mt-2 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all"
                    >
                      Enregistrer l'affectation
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                  Shops Disponibles ({shops.length})
                </h2>

                {shops.map(shop => {
                  const assignedAgents = agents.filter(a => a.permanentShopId === shop.id);
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
            </div>
          )}

          {manageSection === 'targets' && (
            <div className="glass-card border border-white/10 p-5 space-y-4">
              <div className="space-y-1 text-left">
                <h2 className="text-xs font-black uppercase tracking-wider text-amber-400">Définir les targets</h2>
                <p className="text-[10px] text-gray-400 font-semibold">Les cibles de privilège, roaming et bundle sont centralisées ici pour les superviseurs.</p>
              </div>

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
            </div>
          )}

          <SupervisorProfileModal
            isOpen={!!selectedSupervisor}
            supervisor={selectedSupervisor}
            hostesses={selectedSupervisorHostesses}
            onClose={() => setSelectedSupervisorId(null)}
            onCompile={() => {
              if (selectedSupervisor) {
                handleCompileSupervisor(selectedSupervisor);
              }
            }}
            onOpenHostessDetails={(hostessId) => {
              const hostess = hostessList.find((agent) => agent.id === hostessId);
              if (hostess) {
                onOpenAgentProfile(hostess);
              }
            }}
          />
        </div>
      )}

      {/* --- SUB-TAB 1: MONITORING --- */}
      {subTab === 'monitoring' && (
        <div className="space-y-4 animate-pop pb-32">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Monitoring <span className="text-red-500">Équipe</span>
              </h1>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">
                Suivi détaillé et historique individuel des hôtesses ({filteredMasterList.length})
              </p>
            </div>
          </div>

          <div className="glass-card p-4 border border-white/10 space-y-3">
            <DateIconPicker
              value={monitoringDate}
              onChange={setMonitoringDate}
              className="inline-flex items-center"
              buttonClassName="h-11 w-11 rounded-2xl bg-black/60 border border-white/10 text-gray-200 hover:bg-white/10"
              labelClassName="text-xs sm:text-sm font-black uppercase text-gray-100"
              popoverAlign="left"
            />

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Rechercher une hôtesse ou un shop..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl pl-9 pr-3 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-red-500"
              />
            </div>
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

          <div className="space-y-3">
            {filteredMasterList.map(agent => {
              const statusBg = getStatusPalette(agent.status);
              const today = new Date();
              const presenceHistory = Array.from({ length: 7 }).map((_, idx) => {
                const day = new Date(today);
                day.setDate(today.getDate() - (6 - idx));
                const dayIso = toISO(day);
                const hasReport = allReports.some((report) => (
                  (report.agent_id === agent.id || report.agent_id === agent.name) && toISO(report.date) === dayIso
                ));
                const hasCheckin = allCheckins.some((checkin) => (
                  (checkin.agent_id === agent.id || checkin.agent_id === agent.name) && toISO(checkin.timestamp) === dayIso && checkin.type === 'IN'
                ));

                let dayStatus: 'Absent' | 'Présent' | 'Clôturé' = 'Absent';
                if (hasReport) dayStatus = 'Clôturé';
                else if (hasCheckin) dayStatus = 'Présent';

                return { dayIso, status: dayStatus };
              });
              const historyTitle = presenceHistory
                .map((entry) => `${entry.dayIso}: ${entry.status}`)
                .join(' | ');
              const isPresenceCalendarOpen = presenceCalendarAgentId === agent.id;
              const monthLabel = presenceCalendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
              const firstDayOfMonth = new Date(presenceCalendarMonth.getFullYear(), presenceCalendarMonth.getMonth(), 1);
              const daysInMonth = new Date(presenceCalendarMonth.getFullYear(), presenceCalendarMonth.getMonth() + 1, 0).getDate();
              const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
              const dayCells = Array.from({ length: 42 }, (_, index) => {
                const dayNumber = index - startOffset + 1;
                if (dayNumber < 1 || dayNumber > daysInMonth) return null;

                const dayDate = new Date(presenceCalendarMonth.getFullYear(), presenceCalendarMonth.getMonth(), dayNumber);
                const isoDate = formatIsoDate(dayDate);
                const dayStatus = getAgentStatusForDate(agent, isoDate);
                const inActivityPeriod = isInsideActivityPeriod(isoDate);
                const isToday = isoDate === formatIsoDate(new Date());
                return { dayNumber, isoDate, dayStatus, isToday, inActivityPeriod };
              });

              return (
                <div
                  key={agent.id}
                  className="glass-card p-4 border border-white/10 space-y-3 hover:border-red-500/30 transition-all cursor-pointer"
                  onClick={() => {
                    if (onOpenAgentProfile) {
                      onOpenAgentProfile(agent);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 w-full">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-black uppercase text-white">{agent.name}</h3>
                      </div>

                      <p className="text-[9px] font-bold text-gray-400 uppercase flex items-center flex-nowrap gap-1 mt-1 whitespace-nowrap overflow-hidden">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        <span className="truncate">{formatAgentLocationLine({ shop: agent.shop, status: agent.status, arrivalTime: agent.reportObj?.arrival_time, departureTime: agent.reportObj?.departure_time })}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openShopAssignmentModal(agent);
                          }}
                          className="ml-1 rounded-full border border-white/10 bg-white/5 p-1 text-gray-300 hover:text-white hover:bg-white/10"
                          title={`Modifier l'affectation du shop de ${agent.name}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 shrink-0">
                      {onOpenAgentProfile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAgentProfile(agent);
                          }}
                          className={`p-1.5 ${statusBg} rounded-xl border transition-all shrink-0 flex items-center justify-center`}
                          title="Détail hotesse"
                        >
                          <UserIcon className="w-4 h-4" />
                        </button>
                      )}

                      {agent.reportObj ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPdfModal(`report-id:${agent.reportObj?.id}`);
                          }}
                          className={`p-1.5 ${statusBg} rounded-xl border transition-all shrink-0 flex items-center justify-center`}
                          title="Voir le rapport PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      ) : (
                        <span
                          className={`p-1.5 ${statusBg} rounded-xl border transition-all shrink-0 flex items-center justify-center opacity-75`}
                          title="Pas de rapport"
                        >
                          <FileX2 className="w-4 h-4" />
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (agent.status === 'Présent' || agent.status === 'Clôturé') {
                            if (onOpenLocationModal) {
                              onOpenLocationModal(agent);
                            }
                          }
                        }}
                        className={`p-1.5 rounded-xl border ${statusBg} ${(agent.status === 'Présent' || agent.status === 'Clôturé') ? 'cursor-pointer hover:opacity-90' : 'cursor-default'} flex items-center justify-center`}
                        title={getStatusActionTitle(agent.status)}
                      >
                        {getStatusIcon(agent.status)}
                      </button>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPresenceCalendarOpen) {
                              setPresenceCalendarAgentId(null);
                              setPresenceCalendarPosition(null);
                              return;
                            }
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            const popupWidth = 320;
                            const popupHeight = 360;
                            const left = Math.max(8, Math.min(rect.right - popupWidth, window.innerWidth - popupWidth - 8));
                            const topBelow = rect.bottom + 8;
                            const top = topBelow + popupHeight > window.innerHeight - 8
                              ? Math.max(8, rect.top - popupHeight - 8)
                              : topBelow;
                            const now = new Date();
                            setPresenceCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                            setPresenceCalendarPosition({ top, left });
                            setPresenceCalendarAgentId(agent.id);
                          }}
                          className={`p-1.5 rounded-xl border transition-all flex items-center justify-center ${statusBg}`}
                          title={`Registre de présence (7 jours): ${historyTitle}`}
                        >
                          <CalendarDays className="w-4 h-4" />
                        </button>

                        {isPresenceCalendarOpen && presenceCalendarPosition && createPortal(
                          <div
                            className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-[2px]"
                            onClick={() => {
                              setPresenceCalendarAgentId(null);
                              setPresenceCalendarPosition(null);
                            }}
                          >
                            <div
                              className="presence-registry-modal-in absolute w-80 rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl"
                              style={{ top: `${presenceCalendarPosition.top}px`, left: `${presenceCalendarPosition.left}px` }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="mb-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPresenceCalendarAgentId(null);
                                    setPresenceCalendarPosition(null);
                                  }}
                                  className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10"
                                  title="Fermer"
                                >
                                  <X className="w-4 h-4 mx-auto" />
                                </button>
                              </div>
                              <div className="mb-3 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => setPresenceCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                  className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                                  title="Mois précédent"
                                >
                                  <ChevronLeft className="w-4 h-4 mx-auto" />
                                </button>
                                <div className="text-xs font-black uppercase text-white tracking-wide">{monthLabel}</div>
                                <button
                                  type="button"
                                  onClick={() => setPresenceCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
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
                                    <div
                                      key={cell.isoDate}
                                      className={`h-9 rounded-lg border text-[11px] font-black flex items-center justify-center ${cell.inActivityPeriod ? getStatusCalendarCellClass(cell.dayStatus) : 'bg-white/5 text-gray-500 border-white/10'} ${cell.isToday ? 'ring-1 ring-amber-300/70' : ''}`}
                                      title={cell.inActivityPeriod ? `${cell.isoDate}: ${cell.dayStatus}` : `${cell.isoDate}: hors période d'activité`}
                                    >
                                      {cell.dayNumber}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="mt-3 flex items-center justify-center gap-3 text-[9px] font-black uppercase text-gray-300">
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Absent</span>
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" />Présent</span>
                                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Clôturé</span>
                              </div>
                            </div>
                          </div>,
                          document.body
                        )}
                      </div>
                    </div>
                  </div>

                  {agent.status !== 'Absent' && (
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                      {[
                        { label: 'Privilège', value: agent.stats?.priv ?? 0, colorClass: 'text-red-500' },
                        { label: 'Roaming', value: agent.stats?.roam ?? 0, colorClass: 'text-amber-400' },
                        { label: 'Bundles', value: agent.stats?.bund ?? 0, colorClass: 'text-blue-400' }
                      ].map(tile => (
                        <button
                          key={tile.label}
                          type="button"
                          onClick={() => {
                            if (agent.status === 'Présent' || agent.status === 'Clôturé') {
                              if (onOpenLocationModal) {
                                onOpenLocationModal(agent);
                              }
                            }
                          }}
                          className={`bg-white/5 p-2 rounded-xl ${(agent.status === 'Présent' || agent.status === 'Clôturé') ? 'cursor-pointer hover:bg-white/10' : 'cursor-default'}`}
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
      )}

      {/* --- SUB-TAB 2: ANALYSES --- */}
      {subTab === 'stats' && (
        <div className="space-y-5 animate-pop">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setSubTab('leads')}
              className="relative overflow-hidden bg-white/[0.128] text-white p-5 rounded-[28px] text-center shadow-[0_18px_38px_rgba(0,0,0,0.38)] border border-white/25 backdrop-blur-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group"
              title="Cliquer pour voir tous les Leads / Rapport de Synthèse"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-rose-500/20 blur-2xl" />
              <div className="pointer-events-none absolute left-3 top-3 h-7 w-7 rounded-full border border-white/20" />
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-300 block group-hover:text-red-400">Total Activations</span>
              <p className="text-3xl font-black text-red-400 drop-shadow-[0_0_14px_rgba(0,0,0,0.4)]">{dashboardData.kpi.totalLeads}</p>
              <span className="text-[8px] font-bold text-gray-300 uppercase mt-1 block group-hover:underline">→ Voir la liste</span>
            </div>
            <div
              onClick={() => {
                setSubTab('manage');
                setManageSection('hostess');
                if (onRequestTabChange) onRequestTabChange('admin');
              }}
              className="relative overflow-hidden bg-white/[0.128] text-white p-5 rounded-[28px] text-center shadow-[0_18px_38px_rgba(0,0,0,0.38)] border border-white/25 backdrop-blur-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group"
              title="Cliquer pour aller au Monitoring des hôtesses"
            >
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-amber-400/18 blur-2xl" />
              <div className="pointer-events-none absolute right-3 top-3 h-7 w-7 rounded-full border border-white/20" />
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-300 block group-hover:text-white">Effectif Hôtesses</span>
              <p className="text-3xl font-black text-white drop-shadow-[0_0_12px_rgba(0,0,0,0.4)]">{agents.length}</p>
              <span className="text-[8px] font-bold text-gray-300 uppercase mt-1 block group-hover:underline">→ Aller au Monitoring</span>
            </div>
          </div>

          {/* Offres Distribution Pie Chart */}
          <div className="relative overflow-hidden glass-card p-5 border border-white/10 rounded-[26px] shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-rose-500/12 blur-3xl" />
            <div className="pointer-events-none absolute left-1/3 -bottom-16 h-36 w-36 rounded-full bg-amber-400/12 blur-3xl" />
            <div className="pointer-events-none absolute -left-14 top-10 h-28 w-28 rounded-full bg-sky-400/10 blur-3xl" />
            <h3 className="text-xs font-black uppercase text-red-400 tracking-[0.16em] mb-3 text-center">
              Répartition des Activations
            </h3>
            <div className="h-56 w-full rounded-3xl border border-white/10 bg-black/20 backdrop-blur-sm px-2 py-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={86}
                    cornerRadius={10}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {dashboardData.pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        style={{ filter: `drop-shadow(0 0 8px ${entry.color}88)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#3f3f46', borderRadius: '14px', fontSize: '12px', boxShadow: '0 12px 25px rgba(0,0,0,0.35)' }}
                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-around pt-2 text-center text-xs font-bold">
              {dashboardData.pieData.map(item => (
                <div key={item.name} className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-gray-300 font-black uppercase">{item.name}</span>
                  </div>
                  <span className="text-sm font-black text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line Chart Activity */}
          <div className="relative overflow-hidden glass-card p-5 border border-white/10 rounded-[26px] shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-44 w-44 rounded-full bg-rose-500/12 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -top-10 h-32 w-32 rounded-full bg-amber-300/10 blur-3xl" />
            <h3 className="text-xs font-black uppercase text-gray-200 tracking-[0.16em] mb-3">
              Évolution Journalière des Leads
            </h3>
            <div className="h-48 w-full rounded-3xl border border-white/10 bg-black/20 backdrop-blur-sm px-2 py-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.lineData}>
                  <defs>
                    <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="4 5" stroke="rgba(161,161,170,0.22)" vertical={false} />
                  <XAxis dataKey="date" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} width={26} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#3f3f46', borderRadius: '14px', fontSize: '12px', boxShadow: '0 12px 25px rgba(0,0,0,0.35)' }}
                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    labelStyle={{ color: '#d4d4d8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#fb7185"
                    strokeWidth={3.5}
                    filter="url(#lineGlow)"
                    dot={{ fill: '#fb7185', r: 4, stroke: '#fff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#fb7185', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 3: LEADS TABLE --- */}
      {subTab === 'leads' && (
        <div className="space-y-4">
          <div className="glass-card relative z-30 overflow-visible p-4 border border-white/10 space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-400">Filtre temporel des leads</p>

            <div className="space-y-2">
              <DateRangeKnobSlider
                minDate={firstLeadDate}
                maxDate={todayIso}
                startDate={leadRangeStartDate}
                endDate={leadRangeEndDate}
                onChange={({ startDate: nextStart, endDate: nextEnd }) => {
                  const nextStartOffset = Math.max(0, Math.min(maxOffset, Math.floor((new Date(`${nextStart}T00:00:00`).getTime() - minTs) / dayMs)));
                  const nextEndOffset = Math.max(0, Math.min(maxOffset, Math.floor((new Date(`${nextEnd}T00:00:00`).getTime() - minTs) / dayMs)));
                  setLeadStartOffset(nextStartOffset);
                  setLeadEndOffset(nextEndOffset);
                }}
              />
            </div>
          </div>

          <div className="glass-card relative z-10 p-3 border border-white/10 overflow-x-auto">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Tableau des Leads ({filteredLeads.length})</h2>
            <table className="w-full text-left text-[10px] min-w-[760px]">
              <thead>
                <tr className="uppercase text-gray-400 border-b border-white/10">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Agent</th>
                  <th className="py-2 pr-3">Shop</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">MSISDN</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(ld => {
                  const usr = allUsers.find(u => u.id === ld.agent_id);
                  const shp = shops.find(s => s.id === ld.shop_id);
                  return (
                    <tr key={ld.id} className="border-b border-white/5 text-white">
                      <td className="py-2 pr-3">{toISO(ld.timestamp)}</td>
                      <td className="py-2 pr-3">{usr?.name || ld.agent_id}</td>
                      <td className="py-2 pr-3">{shp?.name || ld.shop_id}</td>
                      <td className="py-2 pr-3">{ld.client_name}</td>
                      <td className="py-2 pr-3">{ld.msisdn}</td>
                      <td className="py-2 pr-3">{ld.action_type}</td>
                      <td className="py-2">{ld.status || 'synced'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 3: ARCHIVES & COMPILATION --- */}
      {shopAssignmentModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShopAssignmentModal(null)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Affectation du shop</p>
                <h3 className="text-base font-black uppercase text-white">{shopAssignmentModal.agentName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShopAssignmentModal(null)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Sélectionner un shop</label>
            <select
              value={shopAssignmentModal.selectedShopId}
              onChange={(e) => setShopAssignmentModal(prev => prev ? { ...prev, selectedShopId: e.target.value } : prev)}
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2.5 text-sm font-bold text-white"
            >
              <option value="">Aucun shop</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShopAssignmentModal(null)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[10px] font-black uppercase text-gray-300"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveShopAssignment}
                className="flex-1 rounded-2xl bg-red-600 px-3 py-2.5 text-[10px] font-black uppercase text-white"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === 'reports' && (
        <div className="space-y-4 animate-pop">
          {/* Filter Bar */}
          <div className="glass-card p-4 border border-white/10 space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-400">Filtres de Consolidation Périodique</p>
            <DateRangeKnobSlider
              minDate={consolidationMinDate}
              maxDate={consolidationMaxDate}
              startDate={consolidationStartDate}
              endDate={consolidationEndDate}
              onChange={({ startDate: nextStart, endDate: nextEnd }) => {
                setStartDate(nextStart);
                setEndDate(nextEnd);
              }}
            />
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={reportsFilterTerm}
                onChange={(e) => setReportsFilterTerm(e.target.value)}
                placeholder="Filtre par nom, date ou shop..."
                className="w-full bg-black/60 border border-white/10 rounded-2xl pl-9 pr-3 py-2.5 text-white text-xs font-bold focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Batch Generation Button */}
          <button
            onClick={handleGenerateBatchPDF}
            disabled={loading}
            className="btn-neon btn-red w-full flex items-center justify-center space-x-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{loading ? 'COMPILATION EN COURS...' : '📥 Compilation de Période (PDF Batch)'}</span>
          </button>

          {/* Master Reports List */}
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 px-1">
              Rapports Soumis ({filteredReportsDisplay.length})
            </h2>

            {filteredReportsDisplay.map(rep => (
              <div key={rep.id} className="glass-card p-4 border border-white/10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-white">{rep.agent_name}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">{rep.shop_name} • {rep.date}</p>
                  </div>

                  <button
                    onClick={() => onOpenPdfModal(`report-id:${rep.id}`)}
                    className="h-9 w-9 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-xl border border-red-500/30 transition-all flex items-center justify-center shrink-0"
                    title="Ouvrir PDF"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[8px] text-gray-400 uppercase block">Privilège</span>
                    <span className="text-red-500 text-xs">{rep.priv}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[8px] text-gray-400 uppercase block">Roaming</span>
                    <span className="text-amber-400 text-xs">{rep.roam}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[8px] text-gray-400 uppercase block">Bundles</span>
                    <span className="text-blue-400 text-xs">{rep.bund}</span>
                  </div>
                </div>

                {rep.comment && (
                  <p className="text-[10px] italic text-gray-300 border-l-2 border-red-500/40 pl-2">"{rep.comment}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
