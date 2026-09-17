import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, UserRound, X } from 'lucide-react';
import type { Campaign, User } from '../types';
import { getCampaignAssignmentsOverview, getCampaigns, setUserCampaignAssignment, type CampaignAssignmentOverview } from '../utils/merchantCampaign';

interface CampaignAssignmentsPanelProps {
  currentUser: User;
}

const campaignOrder = ['vodacom-privilege', 'merchant-educational-campaign', 'youth-f2f'];

function sortCampaigns(campaigns: Campaign[]): Campaign[] {
  return [...campaigns].sort((a, b) => {
    const ai = campaignOrder.indexOf(a.code);
    const bi = campaignOrder.indexOf(b.code);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name, 'fr');
  });
}

export default function CampaignAssignmentsPanel({ currentUser }: CampaignAssignmentsPanelProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assignments, setAssignments] = useState<CampaignAssignmentOverview[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [campaignRows, assignmentRows] = await Promise.all([
        getCampaigns(),
        getCampaignAssignmentsOverview(),
      ]);
      setCampaigns(sortCampaigns(campaignRows));
      setAssignments(assignmentRows);
      const { getUsers } = await import('../utils/storage');
      const allUsers = await getUsers();
      setUsers(allUsers.filter((user) => user.role === 'agent'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les campagnes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const assignedIds = useMemo(() => new Set(assignments.filter((a) => a.isActive).map((a) => a.userId)), [assignments]);

  const canAssign = (user: User, campaign: Campaign) => {
    if (user.userCategory === 'hostess') return campaign.campaign_type === 'hostess';
    if (user.userCategory === 'brand_ambassador') return campaign.campaign_type === 'brand_ambassador';
    return false;
  };

  const agentsForCampaign = (campaign: Campaign) => {
    const ids = new Set(assignments.filter((a) => a.campaignId === campaign.id && a.isActive).map((a) => a.userId));
    return users.filter((user) => ids.has(user.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  };

  const availableAgents = (campaign: Campaign) => users
    .filter((user) => canAssign(user, campaign) && !assignments.some((a) => a.campaignId === campaign.id && a.userId === user.id && a.isActive))
    .filter((user) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return `${user.name} ${user.phone}`.toLowerCase().includes(term);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const addAgent = async (campaign: Campaign) => {
    if (!selectedAgent) return;
    setSaving(true);
    setError('');
    try {
      await setUserCampaignAssignment({ userId: selectedAgent, campaignId: campaign.id, isActive: true, assignedBy: currentUser.id });
      setSelectedAgent('');
      setSearch('');
      setAddingTo(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’affecter l’agent.');
    } finally {
      setSaving(false);
    }
  };

  const removeAgent = async (campaign: Campaign, user: User) => {
    setSaving(true);
    setError('');
    try {
      await setUserCampaignAssignment({ userId: user.id, campaignId: campaign.id, isActive: false, assignedBy: currentUser.id });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de désaffecter l’agent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="glass-card border border-violet-300/25 bg-violet-500/[0.06] p-4">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-violet-100">Campagnes & affectations</h2>
          <p className="mt-1 max-w-3xl text-[10px] font-semibold leading-relaxed text-gray-400">
            Les campagnes sont affichées directement. Dépliez une campagne pour voir ses agents, en ajouter ou retirer une affectation. Un BA peut appartenir à plusieurs campagnes ; les hôtesses restent rattachées aux campagnes Hôtesse.
          </p>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-200">{error}</div>}

      {loading ? (
        <div className="glass-card p-8 text-center text-xs font-bold text-gray-400">Chargement des campagnes…</div>
      ) : campaigns.length === 0 ? (
        <div className="glass-card p-8 text-center text-xs font-bold text-gray-400">Aucune campagne active ou en préparation.</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const isOpen = !!expanded[campaign.id];
            const campaignAgents = agentsForCampaign(campaign);
            const isAdding = addingTo === campaign.id;
            const options = availableAgents(campaign);
            return (
              <section key={campaign.id} className="glass-card overflow-hidden border border-white/10">
                <button
                  type="button"
                  onClick={() => setExpanded((current) => ({ ...current, [campaign.id]: !isOpen }))}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-white">{campaign.name}</h3>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-gray-400">
                        {campaign.campaign_type === 'hostess' ? 'Hôtesses' : 'BA'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-gray-500">{campaignAgents.length} agent{campaignAgents.length > 1 ? 's' : ''} affecté{campaignAgents.length > 1 ? 's' : ''}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-3">
                    <div className="space-y-2">
                      {campaignAgents.length === 0 && (
                        <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[10px] font-semibold text-gray-500">Aucun agent affecté à cette campagne.</div>
                      )}
                      {campaignAgents.map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-300"><UserRound className="h-4 w-4" /></span>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black text-gray-100">{agent.name}</p>
                              <p className="text-[9px] font-semibold text-gray-500">{agent.phone}</p>
                            </div>
                          </div>
                          <button type="button" disabled={saving} onClick={() => void removeAgent(campaign, agent)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40" title="Retirer de la campagne">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {!isAdding ? (
                      <button type="button" onClick={() => { setAddingTo(campaign.id); setSelectedAgent(''); setSearch(''); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300/30 bg-violet-500/[0.05] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-violet-200 transition hover:bg-violet-500/10">
                        <Plus className="h-4 w-4" /> Ajouter un agent
                      </button>
                    ) : (
                      <div className="mt-3 rounded-xl border border-violet-300/20 bg-violet-500/[0.05] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-violet-200">Ajouter à {campaign.name}</p>
                          <button type="button" onClick={() => setAddingTo(null)} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un agent…" className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-[11px] text-white outline-none placeholder:text-gray-600 focus:border-violet-300/40" />
                        </div>
                        <select value={selectedAgent} onChange={(event) => setSelectedAgent(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-violet-300/40">
                          <option value="">Sélectionner un agent…</option>
                          {options.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} — {agent.phone}</option>)}
                        </select>
                        {options.length === 0 && <p className="mt-2 text-[10px] font-semibold text-gray-500">Aucun agent disponible pour cette campagne.</p>}
                        <button type="button" disabled={!selectedAgent || saving} onClick={() => void addAgent(campaign)} className="mt-2 w-full rounded-lg bg-violet-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40">
                          {saving ? 'Enregistrement…' : 'Affecter à cette campagne'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-[9px] font-semibold text-gray-600">Affectations actives : {assignedIds.size} • Les désaffectations retirent l’accès opérationnel sans supprimer l’historique.</p>
    </div>
  );
}
