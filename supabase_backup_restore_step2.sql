-- STEP 2: 스냅샷 writer + prune + hourly wrapper + view
-- STEP 1 통과 후 돌려.

create or replace function public.take_challenge_snapshot(p_cohort text default null)
returns table (source_table text, rows_captured integer, snapshot_at timestamptz)
language plpgsql
security definer
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
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;

    v_rowkey_col := public._challenge_snapshot_rowkey_expr(v_table);

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

create or replace function public.prune_challenge_snapshots(p_keep_days integer default 14)
returns integer
language plpgsql
security definer
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

create or replace function public.hourly_challenge_snapshot()
returns void
language plpgsql
security definer
as $$
begin
  perform public.take_challenge_snapshot(null);
  perform public.prune_challenge_snapshots(14);
end;
$$;

create or replace view public.v_challenge_snapshot_summary as
select
  source_table,
  cohort,
  date_trunc('hour', snapshot_at) as hour_bucket,
  count(*) as row_count
from public.challenge_snapshots
group by 1,2,3
order by hour_bucket desc, source_table;

grant execute on function public.take_challenge_snapshot(text) to authenticated, anon, service_role;
grant execute on function public.hourly_challenge_snapshot() to service_role;
grant execute on function public.prune_challenge_snapshots(integer) to service_role;
