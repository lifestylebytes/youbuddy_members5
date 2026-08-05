-- ============================================================
-- YOUBUDDY 7기 · 데일리 펄스 전체 인사이트 (쿼리 하나로 전부)
-- ------------------------------------------------------------
-- 결과가 4개 섹션으로 이어서 나옵니다.
--   1. 응답률      Day 별 응답 인원 / 티어별
--   2. 객관식      선택지 분포 / 티어별
--   3. 주관식      기타 입력 + 자유 서술 원문
--   4. 교차분석    "금액이 부담" 고른 사람이 다른 문항에선 뭐라 했나
--
-- state.daily_pulse[day] = { a, b, etcA, etcB, text, at }
-- 실행: SQL Editor 에 전체 복붙 → Run (한 번만)
-- ============================================================

with base as (
  select
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic')   as tier,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as name,
    coalesce(cms.app_state -> 'daily_pulse', '{}'::jsonb)   as pulse
  from public.challenge_member_state cms
  where cms.cohort = '7기'
    and coalesce((cms.app_state ->> 'isOperator')::boolean, false) = false
    and coalesce((cms.app_state ->> 'isStaff')::boolean, false) = false
    and coalesce(cms.member_name, '') not in ('', '모모', '유버디', '이규태', '이지흔')
),
flat as (
  select b.tier, b.name, e.key::int as day_n, e.value as ans
  from base b, lateral jsonb_each(b.pulse) e
  where e.key ~ '^\d+$'
),
-- 선택값 → 한글 라벨
lab(v, label) as (values
  ('fire_drill','Fire drill'), ('spof','Single point of failure'),
  ('long_pole','Long pole in the tent'), ('under_bus','Throw under the bus'),
  ('pull_plug','Pull the plug'),
  ('much_better','확실히 편해졌어요'), ('bit_better','조금 나아진 것 같아요'),
  ('same','아직 잘 모르겠어요'), ('worse','오히려 더 어렵게 느껴져요'),
  ('routine','루틴 자체'), ('words','표현·단어 익힌 것'), ('ai','AI 첨삭'),
  ('peers','다른 멤버 문장 보기'), ('meeting','미팅에서 말해본 것'),
  ('keep_alone','혼자라도 계속'), ('will_stop','솔직히 끊길 듯'),
  ('find_other','다른 방법 찾을 것'), ('not_yet','아직 생각 안 함'),
  ('time','시간이 안 나서'), ('money','금액이 부담돼서'),
  ('alone_ok','이제 혼자 해볼 만해서'), ('unsure_effect','효과를 잘 모르겠어서'),
  ('level','난이도가 안 맞아서'),
  ('morning','아침에 같이 하는 시간'), ('lighter','더 짧고 가볍게'),
  ('coach_1on1','1:1 피드백'), ('report','성장 리포트'), ('more_speak','말해보는 시간 더'),
  ('habit','매일 하게 만들어주는 곳'), ('practical','회사에서 진짜 쓰는 표현'),
  ('together','혼자 안 해도 되는 곳'), ('speak','입으로 뱉게 만드는 곳'),
  ('etc','기타 (직접 입력)')
),
qname(day_n, q, qtext) as (values
  (15,'Q1','써먹겠다 싶은 표현'), (16,'Q1','3주 전 대비 체감'),
  (17,'Q1','제일 도움된 것'),
  (18,'Q1','7기 후 공부 계획'), (18,'Q2','나중에 하는 이유 ★'),
  (19,'Q1','있었으면 하는 것'), (19,'Q2','한 줄 더'),
  (20,'Q1','친구에게 한마디'), (20,'Q2','완주 소감')
),
picked as (
  select tier, name, day_n, 'Q1' as q, ans ->> 'a' as v from flat where ans ->> 'a' is not null
  union all
  select tier, name, day_n, 'Q2' as q, ans ->> 'b' as v from flat where ans ->> 'b' is not null
),
-- money 응답자의 다른 답 (교차분석용)
money_folks as (
  select distinct tier, name from picked where day_n = 18 and q = 'Q2' and v = 'money'
)

-- ── 1. 응답률 ──────────────────────────────────────────────
select '1. 응답률' as "구분", f.day_n as "Day", '응답 인원' as "문항",
  '' as "항목",
  (count(*) filter (where f.tier = 'basic'))::text || ' / ' ||
    (select count(*) from base where tier = 'basic')::text  as "베이직",
  (count(*) filter (where f.tier = 'premium'))::text || ' / ' ||
    (select count(*) from base where tier = 'premium')::text as "프리미엄",
  count(*)::int as "합계", '' as "이름·원문"
from flat f group by f.day_n

union all

-- ── 2. 객관식 분포 ─────────────────────────────────────────
select '2. 객관식', p.day_n, coalesce(qn.qtext, p.q),
  coalesce(l.label, p.v),
  (count(*) filter (where p.tier = 'basic'))::text,
  (count(*) filter (where p.tier = 'premium'))::text,
  count(*)::int, ''
from picked p
left join lab l on l.v = p.v
left join qname qn on qn.day_n = p.day_n and qn.q = p.q
group by p.day_n, p.q, qn.qtext, l.label, p.v

union all

-- ── 3. 주관식 원문 ─────────────────────────────────────────
select '3. 주관식', t.day_n, t.kind, '', '', '', null::int,
  t.tier || ' · ' || t.name || ' : ' || t.txt
from (
  select tier, name, day_n, 'Q1 기타' as kind, ans ->> 'etcA' as txt from flat
  union all
  select tier, name, day_n, 'Q2 기타', ans ->> 'etcB' from flat
  union all
  select tier, name, day_n, '자유서술', ans ->> 'text' from flat
) t
where coalesce(trim(t.txt), '') <> ''

union all

-- ── 4. 교차분석: "금액이 부담" 고른 사람의 다른 답 ─────────
select '4. 금액부담자', p.day_n, coalesce(qn.qtext, p.q),
  coalesce(l.label, p.v), '', '', null::int,
  p.tier || ' · ' || p.name
from picked p
join money_folks m on m.name = p.name
left join lab l on l.v = p.v
left join qname qn on qn.day_n = p.day_n and qn.q = p.q

order by 1, 2, 7 desc nulls last, 3, 4;
