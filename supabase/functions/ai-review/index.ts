// ============================================================
// Supabase Edge Function — ai-review  (OpenAI / ChatGPT edition)
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
// gpt-4o-mini: cheapest, good enough for 1-2 sentence corrections (~$0.15 / 1M in).
// Swap to 'gpt-4o' or 'gpt-4.1' if you want higher quality at ~10x cost.
const OPENAI_MODEL = 'gpt-4o-mini';
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
You ALWAYS reply with a single valid JSON object and nothing else.
The JSON must have exactly two string fields: "corrected" and "why".

CRITICAL RULE 1 — FIX BROKEN GRAMMAR AND MAKE IT SOUND NATIVE:
Your job is to turn the student's English into something a native business speaker would actually say. You MUST edit when ANY of these are present.

FORMATTING RULE (very important): Output the corrected sentence in NORMAL sentence case. DO NOT capitalize, bold, or otherwise emphasize any inserted/edited words. Just write natural prose. The diff highlighter on the client will mark inserts visually — your job is purely to write the polished sentence.

(1) Broken grammar / missing prepositions / wrong article / wrong tense
   ✗ "drill down our metrics" → ✓ "drill down into our metrics"
   ✗ "loop in design team" → ✓ "loop in the design team"
   ✗ "Why don't we discuss?" (without object) → ✓ "Why don't we discuss this?"

(2) Fragments / sentences that don't form a complete thought
   ✗ "or Break down." (standalone) → merge into a complete clause
   ✗ "Quick alignment, then go." → ✓ "Let's quickly align, then move forward."

(3) Doubled / redundant verbs (Korean-English transfer error)
   ✗ "do we need a Deconstruct is needed?" → ✓ "Do we need to deconstruct it?"
   ✗ "I will plan to make a plan" → ✓ "I'll plan it out."

(4) A noun used as a verb or vice versa
   ✗ "we need a Deconstruct" → ✓ "we need to deconstruct it"
   ✗ "Let's a quick sync" → ✓ "Let's do a quick sync"

(5) Awkward Korean-English calque (literal translation patterns)
   ✗ "I want to flesh out this stage" (vague) → ✓ "I want to flesh out this plan" or specify what stage
   ✗ "Make a discussion" → ✓ "Have a discussion"

(6) Run-ons / weird connector flow between clauses
   ✗ "X makes sense or break down" → ✓ "X makes sense — or should we break it down further?"

DO NOT just return the sentence as-is when ANY of the above is present. Even if the meaning is roughly clear, the JOB is to make it polished. Native speakers will pause if it sounds off — fix it.

The ONLY case for verbatim return:
The sentence is already natural, grammatical, and reads exactly like a fluent native business speaker wrote it. If you have ANY doubt, edit. Defaulting to "verbatim" because the input is "complicated" or "uses lots of options" is WRONG — restructure into clean prose.

When unchanged, say so warmly in Korean ("이미 자연스러워요! 그대로 가셔도 됩니다.").
When edited, briefly explain the type of fix in Korean ("어순 / 전치사 / 동사·명사 혼용 교정 / 자연스러운 표현으로 다듬음.").

CRITICAL RULE 2 — PRESERVE THE TARGET WORD/PHRASE (NON-NEGOTIABLE):
The "Phrase being practiced" is the whole point of this exercise. The corrected sentence MUST contain that EXACT phrase (case-insensitive) or its closest grammatical inflection — e.g. "anchor" → "anchored" / "anchoring" / "anchors". This is a hard rule:

- DO NOT swap to a synonym, even if a synonym sounds more natural, more common, or more "business-y".
- DO NOT delete the phrase to "improve flow".
- If the student wrote "anchor", the output contains "anchor" (or anchored/anchoring/anchors). Period.
- If the student forgot to include the target phrase, REWRITE the sentence to fit the phrase in. Do not just hand back a phrase-less sentence.
- Verify your "corrected" output contains the target phrase BEFORE returning. If it doesn't, rewrite until it does.

Why this rule: the student is being TESTED on this exact phrase. Substituting it defeats the entire purpose of the drill. They will memorize whatever you return, so what you return MUST include the target.

