// ============================================================
// Supabase Edge Function: ai-review  (OpenAI / ChatGPT edition)
// ------------------------------------------------------------
// Client: POST  {SUPABASE_URL}/functions/v1/ai-review
// Purpose: Proxy AI sentence/story correction calls so the real
//          OpenAI API key never touches the browser.
//
// Deploy (one-time):
//   1. Install Supabase CLI (brew install supabase/tap/supabase)
//   2. From repo root:
//        supabase login
//        supabase link --project-ref qaasxvatmribkgtatine
//        mkdir -p supabase/functions/ai-review
//        cp project/supabase_ai_review_function.ts \
//           supabase/functions/ai-review/index.ts
//   3. Set the secret (replace with your real key):
//        supabase secrets set OPENAI_API_KEY=sk-...
//   4. Deploy:
//        supabase functions deploy ai-review --no-verify-jwt
//      (`--no-verify-jwt` lets us call it with just the anon key.
//       We still gate via our own tier check on the client.)
//
// Update (after editing this file):
//   cp project/supabase_ai_review_function.ts \
//      supabase/functions/ai-review/index.ts
//   supabase functions deploy ai-review --no-verify-jwt
// ============================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// gpt-4.1-mini: 4o-mini 가 시제 보존 같은 미묘한 규칙을 무시해서 승격 (2026-07-14).
// 비용 약 2.5배지만 기수당 $8 수준. 계정에 없으면 아래 FALLBACK_MODEL 로 자동 재시도.
const OPENAI_MODEL = 'gpt-4.1-mini';
const FALLBACK_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 700;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // tighten to 'https://youbuddy.co.kr' in prod if you want
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

