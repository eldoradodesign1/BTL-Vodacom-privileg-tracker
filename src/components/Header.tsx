import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, NotificationItem } from '../types';
import { Bell, LogOut, Shield, RefreshCw, Palette, Camera, X, BriefcaseBusiness, Banknote } from 'lucide-react';
import { addCheckin, getShopById, resolveStoredPhotoUrl } from '../utils/storage';
import { armFundRequestAlertAudio } from '../utils/fundRequestAlert';

export type ThemeMode = 'anthracite' | 'rubis' | 'silver' | 'diamond' | 'sapphire' | 'ambre';

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
  activeCampaign?: 'vodacom-privilege' | 'merchant-educational';
  onSetCampaign?: (campaign: 'vodacom-privilege' | 'merchant-educational') => void;
  campaignOptions?: Array<{ key: 'vodacom-privilege' | 'merchant-educational'; label: string; note: string }>;
  allowCheckin?: boolean;
  fundRequestAlerts?: Array<{ id: string; baName: string; amount: number; posLabel: string; requestedAt: string }>;
  onOpenFundRequest?: (id: string) => void;
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
  fundRequestAlerts = [],
  onOpenFundRequest
}) => {
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showCampaignMenu, setShowCampaignMenu] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(profilePhotoUrl || '');
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [isPointagePending, setIsPointagePending] = useState(false);
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
  const topbarOverlay = theme === 'diamond'
    ? 'linear-gradient(100deg, rgba(255,255,255,0.96), rgba(246,244,241,0.84), rgba(255,255,255,0.90))'
    : 'linear-gradient(100deg, rgba(5,7,12,0.68), rgba(10,14,22,0.34), rgba(8,10,17,0.56))';
  const topbarStyle = { backgroundImage: `${topbarOverlay}, url(/topbar-backgrounds/${theme}-gem.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' };
  const isDarkTheme = theme === 'anthracite' || theme === 'rubis' || theme === 'silver' || theme === 'diamond' || theme === 'sapphire' || theme === 'ambre';
  const visibleCampaigns = campaignOptions || [
    { key: 'vodacom-privilege' as const, label: 'Vodacom Privilège', note: 'Hôtesses' },
    { key: 'merchant-educational' as const, label: 'Merchant Education', note: 'Brand Ambassadors' },
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
    if (!showNotifPanel && !showThemeMenu && !showCampaignMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-header-actions]')) return;
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
    if (opening) {
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
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {/* Vodacom / Eldorado Badge */}
        <button
          type="button"
          onClick={() => {
            if (photoSrc) {
              setIsPhotoViewerOpen(true);
            } else if (user.role === 'agent') {
              pointageInputRef.current?.click();
            }
          }}
          disabled={isPointagePending || !allowCheckin}
          className={`relative w-11 h-11 bg-red-600 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-lg shadow-red-600/30 overflow-hidden shrink-0 border border-white/20 transition-transform ${photoSrc ? 'cursor-zoom-in hover:scale-[1.03]' : user.role === 'agent' ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default'} ${isPointagePending ? 'opacity-75' : ''}`}
          aria-label={photoSrc ? 'Ouvrir la photo de pointage en plein écran' : (allowCheckin ? 'Check-in en attente' : 'Pointage indisponible pendant la pause de campagne')}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt="Photo pointage"
              className="w-full h-full object-cover object-center"
              style={{ objectPosition: 'center center' }}
              onError={(e) => {
                setPhotoError(true);
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="px-1 text-[8px] font-black uppercase tracking-wide leading-[1.05] text-center">Check-in en attente</span>
          )}
          <span className={`status-dot absolute -bottom-0.5 -right-0.5 border-2 ${isDarkTheme ? 'border-black' : 'border-white'} ${online ? 'status-online' : 'status-offline'}`} />
        </button>
        <input
          ref={pointageInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handlePointageCapture}
          className="hidden"
        />

          <div className="flex flex-col min-w-0">
          <div className="flex items-center space-x-2">
              <span className="font-black text-sm sm:text-lg tracking-tight brand-text truncate">
              BTL Deployment Tracker
            </span>
          </div>
            <span className={`text-xs sm:text-sm font-black mt-0.5 px-2.5 py-1 rounded-full inline-flex items-center gap-2 w-fit max-w-full truncate ${
              isDarkTheme ? 'bg-white/10 text-red-100 border border-white/20' : 'bg-red-50 text-red-700 border border-red-200'
            }`} title={user.name}>
              <span className={`inline-block w-2.5 h-2.5 rounded-full shadow ${syncDotClass}`} />
              <span className="truncate">{roleLabel}: {user.name}</span>
            </span>
            <span className="hidden sm:inline text-[9px] text-zinc-400 font-bold tracking-wide uppercase opacity-80">
              Par <b className="text-red-500 font-black">Eldorado Design</b>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0" data-header-actions>
          {onSetCampaign && visibleCampaigns.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowCampaignMenu((prev) => !prev)}
                className={`app-icon-button p-2 rounded-xl border transition-all ${
                  isDarkTheme ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300' : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
                }`}
                title="Changer de campagne"
              >
                <BriefcaseBusiness className="w-4 h-4" />
              </button>
              {showCampaignMenu && (
                <div className={`app-popover absolute right-0 top-11 w-56 border rounded-2xl p-1.5 shadow-2xl z-50 ${
                  isDarkTheme ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                }`}>
                  {visibleCampaigns.map((campaign) => (
                    <button
                      key={campaign.key}
                      onClick={() => { onSetCampaign(campaign.key as 'vodacom-privilege' | 'merchant-educational'); setShowCampaignMenu(false); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                        activeCampaign === campaign.key ? 'bg-red-600 text-white' : (isDarkTheme ? 'hover:bg-white/10 text-gray-100' : 'hover:bg-zinc-100 text-zinc-700')
                      }`}
                    >
                      <span className="block text-xs font-black uppercase">{campaign.label}</span>
                      <span className="block mt-0.5 text-[9px] font-bold opacity-70">{campaign.note}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {onSetTheme && (
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(prev => !prev)}
                className={`app-icon-button p-2 rounded-xl border transition-all ${
                  isDarkTheme
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                    : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
                }`}
                title="Theme"
              >
                <Palette className="w-4 h-4" />
              </button>

              {showThemeMenu && (
                <div className={`app-popover absolute right-0 top-11 w-40 border rounded-2xl p-1.5 shadow-2xl z-50 ${
                  isDarkTheme ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                }`}>
                  {[
                    { key: 'anthracite', label: 'Anthracite' },
                    { key: 'rubis', label: 'Rubis' },
                    { key: 'silver', label: 'Silver' },
                    { key: 'diamond', label: 'Diamond' },
                    { key: 'sapphire', label: 'Sapphire' },
                    { key: 'ambre', label: 'Ambre' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        onSetTheme(opt.key as ThemeMode);
                        setShowThemeMenu(false);
      setShowCampaignMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                        theme === opt.key
                          ? 'bg-red-600 text-white'
                          : (isDarkTheme ? 'hover:bg-white/10 text-gray-100' : 'hover:bg-zinc-100 text-zinc-700')
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actualisation des données pour les comptes non super_admin */}
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className={`p-2 border rounded-xl transition-all shadow-sm ${refreshBtnClass}`}
              title="Actualiser les données"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Security Password Change */}
          <button
            onClick={onOpenPasswordModal}
            className={`app-icon-button p-2 rounded-xl border transition-all ${
              isDarkTheme
                ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
                : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
            }`}
            title="Sécuriser mon accès"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                openNotifications();
                if (!showNotifPanel && unreadCount > 0) {
                  onMarkNotifsRead();
                }
              }}
              className={`app-icon-button w-10 h-10 rounded-xl border flex items-center justify-center transition-all relative ${
                isDarkTheme
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-[10px] font-black flex items-center justify-center border-2 border-black animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Panel */}
            {showNotifPanel && (
              <div className={`app-popover absolute right-0 top-12 w-80 border rounded-3xl p-4 shadow-2xl z-50 animate-pop ${
                isDarkTheme ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
              }`}>
                <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                  <span className="text-xs font-black uppercase text-gray-400 tracking-wider">Alertes Internes</span>
                  <button
                    onClick={() => {
                      if (onClearNotifications) {
                        onClearNotifications();
                      } else {
                        onMarkNotifsRead();
                      }
                    }}
                    className="text-[9px] font-black uppercase text-red-500 hover:text-red-400"
                  >
                    Effacer
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {safeNotifications.length === 0 && fundRequestAlerts.length === 0 ? (
                    <p className="text-center text-xs text-gray-500 italic py-4">Aucune notification.</p>
                  ) : (
                    <>
                      {fundRequestAlerts.map((request) => <button key={`fund-${request.id}`} type="button" onClick={() => { onOpenFundRequest?.(request.id); setShowNotifPanel(false); }} className="w-full rounded-xl border border-emerald-300/30 bg-emerald-500/[0.10] p-3 text-left text-xs transition hover:bg-emerald-500/[0.18]"><span className="flex items-start gap-2"><Banknote size={15} className="mt-0.5 shrink-0 text-emerald-200"/><span><b className="block text-emerald-50">Nouvelle demande de fonds</b><span className="mt-1 block text-[10px] text-emerald-100/75">{request.baName} · ${Number(request.amount).toLocaleString('fr-FR')} · {request.posLabel}</span><span className="mt-1 block text-[9px] text-gray-400">Ouvrir le traitement</span></span></span></button>)}
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

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-10 h-10 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-xl transition-all flex items-center justify-center"
            title="Quitter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isPhotoViewerOpen && photoSrc && createPortal(
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={() => setIsPhotoViewerOpen(false)}>
          <button
            type="button"
            onClick={() => setIsPhotoViewerOpen(false)}
            className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/20"
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
