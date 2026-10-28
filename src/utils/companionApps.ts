import type { User } from '../types';

// Applis sœurs publiées sur le même domaine (eldoradodesign1.github.io) : elles lisent leur session
// dans le stockage local partagé. On y dépose le compte BTL courant avant d'ouvrir le lien,
// ce qui évite une seconde connexion. Chaque appli revalide ensuite le profil auprès de la base.
// Si l'appli est installée, le lien s'y ouvre (sans interface de navigateur) ; sinon elle propose
// son installation (?installer=1).

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

// Applis installées, d'après related_applications du manifeste (Chrome Android). Lu d'avance :
// l'ouverture doit rester synchrone pour garder le geste de l'utilisateur.
type RelatedApp = { platform: string; url?: string };
let installed: Set<string> | null = null;
const detectInstalled = async () => {
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };
  if (!nav.getInstalledRelatedApps) return;
  try {
    const apps = await nav.getInstalledRelatedApps();
    installed = new Set(apps.filter((app) => app.platform === 'webapp' && app.url).map((app) => new URL('./', app.url).href));
  } catch { /* détection indisponible */ }
};
if (typeof window !== 'undefined') void detectInstalled();

const open = (appUrl: string) => {
  const url = installed?.has(appUrl) ? appUrl : `${appUrl}?installer=1`;
  const link = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' });
  link.click();
  void detectInstalled();
};

export const openReports = (user: User) => {
  if (!canOpenReports(user)) return;
  if (sameOrigin()) writeSession('vodacom-session', { role: 'btl', label: 'BTL', profile: { id: user.id, full_name: fullName(user), role: user.role, avatar_url: null } });
  open(REPORT_APP_URL);
};

export const openMySpace = (user: User) => {
  if (sameOrigin()) writeSession('btl-active-profile', { id: user.id, full_name: fullName(user), phone: user.phone, role: user.role, user_category: user.userCategory ?? null, is_active: true, password_hash: null });
  open(SPACE_APP_URL);
};
