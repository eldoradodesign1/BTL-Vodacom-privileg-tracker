-- M-Pesa Mikili uses the tracker's custom MSISDN/password auth rather than
-- Supabase Auth. The browser therefore reaches these tables as the anon role.
-- Keep the existing authenticated policies and allow the same app flow for anon.

drop policy if exists mpesa_mikili_attendance_read_authenticated on public.mpesa_mikili_daily_attendance;
drop policy if exists mpesa_mikili_attendance_insert_authenticated on public.mpesa_mikili_daily_attendance;
drop policy if exists mpesa_mikili_attendance_update_authenticated on public.mpesa_mikili_daily_attendance;
drop policy if exists mpesa_mikili_clients_read_authenticated on public.mpesa_mikili_clients;
drop policy if exists mpesa_mikili_clients_insert_authenticated on public.mpesa_mikili_clients;
drop policy if exists mpesa_mikili_clients_update_authenticated on public.mpesa_mikili_clients;

create policy mpesa_mikili_attendance_read_app on public.mpesa_mikili_daily_attendance
for select to anon, authenticated using (true);

create policy mpesa_mikili_attendance_insert_app on public.mpesa_mikili_daily_attendance
for insert to anon, authenticated with check (true);

create policy mpesa_mikili_attendance_update_app on public.mpesa_mikili_daily_attendance
for update to anon, authenticated using (true) with check (true);

create policy mpesa_mikili_clients_read_app on public.mpesa_mikili_clients
for select to anon, authenticated using (true);

create policy mpesa_mikili_clients_insert_app on public.mpesa_mikili_clients
for insert to anon, authenticated with check (true);

create policy mpesa_mikili_clients_update_app on public.mpesa_mikili_clients
for update to anon, authenticated using (true) with check (true);
