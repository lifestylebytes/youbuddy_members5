-- ================================================================
-- YOUBUDDY 5기 - 3명 전체 리셋 (Day 1~20)
-- 대상: 유버디 / 이규태 / 이지흔
-- Supabase SQL Editor에서 실행
-- ================================================================
-- 목적:
--   4기 기반으로 이미 입력된 데이터 (문장·AI 리뷰·인증·체크포인트 등)를 전부 싹 비우고
--   5기 새 단어장 기준으로 깨끗하게 다시 시작할 수 있도록 리셋.
-- 유지:
--   name, code, goal, tier, role, timezone, currentDay 등 프로필/세팅은 유지.
-- 리셋:
--   sentences, ai_feedback, verified, verified_at, verified_time,
--   checkpoints, saved_syns, sentence_notes, submitted,
--   community_edits, ai_daily_usage, streak 등 전부 비움.
--   + community_posts / comments / likes / verification_events 전부 삭제.
-- ================================================================

begin;

-- 1) 인증 이벤트 전량 삭제 (3명, 5기, 모든 day)
do $$
begin
  if to_regclass('public.challenge_verification_events') is not null then
    delete from public.challenge_verification_events
    where cohort = '5기'
      and member_key in ('유버디', '이규태', '이지흔');
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
    - 'streak'               -- 로컬에서 재계산되므로 제거
    - 'progress_day'         -- 로컬에서 재계산
  ),
  updated_at = now()
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');

-- 3) 커뮤니티 좋아요 삭제 (3명의 포스트에 달린 것)
delete from public.challenge_community_likes
where cohort = '5기'
  and post_id in (
    select post_id
    from public.challenge_community_posts
    where cohort = '5기'
      and member_key in ('유버디', '이규태', '이지흔')
  );

-- 4) 커뮤니티 댓글 삭제
delete from public.challenge_community_comments
where cohort = '5기'
  and post_id in (
    select post_id
    from public.challenge_community_posts
    where cohort = '5기'
      and member_key in ('유버디', '이규태', '이지흔')
  );

-- 4-1) 3명이 다른 사람 포스트에 남긴 좋아요/댓글도 정리
delete from public.challenge_community_likes
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');

delete from public.challenge_community_comments
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');

-- 5) 커뮤니티 포스트 삭제 (모든 day)
delete from public.challenge_community_posts
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');

commit;

-- 확인용 출력 (전부 0이어야 정상)
select 'verification_events' as label, count(*) as cnt
from public.challenge_verification_events
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔')
union all
select 'community_posts', count(*)
from public.challenge_community_posts
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔')
union all
select 'community_comments', count(*)
from public.challenge_community_comments
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔')
union all
select 'community_likes', count(*)
from public.challenge_community_likes
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔')
union all
select 'member_state_rows (유지됨)', count(*)
from public.challenge_member_state
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔');

-- member_state 내부 확인 (전부 '{}'이어야 정상)
select
  member_key,
  app_state->'verified'    as verified,
  app_state->'sentences'   as sentences,
  app_state->'checkpoints' as checkpoints,
  app_state->'ai_feedback' as ai_feedback
from public.challenge_member_state
where cohort = '5기'
  and member_key in ('유버디', '이규태', '이지흔')
order by member_key;
