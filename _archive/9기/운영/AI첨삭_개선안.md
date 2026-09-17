# 9기 AI 첨삭 개선안

`AI첨삭_피드백_로그.md` 에 쌓인 멤버 피드백을 보고 정리한 프롬프트 개선 제안.
버디가 읽고 승인한 항목만 `supabase/functions/ai-review/index.ts` SYSTEM_PROMPT 에 반영한다. (이 파일은 제안만, 프롬프트는 안 건드림)

---

## 2026-09-17 (Day 4 · Zero in on)

### 1. 오늘 들어온 피드백 요약: 👍 1 · 👎 0

- hailey (Zero in on, 👍): "써먹을 좋은표현으로 고쳐줌"
  원문 "Let's zero in on resolving our differences over this change."
  교정 "Let's zero in on resolving our differences regarding this change and reach a consensus."
  why "한국어 의도를 살려 뒷부분을 보탰어요. '이견을 하나로 좁히다' 의미를 명확히 했습니다."

### 2. 👍 인데도 걸리는 것

원문은 그대로 써도 되는 문장이다. "differences over this change" 의 over 는 정확한 전치사(differences over / disagreement over 가 오히려 자연스러운 조합). AI 가 한 일:

| 한 일 | 판정 |
|---|---|
| over → regarding | 불필요한 치환. 맞는 전치사를 더 격식 있는 단어로 바꿈. STEP 3 "Never swap one correct word for another" 가 또 뚫림. 이번엔 구동사가 아니라 전치사. |
| "and reach a consensus" 추가 | 이번엔 why 가 말한 대로 실제로 뒷부분을 보탰다. 다만 zero in on resolving our differences 안에 이미 "합의로 좁혀간다" 가 들어 있어서 같은 말을 한 번 더 한 셈. 멤버 한국어 의도에 "합의" 가 명시돼 있었는지 로그로는 알 수 없음. |
| why 첫 문장 | 09-15, 09-16 과 같은 "한국어 의도를 살려 뒷부분을 보탰어요" 정형구. 이번엔 사실이긴 하지만, 4일 연속 같은 문장으로 시작하는 것 자체가 (H) 가 아직 안 들어갔다는 신호. |

멤버가 만족한 이유는 "and reach a consensus" 를 새 표현으로 받아들였기 때문. 나쁘지 않은 결과지만, 정확했던 over 가 사라진 건 멤버가 모른다.

### 3. 반복되는 실패 패턴

- **why 정형구 4일 연속.** (H) 미반영 상태로 판단. 새 제안 없음, (H) 우선 반영 요청.
- **맞는 단어를 격식체로 바꾸는 치환.** 09-15 구동사(go over → review), 09-17 전치사(over → regarding). STEP 3 예시가 전부 동사라서 전치사·접속사 치환은 모델이 "금지 대상" 으로 안 보는 듯. 어제 (E) 가 구동사만 다루니 한 줄 더 필요.

### 4. SYSTEM_PROMPT 수정 제안 (영문 그대로, 위치 표시)

**(K) STEP 3 첫 불릿, (E) 바로 뒤에 추가** (전치사·접속사 치환 방지):

```
This also covers prepositions and conjunctions: if "over", "since", "about", "on" is already the natural choice, keep it. Do not upgrade it to "regarding", "as", "concerning", "with respect to" for formality. A more formal word is not a correction.
```

**(L) STEP 3, "additions" 관련 문장 뒤 또는 (F) 뒤에 추가** (중복 첨가 방지):

```
Before appending a clause from the Korean, check whether the English sentence already carries that meaning. If "zero in on resolving our differences" already implies reaching agreement, do not add "and reach a consensus". Add only what is missing, not what is implied.
```

### 5. 제안 외 메모

- 오늘 새 건 1개뿐이라 제안은 두 줄만. (H)(I)(J) 와 오늘 (K)(L) 을 한 번에 반영하면 why 정형구·격식체 치환·중복 첨가 세 갈래가 같이 잡힌다.
- hailey 님은 Day 1 부터 3일째 👍 를 남기는 분. 한 스푼 더 자리에 "differences over ~ 도 정확한 조합이에요" 한 줄 넣어주면 over 가 틀린 게 아니었다는 걸 알 수 있다.

---

