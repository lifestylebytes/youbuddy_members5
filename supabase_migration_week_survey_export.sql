-- ============================================================
-- YOUBUDDY 5기 · 주간 설문 결과 export RPC
-- ------------------------------------------------------------
-- Week N 보스 테스트 통과 후 멤버가 답변한 1분 설문 (8문항)
-- 을 운영자가 한 큐에 받아볼 수 있게 정리해주는 RPC.
--
-- 응답 구조:
--   {
--     "cohort": "5기", "week": 1,
--     "summary": {
--       "total_members": 39, "submitted": 22, "skipped": 5, "no_response": 12,
--       "response_rate": 56.4,
--       "nps_avg": 8.2, "nps_promoter": 14, "nps_passive": 6, "nps_detractor": 2,
--       "difficulty_avg": 3.4, "ai_help_avg": 4.1, "ux_avg": 4.3,
--       "time_dist": { "lt5": 2, "5to10": 8, "10to20": 9, "gt20": 3 },
--       "stuck_dist": { "memorize": 6, "compose": 8, ... },
--       "want_w2_dist": { "pronunciation": 12, "voice_input": 9, ... }
--     },
--     "responses": [
--       { "name": "...", "english_name": "...", "tier": "premium",
--         "nps": 9, "difficulty": 3, "time": "10to20", "ai_help": 5, "ux": 4,
--         "stuck": "memorize", "want_w2": ["voice_input", "harder_challenge"],
--         "comment": "...", "at": "2026-..." }, ...
--     ]
--   }
--
-- 사용처:
--   - 운영자가 설정 모달의 "📊 Week N 설문 결과" 버튼 누르면 호출
--   - 결과는 JSON 으로 다운로드되거나, 화면에 통계 카드로 표시
-- ============================================================

drop function if exists public.get_cohort_week_survey(text, integer);

