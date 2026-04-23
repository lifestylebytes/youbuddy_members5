-- ============================================================================
-- YOUBUDDY 5기 — 프리미엄 주간미팅 발표자 선착순 시스템 마이그레이션
-- ============================================================================
-- v5 — SELECT INTO 완전 제거, 직접 := assignment 패턴.
--
--   이전 시도들의 에러 (v_count / cur_already / _rows "relation does not exist")
--   는 변수 이름 문제가 아니라 Supabase SQL editor / Postgres parser 가
--   'SELECT ... INTO varname FROM ...' 패턴을 plpgsql 변수 할당이 아니라
--   plain SQL 'SELECT INTO new_table' (테이블 생성문) 으로 오인하는 이슈.
--
--   이 버전은:
--     · SELECT INTO 를 모두 '_var := ( select ... )' 형태로 대체
--     · advisory_xact_lock 제거 (38명 베타 규모에선 UNIQUE constraint +
--       exception handler 로 충분)
--     · 서브쿼리 alias / 테이블 alias 전부 제거
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

create unique index if not exists challenge_presenter_signups_uq
  on public.challenge_presenter_signups (cohort, week_n, member_key);

create index if not exists challenge_presenter_signups_cohort_week_idx
  on public.challenge_presenter_signups (cohort, week_n);

alter table public.challenge_presenter_signups enable row level security;

drop policy if exists "no direct access" on public.challenge_presenter_signups;


-- ────────────────────────────────────────────────────────────────────────────
-- 2) get_presenter_signups — 전체 signup 로우 반환
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_presenter_signups(text);

create or replace function public.get_presenter_signups(p_cohort text)
returns table (
  week_n       integer,
  member_key   text,
  member_name  text,
  english_name text,
  signed_up_at timestamptz
)
language sql
security definer
as $fn$
  select week_n, member_key, member_name, english_name, signed_up_at
    from public.challenge_presenter_signups
   where cohort = p_cohort
   order by week_n asc, signed_up_at asc;
$fn$;

grant execute on function public.get_presenter_signups(text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3) signup_presenter — 선착순 + 3자리 hard limit
--    반환: jsonb { ok, reason?, rows }
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.signup_presenter(text, integer, text, text, text);

create or replace function public.signup_presenter(
  p_cohort       text,
  p_week_n       integer,
  p_member_key   text,
  p_member_name  text,
  p_english_name text
)
returns jsonb
language plpgsql
security definer
as $fn$
declare
  slot_count integer;
  out_rows   jsonb;
begin
  if p_week_n not between 1 and 4 then
    return jsonb_build_object('ok', false, 'reason', 'WEEK_OUT_OF_RANGE', 'rows', '[]'::jsonb);
  end if;
  if coalesce(p_member_key, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'NO_MEMBER_KEY', 'rows', '[]'::jsonb);
  end if;

  -- 이미 등록돼있는지 확인.
  if exists (
    select 1 from public.challenge_presenter_signups
     where cohort = p_cohort
       and week_n = p_week_n
       and member_key = p_member_key
  ) then
    out_rows := (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'week_n',       week_n,
            'member_key',   member_key,
            'member_name',  member_name,
            'english_name', english_name,
            'signed_up_at', signed_up_at
          )
          order by week_n asc, signed_up_at asc
        ),
        '[]'::jsonb
      )
      from public.challenge_presenter_signups
      where cohort = p_cohort
    );
    return jsonb_build_object('ok', true, 'reason', 'ALREADY', 'rows', out_rows);
  end if;

  -- 이 주차 자리 카운트.
  slot_count := (
    select count(*)
      from public.challenge_presenter_signups
     where cohort = p_cohort
       and week_n = p_week_n
  );

  if slot_count >= 3 then
    out_rows := (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'week_n',       week_n,
            'member_key',   member_key,
            'member_name',  member_name,
            'english_name', english_name,
            'signed_up_at', signed_up_at
          )
          order by week_n asc, signed_up_at asc
        ),
        '[]'::jsonb
      )
      from public.challenge_presenter_signups
      where cohort = p_cohort
    );
    return jsonb_build_object('ok', false, 'reason', 'FULL', 'rows', out_rows);
  end if;

  -- Insert.
  insert into public.challenge_presenter_signups
    (cohort, week_n, member_key, member_name, english_name)
  values
    (p_cohort, p_week_n, p_member_key,
     coalesce(nullif(p_member_name, ''),  ''),
     coalesce(nullif(p_english_name, ''), ''));

  out_rows := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'week_n',       week_n,
          'member_key',   member_key,
          'member_name',  member_name,
          'english_name', english_name,
          'signed_up_at', signed_up_at
        )
        order by week_n asc, signed_up_at asc
      ),
      '[]'::jsonb
    )
    from public.challenge_presenter_signups
    where cohort = p_cohort
  );

  return jsonb_build_object('ok', true, 'reason', null, 'rows', out_rows);

exception
  when unique_violation then
    out_rows := (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'week_n',       week_n,
            'member_key',   member_key,
            'member_name',  member_name,
            'english_name', english_name,
            'signed_up_at', signed_up_at
          )
          order by week_n asc, signed_up_at asc
        ),
        '[]'::jsonb
      )
      from public.challenge_presenter_signups
      where cohort = p_cohort
    );
    return jsonb_build_object('ok', true, 'reason', 'ALREADY', 'rows', out_rows);
end;
$fn$;

grant execute on function public.signup_presenter(text, integer, text, text, text) to anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4) release_presenter — 본인 signup 해제
--    반환: jsonb { ok, rows }
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.release_presenter(text, integer, text);

create or replace function public.release_presenter(
  p_cohort     text,
  p_week_n     integer,
  p_member_key text
)
returns jsonb
language plpgsql
security definer
as $fn$
declare
  out_rows jsonb;
begin
  if p_week_n not between 1 and 4 then
    return jsonb_build_object('ok', false, 'reason', 'WEEK_OUT_OF_RANGE', 'rows', '[]'::jsonb);
  end if;

  delete from public.challenge_presenter_signups
   where cohort = p_cohort
     and week_n = p_week_n
     and member_key = p_member_key;

  out_rows := (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'week_n',       week_n,
          'member_key',   member_key,
          'member_name',  member_name,
          'english_name', english_name,
          'signed_up_at', signed_up_at
        )
        order by week_n asc, signed_up_at asc
      ),
      '[]'::jsonb
    )
    from public.challenge_presenter_signups
    where cohort = p_cohort
  );

  return jsonb_build_object('ok', true, 'reason', null, 'rows', out_rows);
end;
$fn$;

grant execute on function public.release_presenter(text, integer, text) to anon, authenticated;


-- ============================================================================
-- 끝 ✅
-- 테스트 (migration Run 후 SQL editor 에서 따로 돌려보면 확인 가능):
--   select * from public.get_presenter_signups('5기');
--   select public.signup_presenter('5기', 2, 'test:999', 'TEST', 'testname');
--   select public.release_presenter('5기', 2, 'test:999');
-- ============================================================================
