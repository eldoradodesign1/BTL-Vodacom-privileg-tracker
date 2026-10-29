-- Executed in a transaction together with the campaign seed, then rolled back.
-- Never creates persistent sample stations, riders, pointages or credentials.
do $$
declare
  agent public.users; supervisor public.users; token text; manager_token text;
  v_campaign_id uuid; station_a uuid; station_b uuid; attendance_id uuid;
  result jsonb; rider_id uuid:=gen_random_uuid(); denied boolean; day date:=(now() at time zone 'Africa/Kinshasa')::date;
begin
  select * into strict agent from public.users where full_name='Agent Test' and role='agent' and is_active;
  select * into strict supervisor from public.users where full_name='Alpha Okito' and role='supervisor' and is_active;
  select id into strict v_campaign_id from public.campaigns where code='activation-wewa';
  token:=public.wewa_open_session(agent.id,agent.password_hash)->>'token';
  manager_token:=public.wewa_open_session(supervisor.id,supervisor.password_hash)->>'token';

  denied:=false;
  begin perform public.wewa_call('invalid-token','snapshot'); exception when insufficient_privilege then denied:=true; end;
  assert denied,'A forged session must be rejected';
  denied:=false;
  begin perform public.wewa_open_session(agent.id,gen_random_uuid()::text); exception when insufficient_privilege then denied:=true; end;
  assert denied,'Incorrect credentials must be rejected';
  assert not has_table_privilege('anon','public.wewa_riders','SELECT'),'Anonymous direct rider reads must be denied';
  assert not has_table_privilege('authenticated','public.wewa_attendance','SELECT'),'Direct attendance reads must be denied';
  assert not has_function_privilege('anon','wewa_private.report(uuid,text[])','EXECUTE'),'Private projection cannot be called directly';

  result:=public.wewa_call(manager_token,'save_station',jsonb_build_object('district','QA District','name','__QA_WEWA_A__'));
  station_a:=(result->>'id')::uuid;
  result:=public.wewa_call(manager_token,'save_station',jsonb_build_object('district','Other District','name','__QA_WEWA_B__'));
  station_b:=(result->>'id')::uuid;
  perform public.wewa_call(manager_token,'assign_station',jsonb_build_object('ba_id',agent.id,'station_id',station_a,'activity_date',day));
  denied:=false;
  begin perform public.wewa_call(token,'save_station',jsonb_build_object('district','QA','name','Forbidden')); exception when insufficient_privilege then denied:=true; end;
  assert denied,'A BA cannot manage stations';
  denied:=false;
  begin perform public.wewa_call(token,'add_rider',jsonb_build_object('rider_name','Before arrival')); exception when others then denied:=true; end;
  assert denied,'Registration before check-in must be rejected';
  denied:=false;
  begin perform public.wewa_call(token,'start_day',jsonb_build_object('station_id',station_b,'photo','data:image/jpeg;base64,/9j/','latitude',-4.3,'longitude',15.3,'accuracy',10)); exception when others then denied:=true; end;
  assert denied,'An assigned BA cannot check in at another station';
  result:=public.wewa_call(token,'start_day',jsonb_build_object('station_id',station_a,'photo','data:image/jpeg;base64,/9j/','latitude',-4.3,'longitude',15.3,'accuracy',10));
  attendance_id:=(result->>'id')::uuid;
  assert result->>'status'='open','Check-in opens the day';
  result:=public.wewa_call(token,'add_rider',jsonb_build_object('id',rider_id,'rider_name','QA Rider One','phone','0812345678','had_mpesa_account',true,'had_app',false,'merchant_account_opened',true,'app_installed',true));
  assert result->>'phone'='+243812345678','Phones are normalized at the database boundary';
  assert result->>'station_id'=station_a::text,'A rider inherits the checked-in station';
  perform public.wewa_call(token,'add_rider',jsonb_build_object('id',rider_id,'rider_name','QA Retry','phone','0812345678','had_mpesa_account',true,'had_app',false));
  assert (select count(*)=1 from public.wewa_riders where id=rider_id),'A retried request cannot create a second record';
  denied:=false;
  begin perform public.wewa_call(token,'add_rider',jsonb_build_object('id',gen_random_uuid(),'rider_name','QA Duplicate','phone','+243812345678','had_mpesa_account',true,'had_app',false)); exception when others then denied:=true; end;
  assert denied,'A second row for the same normalized phone must be rejected';
  denied:=false;
  begin perform public.wewa_call(token,'add_rider',jsonb_build_object('rider_name','QA Contradiction','shortcode','000012','had_mpesa_account',true,'had_app',true,'app_installed',true)); exception when others then denied:=true; end;
  assert denied,'A pre-existing application cannot count as a new install';
  result:=public.wewa_call(token,'add_rider',jsonb_build_object('rider_name','QA Rider Two','shortcode','000012','had_mpesa_account',true,'had_app',true,'merchant_account_opened',false,'app_installed',false));
  assert result->>'shortcode'='000012','Shortcodes retain leading zeros';
  result:=public.wewa_report(v_campaign_id);
  assert jsonb_array_length(result->'records')=2,'Orbit receives two registrations';
  assert (select count(*)=1 from jsonb_array_elements(result->'records') r where (r->>'merchant_account_opened')::boolean),'Orbit counts new merchant accounts independently';
  assert (select count(*)=1 from jsonb_array_elements(result->'records') r where (r->>'app_installed')::boolean),'Orbit counts new installations independently';
  assert not (result::text ~ '(rider_name|shortcode|phone|checkin_photo|latitude|longitude)'),'Public report must not expose rider identifiers, photos or GPS';
  result:=public.wewa_call(manager_token,'snapshot');
  assert jsonb_array_length(result->'riders')=2,'Assigned supervision can inspect rider records';
  assert jsonb_array_length(result->'agents')=1,'Only the requested test BA is assigned';
  assert not ((result->'attendance'->0) ? 'checkin_photo'),'Bulk snapshots do not transfer attendance photos';
  result:=public.wewa_call(manager_token,'evidence',jsonb_build_object('id',attendance_id));
  assert result ? 'checkin_photo','Authorized evidence is loaded on demand';
  update public.rapports_client_access set campaign_visible=false where rapports_client_access.campaign_id=v_campaign_id;
  denied:=false;
  begin perform public.wewa_report(v_campaign_id); exception when insufficient_privilege then denied:=true; end;
  assert denied,'A client-hidden campaign cannot be read anonymously';
  result:=public.wewa_report(v_campaign_id,manager_token);
  assert jsonb_array_length(result->'records')=2,'BTL can still read a campaign hidden from the client';
  denied:=false;
  begin perform public.wewa_call(token,'close_day',jsonb_build_object('comment',' ','latitude',-4.3,'longitude',15.3,'accuracy',10)); exception when others then denied:=true; end;
  assert denied,'Closing comment is mandatory';
  result:=public.wewa_call(token,'close_day',jsonb_build_object('comment','QA complete','latitude',-4.3,'longitude',15.3,'accuracy',10));
  assert result->>'status'='closed','Closing locks the day';
  denied:=false;
  begin perform public.wewa_call(token,'add_rider',jsonb_build_object('rider_name','After closure','shortcode','9999','had_mpesa_account',false,'had_app',false)); exception when others then denied:=true; end;
  assert denied,'Registration after closure is rejected';
  for supervisor in select * from public.users where full_name in ('Alpha Okito','Serge Kisend','Hervé Ntalu','Shekinah Sita') and is_active loop
    manager_token:=public.wewa_open_session(supervisor.id,supervisor.password_hash)->>'token';
    result:=public.wewa_call(manager_token,'snapshot');
    assert jsonb_array_length(result->'riders')=2,'Every requested supervisor can see the test BA';
  end loop;
end;
$$;
