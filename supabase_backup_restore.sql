-- ============================================================
-- YOUBUDDY · Supabase hourly snapshot + restore device
-- ------------------------------------------------------------
-- PURPOSE
--   Backstop against accidental bulk deletes / resets of the
--   critical tables in this challenge:
--     (1) challenge_member_state         → 내 학습/진행률/대시보드
--     (2) challenge_community_posts      → 커뮤니티
--         challenge_community_comments
--         challenge_community_likes
--     (3) challenge_verification_events  → 인증(제출) 타임스탬프 이력
--
--   Keeps an hourly snapshot for 14 days (tunable). Restore is
--   row-level and scoped by cohort and/or member_key, so you can
--   recover "just 이지흔's state from 3 hours ago" without blowing
--   away everyone else's current data.
--
-- DEPLOY (one-time, in Supabase SQL editor):
--   Paste this entire file and hit "Run". Idempotent — safe to re-run.
--
--   Requires extensions:
--     • pgcrypto (for gen_random_uuid)  — already on by default in Supabase
--     • pg_cron  (for the hourly schedule) — enable via Database → Extensions
--
-- USE (on demand):
--   -- take a snapshot right now
--   select * from public.take_challenge_snapshot('5th');
--
--   -- list available snapshot timestamps (most recent 20)
--   select distinct snapshot_at
--   from public.challenge_snapshots
--   where cohort = '5th'
--   order by snapshot_at desc
--   limit 20;
--
--   -- restore ALL tables to state at a specific snapshot
--   select * from public.restore_challenge_snapshot(
--     p_snapshot_at := '2026-04-21 05:00:00+00',
--     p_cohort      := '5th'
--   );
--
--   -- restore ONE member's state only (most common surgical case)
--   select * from public.restore_challenge_snapshot(
--     p_snapshot_at := '2026-04-21 05:00:00+00',
--     p_cohort      := '5th',
--     p_member_key  := 'gyute:이규태',
--     p_tables      := array['challenge_member_state']
--   );
--
--   -- erase ONE member's day completely (e.g., re-do Day 2 from scratch)
--   --   • clears verification events, app_state checkpoints/sentences/quiz/feedback
--   --     for that day, and the member's community posts/comments/likes for that day.
--   --   • leaves all OTHER days untouched.
--   select * from public.reset_member_day('5기', array['유버디'], 2);
--
--   -- erase a day for several members at once
--   select * from public.reset_member_day('5기', array['유버디','이규태','이지흔'], 2);
-- ============================================================