const SYSTEM_PROMPT = `You are a warm, encouraging business English coach for Korean learners.
You ALWAYS reply with a single valid JSON object and nothing else:
{"corrected": string, "why": string, "verdict": "correct" | "fixed", "feedback": {"grammar": string, "vocab": string, "nuance": string}}

HOW TO REVIEW - follow these steps in order, every time.

STEP 0. Weigh the Korean sentence. It comes in three qualities; adapt instead of applying rules blindly:
- FULL SENTENCE (complete Korean sentence with clear intent): it is the source of truth. Do the full meaning comparison in Step 2.
- ROUGH MEMO (keywords, dropped particles, half-finished phrase, no question mark but obviously informal shorthand): treat it as a HINT about intent only. Do not enforce tense or question-vs-statement from it. Intervene on meaning only if the English clearly contradicts the core intent. Never append clauses to cover leftover memo keywords.
- ABSENT or meaningless: skip meaning comparison entirely. Judge the English on its own merits (Step 2 grammar checks + target phrase only).
The meaning check is ONE-DIRECTIONAL: the English must not MISS the core of the Korean. English that says MORE than the Korean is fine, never an error.

STEP 1. (Full-sentence Korean only) Mentally translate the Korean yourself into one natural business English sentence containing the target phrase. This is your reference answer.

STEP 2. Compare the student's attempt against your reference on MEANING:
- Coverage: does it express every core clause of the Korean? Missing half the meaning = real error. But this has a HIGH threshold: only flag it when the reader would misunderstand the message. Small hedging words (웬만해선, 그냥, 좀, 굳이) or minor detail words are NOT gaps. NEVER append an extra clause to an already-complete sentence just to chase a leftover Korean word.
- Tense/aspect: Korean past or past-experience endings (~았/었는데, ~더라고요, ~했어요) must stay past or present-perfect in English. Never flatten to a present habit.
- Speech act, clause by clause: a Korean question must be an English question; a promise stays a promise.
Then check GRAMMAR regardless of Korean quality: prepositions, articles, tense consistency, subject-verb agreement, fragments, part-of-speech errors, doubled verbs, broken collocations (do a decision -> make a decision), misspellings that form another word (fillers -> feelers), Konglish/calques, and any Korean characters left inside the English sentence (always translate them into English; verbatim is forbidden in that case).

STEP 3. Verdict.
- No meaning gap and no grammar error -> verdict "correct": return the input VERBATIM (no punctuation or spacing changes either). Differences in word choice between the attempt and your reference are NOT errors. Never swap one correct word for another (increase/raise, use/leverage, begin/kick off, help/assist and the like). If your only edit would be a synonym swap or a tone polish, revert to verbatim. Convergence is the goal: the 2nd and 3rd review of good input must not invent new edits.
- Otherwise -> verdict "fixed": build the correction starting from your reference, reusing the student's own wording wherever it already matches the Korean. The result must be ONE fluent sentence a colleague could actually say, express the full Korean meaning, and contain the target phrase. Hand the learner the finished sentence like a human tutor would.

Two real failures - never repeat them:
- Korean: "웬만해선 비공식적으로 풀고싶지 않았는데, 어쩔 수 없이 그게 필요한 경우가 있더라고요." / Student: "I didn't want to backchannel it, but sometimes it's necessary" -> already correct (past tense kept). Rewriting it as "I usually don't like to backchannel..." flattened past experience into present habit: WRONG.
- Korean: "그건 잠정적으로 확정된 약속인건가요? 아니면 확약으로 표시해둘까요?" (both halves are questions) / Student: "I can give you a soft commit for Friday, but I'll confirm it after the review." -> both clauses must become questions: "Is that a soft commit, or should I mark it as a firm commitment?" Fixing only the second half is a half-fix: WRONG.

HARD RULES:
1. TARGET PHRASE: "corrected" MUST contain the exact target phrase or its grammatical inflection (anchor -> anchored/anchoring). Never a synonym, never deleted. If the student omitted it, rewrite the sentence so it fits naturally. Verify this before returning.
2. ECHO: if the new attempt is identical (ignoring case, punctuation, spacing) to a "corrected" you returned in a prior attempt AND the Korean is unchanged, that sentence is FINAL: verdict "correct", return it verbatim, warmly confirm it is settled. Never re-edit your own past correction and never revert to an earlier phrasing. If the Korean HAS changed, review fresh against the new Korean.
3. Real one-word errors must still be fixed (verdict "fixed") even though they are single words: a misspelling that forms another word, a broken collocation, or a word that contradicts the Korean intent (Korean says 연기하다 but student wrote "cancel" -> "postpone").
4. TONE: default to clear, confident business register. If the Korean is casual, match it. Never restyle tone or word order when meaning and grammar are already fine.

FIELDS:
- "why": 1-2 friendly Korean sentences, under 140 chars. Verbatim case: reassure explicitly, e.g. "이미 자연스러워요! 그대로 가셔도 됩니다." Fixed case: name exactly which words changed and why (전치사 추가, 시제 교정 등). No editorializing about polish.
- "feedback": each field is a compact Korean phrase (max 70 chars) or "" when empty:
  - "grammar": 문법 교정 내용 (시제, 관사, 전치사, 구조, 조각문)
  - "vocab": 어휘 교정 (오철자, 콜로케이션, 콩글리시, 한국어 단어 번역)
  - "nuance": 선택적 코멘트만 (칭찬, 격식/쓰임새 팁). corrected 를 바꾸는 근거가 될 수 없음.
  Do not repeat the same point across categories.
- "corrected": normal sentence case, no bold or tricks.
Do not include markdown, code fences, or any prose outside the JSON.`;

interface PriorAttempt {
  sentence: string;
  corrected: string;
  why?: string;
  korean?: string;
  attempt?: number;
}

function buildHistoryBlock(history?: PriorAttempt[], isRepeat?: boolean): string {
  if (!history || history.length === 0) return '';
  const lines = history.map((h, i) => {
    const n = h.attempt ?? i + 1;
    return `Attempt #${n}: student wrote "${h.sentence}" → you returned "${h.corrected}"${h.why ? ` (you said: ${h.why})` : ''}`;
  }).join('\n');
  const repeatNote = isRepeat
    ? `\n*** This new attempt is ESSENTIALLY THE SAME as a prior attempt above. DO NOT correct it again: they already saw that correction. Switch to COACHING MODE: return the sentence verbatim and in "why" give a SHORT Korean coaching tip that pushes them to try a DIFFERENT scenario, formality level, channel (Slack vs email), or tense. NEVER suggest yet another single-word swap. ***`
    : `\n*** This is iteration ${history.length + 1}. The student has been working on this phrase. Reference what they got right before. If this new attempt has no grammar issue, RETURN VERBATIM and praise specifically what improved. ***`;
  return `=== Prior attempts (memory across turns) ===\n${lines}${repeatNote}\n=== End prior attempts ===\n\n`;
}

