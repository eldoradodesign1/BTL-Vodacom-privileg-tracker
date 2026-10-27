import type { User } from '../types';

// Applis sœurs publiées sur le même domaine (eldoradodesign1.github.io) : elles lisent leur session
// dans le stockage local partagé. On y dépose le compte BTL courant avant d'ouvrir le lien,
// ce qui évite une seconde connexion. Chaque appli revalide ensuite le profil auprès de la base.

const PAGES_ORIGIN = 'https://eldoradodesign1.github.io';
export const REPORT_APP_URL = `${PAGES_ORIGIN}/btl-deployment-report/`;
export const SPACE_APP_URL = `${PAGES_ORIGIN}/btl-africa-user-registration/`;

/** Rôles admis par l'appli Rapports (session BTL, jamais le compte Vodacom). */
const REPORT_ROLES: User['role'][] = ['admin', 'super_admin', 'sub_admin', 'supervisor'];

export const canOpenReports = (user: User) => REPORT_ROLES.includes(user.role);

const sameOrigin = () => typeof window !== 'undefined' && window.location.origin === PAGES_ORIGIN;

const writeSession = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible : l'appli demandera la connexion */ }
};

const fullName = (user: User) => user.full_name || user.name;

export const openReports = (user: User) => {
  if (!canOpenReports(user)) return;
  if (sameOrigin()) writeSession('vodacom-session', { role: 'btl', label: 'BTL', profile: { id: user.id, full_name: fullName(user), role: user.role, avatar_url: null } });
  window.open(REPORT_APP_URL, '_blank', 'noopener');
};

export const openMySpace = (user: User) => {
  if (sameOrigin()) writeSession('btl-active-profile', { id: user.id, full_name: fullName(user), phone: user.phone, role: user.role, user_category: user.userCategory ?? null, is_active: true, password_hash: null });
  window.open(SPACE_APP_URL, '_blank', 'noopener');
};
