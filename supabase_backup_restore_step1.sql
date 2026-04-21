-- STEP 1: 스냅샷 테이블 + rowkey 리졸버
-- 에러 안 나면 STEP 2로 넘어가.

create table if not exists public.challenge_snapshots (
  id           bigint generated always as identity primary key,
  snapshot_at  timestamptz not null default now(),
  source_table text        not null,
  cohort       text,
  row_key      text        not null,
  payload      jsonb       not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_challenge_snapshots_lookup
  on public.challenge_snapshots (source_table, cohort, snapshot_at desc);

create index if not exists idx_challenge_snapshots_rowkey
  on public.challenge_snapshots (source_table, row_key, snapshot_at desc);

create index if not exists idx_challenge_snapshots_at
  on public.challenge_snapshots (snapshot_at desc);

create or replace function public._challenge_snapshot_rowkey_expr(p_table text)
returns text
language plpgsql
immutable
as $$
begin
  return case p_table
    when 'challenge_member_state'         then 'member_key'
    when 'challenge_community_posts'      then 'post_id'
    when 'challenge_community_comments'   then 'id'
    when 'challenge_community_likes'      then 'id'
    when 'challenge_verification_events'  then 'id'
    else 'id'
  end;
end;
$$;
