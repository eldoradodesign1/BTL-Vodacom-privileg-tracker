import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, RefreshCw, UserX } from 'lucide-react';
import type { AgentMasterStatus, Shop } from '../types';
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

const SegmentedGauge: React.FC<{ value: number; total: number }> = ({ value, total }) => {
  const fraction = total > 0 ? Math.min(value / total, 1) : 0;
  const cx = 150;
  const cy = 150;
  const segments = 26;
  const sweep = 115;
  const lit = Math.round(fraction * segments);
  const needle = ((-sweep + fraction * 2 * sweep) * Math.PI) / 180;
  const percent = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
  return (
    <svg viewBox="0 -14 300 214" className="mx-auto block h-auto w-full max-w-[26rem]" role="img" aria-label={`${percent} % de l’objectif du jour`}>
      {Array.from({ length: 61 }, (_, index) => {
        const angle = ((-sweep + index * ((2 * sweep) / 60)) * Math.PI) / 180;
        const major = index % 10 === 0;
        const inner = major ? 128 : 131;
        return <line key={`t${index}`} x1={cx + inner * Math.sin(angle)} y1={cy - inner * Math.cos(angle)} x2={cx + 137 * Math.sin(angle)} y2={cy - 137 * Math.cos(angle)} strokeWidth={major ? 1.6 : 1} style={{ stroke: 'var(--m-muted)', opacity: major ? 0.9 : 0.45 }} />;
      })}
      {Array.from({ length: segments }, (_, index) => {
        const degrees = -sweep + (index + 0.5) * ((2 * sweep) / segments);
        const mix = Math.round((1 - index / (segments - 1)) * 100);
        const style = index < lit
          ? { fill: `color-mix(in oklab, var(--m-chart-1) ${mix}%, var(--m-chart-2))`, filter: 'drop-shadow(0 0 4px color-mix(in srgb, var(--m-chart-1) 45%, transparent))' }
          : { fill: 'var(--m-track)' };
        return <rect key={`s${index}`} x={-6.5} y={-120} width={13} height={42} rx={6.5} transform={`translate(${cx} ${cy}) rotate(${degrees})`} style={style} />;
      })}
      <line x1={cx + 98 * Math.sin(needle)} y1={cy - 98 * Math.cos(needle)} x2={cx + 136 * Math.sin(needle)} y2={cy - 136 * Math.cos(needle)} strokeWidth={2.4} strokeLinecap="round" style={{ stroke: 'var(--m-text)' }} />
      <circle cx={cx + 136 * Math.sin(needle)} cy={cy - 136 * Math.cos(needle)} r={5} style={{ fill: 'var(--m-text)', filter: 'drop-shadow(0 0 6px var(--m-chart-2))' }} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={38} fontWeight={800} letterSpacing={-1} style={{ fill: 'var(--m-text)' }}>{`${String(percent).replace('.', ',')} %`}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={13} style={{ fill: 'var(--m-text-2)' }}>{`${value} / ${total} activations`}</text>
      {([['0', -sweep], ['50', 0], ['100', sweep]] as const).map(([label, degrees]) => {
        const angle = (degrees * Math.PI) / 180;
        return <text key={label} x={cx + 145.5 * Math.sin(angle)} y={cy - 150 * Math.cos(angle) + (degrees === 0 ? 4 : 14)} textAnchor="middle" fontSize={11} style={{ fill: 'var(--m-muted)' }}>{label}</text>;
      })}
    </svg>
  );
};

