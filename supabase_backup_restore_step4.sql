-- STEP 4: pg_cron 스케줄 (옵션)
-- STEP 3 통과 후 돌려. pg_cron 확장이 꺼져있으면 NOTICE만 뜨고 스킵함 (에러 X).
-- Supabase → Database → Extensions → pg_cron 토글 ON 해두는 게 좋음.

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
    raise notice 'pg_cron not installed — skipping schedule. Enable the extension in Supabase (Database → Extensions) and re-run just this DO block.';
    return;
  end if;

  begin
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'youbuddy-challenge-hourly-snapshot';
  exception when others then
    raise notice 'cron.unschedule skipped: %', sqlerrm;
  end;

  begin
    perform cron.schedule(
      'youbuddy-challenge-hourly-snapshot',
      '7 * * * *',
      $cron$ select public.hourly_challenge_snapshot(); $cron$
    );
    raise notice 'scheduled: youbuddy-challenge-hourly-snapshot at HH:07';
  exception when others then
    raise notice 'cron.schedule failed: % — set up the schedule manually in Supabase Dashboard.', sqlerrm;
  end;
end;
$$;
