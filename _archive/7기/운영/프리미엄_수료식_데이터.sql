-- ============================================================
-- YOUBUDDY 7기 · Week4 미팅 클로징용 프리미엄 멤버 성과
-- ------------------------------------------------------------
-- 결과를 그대로 복사해서 수료식 화면(프리미엄_수료식_화면.html)에 붙여넣으면 됩니다.
-- 실행: Supabase SQL Editor 에 전체 복붙 → Run
-- ============================================================

with p as (
  select
    coalesce(cms.member_name, cms.app_state ->> 'name', '')      as name,
    coalesce(cms.app_state ->> 'englishName', '')                as eng,
    coalesce(cms.app_state -> 'verified',    '{}'::jsonb)        as verified,
    coalesce(cms.app_state -> 'verified_at', '{}'::jsonb)        as verified_at,
    coalesce(cms.app_state -> 'verified_time','{}'::jsonb)       as verified_time,
    coalesce(cms.app_state -> 'submitted',   '{}'::jsonb)        as submitted,
    coalesce(cms.app_state -> 'timeline',    '{}'::jsonb)        as timeline,
    cms.app_state -> 'final_test'                                as final_test
  from public.challenge_member_state cms
  where cms.cohort = '7기'
    and coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') = 'premium'
    and coalesce(cms.member_name, '') not in ('', '유버디', '이규태', '이지흔', '모모')
)
select
  case when eng <> '' then eng else name end                     as "이름",
  (select count(*) from jsonb_each(p.verified) e
     where e.value = 'true'::jsonb)::int                         as "학습일수",
  (select count(*) from jsonb_each_text(p.submitted) e
     where coalesce(trim(e.value), '') <> '')::int               as "쓴문장",
  (select min(e.value) from jsonb_each_text(p.verified_time) e
     where e.value ~ '^\d{1,2}:\d{2}')                           as "가장이른인증",
  (select count(*) from jsonb_each(p.timeline) e
     where e.value -> 'week_note' is not null)::int              as "미팅노트",
  case when p.final_test ->> 'at' is not null then 'O' else '' end as "파이널",
  name                                                            as "본명"
from p
order by "학습일수" desc, "쓴문장" desc;


-- ============================================================
-- [보너스] 프리미엄 전체 합계 (첫 화면 큰 숫자용)
-- ============================================================
with p as (
  select
    coalesce(cms.app_state -> 'verified',  '{}'::jsonb) as verified,
    coalesce(cms.app_state -> 'submitted', '{}'::jsonb) as submitted
  from public.challenge_member_state cms
  where cms.cohort = '7기'
    and coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') = 'premium'
    and coalesce(cms.member_name, '') not in ('', '유버디', '이규태', '이지흔', '모모')
)
select
  count(*)                                                       as "프리미엄 인원",
  sum((select count(*) from jsonb_each(p.verified) e
        where e.value = 'true'::jsonb))                          as "학습일 합계",
  sum((select count(*) from jsonb_each_text(p.submitted) e
        where coalesce(trim(e.value), '') <> ''))                as "쓴 문장 합계"
from p;
