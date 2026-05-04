-- ============================================================
-- YOUBUDDY 5기 · 멤버 지각 인증 정보 (주말 skip 버전)
-- ------------------------------------------------------------
-- get_cohort_member_summaries 에 late_days int[] + english_name 둘 다 포함.
--
-- 5기 Day → 실제 날짜 매핑 (평일만 카운트):
--   Day 1=4/27(월), Day 2=4/28(화), Day 3=4/29(수), Day 4=4/30(목), Day 5=5/1(금)
--   Day 6=5/4(월),  Day 7=5/5(화),  Day 8=5/6(수),  Day 9=5/7(목),  Day 10=5/8(금)
--   Day 11=5/11(월) ... Day 20=5/22(금)
--
-- 지각 판정 = verified_date >= 다음 Day 의 scheduled_date (deadline_date).
-- 즉 Day 5 (금 5/1) 의 deadline 은 Day 6 (월 5/4) 이라 5/2-5/3 (주말) 에 인증해도 정상.
--
-- 실행: Supabase Dashboard → SQL Editor → 전체 복붙 → Run
-- ============================================================

drop function if exists public.get_cohort_member_summaries(text);

create or replace function public.get_cohort_member_summaries(
  p_cohort text
)
returns table (
  member_key text,
  member_name text,
  english_name text,
  tier text,
  role text,
  timezone_text text,
  goal text,
  motive text,
  progress integer,
  streak integer,
  verified_days integer[],
  late_days integer[]
)
language sql
security definer
as $$
with base as (
  select
    cms.member_key,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
    coalesce(cms.app_state ->> 'englishName', '') as english_name,
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') as tier,
    coalesce(cms.app_state ->> 'role', '') as role,
    coalesce(cms.app_state ->> 'timezoneOffsetText', '+0h') as timezone_text,
    coalesce(cms.app_state ->> 'goal', '') as goal,
    coalesce(cms.app_state ->> 'motive', '') as motive,
    cms.app_state
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
cohort_start as (
  select case p_cohort
    when '5기' then date '2026-04-27'
    else date '2026-04-27'
  end as start_date
),
-- Day 1~20 의 실제 날짜 (평일만 카운트) + deadline 매핑.
-- deadline = 다음 Day 의 scheduled_date (= 그 날 자정 — 그 시점 이후 인증은 지각).
-- Day 20 은 lead 가 NULL 이라 fallback (scheduled_date + 4) 로.
day_dates as (
  select
    day_n,
    scheduled_date,
    coalesce(
      lead(scheduled_date) over (order by day_n),
      scheduled_date + 4
    )::date as deadline_date
  from (
    select day_n, scheduled_date from (
      select
        row_number() over (order by d) as day_n,
        d as scheduled_date
      from (
        select cs.start_date + i as d
        from cohort_start cs
        cross join generate_series(0, 60) as i
      ) cal
      where extract(dow from d) between 1 and 5  -- 1=Mon ... 5=Fri (주말 skip)
    ) ranked
    where day_n <= 20
  ) days
),
day_rows as (
  select
    b.member_key,
    b.member_name,
    b.english_name,
    b.tier,
    b.role,
    b.timezone_text,
    b.goal,
    b.motive,
    dd.day_n,
    coalesce((b.app_state -> 'verified' ->> ('d' || dd.day_n))::boolean, false) as verified,
    nullif(b.app_state -> 'verified_at' ->> ('d' || dd.day_n), '')::date as verified_date,
    dd.scheduled_date,
    dd.deadline_date
  from base b
  cross join day_dates dd
),
progress_rows as (
  select
    member_key, member_name, english_name, tier, role, timezone_text, goal, motive,
    count(*) filter (where verified)::int as progress,
    max(day_n) filter (where verified) as last_done_day,
    coalesce(array_agg(day_n order by day_n) filter (where verified), array[]::int[]) as verified_days,
    -- 지각 = 다음 Day 의 scheduled_date (= deadline) 이후에 인증.
    -- Day 5 (금) 의 deadline 은 Day 6 (월) 이라 5/2-5/3 (토·일) 인증은 정상 (지각 X).
    coalesce(
      array_agg(day_n order by day_n) filter (
        where verified and verified_date is not null and verified_date >= deadline_date
      ),
      array[]::int[]
    ) as late_days
  from day_rows
  group by member_key, member_name, english_name, tier, role, timezone_text, goal, motive
),
streak_rows as (
  select p.member_key, count(*)::int as streak
  from progress_rows p
  join lateral (
    select d.day_n, row_number() over (order by d.day_n desc) as rn
    from day_rows d
    where d.member_key = p.member_key
      and d.verified = true
      and p.last_done_day is not null
      and d.day_n <= p.last_done_day
  ) seq on seq.day_n = p.last_done_day - (seq.rn - 1)
  group by p.member_key
)
select
  p.member_key,
  p.member_name,
  p.english_name,
  p.tier,
  p.role,
  p.timezone_text,
  p.goal,
  p.motive,
  p.progress,
  coalesce(s.streak, 0)::int as streak,
  p.verified_days,
  p.late_days
from progress_rows p
left join streak_rows s on s.member_key = p.member_key
order by p.progress desc, coalesce(s.streak, 0) desc, p.member_name asc;
$$;

grant execute on function public.get_cohort_member_summaries(text) to anon, authenticated;

-- 끝 ✅
-- 확인:
--   SELECT member_name, english_name, verified_days, late_days
--   FROM public.get_cohort_member_summaries('5기');
--   기대값: 5/2-5/3 (주말) 에 Day 5 인증한 멤버는 late_days 에서 빠져있어야 함.
-- ============================================================================
