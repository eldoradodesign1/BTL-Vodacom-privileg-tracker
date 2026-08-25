import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Download, FileText, Filter, MapPin, PauseCircle, PlayCircle, Plus, Save, Search, Target, UserRound, UsersRound } from 'lucide-react';
import type { CampaignPause, CampaignRun, MerchantFundRequest, User } from '../types';
import { createCampaignPause, deleteCampaignPause, endCampaignPause, getActiveCampaignRuns, getCampaignPauses, getMerchantCampaign, getMerchantFundRequests, getMerchantMonitoring, getMerchantPosControl, isCampaignPausedOn, MERCHANT_CAMPAIGN_START, merchantTodayIso, updateMerchantTargetSettings, type MerchantPosControlItem, type MerchantTeamActivity } from '../utils/merchantCampaign';
import { DateIconPicker } from './DateIconPicker';
import { MerchantBAOperationsModal } from './Modals/MerchantBAOperationsModal';
import { MerchantPosControlDetailModal } from './Modals/MerchantPosControlDetailModal';
import { MerchantPosCreateModal } from './Modals/MerchantPosCreateModal';
import { MerchantFundRequestDecisionModal } from './Modals/MerchantFundRequestDecisionModal';

interface MerchantSupervisorViewProps { currentUser: User; openFundRequestId?: string | null; onFundRequestOpened?: () => void; }
type MerchantOperation = 'profile' | 'report' | 'location' | 'calendar';
type PosFilter = 'all' | 'pending' | 'active' | 'inactive' | 'incomplete' | 'completed';
const POOLS = ['Tous', 'Funa', 'Lukunga', 'Mont amba', 'Tshangu'] as const;
const POS_PAGE_SIZE = 60;

