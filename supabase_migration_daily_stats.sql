-- ============================================================
-- YOUBUDDY 5기 — 매일 인증률 통계 RPC (운영진/스태프 명시 제외)
-- ------------------------------------------------------------
-- app_state 의 isOperator/isStaff/ghost 플래그가 동기화 안 된 케이스 대비해
-- 알려진 스태프 이름 + anonymous + 빈 이름 명시적으로 제외.
-- 베이직 30 / 프리미엄 9 = 총 39명 (운영진/스태프 제외) 기준.
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
    coalesce((cms.app_state -> 'verified' ->> ('d' || p_day_n))::boolean, false) as verified,
    coalesce((cms.app_state ->> 'isOperator')::boolean, false) as is_operator,
    coalesce((cms.app_state ->> 'isStaff')::boolean, false) as is_staff,
    coalesce((cms.app_state ->> 'ghost')::boolean, false) as is_ghost
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
filtered as (
  -- 운영진 / 스태프 / 고스트 제외 + phantom (anonymous, 빈 이름) 제외
  -- + 알려진 스태프 이름 명시적 차단 (app_state 플래그가 sync 안 된 케이스 대비).
  select * from base
  where is_operator = false
    and is_staff = false
    and is_ghost = false
    and coalesce(member_key, '') not in ('anonymous', '')
    and coalesce(member_name, '') != ''
    and member_name not in ('모모', '유버디', '이규태', '이지흔')
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
        ) order by member_name asc
      ) filter (where not verified),
      '[]'::jsonb
    ) as missing_list
  from filtered
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
      then round(((select completed from totals)::numeric / (select total from totals)) * 100, 1) else 0 end
  ),
  'basic', coalesce(
    (select jsonb_build_object(
      'total', total, 'completed', completed,
      'rate', case when total > 0 then round((completed::numeric / total) * 100, 1) else 0 end,
      'missing', missing_list
    ) from agg where tier = 'basic'),
    jsonb_build_object('total', 0, 'completed', 0, 'rate', 0, 'missing', '[]'::jsonb)
  ),
  'premium', coalesce(
    (select jsonb_build_object(
      'total', total, 'completed', completed,
      'rate', case when total > 0 then round((completed::numeric / total) * 100, 1) else 0 end,
      'missing', missing_list
    ) from agg where tier = 'premium'),
    jsonb_build_object('total', 0, 'completed', 0, 'rate', 0, 'missing', '[]'::jsonb)
  )
);
$$;

grant execute on function public.get_cohort_daily_stats(text, integer) to authenticated, anon;

-- 검증:
-- SELECT public.get_cohort_daily_stats('5기', 3);
-- 기대값: basic.total = 30, premium.total = 9, total.total = 39
