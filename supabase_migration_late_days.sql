-- ============================================================
-- YOUBUDDY 5기 · 멤버 지각 인증 정보 추가 (english_name 보존 버전)
-- ------------------------------------------------------------
-- get_cohort_member_summaries 에 late_days int[] + english_name 둘 다 포함.
-- 이전 영어 닉네임 마이그레이션(english_name)을 덮어써서 사라지지 않도록 합본.
--
-- 5기 시작일: 2026-04-27 (Day 1).
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
    gs.day_n,
    coalesce((b.app_state -> 'verified' ->> ('d' || gs.day_n))::boolean, false) as verified,
    nullif(b.app_state -> 'verified_at' ->> ('d' || gs.day_n), '')::date as verified_date,
    (cs.start_date + (gs.day_n - 1)) as scheduled_date
  from base b
  cross join generate_series(1, 20) as gs(day_n)
  cross join cohort_start cs
),
progress_rows as (
  select
    member_key, member_name, english_name, tier, role, timezone_text, goal, motive,
    count(*) filter (where verified)::int as progress,
    max(day_n) filter (where verified) as last_done_day,
    coalesce(array_agg(day_n order by day_n) filter (where verified), array[]::int[]) as verified_days,
    coalesce(
      array_agg(day_n order by day_n) filter (
        where verified and verified_date is not null and verified_date > scheduled_date
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
