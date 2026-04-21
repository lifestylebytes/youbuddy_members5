-- ================================================================
-- YOUBUDDY 5기 - 3명 전체 리셋 (Day 1~20) — v3 hardcoded keys
-- 대상: 유버디 (00:유버디) / 이규태 (1:이규태) / 이지흔 (2:이지흔)
-- Supabase SQL Editor에서 실행
-- ================================================================
-- v3 변경점:
--   진단 쿼리로 member_key 포맷을 확정 (composite: '{code}:{name}').
--   challenge_verification_events에는 member_name 컬럼이 없어서
--   member_key 하드코딩으로 단순화.
-- ================================================================

begin;

-- 1) 인증 이벤트 전량 삭제
do $$
begin
  if to_regclass('public.challenge_verification_events') is not null then
    delete from public.challenge_verification_events
    where cohort = '5기'
      and member_key in ('00:유버디', '1:이규태', '2:이지흔');
  end if;
end $$;

-- 2) app_state에서 학습/인증 관련 섹션만 싹 비우기 (프로필/세팅은 유지)
update public.challenge_member_state
set
  app_state = (
    (coalesce(app_state, '{}'::jsonb)
      || jsonb_build_object(
        'verified',        '{}'::jsonb,
        'verified_at',     '{}'::jsonb,
        'verified_time',   '{}'::jsonb,
        'sentences',       '{}'::jsonb,
        'sentence_notes',  '{}'::jsonb,
        'submitted',       '{}'::jsonb,
        'ai_feedback',     '{}'::jsonb,
        'saved_syns',      '{}'::jsonb,
        'checkpoints',     '{}'::jsonb,
        'community_edits', '{}'::jsonb,
        'ai_daily_usage',  '{}'::jsonb
      ))
    - 'streak'
    - 'progress_day'
  ),
  updated_at = now()
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔');

-- 3) 커뮤니티 좋아요 삭제 (대상자 포스트에 달린 것 + 대상자가 남긴 것)
delete from public.challenge_community_likes
where cohort = '5기'
  and (
    post_id in (
      select post_id
      from public.challenge_community_posts
      where cohort = '5기'
        and member_key in ('00:유버디', '1:이규태', '2:이지흔')
    )
    or member_key in ('00:유버디', '1:이규태', '2:이지흔')
  );

-- 4) 커뮤니티 댓글 삭제
delete from public.challenge_community_comments
where cohort = '5기'
  and (
    post_id in (
      select post_id
      from public.challenge_community_posts
      where cohort = '5기'
        and member_key in ('00:유버디', '1:이규태', '2:이지흔')
    )
    or member_key in ('00:유버디', '1:이규태', '2:이지흔')
  );

-- 5) 커뮤니티 포스트 삭제
delete from public.challenge_community_posts
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔');

commit;

-- ================================================================
-- 확인용 출력 (member_state_rows는 3이어야 정상, 나머지는 0)
-- ================================================================
select 'member_state_rows (유지됨)' as label, count(*) as cnt
from public.challenge_member_state
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔')
union all
select 'verification_events', count(*)
from public.challenge_verification_events
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔')
union all
select 'community_posts', count(*)
from public.challenge_community_posts
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔')
union all
select 'community_comments', count(*)
from public.challenge_community_comments
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔')
union all
select 'community_likes', count(*)
from public.challenge_community_likes
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔');

-- app_state 실제 비워졌는지 3명 모두 확인 (전부 '{}'이어야 정상)
select
  member_key,
  coalesce(member_name, app_state->>'name') as name,
  app_state->'verified'    as verified,
  app_state->'sentences'   as sentences,
  app_state->'checkpoints' as checkpoints,
  app_state->'ai_feedback' as ai_feedback
from public.challenge_member_state
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔')
order by member_key;
