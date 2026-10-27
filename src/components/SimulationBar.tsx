import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole } from '../types';
import { Eye, Search, UserRound, X } from 'lucide-react';
import type { ThemeMode } from './Header';

// Simulation réservée au super-admin. Hors simulation, rien ne s'affiche : on la lance depuis « Voir comme… »
// dans le menu du compte. Pendant une simulation, une pilule fine rappelle qui l'on voit et permet de changer
// ou de quitter en un geste.

interface SimulationBarProps {
  masterUser: User;
  effectiveUser: User;
  users: User[];
  simulatedRole: UserRole | null;
  theme: ThemeMode;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onSimulateRole: (role: UserRole) => void;
  onSimulateUserChange: (userId: string) => void;
  onResetSimulation: () => void;
}

export function sortUsersForSimulation(users: User[]): User[] {
  return [...users].sort((left, right) => left.name.localeCompare(right.name, 'fr') || left.id.localeCompare(right.id));
}

const ROLE_LABELS: Record<string, string> = { agent: 'Agent', supervisor: 'Superviseur', sub_admin: 'Sous-admin', admin: 'Admin', super_admin: 'Super-admin' };
const CATEGORY_LABELS: Record<string, string> = { hostess: 'Hôtesse', brand_ambassador: 'Brand Ambassador', operations: 'Opérations' };

export const describeSimulationUser = (user: User) => [ROLE_LABELS[user.role] || user.role, user.userCategory && user.role === 'agent' ? CATEGORY_LABELS[user.userCategory] || user.userCategory : ''].filter(Boolean).join(' · ');

/** Comptes de démonstration atteignables en un geste (agent, superviseur, admin). */
export function getSimulationShortcuts(users: User[]) {
  const sorted = sortUsersForSimulation(users);
  return [
    { key: 'agent', label: 'Agent', target: sorted.find((user) => user.id === 'agt-test-ba-herve-0821000001' || user.name.trim().toLowerCase() === 'agent test') },
    { key: 'supervisor', label: 'Superviseur', target: sorted.find((user) => user.id === 'sup-0001-4a11-a881-100000000001' || ['hervé ntalu', 'herve ntalu'].includes(user.name.trim().toLowerCase())) },
    { key: 'admin', label: 'Admin', target: sorted.find((user) => user.id === 'adm-0001-4a11-a881-100000000001' || user.name.trim().toLowerCase() === 'bradley izamaboko') },
  ];
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  masterUser, effectiveUser, users, simulatedRole, pickerOpen, onPickerOpenChange, onSimulateUserChange, onResetSimulation
}) => {
  const [query, setQuery] = useState('');
  const close = () => { onPickerOpenChange(false); setQuery(''); };

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pickerOpen]);

  if (masterUser.role !== 'super_admin') return null;

  const simulating = Boolean(simulatedRole) && effectiveUser.id !== masterUser.id;
  const shortcuts = getSimulationShortcuts(users);
  const needle = query.trim().toLowerCase();
  const candidates = sortUsersForSimulation(users).filter((user) => user.id !== masterUser.id && (!needle || `${user.name} ${user.phone} ${describeSimulationUser(user)}`.toLowerCase().includes(needle)));
  const choose = (userId: string) => { onSimulateUserChange(userId); close(); };

  const shortcutChips = (compact: boolean) => (
    <div className="seg-control" role="group" aria-label="Raccourcis de simulation">
      {shortcuts.map(({ key, label, target }) => (
        <button
          key={key}
          type="button"
          disabled={!target}
          aria-pressed={simulating && target?.id === effectiveUser.id}
          onClick={() => target && choose(target.id)}
          aria-label={target ? `Simuler ${target.name}` : `Compte ${label} indisponible`}
          title={target?.name}
          className={compact ? '!min-h-[30px] !px-2.5 !py-1 !text-xs' : ''}
        >
          {compact ? label.slice(0, 3) : label}
        </button>
      ))}
    </div>
  );

  const picker = pickerOpen && typeof document !== 'undefined' ? createPortal(
    <div className="confirm-overlay !items-start pt-[max(4rem,10vh)]" onPointerDown={close}>
      <div role="dialog" aria-modal="true" aria-label="Voir l’application comme" className="confirm-sheet !w-[min(100%,28rem)] !p-4" onPointerDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="confirm-title">Voir l’application comme…</h2>
            <p className="text-sm text-[var(--m-text-2)]">Vos données ne changent pas : seul l’affichage suit le compte choisi.</p>
          </div>
          <button type="button" onClick={close} aria-label="Fermer" className="app-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"><X className="h-4 w-4" /></button>
        </div>
        {shortcutChips(false)}
        <label className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--m-hair)] bg-[var(--m-field)] px-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--m-muted)]" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, téléphone ou rôle"
            aria-label="Rechercher un utilisateur"
            className="bg-transparent min-w-0 flex-1 border-0 py-2.5 text-sm text-[var(--m-text)] outline-none"
          />
        </label>
        <div className="mt-2 max-h-[50vh] space-y-0.5 overflow-y-auto">
          {candidates.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => choose(user.id)}
              aria-current={user.id === effectiveUser.id}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[var(--m-tile)] aria-[current=true]:bg-[color-mix(in_srgb,var(--m-accent)_14%,transparent)]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--m-tile)] text-[var(--m-accent)]"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0">
                <b className="block truncate text-sm font-semibold text-[var(--m-text)]">{user.name}</b>
                <span className="block truncate text-xs text-[var(--m-muted)]">{describeSimulationUser(user)}</span>
              </span>
            </button>
          ))}
          {!candidates.length && <p className="py-6 text-center text-sm text-[var(--m-muted)]">Aucun utilisateur trouvé.</p>}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {simulating && (
        <div className="simulation-strip sticky top-0 z-[45] px-3 pt-2">
          <div className="app-popover mx-auto flex max-w-2xl items-center gap-2 border !rounded-full py-1.5 pl-2 pr-1.5 !animate-none">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--m-accent)_16%,transparent)] text-[var(--m-accent)]"><Eye className="h-4 w-4" aria-hidden="true" /></span>
            <button type="button" onClick={() => onPickerOpenChange(true)} className="min-w-0 flex-1 text-left" aria-label="Changer le compte simulé">
              <span className="block text-xs text-[var(--m-muted)]">Vous voyez l’appli comme</span>
              <b className="block truncate text-sm font-bold text-[var(--m-text)]">{effectiveUser.name}</b>
            </button>
            <span className="hidden sm:block">{shortcutChips(true)}</span>
            <button type="button" onClick={onResetSimulation} aria-label="Quitter la simulation" title="Quitter la simulation" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--m-edge-soft)] px-3 text-sm font-bold text-[var(--m-text)]">
              <X className="h-4 w-4" aria-hidden="true" /><span className="hidden min-[400px]:inline">Quitter</span>
            </button>
          </div>
        </div>
      )}
      {picker}
    </>
  );
};
