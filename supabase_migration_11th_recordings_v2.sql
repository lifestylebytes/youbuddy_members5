-- 11기 녹음 인증 v2 (2026-10-17): 정확도·시도 횟수 컬럼. v1 실행 후 이것도 Run.
alter table public.recording_events add column if not exists accuracy int;   -- 0~100, 문장별 일치율 평균. 음성인식 실패 시 null
alter table public.recording_events add column if not exists attempt  int;   -- 그날 몇 번째 시도였는지
create index if not exists recording_events_member_day on public.recording_events (cohort, member_key, day_n, created_at desc);

-- 운영 조회 예시
-- 기수 평균 정확도 / 첫 시도 통과율
-- select round(avg(accuracy)) as avg_acc,
--        round(100.0 * count(*) filter (where attempt = 1 and verified) / nullif(count(*) filter (where attempt = 1), 0)) as first_try_pass_pct
-- from public.recording_events where cohort = '11기';
-- 멤버별 Day 별 최신 정확도
-- select distinct on (member_key, day_n) member_key, day_n, accuracy, matched from public.recording_events
-- where cohort = '11기' order by member_key, day_n, created_at desc;
