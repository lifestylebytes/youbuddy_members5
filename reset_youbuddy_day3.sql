-- ============================================================
-- 유버디 Day 3 리셋 스크립트 (smoke test)
-- ------------------------------------------------------------
-- 코호트: 5기
-- 멤버:   00:유버디 (code '00' + name '유버디')
-- 대상:   Day 3
-- ============================================================

-- (1) 리셋 전 상태 확인
--     verified['d3'], verified_at['d3'] 보고, Day 3 커뮤 포스트/인증이벤트 있나 카운트.
select
  member_key,
  app_state->'verified'->>'d3'        as verified_d3,
  app_state->'verified_at'->>'d3'     as verified_at_d3,
  (select count(*) from public.challenge_community_posts p
     where p.cohort='5기' and p.member_key='00:유버디' and p.day_n=3) as posts_d3,
  (select count(*) from public.challenge_verification_events v
     where v.cohort='5기' and v.member_key='00:유버디' and v.verified_day=3) as verif_events_d3
from public.challenge_member_state
where cohort='5기' and member_key='00:유버디';

-- (2) 실행 — reset_member_day
select * from public.reset_member_day(
  '5기',
  array['00:유버디'],
  3
);

-- (3) 리셋 후 상태 확인 — 위랑 동일 쿼리
select
  member_key,
  app_state->'verified'->>'d3'        as verified_d3,
  app_state->'verified_at'->>'d3'     as verified_at_d3,
  (select count(*) from public.challenge_community_posts p
     where p.cohort='5기' and p.member_key='00:유버디' and p.day_n=3) as posts_d3,
  (select count(*) from public.challenge_verification_events v
     where v.cohort='5기' and v.member_key='00:유버디' and v.verified_day=3) as verif_events_d3
from public.challenge_member_state
where cohort='5기' and member_key='00:유버디';

-- 기대 결과:
--   Before: verified_d3 = 'true' (또는 값 있음), verified_at_d3 = 시각, posts/events > 0
--   After : verified_d3 = NULL,  verified_at_d3 = NULL, posts/events = 0
