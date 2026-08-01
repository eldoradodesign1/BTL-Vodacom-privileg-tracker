import React, { useState } from 'react';
import { User, NotificationItem } from '../types';
import { Bell, LogOut, Shield, FileSpreadsheet, Palette } from 'lucide-react';

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
  onOpenGSheetModal?: () => void;
  theme?: 'classic' | 'dark' | 'light';
  onSetTheme?: (theme: 'classic' | 'dark' | 'light') => void;
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
  onOpenGSheetModal,
  theme = 'classic',
  onSetTheme
}) => {
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length + unreadChatCount;
  const roleLabel = user.role === 'admin' ? 'Admin' : (user.role === 'supervisor' ? 'Superviseur' : 'Agent');
  const syncState: 'ok' | 'progress' | 'late' = (() => {
    if (online && syncPendingCount === 0) return 'ok';
    if (online && syncPendingCount > 0) return 'progress';
    if (!online && syncPendingCount > 0) return 'late';
    return 'progress';
  })();

  const syncDotClass = syncState === 'ok'
    ? 'bg-emerald-500 shadow-emerald-500/60'
    : (syncState === 'progress' ? 'bg-amber-400 shadow-amber-400/60' : 'bg-red-500 shadow-red-500/60');
  const gsheetBtnClass = syncState === 'ok'
    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-500'
    : (syncState === 'progress' ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-500' : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/40 text-red-500');

  return (
    <header className={`px-3 sm:px-6 py-2.5 backdrop-blur-md border-b shrink-0 relative z-40 transition-colors ${
      theme === 'light' ? 'bg-white/90 border-zinc-200 text-zinc-900 shadow-xl' : (theme === 'classic' ? 'bg-red-950/80 border-red-500/30 text-white shadow-xl' : 'bg-black/40 border-white/10 text-white')
    }`}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {/* Vodacom / Eldorado Badge */}
        <div className="relative w-11 h-11 bg-red-600 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-lg shadow-red-600/30 overflow-hidden shrink-0 border border-white/20">
          {profilePhotoUrl && !photoError ? (
            <img
              src={profilePhotoUrl}
              alt="Photo pointage"
              className="w-full h-full object-cover object-center"
              style={{ objectPosition: 'center center' }}
              onError={(e) => {
                setPhotoError(true);
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-[8px] font-black uppercase tracking-wide">Photo non dispo</span>
          )}
          <span className={`status-dot absolute -bottom-0.5 -right-0.5 border-2 ${theme === 'light' ? 'border-white' : 'border-black'} ${online ? 'status-online' : 'status-offline'}`} />
        </div>

          <div className="flex flex-col min-w-0">
          <div className="flex items-center space-x-2">
              <span className="font-black text-sm sm:text-lg tracking-tight brand-text truncate">
              BTL Deployment Tracker
            </span>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-red-600 text-white rounded shadow-sm">
              {user.role}
            </span>
          </div>
            <span className={`text-xs sm:text-sm font-black mt-0.5 px-2.5 py-1 rounded-full inline-flex items-center gap-2 w-fit max-w-full truncate ${
              theme === 'light' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white/10 text-red-100 border border-white/20'
            }`} title={user.name}>
              <span className={`inline-block w-2.5 h-2.5 rounded-full shadow ${syncDotClass}`} />
              <span className="truncate">{roleLabel}: {user.name}</span>
            </span>
            <span className="hidden sm:inline text-[9px] text-zinc-400 font-bold tracking-wide uppercase opacity-80">
              Par <b className="text-red-500 font-black">Eldorado Design</b>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
          {onSetTheme && (
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(prev => !prev)}
                className={`p-2 rounded-xl border transition-all ${
                  theme === 'light'
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                }`}
                title="Theme"
              >
                <Palette className="w-4 h-4" />
              </button>

              {showThemeMenu && (
                <div className={`absolute right-0 top-11 w-40 border rounded-2xl p-1.5 shadow-2xl z-50 ${
                  theme === 'light' ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/10 text-white'
                }`}>
                  {[
                    { key: 'classic', label: 'Classic' },
                    { key: 'dark', label: 'Sombre' },
                    { key: 'light', label: 'Clair' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        onSetTheme(opt.key as 'classic' | 'dark' | 'light');
                        setShowThemeMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                        theme === opt.key
                          ? 'bg-red-600 text-white'
                          : (theme === 'light' ? 'hover:bg-zinc-100 text-zinc-700' : 'hover:bg-white/10 text-gray-300')
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Google Sheets Sync Button (Only provided for Admin) */}
          {onOpenGSheetModal && (
            <button
              onClick={onOpenGSheetModal}
              className={`p-2 border rounded-xl transition-all shadow-sm ${gsheetBtnClass}`}
              title="Connexion & Sync Google Sheets"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}

          {/* Security Password Change */}
          <button
            onClick={onOpenPasswordModal}
            className={`p-2 rounded-xl border transition-all ${
              theme === 'light'
                ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
            }`}
            title="Sécuriser mon accès"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifPanel(!showNotifPanel);
                if (!showNotifPanel && unreadCount > 0) {
                  onMarkNotifsRead();
                }
              }}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all relative ${
                theme === 'light'
                  ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
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
              <div className={`absolute right-0 top-12 w-80 border rounded-3xl p-4 shadow-2xl z-50 animate-pop ${
                theme === 'light' ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/10 text-white'
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
                  {notifications.length === 0 ? (
                    <p className="text-center text-xs text-gray-500 italic py-4">Aucune notification.</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-3 bg-red-500/10 border-l-4 border-red-600 rounded-xl text-xs font-semibold">
                        {n.message}
                      </div>
                    ))
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
    </header>
  );
};
