import React from 'react';
import { User, UserRole } from '../types';
import { Shield, RotateCcw } from 'lucide-react';
import type { ThemeMode } from './Header';

interface SimulationBarProps {
  masterUser: User;
  effectiveUser: User;
  users: User[];
  simulatedRole: UserRole | null;
  theme: ThemeMode;
  onSimulateRole: (role: UserRole) => void;
  onSimulateUserChange: (userId: string) => void;
  onResetSimulation: () => void;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  masterUser,
  effectiveUser,
  users,
  simulatedRole,
  theme,
  onSimulateRole,
  onSimulateUserChange,
  onResetSimulation
}) => {
  // Always visible if master user is admin or a simulation is active
  if (masterUser.role !== 'admin' && !simulatedRole) {
    return null;
  }

  const activeRole = simulatedRole || effectiveUser.role;
  const isDiamondTheme = theme === 'diamond';
  const shellClasses = theme === 'rubis'
    ? 'border-rose-300/30 shadow-[0_10px_34px_rgba(127,29,29,0.42)]'
    : theme === 'silver'
      ? 'border-slate-200/30 shadow-[0_10px_34px_rgba(148,163,184,0.28)]'
      : isDiamondTheme
        ? 'border-slate-300/80 shadow-[0_12px_30px_rgba(100,116,139,0.22)]'
        : theme === 'sapphire'
          ? 'border-blue-300/30 shadow-[0_10px_34px_rgba(30,64,175,0.42)]'
          : theme === 'ambre'
            ? 'border-amber-200/30 shadow-[0_10px_34px_rgba(146,64,14,0.42)]'
            : 'border-white/15 shadow-[0_10px_34px_rgba(15,23,42,0.55)]';
  const themeSurfaceStyle = isDiamondTheme
    ? {
      backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.86) 46%, rgba(247,245,242,0.55) 100%), url('/simulation-backgrounds/diamond-light.jpg')",
      backgroundPosition: 'center, right center',
      backgroundSize: 'cover, auto 100%',
      backgroundRepeat: 'no-repeat, no-repeat'
    }
    : {
      backgroundImage: `linear-gradient(90deg, rgba(2, 6, 23, 0.96) 0%, rgba(2, 6, 23, 0.9) 42%, rgba(2, 6, 23, 0.58) 100%), url('/simulation-backgrounds/${theme}.jpg')`,
      backgroundPosition: 'center, right center',
      backgroundSize: 'cover, auto 100%',
      backgroundRepeat: 'no-repeat, no-repeat'
    };
  const iconClasses = theme === 'rubis'
    ? 'border-rose-400/40 bg-rose-600/20 text-rose-200'
    : theme === 'silver'
      ? 'border-slate-300/30 bg-slate-500/20 text-slate-200'
      : isDiamondTheme
        ? 'border-slate-300 bg-white/75 text-slate-700'
        : theme === 'sapphire'
          ? 'border-sky-400/30 bg-sky-600/20 text-sky-100'
          : theme === 'ambre'
            ? 'border-amber-300/35 bg-amber-600/20 text-amber-100'
            : 'border-white/20 bg-white/10 text-white';
  const selectClasses = isDiamondTheme
    ? 'border-slate-300 bg-white/80 text-slate-800'
    : 'border-white/15 bg-black/50 text-white';
  const chipBaseClasses = isDiamondTheme
    ? 'border-slate-300/90 bg-white/75 text-slate-700 shadow-sm'
    : 'border-white/10 bg-black/40 text-gray-200';
  const activeChipClasses = theme === 'rubis'
    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
    : theme === 'silver'
      ? 'bg-slate-400 text-slate-950 shadow-md shadow-slate-400/25'
      : isDiamondTheme
        ? 'bg-slate-800 text-white shadow-md shadow-slate-400/30'
        : theme === 'sapphire'
          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
          : theme === 'ambre'
            ? 'bg-amber-500 text-amber-950 shadow-md shadow-amber-500/25'
            : 'bg-white/20 text-white shadow-md shadow-white/20';

  return (
    <div
      className={`sticky top-0 z-50 overflow-hidden border-b px-3 py-2.5 backdrop-blur-xl ${shellClasses}`}
      style={themeSurfaceStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center space-x-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-lg ${iconClasses}`}>
            <Shield className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className={`block text-[11px] font-black uppercase tracking-[0.25em] ${isDiamondTheme ? 'text-slate-800' : 'text-white'}`}>
              Mode Simulation Master Active
            </span>
            <span className={`text-[10px] ${isDiamondTheme ? 'text-slate-600' : 'text-white/75'}`}>
              Compte d'origine : <b className={isDiamondTheme ? 'text-slate-800' : 'text-white'}>{masterUser.name} ({masterUser.role.toUpperCase()})</b>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={effectiveUser.id}
            onChange={(e) => onSimulateUserChange(e.target.value)}
            className={`w-36 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold shadow-inner outline-none focus:border-red-300 ${selectClasses}`}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                👤 {u.name} ({u.role.toUpperCase()})
              </option>
            ))}
          </select>

          <div className={`flex space-x-1 rounded-xl border p-1 ${chipBaseClasses}`}>
            <button
              onClick={() => onSimulateRole('agent')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                activeRole === 'agent' ? activeChipClasses : (isDiamondTheme ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white')
              }`}
            >
              Agent
            </button>
            <button
              onClick={() => onSimulateRole('supervisor')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                activeRole === 'supervisor' ? activeChipClasses : (isDiamondTheme ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white')
              }`}
            >
              Sup
            </button>
            <button
              onClick={() => onSimulateRole('admin')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                activeRole === 'admin' ? activeChipClasses : (isDiamondTheme ? 'text-slate-600 hover:text-slate-900' : 'text-gray-300 hover:text-white')
              }`}
            >
              Admin
            </button>
          </div>

          {simulatedRole && (
            <button
              onClick={onResetSimulation}
              className={`flex items-center space-x-1 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition-all ${isDiamondTheme ? 'border border-slate-300 bg-white/80 text-slate-700 hover:bg-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title="Quitter la simulation"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
