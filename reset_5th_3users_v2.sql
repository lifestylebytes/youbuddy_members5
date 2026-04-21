-- ================================================================
-- YOUBUDDY 5기 - 3명 전체 리셋 (Day 1~20) — v2 name-based
-- 대상: 유버디 / 이규태 / 이지흔
-- Supabase SQL Editor에서 실행
-- ================================================================
-- v2 변경점:
--   v1은 member_key='유버디'로 매칭했는데, 실제 DB에는
--   composite key (예: '00:유버디', '1:이규태', '2:이지흔')로 박혀있어서
--   v2에서는 member_name (컬럼) + app_state->>'name' 둘 다 매칭.
-- ================================================================

begin;

-- 0) 대상자 member_key 확보 (나중에 community 테이블 삭제용)
drop table if exists _reset_keys;
create temp table _reset_keys as
select distinct member_key
from public.challenge_member_state
where cohort = '5기'
  and (
    coalesce(member_name, app_state->>'name') in ('유버디', '이규태', '이지흔')
  );

-- 1) 인증 이벤트 전량 삭제
do $$
begin
  if to_regclass('public.challenge_verification_events') is not null then
    delete from public.challenge_verification_events
    where cohort = '5기'
      and (
        coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
        or member_key in (select member_key from _reset_keys)
      );
  end if;
end $$;

-- 2) app_state에서 학습/인증 관련 섹션만 싹 비우기
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
  and (
    coalesce(member_name, app_state->>'name') in ('유버디', '이규태', '이지흔')
  );

-- 3) 커뮤니티 좋아요 삭제 (대상자 포스트에 달린 것 + 대상자가 남긴 것)
delete from public.challenge_community_likes
where cohort = '5기'
  and (
    post_id in (
      select post_id
      from public.challenge_community_posts
      where cohort = '5기'
        and (
          coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
          or member_key in (select member_key from _reset_keys)
        )
    )
    or coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
    or member_key in (select member_key from _reset_keys)
  );

-- 4) 커뮤니티 댓글 삭제
delete from public.challenge_community_comments
where cohort = '5기'
  and (
    post_id in (
      select post_id
      from public.challenge_community_posts
      where cohort = '5기'
        and (
          coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
          or member_key in (select member_key from _reset_keys)
        )
    )
    or coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
    or member_key in (select member_key from _reset_keys)
  );

-- 5) 커뮤니티 포스트 삭제
delete from public.challenge_community_posts
where cohort = '5기'
  and (
    coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
    or member_key in (select member_key from _reset_keys)
  );

commit;

-- ================================================================
-- 확인용 출력 (아래 member_state_rows는 3이 나와야 정상, 나머지는 0)
-- ================================================================
select 'member_state_rows (유지됨)' as label, count(*) as cnt
from public.challenge_member_state
where cohort = '5기'
  and coalesce(member_name, app_state->>'name') in ('유버디', '이규태', '이지흔')
union all
select 'verification_events', count(*)
from public.challenge_verification_events
where cohort = '5기'
  and coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
union all
select 'community_posts', count(*)
from public.challenge_community_posts
where cohort = '5기'
  and coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
union all
select 'community_comments', count(*)
from public.challenge_community_comments
where cohort = '5기'
  and coalesce(member_name, '') in ('유버디', '이규태', '이지흔')
union all
select 'community_likes', count(*)
from public.challenge_community_likes
where cohort = '5기'
  and coalesce(member_name, '') in ('유버디', '이규태', '이지흔');

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
  and coalesce(member_name, app_state->>'name') in ('유버디', '이규태', '이지흔')
order by name;
