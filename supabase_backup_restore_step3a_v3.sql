-- STEP 3a-v3: 바디의 앞부분만. for v_col 루프까지만 포함.
-- 이게 되면 루프는 범인 아님 → 뒷부분(execute format)이 범인.
-- 이게 깨지면 for v_col 루프 or information_schema 쿼리가 범인.

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

    out_source_table  := v_table;
    out_rows_restored := 0;
    out_rows_skipped  := 0;
    return next;
  end loop;
end;
$$;

grant execute on function public.restore_challenge_snapshot(timestamptz, text, text, text[], boolean) to service_role;
