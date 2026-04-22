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
    git commit -m "Nickname privacy + checkboard wall fix + quiz pacing + premium scaffolding

영어 닉네임 (풀 롤아웃)
- applyRemoteMemberSummaries: summary.english_name → member.englishName 복사
  (본인은 state.englishName 이 canonical 이라 건너뜀). 서버 RPC 가
  english_name 을 같이 내려주면 체크보드·커뮤니티·멤버 카드에서 peer 도
  영어 닉네임으로 보임.
- ProfilePage: 영어 닉네임 카드 신설 + inline 저장 → saveState immediate →
  Supabase upsert. 기존 멤버도 여기서 세팅 가능.
- 온보딩 + 프로필 placeholder: Gaby → Buddy.
- 커뮤니티 글 렌더: memberByRef(post.user) 로 resolve → displayName/safeInitial
  사용. 옛 글도 자동으로 영어 닉네임으로 보임.

한국어 본명 프라이버시 (peer 에게 숨김)
- 멤버 상세 모달: 큰 타이틀은 영어 닉네임 (영어 없으면 한국어 fallback).
  본명 서브라인은 본인(me) 에게만 '본명 · 이규태' 로 노출. peer 한테는
  nickname 만 보임.
- 체크보드 tooltip: displayName(m) 사용 → peer 는 영어 닉네임만.
- 저장한 커뮤니티 글 리스트: memberByRef 로 resolve → displayName.

체크보드 이름 벽 근본 수정 (PRIO 0)
- 기존: .checkboard-curtain 이 position:absolute 로 .checkboard-wrap 안에
  있었음. 하지만 부모가 overflow:auto 스크롤 컨테이너라 absolute 자식이
  scroll 과 함께 좌로 밀려나면서 벽이 사라지고 sticky 이름이 투명하게
  Day 타일 위를 지나가 버리는 버그.
- 수정: curtain DOM 제거. 대신 .cb-name / .cb-header-name 셀 자체를
  background:#FFFDF7 + border-right + box-shadow 로 각자 불투명한 벽을
  세움. position:sticky 와 함께 항상 붙어있음.

이름 칸 폭 축소
- grid-template-columns name track: 130px → 108px
- .cb-name / .cb-header-name max-width: 130 → 108
- 8자 닉네임 (Brandson 등) 에도 꽉 차도록 타이트.

단어테스트 정답 페이싱
- 정답 감지 debounce: 180ms → 220ms
- flash → advance 간격: 350ms → 950ms
- correctFlashFade animation: 600ms → 900ms (hold 구간 길게)
- DOM 제거 timer: 620ms → 920ms
- 체감: 정답 확인 → 녹색 체크 구경할 시간 → 다음 단어. 약 1.2초.

프리미엄 스캐폴딩 (데이터 + 헬퍼만, UI 다음 커밋)
- CHALLENGE.premium.weekly_meetings: 4주 시나리오 데이터 추가.
  각 주마다 setting/premise/flow/mustUseVocab/presenterPrompt.
  Week 1 Anchor & Line of sight, Week 2 Design review push-back,
  Week 3 Incident triage & blast radius, Week 4 5-slide pitch.
- state.presenterSignups = {} (week_key → [member_keys])
- state.presenter_prep = {} (week_key → {vocabPicked, script, privateNotes})
- state.meeting_notes = {}
- PERSISTED_STATE_KEYS 에 presenterSignups / presenter_prep 추가.
- 헬퍼: PRESENTER_KEY(n), weekMeta(n), isMePresenterInWeek(n),
  presenterSlotsRemaining(n), daysUntilMeeting(dateStr), currentPremiumWeek(),
  memberByKey(key), applyRemotePresenterSignups, loadPresenterSignups,
  requestPresenterSignups, signupPresenter(weekN), releasePresenter(weekN).
- 아직 UI 배선 없음 (PremiumPage 개편 + PresenterPrepPage + 홈 hero +
  floating 🎤 는 다음 커밋).

필수 후속 작업
- Supabase SQL Editor 에서 supabase_migration_english_name.sql 실행
  (아직 안 했으면).
- 프리미엄 관련 RPC migration 은 다음 커밋과 함께."
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
