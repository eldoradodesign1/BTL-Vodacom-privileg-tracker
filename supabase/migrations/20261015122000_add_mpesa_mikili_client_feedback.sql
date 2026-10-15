-- Optional client feedback fields for M-Pesa Mikili interaction records.
-- Safe to run repeatedly: existing records remain unchanged and both fields are nullable.

alter table public.mpesa_mikili_clients
  add column if not exists client_comment text,
  add column if not exists satisfaction_rating smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mpesa_mikili_clients'::regclass
      and conname = 'mpesa_mikili_clients_satisfaction_rating_range_check'
  ) then
    alter table public.mpesa_mikili_clients
      add constraint mpesa_mikili_clients_satisfaction_rating_range_check
      check (satisfaction_rating is null or satisfaction_rating between 1 and 5);
  end if;
end
$$;
