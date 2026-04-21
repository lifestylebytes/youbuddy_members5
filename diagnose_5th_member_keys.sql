-- ================================================================
-- 5기 실제 member_key 확인용 진단 쿼리
-- 리셋 SQL 돌리기 전에 DB에 박힌 키 포맷부터 확인
-- ================================================================

-- 1) 5기 cohort에 저장된 모든 member_key / member_name 나열
select
  member_key,
  app_state->>'name'      as name_in_state,
  app_state->>'accessCode' as access_code,
  app_state->>'email'      as email,
  app_state->'verified'    as verified_dump,
  updated_at
from public.challenge_member_state
where cohort = '5기'
order by updated_at desc;

-- 2) 이름이 유버디/이규태/이지흔 중 하나인 행만 (member_key 포맷 무관)
select
  member_key,
  app_state->>'name'   as name_in_state,
  app_state->'verified' as verified_dump
from public.challenge_member_state
where cohort = '5기'
  and app_state->>'name' in ('유버디', '이규태', '이지흔');

-- 3) 커뮤니티 포스트에 박힌 member_key도 확인
select distinct member_key, member_name
from public.challenge_community_posts
where cohort = '5기'
order by member_key;
