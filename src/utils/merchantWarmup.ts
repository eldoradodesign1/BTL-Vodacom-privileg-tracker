import { getCampaignPos, getPosVisitsForDay, getTransactionsForDay } from './merchantCampaign';

function afterInteraction(task: () => void): void {
  if (typeof window === 'undefined') return;
  const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(task, { timeout: 1200 });
    return;
  }
  window.setTimeout(task, 180);
}

export function warmMerchantAgentWorkspace(input: { campaignId: string; runId: string; baId: string; activityDate: string }): void {
  afterInteraction(() => {
    void Promise.allSettled([
      getCampaignPos(input.campaignId),
      getPosVisitsForDay(input.baId, input.runId, input.activityDate),
      getTransactionsForDay(input.baId, input.runId, input.activityDate),
    ]);
  });
}
