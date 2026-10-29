-- WEWA is additive: existing campaign tables and legacy access policies are left intact.
-- Rider identities, attendance photos and coordinates are accessible only through
-- credential-checked, scoped sessions. Orbit receives a redacted reporting contract.
create schema if not exists wewa_private;
revoke all on schema wewa_private from public, anon, authenticated;

create table public.wewa_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  daily_registration_target integer not null default 0 check (daily_registration_target >= 0),
  daily_merchant_target integer not null default 0 check (daily_merchant_target >= 0),
  daily_app_target integer not null default 0 check (daily_app_target >= 0),
  podium_metric text not null default 'registrations' check (podium_metric in ('registrations','merchant_accounts','app_installs')),
  identifier_mode text not null default 'either' check (identifier_mode in ('either','phone','shortcode')),
  expected_in time not null default '08:00', expected_out time not null default '17:00',
  updated_at timestamptz not null default now()
);
create table public.wewa_stations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  company text not null default 'ENGEN', district text not null check (length(trim(district)) > 0),
  name text not null check (length(trim(name)) > 0), address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  is_active boolean not null default true, created_at timestamptz not null default now(),
  unique (campaign_id,district,name), unique (id,campaign_id)
);
create table public.wewa_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ba_id text not null references public.users(id), station_id uuid not null,
  activity_date date not null, assigned_by text not null references public.users(id),
  foreign key (station_id,campaign_id) references public.wewa_stations(id,campaign_id),
  unique (campaign_id,ba_id,activity_date)
);
create table public.wewa_attendance (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ba_id text not null references public.users(id), station_id uuid not null,
  activity_date date not null, status text not null default 'open' check (status in ('open','closed')),
  checkin_at timestamptz not null default now(),
  checkin_latitude double precision not null check (checkin_latitude between -90 and 90),
  checkin_longitude double precision not null check (checkin_longitude between -180 and 180),
  checkin_accuracy_m double precision not null check (checkin_accuracy_m >= 0),
  checkin_photo text not null check (checkin_photo ~ '^data:image/jpeg;base64,' and length(checkin_photo) <= 200000),
  checkout_at timestamptz, checkout_latitude double precision check (checkout_latitude between -90 and 90),
  checkout_longitude double precision check (checkout_longitude between -180 and 180), checkout_accuracy_m double precision,
  closing_comment text,
  foreign key (station_id,campaign_id) references public.wewa_stations(id,campaign_id),
  unique (campaign_id,ba_id,activity_date), unique (id,campaign_id,ba_id,station_id,activity_date),
  check (status <> 'closed' or (checkout_at is not null and length(trim(closing_comment)) > 0))
);
create table public.wewa_riders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  attendance_id uuid not null, ba_id text not null references public.users(id), station_id uuid not null,
  activity_date date not null, rider_name text not null check (length(trim(rider_name)) > 0),
  phone text check (phone ~ '^\+243[0-9]{9}$'),
  shortcode text check (length(shortcode) between 1 and 40 and shortcode = upper(regexp_replace(shortcode,'\s','','g'))),
  had_mpesa_account boolean not null, had_app boolean not null,
  merchant_account_opened boolean not null default false, app_installed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (attendance_id,campaign_id,ba_id,station_id,activity_date)
    references public.wewa_attendance(id,campaign_id,ba_id,station_id,activity_date),
  check (phone is not null or shortcode is not null), check (not (had_app and app_installed))
);
create unique index wewa_riders_phone_unique on public.wewa_riders(campaign_id,phone) where phone is not null;
create unique index wewa_riders_shortcode_unique on public.wewa_riders(campaign_id,shortcode) where shortcode is not null;
create index wewa_riders_campaign_date on public.wewa_riders(campaign_id,activity_date,ba_id);
create index wewa_riders_attendance on public.wewa_riders(attendance_id);
create index wewa_riders_station on public.wewa_riders(station_id);
create index wewa_assignments_station on public.wewa_assignments(station_id);
create index wewa_assignments_assigned_by on public.wewa_assignments(assigned_by);
create index wewa_attendance_station on public.wewa_attendance(station_id);
create index wewa_attendance_agent on public.wewa_attendance(ba_id,activity_date);
create index wewa_assignments_agent on public.wewa_assignments(ba_id,activity_date);