## 2026-09-16 (Day 2~3 · Loop in / Flag / Push back)

### 1. 오늘 들어온 피드백 요약: 👍 3 · 👎 1

대표 사례:
- Yujin (Push back, 👎): "in our email communications / during the meeting 이 추가된 이유가 불명확"
  원문 "I would like to push back on that idea, since korean media prefer every documents localized in Korean."
  교정 "I would like to push back on that idea, as Korean media prefer all documents to be localized in Korean."
  why "한국어 의도를 살려 뒷부분을 보탰고, 문법과 어순을 자연스럽게 고쳤어요."
- Hera (Push back, 👍): "Push back 뒤에나오는 전치사, hr상황"
  원문 "Before we kick it off, I'd like to share push back in Previous meeting"
  교정 "Before we kick off the meeting, I'd like to push back on some points raised in the previous meeting before we start."
- Chloe (Loop in, 👍): 원문 "let's loop financial in before sending emails." → "Let's loop in the financial team before sending the email." (분리 구동사를 붙이고 team 을 보탠 건 정확)

### 2. 👎 사유 판단 (Yujin 건)

원문에서 진짜 고칠 건 넷: korean → Korean, every documents → all documents, "prefer ... localized" → "prefer ... to be localized", 그리고 취향 수준의 since → as. 교정문 자체는 멀쩡하다. 문제는 두 군데.

| 한 일 | 판정 |
|---|---|
| corrected 의 문법 교정 4개 | 맞음 |
| why "뒷부분을 보탰고" | 거짓. 보탠 절 없음. 어제 Leo 건과 같은 템플릿 문장. |
| why "어순을 고쳤어요" | 거짓. 어순 그대로. |
| variants 에 "in our email communications" / "during the meeting" 삽입 | 멤버가 안 쓴 내용을 채널 버전에 끼워 넣고, 왜 넣었는지 어디에도 설명이 없음. why 는 corrected 만 다루고 variants 는 설명 필드가 없으니, 멤버 입장에서는 이유 모를 첨가물. |

분류: **why 가 실제 수정과 안 맞음 (템플릿)** + **variants 과교정 (장면·채널 문구를 멤버 문장에 덧붙임)**.

이번 건으로 템플릿 why 의 뿌리를 찾았다. SYSTEM_PROMPT 가 아니라 `buildSentenceUserMessage` (index.ts 161행) 에 예시로 박힌 문구가 그대로 나온다:
`In "why" (or feedback), briefly note what you added from the Korean (e.g. "한국어 의도를 살려 뒷부분을 보탰어요")`.
모델이 이 예시를 "why 의 기본 문장" 으로 배운 것. 어제 (G) 를 SYSTEM_PROMPT 에만 넣으면 이 줄과 싸운다.

### 3. 👍 인데도 걸리는 것

- **Hera 건은 뜻이 바뀌었다.** 원문은 "지난 회의에서 나온 반대 의견을 (지금) 공유하고 싶다" 인데, 교정문은 "지난 회의에서 나온 포인트에 (내가) 반대하고 싶다" 가 됐다. 반대하는 주체가 남에서 나로 바뀜. 게다가 "Before we kick off the meeting ... before we start" 로 같은 말이 두 번. 멤버는 전치사 on 을 배웠다고 만족했지만, 목표 표현을 억지로 동사 자리에 넣느라 문장을 통째로 바꾼 사례. push back 은 명사로도 쓰이니 "share the pushback from the previous meeting" 이 원문 의도에 맞았다.
- **Chloe (Flag) 건도 살짝 바뀌었다.** "you should report it to CEO" → "this matter needs to be reviewed by the CEO as well". report 가 review 로, 지시 대상(you) 이 사라지고 "as well" 이 새로 생김. 멤버는 만족했으니 넘어가지만 (F) 계열의 '멤버가 안 한 선택' 이다.

### 4. 반복되는 실패 패턴

