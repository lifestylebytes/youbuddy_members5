# 앱 TODO · 나중에 (급하지 않지만 잊으면 안 되는 것)

## 학습 앱 (8th/index.html)

- [ ] **저장한 단어·예문 내보내기** (2026-08-21 버디 요청)
  - 지금은 단어장(MY WORD DECK)에 모이기만 하고 밖으로 못 꺼냄.
  - 목표: 단어/유의어/예문/동료 문장 전체를 텍스트·CSV·노션 붙여넣기용으로 복사.
  - 참고: 바로 위 카드인 `MY SCRIPTS · 내 대본 모음, Notion 내보내기` 가 이미 같은 패턴을 씀.
    그 UI·복사 로직을 그대로 재활용하면 됨.
  - 위치 후보: 단어장 카드 우측 상단 (지금 북마크 아이콘 옆 빈 공간, 버디가 화면에 표시함)

- [ ] **유의어 + 유의어 예문 AI 음성** (2026-08-21 버디 요청, 후순위)
  - 현재: 데일리 단어·예문 90클립만 mp3 (Day 6~20). 유의어·유의어 예문은 기계 음성(speechSynthesis).
  - 추가 대상: 유의어 120 + 유의어 예문 120 = 240클립. 비용 1~2달러 수준.
  - 방법: `tools/generate_tts.mjs` 를 확장해 SYN_EXAMPLES 도 순회하게 만들고,
    파일명 규칙 정한 뒤 (`syn-d{N}-{i}-{0|1}.mp3`, `syn-d{N}-{i}-{0|1}-ex.mp3`)
    `playAiVoiceOrFallback` 이 유의어 카드에서도 mp3 를 먼저 찾게 연결.
  - 실행은 버디가 `OPENAI_API_KEY=... node tools/generate_tts.mjs` 로.

## 상세페이지 (youbuddy-detail-page/index.html)

- [ ] 9기 가격 확정되면: 대기 등록 모드의 "9기 가격 조정 중" 자리에 실제 금액 복원
  (`renderWaitlistState` 안 `data-price-tbd` 블록 제거 + `.pricing-price` 숨김 해제)
- [ ] 9기 모집 개편 아이디어 (시장조사 결론): 완주율·수료 통계를 첫 화면에 ·
  "이런 수업이에요/아니에요" 섹션 · BEFORE/AFTER 후기 포맷 · 정원 한정 희소성
