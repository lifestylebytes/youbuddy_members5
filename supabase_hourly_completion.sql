create table if not exists public.challenge_verification_events (
  id bigint generated always as identity primary key,
  cohort text not null,
  member_key text not null,
  verified_day integer not null check (verified_day between 1 and 20),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cohort, member_key, verified_day)
);

create index if not exists idx_challenge_verification_events_lookup
  on public.challenge_verification_events (cohort, verified_day, verified_at);

create table if not exists public.challenge_member_state (
  id bigint generated always as identity primary key,
  cohort text not null,
  member_key text not null,
  member_name text,
  tier text,
  app_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cohort, member_key)
);

create index if not exists idx_challenge_member_state_lookup
  on public.challenge_member_state (cohort, member_key);

create or replace function public.record_verification_event(
  p_cohort text,
  p_member_key text,
  p_verified_day integer,
  p_verified_at timestamptz default now()
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.challenge_verification_events (
    cohort,
    member_key,
    verified_day,
    verified_at
  )
  values (
    p_cohort,
    p_member_key,
    p_verified_day,
    coalesce(p_verified_at, now())
  )
  on conflict (cohort, member_key, verified_day)
  do update set verified_at = excluded.verified_at;
end;
$$;

create or replace function public.get_hourly_completion_delta(
  p_cohort text,
  p_verified_day integer,
  p_total_members integer,
  p_now timestamptz default now()
)
returns table (
  current_count integer,
  yesterday_count integer,
  current_rate_pct integer,
  yesterday_rate_pct integer,
  delta_rate_pct integer
)
language sql
security definer
as $$
with bounds as (
  select
    date_trunc('hour', coalesce(p_now, now())) as current_hour,
    date_trunc('hour', coalesce(p_now, now()) - interval '1 day') as yesterday_same_hour
),
current_stats as (
  select count(distinct member_key)::int as cnt
  from public.challenge_verification_events e
  cross join bounds b
  where e.cohort = p_cohort
    and e.verified_day = p_verified_day
    and e.verified_at <= b.current_hour + interval '59 minutes 59 seconds'
),
yesterday_stats as (
  select count(distinct member_key)::int as cnt
  from public.challenge_verification_events e
  cross join bounds b
  where e.cohort = p_cohort
    and e.verified_day = greatest(p_verified_day - 1, 1)
    and e.verified_at <= b.yesterday_same_hour + interval '59 minutes 59 seconds'
)
select
  c.cnt as current_count,
  y.cnt as yesterday_count,
  round((c.cnt::numeric / greatest(p_total_members, 1)) * 100)::int as current_rate_pct,
  round((y.cnt::numeric / greatest(p_total_members, 1)) * 100)::int as yesterday_rate_pct,
  round(((c.cnt::numeric - y.cnt::numeric) / greatest(p_total_members, 1)) * 100)::int as delta_rate_pct
from current_stats c
cross join yesterday_stats y;
$$;

grant execute on function public.record_verification_event(text, text, integer, timestamptz) to anon, authenticated;
grant execute on function public.get_hourly_completion_delta(text, integer, integer, timestamptz) to anon, authenticated;

create or replace function public.get_member_app_state(
  p_cohort text,
  p_member_key text
)
returns jsonb
language sql
security definer
as $$
  select coalesce(
    (
      select app_state
      from public.challenge_member_state
      where cohort = p_cohort
        and member_key = p_member_key
      limit 1
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.upsert_member_app_state(
  p_cohort text,
  p_member_key text,
  p_member_name text,
  p_tier text,
  p_app_state jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.challenge_member_state (
    cohort,
    member_key,
    member_name,
    tier,
    app_state,
    updated_at
  )
  values (
    p_cohort,
    p_member_key,
    p_member_name,
    p_tier,
    coalesce(p_app_state, '{}'::jsonb),
    now()
  )
  on conflict (cohort, member_key)
  do update set
    member_name = excluded.member_name,
    tier = excluded.tier,
    app_state = excluded.app_state,
    updated_at = now();
end;
$$;

grant execute on function public.get_member_app_state(text, text) to anon, authenticated;
grant execute on function public.upsert_member_app_state(text, text, text, text, jsonb) to anon, authenticated;

-- NOTE: We return verified_days (int[]) so the client board can render the exact
-- days each peer verified. Previously we only returned `progress` as a count —
-- but the client interpreted that count as "max day verified", so a peer who
-- verified Day 2 without Day 1 showed up with Day 1 orange instead of Day 2.
-- With `verified_days` the client can mark the correct cells regardless of order.
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

-- Per-member verification timestamps for a given cohort + day.
-- Client uses this to render "오늘 인증 완료됨 · 23:47" tooltips on peer cells.
create or replace function public.list_verification_times_for_day(
  p_cohort text,
  p_day integer,
  p_tz_offset_minutes integer default 540  -- default Asia/Seoul (KST, +9h)
)
returns table (
  member_key text,
  member_name text,
  verified_at timestamptz,
  verified_hhmm text
)
language sql
security definer
as $$
  select
    e.member_key,
    coalesce(cms.member_name, cms.app_state ->> 'name', '') as member_name,
    e.verified_at,
    to_char(
      e.verified_at at time zone make_interval(mins => coalesce(p_tz_offset_minutes, 540)),
      'HH24:MI'
    ) as verified_hhmm
  from public.challenge_verification_events e
  left join public.challenge_member_state cms
    on cms.cohort = e.cohort and cms.member_key = e.member_key
  where e.cohort = p_cohort and e.verified_day = p_day
  order by e.verified_at asc;
$$;

grant execute on function public.list_verification_times_for_day(text, integer, integer) to anon, authenticated;

create table if not exists public.challenge_community_posts (
  id bigint generated always as identity primary key,
  cohort text not null,
  post_id text not null,
  member_key text not null,
  member_name text not null,
  member_role text,
  member_tier text,
  member_team text,
  member_timezone text,
  day_n integer not null check (day_n between 1 and 20),
  word text,
  sentence text not null,
  translation text,
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort, post_id)
);

create index if not exists idx_challenge_community_posts_lookup
  on public.challenge_community_posts (cohort, day_n, updated_at desc);

create table if not exists public.challenge_community_likes (
  id bigint generated always as identity primary key,
  cohort text not null,
  post_id text not null,
  member_key text not null,
  created_at timestamptz not null default now(),
  unique (cohort, post_id, member_key)
);

create index if not exists idx_challenge_community_likes_lookup
  on public.challenge_community_likes (cohort, post_id);

create table if not exists public.challenge_community_comments (
  id bigint generated always as identity primary key,
  cohort text not null,
  post_id text not null,
  member_key text not null,
  member_name text not null,
  comment_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_challenge_community_comments_lookup
  on public.challenge_community_comments (cohort, post_id, created_at desc);

create or replace function public.upsert_community_post(
  p_cohort text,
  p_post_id text,
  p_member_key text,
  p_member_name text,
  p_member_role text,
  p_member_tier text,
  p_member_team text,
  p_member_timezone text,
  p_day_n integer,
  p_word text,
  p_sentence text,
  p_translation text default '',
  p_source_key text default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.challenge_community_posts (
    cohort,
    post_id,
    member_key,
    member_name,
    member_role,
    member_tier,
    member_team,
    member_timezone,
    day_n,
    word,
    sentence,
    translation,
    source_key,
    updated_at
  )
  values (
    p_cohort,
    p_post_id,
    p_member_key,
    p_member_name,
    p_member_role,
    p_member_tier,
    p_member_team,
    p_member_timezone,
    p_day_n,
    p_word,
    p_sentence,
    coalesce(p_translation, ''),
    p_source_key,
    now()
  )
  on conflict (cohort, post_id)
  do update set
    member_name = excluded.member_name,
    member_role = excluded.member_role,
    member_tier = excluded.member_tier,
    member_team = excluded.member_team,
    member_timezone = excluded.member_timezone,
    day_n = excluded.day_n,
    word = excluded.word,
    sentence = excluded.sentence,
    translation = excluded.translation,
    source_key = excluded.source_key,
    updated_at = now();
end;
$$;

create or replace function public.delete_community_post(
  p_cohort text,
  p_post_id text,
  p_member_key text
)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.challenge_community_likes
  where cohort = p_cohort
    and post_id = p_post_id;

  delete from public.challenge_community_comments
  where cohort = p_cohort
    and post_id = p_post_id;

  delete from public.challenge_community_posts
  where cohort = p_cohort
    and post_id = p_post_id
    and member_key = p_member_key;
end;
$$;

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
  v_result jsonb;
begin
  -- search_path='' + fully-qualified relation names avoids the Supabase SQL editor
  -- bug where `set search_path = public` caused 42P01 ("relation 'public' does not exist").
  -- Intermediate variable avoids CTE-in-RETURN parsing quirks seen on older pg versions.
  with ins as (
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
  )
  select jsonb_build_object(
    'id', ins.id,
    'post_id', ins.post_id,
    'member_key', ins.member_key,
    'author', ins.member_name,
    'text', ins.comment_text,
    'created_at', ins.created_at
  )
  into v_result
  from ins;

  return v_result;
end;
$$;

create or replace function public.set_community_like(
  p_cohort text,
  p_post_id text,
  p_member_key text,
  p_liked boolean
)
returns integer
language plpgsql
security definer
as $$
begin
  if coalesce(p_liked, false) then
    insert into public.challenge_community_likes (cohort, post_id, member_key)
    values (p_cohort, p_post_id, p_member_key)
    on conflict (cohort, post_id, member_key) do nothing;
  else
    delete from public.challenge_community_likes
    where cohort = p_cohort
      and post_id = p_post_id
      and member_key = p_member_key;
  end if;

  -- Return the current like count directly (avoid SELECT ... INTO which
  -- some Supabase SQL editor builds misparse as a "CREATE TABLE AS" form).
  return coalesce((
    select count(*)::int
    from public.challenge_community_likes
    where cohort = p_cohort
      and post_id = p_post_id
  ), 0);
end;
$$;

create or replace function public.get_community_posts(
  p_cohort text,
  p_day integer,
  p_viewer_key text default null
)
returns jsonb
language sql
security definer
as $$
with post_rows as (
  select
    p.post_id as id,
    p.member_key,
    p.member_name as user,
    p.member_role as role,
    p.member_tier as tier,
    p.member_team as team,
    p.member_timezone as timezone_text,
    p.day_n,
    p.word,
    p.sentence,
    p.translation,
    p.source_key,
    p.created_at,
    p.updated_at,
    coalesce(l.likes_count, 0)::int as likes_count,
    coalesce(c.comments_count, 0)::int as comments_count,
    coalesce(c.comments, '[]'::jsonb) as comments,
    exists(
      select 1
      from public.challenge_community_likes cl
      where cl.cohort = p_cohort
        and cl.post_id = p.post_id
        and cl.member_key = p_viewer_key
    ) as liked_by_me
  from public.challenge_community_posts p
  left join (
    select cohort, post_id, count(*)::int as likes_count
    from public.challenge_community_likes
    where cohort = p_cohort
    group by cohort, post_id
  ) l
    on l.cohort = p.cohort
   and l.post_id = p.post_id
  left join (
    select
      cohort,
      post_id,
      count(*)::int as comments_count,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'member_key', member_key,
          'author', member_name,
          'text', comment_text,
          'created_at', created_at
        )
        order by created_at asc
      ) as comments
    from public.challenge_community_comments
    where cohort = p_cohort
    group by cohort, post_id
  ) c
    on c.cohort = p.cohort
   and c.post_id = p.post_id
  where p.cohort = p_cohort
    and p.day_n = p_day
  order by p.updated_at desc, p.created_at desc
)
select coalesce(jsonb_agg(to_jsonb(post_rows)), '[]'::jsonb)
from post_rows;
$$;

grant execute on function public.upsert_community_post(text, text, text, text, text, text, text, text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_community_post(text, text, text) to anon, authenticated;
grant execute on function public.add_community_comment(text, text, text, text, text) to anon, authenticated;
grant execute on function public.set_community_like(text, text, text, boolean) to anon, authenticated;
grant execute on function public.get_community_posts(text, integer, text) to anon, authenticated;
