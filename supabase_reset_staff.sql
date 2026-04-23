-- ============================================================
-- 운영팀 / 유령 계정 데이터 리셋 (단순화 버전 — 각 테이블별 독립 DO 블록)
--
--   · 유버디 (code 00) · 이규태 (42) · 이지흔 (43) · 모모 (44)
--   · 과거 흔적: '운영자' (유버디 이전 이름)
--
-- 실행: Supabase SQL Editor → New query → 전체 붙여넣고 Run
-- 테이블 없으면 스킵, 여러 번 돌려도 안전.
-- ============================================================

-- ---- 1) challenge_member_state ---------------------------------
do $$
begin
  if to_regclass('public.challenge_member_state') is not null then
    delete from public.challenge_member_state
     where member_name in ('유버디', '이규태', '이지흔', '모모', '운영자')
        or member_key like '00:%'
        or member_key like '42:%'
        or member_key like '43:%'
        or member_key like '44:%';
  end if;
end $$;

-- ---- 2) challenge_verification_events --------------------------
do $$
begin
  if to_regclass('public.challenge_verification_events') is not null then
    delete from public.challenge_verification_events
     where member_key like '00:%'
        or member_key like '42:%'
        or member_key like '43:%'
        or member_key like '44:%';
  end if;
end $$;

-- ---- 3) challenge_presenter_signups ----------------------------
do $$
begin
  if to_regclass('public.challenge_presenter_signups') is not null then
    delete from public.challenge_presenter_signups
     where member_name in ('유버디', '이규태', '이지흔', '모모', '운영자')
        or member_key like '00:%'
        or member_key like '42:%'
        or member_key like '43:%'
        or member_key like '44:%';
  end if;
end $$;

-- ---- 4) challenge_community_likes ------------------------------
do $$
begin
  if to_regclass('public.challenge_community_likes') is not null then
    delete from public.challenge_community_likes
     where member_key like '00:%'
        or member_key like '42:%'
        or member_key like '43:%'
        or member_key like '44:%';
  end if;
end $$;

-- (내 글에 달린 좋아요도 같이 정리)
do $$
begin
  if to_regclass('public.challenge_community_likes') is not null
     and to_regclass('public.challenge_community_posts') is not null then
    delete from public.challenge_community_likes
     where post_id in (
       select post_id from public.challenge_community_posts
        where member_name in ('유버디', '이규태', '이지흔', '모모', '운영자')
           or member_key like '00:%'
           or member_key like '42:%'
           or member_key like '43:%'
           or member_key like '44:%'
     );
  end if;
end $$;

-- ---- 5) challenge_community_comments ---------------------------
do $$
begin
  if to_regclass('public.challenge_community_comments') is not null then
    delete from public.challenge_community_comments
     where member_name in ('유버디', '이규태', '이지흔', '모모', '운영자')
        or member_key like '00:%'
        or member_key like '42:%'
        or member_key like '43:%'
        or member_key like '44:%';
  end if;
end $$;

-- (내 글에 달린 댓글도 같이 정리)
do $$
begin
  if to_regclass('public.challenge_community_comments') is not null
     and to_regclass('public.challenge_community_posts') is not null then
    delete from public.challenge_community_comments
     where post_id in (
       select post_id from public.challenge_community_posts
        where member_name in ('유버디', '이규태', '이지흔', '모모', '운영자')
           or member_key like '00:%'
           or member_key like '42:%'
           or member_key like '43:%'
           or member_key like '44:%'
     );
  end if;
end $$;

-- ---- 6) challenge_community_posts ------------------------------
do $$
begin
  if to_regclass('public.challenge_community_posts') is not null then
    delete from public.challenge_community_posts
     where member_name in ('유버디', '이규태', '이지흔', '모모', '운영자')
        or member_key like '00:%'
        or member_key like '42:%'
        or member_key like '43:%'
        or member_key like '44:%';
  end if;
end $$;

-- ============================================================
-- 확인용 — 실행 후 각각 0 이 떠야 정상:
-- ============================================================
-- select 'member_state' as t, count(*) from public.challenge_member_state
--   where member_name in ('유버디','이규태','이지흔','모모','운영자');
-- select 'verify' as t, count(*) from public.challenge_verification_events
--   where member_key like '00:%' or member_key like '42:%' or member_key like '43:%' or member_key like '44:%';
-- select 'posts' as t, count(*) from public.challenge_community_posts
--   where member_name in ('유버디','이규태','이지흔','모모','운영자');
