-- ============================================================
-- YOUBUDDY 5기 · 발표 대본 공유 RPC
-- ------------------------------------------------------------
-- 발표자(premium 멤버 중 한 주 자리 잡은 사람) 의 PT 대본을
-- 다른 멤버들이 미팅 전 미리 볼 수 있게 RPC 만 노출.
--
-- 데이터 소스: public.challenge_member_state.app_state -> presenter_prep
-- 구조: { "w1": { "vocabPicked": [...], "script": "...", "jobContext": "...", "presentationTopic": "..." }, "w2": {...} }
--
-- 사용법:
-- 1) Supabase Dashboard → SQL Editor 에 이 파일 전체 붙여넣기
-- 2) Run
-- 3) 클라이언트에서 PremiumPage 의 발표자 아바타 클릭 → 모달에서 대본 노출
--
-- 권한: authenticated + anon 둘 다 read 가능. PT 대본은 의도적으로 코호트
-- 내에 공유되는 콘텐츠이고, app_state 에 들어있는 다른 민감 필드는 노출 X.
-- ============================================================

drop function if exists public.get_cohort_presenter_scripts(text);

create or replace function public.get_cohort_presenter_scripts(p_cohort text)
returns table (
  member_key         text,
  member_name        text,
  english_name       text,
  week_n             integer,
  job_context        text,
  presentation_topic text,
  vocab_picked       text[],
  script             text
)
language sql
stable
security definer
set search_path = public
as $$
  with prep_rows as (
    select
      cms.member_key,
      coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
      coalesce(cms.app_state ->> 'englishName', '') as english_name,
      cms.app_state -> 'presenter_prep' as pp
    from public.challenge_member_state cms
    where cms.cohort = p_cohort
      and cms.app_state -> 'presenter_prep' is not null
  ),
  expanded as (
    select
      pr.member_key,
      pr.member_name,
      pr.english_name,
      kv.key as week_key,
      kv.value as week_data
    from prep_rows pr,
         lateral jsonb_each(coalesce(pr.pp, '{}'::jsonb)) as kv(key, value)
  )
  select
    member_key,
    member_name,
    english_name,
    nullif(regexp_replace(week_key, '[^0-9]', '', 'g'), '')::integer as week_n,
    coalesce(week_data ->> 'jobContext', '') as job_context,
    coalesce(week_data ->> 'presentationTopic', '') as presentation_topic,
    case
      when jsonb_typeof(week_data -> 'vocabPicked') = 'array'
      then array(select jsonb_array_elements_text(week_data -> 'vocabPicked'))
      else array[]::text[]
    end as vocab_picked,
    coalesce(week_data ->> 'script', '') as script
  from expanded
  where coalesce(week_data ->> 'script', '') <> ''
     or coalesce(week_data ->> 'jobContext', '') <> ''
     or coalesce(week_data ->> 'presentationTopic', '') <> '';
$$;

grant execute on function public.get_cohort_presenter_scripts(text) to authenticated, anon;

-- 끝 ✅
-- 확인:
-- SELECT * FROM public.get_cohort_presenter_scripts('5기');