create or replace function public.get_cohort_week_survey(
  p_cohort text,
  p_week integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with base as (
  select
    cms.member_key,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
    coalesce(cms.app_state ->> 'englishName', '') as english_name,
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') as tier,
    coalesce((cms.app_state ->> 'isOperator')::boolean, false) as is_operator,
    coalesce((cms.app_state ->> 'isStaff')::boolean, false) as is_staff,
    coalesce((cms.app_state ->> 'ghost')::boolean, false) as is_ghost,
    cms.app_state -> 'week_survey' -> (p_week::text) as survey
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
filtered as (
  -- 운영진/스태프/고스트/익명 제외 (지표 왜곡 방지)
  select * from base
  where is_operator = false
    and is_staff = false
    and is_ghost = false
    and coalesce(member_key, '') not in ('anonymous', '')
    and coalesce(member_name, '') != ''
    and member_name not in ('모모', '유버디', '이규태', '이지흔')
),
-- 응답 분류 — Week 2·3 부터는 NPS 안 받음. 'at' 만으로 submitted 판정.
classified as (
  select *,
    case
      when survey is null or survey = 'null'::jsonb then 'no_response'
      when (survey ->> 'skipped') = 'true' then 'skipped'
      when (survey ->> 'at') is not null then 'submitted'
      else 'no_response'
    end as response_status
  from filtered
),
-- 답변자만 (실제 응답)
submitted_rows as (
  select * from classified where response_status = 'submitted'
),
-- 분포 카운트 헬퍼들
time_dist as (
  select jsonb_object_agg(t, n) as dist from (
    select coalesce(survey ->> 'time', 'unknown') as t, count(*) as n
    from submitted_rows group by 1
  ) x
),
stuck_dist as (
  select jsonb_object_agg(s, n) as dist from (
    select coalesce(survey ->> 'stuck', 'unknown') as s, count(*) as n
    from submitted_rows group by 1
  ) x
),
-- want_w2 는 array 라 unnest 해서 카운트
want_w2_unnest as (
  select jsonb_array_elements_text(coalesce(survey -> 'want_w2', '[]'::jsonb)) as item
  from submitted_rows
),
want_w2_dist as (
  select jsonb_object_agg(item, n) as dist from (
    select item, count(*) as n from want_w2_unnest group by 1
  ) x
),
-- NPS 분류 (0-6 detractor / 7-8 passive / 9-10 promoter)
nps_buckets as (
  select
    count(*) filter (where (survey ->> 'nps')::int >= 9) as promoter,
    count(*) filter (where (survey ->> 'nps')::int between 7 and 8) as passive,
    count(*) filter (where (survey ->> 'nps')::int <= 6) as detractor,
    avg((survey ->> 'nps')::numeric) as avg_nps
  from submitted_rows
  where survey ->> 'nps' ~ '^\d+$'
),
-- 평균값들
averages as (
  select
    round(avg(case when (survey ->> 'difficulty') ~ '^\d+$' then (survey ->> 'difficulty')::numeric end), 2) as difficulty_avg,
    round(avg(case when (survey ->> 'ai_help')    ~ '^\d+$' then (survey ->> 'ai_help')::numeric    end), 2) as ai_help_avg,
    round(avg(case when (survey ->> 'ux')         ~ '^\d+$' then (survey ->> 'ux')::numeric         end), 2) as ux_avg
  from submitted_rows
),
-- 카운트 요약
counts as (
  select
    count(*) as total_members,
    count(*) filter (where response_status = 'submitted') as submitted,
    count(*) filter (where response_status = 'skipped') as skipped,
    count(*) filter (where response_status = 'no_response') as no_response
  from classified
),
-- 개별 응답 정렬 (최신순) — mini 필드도 같이 노출 (시험 입구 미니 설문)
responses as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', member_name,
      'english_name', english_name,
      'tier', tier,
      'nps', nullif(survey ->> 'nps', '')::int,
      'difficulty', nullif(survey ->> 'difficulty', '')::int,
      'time', survey ->> 'time',
      'ai_help', nullif(survey ->> 'ai_help', '')::int,
      'ux', nullif(survey ->> 'ux', '')::int,
      'stuck', survey ->> 'stuck',
      'want_w2', coalesce(survey -> 'want_w2', '[]'::jsonb),
      'comment', coalesce(survey ->> 'comment', ''),
      'at', survey ->> 'at',
      'mini', coalesce(survey -> 'mini', '{}'::jsonb)
    ) order by survey ->> 'at' desc
  ), '[]'::jsonb) as list
  from submitted_rows
),
-- 미니 설문 — 메인 응답 안 한 사람도 mini 만 답할 수 있어서 별도 base 에서 모음.
mini_only_rows as (
  select * from filtered
  where survey -> 'mini' is not null
    and (survey -> 'mini' ->> 'at') is not null
),
mini_responses as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', member_name,
      'english_name', english_name,
      'tier', tier,
      'hardest', survey -> 'mini' ->> 'hardest',
      'amount', survey -> 'mini' ->> 'amount',
      'update_loved', coalesce(survey -> 'mini' -> 'update_loved', '[]'::jsonb),
      'next_week_wish', coalesce(survey -> 'mini' -> 'next_week_wish', '[]'::jsonb),
      'comment', coalesce(survey -> 'mini' ->> 'comment', ''),
      'at', survey -> 'mini' ->> 'at'
    ) order by survey -> 'mini' ->> 'at' desc
  ), '[]'::jsonb) as list
  from mini_only_rows
),
-- 미니 설문 통계
mini_hardest_dist as (
  select jsonb_object_agg(h, n) as dist from (
    select coalesce(survey -> 'mini' ->> 'hardest', 'unknown') as h, count(*) as n
    from mini_only_rows group by 1
  ) x
),
mini_amount_dist as (
  select jsonb_object_agg(a, n) as dist from (
    select coalesce(survey -> 'mini' ->> 'amount', 'unknown') as a, count(*) as n
    from mini_only_rows group by 1
  ) x
),
-- 신규: update_loved · next_week_wish 는 배열이라 unnest 후 카운트
mini_update_loved_unnest as (
  select jsonb_array_elements_text(coalesce(survey -> 'mini' -> 'update_loved', '[]'::jsonb)) as item
  from mini_only_rows
),
mini_update_loved_dist as (
  select jsonb_object_agg(item, n) as dist from (
    select item, count(*) as n from mini_update_loved_unnest group by 1
  ) x
),
mini_wish_unnest as (
  select jsonb_array_elements_text(coalesce(survey -> 'mini' -> 'next_week_wish', '[]'::jsonb)) as item
  from mini_only_rows
),
mini_wish_dist as (
  select jsonb_object_agg(item, n) as dist from (
    select item, count(*) as n from mini_wish_unnest group by 1
  ) x
)
select jsonb_build_object(
  'cohort', p_cohort,
  'week', p_week,
  'summary', jsonb_build_object(
    'total_members', (select total_members from counts),
    'submitted', (select submitted from counts),
    'skipped', (select skipped from counts),
    'no_response', (select no_response from counts),
    'response_rate', case when (select total_members from counts) > 0
      then round(((select submitted from counts)::numeric / (select total_members from counts)) * 100, 1)
      else 0 end,
    'nps_avg', coalesce((select round(avg_nps, 2) from nps_buckets), 0),
    'nps_promoter', coalesce((select promoter from nps_buckets), 0),
    'nps_passive', coalesce((select passive from nps_buckets), 0),
    'nps_detractor', coalesce((select detractor from nps_buckets), 0),
    'difficulty_avg', coalesce((select difficulty_avg from averages), 0),
    'ai_help_avg', coalesce((select ai_help_avg from averages), 0),
    'ux_avg', coalesce((select ux_avg from averages), 0),
    'time_dist', coalesce((select dist from time_dist), '{}'::jsonb),
    'stuck_dist', coalesce((select dist from stuck_dist), '{}'::jsonb),
    'want_w2_dist', coalesce((select dist from want_w2_dist), '{}'::jsonb),
    'mini_count', (select count(*) from mini_only_rows),
    'mini_hardest_dist', coalesce((select dist from mini_hardest_dist), '{}'::jsonb),
    'mini_amount_dist', coalesce((select dist from mini_amount_dist), '{}'::jsonb),
    'mini_update_loved_dist', coalesce((select dist from mini_update_loved_dist), '{}'::jsonb),
    'mini_wish_dist', coalesce((select dist from mini_wish_dist), '{}'::jsonb)
  ),
  'responses', (select list from responses),
  'mini_responses', (select list from mini_responses)
);
$$;

grant execute on function public.get_cohort_week_survey(text, integer) to authenticated, anon;

-- 검증:
-- SELECT public.get_cohort_week_survey('5기', 1);
-- 기대값: summary 필드 + responses 배열.
