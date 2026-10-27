import React, { useState } from 'react';
import { ChevronRight, RefreshCw, UserX } from 'lucide-react';
import type { AgentMasterStatus, Shop } from '../types';
import { CampaignProgressGauge, type ProgressMode } from './CampaignProgressGauge';
import { TargetBars, TargetRings, TrendChart, WelcomeHeader } from './DashboardKit';
import { getCheckins, getEffectiveTargetsForDate, getLeads, isMatchAgent, toISO } from '../utils/storage';

// Accueil administrateur Vodacom Privilège, même schéma que les autres campagnes :
// bienvenue, progression de la campagne, indicateurs du jour, courbe, barres, puis les actions et la frise du jour.

interface AdminHomeDashboardProps {
  userName: string;
  totalActivations: number;
  pieData: Array<{ name: string; value: number; color: string }>;
  hostesses: AgentMasterStatus[];
  shops: Shop[];
  onOpenLeads: () => void;
  onOpenMonitoring: (filter?: 'ALL' | 'Absent') => void;
  onRefresh?: () => void;
}

const CAMPAIGN_START = '2026-07-23';
const DAY_START = 8;
const DAY_END = 18;
const HOURS = Array.from({ length: DAY_END - DAY_START + 1 }, (_, index) => DAY_START + index);

const kinshasaHour = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour + minute / 60;
};

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
const shortLabel = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

const TodoTile: React.FC<{ icon: React.ReactNode; count: number; label: string; onClick?: () => void }> = ({ icon, count, label, onClick }) => (
  <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--color-amber-400)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-amber-400)_9%,transparent)] px-3 py-2.5 text-left">
    <span className="text-amber-400">{icon}</span>
    <span className="min-w-0">
      <b className="block text-lg leading-none text-[var(--m-text)]">{count}</b>
      <span className="block truncate text-xs text-[var(--m-text-2)]">{label}</span>
    </span>
    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--m-muted)]" />
  </button>
);

