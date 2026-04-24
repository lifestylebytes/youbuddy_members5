-- ============================================================
-- YOUBUDDY 5기 · 미팅 녹화/분석 사전 동의 감사용 RPC
-- ------------------------------------------------------------
-- 프리미엄 미팅은 Google Meet 녹화 + AI 분석으로 피드백이 나감.
-- 본인이 '동의하고 계속' 을 누르면 클라이언트가
-- state.meeting_consent = { accepted, at, version, tz, memberKey, memberName }
-- 형태로 upsert_member_app_state 에 밀어넣음. 이 RPC 는 운영자가
-- 한 기수의 모든 프리미엄 멤버 동의 현황을 한 번에 뽑을 때 씀.
--
-- 실제 저장 테이블: public.challenge_member_state
--   (app_state JSONB 컬럼 안에 meeting_consent 서브오브젝트로 들어감)
--
-- 실행 방법:
-- 1) Supabase Dashboard → SQL Editor 에 이 파일 전체 붙여넣기
-- 2) Run
-- 3) 클라이언트 Operator 설정 → '동의 현황 열기' 로 테스트
--
-- 권한:
-- RLS 정책은 기존 challenge_member_state 테이블 정책을 그대로 따라감.
-- operator 판별은 클라이언트 단에서만 (window.__openConsentAudit 가드)
-- ============================================================

drop function if exists public.get_cohort_consent_audit(text);

create or replace function public.get_cohort_consent_audit(p_cohort text)
returns table (
  member_name      text,
  english_name     text,
  member_key       text,
  consent_accepted boolean,
  consent_at       text,
  consent_version  integer,
  consent_tz       text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
    coalesce(cms.app_state ->> 'englishName', '') as english_name,
    cms.member_key,
    coalesce((cms.app_state -> 'meeting_consent' ->> 'accepted')::boolean, false) as consent_accepted,
    coalesce((cms.app_state -> 'meeting_consent' ->> 'at')::text, '') as consent_at,
    coalesce((cms.app_state -> 'meeting_consent' ->> 'version')::integer, 0) as consent_version,
    coalesce((cms.app_state -> 'meeting_consent' ->> 'tz')::text, '') as consent_tz
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
  order by cms.member_name asc;
$$;

-- authenticated + anon 둘 다 호출 가능하게. 클라에서 operator 가드로
-- 노출 제한됨 (추가로 RLS 걸고 싶으면 여기 GRANT 제거하고
-- get_cohort_consent_audit_operator 처럼 별도 RPC 파고 verify 추가).
grant execute on function public.get_cohort_consent_audit(text) to authenticated, anon;

-- 끝 ✅
-- 확인:
-- SELECT * FROM public.get_cohort_consent_audit('5th');
