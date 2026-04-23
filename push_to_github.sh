#!/bin/bash
# YOUBUDDY 5기 베타 - 커밋 + 푸시 스크립트
# 실행: bash /Users/gyo/Downloads/youbuddy-challenge-claude/push_to_github.sh
#
# ⚠️  landing page (/index.html) 은 buddy 명시 허락 전까지 커밋에서 제외.
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

# 5th/index.html + SQL 파일 + push_to_github.sh 만 stage. 루트 index.html 은 제외.
echo ""
echo "==> 5th/index.html + SQL 마이그레이션 + push_to_github.sh stage..."
git add 5th/index.html push_to_github.sh supabase_migration_presenter.sql supabase_reset_staff.sql

if ! git diff --cached --quiet; then
  echo ""
  echo "==> 변경 사항 커밋..."
  git commit -m "체크보드 회색 처리: 온보딩 미완료 멤버 grey-out

'가입 완료' = challenge_member_state 에 row 존재 (= 온보딩 끝내고 대시보드
한 번이라도 본 사람). 모든 멤버가 서로 누가 아직 앱 안 깐지 보이게. RPC
추가 없이 기존 get_cohort_member_summaries 응답으로 판정.

- bindMeToMembers: placeholder/real 본인 row registered=true 고정.
- applyRemoteMemberSummaries: 매치되는 멤버마다 registered=true + changed.
- loadMemberSummaries: 첫 응답 성공시 window.__registeredLoaded=true (플래시 방지).
- .cb-name.is-unreg CSS: color 0.32 + 아바타 opacity 0.45 + grayscale 0.6.
- Checkboard row: isUnreg = __registeredLoaded && !me && !registered && !isStaff.
  Staff (유버디/이규태/이지흔) 는 reset 이후에도 까맣게.

(이전 커밋 f4681f6 = SQL v5 := assignment fix 도 이 푸시에 함께 올라감.)"
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