- **why 템플릿 (3일 연속).** 09-14 (D) 오타 언급 없음 → 09-15 Leo → 09-16 Yujin. 원인이 사용자 메시지의 예시 문구로 특정됐으니 그 줄을 고치는 게 SYSTEM_PROMPT 문단 추가보다 확실하다.
- **variants 가 corrected 에 없는 내용을 만든다.** PERSONALIZATION 규칙이 "variants must name that counterpart or scene explicitly at least once" 라고 강제해서, 프로필에서 가져올 게 없으면 "in our email communications" 같은 채널 이름을 장면 대용으로 집어넣는다. 규칙의 취지(바이어·엔지니어 같은 실제 상대)와 다르게 작동 중.
- **목표 표현을 동사로만 인식.** push back 처럼 명사·동사 둘 다 되는 표현에서, 멤버가 명사로 쓴 걸 동사 패턴으로 바꾸며 뜻을 옮긴다 (Hera).

### 5. 수정 제안 (영문 그대로, 위치 표시)

**(H) `buildSentenceUserMessage` 161행, `In "why" (or feedback), briefly note what you added from the Korean (e.g. "한국어 의도를 살려 뒷부분을 보탰어요").` 를 아래로 교체** (템플릿 뿌리 제거 · SYSTEM_PROMPT 는 아니지만 같은 파일):

```
In "why", name the concrete change you made. Only say you added something ("뒷부분을 보탰어요") if you actually appended a clause that the student left out; if you fixed articles, plurals, capitalization, or verb forms, say that instead. Never open "why" with a stock phrase.
```

**(I) SYSTEM_PROMPT PERSONALIZATION 불릿, `"variants" must name that counterpart or scene explicitly at least once (...)` 문장 바로 뒤에 추가** (variants 첨가물 방지):

```
Scene words come ONLY from the learner profile. If the profile gives no counterpart, do not invent one and do not pad the sentence with channel labels ("in our email communications", "during the meeting", "in this thread"): the email/meeting split is already carried by tone and length, not by naming the channel inside the sentence. Everything in a variant must be traceable to "corrected" or to the profile.
```

**(J) STEP 2b 첫 불릿 뒤에 추가** (명사형 목표 표현 보호):

```
If the target phrase also works as a noun (push back / pushback, follow up / follow-up, sign off / sign-off, kick off / kick-off) and the student used it that way with the right meaning, keep the noun form. Do not force the verb pattern if doing so changes who is doing the action.
```

### 6. 제안 외 메모

- (H) 는 (G) 를 대체한다. 어제 (G) 를 아직 안 넣었으면 (G) 는 빼고 (H) 만 넣어도 된다. 둘 다 넣으면 같은 말 두 번.
- Yujin 님은 Day 1 에 "메일/회의 두 버전 좋다" 고 칭찬한 분이라, 이번 👎 도 variants 를 진지하게 읽어서 나온 것. 1:1 로 "그 문구는 AI 가 채널 흉내 내려고 넣은 거라 빼셔도 돼요" 한 줄이면 충분.
- Hera 님은 (J) 반영 전까지는 "push back 을 명사로 쓰신 것도 맞아요, the pushback from the previous meeting" 을 한 스푼 더 자리에 한 번 언급해줘도 좋겠다. 오늘 Day 3 단어라 타이밍이 맞는다.

---

## 2026-09-15 (Day 1~2 · Bounce ideas off / Loop in / Flag)

### 1. 오늘 들어온 피드백 요약: 👍 4 · 👎 1

대표 사례:
- hailey (Flag, 👍): "저는 문장을 복잡하게 썼는데 간단하게 수정해줘서 너무 좋아요!" 원문 "I would like to flag that we might have delay issue again, if we accept the request." → "...that if we accept the request as is, we might face delay issues again."
- milky (Loop in, 👍): "고친이유 명확!" 원문 "please note that the marketing team has to be loop in this mail chain" → "Please make sure to loop in the marketing team starting with this email chain."
- Leo (Loop in, 👎): "구동사를 더 많이 쓰길래 썼는데 지양할까요?"
  원문 "Let's loop in mechanical team before conference call. We need them to go over P&I."
  교정 "Let's loop in the mechanical team before the conference call since we need them to review the P&I."
  why "한국어 의도를 살려 뒷부분을 보탰고, 전치사와 관사도 자연스럽게 고쳤어요."

### 2. 👎 사유 판단 (Leo 건)

원문에서 진짜 틀린 건 관사 두 개(the mechanical team, the conference call)뿐이다. 그런데 AI 가 한 일:

