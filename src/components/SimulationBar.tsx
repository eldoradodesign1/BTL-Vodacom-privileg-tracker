import React from 'react';
import { User, UserRole } from '../types';
import { Shield, RotateCcw } from 'lucide-react';

interface SimulationBarProps {
  masterUser: User;
  effectiveUser: User;
  users: User[];
  simulatedRole: UserRole | null;
  onSimulateRole: (role: UserRole) => void;
  onSimulateUserChange: (userId: string) => void;
  onResetSimulation: () => void;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  masterUser,
  effectiveUser,
  users,
  simulatedRole,
  onSimulateRole,
  onSimulateUserChange,
  onResetSimulation
}) => {
  // Always visible if master user is admin or a simulation is active
  if (masterUser.role !== 'admin' && !simulatedRole) {
    return null;
  }

  const activeRole = simulatedRole || effectiveUser.role;

  return (
    <div className="bg-red-950/90 border-b border-red-500/40 px-3 py-2 flex flex-wrap items-center justify-between text-xs backdrop-blur-md sticky top-0 z-50 gap-2">
      <div className="flex items-center space-x-2">
        <Shield className="w-4 h-4 text-red-500 animate-pulse" />
        <div>
          <span className="font-black text-white uppercase tracking-wider text-[11px] block">
            Mode Simulation Master Active
          </span>
          <span className="text-[10px] text-red-300">
            Compte d'origine: <b className="text-white">{masterUser.name} ({masterUser.role.toUpperCase()})</b>
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <select
          value={effectiveUser.id}
          onChange={(e) => onSimulateUserChange(e.target.value)}
          className="bg-black/70 border border-red-500/50 text-white rounded-xl px-2.5 py-1 text-[11px] font-bold focus:outline-none focus:border-red-400 shadow-inner"
        >
          {users.map(u => (
            <option key={u.id} value={u.id}>
              👤 {u.name} ({u.role.toUpperCase()})
            </option>
          ))}
        </select>

        <div className="flex space-x-1 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => onSimulateRole('agent')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
              activeRole === 'agent' ? 'bg-red-600 text-white shadow-md shadow-red-600/50' : 'text-gray-300 hover:text-white'
            }`}
          >
            Agent
          </button>
          <button
            onClick={() => onSimulateRole('supervisor')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
              activeRole === 'supervisor' ? 'bg-red-600 text-white shadow-md shadow-red-600/50' : 'text-gray-300 hover:text-white'
            }`}
          >
            Sup
          </button>
          <button
            onClick={() => onSimulateRole('admin')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
              activeRole === 'admin' ? 'bg-red-600 text-white shadow-md shadow-red-600/50' : 'text-gray-300 hover:text-white'
            }`}
          >
            Admin
          </button>
        </div>

        {simulatedRole && (
          <button
            onClick={onResetSimulation}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold flex items-center space-x-1 transition-all"
            title="Quitter la simulation"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        )}
      </div>
    </div>
  );
};
