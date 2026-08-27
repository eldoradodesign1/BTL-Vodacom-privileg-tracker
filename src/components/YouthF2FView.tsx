import React from 'react';
import { CalendarClock, CirclePause, GraduationCap, LockKeyhole, MapPinned, ShieldCheck, Target, UsersRound } from 'lucide-react';
import type { User } from '../types';

interface YouthF2FViewProps {
  currentUser: User;
}

const PreparationItem: React.FC<{
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  detail: string;
}> = ({ icon: Icon, title, detail }) => (
  <div className="rounded-2xl border border-white/10 bg-black/15 p-3.5 opacity-70">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-gray-400">
        <Icon size={15} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-300">{title}</p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-500">{detail}</p>
      </div>
    </div>
  </div>
);

export const YouthF2FView: React.FC<YouthF2FViewProps> = ({ currentUser }) => {
  const isOperator = currentUser.role !== 'agent';
  const firstName = currentUser.name.trim().split(/\s+/)[0] || 'équipe';

  return (
    <section className="animate-fade-in space-y-4 pb-4">
      <div className="glass-card relative overflow-hidden border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.66),rgba(18,24,39,0.74),rgba(30,41,59,0.62))] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/20">
            <GraduationCap size={23} strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Youth F2F · Force de frappe</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Campagne en préparation</h1>
            <p className="mt-2 max-w-xl text-[12px] font-medium leading-relaxed text-slate-300">
              Bonjour {firstName}. Le dispositif de sensibilisation universitaire n’est pas encore lancé. La consultation reste disponible, tandis que les actions terrain sont volontairement verrouillées.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card border border-amber-300/15 bg-amber-400/[0.045] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-300/10 text-amber-200"><CirclePause size={18} /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Statut : suspendue avant lancement</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-400">
              Aucune date, aucun objectif et aucune activité n’ont été fixés. Aucun pointage, choix d’université ou rapport ne peut être enregistré tant que l’opérateur n’a pas ouvert la campagne.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Espace terrain</p>
            <h2 className="mt-1 text-sm font-black text-white">Fonctionnalités à activer</h2>
          </div>
          <span className="rounded-full border border-gray-500/20 bg-gray-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">Verrouillé</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <PreparationItem icon={MapPinned} title="Pointage photo & GPS" detail="Disponible à l’ouverture de la campagne." />
          <PreparationItem icon={GraduationCap} title="Université du jour" detail="Affectation quotidienne à confirmer par l’encadrement." />
          <PreparationItem icon={Target} title="Targets" detail="En attente de la matrice officielle de sensibilisation." />
        </div>
      </div>

      {isOperator && (
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200/15 bg-violet-300/10 text-violet-200"><ShieldCheck size={18} /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-100">Préparation opérateur</p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-400">
                Les universités de référence, les équipes et les affectations quotidiennes pourront être définies au lancement. Les champs de calendrier et d’objectifs restent volontairement absents jusqu’à validation de la matrice.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <PreparationItem icon={UsersRound} title="Équipe Youth" detail="Agents affectés à Alpha Okito, superviseur de campagne." />
            <PreparationItem icon={CalendarClock} title="Calendrier" detail="Aucune plage opérationnelle n’est créée avant le feu vert." />
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 py-2 text-center text-[10px] font-bold text-gray-600">
        <LockKeyhole size={12} />
        <span>Les données des autres campagnes restent indépendantes.</span>
      </div>
    </section>
  );
};
