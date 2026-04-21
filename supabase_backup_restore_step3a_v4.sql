-- STEP 3a-v4: v3 + temp table 만들고 snapshot에서 읽어오는 부분까지.
-- v4 성공 → 뒷쪽 upsert 블록이 범인
-- v4 실패 → temp table 관련 execute format이 범인

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
  out_source_table text,
  out_rows_restored integer,
  out_rows_skipped integer
)
language plpgsql
security definer
as $$
declare
  v_table       text;
  v_rowkey_col  text;
  v_updates     text;
  v_col         text;
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

    v_updates := '';
    for v_col in
      select c.column_name
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

    v_filter_mk := case
      when p_member_key is not null and v_table = 'challenge_member_state'
        then format('and row_key = %L', p_member_key)
      when p_member_key is not null and v_table like 'challenge_community_%'
        then format('and (payload->>''member_key'') = %L', p_member_key)
      when p_member_key is not null and v_table = 'challenge_verification_events'
        then format('and (payload->>''member_key'') = %L', p_member_key)
      else ''
    end;

    v_temp_name := format('_restore_%s_%s', v_table,
      regexp_replace(gen_random_uuid()::text, '-', '', 'g'));

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

    execute format('drop table %I', v_temp_name);

    out_source_table  := v_table;
    out_rows_restored := v_restored;
    out_rows_skipped  := v_skipped;
    return next;
  end loop;
end;
$$;

grant execute on function public.restore_challenge_snapshot(timestamptz, text, text, text[], boolean) to service_role;
