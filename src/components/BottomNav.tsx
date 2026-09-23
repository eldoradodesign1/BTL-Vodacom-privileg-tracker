import React from 'react';
import { UserRole } from '../types';
import { Home, Users, FolderOpen, MapPinned, MessageSquare, Settings } from 'lucide-react';

export type TabType = 'home' | 'tab2' | 'pos' | 'tab3' | 'chat' | 'admin';

interface BottomNavProps {
  userRole: UserRole;
  activeTab: TabType;
  unreadChatCount?: number;
  onTabChange: (tab: TabType) => void;
  merchantContext?: boolean;
  youthContext?: boolean;
  mikiliContext?: boolean;
  eventContext?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  userRole,
  activeTab,
  unreadChatCount = 0,
  onTabChange,
  merchantContext = false,
  youthContext = false,
  mikiliContext = false,
  eventContext = false
}) => {
  const getTab2Label = () => {
    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'supervisor' || userRole === 'sub_admin') return 'Monitoring';
    return merchantContext ? 'Mes Transactions' : 'Mes Clients';
  };

  const getTab3Label = () => {
    return 'Archives';
  };

  const getAdminLabel = () => {
    if (userRole === 'supervisor' || userRole === 'sub_admin') return 'Gestion';
    return 'Gestion';
  };

  if (eventContext) {
    const management = userRole === 'admin' || userRole === 'super_admin' || userRole === 'supervisor' || userRole === 'sub_admin';
    return <nav className="fixed bottom-4 left-1/2 z-40 flex h-16 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 items-center justify-around rounded-3xl border border-white/10 bg-black/35 px-2 shadow-2xl backdrop-blur-2xl">
      <button type="button" onClick={() => onTabChange('home')} className={`app-tab flex flex-1 flex-col items-center justify-center space-y-1 transition-all ${activeTab === 'home' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}><Home className={`h-6 w-6 ${activeTab === 'home' ? '-translate-y-1 scale-110' : ''}`} /><span className="text-[9px] font-black uppercase tracking-wider">Accueil</span></button>
      {management && <button type="button" onClick={() => onTabChange('admin')} className={`app-tab flex flex-1 flex-col items-center justify-center space-y-1 transition-all ${activeTab === 'admin' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}><Settings className={`h-6 w-6 ${activeTab === 'admin' ? '-translate-y-1 scale-110' : ''}`} /><span className="text-[9px] font-black uppercase tracking-wider">Gestion</span></button>}
    </nav>;
  }
  if (mikiliContext) {
    const management = userRole === 'admin' || userRole === 'super_admin' || userRole === 'supervisor' || userRole === 'sub_admin';
    const tabs = management
      ? [
          ['home', 'Accueil', Home],
          ['tab2', 'Monitoring', Users],
          ['tab3', 'Archives', FolderOpen],
          ['chat', 'Chat', MessageSquare],
          ['admin', 'Gestion', Settings],
        ] as const
      : [
          ['home', 'Accueil', Home],
          ['tab2', 'Mes Clients', Users],
          ['tab3', 'Archives', FolderOpen],
          ['chat', 'Chat', MessageSquare],
        ] as const;
    return (
      <nav className="app-bottom-nav fixed bottom-4 left-4 right-4 h-20 backdrop-blur-xl border rounded-3xl z-40 flex items-center justify-around px-2">
        {tabs.map(([tab, label, Icon]) => (
          <button key={tab} onClick={() => onTabChange(tab)} data-active={activeTab === tab} className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${activeTab === tab ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}>
            <Icon className={`w-6 h-6 transition-transform ${activeTab === tab ? '-translate-y-1 scale-110' : ''}`} />
            <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
            {activeTab === tab && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />}
          </button>
        ))}
      </nav>
    );
  }
  if (youthContext) {
    return (
      <nav className="app-bottom-nav fixed bottom-4 left-4 right-4 h-20 backdrop-blur-xl border rounded-3xl z-40 flex items-center justify-around px-2">
        <button
          onClick={() => onTabChange('home')}
          data-active={activeTab === 'home'}
          className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${activeTab === 'home' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Home className={`w-6 h-6 transition-transform ${activeTab === 'home' ? '-translate-y-1 scale-110' : ''}`} />
            <span className="text-[9px] font-black uppercase tracking-wider">Accueil</span>
          {activeTab === 'home' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />}
        </button>
        <button
          onClick={() => onTabChange('chat')}
          data-active={activeTab === 'chat'}
          className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${activeTab === 'chat' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <div className="relative">
            <MessageSquare className={`w-6 h-6 transition-transform ${activeTab === 'chat' ? '-translate-y-1 scale-110' : ''}`} />
            {unreadChatCount > 0 && activeTab !== 'chat' && <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-red-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-black">{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>}
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider">Chat</span>
          {activeTab === 'chat' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />}
        </button>
      </nav>
    );
  }

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

      {merchantContext && userRole === 'agent' && (
        <button
          onClick={() => onTabChange('pos')}
          data-active={activeTab === 'pos'}
          className={`app-tab flex-1 flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === 'pos' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <MapPinned className={`w-6 h-6 transition-transform ${activeTab === 'pos' ? '-translate-y-1 scale-110' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-wider">Mes POS</span>
          {activeTab === 'pos' && (
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" style={{ boxShadow: '0 0 8px var(--theme-accent)' }} />
          )}
        </button>
      )}

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

      {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'supervisor' || userRole === 'sub_admin') && (
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
