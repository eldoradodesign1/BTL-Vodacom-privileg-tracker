import React, { useEffect, useMemo, useState } from 'react';
import { Campaign, Shop, UserCategory, UserRole } from '../../types';
import { saveUser, getUsers } from '../../utils/storage';
import { syncLocalDataToSupabase } from '../../utils/supabase';
import { assignUserToCampaigns, getCampaigns } from '../../utils/merchantCampaign';
import { UserPlus, X } from 'lucide-react';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const supervisors = useMemo(() => getUsers().filter((user) => user.role === 'supervisor' || user.role === 'admin'), []);

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
    if (!name || !phone) return;
    if (role === 'agent' && category === 'hostess' && !shopId) {
      setError('Sélectionnez la boutique permanente de cette hôtesse.');
      return;
    }
    if (role === 'agent' && selectedCampaignIds.length === 0) {
      setError('Affectez au moins une campagne à cet agent.');
      return;
    }

    setSaving(true);
    setError('');
    const permanentShopId = category === 'hostess' ? shopId : role === 'agent' ? 'merchant-unassigned' : 'operations-hub';
    const userCategory: UserCategory = role === 'agent' ? category : 'operations';

    try {
      const createdUser = saveUser({
        name,
        phone,
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
      setSelectedCampaignIds(campaigns.filter((campaign) => campaign.code === 'vodacom-privilege').map((campaign) => campaign.id));
      onSuccess();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La création du compte a échoué.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop" onClick={onClose}>
      <div className="modal-sheet relative w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black uppercase text-red-500 tracking-wider">Nouvel Utilisateur</h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">Compte, catégorie et campagnes de travail</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Nom Complet</label>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Sarah Kabedi" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500" />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">MSISDN (Téléphone)</label>
            <input type="text" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ex: 0813333333" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Rôle</label>
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500">
                <option value="agent">Agent</option>
                <option value="supervisor">Superviseur</option>
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
                {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name} ({shop.city})</option>)}
              </select>
            </div>
          )}

          {role === 'agent' && (
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Superviseur Rattaché</label>
              <select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs focus:outline-none focus:border-red-500">
                <option value="">-- Choisir Superviseur --</option>
                {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
              </select>
            </div>
          )}

          {role === 'agent' ? (
            <fieldset>
              <legend className="text-[10px] font-black uppercase text-gray-400 block mb-2">Campagne(s) affectée(s)</legend>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                {campaigns.map((campaign) => (
                  <label key={campaign.id} className="flex items-center gap-3 text-sm text-gray-200 cursor-pointer">
                    <input type="checkbox" checked={selectedCampaignIds.includes(campaign.id)} onChange={() => toggleCampaign(campaign.id)} className="accent-red-500 h-4 w-4" />
                    <span>{campaign.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-gray-500">Un agent affecté à plusieurs campagnes choisira sa campagne après connexion.</p>
            </fieldset>
          ) : (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-[10px] text-emerald-200">Les administrateurs et superviseurs accèdent à toutes les campagnes depuis le header.</div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500" />
          </div>

          {error && <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</div>}

          <button type="submit" disabled={saving} className="btn-neon btn-red w-full mt-6"><UserPlus className="w-4 h-4" /><span>{saving ? 'CRÉATION…' : 'Créer l’utilisateur'}</span></button>
        </form>
      </div>
    </div>
  );
};
