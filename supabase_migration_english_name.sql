-- ============================================================================
-- YOUBUDDY 5기 — english_name 노출 마이그레이션
-- ============================================================================
-- 배경: state.englishName 은 이미 challenge_member_state.app_state (JSONB) 에
--       저장되고 있어서 ALTER TABLE 은 필요 없음. 단 get_cohort_member_summaries
--       가 해당 필드를 꺼내 돌려주지 않으면 peer 화면에 영어 닉네임이 안 뜸.
--
-- 이 파일은 get_cohort_member_summaries 를 DROP + CREATE 로 재정의해서
-- 반환 컬럼에 english_name TEXT 를 끼워 넣는다.
--
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 전체 복붙 → Run
-- 멱등함 (여러 번 돌려도 안전).
-- ============================================================================

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
  verified_days integer[]
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
    coalesce((b.app_state -> 'verified' ->> ('d' || gs.day_n))::boolean, false) as verified
  from base b
  cross join generate_series(1, 20) as gs(day_n)
),
progress_rows as (
  select
    member_key,
    member_name,
    english_name,
    tier,
    role,
    timezone_text,
    goal,
    motive,
    count(*) filter (where verified)::int as progress,
    max(day_n) filter (where verified) as last_done_day,
    coalesce(
      array_agg(day_n order by day_n) filter (where verified),
      array[]::int[]
    ) as verified_days
  from day_rows
  group by member_key, member_name, english_name, tier, role, timezone_text, goal, motive
),
streak_rows as (
  select
    p.member_key,
    count(*)::int as streak
  from progress_rows p
  join lateral (
    select
      d.day_n,
      row_number() over (order by d.day_n desc) as rn
    from day_rows d
    where d.member_key = p.member_key
      and d.verified = true
      and p.last_done_day is not null
      and d.day_n <= p.last_done_day
  ) seq
    on seq.day_n = p.last_done_day - (seq.rn - 1)
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
  p.verified_days
from progress_rows p
left join streak_rows s
  on s.member_key = p.member_key
order by p.progress desc, coalesce(s.streak, 0) desc, p.member_name asc;
$$;

grant execute on function public.get_cohort_member_summaries(text) to anon, authenticated;

-- ============================================================================
-- 끝 ✅
-- 확인: Supabase 에서 실행 후 새로고침하면, 영어 닉네임을 세팅한 멤버가
--       체크보드 / 커뮤니티 / 멤버 카드에 그 이름으로 표시됨.
-- ============================================================================
