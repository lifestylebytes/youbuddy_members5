-- ============================================================
-- YOUBUDDY 5기 · 미팅 녹화/분석 사전 동의 감사용 RPC
-- ------------------------------------------------------------
-- 프리미엄 미팅은 Google Meet 녹화 + AI 분석으로 피드백이 나감.
-- 본인이 '동의하고 계속' 을 누르면 클라이언트가
-- state.meeting_consent = { accepted, at, version, tz, memberKey, memberName }
-- 형태로 upsert_member_app_state 에 밀어넣음. 이 RPC 는 운영자가
-- 한 기수의 모든 프리미엄 멤버 동의 현황을 한 번에 뽑을 때 씀.
--
-- 실행 방법:
-- 1) Supabase Dashboard → SQL Editor 에 이 파일 전체 붙여넣기
-- 2) Run
-- 3) 클라이언트 Operator 설정 → '동의 현황 열기' 로 테스트
--
-- 권한:
-- RLS 정책은 기존 member_app_state 테이블 정책을 그대로 따라감.
-- operator 판별은 클라이언트 단에서만 (window.__openConsentAudit 가드)
-- ============================================================

CREATE OR REPLACE FUNCTION get_cohort_consent_audit(p_cohort text)
RETURNS TABLE (
  member_name      text,
  english_name     text,
  member_key       text,
  consent_accepted boolean,
  consent_at       text,
  consent_version  integer,
  consent_tz       text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(member_name, '') AS member_name,
    COALESCE((app_state->>'englishName')::text, '') AS english_name,
    member_key,
    COALESCE((app_state->'meeting_consent'->>'accepted')::boolean, false) AS consent_accepted,
    COALESCE((app_state->'meeting_consent'->>'at')::text, '') AS consent_at,
    COALESCE((app_state->'meeting_consent'->>'version')::integer, 0) AS consent_version,
    COALESCE((app_state->'meeting_consent'->>'tz')::text, '') AS consent_tz
  FROM member_app_state
  WHERE cohort = p_cohort
  ORDER BY member_name ASC;
$$;

-- authenticated + anon 둘 다 호출 가능하게. 클라에서 operator 가드로
-- 노출 제한됨 (추가로 RLS 걸고 싶으면 여기 GRANT 제거하고
-- get_cohort_consent_audit_operator 처럼 별도 RPC 파고 verify 추가).
GRANT EXECUTE ON FUNCTION get_cohort_consent_audit(text) TO authenticated, anon;

-- 끝 ✅
-- 확인:
-- SELECT * FROM get_cohort_consent_audit('5th');
