#\!/bin/bash
# YOUBUDDY 5기 베타 - 커밋 푸시 스크립트
# 실행: bash /Users/gyo/Downloads/youbuddy-challenge-claude/push_to_github.sh
set -e

REPO="/Users/gyo/Downloads/youbuddy-challenge-claude"
cd "$REPO"

echo "==> 1/4 오래된 락 파일 정리..."
rm -f .git/index.lock .git/HEAD.lock .git/index.lock.old .git/index.lock.stale* .git/HEAD.lock.stale 2>/dev/null || true
rm -rf .git/rebase-merge .git/rebase-merge.stale .git/rebase-merge.stale2 2>/dev/null || true
find .git/objects -name "tmp_obj_*" -delete 2>/dev/null || true
find .git -name "*.lock" -delete 2>/dev/null || true

echo "==> 2/4 현재 상태 확인..."
git status --short
git log --oneline -5

echo ""
echo "==> 3/4 origin/main 가져오기 + 병합..."
git fetch origin main
# 이미 local에 커밋 288b3b6이 있고 origin과 diverged 상태.
# merge 전략 (pull.rebase=false) 으로 merge commit 만들어서 둘 다 유지.
git -c pull.rebase=false merge origin/main -m "Merge origin/main (CNAME + uploaded screenshots)" --no-edit || {
  echo "\!\! 병합 충돌이 발생했습니다. project/index.html은 로컬본을 유지합니다."
  git checkout --ours -- project/index.html 2>/dev/null || true
  git add -A
  git commit -m "Merge origin/main (keep local index.html)" --no-edit
}

echo ""
echo "==> 4/4 origin/main 으로 푸시..."
git push origin main

echo ""
echo "✅ 완료\! https://github.com/lifestylebytes/youbuddy_members5"
echo "    youbuddy.co.kr/5th 에 배포되려면 GitHub Pages 설정 확인하세요."
