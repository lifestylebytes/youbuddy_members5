-- ============================================================
-- YOUBUDDY · pg_cron schedule for hourly snapshot (separate file)
-- ------------------------------------------------------------
-- Run this AFTER `supabase_backup_restore.sql` succeeds, once
-- pg_cron is enabled:
--   Supabase Dashboard → Database → Extensions → pg_cron → ON
--
-- Why it's a separate file: if pg_cron isn't installed, Supabase's
-- SQL Editor rolls back the whole script on error. Splitting keeps
-- the function creation transaction clean.
-- ============================================================

do $$
declare
  v_has_ext boolean := false;
  v_rec     record;
begin
  for v_rec in select 1 as ok from pg_extension where extname = 'pg_cron' limit 1
  loop
    v_has_ext := true;
  end loop;

  if not v_has_ext then
    raise exception 'pg_cron is not enabled. Enable it in Supabase (Database → Extensions) first.';
  end if;

  -- Idempotent: unschedule old job if any.
  begin
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'youbuddy-challenge-hourly-snapshot';
  exception when others then
    raise notice 'cron.unschedule skipped: %', sqlerrm;
  end;

  perform cron.schedule(
    'youbuddy-challenge-hourly-snapshot',
    '7 * * * *',    -- HH:07 every hour (staggered off the top)
    $cron$ select public.hourly_challenge_snapshot(); $cron$
  );
  raise notice 'scheduled: youbuddy-challenge-hourly-snapshot at HH:07 UTC';
end;
$$;

-- Verify
select jobid, jobname, schedule, command
from cron.job
where jobname = 'youbuddy-challenge-hourly-snapshot';
