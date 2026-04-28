-- ============================================================
-- YOUBUDDY 5기 · 운영자 전체 데이터 백업 RPC
-- ------------------------------------------------------------
-- 운영자 (유버디) 가 Settings → OPERATOR ONLY → "📦 코호트 데이터 다운로드"
-- 누르면 호출되는 RPC. 한 큐에 challenge_member_state / community_posts /
-- community_comments / community_likes / presenter_signups 다 묶어서 JSONB 로 반환.
-- 클라이언트가 받아서 즉시 JSON 파일로 다운로드함.
--
-- 권한: authenticated + anon 둘 다 호출 가능. 클라이언트에서 isOperator
-- 가드로만 노출됨 (RLS 강화는 다음 라운드에).
--
-- 실행:
-- 1) Supabase Dashboard → SQL Editor → 전체 복붙 → Run
-- 2) 클라이언트에서 운영자 settings 의 "📦 코호트 데이터 다운로드" 버튼 클릭으로 테스트
-- ============================================================

drop function if exists public.get_cohort_full_export(text);

create or replace function public.get_cohort_full_export(p_cohort text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb := jsonb_build_object(
    'cohort', p_cohort,
    'exported_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'member_state', '[]'::jsonb,
    'community_posts', '[]'::jsonb,
    'community_comments', '[]'::jsonb,
    'community_likes', '[]'::jsonb,
    'presenter_signups', '[]'::jsonb,
    'verification_events', '[]'::jsonb
  );
  tmp jsonb;
begin
  -- challenge_member_state — 핵심: 각 멤버의 app_state JSONB (문장 / AI 피드백 / 설정 다)
  begin
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tmp
    from public.challenge_member_state t where t.cohort = p_cohort;
    result := jsonb_set(result, '{member_state}', tmp);
  exception when others then
    result := jsonb_set(result, '{member_state_error}', to_jsonb(SQLERRM));
  end;

  -- community_posts — 멤버가 커뮤니티에 올린 문장
  begin
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tmp
    from public.community_posts t where t.cohort = p_cohort;
    result := jsonb_set(result, '{community_posts}', tmp);
  exception when others then
    result := jsonb_set(result, '{community_posts_error}', to_jsonb(SQLERRM));
  end;

  -- community_comments — 댓글
  begin
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tmp
    from public.community_comments t where t.cohort = p_cohort;
    result := jsonb_set(result, '{community_comments}', tmp);
  exception when others then
    result := jsonb_set(result, '{community_comments_error}', to_jsonb(SQLERRM));
  end;

  -- community_likes (=저장) — 누가 어느 글을 저장했는지
  begin
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tmp
    from public.community_likes t where t.cohort = p_cohort;
    result := jsonb_set(result, '{community_likes}', tmp);
  exception when others then
    result := jsonb_set(result, '{community_likes_error}', to_jsonb(SQLERRM));
  end;

  -- presenter_signups — 프리미엄 발표자 자리 잡기 기록
  begin
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tmp
    from public.presenter_signups t where t.cohort = p_cohort;
    result := jsonb_set(result, '{presenter_signups}', tmp);
  exception when others then
    result := jsonb_set(result, '{presenter_signups_error}', to_jsonb(SQLERRM));
  end;

  -- verification_events — 시간대별 인증 기록 (분석용)
  begin
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tmp
    from public.verification_events t where t.cohort = p_cohort;
    result := jsonb_set(result, '{verification_events}', tmp);
  exception when others then
    result := jsonb_set(result, '{verification_events_error}', to_jsonb(SQLERRM));
  end;

  return result;
end;
$$;

grant execute on function public.get_cohort_full_export(text) to authenticated, anon;

-- 끝 ✅
-- 확인:
--   SELECT public.get_cohort_full_export('5기');
-- 결과 키: cohort, exported_at, member_state, community_posts,
--          community_comments, community_likes, presenter_signups,
--          verification_events
-- 어느 테이블 fetch 가 실패하면 {table}_error 키로 에러 메시지 반환됨.
