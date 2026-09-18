-- M-Pesa Mikili uses the application's existing custom users login,
-- not a Supabase Auth session. The anon Supabase client therefore needs
-- explicit access to these campaign tables, matching the existing app
-- architecture and the legacy anon access used by the evidence bucket.

create policy mpesa_mikili_attendance_read_anon
on public.mpesa_mikili_daily_attendance
for select to anon
using (true);

create policy mpesa_mikili_attendance_insert_anon
on public.mpesa_mikili_daily_attendance
for insert to anon
with check (true);

create policy mpesa_mikili_attendance_update_anon
on public.mpesa_mikili_daily_attendance
for update to anon
using (true)
with check (true);

create policy mpesa_mikili_clients_read_anon
on public.mpesa_mikili_clients
for select to anon
using (true);

create policy mpesa_mikili_clients_insert_anon
on public.mpesa_mikili_clients
for insert to anon
with check (true);

create policy mpesa_mikili_clients_update_anon
on public.mpesa_mikili_clients
for update to anon
using (true)
with check (true);
