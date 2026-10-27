import React, { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import type { Campaign, CampaignContext, CampaignPause } from '../types';
import { createCampaignPause, deleteCampaignPause, endCampaignPause, getCampaignPauses, getCampaigns, isCampaignPausedOn } from '../utils/merchantCampaign';
import { confirmAction } from '../utils/confirmDialog';

// Super-admin : lecture / pause / arrêt de la campagne active, dans l'en-tête à droite du sélecteur.
// Pause et arrêt passent tous deux par campaign_pauses (sans date de fin) ; l'arrêt se distingue par son motif.

const STOP_REASON = 'Campagne arrêtée';

const localIso = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

interface CampaignRunControlsProps {
  userId: string;
  campaignContext: CampaignContext;
  campaignLabel: string;
  codeToContext: (code?: string | null) => CampaignContext;
  onChanged?: () => void;
}

export const CampaignRunControls: React.FC<CampaignRunControlsProps> = ({ userId, campaignContext, campaignLabel, codeToContext, onChanged }) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pause, setPause] = useState<CampaignPause | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const next = (await getCampaigns()).find((item) => codeToContext(item.code) === campaignContext) || null;
    setCampaign(next);
    const pauses = next ? await getCampaignPauses(next.id, true) : [];
    setPause(pauses.find((item) => isCampaignPausedOn([item], localIso())) || null);
  };

  useEffect(() => { setCampaign(null); setPause(null); void reload().catch(() => undefined); }, [campaignContext]);

  if (!campaign) return null;
  const stopped = pause?.reason === STOP_REASON;

  const endCurrent = async () => {
    if (!pause) return;
    if (pause.starts_on === localIso()) await deleteCampaignPause(pause);
    else await endCampaignPause(pause, localIso(-1));
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); await reload(); onChanged?.(); }
    catch (caught) { window.alert(caught instanceof Error ? caught.message : 'Action impossible.'); }
    finally { setBusy(false); }
  };

  const togglePause = async () => {
    if (pause) {
      const ok = await confirmAction({ title: stopped ? 'Relancer la campagne' : 'Reprendre la campagne', message: `${campaignLabel} reprend dès maintenant : les équipes peuvent de nouveau pointer.`, confirmLabel: stopped ? 'Relancer' : 'Reprendre' });
      if (ok) await run(endCurrent);
      return;
    }
    const ok = await confirmAction({ title: 'Mettre en pause', message: `${campaignLabel} est suspendue dès aujourd’hui jusqu’à la reprise. Les équipes ne peuvent plus pointer.`, confirmLabel: 'Mettre en pause' });
    if (ok) await run(async () => { await createCampaignPause({ campaign_id: campaign.id, starts_on: localIso(), reason: 'Pause', created_by: userId }); });
  };

  const stop = async () => {
    const ok = await confirmAction({ title: 'Arrêter la campagne', message: `${campaignLabel} est arrêtée dès aujourd’hui. Les équipes ne peuvent plus pointer ; vous pourrez la relancer avec Lecture.`, confirmLabel: 'Arrêter', tone: 'danger' });
    if (ok) await run(async () => { await endCurrent(); await createCampaignPause({ campaign_id: campaign.id, starts_on: localIso(), reason: STOP_REASON, created_by: userId }); });
  };

  return (
    <span className="campaign-run" data-state={stopped ? 'stopped' : pause ? 'paused' : 'running'}>
      <button type="button" onClick={() => void togglePause()} disabled={busy} className="campaign-run__btn" aria-label={pause ? (stopped ? 'Relancer la campagne' : 'Reprendre la campagne') : 'Mettre la campagne en pause'} title={pause ? 'Reprendre' : 'Pause'}>
        {pause ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </button>
      <button type="button" onClick={() => void stop()} disabled={busy || stopped} className="campaign-run__btn campaign-run__btn--stop" aria-label="Arrêter la campagne" title={stopped ? 'Campagne arrêtée' : 'Arrêter'}>
        <Square className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
};

export default CampaignRunControls;
