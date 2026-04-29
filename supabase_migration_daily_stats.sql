-- ============================================================
-- YOUBUDDY 5기 — 매일 인증률 통계 RPC
-- ------------------------------------------------------------
-- 매일 아침 7시 Slack 브리핑용. day_n 별로 cohort 의 인증률을
-- 전체 / 베이직 / 프리미엄 세그먼트로 분리해서 반환.
--
-- 호출: SELECT public.get_cohort_daily_stats('5기', 2);
--
-- 반환 JSON:
-- {
--   "cohort": "5기",
--   "day_n": 2,
--   "total":   { "total": 37, "completed": 31, "rate": 83.8 },
--   "basic":   { "total": 29, "completed": 24, "rate": 82.8, "missing": [...] },
--   "premium": { "total": 8,  "completed": 7,  "rate": 87.5, "missing": [...] }
-- }
--
-- "missing" 안 멤버 객체: { member_key, name, english_name, role, timezone }
-- 권한: authenticated + anon 둘 다 호출 가능 (anon key 로 호출).
-- ============================================================

drop function if exists public.get_cohort_daily_stats(text, integer);

create or replace function public.get_cohort_daily_stats(
  p_cohort text,
  p_day_n integer
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
    coalesce(cms.app_state ->> 'role', '') as role,
    coalesce(cms.app_state ->> 'timezoneOffsetText', '+0h') as timezone_text,
    coalesce((cms.app_state -> 'verified' ->> ('d' || p_day_n))::boolean, false) as verified
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
agg as (
  select
    tier,
    count(*)::int as total,
    count(*) filter (where verified)::int as completed,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_key', member_key,
          'name', member_name,
          'english_name', english_name,
          'role', role,
          'timezone', timezone_text
        )
        order by member_name asc
      ) filter (where not verified),
      '[]'::jsonb
    ) as missing_list
  from base
  group by tier
),
totals as (
  select
    coalesce(sum(total), 0)::int as total,
    coalesce(sum(completed), 0)::int as completed
  from agg
)
select jsonb_build_object(
  'cohort', p_cohort,
  'day_n', p_day_n,
  'total', jsonb_build_object(
    'total', (select total from totals),
    'completed', (select completed from totals),
    'rate', case when (select total from totals) > 0
      then round(((select completed from totals)::numeric / (select total from totals)) * 100, 1)
      else 0
    end
  ),
  'basic', coalesce(
    (select jsonb_build_object(
      'total', total,
      'completed', completed,
      'rate', case when total > 0 then round((completed::numeric / total) * 100, 1) else 0 end,
      'missing', missing_list
    ) from agg where tier = 'basic'),
    jsonb_build_object('total', 0, 'completed', 0, 'rate', 0, 'missing', '[]'::jsonb)
  ),
  'premium', coalesce(
    (select jsonb_build_object(
      'total', total,
      'completed', completed,
      'rate', case when total > 0 then round((completed::numeric / total) * 100, 1) else 0 end,
      'missing', missing_list
    ) from agg where tier = 'premium'),
    jsonb_build_object('total', 0, 'completed', 0, 'rate', 0, 'missing', '[]'::jsonb)
  )
);
$$;

grant execute on function public.get_cohort_daily_stats(text, integer) to authenticated, anon;

-- 끝 ✅
-- 확인:
--   SELECT public.get_cohort_daily_stats('5기', 2);
