import React, { useState } from 'react';
import { User, Shop, AgentMasterStatus } from '../types';
import { getSupervisorLiveView, getReportPdf, getReports, getUsers, updateUserShopAssignment } from '../utils/storage';
import { generateSupervisorPDF } from '../utils/pdfGenerator';
import { TabType } from './BottomNav';
import { Trophy, FileCheck, Eye, Search, Store, UserCheck, MapPin, Archive, ChevronRight } from 'lucide-react';

interface SupervisorViewProps {
  currentUser: User;
  activeTab?: TabType;
  shops: Shop[];
  onOpenPdfModal: (url: string) => void;
  onOpenAgentProfile?: (agent: AgentMasterStatus) => void;
  onRefreshData?: () => void;
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({
  currentUser,
  activeTab = 'home',
  shops,
  onOpenPdfModal,
  onOpenAgentProfile,
  onRefreshData
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assigningShopId, setAssigningShopId] = useState<string>('');

  const teamData = getSupervisorLiveView(currentUser.id, selectedDate);
  const allUsers = getUsers();
  const supervisedAgents = allUsers.filter(u => u.role === 'agent' && u.supervisorId === currentUser.id);

  const activeCount = teamData.filter(t => t.status !== 'Absent').length;
  const closedCount = teamData.filter(t => t.status === 'Clôturé').length;

  // Podium sorting
  const sortedPodium = [...teamData].sort((a, b) => {
    const totalA = a.stats.priv + a.stats.roam + a.stats.bund;
    const totalB = b.stats.priv + b.stats.roam + b.stats.bund;
    return totalB - totalA;
  });

  const handleGenerateSupervisorReport = async () => {
    setLoading(true);
    const pdfUrl = await generateSupervisorPDF({
      supName: currentUser.name,
      date: selectedDate,
      team: teamData
    });
    setLoading(false);
    onOpenPdfModal(pdfUrl);
  };

  const handleAssignShopSubmit = (userId: string, shopId: string) => {
    updateUserShopAssignment(userId, shopId);
    setAssigningUserId(null);
    if (onRefreshData) onRefreshData();
  };

  // --- TAB 2: MONITORING ---
  if (activeTab === 'tab2') {
    const filteredTeam = teamData.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.shop.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-[10px] font-bold focus:outline-none focus:border-red-500"
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

        {/* Agent Cards */}
        <div className="space-y-3">
          {filteredTeam.map(item => {
            const statusBg = item.status === 'Clôturé' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : (item.status === 'Présent' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40');
            const totalLeads = item.stats.priv + item.stats.roam + item.stats.bund;

            return (
              <div key={item.id} className="glass-card p-4 border border-white/10 space-y-3 hover:border-red-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-black uppercase text-white flex items-center space-x-1.5">
                      <span>{item.name}</span>
                    </h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      <span>{item.shop}</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border ${statusBg}`}>
                      {item.status}
                    </span>

                    {item.reportObj && (
                      <button
                        onClick={async () => {
                          const url = await getReportPdf(item.reportObj!);
                          onOpenPdfModal(url);
                        }}
                        className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-xl border border-red-500/30 transition-all"
                        title="Voir le rapport PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats Breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="bg-white/5 p-2 rounded-xl">
                    <span className="text-[8px] text-gray-400 uppercase block">Privilège</span>
                    <span className="text-red-500 text-xs">{item.stats.priv}</span>
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

                {/* Agent Profile Trigger */}
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
                    className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 border border-white/10 flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <span>Voir Historique & Profil Complet</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
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

        {/* Shops List */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase text-gray-400 tracking-wider">
            Shops Disponibles ({shops.length})
          </h2>

          {shops.map(shop => {
            const assignedAgents = supervisedAgents.filter(a => a.permanentShopId === shop.id);
            return (
              <div key={shop.id} className="glass-card p-4 border border-white/10 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-black uppercase text-white flex items-center space-x-2">
                      <Store className="w-4 h-4 text-amber-400" />
                      <span>{shop.name}</span>
                    </h3>
                    <p className="text-[10px] text-gray-400 font-semibold">{shop.city} • Type: {shop.type}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-red-600/20 text-red-400 rounded-xl text-[9px] font-black uppercase border border-red-500/30">
                    {assignedAgents.length} Hôtesses
                  </span>
                </div>

                {/* Assigned Agents badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assignedAgents.length === 0 ? (
                    <span className="text-[10px] text-gray-500 italic">Aucune hôtesse affectée à ce shop</span>
                  ) : (
                    assignedAgents.map(ag => (
                      <span key={ag.id} className="text-[9px] font-black uppercase px-2.5 py-1 bg-white/5 text-gray-300 rounded-lg border border-white/10 flex items-center space-x-1">
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

        <button
          onClick={handleGenerateSupervisorReport}
          disabled={loading}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase flex items-center space-x-1.5 shadow-lg shadow-red-600/30 transition-all"
        >
          <FileCheck className="w-4 h-4" />
          <span>{loading ? 'SYNTHÈSE...' : 'Synthèse PDF'}</span>
        </button>
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
          {sortedPodium.slice(0, 3).map((item, idx) => {
            const total = item.stats.priv + item.stats.roam + item.stats.bund;
            const colors = [
              'border-amber-400/60 bg-amber-500/10 text-amber-400',
              'border-slate-300/40 bg-slate-400/10 text-slate-300',
              'border-amber-700/40 bg-amber-800/10 text-amber-600'
            ];
            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border flex items-center justify-between ${colors[idx] || 'border-white/10 bg-white/5'}`}
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
        </div>
      </div>

      {/* Live Monitoring Summary Cards */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xs font-black uppercase text-gray-400 tracking-wider">
            Monitoring en direct ({teamData.length} Hôtesses)
          </h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1 text-white text-[10px] font-bold focus:outline-none focus:border-red-500"
          />
        </div>

        {teamData.map(item => {
          const statusBg = item.status === 'Clôturé' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            : (item.status === 'Présent' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40');

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
                      onClick={async () => {
                        const url = await getReportPdf(item.reportObj!);
                        onOpenPdfModal(url);
                      }}
                      className="p-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-xl border border-red-500/30 transition-all"
                      title="Voir le rapport PDF"
                    >
                      <Eye className="w-4 h-4" />
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
