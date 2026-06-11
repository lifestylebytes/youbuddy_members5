-- ============================================================
-- YOUBUDDY 5기 · 수료식 시상 데이터 export RPC
-- ------------------------------------------------------------
-- 수료식(프리미엄/베이직 따로) 때 운영자가 화면공유로 띄울
-- "수료식 시상" 화면에 필요한 멤버별 집계 + 코호트 약점 단어를
-- 한 번에 내려주는 RPC. (회원에게는 노출 X — 운영자 전용 화면에서만 호출)
--
-- 시상 카테고리(빠른참여/예문정성/새벽반/올빼미/완주/AI활용/파이널고득점/
-- 설문응답/커뮤니티 등)는 클라이언트(JS)에서 이 집계로 계산.
-- 운영자만 아는 상(발표 용기상·미팅 개근상·상황극/음성녹음)은 JS 에서 하드코딩.
--
-- 응답 구조:
--   {
--     "cohort": "5기",
--     "generated_at": "2026-05-25T...",
--     "most_confused": [
--       { "word": "front-load", "weakness_score": 78.2,
--         "first_wrong": 14, "total_wrong": 18, "members_attempted": 22 }, ...
--     ],
--     "members": [
--       { "name": "...", "english_name": "...", "tier": "premium",
--         "verified_days": 20, "week1_days": 5, "week4_days": 5,
--         "first_verified_date": "2026-04-20",
--         "earliest_time": "05:12", "earliest_minutes": 312,
--         "latest_time": "23:58", "latest_minutes": 1438,
--         "sentence_count": 58, "sentence_chars": 4210, "sentence_max_chars": 180,
--         "ai_uses": 31, "final_score": 19, "final_total": 20, "final_attempts": 2,
--         "survey_count": 4, "survey_comment_chars": 220,
--         "bingo_best_score": 10, "bingo_best_total": 10,
--         "community_comments": 7 }, ...
--     ]
--   }
-- ============================================================

drop function if exists public.get_cohort_awards(text);

