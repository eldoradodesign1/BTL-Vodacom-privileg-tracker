begin;

-- The application deliberately uses the public Supabase client with its own
-- phone/password role model rather than a Supabase Auth session. Pause writes
-- therefore need policies available to this client; permissions remain exposed
-- only through the management screens in the application.
drop policy if exists campaign_pauses_select_authorized on public.campaign_pauses;
drop policy if exists campaign_pauses_manage_operator on public.campaign_pauses;
drop policy if exists campaign_pauses_select_app_client on public.campaign_pauses;
drop policy if exists campaign_pauses_insert_app_client on public.campaign_pauses;
drop policy if exists campaign_pauses_update_app_client on public.campaign_pauses;
drop policy if exists campaign_pauses_delete_app_client on public.campaign_pauses;

create policy campaign_pauses_select_app_client on public.campaign_pauses
for select to anon, authenticated
using (true);

create policy campaign_pauses_insert_app_client on public.campaign_pauses
for insert to anon, authenticated
with check (true);

create policy campaign_pauses_update_app_client on public.campaign_pauses
for update to anon, authenticated
using (true)
with check (true);

create policy campaign_pauses_delete_app_client on public.campaign_pauses
for delete to anon, authenticated
using (true);

commit;
