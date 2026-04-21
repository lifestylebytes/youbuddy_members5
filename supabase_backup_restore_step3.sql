-- STEP 3: restore + reset_member_day 함수
-- STEP 2 통과 후 돌려. (이 단계가 가장 복잡해서 문제 소지 있음)

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

    if p_dry_run then
      source_table  := v_table;
      rows_restored := 0;
      rows_skipped  := v_restored;
      return next;
      execute format('drop table %I', v_temp_name);
      continue;
    end if;

    v_insert_sql := format(
      'insert into public.%I select (jsonb_populate_record(null::public.%I, payload)).* ' ||
      'from %I ' ||
      'on conflict (%I) do update set %s',
      v_table, v_table, v_temp_name, v_rowkey_col, v_updates
    );

    begin
      execute v_insert_sql;
    exception when others then
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

create or replace function public.reset_member_day(
  p_cohort       text,
  p_member_keys  text[],
  p_day          integer
)
returns table (step text, rows_affected integer)
language plpgsql
security definer
as $$
#variable_conflict use_column
declare
  v_day_str  text := 'd' || p_day::text;
  v_hook_str text := 'hook-' || p_day::text;
  v_count    integer;
begin
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

grant execute on function public.restore_challenge_snapshot(timestamptz, text, text, text[], boolean) to service_role;
grant execute on function public.reset_member_day(text, text[], integer) to service_role;
