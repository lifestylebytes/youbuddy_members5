-- ============================================================
-- YOUBUDDY 7기 · 데일리 펄스 응답 전체 집계 (베이직 / 프리미엄 분리)
-- ------------------------------------------------------------
-- state.daily_pulse[day] = { a, b, etcA, etcB, text, at }
--   a    = Q1 객관식 선택값
--   b    = Q2 객관식 선택값 (D18 만 해당)
--   etcA = Q1 '기타' 직접 입력
--   etcB = Q2 '기타' 직접 입력
--   text = 전용 주관식 문항 (D19 Q2, D20 Q2)
--
-- 실행: SQL Editor 에 [쿼리 1] → [쿼리 2] 순서로 각각 Run 하고 결과를 붙여주세요.
-- ============================================================


-- ============================================================
-- [쿼리 1] 객관식 응답 분포, 티어별
-- ============================================================
with base as (
  select
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') as tier,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as name,
    coalesce(cms.app_state -> 'daily_pulse', '{}'::jsonb) as pulse
  from public.challenge_member_state cms
  where cms.cohort = '7기'
    and coalesce((cms.app_state ->> 'isOperator')::boolean, false) = false
    and coalesce((cms.app_state ->> 'isStaff')::boolean, false) = false
    and coalesce(cms.member_name, '') not in ('', '모모', '유버디', '이규태', '이지흔')
),
flat as (
  select b.tier, b.name, e.key::int as day_n, e.value as ans
  from base b, lateral jsonb_each(b.pulse) e
  where e.key ~ '^\d+$'
),
picked as (
  select tier, day_n, 'Q1' as q, (ans ->> 'a') as v from flat where ans ->> 'a' is not null
  union all
  select tier, day_n, 'Q2' as q, (ans ->> 'b') as v from flat where ans ->> 'b' is not null
),
labeled as (
  select p.*, case p.v
    -- D15
    when 'fire_drill' then 'Fire drill'
    when 'spof' then 'Single point of failure'
    when 'long_pole' then 'Long pole in the tent'
    when 'under_bus' then 'Throw under the bus'
    when 'pull_plug' then 'Pull the plug'
    -- D16 체감 변화
    when 'much_better' then '확실히 편해졌어요'
    when 'bit_better' then '조금 나아진 것 같아요'
    when 'same' then '아직 잘 모르겠어요'
    when 'worse' then '오히려 더 어렵게 느껴져요'
    -- D17 제일 도움된 것
    when 'routine' then '매일 하게 만드는 루틴 자체'
    when 'words' then '표현·단어를 실제로 익힌 것'
    when 'ai' then 'AI 첨삭으로 내 문장 고친 것'
    when 'peers' then '다른 멤버들 문장 보는 것'
    when 'meeting' then '미팅에서 직접 말해본 것'
    -- D18 Q1 이후 계획
    when 'keep_alone' then '혼자라도 계속해볼 생각'
    when 'will_stop' then '솔직히 끊길 것 같다'
    when 'find_other' then '다른 방법을 찾아볼 것'
    when 'not_yet' then '아직 생각 안 해봤다'
    -- D18 Q2 나중에 하는 이유 (★ 리텐션 핵심)
    when 'time' then '시간이 안 나서'
    when 'money' then '금액이 부담돼서'
    when 'alone_ok' then '이제 혼자 해볼 만해서'
    when 'unsure_effect' then '효과를 잘 모르겠어서'
    when 'level' then '난이도가 안 맞아서'
    -- D19 있었으면 하는 것
    when 'morning' then '아침에 같이 하는 시간'
    when 'lighter' then '더 짧고 가볍게'
    when 'coach_1on1' then '1:1로 봐주는 피드백'
    when 'report' then '내가 얼마나 늘었는지 리포트'
    when 'more_speak' then '실제로 말해보는 시간 더'
    -- D20 한마디 설명
    when 'habit' then '영어를 매일 하게 만들어주는 곳'
    when 'practical' then '회사에서 진짜 쓰는 표현만'
    when 'together' then '혼자 안 해도 되게 해주는 곳'
    when 'speak' then '입으로 뱉어보게 만드는 곳'
    when 'etc' then '기타 (직접 입력)'
    else p.v end as label
  from picked p
)
select
  day_n as "Day", q as "문항", label as "선택지",
  count(*) filter (where tier = 'basic')   as "베이직",
  count(*) filter (where tier = 'premium') as "프리미엄",
  count(*)                                  as "합계"
from labeled
group by day_n, q, label
order by day_n, q, "합계" desc;


-- ============================================================
-- [쿼리 2] 주관식 원문 전체, 티어별 (기타 입력 + 자유 서술)
-- ============================================================
with base as (
  select
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') as tier,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as name,
    coalesce(cms.app_state -> 'daily_pulse', '{}'::jsonb) as pulse
  from public.challenge_member_state cms
  where cms.cohort = '7기'
    and coalesce((cms.app_state ->> 'isOperator')::boolean, false) = false
    and coalesce((cms.app_state ->> 'isStaff')::boolean, false) = false
    and coalesce(cms.member_name, '') not in ('', '모모', '유버디', '이규태', '이지흔')
),
flat as (
  select b.tier, b.name, e.key::int as day_n, e.value as ans
  from base b, lateral jsonb_each(b.pulse) e
  where e.key ~ '^\d+$'
)
select day_n as "Day", tier as "티어", kind as "종류", txt as "원문"
from (
  select tier, name, day_n, 'Q1 기타' as kind, ans ->> 'etcA' as txt from flat
  union all
  select tier, name, day_n, 'Q2 기타' as kind, ans ->> 'etcB' as txt from flat
  union all
  select tier, name, day_n, '자유서술' as kind, ans ->> 'text' as txt from flat
) t
where coalesce(trim(txt), '') <> ''
order by day_n, tier, kind;


-- ============================================================
-- [쿼리 3] 응답률 (인사이트 신뢰도 판단용)
-- ============================================================
with base as (
  select
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') as tier,
    coalesce(cms.app_state -> 'daily_pulse', '{}'::jsonb) as pulse
  from public.challenge_member_state cms
  where cms.cohort = '7기'
    and coalesce((cms.app_state ->> 'isOperator')::boolean, false) = false
    and coalesce((cms.app_state ->> 'isStaff')::boolean, false) = false
    and coalesce(cms.member_name, '') not in ('', '모모', '유버디', '이규태', '이지흔')
)
select
  tier as "티어",
  count(*) as "인원",
  count(*) filter (where pulse ? '15') as "D15",
  count(*) filter (where pulse ? '16') as "D16",
  count(*) filter (where pulse ? '17') as "D17",
  count(*) filter (where pulse ? '18') as "D18",
  count(*) filter (where pulse ? '19') as "D19",
  count(*) filter (where pulse ? '20') as "D20"
from base
group by tier
order by tier;
