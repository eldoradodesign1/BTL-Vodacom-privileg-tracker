-- Align the global sub-admin account with the supervisor default password policy.
UPDATE public.users
SET password_hash = 'test'
WHERE phone = '0823031980'
  AND role = 'sub_admin';
