import React, { useEffect, useState } from 'react';
import { CalendarDays, FileText, LockKeyhole, MapPin, Medal, RefreshCw, Trophy, UserRound } from 'lucide-react';
import type { CampaignRun } from '../types';
import { getActiveCampaignRuns, getMerchantCampaign, getMerchantPodium, type MerchantPodiumEntry } from '../utils/merchantCampaign';
import { MerchantBAOperationsModal } from './Modals/MerchantBAOperationsModal';
import { MerchantSupervisorReportsModal } from './Modals/MerchantSupervisorReportsModal';

type MerchantOperation = 'profile' | 'report' | 'location' | 'calendar';
const medals = [
  { key: 'gold', label: '1er', color: 'text-amber-200', border: 'border-amber-300/45 bg-amber-500/[0.12]', image: '/podium-trophies/gold-trophy.png' },
  { key: 'silver', label: '2e', color: 'text-slate-100', border: 'border-slate-200/40 bg-slate-300/[0.09]', image: '/podium-trophies/silver-trophy.png' },
  { key: 'bronze', label: '3e', color: 'text-orange-200', border: 'border-orange-400/40 bg-orange-500/[0.11]', image: '/podium-trophies/bronze-trophy.png' },
];

export const MerchantPodiumView: React.FC = () => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [podium, setPodium] = useState<MerchantPodiumEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<{ mode: MerchantOperation; entry: MerchantPodiumEntry } | null>(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getMerchantCampaign();
      if (!campaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(campaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      if (!activeRun) throw new Error('Aucune vague Merchant active n’est disponible.');
      setRun(activeRun);
      setPodium(await getMerchantPodium(activeRun.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement du podium Merchant impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Classement Merchant en préparation…</div>;

  const leader = podium[0];
  const platinum = podium.find((entry) => entry.platinumStreak >= 5);
  const actionButton = (entry: MerchantPodiumEntry, mode: MerchantOperation, label: string, Icon: React.ElementType, enabled = true) => <button type="button" title={label} disabled={!enabled} onClick={() => enabled && setOperation({ mode, entry })} className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${enabled ? 'border-white/10 bg-black/15 text-white/80 hover:border-cyan-200/40 hover:bg-cyan-400/10 hover:text-cyan-100' : 'cursor-not-allowed border-white/[0.05] text-gray-600'}`}><Icon size={14}/></button>;

  return <div className="space-y-4 pb-4">
    <section className="glass-card relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-amber-400/[0.12] blur-3xl"/>
      <div className="pointer-events-none absolute -left-14 bottom-0 h-40 w-40 rounded-full bg-slate-300/[0.08] blur-3xl"/>
      <div className="relative flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/80">Podium de performance</p><div className="flex gap-2"><button type="button" onClick={() => setIsReportsOpen(true)} title="Rapports superviseur" className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-100 transition hover:bg-cyan-400/20"><FileText size={17}/></button><button type="button" onClick={() => void load()} title="Actualiser le podium" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-gray-200 transition hover:bg-white/10"><RefreshCw size={17}/></button></div></div>
      <div className="relative mt-4 space-y-3">

    {error && <div className="rounded-2xl border border-rose-400/40 bg-rose-950/45 p-3 text-xs font-bold text-rose-100">{error}</div>}
    {platinum && <section className="glass-card relative overflow-hidden border border-slate-200/40 bg-[radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.35),transparent_38%),linear-gradient(135deg,rgba(192,192,192,0.18),rgba(104,112,122,0.22))] p-4"><img src="/podium-trophies/platinum-trophy.png" alt="" className="pointer-events-none absolute -right-7 -bottom-12 h-44 w-44 rotate-[-16deg] object-contain opacity-25"/><div className="relative flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100/55 bg-white/15 text-slate-100"><Trophy size={23}/></div><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-100">Coupe platine</p><h2 className="mt-0.5 text-sm font-black text-white">{platinum.activity.ba.name} domine depuis {platinum.platinumStreak} journées</h2><p className="mt-0.5 text-[10px] text-slate-200">Distinction automatique dès cinq premières places consécutives.</p></div></div></section>}

      {podium.map((entry, index) => {
        const medal = medals[index];
        const firstArrival = new Date(entry.firstArrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return <article key={entry.activity.ba.id} className={`relative overflow-hidden rounded-[24px] border p-4 shadow-[0_16px_36px_rgba(0,0,0,0.20)] ${medal.border}`}>
          <img src={medal.image} alt="" className="pointer-events-none absolute -right-5 -bottom-12 h-44 w-44 -rotate-12 object-contain opacity-25"/>
          <div className="relative flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/15 text-lg font-black ${medal.color}`}>{medal.label}</div><div className="min-w-0"><p className={`text-[9px] font-black uppercase tracking-[0.16em] ${medal.color}`}>Coupe {medal.key === 'gold' ? 'or' : medal.key === 'silver' ? 'argent' : 'bronze'}</p><h2 className="truncate text-base font-black text-white">{entry.activity.ba.name}</h2><p className="mt-0.5 text-[10px] text-gray-300">{entry.activity.transactionCount}/{entry.dailyTransactionTarget} transactions · {entry.activity.visitedPosCount}/{entry.dailyPosTarget} POS · {Number(entry.activity.totalAmount).toLocaleString('fr-FR')}</p></div></div><div className="flex shrink-0 gap-1">{actionButton(entry, 'profile', 'Détail BA', UserRound)}{actionButton(entry, 'report', 'Rapport BA', FileText, Boolean(entry.activity.attendance))}{actionButton(entry, 'location', 'Pointage GPS', MapPin, Boolean(entry.activity.attendance?.checkin_latitude != null))}{actionButton(entry, 'calendar', 'Calendrier BA', CalendarDays)}</div></div>
          <div className="relative mt-3 flex flex-wrap gap-2">{entry.isLocked && <div className="inline-flex items-center gap-1 rounded-xl border border-amber-200/35 bg-amber-200/[0.12] px-2 py-1 text-[9px] font-black uppercase text-amber-100"><LockKeyhole size={12}/> Place verrouillée{entry.targetReachedAt ? ` · objectif atteint à ${new Date(entry.targetReachedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>}{!entry.isLocked && <div className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/10 px-2 py-1 text-[9px] font-black uppercase text-gray-300">Volume en cours · premier POS {firstArrival}</div>}{entry.platinumStreak > 0 && <div className="inline-flex items-center gap-1 rounded-xl border border-slate-100/20 bg-slate-100/[0.10] px-2 py-1 text-[9px] font-black uppercase text-slate-100"><Medal size={12}/> Série de tête : {entry.platinumStreak}/5</div>}</div>
        </article>;
      })}
      {!podium.length && <div className="rounded-2xl border border-white/10 bg-black/15 p-6 text-center text-sm text-gray-400">Le podium apparaîtra après les premières arrivées POS de la journée.</div>}
      </div>
    </section>
    <MerchantBAOperationsModal isOpen={Boolean(operation)} mode={operation?.mode || 'profile'} activity={operation?.entry.activity || null} run={run} onClose={() => setOperation(null)}/>
    <MerchantSupervisorReportsModal isOpen={isReportsOpen} run={run} onClose={() => setIsReportsOpen(false)}/>
  </div>;
};
