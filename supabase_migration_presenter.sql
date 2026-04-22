-- ============================================================================
-- YOUBUDDY 5기 — 프리미엄 주간미팅 발표자 선착순 시스템 마이그레이션
-- ============================================================================
-- 추가되는 것:
--   1) challenge_presenter_signups 테이블 (주당 signup 로우)
--   2) get_presenter_signups(p_cohort) — 전체 signup rows 리스트 반환
--   3) signup_presenter(p_cohort, p_week_n, p_member_key, p_member_name,
--      p_english_name) — 3자리 선착순 잠금 + 중복 방지. { ok, reason, rows } 반환.
--   4) release_presenter(p_cohort, p_week_n, p_member_key) — 본인 signup 해제.
--      { ok, rows } 반환.
--
-- 설계:
--   - 주당 3자리 고정 (hard limit). 서버에서 count(*) FOR UPDATE 로 원자적 체크.
--   - 한 사람이 같은 주에 두 번 signup 불가 (UNIQUE per cohort, week_n, member_key).
--   - 다른 주는 자유롭게 signup 가능 (w1 + w3 동시 OK).
--   - RLS 막아두고 RPC 만 진입 허용 (security definer).
--
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 전체 복붙 → Run.
-- 멱등함 (여러 번 돌려도 안전).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1) 테이블
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.challenge_presenter_signups (
  id             bigserial primary key,
  cohort         text        not null,
  week_n         integer     not null check (week_n between 1 and 4),
  member_key     text        not null,
  member_name    text        not null default '',
  english_name   text        not null default '',
  signed_up_at   timestamptz not null default now()
);

-- 한 멤버는 같은 주에 한 번만 signup 가능.
create unique index if not exists challenge_presenter_signups_uq
  on public.challenge_presenter_signups (cohort, week_n, member_key);

-- 주 기준 count / 조회 속도용 보조 인덱스.
create index if not exists challenge_presenter_signups_cohort_week_idx
  on public.challenge_presenter_signups (cohort, week_n);

-- RLS 잠금 (RPC 만 허용).
alter table public.challenge_presenter_signups enable row level security;

-- 기존 정책이 있을 수 있어 먼저 drop (idempotent).
drop policy if exists "no direct access" on public.challenge_presenter_signups;
-- (no policies = 모두 거부. RPC 는 security definer 라 우회 가능.)


-- ────────────────────────────────────────────────────────────────────────────
-- 2) get_presenter_signups — 전체 signup 로우 반환
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_presenter_signups(text);

