import React, { useState } from 'react';
import { ChevronRight, Eye, EyeOff, Lock, Phone, Trash2 } from 'lucide-react';
import { User, Campaign, CampaignContext } from '../types';
import { authenticate, getSyncPendingCount, purgeAndResetEverything, refreshUsersFromSupabase } from '../utils/storage';
import { getCampaignsForUser } from '../utils/merchantCampaign';
import { confirmAction } from '../utils/confirmDialog';

interface LoginScreenProps {
  onLoginSuccess: (user: User, campaign?: CampaignContext) => void;
}

const toCampaignContext = (campaign?: Campaign | null): CampaignContext => {
  const code = (campaign?.code || '').trim().toLowerCase().replace(/_/g, '-');
  if (code === 'youth-f2f' || code === 'youth-f2f-campaign') return 'youth-f2f';
  if (code === 'mpesa-mikili' || code === 'm-pesa-mikili' || code === 'mpesa-mikili-campaign') return 'mpesa-mikili';
  if (code === 'vodacom-supplier-forum' || code === 'vodacom-supplier-forum-sept-2026' || code === 'supplier-forum') return 'vodacom-supplier-forum';
  if (code === 'vodacom-fondation-inauguration-forage-2026' || code === 'vodacom-foundation-forage' || code === 'foundation-forage') return 'vodacom-foundation-forage';
  if (code === 'long-service-award-2026' || code === 'long-service-award') return 'long-service-award';
  if (code === 'formation-kadea-ia') return 'formation-kadea-ia';
  return campaign?.campaign_type === 'brand_ambassador' || code === 'merchant-educational' || code === 'merchant-educational-campaign'
    ? 'merchant-educational'
    : 'vodacom-privilege';
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  const finishLogin = (user: User, campaign?: Campaign | null) => {
    // Pour les comptes de gestion (admin/superviseur), l'absence de campagne
    // signifie "ne pas modifier le contexte déjà mémorisé" — surtout pas
    // revenir automatiquement à Vodacom Privilège.
    if (campaign === undefined) {
      onLoginSuccess(user);
      return;
    }
    onLoginSuccess(user, toCampaignContext(campaign));
  };

  const determineCampaign = async (user: User) => {
    if (user.role !== 'agent') {
      finishLogin(user);
      return;
    }

    try {
      const campaigns = await getCampaignsForUser(user.id);
      if (campaigns.length > 1) {
        setPendingUser(user);
        setAvailableCampaigns(campaigns);
        setSelectedCampaignId(campaigns[0].id);
        return;
      }
      finishLogin(user, campaigns[0]);
    } catch {
      // The legacy Vodacom connection remains available when the campaign lookup is offline.
      finishLogin(user, user.userCategory === 'brand_ambassador'
        ? { campaign_type: 'brand_ambassador', code: 'merchant-educational-campaign' } as Campaign
        : null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneValue = (e.currentTarget as HTMLFormElement).elements.namedItem('phone') as HTMLInputElement | null;
    const passwordValue = (e.currentTarget as HTMLFormElement).elements.namedItem('password') as HTMLInputElement | null;
    const enteredPhone = (phoneValue?.value || phone || '').trim();
    const enteredPassword = (passwordValue?.value || password || '').trim();

    setLoading(true);
    setError('');

    try {
      // Délai maximum : sur réseau lent, on bascule sur les comptes déjà en cache plutôt que de bloquer l'écran.
      await Promise.race([refreshUsersFromSupabase(), new Promise<void>((resolve) => window.setTimeout(resolve, 4000))]);
      const result = authenticate(enteredPhone, enteredPassword);
      if (result.success && result.user) {
        await determineCampaign(result.user);
      } else {
        setError(result.message || 'Identifiants incorrects.');
      }
    } catch {
      const result = authenticate(enteredPhone, enteredPassword);
      if (result.success && result.user) {
        await determineCampaign(result.user);
      } else {
        setError(result.message || 'Identifiants incorrects.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  if (pendingUser) {
    return (
      <div className="login-shell w-full flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="login-panel w-full glass-card border relative z-10 animate-pop">
          <div className="text-center mb-7">
            <div className="brand-text text-3xl font-black tracking-tighter mb-1">CHOISIR LA CAMPAGNE</div>
            <p className="text-xs font-semibold text-gray-400">Bienvenue {pendingUser.name.split(' ')[0]}. Sélectionnez l’espace de travail souhaité.</p>
          </div>

          <label className="text-[0.75rem] font-black uppercase tracking-wider text-gray-400 block mb-2">Campagne active</label>
          <select aria-label="Campagne active"
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="app-input w-full border rounded-2xl px-4 py-3.5 text-white text-sm font-semibold focus:outline-none"
          >
            {availableCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => finishLogin(pendingUser, availableCampaigns.find((campaign) => campaign.id === selectedCampaignId))}
            className="btn-neon btn-red w-full mt-5 flex items-center justify-center gap-2"
          >
            <span>ENTRER DANS LA CAMPAGNE</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { setPendingUser(null); setAvailableCampaigns([]); }}
            className="w-full mt-4 text-[0.75rem] font-bold text-gray-500 hover:text-red-400 uppercase tracking-wider"
          >
            Utiliser un autre compte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell w-full flex flex-col justify-center items-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="login-panel w-full glass-card border relative z-10 animate-pop">
        <div className="text-center mb-8">
          <div className="brand-text text-3xl sm:text-4xl font-black tracking-tighter mb-1">BEYOND THE LINE</div>
          <div className="login-eyebrow btl-keep-small text-[0.6875rem] font-black uppercase">Deployment tracker · by Eldo</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="phone" className="text-[0.75rem] font-black uppercase tracking-wider text-gray-300 flex items-center space-x-1">
              <Phone className="w-3 h-3 text-red-500" />
              <span>Identifiant Réseau (MSISDN)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="username"
              autoCapitalize="none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={handleEnterSubmit}
              placeholder="081XXXXXXX"
              required
              className="app-input w-full border rounded-2xl px-4 py-3.5 text-white text-sm font-semibold focus:outline-none transition placeholder:text-gray-600"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-[0.75rem] font-black uppercase tracking-wider text-gray-300 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-red-500" />
              <span>Clé de Sécurité</span>
            </label>
            <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="app-input w-full pr-14 border rounded-2xl px-4 py-3.5 text-white text-sm font-semibold focus:outline-none transition placeholder:text-gray-600"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-gray-300 hover:text-white" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={showPassword}>{showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}</button>
          </div>
          </div>

          <div className="login-note rounded-2xl border px-4 py-3 text-[0.6875rem] font-semibold text-gray-400">
            Utilisez votre numéro de téléphone et votre mot de passe pour vous connecter.
          </div>

          <button type="submit" disabled={loading} className="btn-neon btn-red w-full mt-4 flex items-center justify-center space-x-2">
            <Lock className="w-4 h-4" />
            <span>{loading ? 'VÉRIFICATION...' : 'DÉVERROUILLER'}</span>
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-500/40 rounded-2xl text-red-400 text-center text-xs font-black uppercase">
            {error}
          </div>
        )}

        <div className="mt-6 pt-3 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={async () => {
              const pending = getSyncPendingCount();
              const warning = pending > 0
                ? `Attention : ${pending} saisie(s) ou pointage(s) ne sont pas encore envoyés et seront PERDUS. Reconnectez-vous au réseau et synchronisez avant de continuer.\n\nVider quand même le cache et réinitialiser les données ?`
                : 'Vider complètement le cache et réinitialiser les données ?';
              if (await confirmAction({ title: 'Vider le cache', message: warning, confirmLabel: 'Vider', tone: 'danger' })) {
                purgeAndResetEverything();
                window.location.reload();
              }
            }}
            className="inline-flex min-h-[44px] items-center space-x-1.5 px-3 text-[0.75rem] font-bold text-gray-400 hover:text-red-400 transition-colors uppercase tracking-wider"
          >
            <Trash2 className="w-3 h-3" />
            <span>Vider le cache système</span>
          </button>
        </div>
      </div>
    </div>
  );
};
