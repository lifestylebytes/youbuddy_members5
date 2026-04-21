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

# If there are staged or unstaged SQL changes, auto-commit them.
if ! git diff --cached --quiet || ! git diff --quiet; then
  echo ""
  echo "==> 변경 사항 커밋..."
  git add -A supabase_hourly_completion.sql supabase_backup_restore.sql 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "Fix SQL parser 42P01: set search_path = '' instead of = public

Supabase's SQL editor was parsing \`set search_path = public\` with a
bare identifier as a relation reference, producing
  ERROR: 42P01: relation \"public\" does not exist

Switching to the empty-string form (\`set search_path = ''\`) avoids
the identifier path entirely. All table references in these files
are already schema-qualified with \`public.\`, so resolving against
an empty search_path is safe.

Files updated:
- supabase_hourly_completion.sql (11 occurrences)
- supabase_backup_restore.sql (5 occurrences)"
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
