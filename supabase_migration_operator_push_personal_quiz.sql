-- ============================================================
-- YOUBUDDY 5기 · 운영자 → 멤버 Personal Quiz 푸시 RPC
-- ------------------------------------------------------------
-- Gaby (운영자) 가 멤버 발표 스크립트 보고 만든 personal_quiz JSON 을
-- 멤버 본인 계정에 직접 박아주는 RPC. 멤버는 본인 페이지 들어가면
-- 이미 채워져 있어서 바로 풀 수 있음 (paste 작업 X).
--
-- 사용처:
--   - 운영자 'OPERATOR · PUSH TO MEMBER' UI 에서 호출
--   - 또는 Supabase dashboard 에서 직접 SQL 실행
--
-- 보안 노트:
--   - anon key 로 호출 가능 (현재 시스템 인증 패턴 따름)
--   - 5기 내부 도구 — 실제 운영자만 UI 접근 가능 (state.isOperator gate)
--   - 향후 강화: caller_member_key 인자 + 운영자 화이트리스트 체크
-- ============================================================

drop function if exists public.operator_push_personal_quiz(text, text, jsonb);

create or replace function public.operator_push_personal_quiz(
  p_cohort text,
  p_target_member_key text,
  p_quiz jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now text;
  v_existing jsonb;
  v_new_state jsonb;
  v_member_name text;
begin
  v_now := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  -- 멤버 존재 확인 + app_state 로드
  select app_state, member_name
    into v_existing, v_member_name
  from public.challenge_member_state
  where cohort = p_cohort
    and member_key = p_target_member_key
  limit 1;

  if v_member_name is null then
    raise exception '멤버를 찾을 수 없어요: cohort=%, member_key=%', p_cohort, p_target_member_key;
  end if;

  -- personal_quiz + 응답 초기화 + submitted 초기화 까지 한 번에.
  -- 기존 app_state 위에 덮어쓰기 (다른 키들은 그대로 보존).
  v_new_state := coalesce(v_existing, '{}'::jsonb) || jsonb_build_object(
    'personal_quiz', p_quiz || jsonb_build_object('injectedAt', v_now),
    'personal_quiz_answers', '{}'::jsonb,
    'personal_quiz_fill_answers', '{}'::jsonb,
    'personal_quiz_submitted', jsonb_build_object('mc', false, 'fill', false)
  );

  update public.challenge_member_state
  set app_state = v_new_state,
      updated_at = now()
  where cohort = p_cohort
    and member_key = p_target_member_key;

  return jsonb_build_object(
    'ok', true,
    'cohort', p_cohort,
    'member_key', p_target_member_key,
    'member_name', v_member_name,
    'injected_at', v_now,
    'items_count', coalesce(jsonb_array_length(p_quiz -> 'items'), 0),
    'fill_items_count', coalesce(jsonb_array_length(p_quiz -> 'fill_items'), 0)
  );
end;
$$;

grant execute on function public.operator_push_personal_quiz(text, text, jsonb)
  to authenticated, anon;

-- 검증:
-- SELECT public.operator_push_personal_quiz(
--   '5기',
--   '<target member_key>',
--   '{"week":3,"items":[...],"fill_items":[...]}'::jsonb
-- );
-- 기대값: { ok: true, member_name: '...', items_count: 10, fill_items_count: 10 }
