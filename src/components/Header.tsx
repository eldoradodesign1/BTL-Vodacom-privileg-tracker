import React, { useState } from 'react';
import { User, NotificationItem } from '../types';
import { Bell, LogOut, Shield, FileSpreadsheet, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  user: User;
  notifications: NotificationItem[];
  onMarkNotifsRead: () => void;
  onLogout: () => void;
  onOpenPasswordModal: () => void;
  onOpenGSheetModal?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  notifications,
  onMarkNotifsRead,
  onLogout,
  onOpenPasswordModal,
  onOpenGSheetModal,
  theme = 'dark',
  onToggleTheme
}) => {
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'VP';

  return (
    <header className={`h-20 px-4 sm:px-6 backdrop-blur-md border-b flex items-center justify-between shrink-0 relative z-40 transition-colors ${
      theme === 'light' ? 'bg-red-950/80 border-red-500/30 text-white shadow-xl' : 'bg-black/40 border-white/10 text-white'
    }`}>
      <div className="flex items-center space-x-3">
        {/* Vodacom / Eldorado Badge */}
        <div className="relative w-11 h-11 bg-red-600 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-lg shadow-red-600/30 overflow-hidden shrink-0 border border-white/20">
          <img 
            src="https://www.vodacom.cd/favicon.ico" 
            alt="Vodacom"
            className="w-7 h-7 object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span className="status-dot status-online absolute -bottom-0.5 -right-0.5 border-2 border-black" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="font-black text-base sm:text-lg tracking-tight brand-text">
              BTL Deployment Tracker
            </span>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-red-600 text-white rounded shadow-sm">
              {user.role}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 font-bold tracking-wide uppercase">
            Par <b className="text-red-500 font-black">Eldorado Design</b>
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* iOS-Style Dark Mode Toggle Switch */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-full bg-black/20 hover:bg-black/30 border border-white/10 transition-all cursor-pointer shrink-0"
            title={theme === 'dark' ? 'Mode Sombre Activé (Cliquer pour Mode Rouge Classique)' : 'Activer le Mode Sombre'}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-300 hidden sm:inline">
              {theme === 'dark' ? 'Sombre' : 'Rouge'}
            </span>
            {/* iOS Toggle Track */}
            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 relative flex items-center ${
              theme === 'dark' ? 'bg-red-600' : 'bg-zinc-600'
            }`}>
              {/* Knob */}
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
              }`}>
                {theme === 'dark' ? (
                  <Moon className="w-2.5 h-2.5 text-zinc-900" />
                ) : (
                  <Sun className="w-2.5 h-2.5 text-amber-500" />
                )}
              </div>
            </div>
          </button>
        )}

        {/* Google Sheets Sync Button (Only provided for Admin) */}
        {onOpenGSheetModal && (
          <button
            onClick={onOpenGSheetModal}
            className="px-2.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 rounded-xl text-xs font-black uppercase flex items-center space-x-1.5 transition-all shadow-sm"
            title="Connexion & Sync Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span className="hidden md:inline">Google Sheets</span>
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
                  onClick={onMarkNotifsRead}
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
          className="px-3 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-xl text-xs font-black uppercase transition-all flex items-center space-x-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Quitter</span>
        </button>
      </div>
    </header>
  );
};
