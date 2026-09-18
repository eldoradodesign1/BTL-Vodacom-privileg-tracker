import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole } from '../types';
import { Shield, RotateCcw, Search, UserRound, X, SlidersHorizontal, Minimize2, Maximize2 } from 'lucide-react';
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

export function sortUsersForSimulation(users: User[]): User[] {
  return [...users].sort((left, right) => left.name.localeCompare(right.name, 'fr') || left.id.localeCompare(right.id));
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  masterUser, effectiveUser, users, simulatedRole, theme, onSimulateRole, onSimulateUserChange, onResetSimulation
}) => {
  const [expanded, setExpanded] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState('');

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPickerOpen(false); setSelectorQuery(''); } };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pickerOpen]);

  if (masterUser.role !== 'super_admin') return null;

  const simulationUsers = sortUsersForSimulation(users);
  const needle = selectorQuery.trim().toLowerCase();
  const filteredUsers = !needle ? simulationUsers : simulationUsers.filter((user) => `${user.name} ${user.phone} ${user.role} ${user.userCategory || ''}`.toLowerCase().includes(needle));
  const isDiamondTheme = theme === 'diamond';
  const activeRole = simulatedRole || effectiveUser.role;
  const selectedUser = simulationUsers.find((user) => user.id === effectiveUser.id) || effectiveUser;
  const shortcutTargets = {
    agent: simulationUsers.find((user) => user.name.trim().toLowerCase() === 'agent test'),
    supervisor: simulationUsers.find((user) => ['hervé ntalu', 'herve ntalu'].includes(user.name.trim().toLowerCase())),
    admin: simulationUsers.find((user) => user.name.trim().toLowerCase() === 'bradley izamaboko'),
  };
  const surface = isDiamondTheme
    ? 'border-slate-300/80 bg-white/90 text-slate-800 shadow-[0_10px_30px_rgba(100,116,139,.20)]'
    : 'border-white/10 bg-[#080d19]/90 text-white shadow-[0_10px_35px_rgba(0,0,0,.42)]';
  const muted = isDiamondTheme ? 'text-slate-500' : 'text-white/45';
  const chip = isDiamondTheme ? 'border-slate-300 bg-white/70' : 'border-white/10 bg-white/[0.04]';
  const activeChip = isDiamondTheme ? 'bg-slate-800 text-white' : 'bg-red-500/20 text-red-100 border-red-300/20';

  return (
    <>
      <div className={`sticky top-0 z-[70] border-b backdrop-blur-2xl ${surface}`}>
        <div className={`mx-auto flex min-h-11 max-w-6xl items-center gap-2 px-2.5 sm:px-4 ${expanded ? 'py-1.5' : 'py-1'}`}>
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100"><Shield size={14}/><span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_currentColor]"/></div>
            {expanded ? (
              <div className="hidden min-w-0 sm:block">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Simulation Master</p>
                <p className={`truncate text-[9px] font-bold ${muted}`}>Origine · {masterUser.name}</p>
              </div>
            ) : (
              <span className="hidden sm:inline rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-cyan-100">SIM</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={`group flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition hover:border-red-300/40 ${chip}`}
            title="Choisir l'utilisateur simulé"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10"><UserRound size={12}/></span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[9px] font-black">{selectedUser.name}</b>
              {expanded && <span className={`block truncate text-[7px] font-black uppercase tracking-wider ${muted}`}>{selectedUser.role} · {selectedUser.userCategory || 'utilisateur'}</span>}
            </span>
            {expanded ? <SlidersHorizontal size={13} className={`shrink-0 transition group-hover:text-red-300 ${muted}`}/> : <span className="text-[8px] font-black uppercase text-cyan-200">SIMULER</span>}
          </button>

          {expanded && <div className={`hidden items-center gap-1 rounded-xl border p-1 sm:flex ${chip}`}>
            {(['agent','supervisor','admin'] as UserRole[]).map((role) => {
              const target = shortcutTargets[role as keyof typeof shortcutTargets];
              const label = role === 'agent' ? 'AGENT' : role === 'supervisor' ? 'SUP' : 'ADMIN';
              const name = target?.name || (role === 'agent' ? 'Agent Test' : role === 'supervisor' ? 'Hervé Ntalu' : 'Bradley Izamaboko');
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => onSimulateRole(role)}
                  className={`rounded-lg px-2.5 py-1 text-[8px] font-black uppercase transition ${activeRole === role ? activeChip : muted + ' hover:text-white'}`}
                  title={`Simuler ${role === 'supervisor' ? 'le superviseur' : role} : ${name}`}
                >
                  {label} · <span className="normal-case tracking-normal">{name}</span>
                </button>
              );
            })}
          </div>}

          {simulatedRole && <button type="button" onClick={onResetSimulation} className={`flex h-8 shrink-0 items-center gap-1 rounded-xl border px-2 text-[8px] font-black uppercase transition ${chip} ${muted}`} title="Quitter la simulation"><RotateCcw size={12}/><span className="hidden md:inline">Quitter</span></button>}

          <button type="button" onClick={() => setExpanded((value) => !value)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${chip} ${muted}`} title={expanded ? 'Réduire la barre' : 'Déployer la barre'} aria-label={expanded ? 'Réduire la barre' : 'Déployer la barre'}>
            {expanded ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}
          </button>
        </div>
      </div>

      {pickerOpen && typeof document !== 'undefined' && createPortal(( 
        <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/55 p-3 pt-[max(4rem,12vh)] backdrop-blur-sm" onPointerDown={() => { setPickerOpen(false); setSelectorQuery(''); }}>
          <div className={`w-full max-w-md overflow-hidden rounded-[1.7rem] border shadow-[0_30px_100px_rgba(0,0,0,.55)] ${surface}`} onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-white/10 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-200"><UserRound size={16}/></div>
              <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[0.2em] text-red-200/80">Simulation Master</p><p className="truncate text-sm font-black">{selectedUser.name}</p></div>
              <button type="button" onClick={() => { setPickerOpen(false); setSelectorQuery(''); }} className={`rounded-xl p-2 ${muted}`} aria-label="Fermer"><X size={16}/></button>
            </div>
            <div className="p-3">
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${chip}`}><Search size={14} className={muted}/><input autoFocus value={selectorQuery} onChange={(event) => setSelectorQuery(event.target.value)} placeholder="Rechercher un utilisateur…" className={`min-w-0 flex-1 bg-transparent text-[10px] font-bold outline-none ${isDiamondTheme ? 'placeholder:text-slate-400' : 'placeholder:text-white/30'}`}/>{selectorQuery && <button type="button" onClick={() => setSelectorQuery('')} className={muted}><X size={13}/></button>}</div>
              <div className="mt-2 max-h-[55vh] space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                {filteredUsers.map((user) => <button key={user.id} type="button" onClick={() => { onSimulateUserChange(user.id); setPickerOpen(false); setSelectorQuery(''); }} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition ${user.id === effectiveUser.id ? (isDiamondTheme ? 'bg-slate-800 text-white' : 'bg-red-500/20 text-white') : (isDiamondTheme ? 'text-slate-700 hover:bg-slate-100' : 'text-gray-300 hover:bg-white/10')}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10"><UserRound size={13}/></span><span className="min-w-0 flex-1"><b className="block truncate text-[10px]">{user.name}</b><span className="text-[8px] font-black uppercase opacity-50">{user.role} · {user.userCategory || '—'}</span></span></button>)}
                {!filteredUsers.length && <div className={`py-8 text-center text-[10px] font-bold ${muted}`}>Aucun utilisateur trouvé.</div>}
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
};
