#!/bin/bash
# YOUBUDDY 5기 베타 — 커밋 + 푸시 스크립트
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
git add 5th/index.html push_to_github.sh supabase_migration_meeting_consent.sql

if ! git diff --cached --quiet; then
  echo ""
  echo "==> 변경 사항 커밋..."
  git commit -m "프리미엄 미팅 녹화/분석 사전 동의 팝업 (개인정보보호법 v2) + 운영자 감사 모달

(A) Meeting Consent Modal v2 — 한국 개인정보보호법 준수
- 제15조 필수 4항목 모두 명시: 수집 항목 / 수집·이용 목적 / 보유·이용 기간
  / 동의 거부권.
- 제23조 생체정보(얼굴·음성) 별도 동의 — 체크박스 '(필수) 생체정보 수집·이용 동의'.
- 제26조 처리위탁 수탁자 공개 — Google LLC(Meet 녹화) / Anthropic(AI 분석)
  + 체크박스 '(필수) 처리 위탁 동의'.
- 두 체크박스 모두 체크돼야 '동의하고 계속' 버튼 활성화 (JS disabled/opacity 토글).
- 개인정보 보호책임자 명시: 유버디 · youbuddy.co@gmail.com.
- CONSENT_VERSION 1 -> 2 승격 -> v1 동의자도 법적으로 강화된 v2 로 재동의 유도.

(B) 프리미엄 탭 진입시에도 팝업 자동 오픈
- PremiumPage() 상단에 동의 가드 추가. MeetingNotesPage 안 거치고
  바로 Google Meet 링크로 입장하는 멤버도 반드시 팝업을 보게 됨.
- premium tier + 미동의 + 모달 미오픈 모두 만족할 때만 setTimeout(250) 으로
  오픈 -> render 루프 방지.
- MeetingNotesPage 의 기존 가드도 유지 (이중 안전장치).

(C) 운영자 면제 해제
- isOperator/isStaff 도 팝업 대상. 본인도 프리미엄 참가자라 녹화됨 + QA 가능.
- 설정 > OPERATOR ONLY > '내 동의 초기화 (테스트용)' 버튼 추가 ->
  팝업 다시 보고 싶을 때 원클릭 리셋. 내 현재 상태(동의/미동의 + 시각)도
  인라인 표시.

(D) 운영자 감사 모달 (Consent Audit)
- 설정 > OPERATOR ONLY > '미팅 동의 감사 · 동의 현황 열기'.
- 프리미엄 9명별 동의 여부 + 시각 + 버전 리스트. 초록 도트=동의, 회색=대기.
- 서버 RPC get_cohort_consent_audit (supabase_migration_meeting_consent.sql)
  에서 app_state->'meeting_consent' JSONB 필드 추출해서 flat row 로 반환.
- RPC 미적용 시 toast 로 migration 적용 안내.

(E) 상단 재유도 배너
- 모달 '나중에' 로 닫은 premium 유저에게 MeetingNotesPage 상단에 일관된
  배너 표시 ('미팅 녹화/분석 동의가 아직 없어요 · 자세히 ->').
- 클릭시 모달 재오픈.

(F) State + 퍼시스턴스
- defaultState.meeting_consent = null 추가.
- PERSISTED_STATE_KEYS 에 'meeting_consent' 추가 -> upsert_member_app_state
  로 서버 자동 동기화.
- 기록 구조: { accepted, at(ISO), version, tz, memberKey, memberName,
  englishName, consents: { biometric, delegation } }.

(G) SQL 마이그레이션 (신규)
- supabase_migration_meeting_consent.sql: get_cohort_consent_audit(p_cohort)
  RPC 생성. SECURITY DEFINER + STABLE.
- 실행 방법: Supabase Dashboard > SQL Editor 에 파일 붙여넣기 > Run.

(이전 staff toggle + avatar color fix 커밋들도 함께 올라감.)"
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