alter table public.wewa_settings enable row level security;
alter table public.wewa_stations enable row level security;
alter table public.wewa_assignments enable row level security;
alter table public.wewa_attendance enable row level security;
alter table public.wewa_riders enable row level security;
-- No direct Data API grants: the current app uses a legacy identity system.
-- Session RPCs below verify that identity instead of trusting a caller-supplied ID.
revoke all on public.wewa_settings,public.wewa_stations,public.wewa_assignments,public.wewa_attendance,public.wewa_riders from anon,authenticated;

create table wewa_private.sessions (
  token_hash text primary key, user_id text not null references public.users(id),
  credential_hash text not null, expires_at timestamptz not null
);
alter table wewa_private.sessions enable row level security;
create index wewa_sessions_user on wewa_private.sessions(user_id);
create index wewa_sessions_expiry on wewa_private.sessions(expires_at);

create function wewa_private.report(p_campaign_id uuid,p_scope text[] default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'records',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'ba_id',r.ba_id,'agent',u.full_name,'station_id',r.station_id,'station',s.name,
      'district',s.district,'activity_date',r.activity_date,'had_mpesa_account',r.had_mpesa_account,
      'had_app',r.had_app,'merchant_account_opened',r.merchant_account_opened,'app_installed',r.app_installed)
      order by r.activity_date,r.id)
      from public.wewa_riders r join public.users u on u.id=r.ba_id join public.wewa_stations s on s.id=r.station_id
      where r.campaign_id=p_campaign_id and (p_scope is null or r.ba_id=any(p_scope))),'[]'::jsonb),
    'attendance',coalesce((select jsonb_agg(jsonb_build_object('ba_id',a.ba_id,'agent',u.full_name,
      'station_id',a.station_id,'station',s.name,'district',s.district,'activity_date',a.activity_date,'status',a.status)
      order by a.activity_date,a.ba_id)
      from public.wewa_attendance a join public.users u on u.id=a.ba_id join public.wewa_stations s on s.id=a.station_id
      where a.campaign_id=p_campaign_id and (p_scope is null or a.ba_id=any(p_scope))),'[]'::jsonb),
    'settings',(select to_jsonb(s) from public.wewa_settings s where s.campaign_id=p_campaign_id)
  );
$$;
revoke all on function wewa_private.report(uuid,text[]) from public,anon,authenticated;

create function public.wewa_report(p_campaign_id uuid,p_token text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.campaigns c where c.id=p_campaign_id and c.code='activation-wewa')
     or (not coalesce((select a.campaign_visible from public.rapports_client_access a where a.campaign_id=p_campaign_id),true) and not exists (
       select 1 from wewa_private.sessions s join public.users u on u.id=s.user_id
       where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now() and u.is_active
       and s.credential_hash=encode(extensions.digest(u.password_hash,'sha256'),'hex')
       and u.role in ('admin','super_admin','sub_admin','supervisor'))) then
    raise exception 'Le rapport WEWA n’est pas accessible.' using errcode='42501';
  end if;
  return wewa_private.report(p_campaign_id);
end;
$$;
revoke all on function public.wewa_report(uuid,text) from public;
grant execute on function public.wewa_report(uuid,text) to anon,authenticated;

