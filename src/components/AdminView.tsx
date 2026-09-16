import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AgentMasterStatus, Shop, User } from '../types';
import type { TabType } from './BottomNav';
import { AdminView as LegacyAdminView } from './AdminViewLegacy';
import CampaignAssignmentsPanel from './CampaignAssignmentsPanel';

interface AdminViewProps {
  currentUser: User;
  shops: Shop[];
  activeTab?: TabType;
  homeTabPressCount?: number;
  onRequestTabChange?: (tab: TabType) => void;
  onSimulateRole: (role: any) => void;
  onOpenUserModal: () => void;
  onOpenShopModal: () => void;
  onOpenAgentProfile: (agent: AgentMasterStatus) => void;
  onOpenPdfModal: (url: string) => void;
  onOpenTodayClientsModal?: (agent: AgentMasterStatus) => void;
  onOpenLocationModal?: (agent: AgentMasterStatus) => void;
  onRefreshData?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = (props) => {
  const [campaignHost, setCampaignHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let mountedHost: HTMLElement | null = null;
    let mount: HTMLDivElement | null = null;
    let hiddenNodes: HTMLElement[] = [];

    const restore = () => {
      hiddenNodes.forEach((node) => {
        node.style.display = node.dataset.campaignPreviousDisplay || '';
        delete node.dataset.campaignPreviousDisplay;
      });
      hiddenNodes = [];
      mount?.remove();
      mount = null;
      mountedHost = null;
    };

    const locate = () => {
      if (disposed) return;
      const sections = Array.from(document.querySelectorAll<HTMLElement>('section'));
      const intro = sections.find((node) => node.textContent?.includes('Affectations de campagnes'));
      const legacyList = sections.find((node) => node.textContent?.includes('Agents et campagnes actives'));
      const host = intro && legacyList && intro.parentElement === legacyList.parentElement ? intro.parentElement : null;

      if (!host) {
        if (mountedHost) {
          restore();
          setCampaignHost(null);
        }
        return;
      }
      if (host === mountedHost && mount) return;

      restore();
      mountedHost = host;
      hiddenNodes = Array.from(host.children) as HTMLElement[];
      hiddenNodes.forEach((node) => {
        node.dataset.campaignPreviousDisplay = node.style.display;
        node.style.display = 'none';
      });
      mount = document.createElement('div');
      mount.dataset.campaignPanelHost = 'true';
      host.appendChild(mount);
      setCampaignHost(mount);
    };

    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(locate, 0);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      restore();
      setCampaignHost(null);
    };
  }, []);

  return (
    <>
      <LegacyAdminView {...props} />
      {campaignHost && createPortal(
        <div className="w-full">
          <CampaignAssignmentsPanel currentUser={props.currentUser} />
        </div>,
        campaignHost
      )}
    </>
  );
};
