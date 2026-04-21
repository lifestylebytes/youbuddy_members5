-- ============================================================================
-- YOUBUDDY 5기 — 한 번에 돌리는 마이그레이션 배치
-- ============================================================================
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 복붙 → Run
--
-- 포함:
--   1) get_cohort_member_summaries  (verified_days int[] 반환 추가 → 이규태 Day2 싱크)
--   2) add_community_comment        (42P01 v_result 파서 버그 회피 — 스칼라 RETURNING)
--   3) update_community_comment     (신규 — 본인 댓글 수정)
--   4) delete_community_comment     (신규 — 본인 댓글 삭제)
--
-- 전부 idempotent: 여러 번 돌려도 안전함.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1) get_cohort_member_summaries — verified_days 추가
--    반환 타입이 바뀌었기 때문에 DROP 이 선행되어야 함 (42P13 회피).
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_cohort_member_summaries(text);

create or replace function public.get_cohort_member_summaries(
  p_cohort text
)
returns table (
  member_key text,
  member_name text,
  tier text,
  role text,
  timezone_text text,
  goal text,
  motive text,
  progress integer,
  streak integer,
  verified_days integer[]
)
language sql
security definer
as $$
with base as (
  select
    cms.member_key,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
    coalesce(cms.tier, cms.app_state ->> 'tier', 'basic') as tier,
    coalesce(cms.app_state ->> 'role', '') as role,
    coalesce(cms.app_state ->> 'timezoneOffsetText', '+0h') as timezone_text,
    coalesce(cms.app_state ->> 'goal', '') as goal,
    coalesce(cms.app_state ->> 'motive', '') as motive,
    cms.app_state
  from public.challenge_member_state cms
  where cms.cohort = p_cohort
),
day_rows as (
  select
    b.member_key,
    b.member_name,
    b.tier,
    b.role,
    b.timezone_text,
    b.goal,
    b.motive,
    gs.day_n,
    coalesce((b.app_state -> 'verified' ->> ('d' || gs.day_n))::boolean, false) as verified
  from base b
  cross join generate_series(1, 20) as gs(day_n)
),
progress_rows as (
  select
    member_key,
    member_name,
    tier,
    role,
    timezone_text,
    goal,
    motive,
    count(*) filter (where verified)::int as progress,
    max(day_n) filter (where verified) as last_done_day,
    coalesce(
      array_agg(day_n order by day_n) filter (where verified),
      array[]::int[]
    ) as verified_days
  from day_rows
  group by member_key, member_name, tier, role, timezone_text, goal, motive
),
streak_rows as (
  select
    p.member_key,
    count(*)::int as streak
  from progress_rows p
  join lateral (
    select
      d.day_n,
      row_number() over (order by d.day_n desc) as rn
    from day_rows d
    where d.member_key = p.member_key
      and d.verified = true
      and p.last_done_day is not null
      and d.day_n <= p.last_done_day
  ) seq
    on seq.day_n = p.last_done_day - (seq.rn - 1)
  group by p.member_key
)
select
  p.member_key,
  p.member_name,
  p.tier,
  p.role,
  p.timezone_text,
  p.goal,
  p.motive,
  p.progress,
  coalesce(s.streak, 0)::int as streak,
  p.verified_days
from progress_rows p
left join streak_rows s
  on s.member_key = p.member_key
order by p.progress desc, coalesce(s.streak, 0) desc, p.member_name asc;
$$;

grant execute on function public.get_cohort_member_summaries(text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2) add_community_comment — 스칼라 RETURNING (42P01 회피)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.add_community_comment(
  p_cohort text,
  p_post_id text,
  p_member_key text,
  p_member_name text,
  p_comment_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_post_id text;
  v_member_key text;
  v_member_name text;
  v_text text;
  v_created_at timestamptz;
begin
  insert into public.challenge_community_comments (
    cohort,
    post_id,
    member_key,
    member_name,
    comment_text
  )
  values (
    p_cohort,
    p_post_id,
    p_member_key,
    coalesce(nullif(p_member_name, ''), '나'),
    trim(both from p_comment_text)
  )
  returning id, post_id, member_key, member_name, comment_text, created_at
  into v_id, v_post_id, v_member_key, v_member_name, v_text, v_created_at;

  return jsonb_build_object(
    'id', v_id,
    'post_id', v_post_id,
    'member_key', v_member_key,
    'author', v_member_name,
    'text', v_text,
    'created_at', v_created_at
  );
end;
$$;

grant execute on function public.add_community_comment(text, text, text, text, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3) update_community_comment — 본인 댓글 수정 (member_key 가드)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.update_community_comment(
  p_cohort text,
  p_post_id text,
  p_comment_id bigint,
  p_member_key text,
  p_comment_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_post_id text;
  v_member_key text;
  v_member_name text;
  v_text text;
  v_created_at timestamptz;
begin
  update public.challenge_community_comments
     set comment_text = trim(both from p_comment_text)
   where id = p_comment_id
     and cohort = p_cohort
     and post_id = p_post_id
     and member_key = p_member_key
  returning id, post_id, member_key, member_name, comment_text, created_at
    into v_id, v_post_id, v_member_key, v_member_name, v_text, v_created_at;

  if v_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'post_id', v_post_id,
    'member_key', v_member_key,
    'author', v_member_name,
    'text', v_text,
    'created_at', v_created_at
  );
end;
$$;

grant execute on function public.update_community_comment(text, text, bigint, text, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4) delete_community_comment — 본인 댓글 삭제 (member_key 가드)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.delete_community_comment(
  p_cohort text,
  p_post_id text,
  p_comment_id bigint,
  p_member_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affected int;
begin
  delete from public.challenge_community_comments
   where id = p_comment_id
     and cohort = p_cohort
     and post_id = p_post_id
     and member_key = p_member_key;
  get diagnostics v_affected = row_count;
  return v_affected > 0;
end;
$$;

grant execute on function public.delete_community_comment(text, text, bigint, text) to anon, authenticated;


-- ============================================================================
-- 끝 ✅
-- 확인: 브라우저 콘솔에서 "[sync] get_cohort_member_summaries RPC 가
-- verified_days 를 반환하지 않아요..." 경고가 더 이상 안 뜨면 성공.
-- ============================================================================