export const MerchantSupervisorView: React.FC<MerchantSupervisorViewProps> = ({ currentUser, openFundRequestId, onFundRequestOpened }) => {
  const [run, setRun] = useState<CampaignRun | null>(null);
  const [team, setTeam] = useState<MerchantTeamActivity[]>([]);
  const [controls, setControls] = useState<MerchantPosControlItem[]>([]);
  const [query, setQuery] = useState('');
  const [pool, setPool] = useState<(typeof POOLS)[number]>('Tous');
  const [stateFilter, setStateFilter] = useState<PosFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<{ mode: MerchantOperation; activity: MerchantTeamActivity } | null>(null);
  const [selectedPos, setSelectedPos] = useState<MerchantPosControlItem | null>(null);
  const [isCreatePosOpen, setIsCreatePosOpen] = useState(false);
  const [posPage, setPosPage] = useState(1);
  const [targets, setTargets] = useState({ daily_pos_target: 15, transactions_per_pos_target: 3 });
  const [pauses, setPauses] = useState<CampaignPause[]>([]);
  const [pauseStart, setPauseStart] = useState(merchantTodayIso());
  const [pauseReason, setPauseReason] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [managementTab, setManagementTab] = useState<'ba' | 'pos' | 'mfs' | 'targets'>('ba');
  const [fundRequests, setFundRequests] = useState<MerchantFundRequest[]>([]);
  const [selectedFundRequest, setSelectedFundRequest] = useState<MerchantFundRequest | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const nextCampaign = await getMerchantCampaign();
      if (!nextCampaign) throw new Error('La campagne Merchant Educational Campaign est introuvable.');
      const runs = await getActiveCampaignRuns(nextCampaign.id);
      const activeRun = runs.find((item) => item.status === 'active') || runs[0] || null;
      if (!activeRun) throw new Error('Aucune vague Merchant active n’est disponible.');
      const [nextTeam, nextControls, nextPauses, nextFundRequests] = await Promise.all([getMerchantMonitoring(activeRun.id, merchantTodayIso()), getMerchantPosControl(activeRun), getCampaignPauses(nextCampaign.id), getMerchantFundRequests({ runId: activeRun.id })]);
      setRun(activeRun); setTeam(nextTeam); setControls(nextControls); setPauses(nextPauses); setFundRequests(nextFundRequests);
      setTargets({
        daily_pos_target: Number(activeRun.daily_pos_target || 15),
        transactions_per_pos_target: Number(activeRun.transactions_per_pos_target || 3),
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!openFundRequestId) return;
    const request = fundRequests.find((item) => item.id === openFundRequestId);
    if (request) {
      setManagementTab('ba');
      setSelectedFundRequest(request);
      onFundRequestOpened?.();
    }
  }, [fundRequests, onFundRequestOpened, openFundRequestId]);
  useEffect(() => { setPosPage(1); }, [query, pool, stateFilter]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return controls.filter((item) => {
      const matchesPool = pool === 'Tous' || item.pos.pool === pool;
      const matchesState = stateFilter === 'all' || item.status === stateFilter;
      const haystack = `${item.pos.agent_number} ${item.pos.denomination} ${item.pos.address} ${item.pos.mfs_name || ''} ${item.ba?.name || ''}`.toLowerCase();
      return matchesPool && matchesState && (!needle || haystack.includes(needle));
    });
  }, [controls, pool, query, stateFilter]);
  const inventoryCounts = useMemo(() => {
    const pools = Object.fromEntries(POOLS.slice(1).map((name) => [name, 0])) as Record<string, number>;
    const statuses: Record<PosFilter, number> = { all: controls.length, pending: 0, active: 0, inactive: 0, incomplete: 0, completed: 0 };
    controls.forEach((item) => {
      if (pools[item.pos.pool] !== undefined) pools[item.pos.pool] += 1;
      statuses[item.status] += 1;
    });
    return { pools, statuses };
  }, [controls]);
  const mfsGroups = useMemo(() => {
    const byMfs = new Map<string, MerchantPosControlItem[]>();
    controls.forEach((item) => {
      const key = item.pos.mfs_name?.trim() || 'Non renseigné';
      byMfs.set(key, [...(byMfs.get(key) || []), item]);
    });
    return Array.from(byMfs.entries()).sort(([a], [b]) => a.localeCompare(b, 'fr'));
  }, [controls]);
  const totalPosPages = Math.max(1, Math.ceil(filtered.length / POS_PAGE_SIZE));
  const safePosPage = Math.min(posPage, totalPosPages);
  const paginatedPos = filtered.slice((safePosPage - 1) * POS_PAGE_SIZE, safePosPage * POS_PAGE_SIZE);
  const actionButton = (activity: MerchantTeamActivity, mode: MerchantOperation, label: string, Icon: React.ElementType, enabled = true) => <button type="button" key={mode} disabled={!enabled} onClick={() => enabled && setOperation({ mode, activity })} title={label} className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${enabled ? 'border-white/10 bg-white/[0.05] text-gray-200 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100' : 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-gray-600'}`}><Icon size={16}/></button>;
  const statusMeta = (item: MerchantPosControlItem) => item.status === 'completed'
    ? { label: 'Complété', className: 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100', icon: CheckCircle2 }
    : item.status === 'inactive'
      ? { label: 'Non actif', className: 'border-amber-300/45 bg-amber-500/15 text-amber-100', icon: CircleDot }
      : item.status === 'incomplete'
        ? { label: 'Inachevé', className: 'border-rose-300/45 bg-rose-500/15 text-rose-100', icon: CircleDot }
      : item.status === 'active'
        ? { label: 'Actif', className: 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100', icon: CircleDot }
        : { label: 'À faire', className: 'border-violet-300/35 bg-violet-500/12 text-violet-100', icon: CircleDot };

  const currentPause = useMemo(() => pauses.find((pause) => isCampaignPausedOn([pause], merchantTodayIso())) || null, [pauses]);
  const pendingFundRequests = useMemo(() => fundRequests.filter((request) => request.status === 'pending'), [fundRequests]);
  const exportFundRequests = () => {
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'BA', 'Téléphone', 'Superviseur', 'MFS', 'POS', 'Short code', 'Montant', 'Statut', 'Note'],
      ...fundRequests.map((request) => [new Date(request.requested_at).toLocaleString('fr-FR'), request.ba?.name || request.ba_id, request.ba_phone || request.ba?.phone || '', request.supervisor?.name || 'Non affecté', request.mfs_name || '', request.point_of_sale?.denomination || '', request.point_of_sale?.agent_number || '', request.amount, request.status, request.note || '']),
    ];
    const blob = new Blob([rows.map((row) => row.map(escape).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `demandes-fonds-merchant-${merchantTodayIso()}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const fundStatusMeta = (status: MerchantFundRequest['status']) => status === 'approved'
    ? { label: 'Approuvée', className: 'bg-emerald-500/15 text-emerald-100' }
    : status === 'rejected'
      ? { label: 'Rejetée', className: 'bg-rose-500/15 text-rose-100' }
      : status === 'reviewed'
        ? { label: 'Consultée', className: 'bg-cyan-500/15 text-cyan-100' }
        : status === 'cancelled'
          ? { label: 'Annulée', className: 'bg-white/10 text-gray-300' }
          : { label: 'Nouvelle', className: 'bg-amber-500/15 text-amber-100' };
  const previousMerchantDay = useMemo(() => {
    const date = new Date(`${merchantTodayIso()}T12:00:00`);
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }, []);
  const savePause = async () => {
    if (!run) return;
    setSaving(true); setError('');
    try {
      await createCampaignPause({ campaign_id: run.campaign_id, starts_on: pauseStart, reason: pauseReason, created_by: currentUser.id });
      setPauseReason(''); setPauseOpen(false); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Mise en pause impossible.'); }
    finally { setSaving(false); }
  };
  const resumeCampaign = async () => {
    if (!currentPause) return;
    setSaving(true); setError('');
    try {
      if (currentPause.starts_on === merchantTodayIso()) await deleteCampaignPause(currentPause);
      else await endCampaignPause(currentPause, previousMerchantDay);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reprise de campagne impossible.'); }
    finally { setSaving(false); }
  };

  const saveTargets = async () => {
    if (!run) return;
    setSaving(true); setError('');
    try {
      const updated = await updateMerchantTargetSettings(run.id, targets);
      setRun(updated);
      setTargets({ daily_pos_target: updated.daily_pos_target, transactions_per_pos_target: updated.transactions_per_pos_target });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement des objectifs impossible.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="glass-card p-6 text-center text-xs font-black uppercase tracking-widest text-gray-400">Chargement de la Gestion Merchant…</div>;
  return <div className="space-y-4 pb-4">
    {error && <div className="rounded-2xl border border-red-400/40 bg-red-950/45 p-3 text-xs font-bold text-red-100">{error}</div>}
    <nav aria-label="Sections Gestion Merchant" className="flex rounded-2xl border border-white/10 bg-white/5 p-1">{([{ id: 'ba', label: 'BA', Icon: UsersRound }, { id: 'pos', label: 'POS', Icon: Filter }, { id: 'mfs', label: 'MFS', Icon: Target }, { id: 'targets', label: 'Targets', Icon: Save }] as const).map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => setManagementTab(id)} className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase transition-all ${managementTab === id ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><span className="inline-flex items-center justify-center gap-1"><Icon size={14}/><span>{label}</span></span></button>)}</nav>
    <div key={managementTab} className="merchant-management-panel space-y-4">

    {managementTab === 'targets' && <section className="glass-card relative overflow-hidden p-4"><div className="pointer-events-none absolute -right-8 -bottom-12 h-36 w-36 rounded-full bg-violet-400/[0.10] blur-3xl"/><div className="relative flex items-center gap-2"><Target className="text-violet-200" size={19}/><div><h2 className="font-black">Objectifs de campagne</h2><p className="text-xs text-gray-400">Les indicateurs s’appuient sur le référentiel POS et la cadence choisie.</p></div></div><div className="relative mt-4 grid grid-cols-[0.86fr_1.12fr_1.12fr] gap-1.5 sm:grid-cols-3 sm:gap-2"><div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.07] p-2 sm:p-3"><span className="block text-[8px] font-black uppercase tracking-[0.08em] text-cyan-100/75 sm:text-[9px]">POS campagne</span><b className="mt-1 block text-lg font-black text-white sm:text-xl">{controls.length}</b><span className="block text-[8px] font-bold text-cyan-100/55 sm:text-[9px]">Référentiel</span></div>{([{ key: 'daily_pos_target', label: 'POS / BA / jour', helper: 'Cadence quotidienne', min: 1 }, { key: 'transactions_per_pos_target', label: 'Transactions / POS', helper: 'Complétion POS', min: 1 }] as const).map((field) => <label key={field.key} className="group rounded-2xl border border-violet-300/20 bg-black/[0.22] p-2 transition focus-within:border-violet-200/60 focus-within:bg-violet-500/[0.08] sm:p-3"><span className="block text-[9px] font-black uppercase tracking-[0.1em] text-gray-400 transition group-focus-within:text-violet-100">{field.label}</span><input type="number" min={field.min} value={targets[field.key]} onChange={(event) => setTargets((current) => ({ ...current, [field.key]: Math.max(field.min, Number(event.target.value || field.min)) }))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/45 px-1 py-1.5 text-center text-base font-black text-white outline-none transition focus:border-violet-300/60 focus:ring-1 focus:ring-violet-300/25 sm:px-2 sm:text-xl"/><span className="mt-1 block text-[9px] font-bold text-gray-500">{field.helper}</span></label>)}</div><div className="relative mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void saveTargets()} className="inline-flex items-center gap-2 rounded-xl border border-violet-300/35 bg-violet-500/20 px-3 py-2 text-[10px] font-black uppercase text-violet-100 transition hover:bg-violet-500/30 disabled:opacity-50"><Save size={14}/>{saving ? 'Mise à jour…' : 'Enregistrer les objectifs'}</button></div></section>}

    {managementTab === 'targets' && <section className={`glass-card relative overflow-hidden p-4 ${currentPause ? 'border border-amber-300/35 bg-amber-500/[0.06]' : ''}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><PauseCircle className={currentPause ? 'text-amber-200' : 'text-gray-300'} size={19}/><div><h2 className="font-black">Pause de campagne</h2><p className="text-xs text-gray-400">Suspend les rappels de pointage pendant la période choisie, sans bloquer les saisies terrain.</p></div></div>{currentPause ? <button type="button" disabled={saving} onClick={() => void resumeCampaign()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-[9px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"><PlayCircle size={14}/>Reprendre</button> : <button type="button" onClick={() => setPauseOpen((value) => !value)} className="shrink-0 rounded-xl border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-[9px] font-black uppercase text-amber-100 transition hover:bg-amber-500/25">Mettre en pause</button>}</div>{currentPause ? <div className="mt-3 rounded-2xl border border-amber-300/20 bg-black/15 p-3 text-xs text-amber-50"><b className="block font-black uppercase text-[10px] text-amber-200">En pause depuis le {new Date(`${currentPause.starts_on}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</b>{currentPause.reason && <p className="mt-1 leading-relaxed">{currentPause.reason}</p>}</div> : pauseOpen && <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-black/15 p-3"><div className="flex items-center gap-2"><DateIconPicker value={pauseStart} min={MERCHANT_CAMPAIGN_START} max={merchantTodayIso()} onChange={setPauseStart} className="flex min-w-0 flex-1 items-center" buttonClassName="h-10 w-10 shrink-0 rounded-xl border border-amber-300/25 bg-amber-500/[0.08] text-amber-100" labelClassName="truncate text-[10px] font-black uppercase text-gray-200" popoverAlign="left"/><span className="text-[10px] font-bold text-gray-400">Début, y compris une date antérieure</span></div><textarea value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} rows={2} placeholder="Motif de la pause (facultatif)" className="app-input w-full resize-none rounded-2xl px-3 py-2.5 text-sm"/><button type="button" disabled={saving} onClick={() => void savePause()} className="w-full rounded-2xl border border-amber-300/35 bg-amber-500/15 px-4 py-3 text-[10px] font-black uppercase text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50">{saving ? 'Enregistrement…' : 'Confirmer la pause'}</button></div>}<div className="mt-3 flex flex-wrap gap-1.5">{pauses.slice(0, 4).map((pause) => <span key={pause.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-gray-400">{pause.starts_on}{pause.ends_on ? ` → ${pause.ends_on}` : ' → en cours'}</span>)}{pauses.length === 0 && <span className="text-[10px] text-gray-500">Aucune pause enregistrée.</span>}</div></section>}

    {managementTab === 'ba' && <section className="space-y-3"><section className={`glass-card overflow-hidden border ${pendingFundRequests.length ? 'border-emerald-300/30 bg-emerald-500/[0.05]' : 'border-white/10'}`}><div className="flex items-start justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-2"><Banknote className="text-emerald-200" size={19}/><div><h2 className="font-black">Demandes de fonds</h2><p className="text-xs text-gray-400">{pendingFundRequests.length ? `${pendingFundRequests.length} demande${pendingFundRequests.length > 1 ? 's' : ''} en attente de suivi.` : 'Aucune demande en attente.'}</p></div></div><button type="button" onClick={exportFundRequests} disabled={fundRequests.length === 0} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-[9px] font-black uppercase text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-40"><Download size={14}/>Exporter</button></div>{fundRequests.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto border-t border-white/10 p-3">{fundRequests.map((request) => <button type="button" key={request.id} onClick={() => setSelectedFundRequest(request)} className="w-full rounded-2xl border border-white/10 bg-black/15 p-3 text-left transition hover:border-emerald-300/35 hover:bg-emerald-500/[0.05]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{request.ba?.name || 'BA Merchant'}</b><p className="mt-1 text-[10px] text-gray-400">{request.point_of_sale?.denomination || 'POS non renseigné'} · {request.point_of_sale?.agent_number || '—'} · {request.mfs_name || 'MFS non renseigné'}</p></div><div className="shrink-0 text-right"><b className="block text-sm text-emerald-200">${Number(request.amount).toLocaleString('fr-FR')}</b><span className={`mt-1 inline-block rounded-lg px-2 py-1 text-[9px] font-black uppercase ${fundStatusMeta(request.status).className}`}>{fundStatusMeta(request.status).label}</span></div></div><p className="mt-2 text-[10px] text-gray-500">{new Date(request.requested_at).toLocaleString('fr-FR')} · Superviseur : {request.supervisor?.name || 'Non affecté'}</p>{request.note && <p className="mt-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs text-gray-300">{request.note}</p>}</button>)}</div>}</section><section className="glass-card overflow-hidden transition-colors hover:bg-white/[0.035]"><button type="button" aria-disabled="true" className="flex w-full items-center justify-between gap-3 p-4 text-left"><div className="flex items-center gap-2"><UsersRound className="text-cyan-200" size={19}/><div><h2 className="font-black">Agents Merchant</h2><p className="text-xs text-gray-400">Répertoire opérationnel · {team.length} BA</p></div></div><span className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black text-cyan-100">{team.length} BA</span></button><div className="space-y-2 border-t border-white/10 p-4 pt-3">{team.map((activity) => <div key={activity.ba.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{activity.ba.name}</b><p className="mt-0.5 text-[10px] text-gray-400">{activity.ba.phone} · {activity.visitedPosCount} POS · {activity.transactionCount} transactions</p></div><div className="flex shrink-0 items-center gap-1.5">{actionButton(activity, 'profile', 'Détail BA', UserRound)}{actionButton(activity, 'report', 'Aperçu rapport', FileText, Boolean(activity.attendance))}{actionButton(activity, 'location', 'Carte GPS intégrée', MapPin, Boolean(activity.attendance?.checkin_latitude != null || activity.attendance?.checkout_latitude != null))}{actionButton(activity, 'calendar', 'Calendrier présence', CalendarDays)}{activity.status === 'closed' && <CheckCircle2 size={17} className="ml-1 text-emerald-300"/>}</div></div>)}{team.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-gray-500">Aucun Brand Ambassador n’est chargé pour la date courante.</p>}</div></section></section>}
    {managementTab === 'pos' && <section className="merchant-inventory-shell glass-card space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Filter className="shrink-0 text-rose-200" size={19}/><div><h2 className="font-black">Inventaire et suivi des POS</h2><p className="text-xs text-gray-400">Un POS atteint {targets.transactions_per_pos_target} transactions pour être complété ; s’il est quitté ou clôturé avant, il apparaît Inachevé.</p></div></div><button type="button" onClick={() => setIsCreatePosOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-[10px] font-black uppercase text-cyan-100 transition hover:bg-cyan-400/20"><Plus size={14}/>Nouveau POS</button></div><div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2"><span className="text-[10px] font-bold text-gray-400">POS à faire</span><b className="text-sm font-black text-violet-100">{inventoryCounts.statuses.pending}</b></div><div className="grid grid-cols-3 gap-2 text-center">{([{ id: 'inactive', label: 'Inactifs', value: inventoryCounts.statuses.inactive, className: 'border-amber-300/25 bg-amber-500/[0.08] text-amber-100' }, { id: 'incomplete', label: 'Inachevés', value: inventoryCounts.statuses.incomplete, className: 'border-rose-300/25 bg-rose-500/[0.08] text-rose-100' }, { id: 'completed', label: 'Complétés', value: inventoryCounts.statuses.completed, className: 'border-emerald-300/25 bg-emerald-500/[0.08] text-emerald-100' }] as const).map((stat) => <button key={stat.id} type="button" onClick={() => setStateFilter(stat.id)} className={`rounded-2xl border p-2 transition ${stat.className} ${stateFilter === stat.id ? 'ring-1 ring-white/70' : 'opacity-80 hover:opacity-100'}`}><b className="block text-base font-black">{stat.value}</b><span className="text-[8px] font-black uppercase">{stat.label}</span></button>)}</div><div className="relative"><Search className="absolute left-3 top-3.5 text-gray-500" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Short code, nom, adresse, MFS ou BA" className="app-input w-full rounded-2xl py-3 pl-10 pr-4 text-sm"/></div><div className="flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setStateFilter('all')} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${stateFilter === 'all' ? 'border-rose-300/50 bg-rose-500/20 text-rose-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>Tous · {controls.length}</button>{POOLS.map((item) => <button type="button" key={item} onClick={() => setPool(item)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${pool === item ? 'border-rose-300/50 bg-rose-500/20 text-rose-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>{item}{item !== 'Tous' ? ` · ${inventoryCounts.pools[item] || 0}` : ''}</button>)}</div><div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">{paginatedPos.map((item) => { const meta = statusMeta(item); const StatusIcon = meta.icon; return <button type="button" key={item.pos.id} onClick={() => setSelectedPos(item)} className="group w-full rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-rose-300/35 hover:bg-white/[0.055]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm text-white">{item.pos.denomination}</b><p className="mt-0.5 text-[10px] font-black uppercase text-rose-200">{item.pos.agent_number} · {item.pos.pool}</p><p className="mt-1 line-clamp-1 text-[11px] text-gray-400">{item.pos.address}</p><p className="mt-1 line-clamp-1 text-[10px] font-bold text-fuchsia-200">MFS · {item.pos.mfs_name?.trim() || 'Non renseigné'}</p>{item.ba && <p className={`mt-1 text-[10px] font-bold ${item.status === 'completed' ? 'text-emerald-200' : item.status === 'inactive' ? 'text-amber-200' : 'text-cyan-200'}`}>{item.status === 'completed' ? 'Complété par ' : item.status === 'inactive' ? 'Non actif · constaté par ' : item.status === 'incomplete' ? 'Inachevé par ' : 'Actif avec '}{item.ba.name}</p>}</div><div className="flex shrink-0 flex-col items-end gap-2"><span className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-[9px] font-black uppercase ${meta.className}`}><StatusIcon size={12}/>{meta.label}</span><span className="rounded-lg bg-black/20 px-2 py-1 text-[10px] font-black text-gray-200">{item.status === 'inactive' ? 'Couvert' : `${item.transactionCount}/${targets.transactions_per_pos_target} Tx`}</span></div></div></button>; })}</div>{filtered.length > 0 && <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2"><p className="text-[10px] font-bold text-gray-400">{(safePosPage - 1) * POS_PAGE_SIZE + 1}–{Math.min(safePosPage * POS_PAGE_SIZE, filtered.length)} sur {filtered.length} POS</p><div className="flex items-center gap-1"><button type="button" onClick={() => setPosPage((page) => Math.max(1, page - 1))} disabled={safePosPage === 1} aria-label="Page précédente" className="rounded-lg border border-white/10 p-1.5 text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={14}/></button><span className="min-w-14 text-center text-[10px] font-black text-gray-200">{safePosPage}/{totalPosPages}</span><button type="button" onClick={() => setPosPage((page) => Math.min(totalPosPages, page + 1))} disabled={safePosPage === totalPosPages} aria-label="Page suivante" className="rounded-lg border border-white/10 p-1.5 text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight size={14}/></button></div></div>}</section>}
    {managementTab === 'mfs' && <section className="glass-card space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black">Répertoire MFS</h2><p className="mt-1 text-xs text-gray-400">Les MFS sont associés aux POS ; ouvrez un POS pour corriger son affectation.</p></div><span className="rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/[0.08] px-2.5 py-1.5 text-[10px] font-black text-fuchsia-100">{mfsGroups.length} MFS</span></div><div className="space-y-2">{mfsGroups.map(([mfs, items]) => <button key={mfs} type="button" onClick={() => { setQuery(mfs === 'Non renseigné' ? '' : mfs); setManagementTab('pos'); }} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/[0.06]"><div className="min-w-0"><b className="block truncate text-sm text-white">{mfs}</b><p className="mt-1 text-[10px] text-gray-400">{items.slice(0, 3).map((item) => item.pos.denomination).join(' · ')}{items.length > 3 ? '…' : ''}</p></div><span className="shrink-0 rounded-xl border border-fuchsia-300/20 bg-black/15 px-2 py-1 text-[10px] font-black text-fuchsia-100">{items.length} POS</span></button>)}{mfsGroups.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-gray-500">Aucun MFS n’est encore associé aux POS.</p>}</div></section>}
    </div>
    <MerchantFundRequestDecisionModal request={selectedFundRequest} currentUser={currentUser} onClose={() => setSelectedFundRequest(null)} onUpdated={() => void load()} />
    <MerchantBAOperationsModal isOpen={Boolean(operation)} mode={operation?.mode || 'profile'} activity={operation?.activity || null} run={run} onClose={() => setOperation(null)}/>
    <MerchantPosControlDetailModal item={selectedPos} transactionsPerPosTarget={targets.transactions_per_pos_target} onClose={() => setSelectedPos(null)} onUpdated={() => void load()}/>
    {run && <MerchantPosCreateModal campaignId={run.campaign_id} isOpen={isCreatePosOpen} onClose={() => setIsCreatePosOpen(false)} onCreated={() => { setIsCreatePosOpen(false); void load(); }}/>}
  </div>;
};
