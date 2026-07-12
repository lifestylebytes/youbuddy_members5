# 유비챌 7기 현황 인수인계 (HANDOFF)

새 세션(Dispatch 등)에서 이 프로젝트를 이어받을 때 가장 먼저 읽는 문서.
루트의 CLAUDE.md (전역 규칙·말투) 와 함께 읽을 것. 마지막 갱신: 2026-07-12 (Day 1 전날).

## 지금 상태 한 줄

7기 (2026-07-13 월 ~ 08-07 금, 평일 20일) 런칭 준비 완료. 멤버 41명 등록
(프리미엄 10 + 베이직 31, 코드 03~43). 단어 v3 개편 완료. 남은 건 아래 TODO.

## 핵심 파일 지도

- 앱: `7th/index.html` (단일 파일 SPA, 6th 는 절대 수정 금지 원칙 아님, 단 5th 는 커밋 금지)
- 단어 원본: `_archive/7기/단어집/7기_단어_데이터_v3.json` (v3 = 최신. v2 는 폐기본)
- 공지 대본: `_archive/7기/공지대본/7기_온보딩_공지.md` (공지 1~5)
- 유버디 메시지: `_archive/7기/공지대본/7기_유버디_메시지.md` (Day 1~20, 유버디 말투 완성본.
  모닝 공지 스킬이 매일 해당 Day 를 슬랙에 자동 첨부)
- 미팅 대본: `_archive/7기/미팅대본/7기_Week1_미팅_영어대본.md` (W2~4 는 아직)
- 운영 문서: `_archive/7기/운영/` (재발방지_노트, 8기_백로그, 영상 검수리스트, 입장코드 xlsx=커밋금지)
- QA 스크립트: `_archive/스킬/qa-scripts/` (단어 바꾸면 sim_quiz + audit 필수, README 참고)
- AI 첨삭 서버: `supabase/functions/ai-review/index.ts` (수정 시 재배포 필요)

## 작업 규칙 (필수)

1. 수정 후 검증 3종: vm 파스 체크 + em dash 검사 `grep -c $'\u2014' 파일` 0건 + (단어 수정 시) qa-scripts 시뮬레이션
2. 커밋은 Claude 가, push 는 운영자(Buddy)가 직접 (이 환경엔 GitHub 인증 없음)
3. 멤버 이름 든 PNG/PDF/xlsx 커밋 금지 (.gitignore 처리돼 있음)
4. 카톡 문구는 CLAUDE.md 의 유버디 말투 노트 따르기
5. git 은 한 번에 한 세션에서만 (lock 충돌)

## 열려있는 TODO

- [ ] 7기 단어집 PDF 를 구글 드라이브에 올리고 앱의 driveUrl 2곳 교체 (현재 6기 링크,
      코드에 TODO(7기) 주석 있음. 8월 초 전까지만)
- [ ] D17(연봉협상)·D18(협조요청) 보상 영상 재큐레이션 (단어 개편으로 테마 어긋남, 8/3 전)
- [ ] W2~4 프리미엄 미팅 대본 개정 (각 주 시작 전: 7/23, 7/30, 8/6)
- [ ] Week 2~4 미팅 노트 잠금 해제: 7th/index.html 의 __MEETING_OPEN_MAX_WEEK 숫자 올리기
- [ ] 스태프(Lehn·Rice) 시작 전 테스트 인증 데이터 서버 리셋 여부 결정
- [ ] AI 첨삭 edge function 재배포 확인 (verdict + 3분류 feedback 반영본)

## 자동화 (예약 태스크, 전부 7기 설정 완료)

- 평일 06시 모닝 카톡 공지 (+ 유버디 메시지 첨부) / 07시 인증 브리핑 → 슬랙 #01
- 월요일 07:30 주간 카드 / 화요일 07시 운영 브리핑
- 7/24, 7/31 금요일 아침 Week 2·3 회고 체크리스트

## 주요 링크

- 앱: https://youbuddy.co.kr/7th/ · 프리미엄 설문: https://tally.so/r/gDrGA4
- 미팅 캘린더: https://calendar.app.google/sZgHuvurLQH2H6Vx7 (목 21:00 x 4회)
- 카톡 채널: http://pf.kakao.com/_ExdxcGX · 슬랙 공지 채널: #01 (C0AGAMHQCMB)
