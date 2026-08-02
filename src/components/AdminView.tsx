import React, { useState } from 'react';
import { Shop, AgentMasterStatus, User } from '../types';
import { getAdminMasterList, getLeads, getReports, getUsers, toISO, updateUserShopAssignment, updateUserSupervisor, resolveStoredPhotoUrl, saveTargetDefinition } from '../utils/storage';
import { TabType } from './BottomNav';
import { UserPlus, Store, FileSpreadsheet, Eye, NotebookText, UserCheck, FileText, Search, Filter, MapPin, Clock3, Users, Building2 } from 'lucide-react';
import { formatAgentLocationLine } from '../utils/location';
import { SupervisorProfileModal, SupervisorHostessSummary } from './Modals/SupervisorProfileModal';

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
  onOpenUserModal,
  onOpenShopModal,
  onOpenAgentProfile,
  onOpenPdfModal,
  onRefreshData
}) => {
  const [activeSection, setActiveSection] = useState<'hosts' | 'supervisors' | 'shops' | 'targets'>('hosts');
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
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Online' | 'Absent' | 'Clôturé'>('ALL');
  const [supFilter, setSupFilter] = useState('ALL');
  const [targetPrivilegeStd, setTargetPrivilegeStd] = useState(20);
  const [targetPrivilegeAir, setTargetPrivilegeAir] = useState(20);
  const [targetRoamingStd, setTargetRoamingStd] = useState(3);
  const [targetRoamingAir, setTargetRoamingAir] = useState(15);
  const [targetBundleStd, setTargetBundleStd] = useState(10);
  const [targetBundleAir, setTargetBundleAir] = useState(10);
  const [assignUser, setAssignUser] = useState('');
  const [assignShop, setAssignShop] = useState('');
  const [assignSupervisor, setAssignSupervisor] = useState('');

  const getStatusPalette = (status: string) => {
    if (status === 'Clôturé') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (status === 'Présent') return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    return 'bg-red-500/20 text-red-400 border-red-500/40';
  };

  const masterList = getAdminMasterList();
  const allReports = getReports();
  const allUsers = getUsers();
  const supervisors = allUsers.filter(u => u.role === 'supervisor');
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

  React.useEffect(() => {
    if (subTab !== 'manage') {
      setSelectedSupervisorId(null);
    }
  }, [subTab]);

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

  const sectionButtons: Array<{ key: typeof activeSection; label: string; icon: React.ElementType }> = [
    { key: 'hosts', label: 'Hôtesse', icon: Users },
    { key: 'supervisors', label: 'Superviseurs', icon: UserCheck },
    { key: 'shops', label: 'Shops', icon: Building2 },
    { key: 'targets', label: 'Targets', icon: FileSpreadsheet }
  ];

  return (
    <div className="space-y-5 animate-pop pb-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Poste de <span className="text-red-500">Pilotage</span>
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-1">
            Administration compacte • Hôtesse • Superviseurs • Shops • Targets
          </p>
        </div>
        <button
          onClick={onOpenShopModal}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase text-amber-300"
        >
          + Shop
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
        {sectionButtons.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[10px] font-black uppercase transition-all ${
                isActive ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {activeSection === 'hosts' && (
        <div className="space-y-4">
          <div className="glass-card p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400">Période de suivi</p>
                <p className="text-xs font-black uppercase text-white">{leadFilterMode === 'range' ? `${leadRangeStartDate} → ${leadRangeEndDate}` : leadExactDate}</p>
              </div>
              <button
                onClick={() => setLeadFilterMode(leadFilterMode === 'range' ? 'day' : 'range')}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black uppercase text-gray-300"
              >
                {leadFilterMode === 'range' ? 'Calendrier' : 'Plage'}
              </button>
            </div>

            {leadFilterMode === 'range' ? (
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={maxOffset}
                  value={leadStartOffset}
                  onChange={(e) => setLeadStartOffset(Number(e.target.value))}
                  className="w-full accent-red-500"
                />
                <input
                  type="range"
                  min={0}
                  max={maxOffset}
                  value={leadEndOffset}
                  onChange={(e) => setLeadEndOffset(Number(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>
            ) : (
              <input
                type="date"
                value={leadExactDate}
                min={firstLeadDate}
                max={todayIso}
                onChange={(e) => setLeadExactDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold text-white"
              />
            )}
          </div>

          <div className="glass-card p-3 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400">Annuaire hôtesses</p>
                <p className="text-xs font-black uppercase text-white">{filteredMasterList.length} profils</p>
              </div>
              <button onClick={onOpenUserModal} className="rounded-xl bg-red-600/90 px-3 py-2 text-[10px] font-black uppercase text-white">
                + Utilisateur
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nom ou numéro"
                className="w-full rounded-xl border border-white/10 bg-black/60 pl-9 pr-3 py-2 text-xs font-bold text-white"
              />
            </div>
          )}

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
                    className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase transition-all ${
                      isActive ? 'border-red-500 bg-red-600 text-white' : 'border-white/10 bg-white/5 text-gray-300'
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
              className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold text-white"
            >
              <option value="ALL">Tous les superviseurs</option>
              {supervisors.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
            </select>

            <div className="space-y-2">
              {filteredMasterList.map(agent => {
                const statusBg = getStatusPalette(agent.status);
                return (
                  <div key={agent.id} className={`rounded-2xl border p-3 transition-all ${statusBg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => onOpenAgentProfile(agent)} className="min-w-0 flex-1 text-left">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/70">{agent.shop}</p>
                        <h3 className="text-xs font-black uppercase text-white">{agent.name}</h3>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${statusBg}`}>{agent.status}</span>
                        {agent.reportObj && (
                          <button
                            type="button"
                            onClick={() => onOpenPdfModal(`report-id:${agent.reportObj!.id}`)}
                            className="rounded-full border border-white/10 bg-black/20 p-1.5 text-white/80"
                            title="Ouvrir PDF"
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
                      <button type="button" onClick={() => onOpenAgentProfile(agent)} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase text-white/80">
                        Détails
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'supervisors' && (
        <div className="space-y-3">
          <div className="glass-card p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400">Superviseurs actifs</p>
                <p className="text-xs font-black uppercase text-white">{supervisors.length} comptes</p>
              </div>
              <button onClick={onOpenUserModal} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-gray-300">
                + Superviseur
              </button>
            </div>

            {supervisors.map(sup => {
              const assignedAgents = allUsers.filter(u => u.role === 'agent' && u.supervisorId === sup.id);
              return (
                <div key={sup.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase text-white">{sup.name}</p>
                      <p className="text-[9px] font-bold uppercase text-gray-400">{assignedAgents.length} hôtesses assignées</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase text-amber-300">{sup.role}</span>
                      <button onClick={onOpenUserModal} className="rounded-xl border border-white/10 bg-black/20 p-2 text-white/80">
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSection === 'shops' && (
        <div className="space-y-3">
          <div className="glass-card p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400">Points de vente</p>
                <p className="text-xs font-black uppercase text-white">{shops.length} shops enregistrés</p>
              </div>
              <button onClick={onOpenShopModal} className="rounded-xl bg-red-600/90 px-3 py-2 text-[10px] font-black uppercase text-white">
                + Shop
              </button>
            </div>

            {shops.map(shop => (
              <div key={shop.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase text-white">{shop.name}</p>
                    <p className="text-[9px] font-bold uppercase text-gray-400">{shop.city}</p>
                  </div>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase text-red-300">{shop.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'targets' && (
        <div className="space-y-4">
          <div className="glass-card p-4 border border-white/10 space-y-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-gray-400">Cibles journalières</p>
              <p className="text-xs font-black uppercase text-white">Valeur précise • Affichage entier</p>
            </div>

            <div className="grid gap-3">
              {[
                { key: 'privStd', label: 'Privilège', value: targetPrivilegeStd, setter: setTargetPrivilegeStd, max: 100, side: 'Standard' },
                { key: 'privAir', label: 'Privilège', value: targetPrivilegeAir, setter: setTargetPrivilegeAir, max: 100, side: 'Aéroport' },
                { key: 'roamStd', label: 'Roaming', value: targetRoamingStd, setter: setTargetRoamingStd, max: 50, side: 'Standard' },
                { key: 'roamAir', label: 'Roaming', value: targetRoamingAir, setter: setTargetRoamingAir, max: 50, side: 'Aéroport' },
                { key: 'bundleStd', label: 'Bundle', value: targetBundleStd, setter: setTargetBundleStd, max: 50, side: 'Standard' },
                { key: 'bundleAir', label: 'Bundle', value: targetBundleAir, setter: setTargetBundleAir, max: 50, side: 'Aéroport' }
              ].map(item => (
                <div key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{item.label}</p>
                      <p className="text-[10px] text-gray-500">{item.side}</p>
                    </div>
                    <div className="rounded-full border border-red-500/30 bg-red-600/10 px-2.5 py-1">
                      <span className="text-[11px] font-black text-white">{Math.round(item.value)}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={item.max}
                    step="0.0001"
                    value={item.value}
                    onChange={(e) => item.setter(Number(e.target.value))}
                    className="mb-2 w-full accent-red-500"
                  />
                  <input
                    type="number"
                    min="0"
                    max={item.max}
                    step="1"
                    value={Math.round(item.value)}
                    onChange={(e) => item.setter(Math.max(0, Math.min(item.max, Number(e.target.value || 0)))))}
                    className="w-20 rounded-xl border border-white/10 bg-black/50 px-2 py-1.5 text-center text-[11px] font-black text-white outline-none focus:border-red-400"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleSaveTarget} className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-[10px] font-black uppercase text-white">
                Enregistrer targets
              </button>
              <button onClick={() => setActiveSection('hosts')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-gray-300">
                Voir hôtesses
              </button>
            </div>
          </div>

          <div className="glass-card p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400">Compilation périodique</p>
                <p className="text-xs font-black uppercase text-white">Batch PDF</p>
              </div>
              <button onClick={() => setActiveSection('hosts')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-gray-300">
                Voir période
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold text-white" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold text-white" />
            </div>
            <button onClick={handleGenerateBatchPDF} disabled={loading} className="w-full rounded-xl bg-red-600 px-3 py-2 text-[10px] font-black uppercase text-white">
              {loading ? 'Compilation...' : 'Générer batch PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
