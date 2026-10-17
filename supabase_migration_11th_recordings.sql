-- ============================================================
-- 11기 · 앱 녹음 인증 (2026-10-17)
-- 카톡 녹음 대신 앱에서 녹음 → Storage 저장 → 음성인식으로 "내 문장 읽었는지" 확인 → 녹음 체크 자동.
-- 실행: Supabase SQL Editor 에서 통째로 Run. (edge function `recording` 배포 전에 먼저)
-- ============================================================

-- 1) 녹음 파일 버킷 (비공개. 재생은 edge function 이 서명 URL 로만 내준다)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 5242880, array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a','audio/aac'])
on conflict (id) do update set public = false, file_size_limit = 5242880;

-- 2) 녹음 이벤트 로그 (append-only. 인증 로그처럼 "블랙박스" 역할. app_state 가 날아가도 여기서 복구)
create table if not exists public.recording_events (
  id           bigserial primary key,
  cohort       text        not null,
  member_key   text        not null,
  day_n        int         not null,
  path         text        not null,            -- storage 경로: {cohort}/{member_key}/d{N}-{ts}.{ext}
  mime         text,
  duration_ms  int,
  transcript   text,                            -- 음성인식 결과 (영어)
  scores       jsonb,                           -- [0.83, 0.71, 0.40] 문장별 일치율
  matched      int         not null default 0,  -- 일치한 문장 수 (0~3)
  verified     boolean     not null default false, -- matched >= 2 이면 true
  stt_ok       boolean     not null default true,  -- 음성인식 자체가 실패하면 false (그래도 인증은 인정)
  created_at   timestamptz not null default now()
);
create index if not exists recording_events_cohort_day on public.recording_events (cohort, day_n);
create index if not exists recording_events_member on public.recording_events (cohort, member_key);
alter table public.recording_events enable row level security;
-- anon 은 직접 못 읽고 못 쓴다. edge function(service role) 만 쓴다.

-- 3) 녹음 체크 자동 ON (운영진이 손으로 누르던 그것)
--    고스트 멤버 __recording_checks__ 의 app_state.checks[dN][member] = true 를 "그 키 하나만" 원자적으로 갱신.
--    통째로 덮어쓰지 않으므로 동시 저장 충돌이 없다. (2026-10-11 유실 원칙 준수)
create or replace function public.mark_recording_check(p_cohort text, p_member text, p_day int)
returns void
language plpgsql
security definer
as $$
declare
  dkey text := 'd' || p_day::text;
begin
  insert into public.challenge_member_state (cohort, member_key, member_name, tier, app_state, updated_at)
  values (p_cohort, '__recording_checks__', '__recording_checks__', 'basic',
          jsonb_build_object('ghost', true, 'checks', jsonb_build_object(dkey, jsonb_build_object(p_member, true))), now())
  on conflict (cohort, member_key) do update set
    app_state = jsonb_set(
                  jsonb_set(coalesce(public.challenge_member_state.app_state, '{}'::jsonb), '{checks}',
                            coalesce(public.challenge_member_state.app_state->'checks', '{}'::jsonb), true),
                  array['checks', dkey],
                  coalesce(public.challenge_member_state.app_state->'checks'->dkey, '{}'::jsonb) || jsonb_build_object(p_member, true),
                  true),
    updated_at = now();
end;
$$;
-- 멤버 앱이 직접 부르지 않는다. edge function 이 service role 로 부른다. (anon 에 grant 하지 않음)
revoke all on function public.mark_recording_check(text, text, int) from public, anon;

-- 4) 오늘 녹음한 사람 목록 (운영 보드 · 저녁 요약용)
create or replace function public.list_recordings_for_day(p_cohort text, p_day int)
returns table (member_key text, matched int, verified boolean, stt_ok boolean, created_at timestamptz)
language sql
security definer
as $$
  select distinct on (member_key) member_key, matched, verified, stt_ok, created_at
  from public.recording_events
  where cohort = p_cohort and day_n = p_day
  order by member_key, created_at desc;
$$;
grant execute on function public.list_recordings_for_day(text, int) to anon, authenticated;

-- 5) 30일 보관 후 삭제: 파일 삭제는 edge function `recording` 의 mode='purge' 가 한다.
--    (storage.objects 를 SQL 로 지우면 실제 파일이 안 지워진다.)
--    pg_cron 이 켜져 있으면 아래로 매일 04:00 KST(19:00 UTC) 호출. 꺼져 있으면 Cowork 예약 태스크로 같은 URL 을 호출.
-- select cron.schedule('purge-recordings', '0 19 * * *',
--   $$ select net.http_post(
--        url := current_setting('app.supabase_url') || '/functions/v1/recording',
--        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
--        body := '{"mode":"purge"}'::jsonb) $$);

-- 검증
-- select * from public.list_recordings_for_day('11기', 1);
-- select app_state->'checks' from public.challenge_member_state where cohort='11기' and member_key='__recording_checks__';
