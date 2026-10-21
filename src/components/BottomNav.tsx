import React from 'react';
import type { UserRole } from '../types';
import { Home, Users, FolderOpen, MapPinned, MessageSquare, Settings, type LucideIcon } from 'lucide-react';

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

type NavItem = { tab: TabType; label: string; icon: LucideIcon };

export const BottomNav: React.FC<BottomNavProps> = ({
  userRole, activeTab, unreadChatCount = 0, onTabChange,
  merchantContext = false, youthContext = false, mikiliContext = false, eventContext = false,
}) => {
  const management = ['admin', 'super_admin', 'supervisor', 'sub_admin'].includes(userRole);
  const tabs: NavItem[] = eventContext ? [
    { tab: 'home', label: 'Accueil', icon: Home },
    ...(management ? [{ tab: 'admin' as const, label: 'Gestion', icon: Settings }] : []),
  ] : [
    { tab: 'home', label: 'Accueil', icon: Home },
    { tab: 'tab2', label: management ? 'Monitoring' : merchantContext ? 'Mes Transactions' : 'Mes Clients', icon: Users },
    ...(merchantContext && userRole === 'agent' ? [{ tab: 'pos' as const, label: 'Mes POS', icon: MapPinned }] : []),
    { tab: 'tab3', label: 'Archives', icon: FolderOpen },
    { tab: 'chat', label: 'Chat', icon: MessageSquare },
    ...(management ? [{ tab: 'admin' as const, label: 'Gestion', icon: Settings }] : []),
  ];
  // Deux groupes symétriques laissent le + exactement au centre,
  // y compris dans Merchant qui garde son cinquième menu « Mes POS ».
  const split = Math.min(2, tabs.length);
  const renderTab = ({ tab, label, icon: Icon }: NavItem) => (
    <button key={tab} type="button" onClick={() => onTabChange(tab)} data-active={activeTab === tab}
      aria-current={activeTab === tab ? 'page' : undefined} className="app-tab dock-tab" title={label}>
      <span className="dock-tab-icon">
        <Icon size={22} strokeWidth={activeTab === tab ? 2.3 : 1.7} aria-hidden="true" />
        {tab === 'chat' && unreadChatCount > 0 && activeTab !== 'chat' && (
          <span className="dock-chat-badge">{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>
        )}
      </span>
      <span className="dock-tab-label">{label}</span>
    </button>
  );

  return (
    <nav className="app-bottom-nav agent-dock" aria-label="Navigation principale"
      data-agent={userRole === 'agent'} data-campaign={eventContext ? 'event' : merchantContext ? 'merchant' : youthContext ? 'youth' : mikiliContext ? 'mikili' : 'privilege'}>
      <div className="dock-tab-group">{tabs.slice(0, split).map(renderTab)}</div>
      <div id="agent-dock-action-slot" className="dock-action-slot" />
      {tabs.length > split && <div className="dock-tab-group">{tabs.slice(split).map(renderTab)}</div>}
    </nav>
  );
};
