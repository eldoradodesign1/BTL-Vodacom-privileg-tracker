begin;

-- Youth F2F is now operational from 12 October 2026.
update public.campaigns
set status = 'active',
    starts_on = '2026-10-12',
    ends_on = null,
    updated_at = now()
where code = 'youth-f2f';

-- The Youth workflow no longer uses university assignments. Remove only the
-- obsolete Youth university data and its dependent attendance records.
-- Contacts, users, campaign assignments and campaign-level attendance outside
-- these legacy records are intentionally preserved.
delete from public.youth_daily_attendance
where campaign_id = (select id from public.campaigns where code = 'youth-f2f');

delete from public.youth_daily_assignments
where campaign_id = (select id from public.campaigns where code = 'youth-f2f');

delete from public.youth_universities
where campaign_id = (select id from public.campaigns where code = 'youth-f2f');

commit;
