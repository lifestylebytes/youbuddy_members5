-- ============================================================
-- YOUBUDDY 5기 · 파이널 테스트 결과 + 단어집 다운로드 export RPC
-- ------------------------------------------------------------
-- Week 4 파이널 테스트(OX·객관식·빈칸 채점 + 작문 3문장 무점수)의
-- 멤버별 점수/제출 여부와, 4주 단어집 PDF · 노션 문장 다운로드 기록을
-- 운영자가 한 큐에 받아볼 수 있게 정리해주는 RPC.
--
-- 클라이언트 state 구조 (challenge_member_state.app_state):
--   final_test: {
--     score, total, at, attempts,
--     answers: { ox:[...], mc:[...], fill:[...], writing:[...] },
--     writing: [ { en, text }, ... ]
--   }
--   final_downloads: { pdf_at, notion_at }
--
-- 응답 구조:
--   {
--     "cohort": "5기",
--     "summary": {
--       "total_members": 39, "completed": 21, "no_response": 18,
--       "completion_rate": 53.8,
--       "score_avg": 8.4, "score_max": 10,
--       "pdf_downloaded": 17, "notion_downloaded": 9
--     },
--     "responses": [
--       { "name": "...", "english_name": "...", "tier": "premium",
--         "score": 9, "total": 10, "attempts": 2, "at": "2026-...",
--         "writing_count": 3,
--         "pdf_at": "2026-...", "notion_at": null }, ...
--     ]
--   }
--
-- 사용처:
--   - 운영자가 설정 모달의 "📊 파이널 테스트 결과 (JSON)" 버튼 → supabaseRpc('get_cohort_final_test', { p_cohort })
-- ============================================================

drop function if exists public.get_cohort_final_test(text);

create or replace function public.get_cohort_final_test(
  p_cohort text
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
    cms.app_state -> 'final_test' as final_test,
    cms.app_state -> 'final_downloads' as downloads
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
classified as (
  select *,
    case
      when final_test is null or final_test = 'null'::jsonb then 'no_response'
      when (final_test ->> 'at') is not null then 'completed'
      else 'no_response'
    end as status
  from filtered
),
completed_rows as (
  select * from classified where status = 'completed'
),
counts as (
  select
    count(*) as total_members,
    count(*) filter (where status = 'completed') as completed,
    count(*) filter (where status = 'no_response') as no_response,
    count(*) filter (where (downloads ->> 'pdf_at') is not null) as pdf_downloaded,
    count(*) filter (where (downloads ->> 'notion_at') is not null) as notion_downloaded
  from classified
),
score_stats as (
  select
    round(avg(case when (final_test ->> 'score') ~ '^\d+$' then (final_test ->> 'score')::numeric end), 2) as score_avg,
    max(case when (final_test ->> 'score') ~ '^\d+$' then (final_test ->> 'score')::int end) as score_max
  from completed_rows
),
responses as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', member_name,
      'english_name', english_name,
      'tier', tier,
      'score', nullif(final_test ->> 'score', '')::int,
      'total', nullif(final_test ->> 'total', '')::int,
      'attempts', coalesce(nullif(final_test ->> 'attempts', '')::int, 1),
      'at', final_test ->> 'at',
      'writing_count', coalesce(jsonb_array_length(final_test -> 'writing'), 0),
      'pdf_at', downloads ->> 'pdf_at',
      'notion_at', downloads ->> 'notion_at'
    ) order by final_test ->> 'at' desc
  ), '[]'::jsonb) as list
  from completed_rows
)
select jsonb_build_object(
  'cohort', p_cohort,
  'summary', jsonb_build_object(
    'total_members', (select total_members from counts),
    'completed', (select completed from counts),
    'no_response', (select no_response from counts),
    'completion_rate', case when (select total_members from counts) > 0
      then round(((select completed from counts)::numeric / (select total_members from counts)) * 100, 1)
      else 0 end,
    'score_avg', coalesce((select score_avg from score_stats), 0),
    'score_max', coalesce((select score_max from score_stats), 0),
    'pdf_downloaded', (select pdf_downloaded from counts),
    'notion_downloaded', (select notion_downloaded from counts)
  ),
  'responses', (select list from responses)
);
$$;

grant execute on function public.get_cohort_final_test(text) to authenticated, anon;

-- 검증:
-- SELECT public.get_cohort_final_test('5기');
-- 기대값: summary (completed / completion_rate / score_avg / pdf_downloaded / notion_downloaded)
--         + responses 배열 (멤버별 점수·시도·다운로드 시각).