-- ------------------------------------------------------------
-- 1. Snapshot store — one row per record per snapshot_at.
--    payload = the full source row as jsonb, so schema evolution
--    of the source tables never breaks old snapshots.
-- ------------------------------------------------------------
create table if not exists public.challenge_snapshots (
  id           bigint generated always as identity primary key,
  snapshot_at  timestamptz not null default now(),
  source_table text        not null,
  cohort       text,
  row_key      text        not null,   -- natural id (member_key, post_id, ...)
  payload      jsonb       not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_challenge_snapshots_lookup
  on public.challenge_snapshots (source_table, cohort, snapshot_at desc);

create index if not exists idx_challenge_snapshots_rowkey
  on public.challenge_snapshots (source_table, row_key, snapshot_at desc);

create index if not exists idx_challenge_snapshots_at
  on public.challenge_snapshots (snapshot_at desc);


-- ------------------------------------------------------------
-- 2. Row-key resolver. Each source table needs a natural key so we
--    can upsert on restore. Edit here if the column names differ.
-- ------------------------------------------------------------
create or replace function public._challenge_snapshot_rowkey_expr(p_table text)
returns text
language plpgsql
immutable
as $$
begin
  return case p_table
    -- member state → one row per (cohort, member_key). Key = member_key
    --   (cohort goes in its own column so we can filter).
    when 'challenge_member_state'         then 'member_key'
    -- community: post_id is UUID/text and globally unique.
    when 'challenge_community_posts'      then 'post_id'
    -- comments & likes: generally have their own id column. Fall back to id.
    when 'challenge_community_comments'   then 'id'
    when 'challenge_community_likes'      then 'id'
    -- verification events: has a bigint surrogate `id` primary key AND a
    -- natural unique on (cohort, member_key, verified_day). Use `id` so
    -- each per-day row is preserved as its own snapshot entry.
    when 'challenge_verification_events'  then 'id'
    else 'id'
  end;
end;
$$;


-- ------------------------------------------------------------
-- 3. Snapshot writer.
--    For each table in the allow-list that actually exists in the DB,
--    copy all rows (optionally filtered by cohort) into challenge_snapshots
--    with a single common snapshot_at timestamp.
-- ------------------------------------------------------------
create or replace function public.take_challenge_snapshot(p_cohort text default null)
returns table (source_table text, rows_captured integer, snapshot_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now         timestamptz := now();
  v_table       text;
  v_rowkey_col  text;
  v_count       integer;
  v_sql         text;
  v_tables      text[] := array[
    'challenge_member_state',
    'challenge_community_posts',
    'challenge_community_comments',
    'challenge_community_likes',
    'challenge_verification_events'
  ];
begin
  foreach v_table in array v_tables loop
    -- skip tables that don't exist in this DB
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;

    v_rowkey_col := public._challenge_snapshot_rowkey_expr(v_table);

    -- All 5 tables are known to have a `cohort` text column, so we can
    -- always filter+stamp it directly. No runtime detection needed.
    v_sql := format(
      'insert into public.challenge_snapshots (snapshot_at, source_table, cohort, row_key, payload) ' ||
      'select $1, %L, t.cohort, coalesce((t.%I)::text, ''unknown''), to_jsonb(t.*) ' ||
      'from public.%I t ' ||
      'where ($2 is null or t.cohort = $2)',
      v_table,
      v_rowkey_col,
      v_table
    );

    execute v_sql using v_now, p_cohort;
    get diagnostics v_count = row_count;

    source_table    := v_table;
    rows_captured   := v_count;
    snapshot_at     := v_now;
    return next;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 4. Retention — keep the last 14 days of snapshots by default.
--    Tune p_keep_days if you want a longer window.
-- ------------------------------------------------------------
create or replace function public.prune_challenge_snapshots(p_keep_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.challenge_snapshots
    where snapshot_at < now() - make_interval(days => p_keep_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


-- ------------------------------------------------------------
-- 5. Restore function.
--    Finds the *most recent* snapshot at or before p_snapshot_at
--    for each (source_table, row_key) in the filter, then upserts
--    each snapshotted row back into its source table.
--
--    Rows that existed at snapshot time but don't now → re-inserted.
--    Rows that existed then AND now → updated to the snapshot's values.
--    Rows that did NOT exist at snapshot time → left alone.
--
--    ⚠️ Use cohort + member_key scoping whenever possible.
-- ------------------------------------------------------------
create or replace function public.restore_challenge_snapshot(
  p_snapshot_at timestamptz,
  p_cohort      text default null,
  p_member_key  text default null,
  p_tables      text[] default array[
    'challenge_member_state',
    'challenge_community_posts',
    'challenge_community_comments',
    'challenge_community_likes',
    'challenge_verification_events'
  ],
  p_dry_run     boolean default false
)
returns table (
  source_table text,
  rows_restored integer,
  rows_skipped integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_table       text;
  v_rowkey_col  text;
  v_updates     text;
  v_col         text;
  v_insert_sql  text;
  v_filter_mk   text;
  v_restored    integer;
  v_skipped     integer;
  v_temp_name   text;
begin
  foreach v_table in array p_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;

    v_rowkey_col := public._challenge_snapshot_rowkey_expr(v_table);

    -- Build UPDATE SET clause — update every column except the row-key and id.
    -- Built via a FOR loop (not SELECT INTO / EXECUTE INTO) so we stay
    -- clear of any plpgsql variable-vs-relation resolution quirks.
    v_updates := '';
    for v_col in
      select column_name
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_table
        and c.column_name <> v_rowkey_col
        and c.column_name <> 'id'
      order by c.ordinal_position
    loop
      v_updates := v_updates
        || (case when v_updates = '' then '' else ', ' end)
        || quote_ident(v_col) || ' = excluded.' || quote_ident(v_col);
    end loop;

    -- A restorable snapshot = the most recent snapshot row per row_key
    -- at or before p_snapshot_at, within the optional cohort+member filter.
    v_filter_mk := case
      when p_member_key is not null and v_table = 'challenge_member_state'
        then format('and row_key = %L', p_member_key)
      when p_member_key is not null and v_table like 'challenge_community_%'
        -- member_key lives inside payload for community tables — filter on jsonb.
        then format('and (payload->>''member_key'') = %L', p_member_key)
      when p_member_key is not null and v_table = 'challenge_verification_events'
        -- verification events also carry member_key inside payload.
        then format('and (payload->>''member_key'') = %L', p_member_key)
      else ''
    end;

    -- Stage to a temp table so we can report counts cleanly.
    v_temp_name := format('_restore_%s_%s', v_table,
      regexp_replace(gen_random_uuid()::text, '-', '', 'g'));

    -- All supported tables have a cohort column, so always filter by it.
    -- Use INSERT INTO ... SELECT (not CREATE TABLE AS) so GET DIAGNOSTICS
    -- gives us a reliable row_count and we never need EXECUTE ... INTO,
    -- which has confused plpgsql parser in some Supabase pg builds.
    execute format(
      'create temp table %I (row_key text, payload jsonb) on commit drop',
      v_temp_name
    );
    execute format(
      'insert into %I (row_key, payload) ' ||
      'select distinct on (row_key) row_key, payload ' ||
      'from public.challenge_snapshots ' ||
      'where source_table = %L ' ||
      '  and snapshot_at <= $1 ' ||
      '  and ($2 is null or cohort = $2) ' ||
      '  %s ' ||
      'order by row_key, snapshot_at desc',
      v_temp_name,
      v_table,
      v_filter_mk
    ) using p_snapshot_at, p_cohort;
    get diagnostics v_restored = row_count;
    v_skipped := 0;

    if p_dry_run then
      source_table  := v_table;
      rows_restored := 0;
      rows_skipped  := v_restored; -- would-have-been
      return next;
      execute format('drop table %I', v_temp_name);
      continue;
    end if;

    -- Upsert each snapshotted row back into the live table via jsonb→record.
    -- We rely on to_jsonb/row_to_json symmetry: jsonb_populate_record restores types.
    v_insert_sql := format(
      'insert into public.%I select (jsonb_populate_record(null::public.%I, payload)).* ' ||
      'from %I ' ||
      'on conflict (%I) do update set %s',
      v_table, v_table, v_temp_name, v_rowkey_col, v_updates
    );

    begin
      execute v_insert_sql;
    exception when others then
      -- Fall back: try without ON CONFLICT if the table lacks a unique index
      -- on row_key; caller can still manually resolve.
      raise notice 'restore upsert failed on %: % — falling back to delete+insert for filtered rows',
        v_table, sqlerrm;
      execute format(
        'delete from public.%I where %I in (select row_key from %I)',
        v_table, v_rowkey_col, v_temp_name
      );
      execute format(
        'insert into public.%I select (jsonb_populate_record(null::public.%I, payload)).* from %I',
        v_table, v_table, v_temp_name
      );
    end;

    execute format('drop table %I', v_temp_name);

    source_table  := v_table;
    rows_restored := v_restored;
    rows_skipped  := v_skipped;
    return next;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 6. Convenience: one-shot "every hour" wrapper.
-- ------------------------------------------------------------
create or replace function public.hourly_challenge_snapshot()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.take_challenge_snapshot(null);   -- all cohorts
  perform public.prune_challenge_snapshots(14);
end;
$$;


-- ------------------------------------------------------------
-- 7. Schedule with pg_cron.
--
--    ⚠️ pg_cron must be enabled in Supabase BEFORE running this block:
--         Database → Extensions → search "pg_cron" → toggle ON
--
--    If it's not enabled, the block below will NO-OP with a NOTICE
--    instead of aborting the whole script (so your functions still
--    get created). You can re-run just this block after enabling.
--
--    Alternative: skip pg_cron entirely and call
--    public.hourly_challenge_snapshot() from a Supabase Edge Function
--    Scheduled Trigger (Dashboard → Functions → Schedules).
-- ------------------------------------------------------------
do $$
declare
  v_has_ext boolean := false;
  v_rec     record;
begin
  -- Check INSTALLED extension, not just available. `cron.job` only exists
  -- after `create extension pg_cron`, so reference it only when installed.
  -- Using FOR loop instead of SELECT INTO to avoid plpgsql variable quirks.
  for v_rec in select 1 as ok from pg_extension where extname = 'pg_cron' limit 1
  loop
    v_has_ext := true;
  end loop;

  if not v_has_ext then
    raise notice 'pg_cron not installed — skipping schedule. Enable the extension in Supabase (Database → Extensions) and re-run just this DO block.';
    return;
  end if;

  -- Unschedule previous job if it exists (idempotent). Wrap in exception
  -- so a cron catalog mismatch can't roll back the transaction.
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
      '7 * * * *',    -- HH:07 every hour — stagger off the top of the hour
      $cron$ select public.hourly_challenge_snapshot(); $cron$
    );
    raise notice 'scheduled: youbuddy-challenge-hourly-snapshot at HH:07';
  exception when others then
    raise notice 'cron.schedule failed: % — set up the schedule manually in Supabase Dashboard.', sqlerrm;
  end;
end;
$$;


-- ------------------------------------------------------------
-- 8. Per-member day-level reset.
--    "Erase Day N for these members, but leave every other day + every
--     other member untouched." Generalized from reset_day2_accounts.sql
--     into a reusable function so future 'reset 유버디 Day 5' calls are
--     one line, not a 100-line script.
--
--    Scope of a reset for one (cohort, member, day):
--      • challenge_verification_events : delete matching row(s)
--      • challenge_member_state.app_state: strip the per-day keys
--          - verified['dN'], verified_at['dN']
--          - sentence_notes/sentences/ai_feedback/submitted: 'dN-0|1|2'
--          - sentences/ai_feedback also drop 'hook-N'
--          - checkpoints: 'dN-copy', 'dN-quiz', 'dN-record', 'hook-N'
--          - community_edits: 'me-dN-0|1|2'
--          - ai_daily_usage['dN']
--      • challenge_community_posts/comments/likes for that (member, day)
--
--    Safe to call multiple times (idempotent). Doesn't touch anyone
--    else's rows, doesn't touch other days.
-- ------------------------------------------------------------
create or replace function public.reset_member_day(
  p_cohort       text,
  p_member_keys  text[],
  p_day          integer
)
returns table (step text, rows_affected integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_day_str  text := 'd' || p_day::text;
  v_hook_str text := 'hook-' || p_day::text;
  v_count    integer;
begin
  -- 1) verification events — only exists if that table is deployed.
  if to_regclass('public.challenge_verification_events') is not null then
    delete from public.challenge_verification_events
    where cohort = p_cohort
      and verified_day = p_day
      and member_key = any(p_member_keys);
    get diagnostics v_count = row_count;
    step := 'verification_events';
    rows_affected := v_count;
    return next;
  end if;

  -- 2) app_state: strip per-day keys across every subdoc that uses dN-* /
  --    hook-N naming. All jsonb ops are key-deletes (-), so missing keys
  --    are no-ops.
  update public.challenge_member_state s
  set
    app_state = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  coalesce(s.app_state, '{}'::jsonb),
                  '{verified}',
                  coalesce(s.app_state->'verified', '{}'::jsonb) - v_day_str,
                  true
                ),
                '{verified_at}',
                coalesce(s.app_state->'verified_at', '{}'::jsonb) - v_day_str,
                true
              ),
              '{sentence_notes}',
              (((coalesce(s.app_state->'sentence_notes', '{}'::jsonb)
                 - (v_day_str || '-0')) - (v_day_str || '-1')) - (v_day_str || '-2')),
              true
            ),
            '{sentences}',
            ((((coalesce(s.app_state->'sentences', '{}'::jsonb)
                - (v_day_str || '-0')) - (v_day_str || '-1')) - (v_day_str || '-2')) - v_hook_str),
            true
          ),
          '{ai_feedback}',
          ((((coalesce(s.app_state->'ai_feedback', '{}'::jsonb)
              - (v_day_str || '-0')) - (v_day_str || '-1')) - (v_day_str || '-2')) - v_hook_str),
          true
        ),
        '{submitted}',
        (((coalesce(s.app_state->'submitted', '{}'::jsonb)
           - (v_day_str || '-0')) - (v_day_str || '-1')) - (v_day_str || '-2')),
        true
      ),
      '{checkpoints}',
      ((((coalesce(s.app_state->'checkpoints', '{}'::jsonb)
          - (v_day_str || '-copy')) - (v_day_str || '-quiz')) - (v_day_str || '-record')) - v_hook_str),
      true
    ),
    updated_at = now()
  where s.cohort = p_cohort
    and s.member_key = any(p_member_keys);
  get diagnostics v_count = row_count;
  step := 'member_state (verified/sentences/checkpoints/etc)';
  rows_affected := v_count;
  return next;

  -- 2.1) community_edits + ai_daily_usage (separate pass for readability).
  update public.challenge_member_state s
  set
    app_state = jsonb_set(
      jsonb_set(
        coalesce(s.app_state, '{}'::jsonb),
        '{community_edits}',
        (((coalesce(s.app_state->'community_edits', '{}'::jsonb)
           - ('me-' || v_day_str || '-0')) - ('me-' || v_day_str || '-1')) - ('me-' || v_day_str || '-2')),
        true
      ),
      '{ai_daily_usage}',
      coalesce(s.app_state->'ai_daily_usage', '{}'::jsonb) - v_day_str,
      true
    ),
    updated_at = now()
  where s.cohort = p_cohort
    and s.member_key = any(p_member_keys);
  get diagnostics v_count = row_count;
  step := 'member_state (community_edits/ai_daily_usage)';
  rows_affected := v_count;
  return next;

  -- 3) likes on this member's day-N posts (before the post rows disappear).
  delete from public.challenge_community_likes
  where cohort = p_cohort
    and post_id in (
      select post_id
      from public.challenge_community_posts
      where cohort = p_cohort
        and day_n = p_day
        and member_key = any(p_member_keys)
    );
  get diagnostics v_count = row_count;
  step := 'community_likes';
  rows_affected := v_count;
  return next;

  -- 4) comments on this member's day-N posts.
  delete from public.challenge_community_comments
  where cohort = p_cohort
    and post_id in (
      select post_id
      from public.challenge_community_posts
      where cohort = p_cohort
        and day_n = p_day
        and member_key = any(p_member_keys)
    );
  get diagnostics v_count = row_count;
  step := 'community_comments';
  rows_affected := v_count;
  return next;

  -- 5) the posts themselves.
  delete from public.challenge_community_posts
  where cohort = p_cohort
    and day_n = p_day
    and member_key = any(p_member_keys);
  get diagnostics v_count = row_count;
  step := 'community_posts';
  rows_affected := v_count;
  return next;