function buildSentenceUserMessage(
  word: { en: string; def?: string },
  sentence: string,
  korean?: string,
  history?: PriorAttempt[],
  isRepeat?: boolean,
) {
  // Korean context (the 한국어 문장 the student wrote first) is the source of truth
  // for meaning. Read it BEFORE the English attempt so the model anchors on the
  // learner's intent instead of guessing from broken English.
  const koreanBlock = (korean || '').trim()
    ? `Korean sentence the student wrote (source of intent: match this meaning): "${korean!.trim()}"\n`
    : '';
  const historyBlock = buildHistoryBlock(history, isRepeat);
  // Detect if the English attempt has Korean (or other non-ASCII) characters mixed in.
  // 그러면 AI 에게 "이건 무조건 번역해야 함" 명시.
  const hasKr = /[^\x00-\x7F]/.test(sentence);
  const mixedLangHint = hasKr
    ? `\n⚠️ The student's English attempt CONTAINS Korean characters (e.g. 충성도, 협상, etc.). You MUST translate those Korean words into natural English equivalents in the corrected output. Returning verbatim with Korean characters still inside is FORBIDDEN. Use the Korean context (if given) and the English context to pick the right translation. Example: "customer 충성도" → "customer loyalty". If you're unsure of the exact word, pick the most natural business-English equivalent and explain briefly in "why".\n`
    : '';
  return `${historyBlock}${koreanBlock}Phrase being practiced (KEEP THIS in the output): "${word.en}" (${word.def || ''})
Student's English attempt: "${sentence}"
${mixedLangHint}
Your goal: make this sentence sound like something a native English business speaker would naturally say in a real meeting / email / Slack: while keeping "${word.en}" inside. Also fix any clear grammar issues (subject-verb agreement, mixed-language characters, tense, articles, prepositions).

Return JSON:
- "corrected": a polished, native-sounding business English sentence. **MUST contain "${word.en}"** (or a minimal grammatical inflection: e.g. "${word.en}d" / "${word.en}ing" / pluralized: never a synonym swap). MUST convey the FULL meaning of the Korean sentence above (if provided). If the student's attempt only covers part of the Korean, complete the rest yourself from the Korean, like a human tutor handing over the finished sentence. In "why" (or feedback), briefly note what you added from the Korean (e.g. "한국어 의도를 살려 뒷부분을 보탰어요"). MUST be entirely in English (no Korean/Japanese characters left in). Improve fluency: fix awkward word order, non-native phrasing, weird prepositions, clunky structure. Tone: business meeting / professional Slack / email-ready: clear, confident, concise. Avoid casual slang AND avoid stiff/archaic phrasing. **Edit aggressively for naturalness, but preserve the student's core intent + the target phrase.** If the sentence already reads as if a fluent native speaker wrote it (no awkward edges AND no Korean characters AND grammar is solid), return it VERBATIM.
- "why": 1-2 Korean sentences (≤140 chars). **If unchanged, say so warmly ("이미 자연스러워요! 그대로 가셔도 됩니다.")**: otherwise briefly explain what type of fix you made (e.g. "한국어 표현 번역 / 어순 / 전치사 교정 / 주어-동사 일치 등").

FINAL CHECK before returning, in order:
1. If the Korean above is a full sentence: does your corrected sentence keep its tense and its speech act (question stays question), and cover its core meaning? If the Korean is a rough memo or absent, skip this.
2. Is every difference between the student's sentence and yours justified by a real error? If not, revert that difference.
3. Does "corrected" contain the target phrase, and does "feedback" name each change in the right category?`;
}

