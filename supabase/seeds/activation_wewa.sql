-- Run only after both applications have been published.
-- Bootstrap only the requested campaign and its identified test team.
do $$
declare v_campaign uuid; v_agent text; v_supervisors text[];
begin
  insert into public.campaigns(code,name,campaign_type,status,starts_on)
  values('activation-wewa','Activation WEWA','brand_ambassador','active','2026-10-20')
  returning id into v_campaign;
  insert into public.wewa_settings(campaign_id) values(v_campaign);
  select id into strict v_agent from public.users where full_name='Agent Test' and role='agent' and user_category='brand_ambassador' and is_active;
  select array_agg(id) into v_supervisors from public.users where is_active and
    ((full_name in ('Alpha Okito','Serge Kisend','Hervé Ntalu') and role='supervisor') or (full_name='Shekinah Sita' and role='sub_admin'));
  if cardinality(v_supervisors)<>4 then raise exception 'Les quatre superviseurs WEWA doivent être identifiés sans ambiguïté.'; end if;
  insert into public.user_campaign_assignments(user_id,campaign_id,is_active) values(v_agent,v_campaign,true);
  insert into public.agent_campaign_supervisor_assignments(agent_id,supervisor_id,campaign_id,is_active)
  select v_agent,s,v_campaign,true from unnest(v_supervisors) s;
  insert into public.rapports_client_access(campaign_id,campaign_visible,targets_visible,ai_questions)
  values(v_campaign,true,true,false);
end;
$$;

