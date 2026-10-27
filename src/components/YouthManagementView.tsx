import React, { useEffect, useMemo, useState } from 'react';
import { Archive, BarChart3, CalendarDays, CheckCircle2, CircleAlert, PauseCircle, RefreshCw, Save, Target, UsersRound, type LucideIcon } from 'lucide-react';
import type { User } from '../types';
import { CampaignPauseControl } from './CampaignPauseControl';
import { DateIconPicker } from './DateIconPicker';
import { CampaignProgressGauge } from './CampaignProgressGauge';
import { TargetBars, TargetRings, TrendChart, WelcomeHeader } from './DashboardKit';
import { getYouthCampaign, getYouthOperatorAgents, getYouthOperatorArchive, saveYouthTargets, youthTodayIso, type YouthOperatorAgent } from '../utils/youthCampaign';

interface Props { currentUser: User; activeTab: 'home' | 'tab2' | 'tab3' | 'admin'; }
const isoStart = (campaignStart?: string | null) => campaignStart || '2026-10-12';
const labelDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });

// Actions qui comptent comme transactions : tout sauf « Aucun » et « Autre ».
const YOUTH_TRANSACTION_ACTIONS: Array<[string, string, string]> = [
  ['activation_bundle', 'Bundles', 'var(--m-chart-1)'],
  ['mpesa_account', 'Comptes M-Pesa', 'var(--m-chart-2)'],
  ['mpesa_app', 'App M-Pesa', 'var(--m-chart-3)'],
  ['f2f_optin', 'Optin F2F', 'var(--m-accent)'],
];

const YouthCampaignProgress: React.FC<{ rows: YouthOperatorAgent[]; dailyClients: number; dailyTransactions: number; campaignStart: string }> = ({ rows, dailyClients, dailyTransactions, campaignStart }) => {
  const workedDays = rows.reduce((sum, row) => sum + (row.workedDays || 0), 0);
  const contacts = rows.flatMap((row) => row.contacts);
  const countAction = (action: string) => contacts.filter((contact) => contact.actions.includes(action)).length;
  const transactions = YOUTH_TRANSACTION_ACTIONS.reduce((sum, [action]) => sum + countAction(action), 0);
  return (
    <CampaignProgressGauge
      title="Progression"
      subtitle={`Youth F2F · depuis le ${labelDate(campaignStart)}`}
      modes={[
        { key: 'contacts', label: 'Contacts', value: contacts.length, target: workedDays * dailyClients, unit: 'contacts' },
        { key: 'transactions', label: 'Transactions', value: transactions, target: workedDays * dailyTransactions, unit: 'transactions', color: 'var(--m-chart-2)' },
      ]}
      legend={YOUTH_TRANSACTION_ACTIONS.map(([action, label, color]) => ({ label, value: countAction(action), color }))}
      legendCaption="Transactions par action"
      note={dailyClients > 0 || dailyTransactions > 0
        ? `Objectif cumulé : target journalier × ${workedDays} journée${workedDays > 1 ? 's' : ''} pointée${workedDays > 1 ? 's' : ''}.`
        : 'Définissez les targets journaliers dans Gestion pour suivre la progression.'}
    />
  );
};