function buildStoryUserMessage(
  words: { en: string; def?: string; syn?: string[] }[],
  text: string,
  korean?: string,
  history?: PriorAttempt[],
  isRepeat?: boolean,
) {
  const lines = (words || []).map((w) => {
    const synList = Array.isArray(w.syn) && w.syn.length
      ? `   · synonyms (also acceptable): ${w.syn.map((s) => `"${s}"`).join(', ')}`
      : '';
    return `- "${w.en}" (${w.def || ''})${synList ? `\n${synList}` : ''}`;
  }).join('\n');
  const koreanBlock = (korean || '').trim()
    ? `Korean context (what the student meant, in their own words): "${korean!.trim()}"\n`
    : '';
  const historyBlock = buildHistoryBlock(history, isRepeat);
  return `${historyBlock}${koreanBlock}The student is tying today's 3 expressions into a short business-scenario mini story.
Each main expression has optional synonyms the student MAY have practiced as alternative phrasings:
${lines}

Student's English attempt: "${text}"

Your goal: produce a clean, native-sounding business mini-story that keeps the MAIN expressions intact, AND separately teach the synonyms with concrete usage guidance.

Return JSON with FIVE fields ("verdict" and "feedback" as defined in the system prompt, plus the three below):

1. "corrected": polished, native-sounding business-English mini story.
   - MUST contain each MAIN expression at least once (or its inflection: tense / plural).
   - Edit aggressively for fluency: fix grammar, awkward word order, non-native phrasing, weird prepositions, choppy connectors. Native business speaker register.
   - You DO NOT need to keep every synonym the student wrote: feel free to drop redundant synonym variants if they make the prose awkward. Synonyms get proper treatment in field 3 below.
   - Only return verbatim if the text already reads as if a fluent native speaker wrote it.

2. "why": 1-2 Korean sentences (≤140 chars). Friendly, brief.
   - If unchanged: "이미 흐름 좋아요! 수정할 부분 없어요." style.
   - If edited: short fix-type tag ("흐름 / 어순 / 자연스러운 표현으로 다듬었어요.").

3. "syn_examples": array of objects, ONE entry for EACH synonym the student wrote in their text (skip synonyms they didn't actually use).
   Schema: [{ syn: string, context: string, example: string }]
   - "syn": the synonym phrase exactly as listed (e.g. "First cut", "Bring it home").
   - "context": ≤30자 Korean: when/where this synonym is naturally used (industry, situation, tone). Be SPECIFIC and TRUE: don't make up generic platitudes. Examples: "디자인·UX 분야 초안 단계에서 자주 써요" / "프로젝트 마무리 동기부여 톤" / "엔지니어링·QA 에서 빠른 검증 시점에".
   - "example": natural English example sentence (≤20 words) showing the synonym in a realistic business context. Different scenario from the student's text: broaden their understanding.
   - If the student wrote zero synonyms, return empty array [].
   - Each example should be plausible business English (Slack/email/meeting), not stilted.

Output STRICTLY in this JSON shape, no extra fields, no markdown.`;
}

