import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, NotificationItem, CampaignContext } from '../types';
import { Bell, LogOut, Shield, RefreshCw, UserRound, Camera, X, Banknote, Volume2, VolumeX, Flag, ChevronDown, CalendarDays, Eye, Palette } from 'lucide-react';
import { addCheckin, getShopById, resolveStoredPhotoUrl } from '../utils/storage';
import { armFundRequestAlertAudio, getNotificationsMuted, setNotificationsMuted } from '../utils/fundRequestAlert';
import { publicUrl } from '../utils/assets';

export type { ThemeMode } from '../utils/themes';
import { isLightTheme, type ThemeMode } from '../utils/themes';

interface HeaderProps {
  user: User;
  notifications: NotificationItem[];
  unreadChatCount?: number;
  online?: boolean;
  syncPendingCount?: number;
  profilePhotoUrl?: string;
  onMarkNotifsRead: () => void;
  onClearNotifications?: () => void;
  onLogout: () => void;
  onOpenPasswordModal: () => void;
  onRefreshData?: () => void;
  onPointageRecorded?: () => void;
  theme?: ThemeMode;
  onSetTheme?: (theme: ThemeMode) => void;
  activeCampaign?: CampaignContext;
  onSetCampaign?: (campaign: CampaignContext) => void;
  campaignOptions?: Array<{ key: CampaignContext; label: string; note: string }>;
  allowCheckin?: boolean;
  checkinUnavailableLabel?: string;
  fundRequestAlerts?: Array<{ id: string; baName: string; amount: number; posLabel: string; requestedAt: string }>;
  onOpenFundRequest?: (id: string) => void;
  /** Ouvre l'onglet Thèmes (accessible même avant le pointage, quand la barre est masquée). */
  onOpenThemes?: () => void;
  /** Super-admin : lecture, pause et arrêt de la campagne, à droite du sélecteur. */
  campaignControls?: React.ReactNode;
  /** Super-admin : raccourcis et sélecteur de simulation affichés dans le menu du compte. */
  simulation?: {
    shortcuts: Array<{ key: string; label: string; targetId?: string; active: boolean }>;
    onSimulate: (userId: string) => void;
    onOpenPicker: () => void;
  };
}

