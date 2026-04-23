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
  git commit -m "Week1 미팅노트 OT 구조 + 내 아바타 주황 고정 + signup_presenter advisory lock

Week 1 미팅 노트 = OT (발표 없음)
- MeetingNotesPage presenter slot 렌더링을 meta.noPresenter 체크 뒤로.
  Week 1 에서는 3개 presenter slot UI 가 전부 사라짐.
- 'roleplay' 행을 meta.noPresenter 면 '👋 오리엔테이션 & 자기소개' 로 타이틀/본문/
  placeholder 재렌더. 70분 자리 전부 OT 가 차지.
- Scenario 헤더도 noPresenter 면 '🎬 SCENARIO' → '📋 오늘의 안건' 으로 전환.

Week 1 실제 안건 반영 (weekly_meetings[0])
- scenario.setting/premise/flow → 챌린지 소개 · 유버디 소개 · 1분 자기소개 ·
  PT 진행 방식 안내 · 다음주 롤플레이 방식 안내 · Q&A.
- roleplay.duration 40 → 70, roles 2개 (유버디 호스트 / 모든 멤버),
  beats 6개 (0–10 챌린지 소개 / 10–20 유버디 소개 / 20–45 1분 자기소개 /
  45–55 PT 안내 / 55–65 롤플레이 안내 / 65–70 Q&A).
- props 3개 (1분 자기소개 템플릿 · PT 자리 잡는 법 · 질문 모음 아이디어).
- qaPrompts 도 실질 질문 (완주 기준 · Daily 시점 · 자료 포맷) 으로 갈아끼움.

내 아바타 주황 고정
- resolveAvatarColor: member.me 면 member.color 참조 없이 무조건 'orange' 반환.
  유버디/운영팀으로 로그인해도 본인 카드 프사는 프리미엄 주황. 보드에서
  남이 볼 때는 isOperator 분기로 여전히 ink.

supabase_migration_presenter.sql — v_count 에러 수정
- signup_presenter / release_presenter 에서 'set search_path = ''' 제거.
  (plpgsql 변수 해석이 이 세팅이랑 충돌하면서 'relation v_count does not exist'
  에러 재현). 변수명도 v_* → cur_* 로 이름 충돌 가능성 완전 제거.
- 'SELECT count(*) FROM (... FOR UPDATE)' 서브쿼리 패턴 폐기.
  대신 pg_advisory_xact_lock(hashtextextended(cohort||':'||week, 42)) 로
  (cohort, week) 단위 트랜잭션 락. 3자리 hard limit race 는 그대로 방지.
- 모든 내부 쿼리에서 's.' alias 참조 제거 (단일 테이블에서 불필요).

기타 (이전 커밋에 미포함)
- supabase_reset_staff.sql: 운영팀/유령 계정 (유버디·이규태·이지흔·모모·
  '운영자') 의 challenge_member_state / verification_events / presenter_signups /
  community_posts/comments/likes 데이터를 to_regclass 가드로 안전 리셋.

후속
- supabase_migration_presenter.sql 과 supabase_reset_staff.sql 은
  여전히 SQL Editor 에서 Run 필요 (v_count 에러 fix 된 버전)."
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
