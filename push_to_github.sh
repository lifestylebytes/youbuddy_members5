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

# 5th/index.html + push_to_github.sh 만 stage. 루트 index.html 은 제외.
echo ""
echo "==> 5th/index.html + push_to_github.sh stage..."
git add 5th/index.html push_to_github.sh

if ! git diff --cached --quiet; then
  echo ""
  echo "==> 변경 사항 커밋..."
  git commit -m "5기 실명단 + 팀 제거 + IP 경고 + 완주 선물 카피 + 온보딩 미리보기 + Week1 발표 제외 + swipe/back 가드

브라우저 back 가드 (native back gesture 가 페이지를 꺼트리는 문제)
- setupHistoryGuard: history.pushState 로 'active' 센티널 엔트리를
  항상 1개 추가 유지. 사용자가 네이티브 back 제스처 (iOS/안드로이드/
  맥 트랙패드) 를 쓰면 'base' 로 떨어지며 popstate 발생 → SPA 내부
  goBackRoute() 실행 + 'active' 센티널 재주입.
- 설정 모달 / 멤버 카드 / 프리미엄 게이트가 열려있으면 그것부터 닫기.
- 기존 setupSwipeNavigation (터치/포인터) 은 그대로 유지.

Week 1 발표자 선착순 제외
- Week 1 은 전원 자기소개 / 아이스브레이킹 주 → noPresenter: true.
- signupPresenter RPC guard + weekHasPresenter(n) helper.
- PremiumPage 주차 카드 → '✨ 발표 없음 · 전원 자기소개' + '말할 거리'.
- Home 이번 주 hero → noPresenter 주는 '발표 없음' 상태로 렌더링,
  클릭시 meeting-notes 로 바로 이동.
- Floating 🎤 FAB → noPresenter 주 동안은 숨김 처리.
- 온보딩 튜어 Step 3 (Presenter): '4주 중 1주' → 'Week 2~4 중 1주',
  'Week 1 은 전원 자기소개 주간' 문구 추가.

5기 실명단 (37명)
- Premium 8명 (code 01~08): 김소영, 손미경, 이수진, 정주혜,
  이도현, 이송아, 정지은, 김정인.
- Basic 29명 (code 09~37): 고민지, 박연, 장희정, 이유빈, 박보름,
  김선영, 신은선, 최보라, 백수지, 정진송, 권다희, 강태윤, 최수지,
  이정은, 정송하, 김수린, 진여송, 권지선, 윤수정, 양은지, 임혜연,
  조예지, 고주영, 신지현, 김지현, 신지은, 임정연, 허윤형, 이지유.
- 운영자(op1) 이름 '유버디' → '운영자'.
- 테스트 흔적 (이규태 u24, 이지흔 u25, 모모 u26) 제거.
- 코드 lookup: '01' / '1' 둘 다 로그인 되게 정규화.

팀 A/B 제거
- MEMBER_DIRECTORY 에서 team 필드 삭제.
- 커뮤니티 포스트 헤더 '· A' 꼬리표 제거.
- myTeam() 내부 fallback 은 'A' 고정 (데이터 호환).

IP / 저작권 경고
- 5th 온보딩 STEP 4 하단에 'COPYRIGHT · IP' 박스 추가:
  '이 챌린지는 유버디가 개인적으로 기획·개발한 콘텐츠입니다.
  구성·단어 큐레이션·워크플로를 유사하게 복제·재배포할 경우
  법적 조치 대상이 될 수 있어요.'

완주 선물 카피 (Basic Step 4 팝업 튜어)
- '수료증 발급' → '완주 기준 18/20 · 이번 기수 단어장 PDF +
  완주 배지 + 6기 얼리버드 쿠폰'.
- 아이콘 🎓 → 🎁.

Basic Step 3 팝업 튜어
- '같이 도는 버디들' → '함께하는 버디들'.
- '표현을 훔쳐가세요. 저장 → 내 단어장으로 쌓이고, 수료증까지
  따라와요.' → '표현을 저장해보세요. 저장 → 내 단어장(나만
  보여요!)으로 쌓인답니다.'

운영자 전용 — 온보딩 팝업 미리보기
- 설정 모달 OPERATOR ONLY 섹션에 'Basic 로 플레이 (5스텝)' /
  'Premium 로 플레이 (6스텝)' 버튼 추가.
- 클릭 시 state.tier 를 임시로 flip + tour_done=false → 설정 모달
  닫고 실제 멤버가 보는 오버레이 그대로 재생.
- completeOnboardingTour 에서 운영자 원본 tier 복구 (window.
  __operatorOriginalTier 임시 저장).

챌린지 일정 이동
- start_date 2026-04-20 → 2026-04-27 (월), end_date 2026-05-15
  → 2026-05-22 (금). 주간 미팅 Thursday 4/30·5/7·5/14·5/21 그대로.

기타 UI 문자열 정리
- 온보딩 이름 placeholder '유버디' → '예: 홍길동'.
- get_cohort_member_summaries 콘솔 경고 / 본명 서브라인 주석 /
  ?reset=1 주석 등 이규태·이지흔·유버디 멤버 흔적 중립화.

후속
- supabase_migration_english_name.sql 과
  supabase_migration_presenter.sql 은 여전히 SQL Editor 에서 실행
  필요 (이전 커밋 후속).
- 메인 index.html (IP 경고 띠 + 샘플 단어 섹션) 은 buddy 지시
  전까지 커밋 보류."
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
