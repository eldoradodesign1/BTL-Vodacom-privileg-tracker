import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { User, Shop, AgentMasterStatus, UserRole, Campaign, CampaignContext, CampaignPause } from './types';
import {
  getUsers,
  getShops,
  getLeads,
  getCheckins,
  getReports,
  getNotifications,
  markNotifsAsRead,
  clearNotifications,
  toISO,
  getUnreadChatCount,
  markChatAsRead,
  runScheduledDailyReminders,
  getSyncPendingCount,
  getTodayCheckinPhoto,
  saveUsers,
  saveShops,
  saveLeads,
  refreshCheckinsFromSupabase,
  refreshReportsFromSupabase,
  refreshLeadsFromSupabase,
  flushOfflineOutbox,
} from './utils/storage';


import {
  fetchUsersFromSupabase,
  fetchShopsFromSupabase,
  fetchLeadsFromSupabase,
  isSupabaseConfigured
} from './utils/supabase';
import { getActiveCampaignRuns, getCampaignPauses, getCampaigns, getCampaignsForUser, getDailyAttendance, getMerchantCampaign, getMerchantEvidencePublicUrl, getMerchantFundRequests, invalidateMerchantCache, isCampaignPausedOn } from './utils/merchantCampaign';
import { armFundRequestAlertAudio, emitFundRequestAlertSound, showFundRequestSystemNotification } from './utils/fundRequestAlert';
import { CheckCircle2, CircleAlert } from 'lucide-react';

import { SimulationBar } from './components/SimulationBar';
import { Header, ThemeMode } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { LoginScreen } from './components/LoginScreen';
const AgentView = lazy(() => import('./components/AgentView').then(({ AgentView: component }) => ({ default: component })));
const SupervisorView = lazy(() => import('./components/SupervisorView').then(({ SupervisorView: component }) => ({ default: component })));
const AdminView = lazy(() => import('./components/AdminView').then(({ AdminView: component }) => ({ default: component })));
const ChatView = lazy(() => import('./components/ChatView').then(({ ChatView: component }) => ({ default: component })));
const LeadModal = lazy(() => import('./components/Modals/LeadModal').then(({ LeadModal: component }) => ({ default: component })));
const ReportModal = lazy(() => import('./components/Modals/ReportModal').then(({ ReportModal: component }) => ({ default: component })));
const UserModal = lazy(() => import('./components/Modals/UserModal').then(({ UserModal: component }) => ({ default: component })));
const ShopModal = lazy(() => import('./components/Modals/ShopModal').then(({ ShopModal: component }) => ({ default: component })));
const PasswordModal = lazy(() => import('./components/Modals/PasswordModal').then(({ PasswordModal: component }) => ({ default: component })));
const PdfViewerModal = lazy(() => import('./components/Modals/PdfViewerModal').then(({ PdfViewerModal: component }) => ({ default: component })));
const AgentProfileModal = lazy(() => import('./components/Modals/AgentProfileModal').then(({ AgentProfileModal: component }) => ({ default: component })));
const TodayClientsModal = lazy(() => import('./components/Modals/TodayClientsModal').then(({ TodayClientsModal: component }) => ({ default: component })));
const SystemConfigurationModal = lazy(() => import('./components/Modals/SystemConfigurationModal').then(({ SystemConfigurationModal: component }) => ({ default: component })));
const LocationModal = lazy(() => import('./components/Modals/LocationModal').then(({ LocationModal: component }) => ({ default: component })));
const MerchantBAView = lazy(() => import('./components/MerchantBAView').then(({ MerchantBAView: component }) => ({ default: component })));
const MerchantSupervisorView = lazy(() => import('./components/MerchantSupervisorView').then(({ MerchantSupervisorView: component }) => ({ default: component })));
const MerchantTransactionsView = lazy(() => import('./components/MerchantTransactionsView').then(({ MerchantTransactionsView: component }) => ({ default: component })));
const MerchantPosVisitsView = lazy(() => import('./components/MerchantPosVisitsView').then(({ MerchantPosVisitsView: component }) => ({ default: component })));
const MerchantArchivesView = lazy(() => import('./components/MerchantArchivesView').then(({ MerchantArchivesView: component }) => ({ default: component })));
const MerchantMonitoringView = lazy(() => import('./components/MerchantMonitoringView').then(({ MerchantMonitoringView: component }) => ({ default: component })));
const MerchantSupervisorArchivesView = lazy(() => import('./components/MerchantSupervisorArchivesView').then(({ MerchantSupervisorArchivesView: component }) => ({ default: component })));
const MerchantAdminDashboard = lazy(() => import('./components/MerchantAdminDashboard').then(({ MerchantAdminDashboard: component }) => ({ default: component })));
const MerchantPodiumView = lazy(() => import('./components/MerchantPodiumView').then(({ MerchantPodiumView: component }) => ({ default: component })));
const YouthF2FView = lazy(() => import('./components/YouthF2FView').then(({ YouthF2FView: component }) => ({ default: component })));