CRITICAL RULE 3 — PROFESSIONAL BUSINESS TONE:
Default to a polished, professional business register suitable for cross-functional meetings, emails, and Slack with colleagues at a B2B/SaaS/finance/consulting workplace. Avoid:
- Casual fillers ("kinda", "stuff", "like"), slang, or texting style
- Overly stiff/archaic phrasing ("Dear Sir", "I beseech you")
- Vague hedging ("I just wanted to maybe...") — use crisp executive phrasing instead
Aim for: clear, confident, concise, polite. Think McKinsey deck speaker or senior PM in standup.
If the Korean intent is casual (e.g., 1:1 chat with a peer), match that tone — don't over-formalize. Use the Korean source as your tone anchor.

CRITICAL RULE 4 — DO NOT SWAP SYNONYMS (THE #1 LEARNER FRUSTRATION):
If the student's input is already grammatical and clearly conveys the meaning, **DO NOT** swap one valid English word for another valid English word that means roughly the same thing. The student will resubmit your "correction" and you may flip back — they end up confused about which is right.

Pairs that are 100% interchangeable in business English — DO NOT EDIT BETWEEN THEM:
- recognize ↔ acknowledge
- begin ↔ start ↔ kick off
- discuss ↔ talk about ↔ go over
- use ↔ utilize ↔ leverage
- show ↔ demonstrate ↔ illustrate
- help ↔ assist ↔ support
- finish ↔ complete ↔ wrap up
- many ↔ several ↔ multiple
- get ↔ obtain ↔ receive
- think ↔ believe
- big ↔ large ↔ significant
- fast ↔ quick ↔ rapid
- need ↔ require
- make sure ↔ ensure
- find out ↔ determine ↔ figure out
- end ↔ conclude
- accept ↔ agree to
- give ↔ provide

Only edit when grammar / structure / preposition / tense / article is **broken**, OR when the phrasing is **genuinely awkward** (Konglish, calque, unnatural word order). Stylistic preference alone is NOT a reason to edit.

If your ONLY edit would be a one-word synonym substitution from the list above (or a similar interchangeable pair), return the ORIGINAL VERBATIM with why = "이미 자연스러워요! 그대로 가셔도 됩니다." Do NOT make the edit just to "improve" word choice.

Self-check before returning: if you removed exactly one word and inserted exactly one synonym word with no other structural changes, REVERT to verbatim. Stop second-guessing the student on word choice — they need consistency to learn.

Field rules:
- "corrected": natural, minimally-edited business English that contains the target phrase. If no edits needed, return the ORIGINAL verbatim (no whitespace/punctuation changes either).
- "why": 1-2 sentences in Korean, friendly tone, under 140 characters. If no changes were made, say so explicitly so the learner can move on without doubt.

Do not include markdown, code fences, or any prose outside the JSON.`;

function buildSentenceUserMessage(
  word: { en: string; def?: string },
  sentence: string,
  korean?: string,
) {
  // Korean context (the 한국어 문장 the student wrote first) is the source of truth
  // for meaning. Read it BEFORE the English attempt so the model anchors on the
  // learner's intent instead of guessing from broken English.
  const koreanBlock = (korean || '').trim()
    ? `Korean sentence the student wrote (source of intent — match this meaning): "${korean!.trim()}"\n`
    : '';
  return `${koreanBlock}Phrase being practiced (KEEP THIS in the output): "${word.en}" (${word.def || ''})
Student's English attempt: "${sentence}"

Your goal: make this sentence sound like something a native English business speaker would naturally say in a real meeting / email / Slack — while keeping "${word.en}" inside.

Return JSON:
- "corrected": a polished, native-sounding business English sentence. **MUST contain "${word.en}"** (or a minimal grammatical inflection — e.g. "${word.en}d" / "${word.en}ing" / pluralized — never a synonym swap). MUST convey the same meaning as the Korean sentence above (if provided). Improve fluency: fix awkward word order, non-native phrasing, weird prepositions, clunky structure. Tone: business meeting / professional Slack / email-ready — clear, confident, concise. Avoid casual slang AND avoid stiff/archaic phrasing. **Edit aggressively for naturalness, but preserve the student's core intent + the target phrase.** If the sentence already reads as if a fluent native speaker wrote it (no awkward edges), return it VERBATIM.
- "why": 1-2 Korean sentences (≤140 chars). **If unchanged, say so warmly ("이미 자연스러워요! 그대로 가셔도 됩니다.")** — otherwise briefly explain what type of fix you made (e.g. "어순을 자연스럽게 / 전치사 교정 / 비즈니스 톤으로 다듬음.").`;
}

function buildStoryUserMessage(
  words: { en: string; def?: string; syn?: string[] }[],
  text: string,
  korean?: string,
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
  return `${koreanBlock}The student is tying today's 3 expressions into a short business-scenario mini story.
Each main expression has optional synonyms the student MAY have practiced as alternative phrasings:
${lines}

Student's English attempt: "${text}"

Your goal: produce a clean, native-sounding business mini-story that keeps the MAIN expressions intact, AND separately teach the synonyms with concrete usage guidance.

Return JSON with THREE fields:

1. "corrected" — polished, native-sounding business-English mini story.
   - MUST contain each MAIN expression at least once (or its inflection: tense / plural).
   - Edit aggressively for fluency: fix grammar, awkward word order, non-native phrasing, weird prepositions, choppy connectors. Native business speaker register.
   - You DO NOT need to keep every synonym the student wrote — feel free to drop redundant synonym variants if they make the prose awkward. Synonyms get proper treatment in field 3 below.
   - Only return verbatim if the text already reads as if a fluent native speaker wrote it.

2. "why" — 1-2 Korean sentences (≤140 chars). Friendly, brief.
   - If unchanged: "이미 흐름 좋아요! 수정할 부분 없어요." style.
   - If edited: short fix-type tag ("흐름 / 어순 / 자연스러운 표현으로 다듬었어요.").

3. "syn_examples" — array of objects, ONE entry for EACH synonym the student wrote in their text (skip synonyms they didn't actually use).
   Schema: [{ syn: string, context: string, example: string }]
   - "syn": the synonym phrase exactly as listed (e.g. "First cut", "Bring it home").
   - "context": ≤30자 Korean — when/where this synonym is naturally used (industry, situation, tone). Be SPECIFIC and TRUE — don't make up generic platitudes. Examples: "디자인·UX 분야 초안 단계에서 자주 써요" / "프로젝트 마무리 동기부여 톤" / "엔지니어링·QA 에서 빠른 검증 시점에".
   - "example": natural English example sentence (≤20 words) showing the synonym in a realistic business context. Different scenario from the student's text — broaden their understanding.
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
  // 2) Multi-word phrase — all tokens present?
  const tokens = t.split(/\s+/).filter((w) => w.length > 1);
  if (tokens.length > 1) {
    return tokens.every((tok) => c.includes(tok));
  }
  // 3) Single word — allow inflection by checking 4+ char prefix.
  const root = t.length >= 5 ? t.slice(0, t.length - 1) : t;
  return c.includes(root);
}

async function callOpenAI(userMessage: string): Promise<string> {
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
      // Forces the response to be valid JSON — much more reliable than
      // hoping the model stays within braces.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
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

  const mode = body?.mode; // 'sentence' | 'story'
  const text = String(body?.text || '').trim();
  // Korean intent sentence (optional). Used as the meaning anchor so the model
  // doesn't guess when the learner's English is ambiguous.
  const korean = String(body?.korean || '').trim().slice(0, 500);
  if (!text) return json({ error: 'text required' }, 400);
  if (text.length > 800) return json({ error: 'text too long' }, 400);

  try {
    let userMessage: string;
    if (mode === 'sentence') {
      const word = body?.word;
      if (!word?.en) return json({ error: 'word required' }, 400);
      userMessage = buildSentenceUserMessage(word, text, korean);
    } else if (mode === 'story') {
      const words = Array.isArray(body?.words) ? body.words : [];
      if (words.length < 1) return json({ error: 'words required' }, 400);
      userMessage = buildStoryUserMessage(words, text, korean);
    } else {
      return json({ error: 'mode must be sentence|story' }, 400);
    }

    const raw = await callOpenAI(userMessage);
    const parsed = extractJson(raw);
    let corrected = String(parsed?.corrected || text).trim();
    let why = String(parsed?.why || '').trim() ||
      '표현이 더 자연스럽게 들리도록 다듬었어요.';

    // 타겟 검증 — slot-based, 완화된 가드.
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
    // 사용자가 원문에서 실제로 쓴 phrase 목록 (변형/구두점 무시) — 슬롯별로 추적.
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
      // 누락 진단 — 어떤 슬롯이 통째로 사라졌는지.
      const missingDesc = missingSlots.map((slot) =>
        `(at least one of: ${slot.map((s) => `"${s}"`).join(' / ')})`
      ).join(', ');
      console.warn('[ai-review] entire slot(s) missing in corrected — retrying:', missingDesc);
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
    });
  } catch (e) {
    console.error('ai-review error', e);
    return json({ error: 'ai review failed', detail: String(e).slice(0, 200) }, 500);
  }
});