export const YouthManagementView: React.FC<Props> = ({ currentUser, activeTab }) => {
  const today = youthTodayIso();
  const [campaignId, setCampaignId] = useState('');
  const [campaignStart, setCampaignStart] = useState('2026-10-12');
  const [campaignName, setCampaignName] = useState('Youth F2F');
  const [agents, setAgents] = useState<YouthOperatorAgent[]>([]);
  const [archive, setArchive] = useState<YouthOperatorAgent[]>([]);
  const [campaignRows, setCampaignRows] = useState<YouthOperatorAgent[]>([]);
  const [date, setDate] = useState(today);
  const [startDate, setStartDate] = useState('2026-10-12');
  const [endDate, setEndDate] = useState(today);
  const [dailyClients, setDailyClients] = useState(0);
  const [dailyTransactions, setDailyTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSupervisor = currentUser.role === 'supervisor';
  const supervisorId = isSupervisor ? currentUser.id : undefined;
  const load = async (soft = false) => {
    if (soft) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const campaign = await getYouthCampaign();
      if (!campaign) throw new Error('La campagne Youth F2F est introuvable.');
      const start = isoStart(campaign.starts_on);
      setCampaignId(campaign.id); setCampaignName(campaign.name); setCampaignStart(start); setStartDate((current) => current === '2026-10-12' ? start : current);
      setDate((current) => current < start ? start : current);
      setDailyClients(Number(campaign.daily_pos_target || 0)); setDailyTransactions(Number(campaign.transactions_per_pos_target || 0));
      const rows = await getYouthOperatorAgents(campaign.id, date < start ? start : date, supervisorId);
      setAgents(rows);
      if (activeTab === 'home') setCampaignRows(await getYouthOperatorArchive(campaign.id, start, today, supervisorId));
      if (activeTab === 'tab3') setArchive(await getYouthOperatorArchive(campaign.id, startDate < start ? start : startDate, endDate < start ? start : endDate, supervisorId));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement Youth F2F impossible.'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { void load(); }, [date, startDate, endDate, activeTab, currentUser.id]);

  const metrics = useMemo(() => ({
    total: agents.length,
    checked: agents.filter((row) => Boolean(row.attendance?.checkin_at)).length,
    closed: agents.filter((row) => Boolean(row.attendance?.checkout_at)).length,
    contacts: agents.reduce((sum, row) => sum + row.contacts.length, 0),
  }), [agents]);

  const isTransaction = (actions: string[]) => actions.some((action) => YOUTH_TRANSACTION_ACTIONS.some(([key]) => key === action));
  const dayTransactions = agents.reduce((sum, row) => sum + row.contacts.filter((contact) => isTransaction(contact.actions)).length, 0);
  const campaignDates: string[] = [];
  for (const cursor = new Date(`${campaignStart}T12:00:00`); cursor.toISOString().slice(0, 10) <= today; cursor.setDate(cursor.getDate() + 1)) campaignDates.push(cursor.toISOString().slice(0, 10));
  const contactsByDay = campaignRows.flatMap((row) => row.contacts).reduce<Record<string, { contacts: number; transactions: number }>>((acc, contact) => {
    const entry = acc[contact.activity_date] || { contacts: 0, transactions: 0 };
    entry.contacts += 1;
    if (isTransaction(contact.actions)) entry.transactions += 1;
    acc[contact.activity_date] = entry;
    return acc;
  }, {});
  const presenceByDay = campaignRows.flatMap((row) => row.attendanceDates || []).reduce<Record<string, number>>((acc, day) => { acc[day] = (acc[day] || 0) + 1; return acc; }, {});

  const saveTargets = async () => {
    if (!campaignId) return;
    setSaving(true); setError('');
    try { await saveYouthTargets(campaignId, { dailyClients, dailyTransactions }); await load(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer les targets Youth F2F.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="glass-card p-7 text-center text-xs font-black uppercase tracking-[0.18em] text-gray-400">Chargement du cockpit Youth F2F…</div>;
  const displayRows = activeTab === 'tab3' ? archive : agents;
  const metricCards: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: 'BA affectés', value: metrics.total, Icon: UsersRound },
    { label: 'Pointés', value: metrics.checked, Icon: CheckCircle2 },
    { label: 'Clôturés', value: metrics.closed, Icon: Archive },
    { label: 'Contacts', value: metrics.contacts, Icon: BarChart3 },
  ];
  return <div className="space-y-4 pb-6">
    {error && <div className="glass-card flex items-center gap-2 border border-red-400/30 bg-red-500/[0.08] p-3 text-xs font-bold text-red-100"><CircleAlert size={16}/>{error}</div>}
    {activeTab === 'home' && <div className="campaign-home">
      <WelcomeHeader
        eyebrow={`${campaignName} · pilotage`}
        name={currentUser.name}
        subtitle={`Sensibilisation terrain · ${metrics.total} BA affectés`}
        date={date}
        minDate={campaignStart}
        maxDate={today}
        onDateChange={setDate}
        onRefresh={() => void load(true)}
        refreshing={refreshing}
      />
      <YouthCampaignProgress rows={campaignRows} dailyClients={dailyClients} dailyTransactions={dailyTransactions} campaignStart={campaignStart}/>
      <TargetRings
        title="Indicateurs du jour"
        subtitle={labelDate(date)}
        rings={[
          { label: 'Contacts', value: metrics.contacts, target: dailyClients * metrics.checked, color: 'var(--m-chart-1)' },
          { label: 'Transactions', value: dayTransactions, target: dailyTransactions * metrics.checked, color: 'var(--m-chart-2)' },
          { label: 'Présence', value: metrics.checked, target: metrics.total, color: 'var(--m-chart-3)', caption: `${metrics.checked} / ${metrics.total} BA` },
          { label: 'Clôtures', value: metrics.closed, target: metrics.checked, color: 'var(--m-accent)', caption: metrics.checked ? `${metrics.closed} / ${metrics.checked} pointés` : 'Aucun BA pointé' },
        ]}
      />
      <TrendChart
        title="Progression du terrain"
        subtitle="Contacts et transactions par jour"
        views={[{ key: 'campaign', label: 'Campagne', dates: campaignDates }, { key: 'month', label: '30 jours', dates: campaignDates.slice(-30) }].map(({ key, label, dates }) => ({
          key,
          label,
          labels: dates.map((day) => `${day.slice(8)}/${day.slice(5, 7)}`),
          series: [
            { key: 'contacts', label: 'Contacts', values: dates.map((day) => contactsByDay[day]?.contacts || 0) },
            { key: 'transactions', label: 'Transactions', values: dates.map((day) => contactsByDay[day]?.transactions || 0) },
          ],
          target: dailyClients > 0 ? dates.map((day) => (presenceByDay[day] || 0) * dailyClients) : undefined,
          targetLabel: 'Objectif contacts',
        }))}
      />
      <TargetBars
        title="BA face à l’objectif"
        subtitle={`Contacts du ${labelDate(date)} · trait = target journalier`}
        rows={agents.filter((row) => row.attendance?.checkin_at || row.contacts.length > 0).map((row) => ({ key: row.user.id, label: row.user.name, value: row.contacts.length, target: dailyClients }))}
        emptyText="Aucun BA pointé ce jour."
      />
    </div>}
    {activeTab === 'admin' ? <>
      <section className="glass-card p-4"><div className="flex items-start gap-2"><Target className="text-red-300" size={19}/><div><h2 className="font-black text-white">Targets Youth F2F</h2><p className="text-xs text-gray-400">Objectifs journaliers utilisés pour le suivi de la campagne.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><label className="rounded-2xl border border-red-300/20 bg-black/20 p-3"><span className="block text-[0.6875rem] font-black uppercase text-gray-400">Contacts / BA / jour</span><input type="number" min="0" value={dailyClients} onChange={(e) => setDailyClients(Math.max(0, Number(e.target.value || 0)))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-center text-xl font-black text-white"/></label><label className="rounded-2xl border border-violet-300/20 bg-black/20 p-3"><span className="block text-[0.6875rem] font-black uppercase text-gray-400">Transactions / jour</span><input type="number" min="0" value={dailyTransactions} onChange={(e) => setDailyTransactions(Math.max(0, Number(e.target.value || 0)))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-center text-xl font-black text-white"/></label></div><button type="button" disabled={saving} onClick={() => void saveTargets()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-300/35 bg-red-500/15 px-3 py-2.5 text-[0.75rem] font-black uppercase text-red-300 disabled:opacity-50"><Save size={14}/>{saving ? 'Mise à jour…' : 'Enregistrer les targets'}</button></section>
      <CampaignPauseControl currentUser={currentUser} campaignCode="youth-f2f" campaignLabel="Youth F2F" minDate={campaignStart} accent="violet"/>
      {currentUser.role === 'super_admin' && <section className="glass-card border border-fuchsia-300/20 bg-fuchsia-400/[0.05] p-4"><p className="text-[0.75rem] font-black uppercase tracking-[0.14em] text-fuchsia-100">Connexion à la base</p><p className="mt-1 text-[0.6875rem] text-gray-400">La configuration Supabase, Gemini, le schéma, l’export et le cache restent accessibles depuis le bouton Paramètres de la base.</p></section>}
    </> : activeTab === 'tab3' ? <section className="glass-card p-4"><div className="flex items-center gap-2"><CalendarDays className="text-red-300" size={18}/><h2 className="font-black text-white">Archives Youth F2F</h2></div><div className="mt-3 grid grid-cols-2 gap-2"><DateIconPicker value={startDate} min={campaignStart} max={today} onChange={setStartDate} className="flex items-center" buttonClassName="h-9 w-9 rounded-xl border border-white/10" labelClassName="truncate text-[0.6875rem] font-black uppercase"/><DateIconPicker value={endDate} min={campaignStart} max={today} onChange={setEndDate} className="flex items-center" buttonClassName="h-9 w-9 rounded-xl border border-white/10" labelClassName="truncate text-[0.6875rem] font-black uppercase"/></div><div className="mt-3 space-y-2">{displayRows.length === 0 ? <p className="p-4 text-center text-xs text-gray-500">Aucune activité enregistrée sur cette période.</p> : displayRows.map((row) => <div key={row.user.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between"><b className="text-xs text-white">{row.user.name}</b><span className="text-[0.6875rem] font-black text-red-300">{row.contacts.length} contact(s)</span></div><p className="mt-1 text-[0.75rem] text-gray-500">{row.attendance ? `${labelDate(row.attendance.activity_date)} · ${row.attendance.checkout_at ? 'clôturé' : 'pointé'}` : 'Aucun pointage sur la période affichée'}</p></div>)}</div></section> : activeTab === 'tab2' ? <section className="glass-card p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-[0.75rem] font-black uppercase tracking-[0.14em] text-red-300">Monitoring Youth F2F</p><h2 className="mt-1 font-black text-white">Activité du {labelDate(date)}</h2></div><DateIconPicker value={date} min={campaignStart} max={today} onChange={setDate} className="flex items-center" buttonClassName="h-9 w-9 rounded-xl border border-white/10" labelClassName="truncate text-[0.6875rem] font-black uppercase"/></div><div className="space-y-2">{displayRows.length === 0 ? <p className="rounded-2xl border border-white/10 p-4 text-center text-xs text-gray-500">Aucun BA Youth affecté ou aucune activité enregistrée.</p> : displayRows.map((row) => <div key={row.user.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-2"><div><b className="block text-xs text-white">{row.user.name}</b><span className="text-[0.75rem] text-gray-500">{row.user.phone}</span></div><span className={`rounded-full px-2 py-1 text-[0.6875rem] font-black uppercase ${row.attendance?.checkin_at ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{row.attendance?.checkout_at ? 'Clôturé' : row.attendance?.checkin_at ? 'Pointé' : 'Non pointé'}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><span className="rounded-xl bg-black/15 p-2"><b className="block text-sm text-white">{row.contacts.length}</b><small className="text-[0.6875rem] uppercase text-gray-500">Contacts</small></span><span className="rounded-xl bg-black/15 p-2"><b className="block text-sm text-white">{row.attendance?.checkin_at ? new Date(row.attendance.checkin_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</b><small className="text-[0.6875rem] uppercase text-gray-500">Arrivée</small></span><span className="rounded-xl bg-black/15 p-2"><b className="block text-sm text-white">{row.attendance?.checkout_at ? new Date(row.attendance.checkout_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</b><small className="text-[0.6875rem] uppercase text-gray-500">Départ</small></span></div></div>)}</div></section> : null}
  </div>;
};
