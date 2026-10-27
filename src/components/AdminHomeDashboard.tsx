import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, RefreshCw, UserX } from 'lucide-react';
import type { AgentMasterStatus, Shop } from '../types';
import { CampaignProgressGauge, type ProgressMode } from './CampaignProgressGauge';
import { getCheckins, getEffectiveTargetsForDate, getLeads, isMatchAgent, toISO } from '../utils/storage';

// Accueil administrateur : chiffres clés, objectif du jour, rythme horaire, actions à débloquer,
// journées des hôtesses et shops face à l'objectif. Toutes les couleurs viennent de la matière du thème.

interface AdminHomeDashboardProps {
  totalActivations: number;
  pieData: Array<{ name: string; value: number; color: string }>;
  rollingLineData: Array<{ date: string; value: number }>;
  hostesses: AgentMasterStatus[];
  shops: Shop[];
  onOpenLeads: () => void;
  onOpenMonitoring: (filter?: 'ALL' | 'Absent') => void;
}

const DAY_START = 8;
const DAY_END = 18;
const HOURS = Array.from({ length: DAY_END - DAY_START + 1 }, (_, index) => DAY_START + index);

const kinshasaHour = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour + minute / 60;
};

const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => `${(index * 100) / Math.max(values.length - 1, 1)},${19 - ((value - min) / (max - min || 1)) * 16}`);
  return (
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" className="mt-1 block h-5 w-full" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" style={{ stroke: 'var(--m-chart-1)' }} />
    </svg>
  );
};

