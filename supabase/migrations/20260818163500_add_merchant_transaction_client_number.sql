begin;

alter table public.ba_transactions
  add column if not exists client_number text;

comment on column public.ba_transactions.client_number is
  'Numéro de téléphone ou identifiant client saisi lors de la transaction Merchant Education.';

commit;