create or replace function public.get_presenter_signups(
  p_cohort text
)
returns table (
  week_n       integer,
  member_key   text,
  member_name  text,
  english_name text,
  signed_up_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    s.week_n,
    s.member_key,
    s.member_name,
    s.english_name,
    s.signed_up_at
  from public.challenge_presenter_signups s
  where s.cohort = p_cohort
  order by s.week_n asc, s.signed_up_at asc;
$$;

grant execute on function public.get_presenter_signups(text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3) signup_presenter — 선착순 잠금 + 3자리 hard limit
--    반환: jsonb { ok: bool, reason?: 'FULL'|'ALREADY'|'ERR', rows: [...] }
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.signup_presenter(text, integer, text, text, text);

create or replace function public.signup_presenter(
  p_cohort text,
  p_week_n integer,
  p_member_key text,
  p_member_name text,
  p_english_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count   integer;
  v_already integer;
  v_rows    jsonb;
begin
  if p_week_n not between 1 and 4 then
    return jsonb_build_object('ok', false, 'reason', 'WEEK_OUT_OF_RANGE', 'rows', '[]'::jsonb);
  end if;
  if coalesce(p_member_key, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'NO_MEMBER_KEY', 'rows', '[]'::jsonb);
  end if;

  -- 같은 주의 signup 로우들을 먼저 잠그고 (FOR UPDATE) 카운트.
  -- 이렇게 해야 두 유저가 동시에 signup 해서 4자리가 되는 race 를 막을 수 있어요.
  select count(*)
    into v_count
    from public.challenge_presenter_signups s
   where s.cohort = p_cohort
     and s.week_n = p_week_n
   for update;

  -- 이미 내가 등록돼있는지 체크.
  select count(*)
    into v_already
    from public.challenge_presenter_signups s
   where s.cohort = p_cohort
     and s.week_n = p_week_n
     and s.member_key = p_member_key;

  if v_already > 0 then
    -- 중복 — 이미 등록됐으면 신규 insert 없이 현재 rows 만 반환.
    select coalesce(jsonb_agg(r order by r->>'signed_up_at'), '[]'::jsonb)
      into v_rows
      from (
        select jsonb_build_object(
          'week_n', s.week_n,
          'member_key', s.member_key,
          'member_name', s.member_name,
          'english_name', s.english_name,
          'signed_up_at', s.signed_up_at
        ) as r
        from public.challenge_presenter_signups s
        where s.cohort = p_cohort
        order by s.week_n asc, s.signed_up_at asc
      ) t;
    return jsonb_build_object('ok', true, 'reason', 'ALREADY', 'rows', v_rows);
  end if;

  if v_count >= 3 then
    -- 자리 없음.
    select coalesce(jsonb_agg(r order by r->>'signed_up_at'), '[]'::jsonb)
      into v_rows
      from (
        select jsonb_build_object(
          'week_n', s.week_n,
          'member_key', s.member_key,
          'member_name', s.member_name,
          'english_name', s.english_name,
          'signed_up_at', s.signed_up_at
        ) as r
        from public.challenge_presenter_signups s
        where s.cohort = p_cohort
        order by s.week_n asc, s.signed_up_at asc
      ) t;
    return jsonb_build_object('ok', false, 'reason', 'FULL', 'rows', v_rows);
  end if;

  -- 실제 insert.
  insert into public.challenge_presenter_signups (
    cohort, week_n, member_key, member_name, english_name
  ) values (
    p_cohort, p_week_n, p_member_key,
    coalesce(nullif(p_member_name, ''), ''),
    coalesce(nullif(p_english_name, ''), '')
  );

  -- 최신 rows 반환.
  select coalesce(jsonb_agg(r order by r->>'signed_up_at'), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
        'week_n', s.week_n,
        'member_key', s.member_key,
        'member_name', s.member_name,
        'english_name', s.english_name,
        'signed_up_at', s.signed_up_at
      ) as r
      from public.challenge_presenter_signups s
      where s.cohort = p_cohort
      order by s.week_n asc, s.signed_up_at asc
    ) t;

  return jsonb_build_object('ok', true, 'reason', null, 'rows', v_rows);
exception
  when unique_violation then
    -- UNIQUE 가 걸리는 극히 드문 race — ALREADY 로 취급.
    select coalesce(jsonb_agg(r order by r->>'signed_up_at'), '[]'::jsonb)
      into v_rows
      from (
        select jsonb_build_object(
          'week_n', s.week_n,
          'member_key', s.member_key,
          'member_name', s.member_name,
          'english_name', s.english_name,
          'signed_up_at', s.signed_up_at
        ) as r
        from public.challenge_presenter_signups s
        where s.cohort = p_cohort
        order by s.week_n asc, s.signed_up_at asc
      ) t;
    return jsonb_build_object('ok', true, 'reason', 'ALREADY', 'rows', v_rows);
end;
$$;

grant execute on function public.signup_presenter(text, integer, text, text, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4) release_presenter — 본인 signup 해제
--    반환: jsonb { ok: bool, rows: [...] }
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.release_presenter(text, integer, text);

create or replace function public.release_presenter(
  p_cohort text,
  p_week_n integer,
  p_member_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if p_week_n not between 1 and 4 then
    return jsonb_build_object('ok', false, 'reason', 'WEEK_OUT_OF_RANGE', 'rows', '[]'::jsonb);
  end if;

  delete from public.challenge_presenter_signups
   where cohort = p_cohort
     and week_n = p_week_n
     and member_key = p_member_key;

  select coalesce(jsonb_agg(r order by r->>'signed_up_at'), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
        'week_n', s.week_n,
        'member_key', s.member_key,
        'member_name', s.member_name,
        'english_name', s.english_name,
        'signed_up_at', s.signed_up_at
      ) as r
      from public.challenge_presenter_signups s
      where s.cohort = p_cohort
      order by s.week_n asc, s.signed_up_at asc
    ) t;

  return jsonb_build_object('ok', true, 'reason', null, 'rows', v_rows);
end;
$$;

grant execute on function public.release_presenter(text, integer, text) to anon, authenticated;


-- ============================================================================
-- 끝 ✅
-- 확인:
--   select * from public.get_presenter_signups('5기');
--   -- 처음엔 0 rows. 앱에서 signup 한 뒤 다시 돌려보면 새 row 가 뜬다.
-- ============================================================================
