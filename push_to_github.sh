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
  git commit -m "프리미엄 9명 (권다은 추가) + 모바일 모달 스크롤 + 타임라인 여백 축소 + 스와이프 네비 비활성화 + 발표자 3명 노트 통합 + 주차별 회의록↔내 노트 연결 + 주차 잠금 타임존 보정

(A) 모바일 모달 스크롤 픽스 — 설정 팝업 저장/취소 버튼 못 누르던 버그
- .modal-backdrop: overflow-y:auto + overscroll-behavior:contain
  + -webkit-overflow-scrolling:touch.
- .modal: max-height: calc(100dvh - 40px) + 자체 overflow-y:auto
  (100vh 폴백 포함 · iOS Safari 대응).
- body.modal-open 클래스 추가 (overflow:hidden + touch-action:none).
- render(): 모달 (settings/goal/premium-gate/member-card/verification-review)
  열려있으면 body.modal-open 자동 토글. 뒷 페이지 스크롤 잠겨서
  모달 내부 스크롤이 터치 이벤트 가져감.

(B) MeetingNotesPage 발표자 3명 → 단일 통합 슬롯
- state.meeting_notes[mid].timeline 구조 재편: roleplay/s1/s2/s3 →
  roleplay/presenters. 40~70 30분 구간을 한 row 로.
- 카드 상단 발표자 pills 3개 (ME / 이름 / 🪑 빈 자리) — 시각적으로
  누가 발표하는지 보이되, 입력은 하나의 textarea.
- placeholder 에 [1]/[2]/[3] 구획 예시. 발표 연달아 듣는 중에 한
  페이지에 받아쓰게. 표현 칩도 세 명 공통 통합.
- 데이터 마이그레이션: 기존 s1/s2/s3 에 적어둔 거 있으면
  '[발표자 #1]... [발표자 #2]...' 식으로 합쳐서 presenters.notes 로 이관.
  중복 safe 가드. 레거시 키는 복구 대비 보존.
- rolledRaw(AI) + 표현 harvesting + PitchPrepPage '노트 있음' 체크도
  새 키 + 레거시 둘 다 훑음.

(C) PitchPrepPage 주차별 회의록 ↔ 내 미팅 노트 연결
- 각 주차 recap 카드에 '📝 내 미팅 노트 →' 버튼 추가. 클릭시
  window.__currentMeetingId = m\${n} 후 go('meeting-notes').
- 본인 노트 있으면 강조 톤 (흰 배경 + 퍼플 테두리), 없으면 연한 톤
  + '빈 노트 열기'. '📎 PT 발표자료 →' 와 한 줄 pill 배치.
- 공식 회의록 미업로드 주차 footer 문구: '내 미팅 노트는 지금도 쓸 수 있어요'.

(D) 내 학습 주차 잠금 타임존 보정
- _kstUnlockMs → _userTzUnlockMs: effectiveTimezoneOffsetMinutes() 로
  유저 본인 시차 기준 다음날 00:00 unlock 계산.
- weekUnlockDateLabel: '한국시간 00시' → '내 시간 00시'.
- Day 인증/미인증/오픈 + Week 언락 모두 유저 로컬 시간 기준 통일
  (해외 거주 멤버 대응).

(E) Settings — 시차 가입시 고정, Operator 만 편집 가능
- 일반 유저: readonly 박스 + '가입 후에는 고정' 안내.
- Operator: 편집 input + '· OPERATOR 편집 가능' 배지.
- Save 핸들러 operator 가드 — 비운영자는 timezone 업데이트 skip.
- Onboarding: 브라우저 자동 감지 pre-fill + '본인이 수정할 수 없어요' 고지.

(G) 프리미엄 추가 — 권다은 (kde120184@gmail.com)
- MEMBER_DIRECTORY 에 { code: '45', id: 'p9', name: '권다은', tier: 'premium' } 추가.
- 프리미엄 8명 → 9명. 실참가자 총원 주석 38 → 39 (paidMembers 는 동적이라 자동).
- 접속코드 45. ONBOARD_CODE_MAP 은 MEMBER_DIRECTORY 에서 파생돼 자동 등록.

(H) Operator 전용 피어 카드 본명 노출 + 시차 가입 안내 강화
- MemberCardModal: viewer 가 state.isOperator=true 면 피어 카드에도
  '본명 · ○○○' subline 표시. 일반 유저는 기존대로 프라이버시 유지.
- Onboarding 시차 input: 방향(±) 자주 헷갈려서 안내 박스 추가 —
  '한국 = +0h, 빠르면 +, 느리면 −' + 시드니/베이징/LA/뉴욕 예시.

(F-1) MeetingNotesPage 모바일 타임라인 좌측 여백 축소
- .tl-rail / .tl-stem 클래스 도입. 기본 62px/12px.
- @media (max-width:480px): rail 62→40, stem 12→10, row gap 12→8,
  .page padding 좌우 20→14. 시간 라벨 폰트도 살짝 축소 (10→9.5).
- 좁은 아이폰 화면에서 카드 가로폭 약 30~40px 더 확보 → 가독성 ↑.

(F-2) 커스텀 스와이프 네비게이션 비활성화
- setupSwipeNavigation → early return (no-op).
- 이유: (a) 웹 마우스 드래그시 전/후 페이지 휙휙 전환, (b) iOS 터치
  스와이프시 브라우저 네이티브 back 과 충돌 → navBackStack 의 오래된
  경로로 점프.
- setupHistoryGuard 의 popstate: 모달 있으면 모달만 닫고, 없으면 제자리
  유지 (navBackStack pop 안 함). 앱 내 back 은 상단바 버튼으로만.

(F) UX 다듬기
- MeetingNotesPage 상단 '💾 저장' 라벨 버튼 (☁️ 작은 아이콘 대체),
  하단 sync bar 제거.
- .md 내보내기 섹션: 'Notion 으로 옮기기' 목적 설명 + 📋 복사 / ⬇️
  파일 받기 두 버튼 (.md 모르는 프리미엄 유저 배려).
- Cert 페이지 info 에서 'Gaby' 언급 제거.
- Premium Week 잠금은 원복 유지 (잠금은 '내 학습' 경로만).

(이전 커밋들 + SQL v5 assignment fix 도 함께 올라감.)"
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
