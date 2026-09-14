# 9기 AI 첨삭 개선안

`AI첨삭_피드백_로그.md` 에 쌓인 멤버 피드백을 보고 정리한 프롬프트 개선 제안.
버디가 읽고 승인한 항목만 `supabase/functions/ai-review/index.ts` SYSTEM_PROMPT 에 반영한다. (이 파일은 제안만, 프롬프트는 안 건드림)

---

## 2026-09-14 (Day 1 · Kick off / Pick someone's brain)

### 1. 오늘 들어온 피드백 요약: 👍 9 · 👎 0

전부 👍. 반복해서 칭찬받은 건 (a) 메일/회의 두 버전 (variants), (b) 문법 맞고 틀림을 같이 보여주는 것, (c) 빠르고 구체적.

대표 사례:
- Yujin (Kick off): "구체적이어서 너무 좋아요!! 메일/회의 둘 차이가 궁금했었는데 기능으로 딱 있어서 놀랐어요"
- Brad (Pick someone's brain): 원문 "As I'm not used to take this work, could I pick someone's brain?" → "Since this is my first time handling this task, could I pick someone's brain for some advice?" / "상황 마다 볼 수 있어서 좋네요"
- Hera (Pick someone's brain): "Could I pick your brain on this revise" → "...about this revision?" / 전치사 + 품사 교정을 정확히 짚음

### 2. 👍 인데도 리뷰 내용을 보면 걸리는 것 (멤버는 만족했지만 AI 가 틀린 건)

멤버가 👎 를 안 눌렀다고 리뷰가 다 맞은 건 아니다. 9건 원문·교정·why 를 직접 대조하면 3건이 문제.

| 멤버 | 문제 | 분류 |
|---|---|---|
| Skyler | 원문 "Let's kick by sharing the presentation materials first" 에 **off 가 빠졌는데** 그대로 verbatim + "이미 충분히 자연스러워요!". 타깃 표현 자체가 깨진 걸 못 잡음. | 표현 오용을 못 잡음 (가장 심각) |
| Chloe (Pick brain) | 원문 "I hope the person who can give me good advice can pick my team leader" 를 "I hope I can pick my team leader's brain..." 로 **크게 고쳐놓고** why 는 "이미 자연스러워요! 그대로 가셔도 됩니다." | corrected 와 why 불일치 (verdict 는 fixed 인데 why 는 correct 문구) |
| Karen | 원문 "Welcome to our project kick-off meeting. Let's get started with a quick round of updates." 는 문법·의미 다 맞는데 통째로 다시 씀. (kick-off 명사형 → kick off 동사형으로 바꾸려는 의도로 보이지만 원문도 타깃 표현 포함) | 과교정 |

작은 것: Song 의 "Le'ts" 오타를 고치면서 why 에 오타 얘기가 없음 (한국어 의도 보탰다는 말만). 멤버는 자기가 오타 낸 걸 모르고 지나갈 수 있다.

### 3. 반복되는 실패 패턴

- **verbatim 판정이 타깃 표현 결손을 못 본다.** Skyler 건. STEP 2b 는 "다른 뜻으로 쓰였는지"를 보라고 하는데, "표현이 아예 반쪽만 들어갔는지"는 명시가 없다. HARD RULE 1 도 "corrected 에 표현이 있어야 한다"지 "원문에 있는지 검사하라"가 아니라서, verbatim 으로 통과하면 검사가 안 걸린다.
- **verdict 와 why 가 따로 논다.** Chloe 건. 지금 프롬프트는 why 를 verdict 에 종속시키는 문장이 없다. 사용자 메시지 쪽 "If unchanged, say so warmly" 만 있어서, 모델이 "거의 안 바꿨다"고 느끼면 correct 문구를 쓴다.
- **명사형 ↔ 동사형 전환을 교정 사유로 삼는다.** Karen 건. "kick-off meeting" 은 타깃 표현의 자연스러운 명사 활용인데 동사로 바꾸느라 문장을 통째로 재작성. 과교정 금지 조항(STEP 3)에 품사 활용 케이스가 없다.

### 4. SYSTEM_PROMPT 수정 제안 (영문 그대로, 위치 표시)

**(A) STEP 2b 첫 불릿 앞에 추가** (타깃 표현 결손 검사):

```
- FIRST, check the phrase is actually present in full. A truncated or half-typed target phrase ("kick by" for "kick off", "pick brain" for "pick someone's brain", a missing particle) is a real error -> verdict "fixed", restore the full phrase, and say so in "why". Never return verbatim when the target phrase itself is incomplete.
```

**(B) STEP 3 의 "Never swap one correct word for another (...)" 문장 뒤에 추가** (품사 활용 과교정 방지):

```
A noun or adjective form of the target phrase that is already natural ("our kick-off meeting", "a quick brain-picking session") counts as correct usage. Do not rewrite a correct sentence just to force the verb form.
```

**(C) FIELDS 의 "why" 항목, 첫 줄 뒤에 추가** (verdict 와 why 일치 강제):

```
"why" MUST match "verdict": the reassurance line ("이미 자연스러워요", "그대로 가셔도 됩니다") is allowed ONLY when verdict is "correct" and "corrected" equals the input. If you changed even one word, "why" must name that change.
```

**(D) FIELDS 의 "why" Fixed case 설명에 한 구절 추가** (오타 언급):

```
If you fixed a typo or misspelling (Le'ts -> Let's), name it explicitly even when you also added meaning from the Korean.
```

### 5. 제안 외 메모

- 오늘은 👎 가 0 이라 프롬프트 긴급 수정 사유는 없음. (A)(C) 는 실제 오답을 만든 케이스라 다음 배포 때 같이 넣는 걸 권장, (B)(D) 는 있으면 좋은 정도.
- 멤버 만족 신호(variants, 문법 옳고 그름 표시)는 그대로 유지. 건드리지 말 것.
