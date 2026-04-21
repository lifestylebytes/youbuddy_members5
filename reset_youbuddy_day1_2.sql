-- ============================================================
-- 유버디 Day 1 + Day 2 리셋
-- ------------------------------------------------------------
-- 코호트: 5기
-- 멤버:   00:유버디
-- 대상:   Day 1, Day 2
-- ============================================================

-- (1) 리셋 전 상태 확인
select
  member_key,
  app_state->'verified'->>'d1'    as verified_d1,
  app_state->'verified_at'->>'d1' as verified_at_d1,
  app_state->'verified'->>'d2'    as verified_d2,
  app_state->'verified_at'->>'d2' as verified_at_d2,
  (select count(*) from public.challenge_community_posts p
     where p.cohort='5기' and p.member_key='00:유버디' and p.day_n in (1,2)) as posts_d1_d2,
  (select count(*) from public.challenge_verification_events v
     where v.cohort='5기' and v.member_key='00:유버디' and v.verified_day in (1,2)) as verif_events_d1_d2
from public.challenge_member_state
where cohort='5기' and member_key='00:유버디';

-- (2) Day 1 리셋
select * from public.reset_member_day(
  '5기',
  array['00:유버디'],
  1
);

-- (3) Day 2 리셋
select * from public.reset_member_day(
  '5기',
  array['00:유버디'],
  2
);

-- (3-1) verified_time 도 깔끔하게 함께 비움 (함수가 안 지우는 필드)
update public.challenge_member_state
set app_state = jsonb_set(
      app_state,
      '{verified_time}',
      ((coalesce(app_state->'verified_time','{}'::jsonb) - 'd1') - 'd2'),
      true
    ),
    updated_at = now()
where cohort='5기' and member_key='00:유버디';

-- (4) 리셋 후 상태 확인
select
  member_key,
  app_state->'verified'->>'d1'    as verified_d1,
  app_state->'verified_at'->>'d1' as verified_at_d1,
  app_state->'verified_time'->>'d1' as verified_time_d1,
  app_state->'verified'->>'d2'    as verified_d2,
  app_state->'verified_at'->>'d2' as verified_at_d2,
  app_state->'verified_time'->>'d2' as verified_time_d2,
  (select count(*) from public.challenge_community_posts p
     where p.cohort='5기' and p.member_key='00:유버디' and p.day_n in (1,2)) as posts_d1_d2,
  (select count(*) from public.challenge_verification_events v
     where v.cohort='5기' and v.member_key='00:유버디' and v.verified_day in (1,2)) as verif_events_d1_d2
from public.challenge_member_state
where cohort='5기' and member_key='00:유버디';

-- 기대 결과 (After):
--   verified_d1 = NULL, verified_at_d1 = NULL, verified_time_d1 = NULL
--   verified_d2 = NULL, verified_at_d2 = NULL, verified_time_d2 = NULL
--   posts_d1_d2 = 0, verif_events_d1_d2 = 0
