#!/bin/bash
# YOUBUDDY 5기 — 커밋 + 푸시 스크립트
# 실행:  bash push_to_github.sh   (Mac, 이 폴더 안에서)
#
# ⚠️  landing page (/index.html) 은 커밋에서 제외 (변경 안 함).
set -e

# 스크립트가 있는 폴더 = repo 루트 (경로 하드코딩 X)
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO"
echo "==> repo: $REPO"

echo "==> 오래된 락 파일 정리..."
rm -f .git/index.lock .git/HEAD.lock .git/index.lock.* .git/HEAD.lock.* 2>/dev/null || true
rm -rf .git/rebase-merge .git/rebase-merge.* 2>/dev/null || true
find .git -name "*.lock" -delete 2>/dev/null || true

echo "==> 현재 상태:"
git status --short
git log --oneline -3

# 이번 작업분만 stage. 루트 index.html · 임시 산출물(pdf/json) 은 제외.
echo ""
echo "==> stage: 5th/index.html + final test export SQL + ai-review edge fn + 이 스크립트"
git add 5th/index.html \
        supabase_migration_final_test_export.sql \
        supabase_migration_awards_export.sql \
        supabase/functions/ai-review/index.ts \
        push_to_github.sh

if ! git diff --cached --quiet; then
  echo ""
  echo "==> 커밋..."
  git commit -m "Week4 파이널 테스트 개편 + self-serve 약점퀴즈 + 미팅 단어 랜덤기 + 완주 플로우

[파이널 테스트]
- Week4 = 파이널 테스트 (OX3 + 객관식4 + 빈칸3 채점 + 작문3 무점수). Day1~20 60단어 풀.
- 통과 기준 없이 제출=완료, 점수 표시, 재응시. 답안 draft 보관 → 재렌더에도 안 날아감.
- PDF 다운로드 버튼 → 구글 드라이브 링크. 마감 5/24(일) 21:00 자동 닫힘.
- 결과/다운로드 state 저장(final_test, final_downloads) + 운영자 export RPC.

[홈/대시보드]
- 파이널 완료 배너(다시 풀기) + 4주 학습자료 다운로드 배너 + 다운로드 안내 팝업(PDF·노션·리포트 3버튼).
- PDF까지 받은 완주자 축하 팝업(60어휘/120유의어 + 후기 링크).
- 5/22 18:00 이후 6기 안내 팝업 1회.

[약점 퀴즈 — self-serve 교체]
- 발표 게이팅/4지선다/운영자 주입 의존 제거. '대사 붙여넣기 → 문장당 1빈칸' 단일 플로우.
- 힌트 = 단어별 첫 글자 마스킹(M____ B___). 운영자 패널 복원(JSON 주입/멤버 푸시).

[미팅]
- Week4 미팅(#meeting/m4) hero 아래 단어 랜덤기(전체60/Week4 15 선택) + Google Meet 링크 연결.

[기타]
- 수료 인증/리포트: 프리미엄 주간미팅 4/4, 인증서 '어휘 60개·유의어 120개'.
- 운영자 설정: Day 점프 드롭다운(Day20=마지막날 시뮬레이션).
- 단어집 PDF 설명 문구 정리.

[SQL]
- supabase_migration_final_test_export.sql: get_cohort_final_test(p_cohort) RPC 신규.
  → Supabase Dashboard > SQL Editor 에 붙여넣고 Run 해야 운영자 결과 조회 동작."
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
echo ""
echo "※ 운영자 '파이널 테스트 결과 (JSON)' 버튼을 쓰려면 Supabase SQL Editor 에"
echo "   supabase_migration_final_test_export.sql 한 번 실행하세요."
