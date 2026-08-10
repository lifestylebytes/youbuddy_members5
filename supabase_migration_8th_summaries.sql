-- ============================================================
-- YOUBUDDY · get_cohort_member_summaries 에 8기 시작일 추가
-- ------------------------------------------------------------
-- 문제 (2026-08-11 발견):
--   이 함수의 cohort_start 가 5기/6기/7기만 알고 있어서 8기가 else 로 빠졌고,
--   기본값이 7기 시작일(2026-07-13) 이었다.
--   → 8기 Day 1 의 scheduled_date 가 7/13, deadline 이 7/14 로 계산되고
--     실제 인증일(8/10) 이 그보다 뒤라 Day 1 인증자 26명 전원이 '지각' 으로 찍혔다.
--
--   RPC 가 p_cohort 를 받는다는 것만 보고 "8기 마이그레이션 불필요" 로 판단했는데,
--   함수 안에 기수별 시작일이 하드코딩돼 있는 걸 놓쳤다.
--   ※ 다음 기수(9기) 에도 이 파일을 복사해서 cohort_start 에 한 줄 추가할 것.
--
-- late_days 는 저장값이 아니라 조회 시점에 계산되므로,
-- 이 SQL 을 돌리면 이미 찍힌 지각도 전부 정시로 되돌아온다. (되돌릴 데이터 없음)
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
  late_days integer[],
  bingo_weeks integer[],
  review_consent text
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
    (
      select coalesce(array_agg((k.k)::int order by (k.k)::int), array[]::int[])
      from jsonb_object_keys(coalesce(cms.app_state -> 'bingo_done', '{}'::jsonb)) as k(k)
      where k.k ~ '^[1-4]$'
    ) as bingo_weeks,
    coalesce(cms.app_state -> 'review_consent' ->> 'choice', '') as review_consent,
    cms.app_state
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
cohort_start as (
  select case p_cohort
    when '5기' then date '2026-04-27'
    when '6기' then date '2026-06-08'
    when '7기' then date '2026-07-13'
    when '8기' then date '2026-08-10'
    else date '2026-08-10'   -- 기본값을 8기 시작일로 (현재 운영 기수)
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
    (
      coalesce((b.app_state -> 'verified' ->> ('d' || dd.day_n))::boolean, false)
      -- 개별 구제 (2026-07-21): 정현영(Daisy) Day 6 인증 누락 신고 → 집계상 인증 처리 (운영자 승인).
      -- 본인 기기 화면은 본인이 재인증해야 채워짐. 8기 복사 시 제거!
      or (p_cohort = '7기' and b.member_key = '정현영' and dd.day_n = 6)
    ) as verified,
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
          -- 개별 구제 (2026-07-21): 정현영(Daisy)님 Day 6 정시 처리 (그날 인증 누락 신고,
          -- 본인이 재인증하면 지각 대신 정시로 계산됨. 운영자 승인).
          and not (p_cohort = '7기' and day_rows.member_key = '정현영' and day_n = 6)
          -- 개별 구제 (2026-07-20): 이지원(wonnie)님 Day 5 정시 처리 (운영자 승인).
          and not (p_cohort = '7기' and day_rows.member_key = '이지원' and day_n = 5)
          -- 개별 구제 (2026-07-17): 신현아님 Day 1~4 정시 처리 (운영자 승인).
          and not (p_cohort = '7기' and day_rows.member_key = '신현아' and day_n between 1 and 4)
          -- Day 3 구제 (2026-07-15 리마인드 지연 사고): 한국(+0h) 멤버는
          -- 7/16(목) 오전 9시 KST 이전의 인증 이벤트가 있으면 정시로 처리.
          and not (
            p_cohort = '7기'
            and day_n = 3
            and coalesce(timezone_text, '+0h') = '+0h'
            and exists (
              select 1 from public.challenge_verification_events e
              where e.cohort = p_cohort
                and e.member_key = day_rows.member_key
                and e.verified_day = 3
                and e.verified_at <= timestamptz '2026-07-16 09:00:00+09'
            )
          )
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
  p.late_days,
  coalesce(b2.bingo_weeks, array[]::int[]) as bingo_weeks,
  coalesce(b2.review_consent, '') as review_consent
from progress_rows p
left join streak_rows s on s.member_key = p.member_key
left join base b2 on b2.member_key = p.member_key
order by p.progress desc, coalesce(s.streak, 0) desc, p.member_name asc;
$$;

grant execute on function public.get_cohort_member_summaries(text) to anon, authenticated;

-- 확인:
--   SELECT member_name, english_name, verified_days, late_days
--   FROM public.get_cohort_member_summaries('7기');
--   기대: 오늘(7/13) 정시 인증 멤버의 late_days 가 {} (빈 배열) 이어야 함.
-- ============================================================
