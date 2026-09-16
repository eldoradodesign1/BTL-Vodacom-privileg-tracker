import React, { useEffect, useMemo, useState } from 'react';
import { Campaign, Shop, UserCategory, UserRole } from '../../types';
import { saveUser, getUsers } from '../../utils/storage';
import { syncLocalDataToSupabase } from '../../utils/supabase';
import { assignUserToCampaigns, getCampaigns, getCampaignsForUser, setUserCampaignAssignment } from '../../utils/merchantCampaign';
import { X } from 'lucide-react';
import { cleanPhoneNumber, formatMsisdn, isValidMsisdn } from '../../utils/phoneValidator';

interface UserModalProps {
  isOpen: boolean;
  shops: Shop[];
  onClose: () => void;
  onSuccess: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, shops, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [category, setCategory] = useState<UserCategory>('hostess');
  const [supervisorId, setSupervisorId] = useState('');
  const [shopId, setShopId] = useState('');
  const [password, setPassword] = useState('vodacom123');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'create' | 'assign'>('create');
  const [existingAgentId, setExistingAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const supervisors = useMemo(() => getUsers().filter((user) => user.role === 'supervisor' || user.role === 'admin'), []);
  const existingAgents = useMemo(() => getUsers()
    .filter((user) => user.role === 'agent' && (user.userCategory === 'hostess' || user.userCategory === 'brand_ambassador'))
    .sort((a, b) => a.name.localeCompare(b.name)), [isOpen]);
  const selectedAgent = useMemo(() => existingAgents.find((user) => user.id === existingAgentId), [existingAgents, existingAgentId]);
  const eligibleCampaigns = useMemo(() => campaigns.filter((campaign) => category === 'hostess'
    ? campaign.campaign_type === 'hostess'
    : campaign.campaign_type === 'brand_ambassador'), [campaigns, category]);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    void getCampaigns()
      .then((rows) => {
        if (!mounted) return;
        setCampaigns(rows);
        const defaultCode = category === 'brand_ambassador' ? 'merchant-educational-campaign' : 'vodacom-privilege';
        setSelectedCampaignIds(rows.filter((campaign) => campaign.code === defaultCode).map((campaign) => campaign.id));
      })
      .catch(() => setCampaigns([]));
    return () => { mounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== 'assign' || !existingAgentId) return;
    let mounted = true;
    void getCampaignsForUser(existingAgentId)
      .then((activeCampaigns) => {
        if (mounted) setSelectedCampaignIds(activeCampaigns.map((campaign) => campaign.id));
      })
      .catch(() => {
        if (mounted) setSelectedCampaignIds([]);
      });
    return () => { mounted = false; };
  }, [existingAgentId, isOpen, mode]);

  if (!isOpen) return null;

  const setUserCategory = (nextCategory: UserCategory) => {
    setCategory(nextCategory);
    const preferredCode = nextCategory === 'brand_ambassador' ? 'merchant-educational-campaign' : 'vodacom-privilege';
    setSelectedCampaignIds(campaigns.filter((campaign) => campaign.code === preferredCode).map((campaign) => campaign.id));
  };

  const toggleCampaign = (campaignId: string) => {
    setSelectedCampaignIds((previous) => previous.includes(campaignId)
      ? previous.filter((id) => id !== campaignId)
      : [...previous, campaignId]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'assign') {
      if (!selectedAgent) {
        setError('Sélectionnez un agent existant.');
        return;
      }
      const allowed = campaigns.filter((campaign) => selectedAgent.userCategory === 'hostess'
        ? campaign.campaign_type === 'hostess'
        : campaign.campaign_type === 'brand_ambassador');
      if (selectedCampaignIds.some((campaignId) => !allowed.some((campaign) => campaign.id === campaignId))) {
        setError('Cette catégorie ne peut pas être affectée à cette campagne.');
        return;
      }
    } else {
      if (!name || !phone) return;
      if (!isValidMsisdn(phone)) {
        setError('Format téléphone invalide : utilisez 081… (10 chiffres) ou +24381… (13 caractères).');
        return;
      }
      if (role === 'agent' && category === 'hostess' && !shopId) {
        setError('Sélectionnez la boutique permanente de cette hôtesse.');
        return;
      }
      if (role === 'agent' && selectedCampaignIds.length === 0) {
        setError('Affectez au moins une campagne à cet agent.');
        return;
      }
      if (role === 'agent' && selectedCampaignIds.some((campaignId) => !eligibleCampaigns.some((campaign) => campaign.id === campaignId))) {
        setError('Cette catégorie ne peut pas être affectée à cette campagne.');
        return;
      }
    }

    setSaving(true);
    setError('');
    const permanentShopId = category === 'hostess' ? shopId : role === 'agent' ? 'merchant-unassigned' : 'operations-hub';
    const userCategory: UserCategory = role === 'agent' ? category : 'operations';

    try {
      if (mode === 'assign') {
        await Promise.all(campaigns.map((campaign) => setUserCampaignAssignment({
          userId: selectedAgent!.id,
          campaignId: campaign.id,
          isActive: selectedCampaignIds.includes(campaign.id),
        })));
        setExistingAgentId('');
        setSelectedCampaignIds([]);
        setMode('create');
        onSuccess();
        onClose();
        return;
      }

      const normalizedPhone = formatMsisdn(cleanPhoneNumber(phone));
      const createdUser = saveUser({
        name,
        phone: normalizedPhone,
        role,
        supervisorId: role === 'agent' ? supervisorId || undefined : undefined,
        permanentShopId,
        password,
        userCategory,
      });
      await syncLocalDataToSupabase({ users: [createdUser] });
      if (role === 'agent') await assignUserToCampaigns(createdUser.id, selectedCampaignIds);

      setName('');
      setPhone('');
      setRole('agent');
      setCategory('hostess');
      setSupervisorId('');
      setShopId('');
      setPassword('vodacom123');
      setExistingAgentId('');
      setMode('create');
      setSelectedCampaignIds(campaigns.filter((campaign) => campaign.code === 'vodacom-privilege').map((campaign) => campaign.id));
      onSuccess();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La création du compte a échoué.');
    } finally {
      setSaving(false);
    }
  };

  const campaignOptions = mode === 'assign'
    ? campaigns.filter((campaign) => selectedAgent?.userCategory === 'hostess'
      ? campaign.campaign_type === 'hostess'
      : campaign.campaign_type === 'brand_ambassador')
    : eligibleCampaigns;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop" onClick={onClose}>
      <div className="modal-sheet relative w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black uppercase text-red-500 tracking-wider">Gestion des agents</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Créer un compte ou gérer ses campagnes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            <button type="button" onClick={() => { setMode('create'); setError(''); }} className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase transition-all ${mode === 'create' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Créer un agent</button>
            <button type="button" onClick={() => { setMode('assign'); setError(''); setName(''); setPhone(''); }} className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase transition-all ${mode === 'assign' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Affecter un agent</button>
          </div>

          {mode === 'assign' ? (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Agent existant</label>
                <select value={existingAgentId} onChange={(event) => {
                  setExistingAgentId(event.target.value);
                  setSelectedCampaignIds([]);
                }} className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500">
                  <option value="">-- Choisir un agent --</option>
                  {existingAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.phone} · {agent.userCategory === 'hostess' ? 'Hôtesse' : 'BA'}</option>)}
                </select>
              </div>

              <fieldset>
                <legend className="text-[10px] font-black uppercase text-gray-400 block mb-2">Campagnes de l’agent</legend>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  {campaignOptions.length === 0 ? (
                    <p className="text-xs text-gray-500">Sélectionnez d’abord un agent.</p>
                  ) : campaignOptions.map((campaign) => (
                    <label key={campaign.id} className="flex items-center gap-3 text-sm text-gray-200 cursor-pointer">
                      <input type="checkbox" checked={selectedCampaignIds.includes(campaign.id)} onChange={() => toggleCampaign(campaign.id)} className="accent-red-500 h-4 w-4" />
                      <span>{campaign.name}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-gray-500">Décochez une campagne pour retirer l’agent de son périmètre. Son historique reste conservé.</p>
              </fieldset>
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Nom Complet</label>
                <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Sarah Kabedi" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">MSISDN (Téléphone)</label>
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0813333333 ou +243813333333" required className={`w-full rounded-2xl border px-4 py-3 text-sm text-white focus:outline-none ${phone && !isValidMsisdn(phone) ? 'border-amber-400/70 bg-amber-500/5 focus:border-amber-300' : 'border-white/10 bg-white/5 focus:border-red-500'}`} />
                <p className="mt-1 text-[10px] text-gray-500">Formats acceptés : 081… (10 chiffres) ou +24381… (13 caractères).</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Rôle</label>
                  <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500">
                    <option value="agent">Agent</option>
                    <option value="supervisor">Superviseur</option>
                    <option value="sub_admin">Sous-admin</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                {role === 'agent' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Catégorie</label>
                    <select value={category} onChange={(event) => setUserCategory(event.target.value as UserCategory)} className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500">
                      <option value="hostess">Hôtesse</option>
                      <option value="brand_ambassador">Brand Ambassador</option>
                    </select>
                  </div>
                )}
              </div>

              {role === 'agent' && category === 'hostess' && (
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Shop Affectation</label>
                  <select value={shopId} onChange={(event) => setShopId(event.target.value)} required className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500">
                    <option value="">-- Sélectionner Shop --</option>
                    {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
                  </select>
                </div>
              )}

              {role === 'agent' && (
                <fieldset>
                  <legend className="text-[10px] font-black uppercase text-gray-400 block mb-2">Campagnes de travail</legend>
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    {eligibleCampaigns.map((campaign) => (
                      <label key={campaign.id} className="flex items-center gap-3 text-sm text-gray-200 cursor-pointer">
                        <input type="checkbox" checked={selectedCampaignIds.includes(campaign.id)} onChange={() => toggleCampaign(campaign.id)} className="accent-red-500 h-4 w-4" />
                        <span>{campaign.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {role === 'agent' && supervisorId !== '' && (
                <div className="text-xs text-gray-500">Superviseur sélectionné : {supervisors.find((user) => user.id === supervisorId)?.name || '—'}</div>
              )}
            </>
          )}

          {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-300">{error}</div>}

          <button type="submit" disabled={saving} className="w-full rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-3 text-xs font-black uppercase text-white transition-colors">
            {saving ? 'Enregistrement…' : mode === 'assign' ? 'Enregistrer les affectations' : 'Créer l’agent'}
          </button>
        </form>
      </div>
    </div>
  );
};
