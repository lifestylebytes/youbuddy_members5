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
    git commit -m "Batch fixes: board sync/sort, premium UX, comments RPC

Daily Streak Board
- Sticky MEMBER column no longer leaks day tiles into the name gap
  (box-shadow extends the cream/orange-ghost bg into the grid-gap zone,
  and z-index raised so sticky stays on top).
- Horizontal scroll position is preserved across the 15-second community
  refresh render — no more snapping back to Day 1 every few seconds.
- Logged-in user ('me') always sits at the very top, regardless of tier;
  the premium → basic ordering now applies to the rest only.
- Peer cells render exact verified days (not 'd <= progress'). Fixes the
  bug where 이규태 verifying Day 2 without Day 1 showed Day 1 orange on
  other viewers' boards. Server RPC now returns verified_days int[].

Premium gating / copy
- Removed mid-challenge '₩169,000 업그레이드' banners everywhere.
  Basic users can enter the Premium tab and see what's inside; actual
  sub-pages (미팅 노트 / 퀴즈 / Certification) show a '이 페이지는
  프리미엄 전용이에요' panel instead of blocking the whole tab.
- 나(프로필) 탭의 tier 카드를 '프리미엄은 이런 게 좋아요' 로 리작성 —
  다음 기수 유도용. Zoom 미팅 / PT / PPT 발표 / 퀴즈 4가지 핵심 혜택
  카드로 표시.
- Premium code 단순화: premium555 로 로그인 가능 (legacy 코드도 backward-compat).
- Modal placeholder '예: YOUBUDDY-PREMIUM-5' → '프리미엄 코드 입력' 로 변경
  (긴 코드 예시가 그대로 답이 되어버리는 문제).

Community comments
- add_community_comment RPC 에 set search_path = '' 추가 + CTE 를
  intermediate jsonb 변수로 묶어서 더 robust 하게 (42P01 / CTE 파싱 회피).
- 클라이언트: RPC 실패 시 로컬에 남긴 _localOnly 댓글이 UI 에 merge 되어
  보이도록 (이전엔 Supabase 연결 중엔 서버 배열만 읽어서 안 보였음).

SQL schema
- get_cohort_member_summaries 반환값에 verified_days integer[] 추가."
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
