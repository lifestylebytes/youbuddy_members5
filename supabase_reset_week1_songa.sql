-- ============================================================
-- 송아님 Week 1 설문만 리셋
-- ------------------------------------------------------------
-- 다른 멤버는 건드리지 않음. week_survey.1 만 제거.
-- ============================================================

-- ① STEP 1 — 송아님 매칭 확인 (먼저 실행해서 정확한 데이터 보기)
SELECT
  member_key,
  app_state ->> 'name'                                         AS name,
  app_state ->> 'englishName'                                  AS english_name,
  app_state ->> 'tier'                                         AS tier,
  app_state -> 'week_survey' -> '1' ->> 'nps'                  AS nps,
  app_state -> 'week_survey' -> '1' ->> 'comment'              AS comment,
  (app_state -> 'week_survey' -> '1' ->> 'at')::timestamptz
    AT TIME ZONE 'Asia/Seoul'                                  AS submitted_kst
FROM public.challenge_member_state
WHERE cohort = '5기'
  AND app_state ->> 'name' LIKE '%송아%';


-- ============================================================
-- ② STEP 2 — 위에서 송아님 1명만 잡혔으면 이 UPDATE 실행
-- ============================================================

UPDATE public.challenge_member_state
SET app_state = app_state #- '{week_survey,1}'
WHERE cohort = '5기'
  AND app_state ->> 'name' LIKE '%송아%';


-- ============================================================
-- ③ 검증 — UPDATE 후 실행. week_survey.1 가 null 이어야 정상.
-- ============================================================

SELECT
  app_state ->> 'name'                       AS name,
  app_state -> 'week_survey' -> '1'          AS week1_survey  -- null 이면 OK ✅
FROM public.challenge_member_state
WHERE cohort = '5기'
  AND app_state ->> 'name' LIKE '%송아%';

-- 끝 ✅
