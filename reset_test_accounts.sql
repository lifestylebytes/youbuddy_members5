-- ================================================================
-- YOUBUDDY 5기 - 테스트 계정 (유버디, 이규태) state 초기화
-- Supabase SQL Editor에서 한 번만 실행하면 됩니다.
-- ================================================================
-- 효과:
--   - 유버디/이규태 로 저장된 서버 state 삭제 (app_state 레코드)
--   - 두 계정의 커뮤니티 포스트/좋아요도 함께 삭제
--   - 다음 로그인 때 온보딩부터 다시 시작됨
-- ================================================================

-- 1) 서버 state 삭제 (cohort + member_key 매칭)
delete from public.challenge_member_state
where cohort = '5기'
  and member_key in ('유버디', '이규태');

-- 2) 커뮤니티 포스트 삭제
delete from public.challenge_community_posts
where cohort = '5기'
  and member_key in ('유버디', '이규태');

-- 3) 커뮤니티 좋아요 기록 삭제 (내가 누른 것 + 내 포스트 받은 것)
delete from public.challenge_community_likes
where cohort = '5기'
  and member_key in ('유버디', '이규태');

-- 확인용 조회
select 'app_state 남은 레코드 (유버디/이규태):' as label, count(*) as cnt
  from public.challenge_member_state
  where cohort = '5기' and member_key in ('유버디', '이규태')
union all
select '커뮤니티 포스트 남은 레코드 (유버디/이규태):', count(*)
  from public.challenge_community_posts
  where cohort = '5기' and member_key in ('유버디', '이규태')
union all
select '커뮤니티 좋아요 남은 레코드 (유버디/이규태):', count(*)
  from public.challenge_community_likes
  where cohort = '5기' and member_key in ('유버디', '이규태');
-- 위 3개 모두 cnt=0 이면 완전히 삭제된 것.
