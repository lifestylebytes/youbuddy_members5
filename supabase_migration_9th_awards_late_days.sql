-- ============================================================
-- YOUBUDDY · 9기 시작일(2026-09-14) 추가 · 2026-09-15
-- ------------------------------------------------------------
-- 8기 때와 똑같은 사고가 또 났다: cohort_start 에 9기가 없어서 else(8/10) 로 빠지고,
-- 9기 Day 1(9/14) 인증자 39명 전원이 '지각' 으로 찍혔다. 보드에서 녹음 완료(진한 갈색)가
-- 지각+녹음(연한 황갈색)으로 보여서 "체크가 날아갔다"고 오해했다.
-- late_days 는 조회 시점 계산이라 이 SQL 만 돌리면 즉시 정시로 돌아온다.
--
-- 실행: Supabase Dashboard → SQL Editor → 전체 복붙 → Run
-- 검증: 아래 SELECT 로 9기 late_days 에 1 이 들어간 사람이 0명이어야 정상.
--   select member_name, late_days from public.get_cohort_awards_late_days('9기') where 1 = any(late_days);
-- ============================================================

drop function if exists public.get_cohort_awards_late_days(text);

create or replace function public.get_cohort_awards_late_days(
  p_cohort text
)
returns table (
  member_key text,
  member_name text,
  late_days integer
)
language sql
security definer
as $$
with base as (
  select
    cms.member_key,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
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
    when '9기' then date '2026-09-14'
    else date '2026-09-14'
  end as start_date
),
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
    where extract(dow from d) between 1 and 5   -- 주말 skip (금요일 Day 를 주말에 해도 정시)
  ) ranked
  where day_n <= 20
)
select
  b.member_key,
  b.member_name,
  count(*) filter (
    where coalesce((b.verified ->> ('d' || dd.day_n))::boolean, false)
      and nullif(b.verified_at ->> ('d' || dd.day_n), '')::date > dd.scheduled_date
  )::int as late_days
from base b
cross join day_dates dd
group by b.member_key, b.member_name;
$$;

grant execute on function public.get_cohort_awards_late_days(text) to anon, authenticated;


-- ------------------------------------------------------------
-- 래퍼 재정의: member_key 든 name 이든 둘 중 하나만 맞으면 붙게.
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
  select member_key, member_name, late_days
  from public.get_cohort_awards_late_days(p_cohort)
),
merged as (
  select coalesce(
    jsonb_agg(
      t.m || jsonb_build_object('late_days', coalesce(l.late_days, 0))
      order by t.ord
    ),
    '[]'::jsonb
  ) as members
  from src,
       lateral jsonb_array_elements(coalesce(src.j -> 'members', '[]'::jsonb))
         with ordinality as t(m, ord)
  left join lates l
    on l.member_name = (t.m ->> 'name')
    or l.member_key  = (t.m ->> 'name')
)
select (select j from src) || jsonb_build_object('members', (select members from merged));
$$;

grant execute on function public.get_cohort_awards_v2(text) to anon, authenticated;


-- ============================================================
-- ▼ 실행 후 이 두 개를 꼭 돌려보세요
-- ============================================================

-- [확인 1] 조인이 실제로 붙었는지.
-- raw_late_total 과 merged_late_total 이 같아야 정상.
-- merged 쪽만 0 이면 이름이 안 맞은 것 (그때 알려주세요).
select
  (select coalesce(sum(late_days), 0)
     from public.get_cohort_awards_late_days('7기'))            as raw_late_total,
  (select coalesce(sum((m ->> 'late_days')::int), 0)
     from jsonb_array_elements(public.get_cohort_awards_v2('7기') -> 'members') m)
                                                                as merged_late_total;


-- [확인 2] 일수로는 완주인데 점수로는 미달인 멤버.
-- 결과가 비어 있으면 이번 기수엔 영향받는 사람이 없다는 뜻입니다.
with a as (
  select
    (m ->> 'name')            as name,
    (m ->> 'english_name')    as english_name,
    (m ->> 'tier')            as tier,
    (m ->> 'verified_days')::int as days,
    coalesce((m ->> 'late_days')::int, 0) as late
  from jsonb_array_elements(public.get_cohort_awards_v2('7기') -> 'members') m
)
select name, english_name, tier, days as 인증일수, late as 지각,
       days - late * 0.5 as 점수
from a
where days >= 18
  and (days - late * 0.5) < 18
order by 점수;


-- [확인 3] 참고용. 전체 멤버 점수 순위 (지각 있는 사람만)
with a as (
  select
    (m ->> 'name') as name,
    (m ->> 'verified_days')::int as days,
    coalesce((m ->> 'late_days')::int, 0) as late
  from jsonb_array_elements(public.get_cohort_awards_v2('7기') -> 'members') m
)
select name, days as 인증일수, late as 지각, days - late * 0.5 as 점수,
       case when days - late * 0.5 >= 18 then '완주' else '미달' end as 판정
from a
where late > 0
order by 점수 desc;
