import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { User, Shop, AgentMasterStatus, UserRole } from './types';
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
} from './utils/storage';


import {
  fetchUsersFromSupabase,
  fetchShopsFromSupabase,
  fetchLeadsFromSupabase,
  isSupabaseConfigured
} from './utils/supabase';

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
const GSheetModal = lazy(() => import('./components/Modals/GSheetModal').then(({ GSheetModal: component }) => ({ default: component })));
const LocationModal = lazy(() => import('./components/Modals/LocationModal').then(({ LocationModal: component }) => ({ default: component })));
const MerchantBAView = lazy(() => import('./components/MerchantBAView').then(({ MerchantBAView: component }) => ({ default: component })));
const MerchantSupervisorView = lazy(() => import('./components/MerchantSupervisorView').then(({ MerchantSupervisorView: component }) => ({ default: component })));
const MerchantAssignmentImportModal = lazy(() => import('./components/Modals/MerchantAssignmentImportModal').then(({ MerchantAssignmentImportModal: component }) => ({ default: component })));

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
  const [activeCampaign, setActiveCampaign] = useState<'vodacom-privilege' | 'merchant-educational'>(() => {
    try {
      const saved = localStorage.getItem('btl_active_campaign');
      return saved === 'merchant-educational' ? 'merchant-educational' : 'vodacom-privilege';
    } catch {
      return 'vodacom-privilege';
    }
  });
  const [homeTabPressCount, setHomeTabPressCount] = useState(0);
  const [users, setUsers] = useState<User[]>(() => getUsers());
  const [shops, setShops] = useState<Shop[]>(() => getShops());
  const [activeShopId, setActiveShopId] = useState<string>('');
  const [, setDataRevision] = useState(0);

  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isGSheetModalOpen, setIsGSheetModalOpen] = useState(false);
  const [isMerchantAssignmentImportOpen, setIsMerchantAssignmentImportOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [selectedAgentForProfile, setSelectedAgentForProfile] = useState<AgentMasterStatus | null>(null);
  const [selectedAgentForTodayClients, setSelectedAgentForTodayClients] = useState<AgentMasterStatus | null>(null);
  const [selectedLocationAgent, setSelectedLocationAgent] = useState<AgentMasterStatus | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; level: 'success' | 'error' } | null>(null);

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

  const setThemeMode = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
  };

  const setCampaignContext = (campaign: 'vodacom-privilege' | 'merchant-educational') => {
    setActiveCampaign(campaign);
    localStorage.setItem('btl_active_campaign', campaign);
    setActiveTab('home');
  };

const refreshData = useCallback(async () => {
  if (!isSupabaseConfigured()) {
    setUsers(getUsers());
    setShops(getShops());
    return;
  }

  try {
    const [usersData, shopsData] = await Promise.all([
      fetchUsersFromSupabase(),
      fetchShopsFromSupabase()
    ]);

    await Promise.all([
      refreshLeadsFromSupabase(),
      refreshCheckinsFromSupabase(),
      refreshReportsFromSupabase()
    ]);

    saveUsers(usersData);
    saveShops(shopsData);
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
          message: 'Votre compte a ete retire de la feuille Google Sheets. Reconnectez-vous avec un compte actif.',
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
  }, [refreshData]);

  useEffect(() => {
    const refreshStatus = () => {
      runScheduledDailyReminders(new Date());
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
  }, [currentUser?.id, activeTab, users.length]);

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
    return <LoginScreen onLoginSuccess={(u) => { setCurrentUser(u); setMasterUser(u); }} />;
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

  const isMerchantContext = effectiveUser.userCategory === 'brand_ambassador' || activeCampaign === 'merchant-educational';

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

    if (activeTab === 'chat') {
      content = <ChatView currentUser={effectiveUser} onDataChanged={refreshData} />;
    } else if (effectiveUser.userCategory === 'brand_ambassador') {
      content = <MerchantBAView currentUser={effectiveUser} />;
    } else if (isMerchantContext && (effectiveRole === 'admin' || effectiveRole === 'supervisor')) {
      content = <MerchantSupervisorView currentUser={effectiveUser} onOpenImport={effectiveRole === 'admin' ? () => setIsMerchantAssignmentImportOpen(true) : undefined} />;
    } else if (effectiveRole === 'admin') {
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
    } else if (effectiveRole === 'supervisor') {
      content = (
        <SupervisorView
          currentUser={effectiveUser}
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
        <React.Fragment key={`${effectiveRole}-${effectiveUser.id}`}>
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
      <SimulationBar
        masterUser={realMasterUser}
        effectiveUser={effectiveUser}
        users={users}
        simulatedRole={simulatedRole}
        theme={theme}
        onSimulateRole={handleSimulateRoleChange}
        onSimulateUserChange={handleSimulateUserChange}
        onResetSimulation={handleResetSimulation}
      />

      <Header
        user={effectiveUser}
        notifications={notifications}
        unreadChatCount={chatUnreadCount}
        online={online}
        syncPendingCount={syncPendingCount}
        profilePhotoUrl={todayCheckinPhoto || undefined}
        onPointageRecorded={refreshData}
        theme={theme}
        onSetTheme={setThemeMode}
        activeCampaign={isMerchantContext ? 'merchant-educational' : 'vodacom-privilege'}
        onSetCampaign={realMasterUser.role === 'admin' || realMasterUser.role === 'supervisor' ? setCampaignContext : undefined}
        onMarkNotifsRead={() => {
          markNotifsAsRead(effectiveUser.id);
          markChatAsRead(effectiveUser.id);
          refreshData();
        }}
        onClearNotifications={() => {
          clearNotifications(effectiveUser.id);
          refreshData();
        }}
        onLogout={handleLogout}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onOpenGSheetModal={realMasterUser.role === 'admin' ? () => setIsGSheetModalOpen(true) : undefined}
      />

      <main className="flex-1 min-h-0 px-3 sm:px-4 pt-3 pb-32 max-w-2xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {renderContent()}
      </main>

      <BottomNav
        userRole={effectiveRole}
        activeTab={activeTab}
        unreadChatCount={chatUnreadCount}
        onTabChange={(tab) => {
          if (tab === 'home') {
            setHomeTabPressCount((prev) => prev + 1);
          }
          setActiveTab(tab);
        }}
      />

      {toast && (
        <div className="fixed left-1/2 top-4 z-[90] -translate-x-1/2 px-3">
          <div className={`rounded-2xl border px-4 py-2 text-xs font-black uppercase shadow-xl backdrop-blur ${toast.level === 'error'
            ? 'border-red-400/60 bg-red-600/90 text-white'
            : 'border-emerald-400/50 bg-emerald-600/90 text-white'}`}>
            {toast.message}
          </div>
        </div>
      )}

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

      {isMerchantAssignmentImportOpen && (
        <Suspense fallback={null}>
          <MerchantAssignmentImportModal
            isOpen
            currentUser={effectiveUser}
            onClose={() => setIsMerchantAssignmentImportOpen(false)}
            onImported={() => {
              setIsMerchantAssignmentImportOpen(false);
              setDataRevision((prev) => prev + 1);
            }}
          />
        </Suspense>
      )}

      {isGSheetModalOpen && (
        <Suspense fallback={null}>
          <GSheetModal
            isOpen
            onClose={() => setIsGSheetModalOpen(false)}
            onSyncSuccess={() => {
              refreshData();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