export const AdminHomeDashboard: React.FC<AdminHomeDashboardProps> = ({ userName, totalActivations, pieData, hostesses, shops, onOpenLeads, onOpenMonitoring, onRefresh }) => {
  const todayIso = toISO();
  const [day, setDay] = useState(todayIso);
  const isToday = day === todayIso;
  const currentHour = isToday ? kinshasaHour(new Date()) : DAY_END + 1;
  const leads = getLeads();
  const checkins = getCheckins();
  const pendingSync = leads.filter((lead) => lead.status === 'pending').length;

  const targetsOf = (date: string, shopId: string) => getEffectiveTargetsForDate(date, shopId);
  const sumTargets = (date: string, shopId: string) => {
    const targets = targetsOf(date, shopId);
    return targets.privilege + targets.roaming + targets.bundle;
  };

  // Journées pointées (hôtesse × jour) : base de l'objectif cumulé et du repère des courbes.
  const workedDays = new Map<string, { hostess: AgentMasterStatus; date: string }>();
  checkins.filter((checkin) => checkin.type === 'IN').forEach((checkin) => {
    const hostess = hostesses.find((item) => isMatchAgent(checkin.agent_id, item));
    if (!hostess) return;
    const date = toISO(checkin.timestamp);
    workedDays.set(`${hostess.id}|${date}`, { hostess, date });
  });
  const campaignTargets = Array.from(workedDays.values()).reduce((sum, worked) => {
    const targets = targetsOf(worked.date, worked.hostess.shopId);
    return { privilege: sum.privilege + targets.privilege, bundle: sum.bundle + targets.bundle, roaming: sum.roaming + targets.roaming };
  }, { privilege: 0, bundle: 0, roaming: 0 });
  const done = (name: string) => pieData.find((item) => item.name === name)?.value ?? 0;
  const campaignModes: ProgressMode[] = [
    { key: 'total', label: 'Total', value: totalActivations, target: campaignTargets.privilege + campaignTargets.bundle + campaignTargets.roaming, unit: 'activations' },
    { key: 'privilege', label: 'Privilège', value: done('Privilège'), target: campaignTargets.privilege, unit: 'opt-in', color: 'var(--m-chart-1)' },
    { key: 'bundles', label: 'Bundles', value: done('Bundles'), target: campaignTargets.bundle, unit: 'bundles', color: 'var(--m-chart-2)' },
    { key: 'roaming', label: 'Roaming', value: done('Roaming'), target: campaignTargets.roaming, unit: 'opt-in', color: 'var(--m-chart-3)' },
  ];

  // Jour consulté.
  const dayLeads = leads.filter((lead) => toISO(lead.timestamp) === day);
  const dayCheckins = checkins.filter((checkin) => toISO(checkin.timestamp) === day);
  const leadsOf = (hostess: AgentMasterStatus) => dayLeads.filter((lead) => isMatchAgent(lead.agent_id, hostess));
  const present = hostesses.filter((hostess) => dayCheckins.some((checkin) => checkin.type === 'IN' && isMatchAgent(checkin.agent_id, hostess)));
  const absent = isToday ? hostesses.filter((hostess) => hostess.status === 'Absent') : [];
  const dayTarget = present.reduce((sum, hostess) => sum + sumTargets(day, hostess.shopId), 0);
  const dayPrivilegeTarget = present.reduce((sum, hostess) => sum + targetsOf(day, hostess.shopId).privilege, 0);
  const atTarget = present.filter((hostess) => leadsOf(hostess).length >= sumTargets(day, hostess.shopId)).length;

  // Courbes : toute la campagne, 30 jours, heure par heure du jour consulté.
  const campaignDays: string[] = [];
  for (const cursor = new Date(`${CAMPAIGN_START}T12:00:00`); toISO(cursor) <= todayIso; cursor.setDate(cursor.getDate() + 1)) campaignDays.push(toISO(cursor));
  const leadsByDay = leads.reduce<Record<string, number>>((acc, lead) => { const date = toISO(lead.timestamp); acc[date] = (acc[date] || 0) + 1; return acc; }, {});
  const targetByDay = Array.from(workedDays.values()).reduce<Record<string, number>>((acc, worked) => { acc[worked.date] = (acc[worked.date] || 0) + sumTargets(worked.date, worked.hostess.shopId); return acc; }, {});
  const dailyView = (key: string, label: string, dates: string[]) => ({
    key,
    label,
    labels: dates.map(shortLabel),
    series: [{ key: 'leads', label: 'Activations', values: dates.map((date) => leadsByDay[date] || 0) }],
    target: dates.map((date) => targetByDay[date] || 0),
    targetLabel: 'Objectif du jour',
  });
  const visibleHours = HOURS.slice(0, Math.max(1, Math.min(HOURS.length, Math.floor(currentHour) - DAY_START + 1)));
  const hourlyView = {
    key: 'hours',
    label: 'Heure par heure',
    labels: visibleHours.map((hour) => `${hour}h`),
    series: [{ key: 'leads', label: 'Activations', values: visibleHours.map((hour) => dayLeads.filter((lead) => Math.floor(kinshasaHour(lead.timestamp)) === hour).length) }],
    target: visibleHours.map(() => Math.round((dayTarget / HOURS.length) * 10) / 10),
    targetLabel: 'Rythme objectif',
  };

  const shopRows = Array.from(new Set(hostesses.map((hostess) => hostess.shopId).filter(Boolean))).map((shopId) => {
    const staff = present.filter((hostess) => hostess.shopId === shopId);
    const name = shops.find((shop) => shop.id === shopId)?.name || hostesses.find((hostess) => hostess.shopId === shopId)?.shop || shopId;
    return {
      key: shopId,
      label: name.replace(/^shop\s+/i, ''),
      value: hostesses.filter((hostess) => hostess.shopId === shopId).reduce((sum, hostess) => sum + leadsOf(hostess).length, 0),
      target: staff.reduce((sum, hostess) => sum + sumTargets(day, hostess.shopId), 0),
    };
  });

  const days = present.map((hostess) => {
    const mine = dayCheckins.filter((checkin) => isMatchAgent(checkin.agent_id, hostess));
    const arrival = mine.filter((checkin) => checkin.type === 'IN').map((checkin) => kinshasaHour(checkin.timestamp)).sort((a, b) => a - b)[0];
    const leave = mine.filter((checkin) => checkin.type === 'OUT').map((checkin) => kinshasaHour(checkin.timestamp)).sort((a, b) => b - a)[0];
    return { hostess, arrival: arrival ?? DAY_START, leave, activations: leadsOf(hostess).map((lead) => kinshasaHour(lead.timestamp)), closed: leave !== undefined };
  });
  const position = (hour: number) => `${(Math.min(Math.max(hour, DAY_START), DAY_END) - DAY_START) * (100 / (DAY_END - DAY_START))}%`;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

  return (
    <div className="admin-home @container space-y-4 animate-pop">
      <WelcomeHeader
        eyebrow="Vodacom Privilège · pilotage"
        name={userName}
        subtitle={`${hostesses.length} hôtesses · activations Privilège, Bundles et Roaming`}
        date={day}
        minDate={CAMPAIGN_START}
        maxDate={todayIso}
        onDateChange={setDay}
        onRefresh={onRefresh}
      />

      <CampaignProgressGauge
        title="Progression"
        subtitle="Vodacom Privilège · toute la campagne"
        modes={campaignModes}
        note="Objectif cumulé : cible journalière du shop pour chaque journée pointée."
      >
        <button type="button" onClick={onOpenLeads} className="flex w-full items-center justify-between rounded-[18px] bg-[var(--m-tile)] px-3 py-2.5 text-sm font-semibold text-[var(--m-text)]">
          Voir la liste des activations
          <ChevronRight className="h-4 w-4 text-[var(--m-muted)]" aria-hidden="true" />
        </button>
      </CampaignProgressGauge>

      <TargetRings
        title="Indicateurs du jour"
        subtitle={dayLabel(day)}
        rings={[
          { label: 'Activations', value: dayLeads.length, target: dayTarget, color: 'var(--m-chart-1)' },
          { label: 'Privilège', value: dayLeads.filter((lead) => String(lead.action_type).includes('Privil')).length, target: dayPrivilegeTarget, color: 'var(--m-chart-2)' },
          { label: 'Présence', value: present.length, target: hostesses.length, color: 'var(--m-chart-3)', caption: `${present.length} / ${hostesses.length} hôtesses` },
          { label: 'À leur cible', value: atTarget, target: present.length, color: 'var(--m-accent)', caption: present.length ? `${atTarget} / ${present.length} pointées` : 'Aucune hôtesse pointée' },
        ]}
      />

      <TrendChart
        title="Progression des activations"
        subtitle="Réalisé et objectif des journées pointées"
        views={[dailyView('campaign', 'Campagne', campaignDays), dailyView('month', '30 jours', campaignDays.slice(-30)), hourlyView]}
      />

      <TargetBars
        title="Shops face à l’objectif"
        subtitle={`Activations du ${dayLabel(day)} · trait = cible des hôtesses pointées`}
        rows={shopRows}
        emptyText="Aucun shop actif."
        action={<button type="button" onClick={() => onOpenMonitoring('ALL')} className="shrink-0 text-sm font-semibold text-[var(--m-accent)]">Monitoring</button>}
      />

      {isToday && (absent.length > 0 || pendingSync > 0) && (
        <section className="glass-card !p-5">
          <h3 className="text-base font-bold text-[var(--m-text)]">À débloquer</h3>
          <div className="mt-3 flex flex-col gap-2 @xl:flex-row">
            {absent.length > 0 && <TodoTile icon={<UserX className="h-5 w-5" />} count={absent.length} label={absent.length > 1 ? 'hôtesses non pointées' : 'hôtesse non pointée'} onClick={() => onOpenMonitoring('Absent')} />}
            {pendingSync > 0 && <TodoTile icon={<RefreshCw className="h-5 w-5" />} count={pendingSync} label={pendingSync > 1 ? 'saisies à synchroniser' : 'saisie à synchroniser'} />}
          </div>
        </section>
      )}

      <section className="glass-card !p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[var(--m-text)]">Journées des hôtesses</h3>
            <p className="text-xs text-[var(--m-text-2)]">{dayLabel(day)} · arrivée, activations, départ</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--m-text-2)]">
            <span className="inline-flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-full border-2 border-emerald-400" />Arrivée</span>
            <span className="inline-flex items-center gap-1.5"><i className="block h-2 w-2 rotate-45 bg-[var(--m-chart-1)]" />Activation</span>
            <span className="inline-flex items-center gap-1.5"><i className="block h-2 w-2 rotate-45 border-[1.6px] border-amber-400" />Rapport attendu</span>
          </div>
        </div>
        {days.length === 0 ? (
          <p className="text-sm text-[var(--m-text-2)]">Aucune hôtesse n’a pointé ce jour.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[2rem_1fr] gap-2 @xl:grid-cols-[8rem_1fr]">
              <span />
              <div className="relative h-4 text-[0.75rem] text-[var(--m-muted)]">
                {[8, 10, 12, 14, 16, 18].map((hour) => <span key={hour} className="absolute" style={{ left: position(hour), transform: hour === 8 ? 'none' : hour === 18 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{hour}h</span>)}
              </div>
            </div>
            {days.map(({ hostess, arrival, leave, activations, closed }) => (
              <div key={hostess.id} className="grid grid-cols-[2rem_1fr] items-center gap-2 @xl:grid-cols-[8rem_1fr]">
                <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--m-text)]">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--m-chart-1)_50%,transparent)] bg-[color-mix(in_srgb,var(--m-chart-1)_22%,transparent)] text-[0.75rem] font-extrabold">{initials(hostess.name)}</span>
                  <span className="hidden truncate @xl:block">{hostess.name}</span>
                </span>
                <div className="relative h-5">
                  <span className="absolute top-1/2 h-px bg-[var(--m-edge-soft)]" style={{ left: position(arrival), width: `calc(${position(leave ?? DAY_END)} - ${position(arrival)})` }} />
                  <i className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400 bg-[var(--m-sheet)]" style={{ left: position(arrival) }} />
                  {activations.map((hour, index) => <i key={index} className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[var(--m-chart-1)]" style={{ left: position(hour) }} />)}
                  {!closed && <i className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-[1.6px] border-amber-400 bg-[var(--m-sheet)]" style={{ left: position(DAY_END) }} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminHomeDashboard;
