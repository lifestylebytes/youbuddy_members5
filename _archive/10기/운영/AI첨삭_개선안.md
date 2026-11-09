# 10기 AI 첨삭 개선안

`AI첨삭_피드백_로그.md` 에 쌓인 10기 멤버 피드백을 보고 정리한 프롬프트 개선 제안.
버디가 읽고 승인한 항목만 `supabase/functions/ai-review/index.ts` SYSTEM_PROMPT 에 반영한다. (이 파일은 제안만, 프롬프트는 안 건드림)
9기 제안 (A)~(O) 는 `_archive/9기/운영/AI첨삭_개선안.md` 참고. 번호는 이어서 (P)부터.

---

## 2026-11-09 (10기 첫 수집 · 10-19 ~ 10-23분 4건)

> 참고: 수집 스크립트가 10기 데이터 형식(`{"0": {...}}`)을 못 읽어서 지금까지 0건으로 나왔다. 스크립트를 고쳐 이번에 처음 잡혔다.

### 1. 오늘 들어온 피드백 요약: 👍 2 · 👎 2

- 제임스 (Give it a shot, 👍): 별도 코멘트 없음. 시제와 어순 교정을 받아들임.
- susu (On the fence, 👍, 10-19): "about과 같이 쓰는 덩어리 형태라는 것을 알게 해줘 좋았다" (전치사 덩어리 설명이 먹힌 사례)
- 진 (No-brainer, 👎, 10-20): "틀렸는데 잘 쓰셨어요 라고 나왔어요."
  원문 "Sending data to PR team is nobrainer" → 교정 "Sending data to the PR team is a no-brainer." / why "띄어쓰기와 관사, 띄어쓰기 교정했어요. 'no-brainer'는 띄어써야 합니다."
- 앤쥐 (Go over someone's head, 👎, 10-23): 교정 내용이 아니라 화면 불만. "라인 바이 라인으로 나와 줄이 너무 길어져서 다시 작성하는 화면으로 스크롤해야 한다, 이전처럼 분할식으로 한 화면에서 보고 싶다."
  덤으로 이 건은 원문 "reach out to his manager" 를 "contact" 로 바꿨다 (아래 패턴 2).

### 2. 반복되는 실패 패턴

- 오류인데 칭찬으로 시작 (진 👎, 톤 불일치): 관사 2개 누락과 no-brainer 하이픈 오류가 있었는데 칭찬 톤의 문구("잘 쓰셨어요")가 같이 나왔다. 멤버 입장에서는 틀린 문장을 두고 칭찬받는 모순으로 읽힌다. why 도 "띄어쓰기"를 두 번 쓰고 실제 변경(관사 the, a, 하이픈)은 제대로 못 짚었다. 하이픈 추가를 "띄어쓰기"라고 부른 것도 부정확하다.
- 구동사를 단어로 바꿈 (앤쥐): 프롬프트에 "follow up -> contact 금지" 가 이미 있는데도 "reach out to -> contact" 가 나왔다. 예시 목록에 있는 동사만 막히고 같은 계열의 다른 구동사는 새는 것으로 보인다. 이 건은 과교정이고 why 도 "더 자연스럽고 명확"이라는 교과서식 사유다.
- UI 불만 (앤쥐): 프롬프트가 아니라 앱 화면 문제다. 아래 (S) 에 따로 정리했다.
- 잘 먹힌 것 (susu): 전치사 덩어리(be on the fence about) 를 짚어 준 설명은 좋은 반응이었다. 이 방향은 유지.

### 3. SYSTEM_PROMPT 수정 제안 (버디 승인 시 반영)

(P) STEP 3 "Never swap one correct word..." 줄의 "follow up -> contact" 뒤에 예시를 늘리지 말고 규칙을 일반화하는 문장을 추가 (구동사 누수 방지):

```
This rule covers EVERY phrasal verb and idiom, not only the examples listed: reach out to -> contact, look into -> investigate, come up with -> devise, touch base -> communicate, loop in -> inform. If the student's phrasal verb is natural, keep it and change nothing about it.
```

(Q) HARD RULES 의 "why" 규칙(111~117행 부근) 끝에 추가 (칭찬/오류 톤 일치, 용어 정확도):

```
- TONE MATCHES VERDICT. When verdict is "fixed", NEVER open "why" with praise such as "잘 쓰셨어요" or "훌륭해요". Start with what changed ("관사 the, a 를 넣었어요"). Praise belongs in "feedback" only when the main meaning was already right, and then it must come AFTER the correction, never replace it.
- Name edits by their real type: adding or removing a hyphen is "하이픈", adding an article is "관사 추가", a space is "띄어쓰기". Do not call a hyphen fix "띄어쓰기". Never repeat the same word twice in one "why".
```

(R) 복합어 처리용 한 줄을 STEP 2b TARGET PHRASE USAGE 에 추가 (no-brainer 같이 하이픈이 필요한 타깃):

```
- Hyphenated target phrases (no-brainer, kick-off, follow-up, state-of-the-art) must keep their hyphen when used as nouns or adjectives. A missing hyphen or a fused spelling ("nobrainer") is a real error: verdict "fixed", restore the standard spelling, and name it in "why".
```

(S) (앱 화면, 프롬프트 아님) AI 리뷰 결과가 line by line 으로 길어져 입력 화면과 오가며 스크롤해야 한다는 불만이다. 결과 영역을 입력창 옆에 두는 분할식, 또는 접이식(교정문만 먼저 보이고 changes 와 deep 은 펼치기) 로 바꾸는 방안이 있다. 어느 쪽이 좋을지는 버디가 정해 주면 화면 쪽 개선안을 따로 쓰겠다.
