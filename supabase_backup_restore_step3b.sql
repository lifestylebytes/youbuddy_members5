-- STEP 3b: reset_member_day 단독
-- 3a 통과하면 이걸로 넘어와.

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

grant execute on function public.reset_member_day(text, text[], integer) to service_role;
