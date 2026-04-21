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
    git commit -m "Batch fixes: dirty submit, sentence count, cb-name click, comment CRUD, tier preview, team hide, verified_days warn

UX
- 제출 버튼 dirty-aware: 제출 후 textarea 수정하면 주황 '다시 제출하기'
  로 전환, 원본과 같아지면 초록 '제출 완료'로 복귀.
  (state.submitted_text[key] 스냅샷 비교 + input 이벤트로 실시간)
- '나' 탭 문장 수 필터: /^d\\d+-\\d+$/ 로 hook-* 키 제외해서 6개 → 3개 정상화.
- Daily Streak Board cb-name 클릭 → MemberCardModal 열기 (리더보드 삭제
  이후 다른 멤버 프로필 진입 경로 복구).
- Team A/B 라벨 전면 제거: ProfilePage hero, CommunityPage 게시글 row,
  MemberCardModal 까지 '기수만 표기' 로 통일.

커뮤니티 댓글 수정/삭제
- 본인 댓글(member_key 일치)에만 수정/삭제 버튼 노출.
- __editCommunityComment / __deleteCommunityComment 핸들러 + RPC
  (update_community_comment / delete_community_comment) 연결.
  실패 시 toast 로 에러 표시, 로컬 전용 댓글은 로컬 제거만.

티어 프리뷰
- state.tierOverride 신설 (+ PERSISTED_STATE_KEYS). 'basic' 으로 설정되면
  로그인/리프레시/온보딩 이후에도 premium 멤버를 basic 으로 강제.
- __resetTier → basic 프리뷰 진입, __restoreTier → 원래 티어 복귀.
- ProfilePage 티어 카드에 '프리미엄으로 복귀' 버튼 노출 (isBasicPreview).

이규태 Day 2 싱크
- loadMemberSummaries 에 1회성 console.warn 추가:
  get_cohort_member_summaries RPC 가 verified_days 를 안 돌려주면
  콘솔에 SQL 마이그레이션 필요 경고 → 운영자가 즉시 인지 가능.

SQL
- add_community_comment: jsonb intermediate 변수 삭제, INSERT ...
  RETURNING INTO 스칼라 6개로 교체 → Supabase editor + search_path=''
  환경에서 발생하던 42P01 (v_result 파서 버그) 회피.
- update_community_comment 신규: 본인 member_key 가드 + RETURNING INTO
  스칼라 패턴.
- delete_community_comment 신규: get diagnostics row_count 로 affected
  반환, anon/authenticated 에 grant."
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
