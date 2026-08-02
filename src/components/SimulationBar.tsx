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
  const shellClasses = theme === 'rubis'
    ? 'border-rose-400/20 bg-gradient-to-r from-rose-950/95 via-red-900/90 to-pink-950/80 shadow-[0_8px_30px_rgba(127,29,29,0.35)]'
    : theme === 'silver'
      ? 'border-slate-300/25 bg-gradient-to-r from-slate-950/95 via-slate-800/90 to-blue-950/80 shadow-[0_8px_30px_rgba(15,23,42,0.25)]'
      : theme === 'diamond'
        ? 'border-white/20 bg-gradient-to-r from-slate-950/95 via-indigo-950/90 to-slate-100/10 shadow-[0_8px_30px_rgba(2,6,23,0.35)]'
        : theme === 'sapphire'
          ? 'border-sky-400/25 bg-gradient-to-r from-slate-950/95 via-blue-900/90 to-sky-600/70 shadow-[0_8px_30px_rgba(30,64,175,0.35)]'
          : theme === 'ambre'
            ? 'border-amber-300/25 bg-gradient-to-r from-amber-950/95 via-orange-900/90 to-yellow-950/80 shadow-[0_8px_30px_rgba(120,53,15,0.35)]'
            : 'border-white/10 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-zinc-900/80 shadow-[0_8px_30px_rgba(15,23,42,0.45)]';
  const iconClasses = theme === 'rubis'
    ? 'border-rose-400/40 bg-rose-600/20 text-rose-200'
    : theme === 'silver'
      ? 'border-slate-300/30 bg-slate-500/20 text-slate-200'
      : theme === 'diamond'
        ? 'border-white/25 bg-white/10 text-slate-100'
        : theme === 'sapphire'
          ? 'border-sky-400/30 bg-sky-600/20 text-sky-100'
          : theme === 'ambre'
            ? 'border-amber-300/35 bg-amber-600/20 text-amber-100'
            : 'border-white/20 bg-white/10 text-white';
  const selectClasses = theme === 'anthracite' || theme === 'rubis' || theme === 'silver' || theme === 'diamond' || theme === 'sapphire' || theme === 'ambre'
    ? 'border-white/15 bg-black/50 text-white'
    : 'border-zinc-300 bg-white text-zinc-800';
  const chipBaseClasses = theme === 'anthracite' || theme === 'rubis' || theme === 'silver' || theme === 'diamond' || theme === 'sapphire' || theme === 'ambre'
    ? 'border-white/10 bg-black/40 text-gray-200'
    : 'border-zinc-300 bg-white/80 text-zinc-800';
  const activeChipClasses = theme === 'rubis'
    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
    : theme === 'silver'
      ? 'bg-slate-400 text-slate-950 shadow-md shadow-slate-400/25'
      : theme === 'diamond'
        ? 'bg-white/20 text-white shadow-md shadow-white/20'
        : theme === 'sapphire'
          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
          : theme === 'ambre'
            ? 'bg-amber-500 text-amber-950 shadow-md shadow-amber-500/25'
            : 'bg-white/20 text-white shadow-md shadow-white/20';

  return (
    <div className={`sticky top-0 z-50 border-b px-3 py-2.5 backdrop-blur-xl ${shellClasses}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center space-x-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-lg ${iconClasses}`}>
            <Shield className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="block text-[11px] font-black uppercase tracking-[0.25em] text-white">
              Mode Simulation Master Active
            </span>
            <span className={`text-[10px] ${theme === 'anthracite' || theme === 'rubis' || theme === 'silver' || theme === 'diamond' || theme === 'sapphire' || theme === 'ambre' ? 'text-white/70' : 'text-zinc-700'}`}>
              Compte d'origine: <b className="text-white">{masterUser.name} ({masterUser.role.toUpperCase()})</b>
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
                activeRole === 'agent' ? activeChipClasses : 'text-gray-300 hover:text-white'
              }`}
            >
              Agent
            </button>
            <button
              onClick={() => onSimulateRole('supervisor')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                activeRole === 'supervisor' ? activeChipClasses : 'text-gray-300 hover:text-white'
              }`}
            >
              Sup
            </button>
            <button
              onClick={() => onSimulateRole('admin')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                activeRole === 'admin' ? activeChipClasses : 'text-gray-300 hover:text-white'
              }`}
            >
              Admin
            </button>
          </div>

          {simulatedRole && (
            <button
              onClick={onResetSimulation}
              className={`flex items-center space-x-1 rounded-xl px-2.5 py-1.5 text-[10px] font-bold transition-all ${theme === 'anthracite' || theme === 'rubis' || theme === 'silver' || theme === 'diamond' || theme === 'sapphire' || theme === 'ambre' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'}`}
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
