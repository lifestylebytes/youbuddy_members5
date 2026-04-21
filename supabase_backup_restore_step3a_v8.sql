-- STEP 3a-v8: format() 대신 || concat 사용. 나머지는 v5 (full)과 동일.
-- 파서가 format 안의 'null::public.%I' 문자열을 보고 오작동하는 것 같음.

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
  v_insert_sql  text;
  v_filter_mk   text;
  v_restored    integer;
  v_skipped     integer;
  v_temp_name   text;
  v_qtable      text;
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
        then 'and row_key = ' || quote_literal(p_member_key)
      when p_member_key is not null and v_table like 'challenge_community_%'
        then 'and (payload->>''member_key'') = ' || quote_literal(p_member_key)
      when p_member_key is not null and v_table = 'challenge_verification_events'
        then 'and (payload->>''member_key'') = ' || quote_literal(p_member_key)
      else ''
    end;

    v_temp_name := '_restore_' || v_table || '_' || regexp_replace(gen_random_uuid()::text, '-', '', 'g');

    execute 'create temp table ' || quote_ident(v_temp_name)
         || ' (row_key text, payload jsonb) on commit drop';

    execute 'insert into ' || quote_ident(v_temp_name) || ' (row_key, payload) '
         || 'select distinct on (row_key) row_key, payload '
         || 'from public.challenge_snapshots '
         || 'where source_table = ' || quote_literal(v_table)
         || '  and snapshot_at <= $1 '
         || '  and ($2 is null or cohort = $2) '
         || '  ' || v_filter_mk
         || ' order by row_key, snapshot_at desc'
         using p_snapshot_at, p_cohort;
    get diagnostics v_restored = row_count;
    v_skipped := 0;

    if p_dry_run then
      out_source_table  := v_table;
      out_rows_restored := 0;
      out_rows_skipped  := v_restored;
      return next;
      execute 'drop table ' || quote_ident(v_temp_name);
      continue;
    end if;

    v_qtable := 'public.' || quote_ident(v_table);

    v_insert_sql :=
         'insert into ' || v_qtable
      || ' select (jsonb_populate_record(null::' || v_qtable || ', payload)).* '
      || 'from ' || quote_ident(v_temp_name) || ' '
      || 'on conflict (' || quote_ident(v_rowkey_col) || ') do update set ' || v_updates;

    begin
      execute v_insert_sql;
    exception when others then
      raise notice 'restore upsert failed on %: %', v_table, sqlerrm;
      execute 'delete from ' || v_qtable
           || ' where ' || quote_ident(v_rowkey_col)
           || ' in (select row_key from ' || quote_ident(v_temp_name) || ')';
      execute 'insert into ' || v_qtable
           || ' select (jsonb_populate_record(null::' || v_qtable || ', payload)).* '
           || 'from ' || quote_ident(v_temp_name);
    end;

    execute 'drop table ' || quote_ident(v_temp_name);

    out_source_table  := v_table;
    out_rows_restored := v_restored;
    out_rows_skipped  := v_skipped;
    return next;
  end loop;
end;
$$;

grant execute on function public.restore_challenge_snapshot(timestamptz, text, text, text[], boolean) to service_role;
