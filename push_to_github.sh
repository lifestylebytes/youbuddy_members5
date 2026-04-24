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
  git commit -m "체크보드 회색 처리 + Week 2~4 잠금 + Basic Weekly dim

체크보드 회색 처리
- '가입 완료' = challenge_member_state 에 row 존재 (온보딩 끝내고 대시보드 진입).
  모두가 서로 누가 아직 앱 안 깐지 보이게. RPC 추가 없이 기존
  get_cohort_member_summaries 응답으로 판정.
- bindMeToMembers: 본인 row registered=true 고정 (앱 쓰는 중 = 항상 까맣).
- applyRemoteMemberSummaries: 매치되는 멤버마다 registered=true + changed 플래그.
- loadMemberSummaries: 첫 응답 성공시 window.__registeredLoaded=true (플래시 방지).
- .cb-name.is-unreg CSS: color 0.32 + 아바타 opacity 0.45 + grayscale 0.6.
- Checkboard row: isUnreg = __registeredLoaded && !me && !registered (staff
  제외 빠짐 — 이규태/이지흔 도 로그인해야 까맣게. me 만 예외).

Week 2~4 주차 잠금
- isWeekUnlocked(n): Week 1 항상 열림. Week N 은 Week N-1 미팅 다음 날 (금)
  00:00 부터 열림. (Week 2 → 5/1, Week 3 → 5/8, Week 4 → 5/15.)
- weekUnlockDateLabel(n): '5/1(금)' 포맷 for 버튼 레이블.
- PremiumPage CTA 체인: 베이직 preview 뒤, iAmPresenter 전에 locked 브랜치
  추가. '🔒 5/1(금) 열림' disabled 버튼. 카드 opacity 0.55 로 dim.
- 라우터 가드: 'presenter-prep' 과 'meeting-notes' 진입 시 주차 추출해서
  isWeekUnlocked false 면 토스트 + PremiumPage 리다이렉트. meetingId 포맷
  'week{N}-{date}' 또는 'm{N}' 둘 다 파싱.

Basic 의 Premium 탭 Weekly meetup 섹션 blur
- 베이직 사용자는 주간 미팅 섹션 전체 (타이틀 + 미팅 카드 스택) 를
  filter: blur(9px) + saturate 0.85 로 읽히지 않게 블러 + pointerEvents none.
- absolute overlay 로 '🔒 PREMIUM ONLY · 주간 미팅은 프리미엄 전용 ·
  다음 기수에서 만나요' 배지를 가운데에 선명하게 띄움 (backdrop-filter
  blur 4px 로 배경 살짝 더 흐리게).
- Personal Quiz / Certification 카드는 블러 바깥에 별도 렌더 → 베이직도
  정상 접근 가능.

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
