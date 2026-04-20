-- ============================================================
-- YOUBUDDY · Supabase hourly snapshot + restore device
-- ------------------------------------------------------------
-- PURPOSE
--   Backstop against accidental bulk deletes / resets of the two
--   critical tables in this challenge:
--     (1) challenge_member_state      → 내 학습/진행률/대시보드
--     (2) challenge_community_posts   → 커뮤니티
--         challenge_community_comments
--         challenge_community_likes
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
  v_has_cohort  boolean;
  v_tables      text[] := array[
    'challenge_member_state',
    'challenge_community_posts',
    'challenge_community_comments',
    'challenge_community_likes'
  ];
begin
  foreach v_table in array v_tables loop
    -- skip tables that don't exist in this DB
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;

    v_rowkey_col := public._challenge_snapshot_rowkey_expr(v_table);

    -- does this table have a cohort column? if yes we can filter, if no we snapshot all
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = 'cohort'
    ) into v_has_cohort;

    v_sql := format(
      'insert into public.challenge_snapshots (snapshot_at, source_table, cohort, row_key, payload) ' ||
      'select $1, %L, %s, coalesce((t.%I)::text, ''unknown''), to_jsonb(t.*) ' ||
      'from public.%I t ' ||
      'where ($2 is null %s)',
      v_table,
      case when v_has_cohort then 't.cohort' else 'null' end,
      v_rowkey_col,
      v_table,
      case when v_has_cohort then 'or t.cohort = $2' else '' end
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
    'challenge_community_likes'
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
declare
  v_table       text;
  v_rowkey_col  text;
  v_has_cohort  boolean;
  v_cols        text;
  v_updates     text;
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

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = 'cohort'
    ) into v_has_cohort;

    -- Build the live columns list (ordered, excluding generated id for insert safety)
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
    where table_schema = 'public' and table_name = v_table
      and (is_generated = 'NEVER' and identity_generation is null or column_name <> 'id');

    -- Build UPDATE SET clause — update every column except the row-key and id.
    select string_agg(
      format('%I = excluded.%I', column_name, column_name),
      ', '
      order by ordinal_position
    )
    into v_updates
    from information_schema.columns
    where table_schema = 'public' and table_name = v_table
      and column_name <> v_rowkey_col
      and column_name <> 'id';

    -- A restorable snapshot = the most recent snapshot row per row_key
    -- at or before p_snapshot_at, within the optional cohort+member filter.
    v_filter_mk := case
      when p_member_key is not null and v_table = 'challenge_member_state'
        then format('and row_key = %L', p_member_key)
      when p_member_key is not null and v_table like 'challenge_community_%'
        -- member_key lives inside payload for community tables — filter on jsonb.
        then format('and (payload->>''member_key'') = %L', p_member_key)
      else ''
    end;

    -- Stage to a temp table so we can report counts cleanly.
    v_temp_name := format('_restore_%s_%s', v_table,
      regexp_replace(gen_random_uuid()::text, '-', '', 'g'));

    execute format(
      'create temp table %I on commit drop as ' ||
      'select distinct on (row_key) row_key, payload ' ||
      'from public.challenge_snapshots ' ||
      'where source_table = %L ' ||
      '  and snapshot_at <= $1 ' ||
      '  and ($2 is null %s or cohort = $2) ' ||
      '  %s ' ||
      'order by row_key, snapshot_at desc',
      v_temp_name,
      v_table,
      case when v_has_cohort then '' else 'or true' end,
      v_filter_mk
    ) using p_snapshot_at, p_cohort;

    -- How many rows are we about to touch?
    execute format('select count(*) from %I', v_temp_name) into v_restored;
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
--    If pg_cron isn't available, you can invoke hourly_challenge_snapshot()
--    from a Supabase Edge Function Scheduled Trigger instead.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Unschedule previous job if it exists (idempotent).
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'youbuddy-challenge-hourly-snapshot';

    perform cron.schedule(
      'youbuddy-challenge-hourly-snapshot',
      '7 * * * *',    -- HH:07 every hour — stagger off the top of the hour
      $cron$ select public.hourly_challenge_snapshot(); $cron$
    );
  else
    raise notice 'pg_cron not available — run public.hourly_challenge_snapshot() from an external scheduler.';
  end if;
end;
$$;


-- ------------------------------------------------------------
-- 8. Quick-look helpers for operator triage.
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
