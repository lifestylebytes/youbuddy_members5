-- ============================================================
-- 유버디 (Gaby/운영자) Week 1 설문 리셋
-- ------------------------------------------------------------
-- week_survey.1 만 제거. 다른 주 응답은 보존.
-- ============================================================

-- ① STEP 1 — 매칭 후보 확인 (실행해서 본인 row 인지 봐!)
-- 운영자 role + 이름에 'Gaby' 또는 '유버디' 들어가는 케이스 다 잡음
SELECT
  member_key,
  app_state ->> 'name'                              AS name,
  app_state ->> 'englishName'                       AS english_name,
  app_state ->> 'role'                              AS role,
  app_state ->> 'tier'                              AS tier,
  app_state -> 'week_survey' -> '1' ->> 'nps'       AS nps,
  app_state -> 'week_survey' -> '1' ->> 'comment'   AS comment,
  (app_state -> 'week_survey' -> '1' ->> 'at')::timestamptz
    AT TIME ZONE 'Asia/Seoul'                       AS submitted_kst
FROM public.challenge_member_state
WHERE cohort = '5기'
  AND (
    app_state ->> 'role' IN ('operator', '운영자')
    OR app_state ->> 'name' ILIKE '%gaby%'
    OR app_state ->> 'name' LIKE '%유버디%'
    OR app_state ->> 'englishName' ILIKE '%gaby%'
  );


-- ============================================================
-- ② STEP 2 — 위 결과 보고 본인 member_key 확인 후 UPDATE 실행
-- ⚠️ 'YOUR_MEMBER_KEY_HERE' 자리에 본인 member_key 채워서 실행
-- ============================================================

-- UPDATE public.challenge_member_state
-- SET app_state = app_state #- '{week_survey,1}'
-- WHERE member_key = 'YOUR_MEMBER_KEY_HERE';


-- ============================================================
-- 또는 — 매칭이 1건만 잡히면 이거 그대로 돌려도 OK
-- (위 SELECT 결과가 1 row 였을 때만!)
-- ============================================================

UPDATE public.challenge_member_state
SET app_state = app_state #- '{week_survey,1}'
WHERE cohort = '5기'
  AND (
    app_state ->> 'role' IN ('operator', '운영자')
    OR app_state ->> 'name' ILIKE '%gaby%'
    OR app_state ->> 'name' LIKE '%유버디%'
    OR app_state ->> 'englishName' ILIKE '%gaby%'
  );


-- ============================================================
-- ③ 검증 — week1_survey 가 null 이어야 정상
-- ============================================================

SELECT
  app_state ->> 'name'                  AS name,
  app_state -> 'week_survey' -> '1'     AS week1_survey  -- null = OK ✅
FROM public.challenge_member_state
WHERE cohort = '5기'
  AND (
    app_state ->> 'role' IN ('operator', '운영자')
    OR app_state ->> 'name' ILIKE '%gaby%'
    OR app_state ->> 'name' LIKE '%유버디%'
    OR app_state ->> 'englishName' ILIKE '%gaby%'
  );

-- 끝 ✅
