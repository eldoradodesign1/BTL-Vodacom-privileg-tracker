import React, { useEffect, useMemo, useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import type { Campaign, CampaignPause, User } from '../types';
import { createCampaignPause, deleteCampaignPause, endCampaignPause, getCampaignPauses, getCampaigns, isCampaignPausedOn } from '../utils/merchantCampaign';
import { DateIconPicker } from './DateIconPicker';

interface CampaignPauseControlProps {
  currentUser: User;
  campaignCode: string;
  campaignLabel: string;
  minDate: string;
  accent?: 'amber' | 'violet';
}

const localIso = () => new Date().toISOString().slice(0, 10);

export const CampaignPauseControl: React.FC<CampaignPauseControlProps> = ({ currentUser, campaignCode, campaignLabel, minDate, accent = 'amber' }) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pauses, setPauses] = useState<CampaignPause[]>([]);
  const [startsOn, setStartsOn] = useState(localIso());
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = async () => {
    const campaigns = await getCampaigns();
    const nextCampaign = campaigns.find((item) => item.code === campaignCode) || null;
    setCampaign(nextCampaign);
    setPauses(nextCampaign ? await getCampaignPauses(nextCampaign.id, true) : []);
  };

  useEffect(() => { void reload().catch((caught) => setError(caught instanceof Error ? caught.message : 'Pause indisponible.')); }, [campaignCode]);

  const currentPause = useMemo(() => pauses.find((pause) => isCampaignPausedOn([pause], localIso())) || null, [pauses]);
  const previousDay = useMemo(() => {
    const date = new Date(`${localIso()}T12:00:00`);
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }, []);
  const theme = accent === 'violet'
    ? { border: 'border-violet-300/30', surface: 'bg-violet-500/[0.07]', text: 'text-violet-100', icon: 'text-violet-200', button: 'border-violet-300/35 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25' }
    : { border: 'border-amber-300/30', surface: 'bg-amber-500/[0.07]', text: 'text-amber-100', icon: 'text-amber-200', button: 'border-amber-300/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25' };

  const savePause = async () => {
    if (!campaign) return;
    setSaving(true); setError('');
    try {
      await createCampaignPause({ campaign_id: campaign.id, starts_on: startsOn, reason, created_by: currentUser.id });
      setReason(''); setExpanded(false); await reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Mise en pause impossible.'); }
    finally { setSaving(false); }
  };
  const resume = async () => {
    if (!currentPause) return;
    setSaving(true); setError('');
    try {
      if (currentPause.starts_on === localIso()) await deleteCampaignPause(currentPause);
      else await endCampaignPause(currentPause, previousDay);
      await reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reprise impossible.'); }
    finally { setSaving(false); }
  };

  return <section className={`relative overflow-hidden rounded-2xl border p-4 ${theme.border} ${theme.surface}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><PauseCircle size={18} className={currentPause ? theme.icon : 'text-gray-300'}/><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-200">Pause {campaignLabel}</p><p className="mt-0.5 text-[10px] text-gray-400">Suspend les rappels, sans bloquer les saisies terrain.</p></div></div>{currentPause ? <button type="button" disabled={saving} onClick={() => void resume()} className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-2 text-[9px] font-black uppercase transition disabled:opacity-45 ${theme.button}`}><PlayCircle size={13}/>Reprendre</button> : <button type="button" disabled={!campaign} onClick={() => setExpanded((value) => !value)} className={`shrink-0 rounded-xl border px-2.5 py-2 text-[9px] font-black uppercase transition disabled:opacity-45 ${theme.button}`}>Mettre en pause</button>}</div>
    {currentPause ? <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3"><p className={`text-[10px] font-black uppercase ${theme.text}`}>En pause depuis le {new Date(`${currentPause.starts_on}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>{currentPause.reason && <p className="mt-1 text-xs text-gray-200">{currentPause.reason}</p>}</div> : expanded && <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/15 p-3"><div className="flex items-center gap-2"><DateIconPicker value={startsOn} min={minDate} max={localIso()} onChange={setStartsOn} className="flex min-w-0 flex-1 items-center" buttonClassName="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.05] text-gray-200" labelClassName="truncate text-[10px] font-black uppercase text-gray-200" popoverAlign="left"/><span className="text-[10px] font-bold text-gray-400">Date de début, même antérieure</span></div><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Motif (facultatif)" className="app-input w-full resize-none rounded-xl px-3 py-2 text-sm"/><button type="button" disabled={saving} onClick={() => void savePause()} className={`w-full rounded-xl border px-3 py-2.5 text-[10px] font-black uppercase transition disabled:opacity-45 ${theme.button}`}>{saving ? 'Enregistrement…' : 'Confirmer la pause'}</button></div>}
    {error && <p className="mt-2 text-[10px] font-bold text-rose-200">{error}</p>}
  </section>;
};