create function public.wewa_open_session(p_actor_id text,p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user public.users; v_token text; v_expires timestamptz := now()+interval '12 hours';
begin
  select * into v_user from public.users where id=p_actor_id and is_active;
  if v_user.id is null or nullif(trim(p_password),'') is null
     or lower(trim(v_user.password_hash)) is distinct from lower(trim(p_password)) then
    raise exception 'Connexion WEWA impossible. Reconnecte-toi à BTL Tracker.' using errcode='42501';
  end if;
  if v_user.role not in ('admin','super_admin','sub_admin','supervisor') and not exists (
    select 1 from public.user_campaign_assignments a join public.campaigns c on c.id=a.campaign_id
    where a.user_id=v_user.id and a.is_active and c.code='activation-wewa') then
    raise exception 'Ce compte n’est pas affecté à WEWA.' using errcode='42501';
  end if;
  v_token := encode(extensions.gen_random_bytes(32),'hex');
  delete from wewa_private.sessions where expires_at<now();
  insert into wewa_private.sessions values (encode(extensions.digest(v_token,'sha256'),'hex'),v_user.id,
    encode(extensions.digest(v_user.password_hash,'sha256'),'hex'),v_expires);
  return jsonb_build_object('token',v_token,'expires_at',v_expires);
end;
$$;
revoke all on function public.wewa_open_session(text,text) from public;
grant execute on function public.wewa_open_session(text,text) to anon,authenticated;

create function public.wewa_call(p_token text,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user public.users; v_campaign public.campaigns; v_settings public.wewa_settings;
  v_scope text[]; v_date date := (now() at time zone 'Africa/Kinshasa')::date;
  v_station public.wewa_stations; v_attendance public.wewa_attendance;
  v_rider public.wewa_riders; v_phone text; v_shortcode text; v_id uuid; v_ba text; v_paused boolean;
begin
  select u.* into v_user from wewa_private.sessions s join public.users u on u.id=s.user_id
  where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now() and u.is_active
    and s.credential_hash=encode(extensions.digest(u.password_hash,'sha256'),'hex');
  if v_user.id is null then raise exception 'Session WEWA expirée. Réessaie ou reconnecte-toi.' using errcode='42501'; end if;
  select * into strict v_campaign from public.campaigns where code='activation-wewa';
  select * into strict v_settings from public.wewa_settings where campaign_id=v_campaign.id;
  select coalesce(array_agg(a.user_id),'{}'::text[]) into v_scope from public.user_campaign_assignments a
  join public.users u on u.id=a.user_id and u.is_active and u.role='agent'
  where a.campaign_id=v_campaign.id and a.is_active and (
    v_user.role in ('admin','super_admin','sub_admin') or a.user_id=v_user.id or exists (
      select 1 from public.agent_campaign_supervisor_assignments x where x.campaign_id=v_campaign.id
      and x.agent_id=a.user_id and x.supervisor_id=v_user.id and x.is_active));
  if v_user.role='agent' and not v_user.id=any(v_scope) then raise exception 'Affectation WEWA inactive.' using errcode='42501'; end if;
  v_paused := exists (select 1 from public.campaign_pauses p where p.campaign_id=v_campaign.id and p.starts_on<=v_date and (p.ends_on is null or p.ends_on>=v_date));

  if p_action='snapshot' then
    return jsonb_build_object('campaign',to_jsonb(v_campaign),'settings',to_jsonb(v_settings),'paused',v_paused,
      'stations',coalesce((select jsonb_agg(to_jsonb(s) order by s.district,s.name) from public.wewa_stations s where s.campaign_id=v_campaign.id),'[]'::jsonb),
      'agents',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name) order by u.full_name) from public.users u where u.id=any(v_scope)),'[]'::jsonb),
      'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.wewa_assignments a where a.campaign_id=v_campaign.id and a.ba_id=any(v_scope)),'[]'::jsonb),
      'attendance',coalesce((select jsonb_agg(to_jsonb(a)-'checkin_photo' order by a.activity_date desc) from public.wewa_attendance a where a.campaign_id=v_campaign.id and a.ba_id=any(v_scope)),'[]'::jsonb),
      'riders',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.wewa_riders r where r.campaign_id=v_campaign.id and r.ba_id=any(v_scope)),'[]'::jsonb),
      'report',wewa_private.report(v_campaign.id,case when v_user.role='agent' then null else v_scope end));
  elsif p_action='evidence' then
    select * into v_attendance from public.wewa_attendance where id=(p_payload->>'id')::uuid and campaign_id=v_campaign.id and ba_id=any(v_scope);
    if v_attendance.id is null then raise exception 'Pointage inaccessible.' using errcode='42501'; end if;
    return to_jsonb(v_attendance);
  elsif p_action in ('start_day','add_rider','close_day') then
    if v_user.role<>'agent' then raise exception 'Cette action doit être réalisée depuis le compte BA.' using errcode='42501'; end if;
    if p_action<>'close_day' and (v_campaign.status<>'active' or v_paused or (v_campaign.starts_on is not null and v_date<v_campaign.starts_on) or (v_campaign.ends_on is not null and v_date>v_campaign.ends_on)) then
      raise exception 'La campagne n’est pas ouverte pour cette journée.';
    end if;
    -- Serialize a BA's arrival, entry and closure; closing cannot race a new rider.
    perform pg_advisory_xact_lock(hashtextextended(v_campaign.id::text||v_user.id,0));
    select * into v_attendance from public.wewa_attendance where campaign_id=v_campaign.id and ba_id=v_user.id and activity_date=v_date for update;
    if p_action='start_day' then
      if v_attendance.id is not null then return to_jsonb(v_attendance)-'checkin_photo'; end if;
      select * into v_station from public.wewa_stations where id=(p_payload->>'station_id')::uuid and campaign_id=v_campaign.id and is_active;
      if v_station.id is null then raise exception 'Sélectionne une station active.'; end if;
      if exists (select 1 from public.wewa_assignments a where a.campaign_id=v_campaign.id and a.ba_id=v_user.id and a.activity_date=v_date and a.station_id<>v_station.id) then
        raise exception 'Cette station ne correspond pas à ton affectation du jour.';
      end if;
      insert into public.wewa_attendance(campaign_id,ba_id,station_id,activity_date,checkin_latitude,checkin_longitude,checkin_accuracy_m,checkin_photo)
      values(v_campaign.id,v_user.id,v_station.id,v_date,(p_payload->>'latitude')::double precision,(p_payload->>'longitude')::double precision,(p_payload->>'accuracy')::double precision,p_payload->>'photo') returning * into v_attendance;
      return to_jsonb(v_attendance)-'checkin_photo';
    end if;
    if v_attendance.id is null or v_attendance.status<>'open' then raise exception 'Effectue ton pointage. La journée doit être ouverte.'; end if;
    if p_action='close_day' then
      if nullif(trim(p_payload->>'comment'),'') is null then raise exception 'Le commentaire de clôture est obligatoire.'; end if;
      if nullif(p_payload->>'latitude','') is null or nullif(p_payload->>'longitude','') is null then raise exception 'La localisation est requise pour clôturer.'; end if;
      update public.wewa_attendance set status='closed',checkout_at=now(),closing_comment=trim(p_payload->>'comment'),
        checkout_latitude=(p_payload->>'latitude')::double precision,checkout_longitude=(p_payload->>'longitude')::double precision,
        checkout_accuracy_m=(p_payload->>'accuracy')::double precision where id=v_attendance.id returning * into v_attendance;
      return to_jsonb(v_attendance)-'checkin_photo';
    end if;
    v_phone:=nullif(regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g'),'');
    if v_phone is not null then
      if v_phone like '00243%' then v_phone:=substr(v_phone,3); end if;
      if length(v_phone)=10 and left(v_phone,1)='0' then v_phone:='243'||substr(v_phone,2);
      elsif length(v_phone)=9 then v_phone:='243'||v_phone; end if;
      if v_phone !~ '^243[0-9]{9}$' then raise exception 'Numéro de téléphone RDC invalide.'; end if;
      v_phone:='+'||v_phone;
    end if;
    v_shortcode:=nullif(upper(regexp_replace(coalesce(p_payload->>'shortcode',''),'\s','','g')),'');
    if (v_settings.identifier_mode='phone' and v_phone is null) or (v_settings.identifier_mode='shortcode' and v_shortcode is null) or (v_phone is null and v_shortcode is null) then
      raise exception 'Renseigne l’identifiant demandé : téléphone ou shortcode.';
    end if;
    v_id:=coalesce((p_payload->>'id')::uuid,gen_random_uuid());
    select * into v_rider from public.wewa_riders where id=v_id and campaign_id=v_campaign.id and ba_id=v_user.id;
    if v_rider.id is not null then return to_jsonb(v_rider); end if;
    if exists (select 1 from public.wewa_riders r where r.campaign_id=v_campaign.id and ((v_phone is not null and r.phone=v_phone) or (v_shortcode is not null and r.shortcode=v_shortcode))) then
      raise exception 'Ce motard est déjà enregistré dans la campagne (téléphone ou shortcode).';
    end if;
    if coalesce((p_payload->>'had_app')::boolean,false) and coalesce((p_payload->>'app_installed')::boolean,false) then
      raise exception 'Une application déjà présente ne compte pas comme nouvelle installation.';
    end if;
    insert into public.wewa_riders(id,campaign_id,attendance_id,ba_id,station_id,activity_date,rider_name,phone,shortcode,had_mpesa_account,had_app,merchant_account_opened,app_installed)
    values(v_id,v_campaign.id,v_attendance.id,v_user.id,v_attendance.station_id,v_date,trim(p_payload->>'rider_name'),v_phone,v_shortcode,
      (p_payload->>'had_mpesa_account')::boolean,(p_payload->>'had_app')::boolean,
      coalesce((p_payload->>'merchant_account_opened')::boolean,false),coalesce((p_payload->>'app_installed')::boolean,false)) returning * into v_rider;
    return to_jsonb(v_rider);
  end if;
  if v_user.role not in ('admin','super_admin','sub_admin','supervisor') or (v_user.role='supervisor' and cardinality(v_scope)=0) then raise exception 'Action réservée à la supervision WEWA.' using errcode='42501'; end if;
  if p_action='save_settings' then
    update public.wewa_settings set
      daily_registration_target=(p_payload->>'daily_registration_target')::integer,
      daily_merchant_target=(p_payload->>'daily_merchant_target')::integer,
      daily_app_target=(p_payload->>'daily_app_target')::integer,
      podium_metric=p_payload->>'podium_metric',identifier_mode=p_payload->>'identifier_mode',updated_at=now()
      where campaign_id=v_campaign.id;
    update public.campaigns set starts_on=nullif(p_payload->>'starts_on','')::date,ends_on=nullif(p_payload->>'ends_on','')::date,updated_at=now() where id=v_campaign.id;
    return jsonb_build_object('saved',true);
  elsif p_action='save_station' then
    v_id:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
    if exists (select 1 from public.wewa_stations where id=v_id and campaign_id<>v_campaign.id) then raise exception 'Station inaccessible.'; end if;
    insert into public.wewa_stations(id,campaign_id,company,district,name,address,latitude,longitude,is_active)
    values(v_id,v_campaign.id,'ENGEN',trim(p_payload->>'district'),trim(p_payload->>'name'),nullif(trim(p_payload->>'address'),''),nullif(p_payload->>'latitude','')::double precision,nullif(p_payload->>'longitude','')::double precision,coalesce((p_payload->>'is_active')::boolean,true))
    on conflict(id) do update set district=excluded.district,name=excluded.name,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,is_active=excluded.is_active returning * into v_station;
    return to_jsonb(v_station);
  elsif p_action='assign_station' then
    v_ba:=p_payload->>'ba_id';
    if not v_ba=any(v_scope) then raise exception 'Cet agent ne relève pas de ton équipe WEWA.' using errcode='42501'; end if;
    select * into v_station from public.wewa_stations where id=(p_payload->>'station_id')::uuid and campaign_id=v_campaign.id and is_active;
    if v_station.id is null then raise exception 'Station inactive ou introuvable.'; end if;
    if exists (select 1 from public.wewa_attendance a where a.campaign_id=v_campaign.id and a.ba_id=v_ba and a.activity_date=(p_payload->>'activity_date')::date) then raise exception 'Le pointage du jour existe déjà : l’affectation est verrouillée.'; end if;
    insert into public.wewa_assignments(campaign_id,ba_id,station_id,activity_date,assigned_by)
    values(v_campaign.id,v_ba,v_station.id,(p_payload->>'activity_date')::date,v_user.id)
    on conflict(campaign_id,ba_id,activity_date) do update set station_id=excluded.station_id,assigned_by=excluded.assigned_by;
    return jsonb_build_object('saved',true);
  end if;
  raise exception 'Action WEWA inconnue.';
end;
$$;
revoke all on function public.wewa_call(text,text,jsonb) from public;
grant execute on function public.wewa_call(text,text,jsonb) to anon,authenticated;

notify pgrst,'reload schema';
