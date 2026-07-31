import React, { useState, useEffect } from 'react';
import { User, Shop, Lead, Checkin, DailyReport, NotificationItem, AgentMasterStatus, UserRole } from './types';
import {
  getUsers,
  getShops,
  getLeads,
  getCheckins,
  getReports,
  getNotifications,
  markNotifsAsRead,
  toISO
} from './utils/storage';
import { SimulationBar } from './components/SimulationBar';
import { Header } from './components/Header';
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
import { GSheetModal } from './components/Modals/GSheetModal';
import { getGSheetConfig, syncFromGoogleSheetUrl } from './utils/googleSheetsSync';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('vodacom_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [masterUser, setMasterUser] = useState<User | null>(currentUser);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [simulatedUserId, setSimulatedUserId] = useState<string | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('vodacom_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [users, setUsers] = useState<User[]>(getUsers());
  const [shops, setShops] = useState<Shop[]>(getShops());
  const [activeShopId, setActiveShopId] = useState<string>('');
  const [, setDataRevision] = useState(0);

  // Modals state
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isGSheetModalOpen, setIsGSheetModalOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [selectedAgentForProfile, setSelectedAgentForProfile] = useState<AgentMasterStatus | null>(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('vodacom_user', JSON.stringify(currentUser));
      setActiveShopId(currentUser.permanentShopId || 'shp-std-01');
      if (!masterUser) setMasterUser(currentUser);
    } else {
      localStorage.removeItem('vodacom_user');
      setMasterUser(null);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('vodacom_theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const refreshData = () => {
    setUsers(getUsers());
    setShops(getShops());
    setDataRevision(prev => prev + 1);
  };

  useEffect(() => {
    const doAutoSync = () => {
      const cfg = getGSheetConfig();
      if (cfg.sheetCsvUrl) {
        syncFromGoogleSheetUrl(cfg.sheetCsvUrl).then((res) => {
          if (res.success && res.count > 0) {
            refreshData();
          }
        }).catch(() => {});
      }
    };

    doAutoSync();
    const interval = setInterval(() => {
      const cfg = getGSheetConfig();
      if (cfg.autoSync && cfg.sheetCsvUrl) {
        doAutoSync();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(u) => { setCurrentUser(u); setMasterUser(u); }} />;
  }

  // Base user account is master user if available, or current logged user
  const realMasterUser = masterUser || currentUser;

  // Resolve simulated user profile if selected by Admin
  let baseUser = currentUser;
  if (simulatedUserId) {
    const foundU = users.find(u => u.id === simulatedUserId);
    if (foundU) baseUser = foundU;
  }

  // Determine effective user & role (handling master simulation mode)
  const effectiveRole = simulatedRole || baseUser.role;
  const effectiveUser: User = {
    ...baseUser,
    role: effectiveRole
  };

  const todayStr = toISO(new Date());

  // Filter today's data for active effective agent
  const todayLeads = getLeads().filter(l => l.agent_id === effectiveUser.id && toISO(l.timestamp) === todayStr);
  const todayCheckin = getCheckins().find(c => c.agent_id === effectiveUser.id && toISO(c.timestamp) === todayStr && c.type === 'IN') || null;
  const agentReports = getReports().filter(r => r.agent_id === effectiveUser.id);
  const notifications = getNotifications(effectiveUser.id);

  const handleSimulateUserChange = (userId: string) => {
    setSimulatedUserId(userId);
    const found = users.find(u => u.id === userId);
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

  // Render view based on role & active tab
  const renderContent = () => {
    if (activeTab === 'chat') {
      return <ChatView currentUser={effectiveUser} />;
    }

    if (effectiveRole === 'admin') {
      return (
        <AdminView
          shops={shops}
          activeTab={activeTab}
          onSimulateRole={(role) => setSimulatedRole(role)}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onOpenShopModal={() => setIsShopModalOpen(true)}
          onOpenAgentProfile={(agent) => setSelectedAgentForProfile(agent)}
          onOpenPdfModal={(url) => setPdfModalUrl(url)}
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
          onRefreshData={refreshData}
        />
      );
    }

    // Default Agent View
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

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden font-sans select-none transition-colors ${
      theme === 'light' ? 'bg-gradient-to-br from-[#4d0000] via-[#8c0000] to-[#2d0000] text-white' : 'bg-[#09090b] text-white'
    }`}>
      {/* Persistent Master Admin Simulation Bar */}
      <SimulationBar
        masterUser={realMasterUser}
        effectiveUser={effectiveUser}
        users={users}
        simulatedRole={simulatedRole}
        onSimulateRole={(role) => setSimulatedRole(role)}
        onSimulateUserChange={handleSimulateUserChange}
        onResetSimulation={handleResetSimulation}
      />

      {/* Main App Header */}
      <Header
        user={effectiveUser}
        notifications={notifications}
        theme={theme}
        onToggleTheme={toggleTheme}
        onMarkNotifsRead={() => markNotifsAsRead(effectiveUser.id)}
        onLogout={handleLogout}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onOpenGSheetModal={realMasterUser.role === 'admin' ? () => setIsGSheetModalOpen(true) : undefined}
      />

      {/* Main View Area */}
      <main className="flex-1 px-3 sm:px-4 pt-3 pb-32 max-w-2xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {renderContent()}
      </main>

      {/* Bottom Mobile Navigation */}
      <BottomNav
        userRole={effectiveRole}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* App Modals */}
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
        agentReports={getReports().filter(r => r.agent_id === selectedAgentForProfile?.id)}
        onClose={() => setSelectedAgentForProfile(null)}
        onOpenPdf={(url) => setPdfModalUrl(url)}
        onCompileAgent={(agentId) => {
          setSelectedAgentForProfile(null);
          setActiveTab('admin');
        }}
      />

      <GSheetModal
        isOpen={isGSheetModalOpen}
        onClose={() => setIsGSheetModalOpen(false)}
        onSyncSuccess={refreshData}
      />
    </div>
  );
}