function extractJson(raw: string): any {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const src = match ? match[0] : cleaned;
  return JSON.parse(src);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Simple, XSS-safe diff: we never trust the model to emit HTML.
// If the correction is identical to the original, diff_html contains no
// <del>/<ins> and the client renders a "no changes" note instead.
function buildDiffHtml(original: string, corrected: string): string {
  const a = (original || '').trim();
  const b = (corrected || '').trim();
  if (!a) return escapeHtml(b);
  if (a === b) return escapeHtml(b);
  return `<del>${escapeHtml(a)}</del> <ins>${escapeHtml(b)}</ins>`;
}

// 타겟 단어/구문이 corrected 안에 들어있는지 검증.
// "anchor" 면 "anchor" / "anchored" / "anchoring" / "anchors" 등 inflection 도 OK 로 간주.
// "set the stage" 같은 multi-word 면 모든 어절이 다 들어있어야 함 (또는 phrase 그대로 등장).
function correctedContainsTarget(corrected: string, target: string): boolean {
  if (!target) return true;
  const c = (corrected || '').toLowerCase();
  const t = target.toLowerCase().trim();
  if (!t) return true;
  // 1) Whole phrase verbatim?
  if (c.includes(t)) return true;
  // 2) Multi-word phrase: all tokens present?
  const tokens = t.split(/\s+/).filter((w) => w.length > 1);
  if (tokens.length > 1) {
    return tokens.every((tok) => c.includes(tok));
  }
  // 3) Single word: allow inflection by checking 4+ char prefix.
  const root = t.length >= 5 ? t.slice(0, t.length - 1) : t;
  return c.includes(root);
}

// 번역 전용 시스템 프롬프트: self-serve 빈칸 퀴즈의 영어 문장 → 자연스러운 한국어.
const TRANSLATE_SYSTEM = `You are a professional English→Korean translator for a business-English learning app. Translate each English sentence into natural, conversational Korean (존댓말, business tone). Be faithful and concise. Do NOT add explanations or notes. Always reply as strict JSON only.`;

async function callOpenAI(userMessage: string, systemPrompt: string = SYSTEM_PROMPT): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: MAX_TOKENS,
      // 0.5 → 0.1 로 낮춤. 같은 input → 거의 같은 output 보장하기 위함.
      // 학습자가 재호출 시마다 다른 추천 받으면 "뭐가 맞는지 모름" 피드백 발생.
      temperature: 0.1,
      seed: 7, // 같은 입력 → 같은 출력 재현성 (이랬다저랬다 방지)
      // Forces the response to be valid JSON: much more reliable than
      // hoping the model stays within braces.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    // 모델 미지원 계정이면 폴백 모델로 1회 재시도
    if (res.status === 404 || err.includes('model_not_found') || err.includes('does not exist')) {
      const res2 = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: FALLBACK_MODEL, max_tokens: MAX_TOKENS, temperature: 0.1, seed: 7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });
      if (res2.ok) {
        const d2 = await res2.json();
        const t2 = d2?.choices?.[0]?.message?.content;
        if (t2) return t2;
      }
    }
    throw new Error(`openai ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('openai empty response');
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const mode = body?.mode; // 'sentence' | 'story' | 'translate'

  // ── translate 모드: 영어 문장 배열 → 한국어 번역 배열 (self-serve 빈칸 퀴즈용)
  if (mode === 'translate') {
    const sentences = Array.isArray(body?.sentences)
      ? body.sentences.map((s: any) => String(s || '').slice(0, 400)).filter(Boolean).slice(0, 40)
      : [];
    if (sentences.length === 0) return json({ error: 'sentences required' }, 400);
    try {
      const userMessage = 'Translate each of the following English sentences into natural conversational Korean. '
        + 'Return ONLY JSON: {"translations": ["...", ...]} with EXACTLY the same number of items in the SAME order.\n'
        + sentences.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
      const raw = await callOpenAI(userMessage, TRANSLATE_SYSTEM);
      const parsed = extractJson(raw);
      let translations = Array.isArray(parsed?.translations)
        ? parsed.translations.map((t: any) => String(t || ''))
        : [];
      while (translations.length < sentences.length) translations.push('');
      if (translations.length > sentences.length) translations = translations.slice(0, sentences.length);
      return json({ translations });
    } catch (e) {
      return json({ error: 'translate failed: ' + String((e as any)?.message || e).slice(0, 200) }, 500);
    }
  }

  const text = String(body?.text || '').trim();
  // Korean intent sentence (optional). Used as the meaning anchor so the model
  // doesn't guess when the learner's English is ambiguous.
  const korean = String(body?.korean || '').trim().slice(0, 500);
  if (!text) return json({ error: 'text required' }, 400);
  if (text.length > 800) return json({ error: 'text too long' }, 400);

  try {
    // Prior attempts (optional): 같은 단어 슬롯에 대한 이전 시도들.
    // 있으면 단계별 코칭 모드로 전환: 똑같은 swap 반복 X.
    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history: PriorAttempt[] = rawHistory
      .filter((h: any) => h && typeof h.sentence === 'string' && typeof h.corrected === 'string')
      .slice(-3) // 최근 3개만
      .map((h: any) => ({
        sentence: String(h.sentence).slice(0, 500),
        corrected: String(h.corrected).slice(0, 500),
        why: h.why ? String(h.why).slice(0, 300) : undefined,
        korean: h.korean ? String(h.korean).slice(0, 500) : undefined,
        attempt: typeof h.attempt === 'number' ? h.attempt : undefined,
      }));
    const isRepeat = Boolean(body?.isRepeatSubmission);

    // === 결정적 에코 가드: 이전에 우리가 돌려준 corrected 를 그대로 재제출한 경우,
    // 모델을 부르지 않고 즉시 '최종 확정' 응답. (붙여넣기 재제출 시 흔들림 원천 차단)
    const __norm = (v: string) => String(v || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const __normKo = (v: string) => String(v || '').replace(/\s+/g, ' ').replace(/[.,!?~]/g, '').trim();
    // 한국어 의도가 바뀌었으면 같은 영어라도 새 과제 → 가드 미발동 (이전 기록에 한국어 없으면 검증 불가로 미발동)
    const __koOk = (h: PriorAttempt) => {
      const cur = __normKo(korean); const prev = __normKo(h.korean || '');
      if (!cur && !prev) return true;
      if (!prev) return false;
      return cur === prev;
    };
    const echoHit = history.find((h) => __norm(h.corrected) !== '' && __norm(h.corrected) === __norm(text) && __koOk(h));
    if (echoHit) {
      const clean = echoHit.corrected || text;
      return json({
        corrected: clean,
        diff_html: buildDiffHtml(text, clean),
        why: '방금 다듬어드린 문장 그대로예요. 이게 최종 확정 문장이에요 ✓ 자신있게 쓰시면 됩니다!',
        verdict: 'correct',
      });
    }
    // === 리플레이 가드: 같은 '원문'을 다시 보낸 경우, 이전에 준 교정을 글자 그대로 재현.
    // (같은 입력에 매번 다른 제안이 나오면 학습자가 뭐가 맞는지 헷갈리는 핑퐁의 마지막 구멍)
    const replayHit = history.find((h) =>
      __norm(h.sentence) !== '' && __norm(h.sentence) === __norm(text)
      && __norm(h.corrected) !== '' && __norm(h.corrected) !== __norm(h.sentence)
      && __koOk(h));
    if (replayHit) {
      return json({
        corrected: replayHit.corrected,
        diff_html: buildDiffHtml(text, replayHit.corrected),
        why: '아까와 같은 문장이라 제안도 같아요. 이 문장으로 바꿔보시고, 그대로 붙여넣어 제출하면 확정돼요!',
        verdict: 'fixed',
      });
    }

    let userMessage: string;
    if (mode === 'sentence') {
      const word = body?.word;
      if (!word?.en) return json({ error: 'word required' }, 400);
      userMessage = buildSentenceUserMessage(word, text, korean, history, isRepeat);
    } else if (mode === 'story') {
      const words = Array.isArray(body?.words) ? body.words : [];
      if (words.length < 1) return json({ error: 'words required' }, 400);
      userMessage = buildStoryUserMessage(words, text, korean, history, isRepeat);
    } else {
      return json({ error: 'mode must be sentence|story' }, 400);
    }

    const raw = await callOpenAI(userMessage);
    const parsed = extractJson(raw);
    let corrected = String(parsed?.corrected || text).trim();
    let why = String(parsed?.why || '').trim() ||
      '표현이 더 자연스럽게 들리도록 다듬었어요.';

    // 타겟 검증: slot-based, 완화된 가드.
    // sentence 모드: 슬롯 1개, 메인 단어 verbatim 강제.
    // story 모드: 각 슬롯에서 [메인, ...syn] 중 최소 1개만 살아있으면 OK.
    //   AI 가 문법 교정하면서 변형 1~2개를 자연스럽게 다듬어내는 정상 동작 허용.
    //   사용자가 한 슬롯에 변형들을 다 썼는데 corrected 에 그 슬롯 전체가 사라지면 fallback.
    let targetSlots: string[][] = [];
    if (mode === 'sentence') {
      const w = String(body?.word?.en || '');
      if (w) targetSlots = [[w]];
    } else if (mode === 'story') {
      targetSlots = (Array.isArray(body?.words) ? body.words : []).map((w: any) => {
        const main = String(w?.en || '');
        const syns = Array.isArray(w?.syn) ? w.syn.map((s: any) => String(s || '')).filter(Boolean) : [];
        return [main, ...syns].filter(Boolean);
      }).filter((slot) => slot.length > 0);
    }
    // 사용자가 원문에서 실제로 쓴 phrase 목록 (변형/구두점 무시): 슬롯별로 추적.
    const usedByUser: string[][] = targetSlots.map((slot) =>
      slot.filter((phrase) => correctedContainsTarget(text, phrase))
    );
    const missingSlots = targetSlots.filter((slot, i) => {
      const userUsed = usedByUser[i];
      if (userUsed.length === 0) {
        // 사용자가 안 쓴 슬롯 → 검증 패스 (AI 가 알아서 처리).
        return false;
      }
      // 사용자가 1개 이상 변형 썼으면 → 그 슬롯의 어떤 변형이든 1개라도 corrected 에 살아있으면 OK.
      return !slot.some((phrase) => correctedContainsTarget(corrected, phrase));
    });
    if (missingSlots.length > 0) {
      // 누락 진단: 어떤 슬롯이 통째로 사라졌는지.
      const missingDesc = missingSlots.map((slot) =>
        `(at least one of: ${slot.map((s) => `"${s}"`).join(' / ')})`
      ).join(', ');
      console.warn('[ai-review] entire slot(s) missing in corrected: retrying:', missingDesc);
      const retryMsg = `Your previous response completely removed these target phrase slots: ${missingDesc}. ${
        mode === 'story'
          ? 'You may rewrite for grammar/fluency, but each target slot must contain at least one of its variants (main or synonym) in the final output.'
          : 'Rewrite so the phrase is contained verbatim (or with grammatical inflection only).'
      } Same JSON shape.`;
      try {
        const retryRaw = await callOpenAI(`${userMessage}\n\n${retryMsg}`);
        const retryParsed = extractJson(retryRaw);
        const retryCorrected = String(retryParsed?.corrected || '').trim();
        const stillMissing = targetSlots.filter((slot, i) => {
          const userUsed = usedByUser[i];
          if (userUsed.length === 0) return false;
          return !slot.some((p) => correctedContainsTarget(retryCorrected, p));
        });
        if (retryCorrected && stillMissing.length === 0) {
          corrected = retryCorrected;
          why = String(retryParsed?.why || why).trim();
        } else {
          // 두 번 시도해도 누락이면 원문 그대로 반환.
          corrected = text;
          why = '학습 단어가 잘 들어있으니 그대로 가셔도 좋아요. (AI 가 일부 표현을 빠뜨려서 원문 유지)';
        }
      } catch (_) {
        corrected = text;
        why = '학습 단어 보존을 위해 원문 그대로 둬요. 다시 시도해도 같은 결과면 직접 다듬어 보세요.';
      }
    }

    return json({
      corrected,
      diff_html: buildDiffHtml(text, corrected),
      why,
      // verdict: 모델 판정 우선, 없으면 실제 변경 여부로 계산. 클라이언트가
      // '진짜 오류 교정' vs '원문 그대로' 를 신뢰성 있게 구분하는 데 사용.
      verdict: (String(parsed?.verdict || '') === 'correct' || corrected.trim() === text.trim()) ? 'correct' : 'fixed',
      // 3분류 피드백 (문법/어휘/뉘앙스). 클라이언트가 색 구분 렌더. 없으면 why 한 줄로 fallback.
      feedback: {
        grammar: String(parsed?.feedback?.grammar || '').slice(0, 200),
        vocab: String(parsed?.feedback?.vocab || '').slice(0, 200),
        nuance: String(parsed?.feedback?.nuance || '').slice(0, 200),
      },
    });
  } catch (e) {
    console.error('ai-review error', e);
    return json({ error: 'ai review failed', detail: String(e).slice(0, 200) }, 500);
  }
});