end;
$$;


-- ------------------------------------------------------------
-- 9. Quick-look helpers for operator triage.
-- ------------------------------------------------------------
create or replace view public.v_challenge_snapshot_summary as
select
  source_table,
  cohort,
  date_trunc('hour', snapshot_at) as hour_bucket,
  count(*) as row_count
from public.challenge_snapshots
group by 1,2,3
order by hour_bucket desc, source_table;

-- Grant — mirror whatever the rest of the app uses. The RPCs above are
-- security definer so they run with the function owner's privileges.
grant execute on function public.take_challenge_snapshot(text) to authenticated, anon, service_role;
grant execute on function public.restore_challenge_snapshot(timestamptz, text, text, text[], boolean) to service_role;
grant execute on function public.reset_member_day(text, text[], integer) to service_role;
grant execute on function public.hourly_challenge_snapshot() to service_role;
grant execute on function public.prune_challenge_snapshots(integer) to service_role;

-- ============================================================
-- SMOKE TEST (run manually):
--
--   1. take a snapshot now
--      select * from public.take_challenge_snapshot('5th');
--
--   2. list the most recent snapshot
--      select distinct snapshot_at
--        from public.challenge_snapshots
--        where cohort = '5th'
--        order by snapshot_at desc limit 3;
--
--   3. dry-run a restore (no writes)
--      select * from public.restore_challenge_snapshot(
--        p_snapshot_at := now(),
--        p_cohort      := '5th',
--        p_dry_run     := true
--      );
-- ============================================================
