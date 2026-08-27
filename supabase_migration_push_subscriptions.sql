-- push_subscriptions 테이블
-- Web Push 구독 정보를 멤버별로 저장.
-- 멤버가 앱에서 알림 허용 시 upsert, 거부/취소 시 delete.

create table if not exists push_subscriptions (
  id            bigint generated always as identity primary key,
  cohort        text not null,
  member_key    text not null,
  subscription  jsonb not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- endpoint 기준 중복 방지 (jsonb 함수 인덱스는 별도)
create unique index if not exists push_subscriptions_unique_endpoint
  on push_subscriptions (cohort, member_key, (subscription->>'endpoint'));

-- RLS
alter table push_subscriptions enable row level security;

create policy "구독 insert" on push_subscriptions
  for insert with check (true);

create policy "구독 update" on push_subscriptions
  for update using (true);

create policy "구독 delete" on push_subscriptions
  for delete using (true);

-- updated_at 자동 갱신
create or replace function update_push_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_subscriptions_updated_at on push_subscriptions;
create trigger trg_push_subscriptions_updated_at
  before update on push_subscriptions
  for each row execute function update_push_subscriptions_updated_at();
