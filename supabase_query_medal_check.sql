-- ============================================================
-- YOUBUDDY 7기 · 완주 🏅 가 왜 안 붙는지 확인
-- ------------------------------------------------------------
-- 체크보드의 🏅 조건은 딱 하나입니다: 인증 일수(progress) >= 18.
-- 지각도 1일로 세고, 파이널 테스트 여부는 🏅 와 무관합니다.
-- (파이널은 단어집 PDF 게이트에만 걸립니다.)
--
-- 시차는 "며칠 인증했는지"에는 영향이 없고, "오늘이 Day 몇인지"에만 영향을 줍니다.
-- 즉 해외에 계신 분은 Day 20 이 늦게 열려서 아직 못 채웠을 수는 있어도,
-- 이미 채운 날이 시차 때문에 사라지지는 않습니다.
--
-- 실행: Supabase SQL Editor 에 전체 복붙 → Run
-- ============================================================

with base as (
  select
    coalesce(cms.member_name, cms.app_state ->> 'name', '')  as 이름,
    coalesce(cms.app_state ->> 'englishName', '')            as 영문,
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic')    as 등급,
    coalesce(cms.app_state ->> 'tzOffsetHours', '0')         as 시차,
    coalesce(cms.app_state -> 'verified', '{}'::jsonb)       as verified,
    coalesce(cms.app_state -> 'verified_at', '{}'::jsonb)    as verified_at,
    cms.app_state -> 'final_test'                            as final_test
  from public.challenge_member_state cms
  where cms.cohort = '7기'
)
select
  이름, 영문, 등급,
  시차 || 'h'                                                   as "KST 대비",
  (select count(*) from jsonb_each(b.verified) e
     where e.value = 'true'::jsonb)::int                        as "인증일수",
  case when (select count(*) from jsonb_each(b.verified) e
               where e.value = 'true'::jsonb) >= 18
       then '🏅 붙어야 함' else '아직' end                       as "메달",
  -- 아직 안 채운 Day 번호 (여기를 채우면 바로 18 이 됩니다)
  (select string_agg(replace(k, 'd', ''), ',' order by replace(k,'d','')::int)
     from (select 'd' || g as k from generate_series(1,20) g) days
    where coalesce((b.verified ->> days.k)::boolean, false) = false)  as "안 채운 Day",
  case when b.final_test ->> 'at' is not null then 'O' else '' end    as "파이널"
from base b
where coalesce(이름, '') not in ('', '유버디', '이규태', '이지흔', '모모')
order by "인증일수" desc, 이름;


-- ------------------------------------------------------------
-- 한 명만 콕 집어 보고 싶을 때 (이름만 바꿔서 실행)
-- ------------------------------------------------------------
-- select jsonb_pretty(app_state -> 'verified')
-- from public.challenge_member_state
-- where cohort = '7기' and member_name = '최예준';
