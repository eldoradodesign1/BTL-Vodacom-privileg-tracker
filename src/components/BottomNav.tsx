import React from 'react';
import { UserRole } from '../types';
import { Home, Users, FolderOpen, MessageSquare, Settings } from 'lucide-react';

export type TabType = 'home' | 'tab2' | 'tab3' | 'chat' | 'admin';

interface BottomNavProps {
  userRole: UserRole;
  activeTab: TabType;
  unreadChatCount?: number;
  onTabChange: (tab: TabType) => void;
  merchantContext?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  userRole,
  activeTab,
  unreadChatCount = 0,
  onTabChange,
  merchantContext = false
}) => {
  const getTab2Label = () => {
    if (userRole === 'admin' || userRole === 'supervisor') return 'Monitoring';
    return merchantContext ? 'Mes Transactions' : 'Mes Clients';
  };

  const getTab3Label = () => {
    return 'Archives';
  };

  const getAdminLabel = () => {
    if (userRole === 'supervisor') return 'Shops';
    return 'Gestion';
  };

  return (
    <nav className="app-bottom-nav fixed bottom-4 left-4 right-4 h-20 backdrop-blur-xl border rounded-3xl z-40 flex items-center justify-around px-2">
      <button
        onClick={() => onTabChange('home')}
        data-active={activeTab === 'home'}
        className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'home' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Home className={`w-6 h-6 transition-transform ${activeTab === 'home' ? '-translate-y-1 scale-110' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
        {activeTab === 'home' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />
        )}
      </button>

      <button
        onClick={() => onTabChange('tab2')}
        data-active={activeTab === 'tab2'}
        className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'tab2' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Users className={`w-6 h-6 transition-transform ${activeTab === 'tab2' ? '-translate-y-1 scale-110' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-wider">{getTab2Label()}</span>
        {activeTab === 'tab2' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />
        )}
      </button>

      <button
        onClick={() => onTabChange('tab3')}
        data-active={activeTab === 'tab3'}
        className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'tab3' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <FolderOpen className={`w-6 h-6 transition-transform ${activeTab === 'tab3' ? '-translate-y-1 scale-110' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-wider">{getTab3Label()}</span>
        {activeTab === 'tab3' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />
        )}
      </button>

      <button
        onClick={() => onTabChange('chat')}
        data-active={activeTab === 'chat'}
        className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'chat' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <div className="relative">
        <MessageSquare className={`w-6 h-6 transition-transform ${activeTab === 'chat' ? '-translate-y-1 scale-110' : ''}`} />
          {unreadChatCount > 0 && activeTab !== 'chat' && (
            <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-red-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-black">
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </span>
          )}
        </div>
        <span className="text-[9px] font-black uppercase tracking-wider">Chat</span>
        {activeTab === 'chat' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />
        )}
      </button>

      {(userRole === 'admin' || userRole === 'supervisor') && (
        <button
          onClick={() => onTabChange('admin')}
          data-active={activeTab === 'admin'}
          className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === 'admin' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Settings className={`w-6 h-6 transition-transform ${activeTab === 'admin' ? '-translate-y-1 scale-110' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-wider">{getAdminLabel()}</span>
          {activeTab === 'admin' && (
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />
          )}
        </button>
      )}
    </nav>
  );
};
