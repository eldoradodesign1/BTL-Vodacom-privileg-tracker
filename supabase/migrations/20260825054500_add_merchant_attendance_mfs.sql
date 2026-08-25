begin;

alter table public.ba_daily_attendance
  add column if not exists mfs_name text;

create index if not exists ba_daily_attendance_mfs_lookup_idx
  on public.ba_daily_attendance(campaign_run_id, activity_date, mfs_name)
  where mfs_name is not null;

commit;