| 한 일 | 판정 |
|---|---|
| 관사 추가 | 맞음 |
| "go over" → "review" 로 교체 | 과교정. 멀쩡한 구동사를 라틴계 단어로 바꿈. STEP 3 에 "Never swap one correct word for another" 가 이미 있는데 뚫림. 멤버는 이걸 "구동사 쓰지 말라는 뜻인가?" 로 읽었다. 구동사 배우는 챌린지에서 제일 나쁜 신호. |
| 두 문장을 since 로 한 문장으로 합침 | 과교정. STEP 3 fixed 의 "The result must be ONE fluent sentence" 가 두 문장 입력을 무조건 합치라는 뜻으로 작동한 것으로 보임. |
| why "뒷부분을 보탰고" | 거짓. 보탠 내용 없음. 합치고 바꿨을 뿐. |
| why "전치사 ... 고쳤어요" | 거짓. 전치사 손댄 데 없음. 관사만. |

분류: **과교정 (구동사 → 단일동사 치환, 문장 병합)** + **why 가 실제 수정과 안 맞음**.

### 3. 반복되는 실패 패턴

- **why 가 템플릿 문장을 돌려쓴다.** 오늘 5건 중 3건의 why 가 "한국어 의도를 살려 뒷부분을 보탰고, ~도 자연스럽게 고쳤어요" 로 시작. hailey 건도 보탠 게 아니라 어순 바꾼 건데 같은 문구. 어제 (D) 에서 지적한 "오타 언급 없음"과 같은 뿌리: why 가 diff 를 보고 쓰는 게 아니라 정형구를 뱉는다.
- **synonym swap 금지가 구동사에는 안 먹힌다.** STEP 3 예시(increase/raise, use/leverage, begin/kick off)가 전부 "단일어 ↔ 단일어" 또는 "단일어 → 구동사" 방향. 반대 방향(구동사 → 단일어)이 명시가 없어서 모델이 "격식 있게 다듬기" 로 인식하는 듯.
- **다문장 입력을 한 문장으로 합친다.** 프롬프트가 1문장 과제를 전제로 쓰여 있어서, 멤버가 두 문장 쓰면 접속사로 붙인다. 병합 자체가 틀린 건 아니지만 멤버가 안 한 선택을 강제하는 거라 과교정.

### 4. SYSTEM_PROMPT 수정 제안 (영문 그대로, 위치 표시)

**(E) STEP 3 첫 불릿, "Never swap one correct word for another (...)" 문장 바로 뒤에 추가** (구동사 보호):

```
This includes the reverse direction: never replace a correct phrasal verb with a single-word verb (go over -> review, set up -> arrange, put off -> postpone, figure out -> determine, follow up -> contact). Phrasal verbs are exactly what this course teaches; a student who chose one made the right call. Keep it.
```

**(F) STEP 3 둘째 불릿, "The result must be ONE fluent sentence a colleague could actually say" 를 아래로 교체** (문장 병합 방지):

```
The result must read like something a colleague could actually say. Keep the student's sentence count: if they wrote two sentences, return two sentences. Do not merge them with since/because/so unless the Korean itself is one sentence and the split causes a meaning gap.
```

**(G) FIELDS 의 "why" 항목, "Fixed case: name exactly which words changed and why" 뒤에 추가** (정형구 금지 · 어제 (C)(D) 와 세트):

```
Write "why" from the actual diff between input and "corrected", not from a template. Say "뒷부분을 보탰어요" only if you appended a clause that was missing; say "전치사" only if a preposition changed (articles are 관사, not 전치사); say "어순을 바꿨어요" if you reordered. If you cannot name a real change, the verdict should have been "correct".
```

### 5. 제안 외 메모

- (E) 는 오늘 👎 를 직접 만든 원인이라 다음 배포에 꼭. (F)(G) 는 같은 배포에 묶어 넣는 걸 권장. (G) 는 어제 (C)(D) 와 겹치니 셋을 한 문단으로 합쳐도 됨.
- Leo 님에게는 1:1 로 "go over 맞게 쓰신 거예요, AI 가 괜히 바꾼 거" 한 줄 보내는 게 좋겠다. 안 그러면 구동사 자체를 피하기 시작할 수 있다.
- 👍 4건 중 걸리는 것: hailey 건은 "delay issue → delay issues" 복수형이 진짜 교정이고 나머지 어순 변경은 취향. 멤버는 만족했으니 이번엔 넘어감.

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