const RhythmChart: React.FC<{ actual: number[]; pace: number[]; currentHour: number }> = ({ actual, pace, currentHour }) => {
  // Le graphique se dessine à la largeur réelle de sa carte : les libellés gardent leur taille en mobile comme en bureau.
  const frame = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(520);
  React.useEffect(() => {
    const node = frame.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const height = 170;
  const left = 28;
  const right = 8;
  const top = 18;
  const bottom = 22;
  const max = Math.max(5, Math.ceil(Math.max(...actual, ...pace) / 5) * 5);
  const x = (index: number) => left + (index * (width - left - right)) / (HOURS.length - 1);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const visible = actual.slice(0, Math.max(1, Math.min(HOURS.length, Math.floor(currentHour) - DAY_START + 1)));
  const smooth = (points: Array<[number, number]>) => {
    let path = `M${points[0][0]} ${points[0][1]}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const p0 = points[index - 1] || points[index];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[index + 2] || p2;
      path += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
    }
    return path;
  };
  const points = visible.map((value, index) => [x(index), y(value)] as [number, number]);
  const peakIndex = visible.indexOf(Math.max(...visible));
  const line = points.length > 1 ? smooth(points) : '';
  const ticks = Array.from({ length: 5 }, (_, index) => (max / 4) * index);
  return (
    <div ref={frame}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label="Activations par heure aujourd’hui">
        <defs>
          <linearGradient id="admin-rhythm-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--m-chart-1)', stopOpacity: 0.55 }} />
            <stop offset="1" style={{ stopColor: 'var(--m-chart-1)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} style={{ stroke: 'var(--m-edge-soft)' }} />
            <text x={left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize={11} style={{ fill: 'var(--m-muted)' }}>{Math.round(tick)}</text>
          </g>
        ))}
        {HOURS.map((hour, index) => (index % 2 === 0 ? <text key={hour} x={x(index)} y={height - 6} textAnchor="middle" fontSize={11} style={{ fill: 'var(--m-muted)' }}>{`${hour}h`}</text> : null))}
        {line && <path d={`${line} L${points[points.length - 1][0]} ${y(0)} L${points[0][0]} ${y(0)} Z`} fill="url(#admin-rhythm-fill)" />}
        {line && <path d={line} fill="none" strokeWidth={2.2} style={{ stroke: 'var(--m-chart-1)' }} />}
        <path d={smooth(pace.map((value, index) => [x(index), y(value)] as [number, number]))} fill="none" strokeWidth={1.4} strokeDasharray="2 4" strokeLinecap="round" style={{ stroke: 'var(--m-text-2)' }} />
        {visible[peakIndex] > 0 && (
          <g>
            <line x1={x(peakIndex)} x2={x(peakIndex)} y1={y(visible[peakIndex])} y2={y(0)} strokeDasharray="3 3" style={{ stroke: 'var(--m-text-2)', opacity: 0.6 }} />
            <circle cx={x(peakIndex)} cy={y(visible[peakIndex])} r={4.5} strokeWidth={2} style={{ fill: 'var(--m-text)', stroke: 'var(--m-chart-1)' }} />
            <g transform={`translate(${Math.min(x(peakIndex) + 10, width - right - 104)} ${Math.max(y(visible[peakIndex]) + 6, top + 10)})`}>
              <rect x={0} y={-11} width={104} height={22} rx={11} style={{ fill: 'var(--m-sheet)', stroke: 'var(--m-hair)' }} />
              <text x={52} y={4} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--m-text)' }}>{`${HOURS[peakIndex]}h · ${visible[peakIndex]} activation${visible[peakIndex] > 1 ? 's' : ''}`}</text>
            </g>
          </g>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--m-text-2)]">
        <span className="inline-flex items-center gap-1.5"><i className="block h-0.5 w-3.5 rounded bg-[var(--m-chart-1)]" />Activations</span>
        <span className="inline-flex items-center gap-1.5"><i className="block w-3.5 border-t-2 border-dotted border-[var(--m-text-2)]" />Rythme objectif</span>
      </div>
    </div>
  );
};

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

export const AdminHomeDashboard: React.FC<AdminHomeDashboardProps> = ({ totalActivations, pieData, rollingLineData, hostesses, shops, onOpenLeads, onOpenMonitoring }) => {
  const todayIso = toISO();
  const now = new Date();
  const currentHour = kinshasaHour(now);
  const leads = getLeads();
  const checkins = getCheckins();
  const todayLeads = leads.filter((lead) => toISO(lead.timestamp) === todayIso);
  const todayCheckins = checkins.filter((checkin) => toISO(checkin.timestamp) === todayIso);
  const pendingSync = leads.filter((lead) => lead.status === 'pending').length;

  const dailyTarget = (shopId: string) => {
    const targets = getEffectiveTargetsForDate(todayIso, shopId);
    return targets.privilege + targets.roaming + targets.bundle;
  };
  const present = hostesses.filter((hostess) => hostess.status !== 'Absent');
  const absent = hostesses.filter((hostess) => hostess.status === 'Absent');
  const teamTarget = hostesses.reduce((sum, hostess) => sum + dailyTarget(hostess.shopId), 0);
  const leadsOf = (hostess: AgentMasterStatus) => todayLeads.filter((lead) => isMatchAgent(lead.agent_id, hostess));

  // Progression de toute la campagne : chaque journée pointée d'une hôtesse ajoute la cible journalière de son shop.
  const workedDays = new Map<string, { date: string; shopId: string }>();
  checkins.filter((checkin) => checkin.type === 'IN').forEach((checkin) => {
    const hostess = hostesses.find((item) => isMatchAgent(checkin.agent_id, item));
    if (!hostess) return;
    const date = toISO(checkin.timestamp);
    workedDays.set(`${hostess.id}|${date}`, { date, shopId: hostess.shopId });
  });
  const campaignTargets = Array.from(workedDays.values()).reduce((sum, day) => {
    const targets = getEffectiveTargetsForDate(day.date, day.shopId);
    return { privilege: sum.privilege + targets.privilege, bundle: sum.bundle + targets.bundle, roaming: sum.roaming + targets.roaming };
  }, { privilege: 0, bundle: 0, roaming: 0 });
  const done = (name: string) => pieData.find((item) => item.name === name)?.value ?? 0;
  const campaignModes: ProgressMode[] = [
    { key: 'total', label: 'Total', value: totalActivations, target: campaignTargets.privilege + campaignTargets.bundle + campaignTargets.roaming, unit: 'activations' },
    { key: 'privilege', label: 'Privilège', value: done('Privilège'), target: campaignTargets.privilege, unit: 'opt-in', color: 'var(--m-chart-1)' },
    { key: 'bundles', label: 'Bundles', value: done('Bundles'), target: campaignTargets.bundle, unit: 'bundles', color: 'var(--m-chart-2)' },
    { key: 'roaming', label: 'Roaming', value: done('Roaming'), target: campaignTargets.roaming, unit: 'opt-in', color: 'var(--m-chart-3)' },
  ];
  const actualByHour = HOURS.map((hour) => todayLeads.filter((lead) => Math.floor(kinshasaHour(lead.timestamp)) === hour).length);
  const pace = HOURS.map(() => Math.round((teamTarget / HOURS.length) * 10) / 10);
  const dayProgress = Math.min(Math.max((currentHour - DAY_START) / (DAY_END - DAY_START), 0), 1);

  const last8 = rollingLineData.slice(-8).map((item) => item.value);
  const cumulativeToday = HOURS.map((_, index) => actualByHour.slice(0, index + 1).reduce((sum, value) => sum + value, 0)).slice(0, Math.max(2, Math.floor(currentHour) - DAY_START + 1));
  const presenceTrend = Array.from({ length: 8 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (7 - index));
    const iso = toISO(day);
    return new Set(checkins.filter((checkin) => checkin.type === 'IN' && toISO(checkin.timestamp) === iso).map((checkin) => checkin.agent_id)).size;
  });

  const shopRows = Array.from(new Set(hostesses.map((hostess) => hostess.shopId).filter(Boolean))).map((shopId) => {
    const staff = hostesses.filter((hostess) => hostess.shopId === shopId);
    const done = staff.reduce((sum, hostess) => sum + leadsOf(hostess).length, 0);
    const target = staff.reduce((sum, hostess) => sum + dailyTarget(hostess.shopId), 0);
    const name = shops.find((shop) => shop.id === shopId)?.name || staff[0]?.shop || shopId;
    return { shopId, name: name.replace(/^shop\s+/i, ''), percent: target > 0 ? Math.round((done / target) * 100) : 0 };
  }).sort((a, b) => b.percent - a.percent);

  const days = present.map((hostess) => {
    const mine = todayCheckins.filter((checkin) => isMatchAgent(checkin.agent_id, hostess));
    const arrival = mine.filter((checkin) => checkin.type === 'IN').map((checkin) => kinshasaHour(checkin.timestamp)).sort((a, b) => a - b)[0];
    const leave = mine.filter((checkin) => checkin.type === 'OUT').map((checkin) => kinshasaHour(checkin.timestamp)).sort((a, b) => b - a)[0];
    return {
      hostess,
      arrival: arrival ?? DAY_START,
      leave,
      activations: leadsOf(hostess).map((lead) => kinshasaHour(lead.timestamp)),
      closed: hostess.status === 'Clôturé'
    };
  });
  const position = (hour: number) => `${(Math.min(Math.max(hour, DAY_START), DAY_END) - DAY_START) * (100 / (DAY_END - DAY_START))}%`;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  const updatedAt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit' }).format(now);

  return (
    <div className="admin-home @container space-y-4 animate-pop">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-[var(--m-text)]">Le terrain <span className="text-[var(--m-accent)]">aujourd’hui.</span></h2>
          <p className="text-sm text-[var(--m-text-2)]">{hostesses.length} hôtesses · actualisé à {updatedAt}</p>
        </div>
        <div className="admin-home-stats flex w-full @xl:w-auto">
          <button type="button" onClick={onOpenLeads} className="min-w-0 flex-1 pr-4 text-left @xl:w-32">
            <span className="block text-[1.65rem] font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{totalActivations}</span>
            <span className="block text-xs text-[var(--m-text-2)]">activations</span>
            <Sparkline values={last8.length > 1 ? last8 : [0, 0]} />
          </button>
          <button type="button" onClick={() => onOpenMonitoring('ALL')} className="min-w-0 flex-1 border-l border-[var(--m-edge-soft)] px-4 text-left @xl:w-32">
            <span className="block text-[1.65rem] font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{present.length}<span className="text-lg text-[var(--m-muted)]"> / {hostesses.length}</span></span>
            <span className="block text-xs text-[var(--m-text-2)]">présentes</span>
            <Sparkline values={presenceTrend} />
          </button>
          <div className="min-w-0 flex-1 border-l border-[var(--m-edge-soft)] pl-4 @xl:w-32">
            <span className="block text-[1.65rem] font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{todayLeads.length}</span>
            <span className="block text-xs text-[var(--m-text-2)]">aujourd’hui</span>
            <Sparkline values={cumulativeToday} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <CampaignProgressGauge
          title="Progression"
          subtitle="Vodacom Privilège · toute la campagne"
          modes={campaignModes}
          note="Objectif cumulé : cible journalière du shop pour chaque journée pointée."
        />

        <div className="space-y-4">
          <section className="glass-card !p-5">
            <h3 className="text-base font-bold text-[var(--m-text)]">Le rythme du jour</h3>
            <p className="mb-2 text-xs text-[var(--m-text-2)]">Activations par heure</p>
            <RhythmChart actual={actualByHour} pace={pace} currentHour={currentHour} />
          </section>
          <section className="glass-card !p-5">
            <h3 className="text-base font-bold text-[var(--m-text)]">À débloquer</h3>
            {absent.length === 0 && pendingSync === 0 ? (
              <p className="mt-1 text-sm text-[var(--m-text-2)]">Rien en attente : toutes les hôtesses ont pointé et tout est synchronisé.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2 @xl:flex-row">
                {absent.length > 0 && <TodoTile icon={<UserX className="h-5 w-5" />} count={absent.length} label={absent.length > 1 ? 'hôtesses non pointées' : 'hôtesse non pointée'} onClick={() => onOpenMonitoring('Absent')} />}
                {pendingSync > 0 && <TodoTile icon={<RefreshCw className="h-5 w-5" />} count={pendingSync} label={pendingSync > 1 ? 'saisies à synchroniser' : 'saisie à synchroniser'} />}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="glass-card !p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[var(--m-text)]">Journées des hôtesses</h3>
              <p className="text-xs text-[var(--m-text-2)]">Arrivée, activations, rapport de fin</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--m-text-2)]">
              <span className="inline-flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-full border-2 border-emerald-400" />Arrivée</span>
              <span className="inline-flex items-center gap-1.5"><i className="block h-2 w-2 rotate-45 bg-[var(--m-chart-1)]" />Activation</span>
              <span className="inline-flex items-center gap-1.5"><i className="block h-2 w-2 rotate-45 border-[1.6px] border-amber-400" />Rapport attendu</span>
            </div>
          </div>
          {days.length === 0 ? (
            <p className="text-sm text-[var(--m-text-2)]">Aucune hôtesse n’a encore pointé aujourd’hui.</p>
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

        <section className="glass-card space-y-3 !p-5">
          <div>
            <h3 className="text-base font-bold text-[var(--m-text)]">Shops face à l’objectif</h3>
            <p className="text-xs text-[var(--m-text-2)]">Trait : cible attendue à cette heure</p>
          </div>
          <div className="space-y-3.5">
            {shopRows.map((row) => (
              <div key={row.shopId} className="grid grid-cols-[5.5rem_1fr_2.75rem] items-center gap-3 text-sm">
                <span className="truncate text-[var(--m-text)]">{row.name}</span>
                <div className="relative h-2.5 rounded-full bg-[var(--m-track)]">
                  <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(row.percent, 100)}%`, background: 'linear-gradient(90deg, var(--m-chart-3), var(--m-chart-1))' }} />
                  <b className="absolute -bottom-1 -top-1 w-0.5 rounded bg-[var(--m-text)]" style={{ left: `${dayProgress * 100}%` }} />
                </div>
                <span className="text-right font-bold tabular-nums text-[var(--m-text)]">{row.percent} %</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onOpenMonitoring('ALL')} className="btn-neon btn-red !min-h-0 !w-auto !px-4 !py-2.5 !normal-case !tracking-normal ml-auto">Ouvrir le monitoring<ChevronRight className="h-4 w-4" /></button>
        </section>
      </div>

      <section className="glass-card !p-5">
        <h3 className="text-base font-bold text-[var(--m-text)]">Évolution journalière des leads</h3>
        <p className="mb-3 text-xs text-[var(--m-text-2)]">30 derniers jours</p>
        <div className="overflow-x-auto">
          <div className="h-48 min-w-[40rem]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rollingLineData} margin={{ left: -18, right: 12, top: 6 }}>
                <defs>
                  <linearGradient id="admin-leads-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--m-chart-1)" stopOpacity={0.45} />
                    <stop offset="1" stopColor="var(--m-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--m-edge-soft)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--m-muted)" fontSize={12} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="var(--m-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--m-sheet)', borderColor: 'var(--m-hair)', borderRadius: '12px', fontSize: '12px', color: 'var(--m-text)' }} itemStyle={{ color: 'var(--m-text)', fontWeight: 700 }} labelStyle={{ color: 'var(--m-text-2)' }} formatter={(value) => [value, 'Leads']} />
                <Area type="monotone" dataKey="value" stroke="var(--m-chart-1)" strokeWidth={2.4} fill="url(#admin-leads-fill)" dot={false} activeDot={{ r: 5, fill: 'var(--m-text)', stroke: 'var(--m-chart-1)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminHomeDashboard;
