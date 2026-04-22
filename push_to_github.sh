#!/bin/bash
# YOUBUDDY 5기 베타 - 커밋 + 푸시 스크립트
# 실행: bash /Users/gyo/Downloads/youbuddy-challenge-claude/push_to_github.sh
set -e

REPO="/Users/gyo/Downloads/youbuddy-challenge-claude"
cd "$REPO"

echo "==> 오래된 락 파일 정리..."
rm -f .git/index.lock .git/HEAD.lock .git/index.lock.* .git/HEAD.lock.* 2>/dev/null || true
rm -rf .git/rebase-merge .git/rebase-merge.* 2>/dev/null || true
find .git/objects -name "tmp_obj_*" -delete 2>/dev/null || true
find .git -name "*.lock" -delete 2>/dev/null || true

echo "==> 현재 상태:"
git status --short
git log --oneline -3

# 변경분이 있으면 전부 stage 후 자동 커밋.
if ! git diff --cached --quiet || ! git diff --quiet; then
  echo ""
  echo "==> 변경 사항 커밋..."
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "Premium 주간 미팅 발표자 선착순 시스템 (v1 풀스택)

목적
- 프리미엄 참가자가 주간 미팅에서 '얻은 게 있다' + '충분히 말했다'
  라고 느끼게 하기 위한 발표자 중심 개편.
- 각 주 3명 선착순 7분 발표 + 피드백. 자리를 잡은 순간 준비 공간이
  열려서 실제로 미팅 전에 1번은 입으로 말해보게 유도.

PremiumPage 주간 미팅 카드 (4주 통합)
- CHALLENGE.premium.weekly_meetings 가 단일 소스. 기존 duplicate
  premiumMeetings 로컬 배열 제거.
- 각 카드: 날짜 뱃지 + 타이틀 + 이번주 라벨 + 시나리오 setting +
  premise 인용 블록 + mustUseVocab 칩 (최대 6개) + 발표자 슬롯 3자리
  (이니셜 원, 빈 자리는 점선 원) + '{n}자리 남음' 인디케이터 +
  signed-up 멤버 English nick list.
- CTA 는 내 상태에 따라 컨텍스트화:
  · 내가 발표자 → '🎤 발표 준비하기' + '자리 내려놓기'
  · 자리 남음 (미래) → '🎤 발표 자리 잡기' + '말할 거리' 보조
  · 마감 (미래) → '📝 말할 거리 준비하기'
  · 지나간 주 → '📝 내 메모 보기 / 사후 메모 남기기'
- 베이직 유저는 미리보기 pill 로만 노출 (signup 불가).
- 이번주 카드에 lilac ring + glow 강조.

PresenterPrepPage (신규 페이지)
- 내가 자리를 잡은 후 자동 이동. 자리 유지 동안 계속 재진입 가능.
- 다크 라일락 hero: WEEK n · 날짜 · D-카운트다운.
- Scenario (setting/premise/flow 3스텝) + 7분 프롬프트 블록.
- mustUseVocab 중 최대 3개 픽커. 칩 토글로 저장.
- 스크립트 textarea (자동 저장) + 픽한 어휘가 스크립트에 등장하는지
  실시간 ✓ / ◯ 인디케이터 ({n}/{total} 사용됨).
- 🔒 사적 노트 textarea (긴장 포인트 · Q&A · 피드백 요청).
- ⏱ 7분 연습 타이머 (시작/일시정지/리셋, 종료 시 토스트).
- 자리 내려놓기 버튼 (미래 주 한정).
- 진입: state.tier === 'premium' 만. basic 은 premium gate.

홈 hero — 이번 주 프리미엄 미팅 카드
- 프리미엄 유저에게만 노출. requestPresenterSignups() 로 서버 싱크.
- 상태에 따라 색/카피:
  · 내가 발표자 → 다크 hero + 'ME' 리본 + '발표 준비하러 →'
  · 자리 남음 → 라일락 그라데이션 + '{n}자리 남음 · {시나리오}' +
    '발표 자리 잡기 →'
  · 마감 → 라일락 그라데이션 + '자리 마감 · {시나리오}' +
    '말할 거리 준비하기 →'
- 클릭 → 발표자면 PresenterPrepPage, 아니면 PremiumPage.

플로팅 🎤 버튼 (프리미엄 전용)
- bottom:88px 에 58px 원형 FAB (탭바 위).
- 프리미엄 + onboarded + 현재페이지가 presenter-prep/meeting-notes/
  quiz/certification 이 아닐 때만 노출.
- 내가 발표자 → dark lilac 그라데이션 + 'ME' 리본. 클릭 시 prep.
- 자리 남음 → 라일락 + 오렌지 '{n}' 뱃지. 클릭 시 premium.
- 자리 마감 → 라일락 (뱃지 없음). 클릭 시 premium.
- 지나간 주 + 내가 발표자 아니면 숨김.

Google Meet 리네임
- Zoom → Google Meet (CHALLENGE.premium.weekly_meetings 4개 +
  카드 서브라인 + '주간 Zoom 미팅' 섹션 헤더 + 프로필 '주 1회 Zoom'
  안내 2곳 + Certification meetup).

커뮤니티 & 피드 버그
- 댓글 작성자: memberByKey/memberByRef → displayName 으로 resolve.
  '유버디' 같이 운영 이름 대신 본인 영어 nick 노출.
- mergePersistedState: sessionKeep (communityDay, communityDayPickerOpen)
  보존. 15초 리프레시 시 Day 2 보다가 자동으로 Day 3 로 점프하는
  버그 수정 (session-only UI state 가 PERSISTED_STATE_KEYS 에 없어서
  snapshot 머지 시 undefined 덮어쓰여지던 root cause).

라우팅
- 'presenter-prep' 라우트 추가.
- TabBar 프리미엄 tab match 배열에 presenter-prep / meeting-notes 추가
  → 서브 페이지에서도 프리미엄 탭이 활성 상태 유지.

상태
- presenter_prep persistence 는 기존 PERSISTED_STATE_KEYS 에 이미
  등록됨 (지난 커밋). 스크립트/노트/픽한 어휘 자동 저장.

필수 후속 작업
- Supabase SQL Editor 에서 다음 순서로 실행:
  1. supabase_migration_english_name.sql (아직이면)
  2. supabase_migration_presenter.sql (이번 배포 직후 필수)
- 미적용 상태에서는 RPC 404 로 failing 하고 오프라인 모드 (로컬만)
  로 graceful fallback. 타 유저에게는 signup 이 안 보일 수 있음."
  fi
fi

echo ""
echo "==> 원격 가져오기..."
git fetch origin main

echo ""
echo "==> 푸시..."
git push origin main

echo ""
echo "완료 ✅  https://github.com/lifestylebytes/youbuddy_members5"
echo "1~2분 후 youbuddy.co.kr/5th 에 반영됩니다."
