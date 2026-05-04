-- ============================================================
-- Week 1 설문 응답 리셋 (2026-05-04 11시 KST 이후 제출자)
-- ------------------------------------------------------------
-- 사유: 클릭 안 되는 + "모모님" placeholder 이슈로 실수 제출한 케이스
-- 결과: week_survey.1 키만 제거 → 멤버는 다음 진입 시 설문 다시 볼 수 있음
-- 다른 주 (week_survey.2, 3, 4) 응답은 유지 ✅
-- ============================================================

-- ① STEP 1 — 영향받는 사람 먼저 확인 (실행해서 명단 봐!)
SELECT
  member_key,
  app_state ->> 'name'                                         AS name,
  app_state -> 'week_survey' -> '1' ->> 'nps'                  AS nps,
  app_state -> 'week_survey' -> '1' ->> 'difficulty'           AS difficulty,
  app_state -> 'week_survey' -> '1' -> 'want_w2'               AS want_w2,
  app_state -> 'week_survey' -> '1' ->> 'comment'              AS comment,
  (app_state -> 'week_survey' -> '1' ->> 'at')::timestamptz
    AT TIME ZONE 'Asia/Seoul'                                  AS submitted_kst
FROM public.challenge_member_state
WHERE cohort = '5기'
  AND app_state -> 'week_survey' -> '1' ->> 'at' IS NOT NULL
  AND COALESCE((app_state -> 'week_survey' -> '1' ->> 'skipped')::boolean, false) = false
  AND (app_state -> 'week_survey' -> '1' ->> 'at')::timestamptz
      >= '2026-05-04 02:00:00+00:00'::timestamptz  -- KST 5/4 11시 = UTC 5/4 02시
ORDER BY (app_state -> 'week_survey' -> '1' ->> 'at')::timestamptz;


-- ============================================================
-- ② STEP 2 — 위 명단 확인 후 이 UPDATE 실행
-- 모든 멤버의 week_survey.1 만 제거. (week_survey.2/3/4 는 그대로.)
-- ============================================================

UPDATE public.challenge_member_state
SET app_state = app_state #- '{week_survey,1}'
WHERE cohort = '5기'
  AND app_state -> 'week_survey' -> '1' ->> 'at' IS NOT NULL
  AND COALESCE((app_state -> 'week_survey' -> '1' ->> 'skipped')::boolean, false) = false
  AND (app_state -> 'week_survey' -> '1' ->> 'at')::timestamptz
      >= '2026-05-04 02:00:00+00:00'::timestamptz;


-- ============================================================
-- 검증 (UPDATE 후 실행 — 0 rows 나와야 함)
-- ============================================================

SELECT count(*) AS remaining
FROM public.challenge_member_state
WHERE cohort = '5기'
  AND app_state -> 'week_survey' -> '1' ->> 'at' IS NOT NULL
  AND COALESCE((app_state -> 'week_survey' -> '1' ->> 'skipped')::boolean, false) = false
  AND (app_state -> 'week_survey' -> '1' ->> 'at')::timestamptz
      >= '2026-05-04 02:00:00+00:00'::timestamptz;

-- 끝 ✅
