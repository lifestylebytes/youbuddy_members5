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

create or replace function public.record_verification_event(
  p_cohort text,
  p_member_key text,
  p_verified_day integer,
  p_verified_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
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
set search_path = public
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