export const Header: React.FC<HeaderProps> = ({
  user,
  notifications,
  unreadChatCount = 0,
  online = true,
  syncPendingCount = 0,
  profilePhotoUrl,
  onMarkNotifsRead,
  onClearNotifications,
  onLogout,
  onOpenPasswordModal,
  onRefreshData,
  onPointageRecorded,
  theme = 'anthracite',
  onSetTheme,
  activeCampaign = 'vodacom-privilege',
  onSetCampaign,
  campaignOptions,
  allowCheckin = true,
  checkinUnavailableLabel = 'Pointage indisponible pendant la pause de campagne',
  fundRequestAlerts = [],
  onOpenFundRequest,
  onOpenThemes,
  campaignControls,
  simulation
}) => {
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showCampaignMenu, setShowCampaignMenu] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(profilePhotoUrl || '');
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [isPointagePending, setIsPointagePending] = useState(false);
  const [notificationsMuted, setNotificationsMutedState] = useState(() => getNotificationsMuted(user.id));
  const pointageInputRef = useRef<HTMLInputElement | null>(null);
  const photoSrc = useMemo(() => {
    const source = localPhotoUrl || profilePhotoUrl || '';
    return source && !photoError ? resolveStoredPhotoUrl(source) : '';
  }, [localPhotoUrl, profilePhotoUrl, photoError]);
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter(n => !n.is_read).length + fundRequestAlerts.length;
  const roleLabel = user.role === 'super_admin'
    ? 'Super-admin'
    : (user.role === 'admin' ? 'Admin' : (user.role === 'sub_admin' ? 'Ops' : (user.role === 'supervisor' ? 'Superviseur' : 'Agent')));
  const topbarOverlay = isLightTheme(theme)
    ? 'linear-gradient(100deg, rgba(255,255,255,0.96), rgba(246,244,241,0.84), rgba(255,255,255,0.90))'
    : 'linear-gradient(100deg, rgba(5,7,12,0.68), rgba(10,14,22,0.34), rgba(8,10,17,0.56))';
  const topbarStyle = { backgroundImage: `${topbarOverlay}, url(${publicUrl(`topbar-backgrounds/${theme}-gem.jpg`)})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  // Les surfaces de l'en-tête suivent toutes la matière (variables CSS) ; Diamond compris, les classes « sombres » servent de base.
  const isDarkTheme = true;
  const visibleCampaigns = campaignOptions || [
    { key: 'vodacom-privilege' as const, label: 'Vodacom Privilège', note: 'Hôtesses' },
    { key: 'merchant-educational' as const, label: 'Merchant Education', note: 'Brand Ambassadors' },
    { key: 'youth-f2f' as const, label: 'Youth F2F', note: 'Sensibilisation terrain' },
    { key: 'mpesa-mikili' as const, label: 'M-Pesa Mikili', note: 'Brand Ambassador · M-Pesa' },
  ];
  const syncState: 'ok' | 'progress' | 'late' = (() => {
    if (online && syncPendingCount === 0) return 'ok';
    if (online && syncPendingCount > 0) return 'progress';
    if (!online && syncPendingCount > 0) return 'late';
    return 'progress';
  })();

  useEffect(() => {
    setLocalPhotoUrl(profilePhotoUrl || '');
    setPhotoError(false);
  }, [profilePhotoUrl]);

  useEffect(() => {
    setNotificationsMutedState(getNotificationsMuted(user.id));
    const handleMuteChange = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; muted?: boolean }>).detail;
      if (detail?.userId === user.id) setNotificationsMutedState(Boolean(detail.muted));
    };
    window.addEventListener('btl-notifications-muted-change', handleMuteChange);
    return () => window.removeEventListener('btl-notifications-muted-change', handleMuteChange);
  }, [user.id]);

  useEffect(() => {
    if (!showNotifPanel && !showThemeMenu && !showCampaignMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Le menu Campagne se trouve à gauche des actions de l’en-tête. Sans
      // cette garde, son option est fermée au mousedown avant que son click
      // puisse appliquer le changement de campagne.
      if (target.closest('[data-header-actions], [data-campaign-selector]')) return;
      setShowNotifPanel(false);
      setShowThemeMenu(false);
      setShowCampaignMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifPanel, showThemeMenu, showCampaignMenu]);

  const openNotifications = () => {
    const opening = !showNotifPanel;
    setShowNotifPanel(opening);
    if (opening && !notificationsMuted) {
      void armFundRequestAlertAudio();
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    }
  };

  const handlePointageCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isPointagePending || !allowCheckin) return;

    setIsPointagePending(true);
    const shopObj = getShopById(user.permanentShopId);
    const finalize = (lat: number, long: number, accuracy: number, base64: string) => {
      addCheckin({
        agent_id: user.id,
        type: 'IN',
        timestamp: new Date().toISOString(),
        lat,
        long,
        accuracy,
        photo: base64,
        geo_status: 'conforme',
        status: 'pending'
      });
      setLocalPhotoUrl(base64);
      setPhotoError(false);
      setIsPointagePending(false);
      onPointageRecorded?.();
    };

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 320;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) { h *= maxDim / w; w = maxDim; }
        } else if (h > maxDim) {
          w *= maxDim / h; h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.45);
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => finalize(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy || 5), base64),
              () => finalize(shopObj?.lat || -4.3033, shopObj?.long || 15.3015, 15, base64),
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
          } else {
            finalize(shopObj?.lat || -4.3033, shopObj?.long || 15.3015, 15, base64);
          }
        } else {
          setIsPointagePending(false);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const syncDotClass = syncState === 'ok'
    ? 'bg-emerald-500 shadow-emerald-500/60'
    : (syncState === 'progress' ? 'bg-amber-400 shadow-amber-400/60' : 'bg-red-500 shadow-red-500/60');
  const refreshBtnClass = syncState === 'ok'
    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-500'
    : (syncState === 'progress' ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-500' : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/40 text-red-500');

  return (
    <header style={topbarStyle} className={`app-header px-3 sm:px-6 py-2.5 backdrop-blur-md border-b shrink-0 relative z-40 transition-colors ${
      isDarkTheme
        ? 'border-white/10 text-white'
        : 'border-zinc-200 text-zinc-900 shadow-xl'
    }`}>
      {/* Gauche : photo de pointage (si disponible) et nom ; centre : campagne ; droite : actions. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {photoSrc && (
            <button
              type="button"
              onClick={() => setIsPhotoViewerOpen(true)}
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[var(--m-accent)]"
              aria-label="Ouvrir la photo de pointage en plein écran"
            >
              <img
                src={photoSrc}
                alt="Photo pointage"
                className="h-full w-full object-cover object-center"
                onError={(e) => {
                  setPhotoError(true);
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </button>
          )}
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`status-dot h-2 w-2 shrink-0 ${online ? 'status-online' : 'status-offline'}`} aria-label={online ? 'En ligne' : 'Hors ligne'} />
            <span className="truncate text-sm font-bold text-[var(--m-text)]" title={user.name}>{user.name}</span>
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5">
            {onSetCampaign && visibleCampaigns.length > 1 && (
              <div className="relative" data-campaign-selector>
                <button
                  type="button"
                  onClick={() => setShowCampaignMenu((prev) => !prev)}
                  className="inline-flex h-10 max-w-[9.5rem] items-center gap-1.5 sm:max-w-[13rem] rounded-xl border border-[var(--m-edge-soft)] bg-[var(--m-tile)] px-3 text-sm font-bold text-[var(--m-text)] lg:max-w-none"
                  aria-haspopup="menu"
                  aria-expanded={showCampaignMenu}
                  title="Changer de campagne"
                  aria-label="Changer de campagne"
                >
                  <Flag className="h-4 w-4 shrink-0 text-[var(--m-accent)]" aria-hidden="true" />
                  <span className="truncate">{visibleCampaigns.find((campaign) => campaign.key === activeCampaign)?.label || 'Campagne'}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showCampaignMenu ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {showCampaignMenu && (
                  <div className={`app-popover absolute left-1/2 top-12 -ml-[7.5rem] w-60 border rounded-2xl p-1.5 shadow-2xl z-50 ${
                    isDarkTheme ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                  }`}>
                    {visibleCampaigns.map((campaign) => (
                      <button
                        key={campaign.key}
                        onClick={() => { onSetCampaign(campaign.key); setShowCampaignMenu(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition ${
                          activeCampaign === campaign.key ? 'bg-red-600 text-white' : (isDarkTheme ? 'hover:bg-white/10 text-gray-100' : 'hover:bg-zinc-100 text-zinc-700')
                        }`}
                      >
                        <span className="block text-xs font-black uppercase">{campaign.label}</span>
                        <span className="block mt-0.5 text-[0.6875rem] font-bold opacity-70">{campaign.note}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          {!(onSetCampaign && visibleCampaigns.length > 1) && visibleCampaigns.find((campaign) => campaign.key === activeCampaign)?.label && (
            <span className="inline-flex h-10 max-w-[9.5rem] items-center gap-1.5 rounded-xl border border-[var(--m-edge-soft)] bg-[var(--m-tile)] px-3 text-sm font-bold text-[var(--m-text)] sm:max-w-[13rem]">
              <Flag className="h-4 w-4 shrink-0 text-[var(--m-accent)]" aria-hidden="true" />
              <span className="truncate">{visibleCampaigns.find((campaign) => campaign.key === activeCampaign)?.label}</span>
            </span>
          )}
          {campaignControls}
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0" data-header-actions>
          <span className="hidden h-10 items-center gap-2 rounded-xl border border-[var(--m-edge-soft)] bg-[var(--m-tile)] px-3 text-sm font-bold text-[var(--m-text)] lg:inline-flex">
            <CalendarDays className="h-4 w-4 text-[var(--m-accent)]" aria-hidden="true" />
            {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Africa/Kinshasa' })}
          </span>
          {/* Actualisation des données pour les comptes non super_admin */}
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className={`p-2 border rounded-xl transition shadow-sm ${refreshBtnClass}`}
              title="Actualiser les données"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
              onClick={() => {
                openNotifications();
                if (!showNotifPanel && unreadCount > 0) {
                  onMarkNotifsRead();
                }
              }}
              className={`app-icon-button w-10 h-10 rounded-xl border flex items-center justify-center transition relative ${
                isDarkTheme
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-[0.75rem] font-black flex items-center justify-center border-2 border-black animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Panel */}
            {showNotifPanel && (
              <div className={`app-popover absolute -right-12 sm:right-0 top-12 w-[min(20rem,calc(100vw-1.5rem))] border p-3 shadow-2xl z-50 ${
                isDarkTheme ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
              }`}>
                <div className="flex items-center justify-between gap-2 px-1 pb-2">
                  <span className="text-sm font-bold text-[var(--m-text)]">Alertes</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onClearNotifications) onClearNotifications();
                      else onMarkNotifsRead();
                    }}
                    className="text-sm font-semibold text-[var(--m-accent)]"
                  >
                    Tout effacer
                  </button>
                </div>
                <label className="mb-2 flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-[var(--m-edge-soft)] px-1 pb-2 text-sm font-semibold text-[var(--m-text)]">
                  {notificationsMuted ? <VolumeX size={16} aria-hidden="true"/> : <Volume2 size={16} aria-hidden="true"/>}
                  Son des alertes
                  <input
                    type="checkbox"
                    className="ml-auto"
                    checked={!notificationsMuted}
                    onChange={() => setNotificationsMuted(user.id, !notificationsMuted)}
                  />
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {safeNotifications.length === 0 && fundRequestAlerts.length === 0 ? (
                    <p className="text-center text-xs text-gray-500 italic py-4">Aucune notification.</p>
                  ) : (
                    <>
                      {fundRequestAlerts.map((request) => <button key={`fund-${request.id}`} type="button" onClick={() => { onOpenFundRequest?.(request.id); setShowNotifPanel(false); }} className="w-full rounded-xl border border-emerald-300/30 bg-emerald-500/[0.10] p-3 text-left text-xs transition hover:bg-emerald-500/[0.18]"><span className="flex items-start gap-2"><Banknote size={15} className="mt-0.5 shrink-0 text-emerald-200"/><span><b className="block text-emerald-50">Nouvelle demande de fonds</b><span className="mt-1 block text-[0.75rem] text-emerald-100/75">{request.baName} · ${Number(request.amount).toLocaleString('fr-FR')} · {request.posLabel}</span><span className="mt-1 block text-[0.6875rem] text-gray-400">Ouvrir le traitement</span></span></span></button>)}
                      {safeNotifications.map(n => (
                        <div key={n.id} className="p-3 bg-red-500/10 border-l-4 border-red-600 rounded-xl text-xs font-semibold">
                          {n.message}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Menu compte : thème, sécurité, déconnexion (regroupés pour libérer la place du nom) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowThemeMenu((prev) => !prev); setShowCampaignMenu(false); setShowNotifPanel(false); }}
              className={`app-icon-button relative w-10 h-10 rounded-full border flex items-center justify-center transition ${
                isDarkTheme ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
              }`}
              aria-label="Menu du compte"
              aria-haspopup="menu"
              aria-expanded={showThemeMenu}
              title="Menu du compte"
            >
              <UserRound className="w-5 h-5" />
              <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--m-sheet)] ${syncDotClass}`} aria-hidden="true" />
            </button>
            {showThemeMenu && (
              <div role="menu" className={`app-popover absolute right-0 top-12 w-64 border rounded-2xl p-2 shadow-2xl z-50 ${
                isDarkTheme ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
              }`}>
                <div className="border-b border-[var(--m-edge-soft)] px-3 pb-2.5 pt-1.5">
                  <p className="truncate text-sm font-bold text-[var(--m-text)]">{user.name}</p>
                  <p className="truncate text-xs text-[var(--m-text-2)]">{roleLabel}</p>
                </div>
                {simulation && (
                  <div className="border-b border-[var(--m-edge-soft)] px-2 pb-2.5 pt-2">
                    <p className="mb-2 px-1 text-xs font-semibold text-[var(--m-text-2)]">Voir l’appli comme</p>
                    <div className="seg-control">
                      {simulation.shortcuts.map((shortcut) => (
                        <button key={shortcut.key} type="button" disabled={!shortcut.targetId} aria-pressed={shortcut.active} onClick={() => { if (shortcut.targetId) { simulation.onSimulate(shortcut.targetId); setShowThemeMenu(false); } }}>{shortcut.label}</button>
                      ))}
                    </div>
                    <button type="button" role="menuitem" onClick={() => { setShowThemeMenu(false); simulation.onOpenPicker(); }} className="mt-1.5 flex min-h-[40px] w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-semibold text-[var(--m-text)] hover:bg-[var(--m-tile)]">
                      <Eye className="h-4 w-4" aria-hidden="true" /> Autre compte…
                    </button>
                  </div>
                )}
                {onOpenThemes && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setShowThemeMenu(false); onOpenThemes(); }}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition hover:bg-[var(--m-tile)]"
                  >
                    <Palette className="w-4 h-4" aria-hidden="true" /> Thèmes
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowThemeMenu(false); onOpenPasswordModal(); }}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition ${isDarkTheme ? 'hover:bg-white/10' : 'hover:bg-zinc-100'}`}
                >
                  <Shield className="w-4 h-4" aria-hidden="true" /> Sécuriser mon accès
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowThemeMenu(false); onLogout(); }}
                  className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-red-400 transition hover:bg-red-600/15"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPhotoViewerOpen && photoSrc && createPortal(
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={() => setIsPhotoViewerOpen(false)}>
          <button
            type="button"
            onClick={() => setIsPhotoViewerOpen(false)}
            className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[0.6875rem] font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/20"
          >
            Fermer
          </button>
          <div className="max-h-[92vh] max-w-[96vw] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_30px_120px_rgba(0,0,0,0.75)]" onClick={(event) => event.stopPropagation()}>
            <img src={photoSrc} alt={`Photo de pointage pleine écran ${user.name}`} className="max-h-[92vh] max-w-[96vw] object-contain" />
          </div>
          <button
            type="button"
            onClick={() => setIsPhotoViewerOpen(false)}
            className="absolute left-4 top-4 rounded-full border border-white/15 bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>,
        document.body
      )}
    </header>
  );
};
