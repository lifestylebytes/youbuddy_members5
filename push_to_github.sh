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
    git commit -m "English nickname rollout + checkboard column fix

영어 닉네임 (풀 롤아웃)
- applyRemoteMemberSummaries: summary.english_name → member.englishName 복사
  (본인은 state.englishName 이 canonical 이라 건너뜀). 서버 RPC 가
  english_name 을 같이 내려주면 체크보드·커뮤니티·멤버 카드에서 peer 도
  영어 닉네임으로 보이게 됨.
- ProfilePage: 영어 닉네임 카드 신설. inline 입력 → 저장 시 state.englishName
  업데이트 → saveState({immediate:true}) → Supabase upsert. 이미 온보딩을
  끝낸 기존 멤버 (이지흔/이규태 등) 도 여기서 세팅 가능.
- 프로필 hero: displayName 우선 노출 (영어 > 한국어), 본인 확인용으로
  '본명 · 이규태' 작게 노출.
- 커뮤니티 글 렌더: post.user / post.avatar 대신 memberByRef(post.user) 로
  찾은 member 의 displayName/safeInitial 사용. 옛 글도 자동으로 영어
  닉네임으로 보이게 됨 (글 row 자체는 안 건드림 — 렌더 시 resolve).
- 온보딩 + 프로필 input placeholder: Gaby → Buddy.

체크보드 디자인 수정
- .checkboard grid-template-columns: 96px → 130px (name column)
- .checkboard-curtain width: 113px → 147px (padding 14 + 130 + gap 3)
- .cb-name / .cb-header-name: max-width 130px + box-sizing border-box
  로 sticky 트랙을 강제 클립 (flex content 가 트랙 폭을 넘어
  P 뱃지가 Day1/Day2 타일로 번지던 현상 방지).
- Checkboard() innerHTML: 이름 래퍼 flex 체인에 min-width:0 + overflow:hidden
  + flex:1 1 auto 를 전파시켜 ellipsis 가 실제로 먹히게.

필수 후속 작업
- Supabase SQL Editor 에서 supabase_migration_english_name.sql 실행
  (get_cohort_member_summaries 반환에 english_name 추가).
- 실행 안 하면 '자기 눈에만 영어 닉네임' 상태가 됨."
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
