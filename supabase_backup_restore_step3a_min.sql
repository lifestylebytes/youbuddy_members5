-- STEP 3a-MIN: restore 함수의 최소 뼈대만. #variable_conflict 제거.
-- 이것도 에러 나면 함수 선언부 자체가 문제.

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
  v_table text;
begin
  foreach v_table in array p_tables loop
    out_source_table  := v_table;
    out_rows_restored := 0;
    out_rows_skipped  := 0;
    return next;
  end loop;
end;
$$;

grant execute on function public.restore_challenge_snapshot(timestamptz, text, text, text[], boolean) to service_role;
