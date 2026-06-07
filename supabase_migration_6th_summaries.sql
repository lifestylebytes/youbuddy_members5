-- ============================================================
-- YOUBUDDY 6기 · 대시보드 멤버 싱크 (get_cohort_member_summaries)
-- ------------------------------------------------------------
-- 이걸 Supabase 에 적용해야 보드가 "남의 인증"까지 다 보여줍니다.
--   - verified_days int[] : 각 멤버가 인증한 Day 번호 배열 (보드 셀 표시의 근거)
--   - late_days int[]     : 지각 인증한 Day (정시/지각 색 구분)
-- verified_days 는 challenge_member_state.app_state -> 'verified' 에서 뽑으므로,
-- 각 멤버의 앱이 자기 state 를 서버에 저장(자동)하면 다른 사람 보드에도 반영됩니다.
--
-- 6기 Day → 실제 날짜 (평일만): Day1=2026-06-08(월) ... Day5=06-12(금),
--   Day6=06-15 ... Day10=06-19, Day11=06-22 ... Day15=06-26, Day16=06-29 ... Day20=07-03(금)
--
-- 실행: Supabase Dashboard → SQL Editor → 전체 복붙 → Run (1회)
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
    when '6기' then date '2026-06-08'
    else date '2026-06-08'   -- 기본값을 6기 시작일로 (현재 운영 기수)
  end as start_date
),
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

-- 확인:
--   SELECT member_name, english_name, verified_days, late_days
--   FROM public.get_cohort_member_summaries('6기');
--   기대: 인증한 멤버의 verified_days 에 Day 번호가 들어있어야 함 (예: {1}).
-- ============================================================
