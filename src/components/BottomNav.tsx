import React from 'react';
import { UserRole } from '../types';
import { Home, Users, FolderOpen, MessageSquare, Settings } from 'lucide-react';

export type TabType = 'home' | 'tab2' | 'tab3' | 'chat' | 'admin';

interface BottomNavProps {
  userRole: UserRole;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  userRole,
  activeTab,
  onTabChange
}) => {
  const getTab2Label = () => {
    if (userRole === 'admin' || userRole === 'supervisor') return 'Monitoring';
    return 'Mes Clients';
  };

  const getTab3Label = () => {
    return 'Archives';
  };

  const getAdminLabel = () => {
    if (userRole === 'supervisor') return 'Shops';
    return 'Admin';
  };

  return (
    <nav className="fixed bottom-4 left-4 right-4 h-20 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl z-40 flex items-center justify-around px-2 shadow-2xl">
      <button
        onClick={() => onTabChange('home')}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'home' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Home className={`w-6 h-6 transition-transform ${activeTab === 'home' ? '-translate-y-1 scale-110' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
        {activeTab === 'home' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#E60000]" />
        )}
      </button>

      <button
        onClick={() => onTabChange('tab2')}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'tab2' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <Users className={`w-6 h-6 transition-transform ${activeTab === 'tab2' ? '-translate-y-1 scale-110' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-wider">{getTab2Label()}</span>
        {activeTab === 'tab2' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#E60000]" />
        )}
      </button>

      <button
        onClick={() => onTabChange('tab3')}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'tab3' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <FolderOpen className={`w-6 h-6 transition-transform ${activeTab === 'tab3' ? '-translate-y-1 scale-110' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-wider">{getTab3Label()}</span>
        {activeTab === 'tab3' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#E60000]" />
        )}
      </button>

      <button
        onClick={() => onTabChange('chat')}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
          activeTab === 'chat' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <MessageSquare className={`w-6 h-6 transition-transform ${activeTab === 'chat' ? '-translate-y-1 scale-110' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-wider">Chat</span>
        {activeTab === 'chat' && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#E60000]" />
        )}
      </button>

      {(userRole === 'admin' || userRole === 'supervisor') && (
        <button
          onClick={() => onTabChange('admin')}
          className={`flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === 'admin' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Settings className={`w-6 h-6 transition-transform ${activeTab === 'admin' ? '-translate-y-1 scale-110' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-wider">{getAdminLabel()}</span>
          {activeTab === 'admin' && (
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#E60000]" />
          )}
        </button>
      )}
    </nav>
  );
};