const RhythmChart: React.FC<{ actual: number[]; pace: number[]; currentHour: number }> = ({ actual, pace, currentHour }) => {
  const width = 280;
  const height = 150;
  const left = 24;
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
    <div>
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
            <text x={left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize={9} style={{ fill: 'var(--m-muted)' }}>{Math.round(tick)}</text>
          </g>
        ))}
        {HOURS.map((hour, index) => (index % 2 === 0 ? <text key={hour} x={x(index)} y={height - 6} textAnchor="middle" fontSize={9} style={{ fill: 'var(--m-muted)' }}>{`${hour}h`}</text> : null))}
        {line && <path d={`${line} L${points[points.length - 1][0]} ${y(0)} L${points[0][0]} ${y(0)} Z`} fill="url(#admin-rhythm-fill)" />}
        {line && <path d={line} fill="none" strokeWidth={2.2} style={{ stroke: 'var(--m-chart-1)' }} />}
        <path d={smooth(pace.map((value, index) => [x(index), y(value)] as [number, number]))} fill="none" strokeWidth={1.4} strokeDasharray="2 4" strokeLinecap="round" style={{ stroke: 'var(--m-text-2)' }} />
        {visible[peakIndex] > 0 && (
          <g>
            <line x1={x(peakIndex)} x2={x(peakIndex)} y1={y(visible[peakIndex])} y2={y(0)} strokeDasharray="3 3" style={{ stroke: 'var(--m-text-2)', opacity: 0.6 }} />
            <circle cx={x(peakIndex)} cy={y(visible[peakIndex])} r={4.5} strokeWidth={2} style={{ fill: 'var(--m-text)', stroke: 'var(--m-chart-1)' }} />
            <g transform={`translate(${Math.min(x(peakIndex) + 10, width - right - 86)} ${Math.max(y(visible[peakIndex]) + 6, top + 10)})`}>
              <rect x={0} y={-9} width={86} height={18} rx={9} style={{ fill: 'var(--m-sheet)', stroke: 'var(--m-hair)' }} />
              <text x={43} y={3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} style={{ fill: 'var(--m-text)' }}>{`${HOURS[peakIndex]}h · ${visible[peakIndex]} activation${visible[peakIndex] > 1 ? 's' : ''}`}</text>
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
  const atTarget = present.filter((hostess) => leadsOf(hostess).length >= dailyTarget(hostess.shopId)).length;

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
  const totalOf = (name: string) => pieData.find((item) => item.name === name)?.value ?? 0;

  return (
    <div className="admin-home space-y-4 animate-pop">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-[var(--m-text)]">Le terrain <span className="text-[var(--m-accent)]">aujourd’hui.</span></h2>
          <p className="text-sm text-[var(--m-text-2)]">{hostesses.length} hôtesses · actualisé à {updatedAt}</p>
        </div>
        <div className="admin-home-stats flex w-full sm:w-auto">
          <button type="button" onClick={onOpenLeads} className="min-w-0 flex-1 pr-4 text-left sm:w-32">
            <span className="block text-[1.65rem] font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{totalActivations}</span>
            <span className="block text-xs text-[var(--m-text-2)]">activations</span>
            <Sparkline values={last8.length > 1 ? last8 : [0, 0]} />
          </button>
          <button type="button" onClick={() => onOpenMonitoring('ALL')} className="min-w-0 flex-1 border-l border-[var(--m-edge-soft)] px-4 text-left sm:w-32">
            <span className="block text-[1.65rem] font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{present.length}<span className="text-lg text-[var(--m-muted)]"> / {hostesses.length}</span></span>
            <span className="block text-xs text-[var(--m-text-2)]">présentes</span>
            <Sparkline values={presenceTrend} />
          </button>
          <div className="min-w-0 flex-1 border-l border-[var(--m-edge-soft)] pl-4 sm:w-32">
            <span className="block text-[1.65rem] font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{todayLeads.length}</span>
            <span className="block text-xs text-[var(--m-text-2)]">aujourd’hui</span>
            <Sparkline values={cumulativeToday} />
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="glass-card space-y-3 !p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[var(--m-text)]">Objectif du jour</h3>
              <p className="text-xs text-[var(--m-text-2)]">Toutes offres · cibles des shops</p>
            </div>
          </div>
          <SegmentedGauge value={todayLeads.length} total={teamTarget} />
          <div className="mx-auto grid w-full max-w-[26rem] grid-cols-3 gap-2">
            {[['Privilège', 'var(--m-chart-1)'], ['Bundles', 'var(--m-chart-2)'], ['Roaming', 'var(--m-chart-3)']].map(([name, color]) => (
              <div key={name} className="grid grid-cols-[auto_1fr] items-center gap-x-2">
                <i className="row-span-2 block h-3 w-3 rounded-full" style={{ background: color }} />
                <b className="text-base font-extrabold leading-tight tabular-nums text-[var(--m-text)]">{totalOf(name)}</b>
                <span className="text-xs text-[var(--m-muted)]">{name} · total</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-[18px] bg-[var(--m-tile)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-sm text-[var(--m-text-2)]"><span>Hôtesses à leur cible du jour</span><b className="tabular-nums text-[var(--m-text)]">{atTarget} / {present.length}</b></div>
            <div className="flex gap-1 overflow-hidden" aria-hidden="true">
              {Array.from({ length: 48 }, (_, index) => <i key={index} className="block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: present.length > 0 && index < Math.round((48 * atTarget) / present.length) ? 'var(--m-chart-1)' : 'var(--m-track)' }} />)}
            </div>
          </div>
        </section>

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
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {absent.length > 0 && <TodoTile icon={<UserX className="h-5 w-5" />} count={absent.length} label={absent.length > 1 ? 'hôtesses non pointées' : 'hôtesse non pointée'} onClick={() => onOpenMonitoring('Absent')} />}
                {pendingSync > 0 && <TodoTile icon={<RefreshCw className="h-5 w-5" />} count={pendingSync} label={pendingSync > 1 ? 'saisies à synchroniser' : 'saisie à synchroniser'} />}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
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
              <div className="grid grid-cols-[2rem_1fr] gap-2 sm:grid-cols-[8rem_1fr]">
                <span />
                <div className="relative h-4 text-[0.75rem] text-[var(--m-muted)]">
                  {[8, 10, 12, 14, 16, 18].map((hour) => <span key={hour} className="absolute" style={{ left: position(hour), transform: hour === 8 ? 'none' : hour === 18 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{hour}h</span>)}
                </div>
              </div>
              {days.map(({ hostess, arrival, leave, activations, closed }) => (
                <div key={hostess.id} className="grid grid-cols-[2rem_1fr] items-center gap-2 sm:grid-cols-[8rem_1fr]">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--m-text)]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--m-chart-1)_50%,transparent)] bg-[color-mix(in_srgb,var(--m-chart-1)_22%,transparent)] text-[0.75rem] font-extrabold">{initials(hostess.name)}</span>
                    <span className="hidden truncate sm:block">{hostess.name}</span>
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
