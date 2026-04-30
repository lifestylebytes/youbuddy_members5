-- ============================================================
-- YOUBUDDY 5기 · 약점 어휘 분석 RPC
-- ------------------------------------------------------------
-- 멤버 클라이언트가 단어시험 풀 때마다 state.vocab_stats[word] 에
--   { c: 정답수, w: 오답수, h: 힌트수, s: 스킵수,
--     firstResult: 'correct'|'wrong', firstAt, firstHinted, lastWrongAt, ... }
-- 을 silent 저장해둔 데이터를 코호트 단위로 합산.
--
-- 응답 예:
-- {
--   "cohort": "5기",
--   "totals": { "members_with_stats": 27, "total_attempts": 412, "avg_correct_rate": 78.4 },
--   "words": [
--     {
--       "word": "front-load",
--       "members_attempted": 22,
--       "first_correct": 8, "first_wrong": 14,
--       "first_correct_rate": 36.4,         -- 첫 시도 정답률 (낮을수록 약점)
--       "first_hinted": 6,
--       "total_correct": 30, "total_wrong": 18,
--       "total_hint": 12, "total_skip": 4,
--       "correct_rate": 62.5,
--       "weakness_score": 78.2              -- (100 - first_correct_rate) + 보정
--     }, ...
--   ]
-- }
--
-- 운영진/스태프/고스트/익명 자동 제외. daily_stats 와 동일한 필터.
-- ============================================================

drop function if exists public.get_cohort_vocab_stats(text);

create or replace function public.get_cohort_vocab_stats(
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
    coalesce((cms.app_state ->> 'isOperator')::boolean, false) as is_operator,
    coalesce((cms.app_state ->> 'isStaff')::boolean, false) as is_staff,
    coalesce((cms.app_state ->> 'ghost')::boolean, false) as is_ghost,
    coalesce(cms.app_state -> 'vocab_stats', '{}'::jsonb) as vs
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
filtered as (
  select * from base
  where is_operator = false
    and is_staff = false
    and is_ghost = false
    and coalesce(member_key, '') not in ('anonymous', '')
    and coalesce(member_name, '') != ''
    and member_name not in ('모모', '유버디', '이규태', '이지흔')
    and jsonb_typeof(vs) = 'object'
    and vs <> '{}'::jsonb
),
-- 멤버×단어 한 행씩 unnest
flat as (
  select
    f.member_name,
    e.key as word,
    e.value as v
  from filtered f,
       lateral jsonb_each(f.vs) e
  where jsonb_typeof(e.value) = 'object'
),
-- 단어별 집계
per_word as (
  select
    word,
    count(distinct member_name) as members_attempted,
    count(*) filter (where (v ->> 'firstResult') = 'correct') as first_correct,
    count(*) filter (where (v ->> 'firstResult') = 'wrong') as first_wrong,
    count(*) filter (where (v ->> 'firstHinted')::boolean = true) as first_hinted,
    coalesce(sum(nullif(v ->> 'c', '')::int), 0) as total_correct,
    coalesce(sum(nullif(v ->> 'w', '')::int), 0) as total_wrong,
    coalesce(sum(nullif(v ->> 'h', '')::int), 0) as total_hint,
    coalesce(sum(nullif(v ->> 's', '')::int), 0) as total_skip,
    -- 멤버 시도 dump (개별 분석용 — 카드 펼치기에서 사용)
    jsonb_agg(jsonb_build_object(
      'member_name', member_name,
      'first_result', v ->> 'firstResult',
      'first_at', v ->> 'firstAt',
      'first_hinted', (v ->> 'firstHinted')::boolean,
      'c', nullif(v ->> 'c', '')::int,
      'w', nullif(v ->> 'w', '')::int,
      'h', nullif(v ->> 'h', '')::int,
      's', nullif(v ->> 's', '')::int,
      'last_wrong_at', v ->> 'lastWrongAt'
    ) order by member_name) as member_attempts
  from flat
  group by word
),
ranked as (
  select
    word,
    members_attempted,
    first_correct,
    first_wrong,
    first_hinted,
    total_correct,
    total_wrong,
    total_hint,
    total_skip,
    case when (first_correct + first_wrong) > 0
      then round((first_correct::numeric / (first_correct + first_wrong)) * 100, 1)
      else 0 end as first_correct_rate,
    case when (total_correct + total_wrong) > 0
      then round((total_correct::numeric / (total_correct + total_wrong)) * 100, 1)
      else 0 end as correct_rate,
    -- weakness_score: 첫 시도 오답률 + 힌트 의존도 + 스킵 가중.
    -- 0~100, 높을수록 약점. 운영자가 한 눈에 우선순위 잡으려고.
    round(
      (100 - case when (first_correct + first_wrong) > 0
              then (first_correct::numeric / (first_correct + first_wrong)) * 100
              else 50 end) * 0.6
      + (case when members_attempted > 0
              then (first_hinted::numeric / members_attempted) * 100
              else 0 end) * 0.25
      + (case when (total_correct + total_wrong + total_skip) > 0
              then (total_skip::numeric / (total_correct + total_wrong + total_skip)) * 100
              else 0 end) * 0.15
    , 1) as weakness_score,
    member_attempts
  from per_word
),
totals as (
  select
    count(*) filter (where vs <> '{}'::jsonb) as members_with_stats
  from filtered
),
agg as (
  select
    sum(total_correct + total_wrong) as total_attempts,
    case when sum(total_correct + total_wrong) > 0
      then round((sum(total_correct)::numeric / sum(total_correct + total_wrong)) * 100, 1)
      else 0 end as avg_correct_rate
  from ranked
)
select jsonb_build_object(
  'cohort', p_cohort,
  'totals', jsonb_build_object(
    'members_with_stats', (select members_with_stats from totals),
    'total_attempts', coalesce((select total_attempts from agg), 0),
    'avg_correct_rate', coalesce((select avg_correct_rate from agg), 0),
    'total_words', (select count(*) from ranked)
  ),
  'words', coalesce(
    (select jsonb_agg(jsonb_build_object(
      'word', word,
      'members_attempted', members_attempted,
      'first_correct', first_correct,
      'first_wrong', first_wrong,
      'first_correct_rate', first_correct_rate,
      'first_hinted', first_hinted,
      'total_correct', total_correct,
      'total_wrong', total_wrong,
      'total_hint', total_hint,
      'total_skip', total_skip,
      'correct_rate', correct_rate,
      'weakness_score', weakness_score,
      'member_attempts', member_attempts
    ) order by weakness_score desc, total_wrong desc, word asc)
    from ranked),
    '[]'::jsonb
  )
);
$$;

grant execute on function public.get_cohort_vocab_stats(text) to authenticated, anon;

-- 검증:
-- SELECT public.get_cohort_vocab_stats('5기');
-- 기대값: words 배열 — weakness_score 내림차순으로 약점 단어 먼저.
