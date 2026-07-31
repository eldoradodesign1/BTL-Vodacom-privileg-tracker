import React, { useState } from 'react';
import { User, Shop, DailyReport, AgentMasterStatus } from '../types';
import { getAdminMasterList, getDashboardData, getReports, getReportPdf, getUsers, updateUserShopAssignment, updateUserSupervisor } from '../utils/storage';
import { generateAdminBatchPDF } from '../utils/pdfGenerator';
import { TabType } from './BottomNav';
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { UserPlus, Store, FileSpreadsheet, Eye, ChevronRight, UserCheck, Shield } from 'lucide-react';

interface AdminViewProps {
  shops: Shop[];
  activeTab?: TabType;
  onSimulateRole: (role: any) => void;
  onOpenUserModal: () => void;
  onOpenShopModal: () => void;
  onOpenAgentProfile: (agent: AgentMasterStatus) => void;
  onOpenPdfModal: (url: string) => void;
  onRefreshData?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  shops,
  activeTab = 'admin',
  onSimulateRole,
  onOpenUserModal,
  onOpenShopModal,
  onOpenAgentProfile,
  onOpenPdfModal,
  onRefreshData
}) => {
  const [subTab, setSubTab] = useState<'manage' | 'stats' | 'reports'>(
    activeTab === 'home' ? 'stats' : (activeTab === 'tab3' ? 'reports' : 'manage')
  );
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Sync internal subTab when activeTab changes
  React.useEffect(() => {
    if (activeTab === 'home') setSubTab('stats');
    else if (activeTab === 'tab3') setSubTab('reports');
    else if (activeTab === 'tab2' || activeTab === 'admin') setSubTab('manage');
  }, [activeTab]);

  const handleGenerateBatchPDF = async () => {
    setLoading(true);
    const rows = allReports.map(r => ({
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

    const pdfUrl = await generateAdminBatchPDF({
      period: `${startDate} au ${endDate}`,
      rows,
      totals
    });

    setLoading(false);
    onOpenPdfModal(pdfUrl);
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

  return (
    <div className="space-y-6 animate-pop pb-28">
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
          {/* Simulation Switcher Box */}
          <div className="glass-card p-4 border border-white/10 text-center">
            <p className="text-[10px] font-black uppercase text-gray-400 mb-3">Changer de vue instantanée</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onSimulateRole('admin')}
                className="py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase shadow-md"
              >
                ADMIN
              </button>
              <button
                onClick={() => onSimulateRole('supervisor')}
                className="py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-black uppercase border border-white/10"
              >
                SUP
              </button>
              <button
                onClick={() => onSimulateRole('agent')}
                className="py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-black uppercase border border-white/10"
              >
                AGENT
              </button>
            </div>
          </div>

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

          {/* Master User Directory with Live Sparklines */}
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 px-1">
              Annuaire Master Hôtesses ({masterList.length})
            </h2>

            {masterList.map(agent => {
              const statusDotColor = agent.status === 'Clôturé' ? 'bg-emerald-500'
                : (agent.status === 'Présent' ? 'bg-blue-500' : 'bg-red-500');

              // Generate simple SVG sparkline path
              const maxVal = Math.max(...agent.trend, 10);
              const points = agent.trend.map((val, idx) => {
                const x = (idx / (agent.trend.length - 1)) * 60;
                const y = 25 - (val / maxVal) * 20;
                return `${x},${y}`;
              }).join(' ');

              return (
                <div
                  key={agent.id}
                  onClick={() => onOpenAgentProfile(agent)}
                  className="glass-card p-4 border border-white/10 hover:border-red-500/40 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white text-sm">
                        {agent.name[0]}
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black ${statusDotColor}`} />
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase text-white">{agent.name}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">
                        {agent.shop} • <span className={agent.status === 'Absent' ? 'text-red-400' : 'text-emerald-400'}>{agent.status}</span>
                      </p>
                    </div>
                  </div>

                  {/* Sparkline Canvas / SVG */}
                  <div className="flex items-center space-x-3">
                    <div className="w-16 h-8 flex items-center justify-center">
                      <svg width="60" height="25" className="overflow-visible">
                        <polyline
                          fill="none"
                          stroke="#E60000"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      </svg>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
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
            <div className="bg-white text-black p-5 rounded-3xl text-center shadow-lg">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block">Total Activations</span>
              <p className="text-3xl font-black text-red-600">{dashboardData.kpi.totalLeads}</p>
            </div>
            <div className="bg-white text-black p-5 rounded-3xl text-center shadow-lg">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block">Effectif Hôtesses</span>
              <p className="text-3xl font-black text-zinc-900">{dashboardData.kpi.presence}</p>
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
                  onClick={async () => {
                    const pdfUrl = await getReportPdf(rep);
                    onOpenPdfModal(pdfUrl);
                  }}
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
