-- ============================================================================
-- Day 3 싱크 확진: 이규태 + 5기 멤버 전원의 verified 상태 직접 덤프
-- ============================================================================
-- Supabase 대시보드 → SQL Editor → New query → 복붙 → Run
-- ============================================================================

-- A. 5기 멤버 전원의 verified 키를 flat 하게 펼쳐서 누가 Day 몇을 찍었는지
--    날것 그대로 보여준다. 이걸로 '이규태가 실제로 Day 3 를 올렸는지' 확인.
select
  coalesce(cms.member_name, cms.app_state ->> 'name', '(?)') as member,
  cms.app_state ->> 'englishName' as eng,
  cms.tier,
  -- 개별 일자 verified 상태
  coalesce((cms.app_state -> 'verified' ->> 'd1')::boolean, false) as d1,
  coalesce((cms.app_state -> 'verified' ->> 'd2')::boolean, false) as d2,
  coalesce((cms.app_state -> 'verified' ->> 'd3')::boolean, false) as d3,
  coalesce((cms.app_state -> 'verified' ->> 'd4')::boolean, false) as d4,
  coalesce((cms.app_state -> 'verified' ->> 'd5')::boolean, false) as d5,
  -- 마지막 업데이트 시간 (어느 시점까지 sync 됐는지)
  cms.updated_at
from public.challenge_member_state cms
where cms.cohort = '5기'
order by member;

-- B. 현재 서버에 등록된 get_cohort_member_summaries 함수가
--    verified_days 를 반환하는 버전인지 확인.
--    english_name + verified_days 두 컬럼 모두 있어야 '최신 마이그레이션 적용됨'.
select
  p.proname as function_name,
  pg_get_function_result(p.oid) as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_cohort_member_summaries';

-- C. RPC 를 실제로 호출해서 반환값 미리보기 (클라이언트가 받는 데이터와 동일)
select *
from public.get_cohort_member_summaries('5기')
order by member_name;
