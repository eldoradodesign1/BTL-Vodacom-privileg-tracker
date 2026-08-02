import React, { useState } from 'react';
import { Shop, AgentMasterStatus, User } from '../types';
import { getAdminMasterList, getDashboardData, getLeads, getReports, getUsers, toISO, updateUserShopAssignment, updateUserSupervisor, resolveStoredPhotoUrl, saveTargetDefinition } from '../utils/storage';
import { TabType } from './BottomNav';
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { UserPlus, Store, FileSpreadsheet, Eye, NotebookText, UserCheck, FileText, Search, Filter, MapPin, Clock3 } from 'lucide-react';
import { formatAgentLocationLine } from '../utils/location';

interface AdminViewProps {
  currentUser: User;
  shops: Shop[];
  activeTab?: TabType;
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
  onSimulateRole,
  onOpenUserModal,
  onOpenShopModal,
  onOpenAgentProfile,
  onOpenPdfModal,
  onOpenTodayClientsModal,
  onOpenLocationModal,
  onRefreshData
}) => {
  const [subTab, setSubTab] = useState<'manage' | 'stats' | 'leads' | 'reports'>(
    activeTab === 'home' ? 'stats' : (activeTab === 'tab3' ? 'reports' : 'manage')
  );
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
  const [leadFilterMode, setLeadFilterMode] = useState<'range' | 'day'>('range');
  const [leadStartOffset, setLeadStartOffset] = useState(0);
  const [leadEndOffset, setLeadEndOffset] = useState(maxOffset);
  const [leadExactDate, setLeadExactDate] = useState(todayIso);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Online' | 'Absent' | 'Clôturé'>('ALL');
  const [supFilter, setSupFilter] = useState('ALL');
  const [inlineAssignShop, setInlineAssignShop] = useState<Record<string, string>>({});

  const getStatusPalette = (status: string) => {
    if (status === 'Clôturé') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (status === 'Présent') return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    return 'bg-red-500/20 text-red-400 border-red-500/40';
  };
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
  const dashboardData = getDashboardData({ start: startDate, end: endDate, agentId: selectedAgentId });
  const allReports = getReports();
  const allUsers = getUsers();
  const supervisors = allUsers.filter(u => u.role === 'supervisor');
  const agents = allUsers.filter(u => u.role === 'agent');
  const filteredMasterList = masterList.filter(agent => {
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
    if (leadFilterMode === 'day') return d === leadExactDate;
    return d >= leadRangeStartDate && d <= leadRangeEndDate;
  });
  // Sync internal subTab when activeTab changes
  React.useEffect(() => {
    if (activeTab === 'home') setSubTab('stats');
    else if (activeTab === 'tab3') setSubTab('reports');
    else if (activeTab === 'tab2' || activeTab === 'admin') setSubTab('manage');
  }, [activeTab]);

  const handleGenerateBatchPDF = async () => {
    setLoading(true);
    const selectedReports = allReports.filter(r => r.date >= startDate && r.date <= endDate);
    const rows = selectedReports.map(r => ({
      date: r.date,
      agent: r.agent_name,
      priv: r.priv,
      roam: r.roam,
      bund: r.bund
    }));

    const totals = rows.reduce(
      (acc, r) => ({
        privilege: acc.privilege + r.priv,
        roaming: acc.roaming + r.roam,
        bundles: acc.bundles + r.bund
      }),
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

    const groups = selectedReports.reduce<Array<{ supervisor: string; agentCount: number; totalLeads: number; totalPrivilege: number; totalRoaming: number; totalBundles: number }>>((acc, report) => {
      const existing = acc.find(group => group.supervisor === (report.shop_name || 'Administration'));
      if (existing) {
        existing.agentCount += 1;
        existing.totalLeads += report.priv + report.roam + report.bund;
        existing.totalPrivilege += report.priv;
        existing.totalRoaming += report.roam;
        existing.totalBundles += report.bund;
      } else {
        acc.push({
          supervisor: report.shop_name || 'Administration',
          agentCount: 1,
          totalLeads: report.priv + report.roam + report.bund,
          totalPrivilege: report.priv,
          totalRoaming: report.roam,
          totalBundles: report.bund
        });
      }
      return acc;
    }, []);

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
    if (assignShop) updateUserShopAssignment(assignUser, assignShop);
    if (assignSupervisor) updateUserSupervisor(assignUser, assignSupervisor);
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

  return (
    <div className="space-y-6 animate-pop pb-32">
      {/* Admin Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Poste de <span className="text-red-500">Pilotage</span>
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            Administration globale & Analytics Vodacom Privilège Pro
          </p>
        </div>
      </div>

      {/* Admin Sub-Tabs */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
        <button
          onClick={() => setSubTab('manage')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
            subTab === 'manage' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          Gestion
        </button>
        <button
          onClick={() => setSubTab('stats')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
            subTab === 'stats' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          Analyses
        </button>
        <button
          onClick={() => setSubTab('leads')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
            subTab === 'leads' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          Leads
        </button>
        <button
          onClick={() => setSubTab('reports')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all ${
            subTab === 'reports' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          Archives
        </button>
      </div>

      {/* --- SUB-TAB 1: GESTION --- */}
      {subTab === 'manage' && (
        <div className="space-y-4 animate-pop">
          {/* Creation Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onOpenUserModal}
              className="btn-neon btn-dark py-3.5 text-xs flex items-center justify-center space-x-1.5"
            >
              <UserPlus className="w-4 h-4 text-red-500" />
              <span>＋ Agent / Sup</span>
            </button>
            <button
              onClick={onOpenShopModal}
              className="btn-neon btn-dark py-3.5 text-xs flex items-center justify-center space-x-1.5"
            >
              <Store className="w-4 h-4 text-amber-400" />
              <span>＋ Shop</span>
            </button>
          </div>

          {/* Assignment Management Box */}
          <div className="glass-card p-4 border border-white/10 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <UserCheck className="w-4 h-4" />
              <span>Affectations Shop & Superviseur</span>
            </h2>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Sélectionner un utilisateur</label>
                <select
                  value={assignUser}
                  onChange={(e) => setAssignUser(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Choisir un utilisateur --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.toUpperCase()})
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

          <div className="glass-card p-5 border border-white/10 space-y-4">
            <div className="space-y-1">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-400">Définir les targets</h2>
              <p className="text-[10px] text-gray-400 font-semibold">Saisissez manuellement ou glissez pour ajuster chaque valeur.</p>
            </div>

            <div className="grid gap-3">
              {[
                { key: 'privStd', label: 'Privilège', value: targetPrivilegeStd, setter: setTargetPrivilegeStd, max: 100, side: 'Standard' },
                { key: 'privAir', label: 'Privilège', value: targetPrivilegeAir, setter: setTargetPrivilegeAir, max: 100, side: 'Aéroport' },
                { key: 'roamStd', label: 'Roaming', value: targetRoamingStd, setter: setTargetRoamingStd, max: 50, side: 'Standard' },
                { key: 'roamAir', label: 'Roaming', value: targetRoamingAir, setter: setTargetRoamingAir, max: 50, side: 'Aéroport' },
                { key: 'bundleStd', label: 'Bundle', value: targetBundleStd, setter: setTargetBundleStd, max: 50, side: 'Standard' },
                { key: 'bundleAir', label: 'Bundle', value: targetBundleAir, setter: setTargetBundleAir, max: 50, side: 'Aéroport' }
              ].map((item) => (
                <div key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{item.label}</p>
                      <p className="text-[10px] text-gray-500">{item.side}</p>
                    </div>
                    <div className="rounded-full border border-red-500/30 bg-red-600/10 px-2.5 py-1">
                      <span className="text-[11px] font-black text-white">{item.value}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max={item.max}
                      step="1"
                      value={item.value}
                      onChange={(e) => item.setter(Number(e.target.value))}
                      className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-red-500"
                      aria-label={`${item.label} ${item.side}`}
                    />
                    <input
                      type="number"
                      min="0"
                      max={item.max}
                      value={item.value}
                      onChange={(e) => item.setter(Math.max(0, Math.min(item.max, Number(e.target.value || 0))))}
                      className="w-16 rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleSaveTarget} className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase">Enregistrer le target</button>
          </div>

          {/* Master User Directory with Live Sparklines */}
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 px-1">
              Annuaire Master Hôtesses ({filteredMasterList.length})
            </h2>

            <div className="glass-card p-3 border border-white/10 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Recherche nom ou numero..."
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="space-y-2">
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
                <select
                  value={supFilter}
                  onChange={(e) => setSupFilter(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-white text-xs font-bold"
                >
                  <option value="ALL">Tous les superviseurs</option>
                  {supervisors.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                </select>
              </div>
              <div className="text-[10px] font-black uppercase text-gray-400 flex items-center space-x-1">
                <Filter className="w-3 h-3" />
                <span>Filtres instantanes actifs</span>
              </div>
            </div>

            {filteredMasterList.map(agent => {
              const statusBg = getStatusPalette(agent.status);

              return (
                <div
                  key={agent.id}
                  className={`w-full rounded-2xl border p-3 text-left transition-all ${statusBg}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button type="button" onClick={() => onOpenAgentProfile(agent)} className="min-w-0 flex-1 text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{agent.shop}</p>
                      <h3 className="text-xs font-black uppercase text-white">{agent.name}</h3>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${statusBg}`}>
                        {agent.status}
                      </span>
                      {agent.reportObj && (
                        <button
                          type="button"
                          onClick={() => onOpenPdfModal(`report-id:${agent.reportObj!.id}`)}
                          className="rounded-full border border-white/10 bg-black/20 p-1.5 text-white/80"
                          title="Ouvrir le PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase text-white/80">
                      {agent.reportObj ? 'Rapport' : 'Aucun'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAgentProfile(agent)}
                      className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase text-white/80"
                    >
                      Historique
                    </button>
                  </div>
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
              className="bg-white text-black p-5 rounded-3xl text-center shadow-lg cursor-pointer hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-95 group"
              title="Cliquer pour voir tous les Leads / Rapport de Synthèse"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block group-hover:text-red-600">Total Activations</span>
              <p className="text-3xl font-black text-red-600">{dashboardData.kpi.totalLeads}</p>
              <span className="text-[8px] font-bold text-gray-400 uppercase mt-1 block group-hover:underline">→ Voir la liste</span>
            </div>
            <div
              onClick={() => setSubTab('manage')}
              className="bg-white text-black p-5 rounded-3xl text-center shadow-lg cursor-pointer hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-95 group"
              title="Cliquer pour aller au Monitoring des hôtesses"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block group-hover:text-black">Effectif Hôtesses</span>
              <p className="text-3xl font-black text-zinc-900">{dashboardData.kpi.presence}</p>
              <span className="text-[8px] font-bold text-gray-400 uppercase mt-1 block group-hover:underline">→ Aller au Monitoring</span>
            </div>
          </div>

          {/* Offres Distribution Pie Chart */}
          <div className="glass-card p-5 border border-white/10">
            <h3 className="text-xs font-black uppercase text-red-500 tracking-wider mb-3 text-center">
              Répartition des Activations (Offres)
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dashboardData.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-around pt-2 text-center text-xs font-bold">
              {dashboardData.pieData.map(item => (
                <div key={item.name} className="flex flex-col items-center">
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-gray-400 font-black uppercase">{item.name}</span>
                  </div>
                  <span className="text-sm font-black text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line Chart Activity */}
          <div className="glass-card p-5 border border-white/10">
            <h3 className="text-xs font-black uppercase text-gray-300 tracking-wider mb-3">
              Évolution Journalière des Leads
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.lineData}>
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                  <YAxis stroke="#71717a" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#E60000" strokeWidth={3} dot={{ fill: '#E60000', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 3: LEADS TABLE --- */}
      {subTab === 'leads' && (
        <div className="space-y-4">
          <div className="glass-card p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase text-gray-400">Filtre temporel des leads</p>
              <button
                onClick={() => setLeadFilterMode(leadFilterMode === 'range' ? 'day' : 'range')}
                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-white/10 text-white border border-white/20"
              >
                {leadFilterMode === 'range' ? 'Date précise' : 'Plage'}
              </button>
            </div>

            {leadFilterMode === 'range' ? (
              <div className="space-y-2">
                <div className="text-[10px] text-gray-300 font-bold">{leadRangeStartDate} → {leadRangeEndDate}</div>
                <input
                  type="range"
                  min={0}
                  max={maxOffset}
                  value={leadStartOffset}
                  onChange={(e) => setLeadStartOffset(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <input
                  type="range"
                  min={0}
                  max={maxOffset}
                  value={leadEndOffset}
                  onChange={(e) => setLeadEndOffset(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
            ) : (
              <input
                type="date"
                min={firstLeadDate}
                max={todayIso}
                value={leadExactDate}
                onChange={(e) => setLeadExactDate(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold"
              />
            )}
          </div>

          <div className="glass-card p-3 border border-white/10 overflow-x-auto">
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
      {subTab === 'reports' && (
        <div className="space-y-4 animate-pop">
          {/* Filter Bar */}
          <div className="glass-card p-4 border border-white/10 space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-400">Filtres de Consolidation Périodique</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold"
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
              Rapports Soumis ({allReports.length})
            </h2>

            {allReports.map(rep => (
              <div key={rep.id} className="glass-card p-4 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-white">{rep.agent_name}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{rep.shop_name} • {rep.date}</p>
                </div>

                <button
                  onClick={() => onOpenPdfModal(`report-id:${rep.id}`)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center space-x-1 shadow-md"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ouvrir PDF</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