create or replace function public.get_cohort_awards(
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
    coalesce(cms.app_state -> 'verified', '{}'::jsonb)      as verified,
    coalesce(cms.app_state -> 'verified_at', '{}'::jsonb)   as verified_at,
    coalesce(cms.app_state -> 'verified_time', '{}'::jsonb) as verified_time,
    coalesce(cms.app_state -> 'sentences', '{}'::jsonb)     as sentences,
    coalesce(cms.app_state -> 'ai_feedback', '{}'::jsonb)   as ai_feedback,
    coalesce(cms.app_state -> 'week_survey', '{}'::jsonb)   as week_survey,
    coalesce(cms.app_state -> 'bingo_boss_results', '{}'::jsonb) as bingo_boss,
    coalesce(cms.app_state -> 'community_comments', '{}'::jsonb) as community_comments,
    cms.app_state -> 'final_test' as final_test,
    coalesce(cms.app_state -> 'vocab_stats', '{}'::jsonb)   as vocab_stats
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
filtered as (
  -- 운영진/스태프/고스트/익명 제외 (지표 왜곡 방지) — 다른 export RPC 와 동일 필터
  select * from base
  where is_operator = false
    and is_staff = false
    and is_ghost = false
    and coalesce(member_key, '') not in ('anonymous', '')
    and coalesce(member_name, '') != ''
    and member_name not in ('모모', '유버디', '이규태', '이지흔')
),
-- ── 인증 일수 (verified map 의 true 개수 + 주차별) ──────────────
verified_counts as (
  select
    f.member_key,
    count(*) filter (where e.value = 'true'::jsonb) as verified_days,
    count(*) filter (where e.value = 'true'::jsonb
      and (regexp_replace(e.key, '\D', '', 'g'))::int between 1 and 5) as week1_days,
    count(*) filter (where e.value = 'true'::jsonb
      and (regexp_replace(e.key, '\D', '', 'g'))::int between 16 and 20) as week4_days
  from filtered f
  left join lateral jsonb_each(f.verified) e on true
  where e.key ~ '\d'
  group by f.member_key
),
-- ── 최초 인증 날짜 ─────────────────────────────────────────────
first_dates as (
  select f.member_key, min(e.value) as first_verified_date
  from filtered f
  left join lateral jsonb_each_text(f.verified_at) e on true
  where e.value ~ '^\d{4}-\d{2}-\d{2}$'
  group by f.member_key
),
-- ── 인증 시각 (가장 이른/늦은 분) ─────────────────────────────
time_stats as (
  select
    f.member_key,
    min((split_part(e.value,':',1))::int * 60 + (split_part(e.value,':',2))::int) as earliest_minutes,
    max((split_part(e.value,':',1))::int * 60 + (split_part(e.value,':',2))::int) as latest_minutes
  from filtered f
  left join lateral jsonb_each_text(f.verified_time) e on true
  where e.value ~ '^\d{1,2}:\d{2}$'
  group by f.member_key
),
-- ── 작성 예문 (개수/총 글자수/최장) ──────────────────────────
sentence_stats as (
  select
    f.member_key,
    count(*) filter (where length(btrim(e.value)) > 0) as sentence_count,
    coalesce(sum(length(btrim(e.value))), 0) as sentence_chars,
    coalesce(max(length(btrim(e.value))), 0) as sentence_max_chars
  from filtered f
  left join lateral jsonb_each_text(f.sentences) e on true
  group by f.member_key
),
-- ── AI 교정 사용 횟수 ─────────────────────────────────────────
ai_stats as (
  select f.member_key, count(*) as ai_uses
  from filtered f
  left join lateral jsonb_object_keys(f.ai_feedback) k on true
  group by f.member_key
),
-- ── 주간 설문 응답 (제출 개수 + 코멘트 글자수) ───────────────
survey_stats as (
  select
    f.member_key,
    count(*) filter (where (e.value ->> 'at') is not null) as survey_count,
    coalesce(sum(length(coalesce(e.value ->> 'comment', ''))), 0) as survey_comment_chars
  from filtered f
  left join lateral jsonb_each(f.week_survey) e on true
  group by f.member_key
),
-- ── 보스 테스트 최고점 ────────────────────────────────────────
bingo_stats as (
  select
    f.member_key,
    max(nullif(e.value ->> 'score','')::int) as bingo_best_score,
    max(nullif(e.value ->> 'total','')::int) as bingo_best_total
  from filtered f
  left join lateral jsonb_each(f.bingo_boss) e on true
  group by f.member_key
),
-- ── 커뮤니티 댓글 수 (post 별 배열 길이 합) ──────────────────
comment_stats as (
  select
    f.member_key,
    coalesce(sum(case when jsonb_typeof(e.value)='array' then jsonb_array_length(e.value) else 0 end), 0) as community_comments
  from filtered f
  left join lateral jsonb_each(f.community_comments) e on true
  group by f.member_key
),
members as (
  select
    f.member_key, f.member_name, f.english_name, f.tier,
    coalesce(vc.verified_days, 0) as verified_days,
    coalesce(vc.week1_days, 0)    as week1_days,
    coalesce(vc.week4_days, 0)    as week4_days,
    fd.first_verified_date,
    ts.earliest_minutes, ts.latest_minutes,
    coalesce(ss.sentence_count, 0)     as sentence_count,
    coalesce(ss.sentence_chars, 0)     as sentence_chars,
    coalesce(ss.sentence_max_chars, 0) as sentence_max_chars,
    coalesce(ai.ai_uses, 0) as ai_uses,
    nullif(f.final_test ->> 'score','')::int as final_score,
    nullif(f.final_test ->> 'total','')::int as final_total,
    coalesce(nullif(f.final_test ->> 'attempts','')::int, case when f.final_test ->> 'at' is not null then 1 else null end) as final_attempts,
    coalesce(svy.survey_count, 0) as survey_count,
    coalesce(svy.survey_comment_chars, 0) as survey_comment_chars,
    bs.bingo_best_score, bs.bingo_best_total,
    coalesce(cs.community_comments, 0) as community_comments
  from filtered f
  left join verified_counts vc on vc.member_key = f.member_key
  left join first_dates fd      on fd.member_key = f.member_key
  left join time_stats ts       on ts.member_key = f.member_key
  left join sentence_stats ss   on ss.member_key = f.member_key
  left join ai_stats ai         on ai.member_key = f.member_key
  left join survey_stats svy    on svy.member_key = f.member_key
  left join bingo_stats bs      on bs.member_key = f.member_key
  left join comment_stats cs    on cs.member_key = f.member_key
),
-- ── 코호트 약점 단어 Top (vocab_stats 합산) ──────────────────
vocab_flat as (
  select e.key as word, e.value as v
  from filtered f,
       lateral jsonb_each(f.vocab_stats) e
  where jsonb_typeof(e.value) = 'object'
),
vocab_word as (
  select
    word,
    count(*) filter (where (v ->> 'firstResult') = 'correct') as first_correct,
    count(*) filter (where (v ->> 'firstResult') = 'wrong') as first_wrong,
    count(*) as members_attempted,
    coalesce(sum(nullif(v ->> 'w','')::int), 0) as total_wrong
  from vocab_flat
  group by word
),
vocab_ranked as (
  select
    word, first_wrong, total_wrong, members_attempted,
    round(
      (100 - case when (first_correct + first_wrong) > 0
              then (first_correct::numeric / (first_correct + first_wrong)) * 100
              else 50 end)
    , 1) as weakness_score
  from vocab_word
  order by weakness_score desc, total_wrong desc, word asc
  limit 5
)
select jsonb_build_object(
  'cohort', p_cohort,
  'generated_at', now(),
  'most_confused', coalesce(
    (select jsonb_agg(jsonb_build_object(
      'word', word,
      'weakness_score', weakness_score,
      'first_wrong', first_wrong,
      'total_wrong', total_wrong,
      'members_attempted', members_attempted
    )) from vocab_ranked), '[]'::jsonb),
  'members', coalesce(
    (select jsonb_agg(jsonb_build_object(
      'name', member_name,
      'english_name', english_name,
      'tier', tier,
      'verified_days', verified_days,
      'week1_days', week1_days,
      'week4_days', week4_days,
      'first_verified_date', first_verified_date,
      'earliest_time', case when earliest_minutes is not null
        then lpad((earliest_minutes/60)::text,2,'0')||':'||lpad((earliest_minutes%60)::text,2,'0') else null end,
      'earliest_minutes', earliest_minutes,
      'latest_time', case when latest_minutes is not null
        then lpad((latest_minutes/60)::text,2,'0')||':'||lpad((latest_minutes%60)::text,2,'0') else null end,
      'latest_minutes', latest_minutes,
      'sentence_count', sentence_count,
      'sentence_chars', sentence_chars,
      'sentence_max_chars', sentence_max_chars,
      'ai_uses', ai_uses,
      'final_score', final_score,
      'final_total', final_total,
      'final_attempts', final_attempts,
      'survey_count', survey_count,
      'survey_comment_chars', survey_comment_chars,
      'bingo_best_score', bingo_best_score,
      'bingo_best_total', bingo_best_total,
      'community_comments', community_comments
    ) order by verified_days desc, sentence_chars desc)
    from members), '[]'::jsonb)
);
$$;

grant execute on function public.get_cohort_awards(text) to authenticated, anon;

-- 검증:
-- SELECT public.get_cohort_awards('5기');
-- 기대값: members 배열(멤버별 집계) + most_confused(약점 단어 Top5).