const APP_DATA_SYNC_KEY = 'btl_last_full_data_sync_at';
const APP_DATA_SYNC_INTERVAL_MS = 60 * 60 * 1000;

const SectionLoader = () => (
  <div className="flex min-h-[12rem] items-center justify-center">
    <div className="glass-card px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">
      Chargement de l’espace…
    </div>
  </div>
);

async function ensureNotificationsPermission(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission === 'granted' || window.Notification.permission === 'denied') return;
  await window.Notification.requestPermission();
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('vodacom_user');
      return saved ? (JSON.parse(saved) as User) : null;
    } catch {
      return null;
    }
  });

  const [masterUser, setMasterUser] = useState<User | null>(currentUser);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [simulatedUserId, setSimulatedUserId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('vodacom_theme') as ThemeMode | null;
      const allowed: ThemeMode[] = ['anthracite', 'rubis', 'silver', 'diamond', 'sapphire', 'ambre'];
      return saved && allowed.includes(saved) ? saved : 'anthracite';
    } catch {
      return 'anthracite';
    }
  });

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [activeCampaign, setActiveCampaign] = useState<CampaignContext>(() => {
    try {
      const saved = localStorage.getItem('btl_active_campaign');
      if (saved === 'merchant-educational' || saved === 'youth-f2f') return saved;
      return 'vodacom-privilege';
    } catch {
      return 'vodacom-privilege';
    }
  });
  const [homeTabPressCount, setHomeTabPressCount] = useState(0);
  const [users, setUsers] = useState<User[]>(() => getUsers());
  const [shops, setShops] = useState<Shop[]>(() => getShops());
  const [activeShopId, setActiveShopId] = useState<string>('');
  const [dataRevision, setDataRevision] = useState(0);

  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSystemConfigurationOpen, setIsSystemConfigurationOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [selectedAgentForProfile, setSelectedAgentForProfile] = useState<AgentMasterStatus | null>(null);
  const [selectedAgentForTodayClients, setSelectedAgentForTodayClients] = useState<AgentMasterStatus | null>(null);
  const [selectedLocationAgent, setSelectedLocationAgent] = useState<AgentMasterStatus | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; level: 'success' | 'error' } | null>(null);
  const [merchantProfilePhotoUrl, setMerchantProfilePhotoUrl] = useState('');
  const [merchantTransactionRequested, setMerchantTransactionRequested] = useState(false);
  const [agentCampaigns, setAgentCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignPause, setActiveCampaignPause] = useState<CampaignPause | null>(null);
  const [privilegeRemindersPaused, setPrivilegeRemindersPaused] = useState(true);
  const [fundRequestAlerts, setFundRequestAlerts] = useState<Array<{ id: string; baName: string; amount: number; posLabel: string; requestedAt: string }>>([]);
  const alertedFundRequestIdsRef = useRef<Set<string>>(new Set());
  const lastFundAlertSignalAtRef = useRef(0);
  const [fundRequestToOpen, setFundRequestToOpen] = useState<string | null>(null);
  const [openFundRequests, setOpenFundRequests] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('vodacom_user', JSON.stringify(currentUser));
      setActiveShopId(currentUser.permanentShopId || 'shp-std-01');
      if (!masterUser) setMasterUser(currentUser);
    } else {
      localStorage.removeItem('vodacom_user');
      setMasterUser(null);
    }
  }, [currentUser, masterUser]);

  useEffect(() => {
    localStorage.setItem('vodacom_theme', theme);
    document.body.classList.remove('theme-classic', 'theme-dark', 'theme-light', 'theme-anthracite', 'theme-rubis', 'theme-silver', 'theme-sapphire', 'theme-emerald', 'theme-gold', 'theme-glass', 'theme-diamond', 'theme-ambre');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    const arm = () => { void armFundRequestAlertAudio(); };
    window.addEventListener('pointerdown', arm, { capture: true, passive: true });
    window.addEventListener('keydown', arm, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', arm, { capture: true });
      window.removeEventListener('keydown', arm, { capture: true });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshPrivilegePause = async () => {
      try {
        const campaigns = await getCampaigns();
        const privilegeCampaign = campaigns.find((campaign) => campaign.campaign_type !== 'brand_ambassador' && campaign.code !== 'merchant-educational-campaign');
        if (!privilegeCampaign) {
          if (!cancelled) setPrivilegeRemindersPaused(true);
          return;
        }
        const pauses = await getCampaignPauses(privilegeCampaign.id, true);
        if (!cancelled) setPrivilegeRemindersPaused(isCampaignPausedOn(pauses, toISO(new Date())));
      } catch {
        // En cas d’incertitude réseau, les rappels restent suspendus plutôt que d’enfreindre une pause.
        if (!cancelled) setPrivilegeRemindersPaused(true);
      }
    };
    void refreshPrivilegePause();
    const timer = window.setInterval(() => { void refreshPrivilegePause(); }, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [dataRevision]);

  useEffect(() => {
    const base = simulatedUserId ? users.find((user) => user.id === simulatedUserId) || currentUser : currentUser;
    const role = simulatedRole || base?.role;
    const canReviewFunds = role === 'supervisor' || role === 'admin' || role === 'super_admin' || role === 'sub_admin';
    if (!base || !canReviewFunds || activeCampaign !== 'merchant-educational') {
      setFundRequestAlerts([]);
      alertedFundRequestIdsRef.current = new Set();
      return;
    }
    let cancelled = false;
    const emitStrongFundAlert = (requests: Array<{ id: string; baName: string; amount: number; posLabel: string }>, notifySystem = false) => {
      emitFundRequestAlertSound();
      const first = requests[0];
      if (notifySystem && first) void showFundRequestSystemNotification(first);
      const initialTitle = document.title;
      document.title = `⚠ ${requests.length} demande${requests.length > 1 ? 's' : ''} de fonds`;
      window.setTimeout(() => { if (document.title.startsWith('⚠ ')) document.title = initialTitle; }, 8000);
    };
    const refreshFundAlerts = async () => {
      try {
        const campaign = await getMerchantCampaign();
        if (!campaign) return;
        const runs = await getActiveCampaignRuns(campaign.id);
        const activeRun = runs.find((run) => run.status === 'active') || runs[0];
        if (!activeRun) return;
        const requests = await getMerchantFundRequests({ runId: activeRun.id, ...(role === 'supervisor' ? { supervisorId: base.id } : {}) });
        const pending = requests.filter((request) => request.status === 'pending').map((request) => ({ id: request.id, baName: request.ba?.name || 'Brand Ambassador', amount: Number(request.amount), posLabel: request.point_of_sale?.denomination || request.point_of_sale?.agent_number || 'POS non renseigné', requestedAt: request.requested_at }));
        if (!cancelled) {
          const unseen = pending.filter((request) => !alertedFundRequestIdsRef.current.has(request.id));
          const now = Date.now();
          if (unseen.length) {
            emitStrongFundAlert(unseen, true);
            lastFundAlertSignalAtRef.current = now;
          } else if (pending.length > 0 && now - lastFundAlertSignalAtRef.current >= 15000) {
            emitStrongFundAlert([pending[0]]);
            lastFundAlertSignalAtRef.current = now;
          }
          if (pending.length === 0) lastFundAlertSignalAtRef.current = 0;
          alertedFundRequestIdsRef.current = new Set(pending.map((request) => request.id));
          setFundRequestAlerts(pending);
        }
      } catch {
        if (!cancelled) setFundRequestAlerts([]);
      }
    };
    void refreshFundAlerts();
    const timer = window.setInterval(() => { void refreshFundAlerts(); }, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeCampaign, currentUser, dataRevision, simulatedRole, simulatedUserId, users]);

  const setThemeMode = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
  };

  const setCampaignContext = (campaign: CampaignContext) => {
    setActiveCampaign(campaign);
    localStorage.setItem('btl_active_campaign', campaign);
    setActiveTab('home');
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'agent') {
      setAgentCampaigns([]);
      setActiveCampaignPause(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const campaigns = await getCampaignsForUser(currentUser.id);
        if (cancelled) return;
        setAgentCampaigns(campaigns);
        const current = campaigns.find((campaign) => (
          activeCampaign === 'youth-f2f'
            ? campaign.code === 'youth-f2f'
            : activeCampaign === 'merchant-educational'
              ? campaign.code === 'merchant-educational-campaign'
              : campaign.code === 'vodacom-privilege'
        ));
        if (!current) {
          const fallback = campaigns[0];
          if (!fallback) {
            const inferredContext: CampaignContext = currentUser.userCategory === 'brand_ambassador_youth'
              ? 'youth-f2f'
              : currentUser.userCategory === 'brand_ambassador'
                ? 'merchant-educational'
                : 'vodacom-privilege';
            setActiveCampaign(inferredContext);
            localStorage.setItem('btl_active_campaign', inferredContext);
            setActiveCampaignPause(null);
            return;
          }
          const nextContext: CampaignContext = fallback.code === 'youth-f2f'
            ? 'youth-f2f'
            : fallback.code === 'merchant-educational-campaign'
              ? 'merchant-educational'
              : 'vodacom-privilege';
          setActiveCampaign(nextContext);
          localStorage.setItem('btl_active_campaign', nextContext);
          const pauses = await getCampaignPauses(fallback.id);
          if (!cancelled) setActiveCampaignPause(pauses.find((pause) => pause.starts_on <= toISO(new Date()) && (!pause.ends_on || pause.ends_on >= toISO(new Date()))) || null);
          return;
        }
        const pauses = await getCampaignPauses(current.id);
        if (!cancelled) setActiveCampaignPause(pauses.find((pause) => pause.starts_on <= toISO(new Date()) && (!pause.ends_on || pause.ends_on >= toISO(new Date()))) || null);
      } catch {
        if (!cancelled) {
          setAgentCampaigns([]);
          const inferredContext = currentUser.userCategory === 'brand_ambassador' ? 'merchant-educational' : 'vodacom-privilege';
          setActiveCampaign(inferredContext);
          localStorage.setItem('btl_active_campaign', inferredContext);
          setActiveCampaignPause(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, activeCampaign, dataRevision]);

const refreshData = useCallback(async (force = false) => {
  // Une action explicite de l’utilisateur doit toujours repartir des données réseau,
  // y compris si une autre synchronisation applicative échoue ensuite.
  if (force) invalidateMerchantCache();
  if (!isSupabaseConfigured()) {
    setUsers(getUsers());
    setShops(getShops());
    return;
  }

  const lastSyncAt = Number(localStorage.getItem(APP_DATA_SYNC_KEY) || 0);
  const cacheIsFresh = !force && Date.now() - lastSyncAt < APP_DATA_SYNC_INTERVAL_MS;
  if (cacheIsFresh) {
    setUsers(getUsers());
    setShops(getShops());
    return;
  }

  try {
    await flushOfflineOutbox();
    const [usersData, shopsData] = await Promise.all([fetchUsersFromSupabase(), fetchShopsFromSupabase()]);
    await Promise.all([
      refreshLeadsFromSupabase(),
      refreshCheckinsFromSupabase(),
      refreshReportsFromSupabase(),
    ]);
    saveUsers(usersData);
    saveShops(shopsData);
    localStorage.setItem(APP_DATA_SYNC_KEY, String(Date.now()));
    invalidateMerchantCache();
    setUsers(usersData);
    setShops(shopsData);
    setDataRevision((prev) => prev + 1);
  } catch (error) {
    console.warn('Supabase refresh failed:', error);
    setUsers(getUsers());
    setShops(getShops());
  }
}, []);


  const enforceUserConformityAfterSync = () => {
    const freshUsers = getUsers();
    const persistedRaw = localStorage.getItem('vodacom_user');
    if (!persistedRaw) return;

    try {
      const persistedUser = JSON.parse(persistedRaw) as User;
      const matched = freshUsers.find((u) => u.id === persistedUser.id);
      if (!matched) {
        setCurrentUser(null);
        setMasterUser(null);
        setSimulatedRole(null);
        setSimulatedUserId(null);
        setToast({
          message: 'Votre compte n’est plus actif dans la base. Reconnectez-vous avec un compte valide.',
          level: 'error'
        });
        return;
      }

      setCurrentUser((prev) => (prev && prev.id === matched.id ? matched : prev));
      setMasterUser((prev) => (prev && prev.id === matched.id ? matched : prev));
      setSimulatedUserId((prev) => (prev && !freshUsers.some((u) => u.id === prev) ? null : prev));
    } catch {
      // Ignore malformed persisted payload and keep app flow unchanged.
    }
  };

  useEffect(() => {
    void refreshData();
    const hourlySync = window.setInterval(() => { void refreshData(); }, APP_DATA_SYNC_INTERVAL_MS);
    const onOnline = () => { void refreshData(); };
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(hourlySync);
      window.removeEventListener('online', onOnline);
    };
  }, [refreshData]);

  useEffect(() => {
    const refreshStatus = () => {
      runScheduledDailyReminders(new Date(), privilegeRemindersPaused);
      setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      setChatUnreadCount(currentUser ? getUnreadChatCount(currentUser.id) : 0);
      setSyncPendingCount(getSyncPendingCount());
    };
    refreshStatus();
    const interval = window.setInterval(refreshStatus, 30000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [currentUser?.id, activeTab, users.length, privilegeRemindersPaused]);

  useEffect(() => {
    if (activeTab === 'chat' && currentUser) {
      markChatAsRead(currentUser.id);
      setChatUnreadCount(getUnreadChatCount(currentUser.id));
    }
  }, [activeTab, currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      void ensureNotificationsPermission();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const profileUser = simulatedUserId ? users.find((user) => user.id === simulatedUserId) || currentUser : currentUser;
    if (!profileUser || profileUser.userCategory !== 'brand_ambassador') {
      setMerchantProfilePhotoUrl('');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const campaign = await getMerchantCampaign();
        if (!campaign) return;
        const runs = await getActiveCampaignRuns(campaign.id);
        const activeRun = runs.find((run) => run.status === 'active') || runs[0];
        if (!activeRun) return;
        const attendance = await getDailyAttendance(profileUser.id, activeRun.id, toISO(new Date()));
        const photoUrl = await getMerchantEvidencePublicUrl(attendance?.checkin_photo_path);
        if (!cancelled) setMerchantProfilePhotoUrl(photoUrl);
      } catch {
        if (!cancelled) setMerchantProfilePhotoUrl('');
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.userCategory, simulatedUserId]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string; level?: 'success' | 'error' }>;
      const message = custom.detail?.message;
      if (!message) return;
      const level = custom.detail?.level || 'success';
      setToast({ message, level });
      window.setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 2400);
    };

    window.addEventListener('vodacom-toast', onToast as EventListener);
    return () => window.removeEventListener('vodacom-toast', onToast as EventListener);
  }, []);

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(u, campaign) => {
      setCurrentUser(u);
      setMasterUser(u);
      if (campaign) setCampaignContext(campaign);
    }} />;
  }

  const realMasterUser = masterUser || currentUser;
  let baseUser = currentUser;
  if (simulatedUserId) {
    const foundU = users.find((u) => u.id === simulatedUserId);
    if (foundU) baseUser = foundU;
  }

  const effectiveRole = simulatedRole || baseUser.role;
  const effectiveUser: User = {
    ...baseUser,
    role: effectiveRole
  };

  const agentCampaignOptions = agentCampaigns.map((campaign) => ({
    key: (campaign.code === 'youth-f2f'
      ? 'youth-f2f'
      : campaign.code === 'merchant-educational-campaign'
        ? 'merchant-educational'
        : 'vodacom-privilege') as CampaignContext,
    label: campaign.name,
    note: campaign.code === 'youth-f2f'
      ? 'Campagne en préparation'
      : campaign.campaign_type === 'brand_ambassador'
        ? 'Brand Ambassador'
        : 'Hôtesses',
  })).filter((campaign, index, list) => list.findIndex((item) => item.key === campaign.key) === index);
  const inferredAgentMerchant = effectiveRole === 'agent' && effectiveUser.userCategory === 'brand_ambassador';
  const inferredAgentYouth = effectiveRole === 'agent' && effectiveUser.userCategory === 'brand_ambassador_youth';
  const isYouthContext = effectiveRole === 'agent'
    ? (agentCampaignOptions.length > 0 ? activeCampaign === 'youth-f2f' : inferredAgentYouth)
    : activeCampaign === 'youth-f2f';
  const isMerchantContext = !isYouthContext && (effectiveRole === 'agent'
    ? (agentCampaignOptions.length > 0 ? activeCampaign === 'merchant-educational' : inferredAgentMerchant)
    : activeCampaign === 'merchant-educational');
  const campaignIsPaused = effectiveRole === 'agent' && (isYouthContext || Boolean(activeCampaignPause));
  const setPermittedCampaignContext = (campaign: CampaignContext) => {
    if (effectiveRole !== 'agent' || agentCampaignOptions.some((option) => option.key === campaign)) setCampaignContext(campaign);
  };

  const todayStr = toISO(new Date());

const allCheckins = getCheckins();
const allLeads = getLeads();

const todayCheckin =
  allCheckins.find(
    (c) =>
      c.agent_id === effectiveUser.id &&
      toISO(c.timestamp) === todayStr &&
      c.type === 'IN'
  ) || null;

const todayLeads =
  allLeads.filter(
    (l) =>
      l.agent_id === effectiveUser.id &&
      toISO(l.timestamp) === todayStr
  );


  const agentReports = getReports().filter((r) => r.agent_id === effectiveUser.id);
  const notifications = getNotifications(effectiveUser.id);
  const todayCheckinPhoto = getTodayCheckinPhoto(effectiveUser.id);
  const selectedAgentTodayLeads = selectedAgentForTodayClients
    ? getLeads().filter((l) => l.agent_id === selectedAgentForTodayClients.id && toISO(l.timestamp) === todayStr)
    : [];

  const resetSimulationContext = () => {
    setActiveTab('home');
    setHomeTabPressCount(0);
    setSelectedAgentForProfile(null);
    setSelectedAgentForTodayClients(null);
    setSelectedLocationAgent(null);
    setPdfModalUrl(null);
  };

  const handleSimulateUserChange = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (!found) return;
    resetSimulationContext();
    setSimulatedUserId(userId);
    setSimulatedRole(found.role);
  };

  const handleSimulateRoleChange = (role: UserRole) => {
    resetSimulationContext();
    if (realMasterUser.role === 'super_admin') {
      const target = role === 'agent'
        ? users.find((user) => user.name.trim().toLowerCase() === 'jesly bamwangi')
        : role === 'supervisor'
          ? users.find((user) => user.name.trim().toLowerCase() === 'hervé ntalu' || user.name.trim().toLowerCase() === 'herve ntalu')
          : role === 'admin'
            ? users.find((user) => user.name.trim().toLowerCase() === 'bradley izamaboko')
            : null;
      if (target) {
        setSimulatedUserId(target.id);
        setSimulatedRole(role);
        return;
      }
    }
    setSimulatedRole(role);
  };

  const handleResetSimulation = () => {
    resetSimulationContext();
    setSimulatedRole(null);
    setSimulatedUserId(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setMasterUser(null);
    setSimulatedRole(null);
    setSimulatedUserId(null);
  };

  const renderContent = () => {
    let content: React.ReactNode;

    if (isYouthContext && activeTab !== 'chat') {
      content = <YouthF2FView currentUser={effectiveUser} />;
    } else if (activeTab === 'chat') {
      content = <ChatView currentUser={effectiveUser} onDataChanged={refreshData} />;
    } else if (isMerchantContext && effectiveRole === 'agent') {
      content = activeTab === 'tab2'
        ? <MerchantTransactionsView currentUser={effectiveUser} campaignPaused={campaignIsPaused} onRecordTransaction={() => { if (!campaignIsPaused) { setMerchantTransactionRequested(true); setActiveTab('home'); } }} />
        : activeTab === 'pos'
          ? <MerchantPosVisitsView currentUser={effectiveUser} campaignPaused={campaignIsPaused} />
          : activeTab === 'tab3'
            ? <MerchantArchivesView currentUser={effectiveUser} />
            : <MerchantBAView currentUser={effectiveUser} campaignPaused={campaignIsPaused} pauseReason={activeCampaignPause?.reason || ''} openTransactionRequested={merchantTransactionRequested} onTransactionRequestHandled={() => setMerchantTransactionRequested(false)} onPointagePhotoRecorded={(path) => { void getMerchantEvidencePublicUrl(path).then(setMerchantProfilePhotoUrl).catch(() => setMerchantProfilePhotoUrl('')); }} />;
    } else if (isMerchantContext && (effectiveRole === 'admin' || effectiveRole === 'super_admin' || effectiveRole === 'supervisor' || effectiveRole === 'sub_admin')) {
      content = activeTab === 'tab2'
        ? <MerchantMonitoringView />
        : activeTab === 'tab3'
          ? <MerchantSupervisorArchivesView />
          : activeTab === 'admin'
            ? <MerchantSupervisorView currentUser={effectiveUser} openFundRequestId={fundRequestToOpen} onFundRequestOpened={() => setFundRequestToOpen(null)} openFundRequests={openFundRequests} onFundRequestsOpened={() => setOpenFundRequests(false)} />
            : (effectiveRole === 'admin' || effectiveRole === 'super_admin')
              ? <MerchantAdminDashboard onOpenManagement={() => setActiveTab('admin')} pendingFundRequestCount={fundRequestAlerts.length} onOpenFundRequests={() => { setOpenFundRequests(true); setActiveTab('admin'); }} />
              : <MerchantAdminDashboard onOpenManagement={() => setActiveTab('admin')} podiumSlot={<MerchantPodiumView />} pendingFundRequestCount={fundRequestAlerts.length} onOpenFundRequests={() => { setOpenFundRequests(true); setActiveTab('admin'); }} />;
    } else if (effectiveRole === 'admin' || effectiveRole === 'super_admin') {
      content = (
        <AdminView
          currentUser={effectiveUser}
          shops={shops}
          activeTab={activeTab}
          homeTabPressCount={homeTabPressCount}
          onRequestTabChange={(tab) => setActiveTab(tab)}
          onSimulateRole={handleSimulateRoleChange}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onOpenShopModal={() => setIsShopModalOpen(true)}
          onOpenAgentProfile={(agent) => setSelectedAgentForProfile(agent)}
          onOpenPdfModal={(url) => setPdfModalUrl(url)}
          onOpenTodayClientsModal={(agent) => setSelectedAgentForTodayClients(agent)}
          onOpenLocationModal={(agent) => setSelectedLocationAgent(agent)}
          onRefreshData={refreshData}
        />
      );
    } else if (effectiveRole === 'supervisor' || effectiveRole === 'sub_admin') {
      content = (
        <SupervisorView
          currentUser={effectiveUser}
          globalScope={effectiveRole === 'sub_admin'}
          activeTab={activeTab}
          shops={shops}
          onOpenPdfModal={(url) => setPdfModalUrl(url)}
          onOpenAgentProfile={(agent) => setSelectedAgentForProfile(agent)}
          onOpenTodayClientsModal={(agent) => setSelectedAgentForTodayClients(agent)}
          onOpenLocationModal={(agent) => setSelectedLocationAgent(agent)}
          onRefreshData={refreshData}
        />
      );
    } else {
      content = (
        <AgentView
                currentUser={effectiveUser}
                campaignPaused={campaignIsPaused}
                pauseReason={activeCampaignPause?.reason || ''}
          activeShopId={activeShopId}
          activeTab={activeTab}
          todayLeads={todayLeads}
          todayCheckin={todayCheckin}
          agentReports={agentReports}
          onOpenLeadModal={() => setIsLeadModalOpen(true)}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onOpenPdfModal={(url) => setPdfModalUrl(url)}
          onRefreshData={refreshData}
        />
      );
    }

    return (
      <Suspense fallback={<SectionLoader />}>
        <React.Fragment key={`${effectiveRole}-${effectiveUser.id}-${dataRevision}`}>
          {content}
        </React.Fragment>
      </Suspense>
    );
  };

  const themeSurfaceStyle = theme === 'anthracite'
    ? { backgroundColor: '#111317', backgroundImage: 'linear-gradient(135deg, #0b0d11 0%, #1a1f27 42%, #2b2320 100%)', color: '#f8fafc' }
    : theme === 'rubis'
      ? { backgroundColor: '#220b11', backgroundImage: 'linear-gradient(135deg, #2a0d15 0%, #7f1d1d 45%, #fb7185 100%)', color: '#fff7f7' }
      : theme === 'silver'
        ? { backgroundColor: '#0f172a', backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #334155 46%, #dbeafe 100%)', color: '#f8fafc' }
        : theme === 'diamond'
          ? { backgroundColor: '#f6f4f1', backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(242,242,247,0.88) 52%, rgba(225,221,228,0.9) 100%)', color: '#28303a' }
          : theme === 'sapphire'
            ? { backgroundColor: '#071120', backgroundImage: 'linear-gradient(135deg, #071120 0%, #1d4ed8 48%, #93c5fd 100%)', color: '#f8fbff' }
            : theme === 'ambre'
              ? { backgroundColor: '#23150c', backgroundImage: 'linear-gradient(135deg, #23150c 0%, #92400e 50%, #fde68a 100%)', color: '#fffef7' }
              : { backgroundColor: '#111317', backgroundImage: 'linear-gradient(135deg, #0b0d11 0%, #1a1f27 42%, #2b2320 100%)', color: '#f8fafc' };

  return (
    <div
      className="app-shell h-screen flex flex-col relative overflow-hidden font-sans select-none transition-colors"
      style={{ color: themeSurfaceStyle.color }}
    >
      {realMasterUser.role === 'super_admin' && <SimulationBar
        masterUser={realMasterUser}
        effectiveUser={effectiveUser}
        users={users}
        simulatedRole={simulatedRole}
        theme={theme}
        onSimulateRole={handleSimulateRoleChange}
        onSimulateUserChange={handleSimulateUserChange}
        onResetSimulation={handleResetSimulation}
      />}

      <Header
        user={effectiveUser}
        notifications={notifications}
        unreadChatCount={chatUnreadCount}
        online={online}
        syncPendingCount={syncPendingCount}
        profilePhotoUrl={(isMerchantContext && effectiveUser.userCategory === 'brand_ambassador' ? merchantProfilePhotoUrl : isYouthContext ? '' : todayCheckinPhoto) || undefined}
        onPointageRecorded={campaignIsPaused ? undefined : refreshData}
        allowCheckin={!campaignIsPaused}
        theme={theme}
        onSetTheme={setThemeMode}
        activeCampaign={activeCampaign}
        campaignOptions={effectiveRole === 'agent' ? agentCampaignOptions : undefined}
        onSetCampaign={effectiveRole === 'agent'
          ? (agentCampaignOptions.length > 1 ? setPermittedCampaignContext : undefined)
          : (realMasterUser.role === 'admin' || realMasterUser.role === 'super_admin' || realMasterUser.role === 'supervisor' || realMasterUser.role === 'sub_admin' ? setCampaignContext : undefined)}
        onMarkNotifsRead={() => {
          markNotifsAsRead(effectiveUser.id);
          markChatAsRead(effectiveUser.id);
          refreshData();
        }}
        onClearNotifications={() => {
          clearNotifications(effectiveUser.id);
          refreshData();
        }}
        fundRequestAlerts={fundRequestAlerts}
        onOpenFundRequest={(requestId) => {
          setFundRequestToOpen(requestId);
          setOpenFundRequests(false);
          setCampaignContext('merchant-educational');
          setActiveTab('admin');
        }}
        onLogout={handleLogout}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onRefreshData={realMasterUser.role === 'super_admin' ? undefined : () => { void refreshData(true); }}
      />

      <main className="flex-1 min-h-0 px-3 sm:px-4 pt-3 pb-32 max-w-2xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {activeTab === 'admin' && realMasterUser.role === 'super_admin' && (
          <button type="button" onClick={() => setIsSystemConfigurationOpen(true)} className="glass-card mb-3 flex w-full items-center justify-between border border-fuchsia-300/25 bg-fuchsia-400/[0.06] px-4 py-3 text-left transition hover:bg-fuchsia-400/[0.1]">
            <span><b className="block text-xs font-black uppercase tracking-wide text-fuchsia-100">Paramètres de la base</b><span className="mt-1 block text-[10px] font-semibold text-gray-400">Supabase, Gemini OCR, schéma, export et cache</span></span>
            <span className="rounded-xl border border-fuchsia-200/25 px-2 py-1 text-[10px] font-black text-fuchsia-100">OUVRIR</span>
          </button>
        )}
        {renderContent()}
      </main>

      <BottomNav
        userRole={effectiveRole}
        activeTab={activeTab}
        unreadChatCount={chatUnreadCount}
        merchantContext={isMerchantContext}
        youthContext={isYouthContext}
        onTabChange={(tab) => {
          if (tab === 'home') {
            setHomeTabPressCount((prev) => prev + 1);
          }
          setActiveTab(tab);
        }}
      />

      {toast && (() => {
        const isError = toast.level === 'error';
        const ToastIcon = isError ? CircleAlert : CheckCircle2;
        return <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[160] flex justify-center px-3 sm:px-5" aria-live="polite" aria-atomic="true">
          <div className={`app-toast app-toast--${isError ? 'error' : 'success'} animate-toast-in flex w-full max-w-md items-center gap-3 overflow-hidden rounded-[1.35rem] border p-2.5 pr-3 shadow-2xl backdrop-blur-2xl`}>
            <span className="app-toast__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><ToastIcon size={18} strokeWidth={2.4}/></span>
            <div className="min-w-0 flex-1"><p className="app-toast__eyebrow text-[8px] font-black uppercase tracking-[0.18em]">{isError ? 'À vérifier' : 'Synchronisation'}</p><p className="mt-0.5 text-[11px] font-bold leading-snug">{toast.message}</p></div>
            <span className="app-toast__glow pointer-events-none absolute inset-x-5 bottom-0 h-px" />
          </div>
        </div>;
      })()}

      {isLeadModalOpen && (
        <Suspense fallback={null}>
          <LeadModal
            isOpen
            currentUser={effectiveUser}
            activeShopId={activeShopId}
            onClose={() => setIsLeadModalOpen(false)}
            onSuccess={refreshData}
          />
        </Suspense>
      )}

      {isReportModalOpen && (
        <Suspense fallback={null}>
          <ReportModal
            isOpen
            currentUser={effectiveUser}
            todayLeads={todayLeads}
            activeShopId={activeShopId}
            onClose={() => setIsReportModalOpen(false)}
            onReportGenerated={(url) => {
              refreshData();
              setPdfModalUrl(url);
            }}
          />
        </Suspense>
      )}

      {isUserModalOpen && (
        <Suspense fallback={null}>
          <UserModal isOpen shops={shops} onClose={() => setIsUserModalOpen(false)} onSuccess={refreshData} />
        </Suspense>
      )}

      {isShopModalOpen && (
        <Suspense fallback={null}>
          <ShopModal isOpen onClose={() => setIsShopModalOpen(false)} onSuccess={refreshData} />
        </Suspense>
      )}

      {isPasswordModalOpen && (
        <Suspense fallback={null}>
          <PasswordModal isOpen currentUser={effectiveUser} onClose={() => setIsPasswordModalOpen(false)} />
        </Suspense>
      )}

      {pdfModalUrl && (
        <Suspense fallback={null}>
          <PdfViewerModal isOpen pdfUrl={pdfModalUrl} onClose={() => setPdfModalUrl(null)} />
        </Suspense>
      )}

      {selectedAgentForProfile && (
        <Suspense fallback={null}>
          <AgentProfileModal
            isOpen
            agent={selectedAgentForProfile}
            agentReports={getReports().filter((r) => r.agent_id === selectedAgentForProfile.id)}
            todayLeads={getLeads().filter((l) => l.agent_id === selectedAgentForProfile.id && toISO(l.timestamp) === todayStr)}
            shops={shops}
            onClose={() => setSelectedAgentForProfile(null)}
            onOpenPdf={(url) => setPdfModalUrl(url)}
            onAssignmentChanged={refreshData}
            onCompileAgent={() => {
              setSelectedAgentForProfile(null);
              setActiveTab('admin');
            }}
          />
        </Suspense>
      )}

      {selectedAgentForTodayClients && (
        <Suspense fallback={null}>
          <TodayClientsModal
            isOpen
            agent={selectedAgentForTodayClients}
            dayLeads={selectedAgentTodayLeads}
            onClose={() => setSelectedAgentForTodayClients(null)}
          />
        </Suspense>
      )}

      {selectedLocationAgent && (
        <Suspense fallback={null}>
          <LocationModal isOpen agent={selectedLocationAgent} onClose={() => setSelectedLocationAgent(null)} />
        </Suspense>
      )}

      {isSystemConfigurationOpen && (
        <Suspense fallback={null}>
          <SystemConfigurationModal
            isOpen
            currentUser={realMasterUser}
            onClose={() => setIsSystemConfigurationOpen(false)}
            onRefreshData={() => { void refreshData(); }}
          />
        </Suspense>
      )}
    </div>
  );
}
