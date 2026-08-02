import React, { useEffect, useState } from 'react';
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
  getTodayCheckinPhoto
} from './utils/storage';
import { SimulationBar } from './components/SimulationBar';
import { Header, ThemeMode } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { LoginScreen } from './components/LoginScreen';
import { AgentView } from './components/AgentView';
import { SupervisorView } from './components/SupervisorView';
import { AdminView } from './components/AdminView';
import { ChatView } from './components/ChatView';
import { LeadModal } from './components/Modals/LeadModal';
import { ReportModal } from './components/Modals/ReportModal';
import { UserModal } from './components/Modals/UserModal';
import { ShopModal } from './components/Modals/ShopModal';
import { PasswordModal } from './components/Modals/PasswordModal';
import { PdfViewerModal } from './components/Modals/PdfViewerModal';
import { AgentProfileModal } from './components/Modals/AgentProfileModal';
import { TodayClientsModal } from './components/Modals/TodayClientsModal';
import { GSheetModal } from './components/Modals/GSheetModal';
import { LocationModal } from './components/Modals/LocationModal';
import { getGSheetConfig, syncFromGoogleSheetUrl } from './utils/googleSheetsSync';

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
      const allowed: ThemeMode[] = ['classic', 'dark', 'light', 'anthracite', 'rubis', 'silver', 'sapphire', 'emerald', 'gold', 'glass'];
      return saved && allowed.includes(saved) ? saved : 'anthracite';
    } catch {
      return 'anthracite';
    }
  });

  const [activeTab, setActiveTab] = useState<TabType>('home');
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
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [selectedAgentForProfile, setSelectedAgentForProfile] = useState<AgentMasterStatus | null>(null);
  const [selectedAgentForTodayClients, setSelectedAgentForTodayClients] = useState<AgentMasterStatus | null>(null);
  const [selectedLocationAgent, setSelectedLocationAgent] = useState<AgentMasterStatus | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [syncPendingCount, setSyncPendingCount] = useState(0);

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
    document.body.classList.remove('theme-classic', 'theme-dark', 'theme-light', 'theme-anthracite', 'theme-rubis', 'theme-silver', 'theme-sapphire', 'theme-emerald', 'theme-gold', 'theme-glass');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const setThemeMode = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
  };

  const refreshData = () => {
    setUsers(getUsers());
    setShops(getShops());
    setDataRevision((prev) => prev + 1);
  };

  useEffect(() => {
    const doAutoSync = () => {
      const cfg = getGSheetConfig();
      if (cfg.sheetCsvUrl) {
        syncFromGoogleSheetUrl(cfg.sheetCsvUrl)
          .then((res) => {
            if (res.success && res.count > 0) {
              refreshData();
            }
          })
          .catch(() => undefined);
      }
    };

    doAutoSync();
    const interval = window.setInterval(() => {
      const cfg = getGSheetConfig();
      if (cfg.autoSync && cfg.sheetCsvUrl) {
        doAutoSync();
      }
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

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

  const todayStr = toISO(new Date());
  const todayLeads = getLeads().filter((l) => l.agent_id === effectiveUser.id && toISO(l.timestamp) === todayStr);
  const todayCheckin = getCheckins().find((c) => c.agent_id === effectiveUser.id && toISO(c.timestamp) === todayStr && c.type === 'IN') || null;
  const agentReports = getReports().filter((r) => r.agent_id === effectiveUser.id);
  const notifications = getNotifications(effectiveUser.id);
  const todayCheckinPhoto = getTodayCheckinPhoto(effectiveUser.id);
  const selectedAgentTodayLeads = selectedAgentForTodayClients
    ? getLeads().filter((l) => l.agent_id === selectedAgentForTodayClients.id && toISO(l.timestamp) === todayStr)
    : [];

  const handleSimulateUserChange = (userId: string) => {
    setSimulatedUserId(userId);
    const found = users.find((u) => u.id === userId);
    if (found) {
      setSimulatedRole(found.role);
    }
  };

  const handleResetSimulation = () => {
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
    if (activeTab === 'chat') {
      return <ChatView currentUser={effectiveUser} onDataChanged={refreshData} />;
    }

    if (effectiveRole === 'admin') {
      return (
        <AdminView
          currentUser={effectiveUser}
          shops={shops}
          activeTab={activeTab}
          onSimulateRole={(role) => setSimulatedRole(role)}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onOpenShopModal={() => setIsShopModalOpen(true)}
          onOpenAgentProfile={(agent) => setSelectedAgentForProfile(agent)}
          onOpenPdfModal={(url) => setPdfModalUrl(url)}
          onOpenTodayClientsModal={(agent) => setSelectedAgentForTodayClients(agent)}
          onOpenLocationModal={(agent) => setSelectedLocationAgent(agent)}
          onRefreshData={refreshData}
        />
      );
    }

    if (effectiveRole === 'supervisor') {
      return (
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
    }

    return (
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
  };

  const themeSurfaceStyle = theme === 'classic'
    ? { backgroundColor: '#4d0000', backgroundImage: 'linear-gradient(135deg, #4d0000 0%, #8c0000 35%, #ca0000 70%, #300000 100%)', color: '#ffffff' }
    : theme === 'light'
      ? { backgroundColor: '#f8fafc', backgroundImage: 'linear-gradient(145deg, #f8fafc 0%, #eef2ff 38%, #fdecec 100%)', color: '#111827' }
      : theme === 'anthracite'
        ? { backgroundColor: '#111317', backgroundImage: 'linear-gradient(135deg, #0b0d11 0%, #1a1f27 42%, #2b2320 100%)', color: '#f8fafc' }
        : theme === 'rubis'
          ? { backgroundColor: '#220b11', backgroundImage: 'linear-gradient(135deg, #2a0d15 0%, #7f1d1d 45%, #fb7185 100%)', color: '#fff7f7' }
          : theme === 'silver'
            ? { backgroundColor: '#0f172a', backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #334155 46%, #dbeafe 100%)', color: '#f8fafc' }
            : theme === 'sapphire'
              ? { backgroundColor: '#071120', backgroundImage: 'linear-gradient(135deg, #071120 0%, #1d4ed8 48%, #93c5fd 100%)', color: '#f8fbff' }
              : theme === 'emerald'
                ? { backgroundColor: '#04160f', backgroundImage: 'linear-gradient(135deg, #03110b 0%, #166534 48%, #86efac 100%)', color: '#f0fdf4' }
                : theme === 'gold'
                  ? { backgroundColor: '#23150c', backgroundImage: 'linear-gradient(135deg, #23150c 0%, #92400e 50%, #fde68a 100%)', color: '#fffef7' }
                  : theme === 'glass'
                    ? { backgroundColor: '#0b1120', backgroundImage: 'linear-gradient(135deg, #111827 0%, #1f2937 45%, #e2e8f0 100%)', color: '#f8fafc' }
                    : { backgroundColor: '#09090b', backgroundImage: 'radial-gradient(circle at top right, #3d0000 0%, #09090b 60%)', color: '#ffffff' };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden font-sans select-none transition-colors"
      style={themeSurfaceStyle}
    >
      <SimulationBar
        masterUser={realMasterUser}
        effectiveUser={effectiveUser}
        users={users}
        simulatedRole={simulatedRole}
        onSimulateRole={(role) => setSimulatedRole(role)}
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
        theme={theme}
        onSetTheme={setThemeMode}
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

      <main className="flex-1 px-3 sm:px-4 pt-3 pb-32 max-w-2xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {renderContent()}
      </main>

      <BottomNav
        userRole={effectiveRole}
        activeTab={activeTab}
        unreadChatCount={chatUnreadCount}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      <LeadModal
        isOpen={isLeadModalOpen}
        currentUser={effectiveUser}
        activeShopId={activeShopId}
        onClose={() => setIsLeadModalOpen(false)}
        onSuccess={refreshData}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        currentUser={effectiveUser}
        todayLeads={todayLeads}
        activeShopId={activeShopId}
        onClose={() => setIsReportModalOpen(false)}
        onReportGenerated={(url) => {
          refreshData();
          setPdfModalUrl(url);
        }}
      />

      <UserModal
        isOpen={isUserModalOpen}
        shops={shops}
        onClose={() => setIsUserModalOpen(false)}
        onSuccess={refreshData}
      />

      <ShopModal
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        onSuccess={refreshData}
      />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        currentUser={effectiveUser}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      <PdfViewerModal
        isOpen={!!pdfModalUrl}
        pdfUrl={pdfModalUrl}
        onClose={() => setPdfModalUrl(null)}
      />

      <AgentProfileModal
        isOpen={!!selectedAgentForProfile}
        agent={selectedAgentForProfile}
        agentReports={getReports().filter((r) => r.agent_id === selectedAgentForProfile?.id)}
        onClose={() => setSelectedAgentForProfile(null)}
        onOpenPdf={(url) => setPdfModalUrl(url)}
        onCompileAgent={() => {
          setSelectedAgentForProfile(null);
          setActiveTab('admin');
        }}
      />

      <TodayClientsModal
        isOpen={!!selectedAgentForTodayClients}
        agent={selectedAgentForTodayClients}
        dayLeads={selectedAgentTodayLeads}
        onClose={() => setSelectedAgentForTodayClients(null)}
      />

      <LocationModal
        isOpen={!!selectedLocationAgent}
        agent={selectedLocationAgent}
        onClose={() => setSelectedLocationAgent(null)}
      />

      <GSheetModal
        isOpen={isGSheetModalOpen}
        onClose={() => setIsGSheetModalOpen(false)}
        onSyncSuccess={refreshData}
      />
    </div>
  );
}
