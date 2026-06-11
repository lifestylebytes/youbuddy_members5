-- ============================================================
-- append_member_goal: 멤버 목표(app_state.goal) 아래에 텍스트 이어붙이기 (기존 안 지움)
-- 발표 모드 캐치업 슬라이드의 "받아적기 → 저장"에서 호출.
-- 실행: Supabase Dashboard → SQL Editor → 전체 복붙 → Run (1회)
-- ============================================================
create or replace function public.append_member_goal(
  p_cohort text,
  p_member_key text,
  p_text text
)
returns void
language sql
security definer
as $$
  update public.challenge_member_state
  set app_state = jsonb_set(
        coalesce(app_state, '{}'::jsonb),
        '{goal}',
        to_jsonb(
          nullif(
            trim(both E'\n' from
              coalesce(app_state ->> 'goal', '') || E'\n' || p_text
            ),
          '')
        )
      )
  where cohort = p_cohort and member_key = p_member_key;
$$;

grant execute on function public.append_member_goal(text, text, text) to anon, authenticated;

-- 확인:
--   select member_name, app_state ->> 'goal' as goal
--   from public.challenge_member_state
--   where cohort = '6기' and member_name in ('정주혜','이도현');
-- ============================================================
