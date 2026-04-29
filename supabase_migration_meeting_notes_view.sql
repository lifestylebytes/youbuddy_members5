-- ============================================================
-- YOUBUDDY 5기 · 운영자용 멤버 미팅 노트 모아보기 RPC
-- ------------------------------------------------------------
-- 운영자(유버디)가 미팅 페이지에서 "멤버들이 적어둔 노트" 한 눈에
-- 보기 위함. 데이터는 이미 challenge_member_state.app_state.meeting_notes
-- 에 멤버별로 저장되어 있고 (PERSISTED_STATE_KEYS 에 포함), 이 RPC 는
-- 특정 meeting_id 의 timeline 만 추려서 멤버 카드 형태로 반환.
--
-- 호출 예:
--   SELECT * FROM public.get_cohort_meeting_notes('5기', 'm1');
--
-- 반환:
--   member_key  text
--   member_name text
--   english_name text
--   tier        text
--   role        text
--   timezone    text
--   timeline    jsonb  -- { intro:{notes,expressions[],notesHeight}, roleplay:{...}, presenters:{...} }
--   talk_points text   -- 레거시 필드 (혹시 있을 경우)
--   meeting_notes_legacy text  -- 레거시 필드
--   updated_at  text   -- meeting_consent.at 같은 식으로 timeline 자체 timestamp 는 없어서 best-effort
--
-- 권한: authenticated + anon 둘 다 호출 가능. 클라이언트에서 isOperator
-- 가드로만 노출 (운영자 외에는 UI 자체가 안 보임).
-- ============================================================

drop function if exists public.get_cohort_meeting_notes(text, text);

create or replace function public.get_cohort_meeting_notes(
  p_cohort text,
  p_meeting_id text
)
returns table (
  member_key             text,
  member_name            text,
  english_name           text,
  tier                   text,
  role                   text,
  timezone_text          text,
  timeline               jsonb,
  talk_points            text,
  meeting_notes_legacy   text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cms.member_key,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
    coalesce(cms.app_state ->> 'englishName', '') as english_name,
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') as tier,
    coalesce(cms.app_state ->> 'role', '') as role,
    coalesce(cms.app_state ->> 'timezoneOffsetText', '+0h') as timezone_text,
    -- timeline 만 뽑아냄 (intro / roleplay / presenters / 그 외 row 별 노트)
    coalesce(cms.app_state -> 'meeting_notes' -> p_meeting_id -> 'timeline', '{}'::jsonb) as timeline,
    coalesce(cms.app_state -> 'meeting_notes' -> p_meeting_id ->> 'talk_points', '') as talk_points,
    coalesce(cms.app_state -> 'meeting_notes' -> p_meeting_id ->> 'meeting_notes', '') as meeting_notes_legacy
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
    and (
      -- 빈 timeline 은 굳이 반환 안 함 (운영자가 읽을 게 없는 카드 안 보이게)
      jsonb_typeof(cms.app_state -> 'meeting_notes' -> p_meeting_id -> 'timeline') = 'object'
      and (cms.app_state -> 'meeting_notes' -> p_meeting_id -> 'timeline') <> '{}'::jsonb
    )
  order by member_name asc;
$$;

grant execute on function public.get_cohort_meeting_notes(text, text) to authenticated, anon;

-- 끝 ✅
-- 확인:
--   SELECT * FROM public.get_cohort_meeting_notes('5기', 'm1');
