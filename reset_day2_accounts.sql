-- ================================================================
-- YOUBUDDY 5기 - Day 2만 리셋
-- 대상: 유버디 / 이규태 / 이지흔
-- Supabase SQL Editor에서 실행
-- ================================================================
-- 효과:
--   - Day 2 인증 이벤트 삭제
--   - Day 2 관련 app_state 키만 제거
--   - Day 2 커뮤니티 포스트/댓글/좋아요 삭제
--   - Day 1 기록은 유지
-- ================================================================

begin;

-- 1) Day 2 인증 이벤트 삭제 (테이블이 있는 경우에만)
do $$
begin
  if to_regclass('public.challenge_verification_events') is not null then
    delete from public.challenge_verification_events
    where cohort = '5기'
      and verified_day = 2
      and member_key in ('유버디', '이규태', '이지흔');
  end if;
end $$;

-- 2) Day 2 app_state 키만 제거
update public.challenge_member_state
set
  app_state = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                coalesce(app_state, '{}'::jsonb),
                '{verified}',
                coalesce(app_state->'verified', '{}'::jsonb) - 'd2',
                true
              ),
              '{verified_at}',
              coalesce(app_state->'verified_at', '{}'::jsonb) - 'd2',
              true
            ),
            '{sentence_notes}',
            (((coalesce(app_state->'sentence_notes', '{}'::jsonb) - 'd2-0') - 'd2-1') - 'd2-2'),
            true
          ),
          '{sentences}',
          ((((coalesce(app_state->'sentences', '{}'::jsonb) - 'd2-0') - 'd2-1') - 'd2-2') - 'hook-2'),
          true
        ),
        '{ai_feedback}',
        ((((coalesce(app_state->'ai_feedback', '{}'::jsonb) - 'd2-0') - 'd2-1') - 'd2-2') - 'hook-2'),
        true
      ),
      '{submitted}',
      (((coalesce(app_state->'submitted', '{}'::jsonb) - 'd2-0') - 'd2-1') - 'd2-2'),
      true
    ),
    '{checkpoints}',
    ((((coalesce(app_state->'checkpoints', '{}'::jsonb) - 'd2-copy') - 'd2-quiz') - 'd2-record') - 'hook-2'),
    true
  ),
  updated_at = now()
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');

-- 2-1) Day 2 관련 community_edits / ai_daily_usage도 제거
update public.challenge_member_state
set
  app_state = jsonb_set(
    jsonb_set(
      coalesce(app_state, '{}'::jsonb),
      '{community_edits}',
      ((((coalesce(app_state->'community_edits', '{}'::jsonb) - 'me-d2-0') - 'me-d2-1') - 'me-d2-2')),
      true
    ),
    '{ai_daily_usage}',
    coalesce(app_state->'ai_daily_usage', '{}'::jsonb) - 'd2',
    true
  ),
  updated_at = now()
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');

-- 3) 대상자들의 Day 2 포스트에 달린 좋아요/댓글 삭제
delete from public.challenge_community_likes
where cohort = '5기'
  and post_id in (
    select post_id
    from public.challenge_community_posts
    where cohort = '5기'
      and day_n = 2
      and member_key in ('유버디', '이규태', '이지흔')
  );

delete from public.challenge_community_comments
where cohort = '5기'
  and post_id in (
    select post_id
    from public.challenge_community_posts
    where cohort = '5기'
      and day_n = 2
      and member_key in ('유버디', '이규태', '이지흔')
  );

-- 4) 대상자들의 Day 2 포스트 삭제
delete from public.challenge_community_posts
where cohort = '5기'
  and day_n = 2
  and member_key in ('유버디', '이규태', '이지흔');

commit;

-- 확인용
select 'community_posts(day2)' as label, count(*) as cnt
from public.challenge_community_posts
where cohort = '5기'
  and day_n = 2
  and member_key in ('유버디', '이규태', '이지흔')
union all
select 'member_state_rows', count(*)
from public.challenge_member_state
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');
