-- M-Pesa Mikili uses the application's custom users login.
-- Allow the custom-auth client to read the campaign's location lists.
create policy campaign_locations_read_anon
on public.campaign_locations
for select to anon
using (true);

create policy campaign_supervisor_regions_read_anon
on public.campaign_supervisor_regions
for select to anon
using (true);
