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
    git commit -m "발표자 1주 제한 + Personal Quiz 락 + 단어장 통합 + 리치 수료증

발표자 1주 제한
- 한 사람이 4주차 중 1주만 발표자로 자리 잡도록.
- myPresenterWeek() helper → PremiumPage CTA 에 'Week N 에 이미 자리
  잡음' 락 버튼 분기 추가. 다른 주 카드에서도 signup 버튼 자동 막힘.
- signup RPC ALREADY_SIGNED_UP 에러 → '이미 Week N 에 자리 잡으셨어요.
  옮기려면 그 주 자리부터 내려놓기' 토스트.

Personal Quiz 락 (발표 후 스크립트 주입 → 생성)
- personalQuizState() 4단계 gating: not_signed_up / before_present /
  waiting_inject / ready.
- state.personal_quiz = { items, basedOnScript, injectedAt, week } +
  state.personal_quiz_answers 로 개편. 기존 주별 기본 퀴즈 로직 삭제.
- PremiumPage 퀴즈 카드 + QuizPage 에 단계별 락 카피 표시.
- Operator console helpers: window.__injectPersonalQuiz({items,
  basedOnScript, week}), __clearPersonalQuiz(). state.isOperator 일
  때 QuizPage 에 inject 텍스트에리어 노출 (셀프 테스트용).
- Markdown export + ProfilePage quizDone 계산 personal_quiz 기준으로.

단어장 통합 (pitch_vocab 단일 소스)
- 데일리 북마크 / 유의어 북마크 / 미팅 chip / 수동 입력 → 전부
  state.pitch_vocab 로 수렴. 각 엔트리에 source + sourceKey 부여.
- addToVocabBank/removeFromVocabBank/syncDailyBookmarkToBank/
  syncSynBookmarkToBank/clearLinkedBookmarksForVocab helper.
- 토글 훅: 데일리 북마크 on/off, window.__toggleBookmark,
  window.__toggleSynBookmark 모두 bank 동기화.
- migrateBookmarksToVocabBank() 1회 마이그레이션 — __vocabMigrated 로
  가드. boot hydrate 후 실행.
- VOCAB BANK UI: source 필터 chip (전체/데일리/유의어/미팅/직접) +
  색상 구분 source 라벨 pill.

리치 HTML 수료증 파이프라인
- 기존 SVG 1장짜리 downloadCertificate 를 buildCertHtml() 로 교체.
  오렌지 테마, Cormorant Garamond + Noto Sans KR, glass 카드, 4개
  스탯 pill, topic/strengths/growth/keyVocab 카드 (비었으면 숨김),
  다크 Final Vocabulary 그리드 (pitch_vocab 중 daily > manual 우선
  top 10), 서명 footer.
- 자동 수집: englishName / role / done·total·overall / vocabCount /
  startDate·endDate·days / finalVocab. 코치 수기 입력은 cert_profile
  ={topic,strengths,growth,keyVocab,issuedAt} 로 분리.
- Operator console helpers: window.__injectCertProfile(profile),
  __clearCertProfile(). state.isOperator 일 때 CertPage 에 inject
  패널 + 상태 카드 노출.
- 유저는 HTML 다운로드 후 브라우저 ⌘+P 로 PDF 변환 (외부 라이브러리
  없음).

주간 보드 타일 UX — 오늘 vs 완료 구분
- 기존 st === 'today' 와 st === 'done' 이 둘 다 주황 풀칠이라 '오늘
  아직 미인증' Day 가 완료처럼 보이던 버그.
- 'today' → 크림 배경 + 주황 두꺼운 테두리 (비어있는 느낌).
- 'done' → 주황 풀칠 + 흰 체크 점.
- 레전드에도 '오늘 · 미인증' 칸 추가.

State / 지속성
- PERSISTED_STATE_KEYS 에 personal_quiz, personal_quiz_answers,
  __vocabMigrated, cert_profile 추가. 모두 app_state JSONB 내부라
  신규 SQL 마이그레이션 불필요.

후속
- 이전 세션부터 밀려있는 2개만 Supabase SQL Editor 에서 돌리면 됨:
  1. supabase_migration_english_name.sql
  2. supabase_migration_presenter.sql"
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
