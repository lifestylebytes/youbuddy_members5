-- ============================================================
-- YOUBUDDY · 수료식 시상 RPC 에 late_days 추가
-- ------------------------------------------------------------
-- 배경 (2026-08-05):
--   수료 기준이 "18일 인증"에서 "인증 18점 (정시 1점 / 지각 0.5점)" 으로 확정됐는데,
--   get_cohort_awards 는 verified 개수만 세고 있어 지각을 1일로 취급했다.
--   그 결과 앱 안 PDF 게이트(점수 기준)와 수료식 완주상(일수 기준)이 서로 다른 답을
--   내는 상태였다. 여기에 late_days 를 추가해서 클라이언트가 점수로 판정하게 한다.
--
-- 지각 판정 규칙 (get_cohort_member_summaries 와 동일하게 맞춤):
--   지각 = verified_at 날짜 > 그 Day 의 예정일(scheduled_date)
--   Day 예정일 = 코호트 시작일부터 평일만 세어 20일. 주말은 건너뛴다.
--   (금요일 Day 를 토·일에 인증해도 다음 평일 전이라 정시로 인정되는 규칙 그대로)
--
-- 바뀌는 것: members[] 각 항목에 "late_days": 0 필드가 추가된다. 기존 필드는 그대로.
-- 클라이언트는 late_days 가 없으면 지각 0 으로 보고 예전처럼 동작하므로,
-- 이 SQL 을 안 돌려도 앱은 깨지지 않는다 (완주상만 예전 기준으로 남을 뿐).
--
-- 실행: Supabase Dashboard → SQL Editor → 전체 복붙 → Run
-- 확인: select jsonb_pretty(get_cohort_awards('7기') -> 'members' -> 0);
-- ============================================================

create or replace function public.get_cohort_awards_late_days(
  p_cohort text
)
returns table (
  member_key text,
  late_days integer
)
language sql
security definer
as $$
with base as (
  select
    cms.member_key,
    coalesce(cms.app_state -> 'verified', '{}'::jsonb)    as verified,
    coalesce(cms.app_state -> 'verified_at', '{}'::jsonb) as verified_at
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
cohort_start as (
  select case p_cohort
    when '5기' then date '2026-04-27'
    when '6기' then date '2026-06-08'
    when '7기' then date '2026-07-13'
    when '8기' then date '2026-08-10'
    else date '2026-07-13'
  end as start_date
),
-- Day 1~20 의 예정일 (평일만 카운트, 주말 skip)
day_dates as (
  select day_n, scheduled_date
  from (
    select
      row_number() over (order by d) as day_n,
      d as scheduled_date
    from (
      select cs.start_date + i as d
      from cohort_start cs
      cross join generate_series(0, 60) as i
    ) cal
    where extract(dow from d) between 1 and 5
  ) ranked
  where day_n <= 20
)
select
  b.member_key,
  count(*) filter (
    where coalesce((b.verified ->> ('d' || dd.day_n))::boolean, false)
      and nullif(b.verified_at ->> ('d' || dd.day_n), '')::date > dd.scheduled_date
  )::int as late_days
from base b
cross join day_dates dd
group by b.member_key;
$$;

grant execute on function public.get_cohort_awards_late_days(text) to anon, authenticated;


-- ------------------------------------------------------------
-- get_cohort_awards 본체에 late_days 를 끼워 넣는 래퍼.
-- 원본 함수를 건드리지 않고 결과 jsonb 의 members[] 에만 late_days 를 병합한다.
-- (원본을 통째로 재정의하면 나중에 원본이 바뀔 때 두 벌 관리가 되므로 래퍼로 처리)
-- ------------------------------------------------------------
create or replace function public.get_cohort_awards_v2(
  p_cohort text
)
returns jsonb
language sql
security definer
as $$
with src as (
  select public.get_cohort_awards(p_cohort) as j
),
lates as (
  select member_key, late_days from public.get_cohort_awards_late_days(p_cohort)
),
merged as (
  select coalesce(
    jsonb_agg(
      m || jsonb_build_object('late_days', coalesce(l.late_days, 0))
      order by ord
    ),
    '[]'::jsonb
  ) as members
  from src,
       lateral jsonb_array_elements(coalesce(src.j -> 'members', '[]'::jsonb))
         with ordinality as t(m, ord)
  left join lates l
    on l.member_key = coalesce(m ->> 'member_key', m ->> 'name')
)
select (select j from src) || jsonb_build_object('members', (select members from merged));
$$;

grant execute on function public.get_cohort_awards_v2(text) to anon, authenticated;


-- ============================================================
-- 확인용 쿼리 (실행 후 돌려보세요)
-- ------------------------------------------------------------
-- 1) 지각이 있는 멤버가 실제로 잡히는지
--    select * from public.get_cohort_awards_late_days('7기') where late_days > 0 order by late_days desc;
--
-- 2) 일수 기준과 점수 기준의 완주자가 갈리는 사람 (이 목록이 비어 있으면 영향 없음)
--    with a as (
--      select (m ->> 'name') as name,
--             (m ->> 'verified_days')::int as days,
--             (m ->> 'late_days')::int as late
--      from jsonb_array_elements(public.get_cohort_awards_v2('7기') -> 'members') m
--    )
--    select name, days, late, days - late * 0.5 as score
--    from a
--    where days >= 18 and (days - late * 0.5) < 18
--    order by score;
-- ============================================================
