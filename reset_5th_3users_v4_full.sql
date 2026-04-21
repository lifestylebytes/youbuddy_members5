-- ================================================================
-- YOUBUDDY 5기 - 3명 완전 리셋 (v4 - 전면판)
-- 대상: 00:유버디 / 1:이규태 / 2:이지흔
-- ================================================================
-- 왜 v4?
--   v3는 state 비우고 community/verification_events 지웠는데,
--   hourly snapshot 테이블이 별도로 peer 보드 캐싱하고 있어서
--   그걸 못 지우면 보드에 Day 1/2/3 계속 오렌지 뜸.
--   + 단어 북마크 (saved_syns) 도 여기서 같이 확실히 비움.
-- ================================================================

begin;

-- ------------------------------------------------------------
-- 1) 인증 이벤트 전량 삭제
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.challenge_verification_events') is not null then
    delete from public.challenge_verification_events
    where cohort = '5기'
      and member_key in ('00:유버디', '1:이규태', '2:이지흔');
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) app_state 학습 섹션 전면 초기화
--    - 모든 day (1~20) 관련 키 싹 비움
--    - saved_syns (단어 북마크) 포함
--    - 프로필(name/code/goal/tier/role/timezone*)은 유지
-- ------------------------------------------------------------
update public.challenge_member_state
set
  app_state = (
    (coalesce(app_state, '{}'::jsonb)
      || jsonb_build_object(
        'verified',         '{}'::jsonb,
        'verified_at',      '{}'::jsonb,
        'verified_time',    '{}'::jsonb,
        'sentences',        '{}'::jsonb,
        'sentence_notes',   '{}'::jsonb,
        'submitted',        '{}'::jsonb,
        'ai_feedback',      '{}'::jsonb,
        'saved_syns',       '{}'::jsonb,
        'checkpoints',      '{}'::jsonb,
        'community_edits',  '{}'::jsonb,
        'ai_daily_usage',   '{}'::jsonb
      ))
    - 'streak'
    - 'progress_day'
  ),
  updated_at = now()
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔');

-- ------------------------------------------------------------
-- 3) 커뮤니티 좋아요/댓글/포스트 삭제
-- ------------------------------------------------------------
delete from public.challenge_community_likes
where cohort = '5기'
  and (
    post_id in (
      select post_id from public.challenge_community_posts
      where cohort = '5기'
        and member_key in ('00:유버디', '1:이규태', '2:이지흔')
    )
    or member_key in ('00:유버디', '1:이규태', '2:이지흔')
  );

delete from public.challenge_community_comments
where cohort = '5기'
  and (
    post_id in (
      select post_id from public.challenge_community_posts
      where cohort = '5기'
        and member_key in ('00:유버디', '1:이규태', '2:이지흔')
    )
    or member_key in ('00:유버디', '1:이규태', '2:이지흔')
  );

delete from public.challenge_community_posts
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔');

-- ------------------------------------------------------------
-- 4) hourly snapshot 캐시 테이블 — 보드가 여기서 peer 데이터 끌어옴
--    테이블 있으면 해당 3명의 행 삭제. 다음 hourly 사이클에 재생성됨.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.challenge_community_completion_snapshot') is not null then
    delete from public.challenge_community_completion_snapshot
    where cohort = '5기'
      and member_key in ('00:유버디', '1:이규태', '2:이지흔');
  end if;
  if to_regclass('public.challenge_member_progress_snapshot') is not null then
    delete from public.challenge_member_progress_snapshot
    where cohort = '5기'
      and member_key in ('00:유버디', '1:이규태', '2:이지흔');
  end if;
end $$;

commit;

-- ================================================================
-- 확인용 — member_state_rows는 3, 나머지 전부 0
-- ================================================================
select 'member_state_rows (유지됨)' as label, count(*) as cnt
from public.challenge_member_state
where cohort='5기' and member_key in ('00:유버디','1:이규태','2:이지흔')
union all
select 'verification_events', count(*)
from public.challenge_verification_events
where cohort='5기' and member_key in ('00:유버디','1:이규태','2:이지흔')
union all
select 'community_posts', count(*)
from public.challenge_community_posts
where cohort='5기' and member_key in ('00:유버디','1:이규태','2:이지흔')
union all
select 'community_comments', count(*)
from public.challenge_community_comments
where cohort='5기' and member_key in ('00:유버디','1:이규태','2:이지흔')
union all
select 'community_likes', count(*)
from public.challenge_community_likes
where cohort='5기' and member_key in ('00:유버디','1:이규태','2:이지흔');

-- app_state 내부 실제 비워졌는지 — verified/sentences/checkpoints/saved_syns 전부 '{}'이어야 정상
select
  member_key,
  coalesce(member_name, app_state->>'name') as name,
  app_state->'verified'      as verified,
  app_state->'verified_at'   as verified_at,
  app_state->'verified_time' as verified_time,
  app_state->'sentences'     as sentences,
  app_state->'checkpoints'   as checkpoints,
  app_state->'ai_feedback'   as ai_feedback,
  app_state->'saved_syns'    as saved_syns,
  app_state->'submitted'     as submitted
from public.challenge_member_state
where cohort='5기' and member_key in ('00:유버디','1:이규태','2:이지흔')
order by member_key;
