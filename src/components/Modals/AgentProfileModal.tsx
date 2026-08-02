import React, { useEffect, useMemo, useState } from 'react';
import { AgentMasterStatus, DailyReport, Lead, Shop } from '../../types';
import { getLeads, resolveStoredPhotoUrl, updateUserShopAssignment } from '../../utils/storage';
import { buildAgentCompilationPayload } from '../../utils/agentCompilation';
import { Phone, FileSpreadsheet, X, Eye, Camera, CheckCircle2, Clock3, UserCheck } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

interface AgentProfileModalProps {
  isOpen: boolean;
  agent: AgentMasterStatus | null;
  agentReports: DailyReport[];
  todayLeads?: Lead[];
  shops?: Shop[];
  onClose: () => void;
  onOpenPdf: (url: string) => void;
  onAssignmentChanged?: () => void;
  onCompileAgent: (agentId: string) => void;
}

export const AgentProfileModal: React.FC<AgentProfileModalProps> = ({
  isOpen,
  agent,
  agentReports,
  todayLeads = [],
  shops = [],
  onClose,
  onOpenPdf,
  onAssignmentChanged,
  onCompileAgent
}) => {
  if (!isOpen || !agent) return null;

  const [selectedShopId, setSelectedShopId] = useState(agent.shopId || '');

  useEffect(() => {
    setSelectedShopId(agent.shopId || '');
  }, [agent.shopId]);

  const initials = agent.name
    ? agent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'AG';

  const latestPhoto = useMemo(() => {
    const fromReport = agentReports.find(rep => rep.pointage_photo || rep.photos?.length);
    return resolveStoredPhotoUrl(fromReport?.pointage_photo || fromReport?.photos?.[0]) || '';
  }, [agentReports]);

  const evolutionData = useMemo(() => {
    return [...agentReports]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((rep) => ({
        label: rep.date.slice(5),
        value: rep.priv + rep.roam + rep.bund
      }));
  }, [agentReports]);

  const handleAssignmentSave = () => {
    if (!selectedShopId || !agent) return;
    updateUserShopAssignment(agent.id, selectedShopId);
    onAssignmentChanged?.();
  };

  const handleCompileAgent = () => {
    if (!agent) return;
    const reports = agentReports.length > 0 ? agentReports : [];
    const allAgentLeads = getLeads().filter((lead) => lead.agent_id === agent.id);
    const payload = buildAgentCompilationPayload({
      agentId: agent.id,
      agentName: agent.name,
      shopName: agent.shop,
      reports: reports.map((report) => ({
        date: report.date,
        agent_name: report.agent_name,
        shop_name: report.shop_name,
        agent_id: report.agent_id,
        arrival_time: report.arrival_time,
        departure_time: report.departure_time,
        maps_in: report.maps_in,
        maps_out: report.maps_out,
        priv: report.priv,
        roam: report.roam,
        bund: report.bund,
        pointage_photo: report.pointage_photo,
        photos: report.photos || [],
        comment: report.comment
      })),
      leads: allAgentLeads.map((lead) => ({
        agent_id: lead.agent_id,
        timestamp: lead.timestamp,
        client_name: lead.client_name,
        msisdn: lead.msisdn,
        action_type: lead.action_type
      }))
    });
    onOpenPdf(`preview-admin-batch:${encodeURIComponent(JSON.stringify(payload))}`);
  };

  const statusBadgeClass = agent.status === 'Clôturé'
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    : agent.status === 'Présent'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
      : 'bg-red-500/20 text-red-400 border-red-500/40';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop overflow-y-auto" onClick={onClose}>
      <div className="modal-sheet relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-red-600/20 border-2 border-red-500/40 text-red-500 font-black text-xl flex items-center justify-center mb-3 overflow-hidden">
            {latestPhoto ? (
              <img src={latestPhoto} alt={`Pointage ${agent.name}`} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <h2 className="text-xl font-black uppercase text-white tracking-wider">{agent.name}</h2>
          <p className="text-xs text-gray-400 font-bold uppercase">{agent.shop} • MSISDN: {agent.phone}</p>
        </div>

        <div className="flex justify-center mb-4">
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusBadgeClass}`}>
            {agent.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={handleCompileAgent}
            className="btn-neon btn-red text-xs py-3 flex items-center justify-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>COMPILER (PDF)</span>
          </button>

          <a
            href={`tel:${agent.phone}`}
            className="btn-neon btn-dark text-xs py-3 flex items-center justify-center space-x-1.5 text-center text-white text-decoration-none"
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>APPELER</span>
          </a>
        </div>

        {latestPhoto && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center gap-2 text-left">
            <Camera className="w-4 h-4 text-red-400" />
            <p className="text-[10px] font-bold uppercase text-gray-300">Photo de pointage visible dans le profil</p>
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Affectation</p>
              <p className="text-[11px] font-semibold text-white">{agent.shop}</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <UserCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase">Shop</span>
            </div>
          </div>
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[11px] font-bold text-white"
          >
            <option value="">Aucun shop</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>
          <button
            onClick={handleAssignmentSave}
            className="w-full rounded-xl bg-red-600/90 px-3 py-2 text-[10px] font-black uppercase text-white"
          >
            Enregistrer l'affectation
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Évolution quotidienne</p>
            <div className="flex items-center gap-1 text-red-400">
              <Clock3 className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase">Rapports</span>
            </div>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <XAxis dataKey="label" stroke="#71717a" fontSize={9} />
                <YAxis stroke="#71717a" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '10px', fontSize: '11px' }} />
                <Line type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3, fill: '#f43f5e' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Détail clients du jour</p>
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase">{todayLeads.length}</span>
            </div>
          </div>
          <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
            {todayLeads.length === 0 ? (
              <p className="text-[10px] text-gray-500 italic">Aucun client enregistré aujourd'hui.</p>
            ) : todayLeads.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-white">{lead.client_name}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-gray-300">{lead.action_type}</span>
                </div>
                <p className="mt-1 text-[9px] text-gray-400">{lead.msisdn}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">
            Historique des Rapports ({agentReports.length})
          </h3>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {agentReports.length === 0 ? (
              <p className="text-center text-xs text-gray-500 italic py-4">Aucun rapport disponible pour cet agent.</p>
            ) : (
              agentReports.map(rep => (
                <div key={rep.id} className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-white">{rep.date}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">
                      Priv: {rep.priv} | Roam: {rep.roam} | Bund: {rep.bund}
                    </p>
                  </div>

                  <button
                    onClick={() => onOpenPdf(`report-id:${rep.id}`)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-[10px] font-black uppercase flex items-center space-x-1 transition-all"
                  >
                    <Eye className="w-3 h-3" />
                    <span>VOIR</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
