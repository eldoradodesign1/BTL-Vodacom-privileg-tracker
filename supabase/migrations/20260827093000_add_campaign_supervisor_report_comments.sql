alter table public.superviseur_commentaires_quotidiens
  add column if not exists campaign_code text not null default 'privilege';

alter table public.superviseur_commentaires_hebdomadaires
  add column if not exists campaign_code text not null default 'privilege';

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'superviseur_commentaires_quotidiens_date_unique') then
    alter table public.superviseur_commentaires_quotidiens drop constraint superviseur_commentaires_quotidiens_date_unique;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'superviseur_commentaires_quotidiens_campaign_date_unique') then
    alter table public.superviseur_commentaires_quotidiens add constraint superviseur_commentaires_quotidiens_campaign_date_unique unique (campaign_code, date);
  end if;
  if exists (select 1 from pg_constraint where conname = 'superviseur_commentaires_hebdo_semaine_unique') then
    alter table public.superviseur_commentaires_hebdomadaires drop constraint superviseur_commentaires_hebdo_semaine_unique;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'superviseur_commentaires_hebdo_campaign_week_unique') then
    alter table public.superviseur_commentaires_hebdomadaires add constraint superviseur_commentaires_hebdo_campaign_week_unique unique (campaign_code, semaine, debut, fin);
  end if;
end $$;

create table if not exists public.campaign_supervisor_report_comments (
  id uuid primary key default gen_random_uuid(),
  campaign_code text not null check (campaign_code in ('merchant', 'privilege')),
  report_kind text not null check (report_kind in ('daily', 'weekly', 'compiled')),
  starts_on date not null,
  ends_on date not null,
  comment text not null,
  ai_generated boolean not null default false,
  updated_by_user_id text references public.users(id) on delete set null,
  source_comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_code, report_kind, starts_on, ends_on),
  check (starts_on <= ends_on)
);

alter table public.campaign_supervisor_report_comments enable row level security;

drop policy if exists campaign_supervisor_report_comments_select on public.campaign_supervisor_report_comments;
create policy campaign_supervisor_report_comments_select on public.campaign_supervisor_report_comments for select using (true);
drop policy if exists campaign_supervisor_report_comments_insert on public.campaign_supervisor_report_comments;
create policy campaign_supervisor_report_comments_insert on public.campaign_supervisor_report_comments for insert with check (true);
drop policy if exists campaign_supervisor_report_comments_update on public.campaign_supervisor_report_comments;
create policy campaign_supervisor_report_comments_update on public.campaign_supervisor_report_comments for update using (true) with check (true);

create or replace function public.save_campaign_supervisor_report_comment(
  p_campaign_code text,
  p_report_kind text,
  p_starts_on date,
  p_ends_on date,
  p_comment text,
  p_ai_generated boolean default false,
  p_updated_by_user_id text default null,
  p_source_comments jsonb default '[]'::jsonb,
  p_metrics jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week integer := extract(week from p_starts_on)::integer;
  v_total integer := coalesce((p_metrics->>'total')::integer, 0);
  v_privilege integer := coalesce((p_metrics->>'privilege')::integer, 0);
  v_roaming integer := coalesce((p_metrics->>'roaming')::integer, 0);
  v_bundle integer := coalesce((p_metrics->>'bundle')::integer, 0);
  v_people integer := coalesce((p_metrics->>'activePeople')::integer, 0);
  v_shops integer := coalesce((p_metrics->>'shops')::integer, 0);
  v_average numeric := coalesce((p_metrics->>'average')::numeric, 0);
  v_peak integer := coalesce((p_metrics->>'peak')::integer, 0);
  v_activity text := coalesce(nullif(p_metrics->>'activityLevel', ''), 'À qualifier');
begin
  if p_campaign_code not in ('merchant', 'privilege') or p_report_kind not in ('daily', 'weekly', 'compiled') then
    raise exception 'Périmètre de rapport invalide';
  end if;
  if p_starts_on > p_ends_on or btrim(coalesce(p_comment, '')) = '' then
    raise exception 'Période ou commentaire invalide';
  end if;

  insert into public.campaign_supervisor_report_comments (
    campaign_code, report_kind, starts_on, ends_on, comment, ai_generated, updated_by_user_id, source_comments
  ) values (
    p_campaign_code, p_report_kind, p_starts_on, p_ends_on, btrim(p_comment), p_ai_generated, p_updated_by_user_id, coalesce(p_source_comments, '[]'::jsonb)
  ) on conflict (campaign_code, report_kind, starts_on, ends_on) do update set
    comment = excluded.comment,
    ai_generated = excluded.ai_generated,
    updated_by_user_id = excluded.updated_by_user_id,
    source_comments = excluded.source_comments,
    updated_at = now();

  if p_report_kind = 'daily' then
    insert into public.superviseur_commentaires_quotidiens (
      campaign_code, date, jour, niveau_activite, activations, variation_vs_jour_precedent,
      hotesses_declarees, hotesses_avec_activation, hotesses_a_zero, shops_declares,
      activations_par_hotesse, privilege, roaming, bundle, commentaire_superviseur
    ) values (
      p_campaign_code, p_starts_on, to_char(p_starts_on, 'FMDay'), v_activity, v_total,
      coalesce((p_metrics->>'variation')::numeric, 0), v_people, v_people, 0, v_shops,
      v_average, v_privilege, v_roaming, v_bundle, btrim(p_comment)
    ) on conflict (campaign_code, date) do update set
      jour = excluded.jour, niveau_activite = excluded.niveau_activite, activations = excluded.activations,
      variation_vs_jour_precedent = excluded.variation_vs_jour_precedent,
      hotesses_declarees = excluded.hotesses_declarees, hotesses_avec_activation = excluded.hotesses_avec_activation,
      hotesses_a_zero = excluded.hotesses_a_zero, shops_declares = excluded.shops_declares,
      activations_par_hotesse = excluded.activations_par_hotesse, privilege = excluded.privilege,
      roaming = excluded.roaming, bundle = excluded.bundle, commentaire_superviseur = excluded.commentaire_superviseur,
      updated_at = now();
  elsif p_report_kind = 'weekly' then
    insert into public.superviseur_commentaires_hebdomadaires (
      campaign_code, semaine, debut, fin, jours_reporting, activations_totales,
      moyenne_activations_jour, pic_activite, date_pic, hotesses_moyennes, shops_moyens, commentaire_superviseur
    ) values (
      p_campaign_code, v_week, p_starts_on, p_ends_on,
      (p_ends_on - p_starts_on + 1), v_total, v_average, v_peak, p_ends_on,
      v_people, v_shops, btrim(p_comment)
    ) on conflict (campaign_code, semaine, debut, fin) do update set
      jours_reporting = excluded.jours_reporting, activations_totales = excluded.activations_totales,
      moyenne_activations_jour = excluded.moyenne_activations_jour, pic_activite = excluded.pic_activite,
      date_pic = excluded.date_pic, hotesses_moyennes = excluded.hotesses_moyennes,
      shops_moyens = excluded.shops_moyens, commentaire_superviseur = excluded.commentaire_superviseur,
      updated_at = now();
  end if;
end;
$$;

grant execute on function public.save_campaign_supervisor_report_comment(text, text, date, date, text, boolean, text, jsonb, jsonb) to anon, authenticated;
