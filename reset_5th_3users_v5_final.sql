-- ================================================================
-- YOUBUDDY 5기 - 3명 완전 리셋 (v5 - final)
-- 대상: 00:유버디 / 1:이규태 / 2:이지흔
-- ================================================================
-- v4 대비 바뀐 점:
--   v4는 서버 측은 깨끗이 비웠는데, 각 디바이스의 localStorage 에
--   stale state (verified d1/d2, saved_syns 등) 이 남아있고,
--   클라이언트가 포커스/visibility 전환 타이밍에 그걸 서버로 다시
--   업로드해서 조용히 리셋을 되살려놓는 게 문제였어요.
--
--   클라이언트 쪽은 index.html 에서 stateHydrated 가드 + 리모트 하이드레이트
--   이후 localStorage 덮어쓰기로 수정 완료. 이 SQL 은 서버만 다시 깨끗이
--   비우면 됨. 실행 후 각 디바이스에서 URL 에 ?reset=1 붙여서 한 번씩만
--   새로고침해주세요.
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

-- 2) app_state 학습 섹션 전면 초기화 (프로필/타임존/역할은 유지)
--    - 모든 day (1~20) 관련 키 싹 비움
--    - saved_syns (단어 북마크) 포함
--    - streak / progress_day 는 서버 쪽 파생 키라 삭제
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
        'ai_daily_usage',   '{}'::jsonb,
        'quiz_answers',     '{}'::jsonb,
        'bookmarks',        '{}'::jsonb,
        'community_likes',  '{}'::jsonb,
        'community_bookmarks','{}'::jsonb,
        'community_comments','{}'::jsonb,
        'meeting_notes',    '{}'::jsonb
      ))
    - 'streak'
    - 'progress_day'
  ),
  updated_at = now()
where cohort = '5기'
  and member_key in ('00:유버디', '1:이규태', '2:이지흔');

-- 3) 커뮤니티 좋아요/댓글/포스트 삭제
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

-- 4) hourly snapshot 캐시 (보드가 peer 데이터 끌어오는 소스)
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
-- 확인 1 — member_state_rows 는 3, 나머지 테이블 카운트는 전부 0
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

-- 확인 2 — app_state 내부가 실제로 비워졌는지
--   verified / sentences / saved_syns / submitted 가 전부 '{}' 이어야 정상
select
  member_key,
  coalesce(member_name, app_state->>'name') as name,
  app_state->'verified'      as verified,
  app_state->'verified_at'   as verified_at,
  app_state->'verified_time' as verified_time,
  app_state->'sentences'     as sentences,
  app_state->'saved_syns'    as saved_syns,
  app_state->'submitted'     as submitted,
  app_state->'checkpoints'   as checkpoints
from public.challenge_member_state
where cohort='5기' and member_key in ('00:유버디','1:이규태','2:이지흔')
order by member_key;

-- ================================================================
-- 각 디바이스에서 해야할 일 (서버 리셋만으로는 부족):
--
--   1) 현재 youbuddy 탭을 전부 닫아주세요.
--   2) 새 탭에서 URL 맨 뒤에 ?reset=1 붙여서 열어주세요.
--      예) https://<host>/?reset=1
--   3) 한 번 로드되면 ?reset=1 이 자동으로 사라지고 깨끗하게 리셋됨.
--
-- ?reset=1 은 localStorage 를 비우고, 클라가 서버에서 reset 된 상태를
-- 새로 받아오게 해줍니다. 이 과정이 끝나기 전까지는 stateHydrated 가
-- false 라 클라가 서버에 stale 상태를 다시 업로드하지 않아요.
-- ================================================================
