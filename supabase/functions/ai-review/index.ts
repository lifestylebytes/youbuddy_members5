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

CRITICAL RULE 1 — DO NOT INVENT CHANGES:
If the student's sentence is already grammatical, natural, and clearly conveys the intended meaning (especially when matched against the Korean source if provided), return the sentence VERBATIM in "corrected" — character for character, including punctuation. In "why", explicitly say in friendly Korean that no changes were needed (e.g. "이미 잘 쓰셨어요! 자연스러운 비즈니스 영어예요." or "수정할 부분 없어요. 그대로 좋아요 :)").

Korean learners run AI review multiple times on the same sentence. If you keep "stylistically tweaking" already-correct sentences, the output keeps shifting and confuses them. Be conservative: only edit when there is a CLEAR grammar error, unnatural phrasing, or a meaning mismatch with the Korean intent. Stylistic preferences alone are NOT a reason to edit.

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
  return `${koreanBlock}Phrase being practiced (THE WHOLE POINT — keep this in the output): "${word.en}" (${word.def || ''})
Student's English attempt: "${sentence}"

Return JSON:
- "corrected": a polished, professional business-English sentence. **MUST contain "${word.en}" verbatim** (or a minimal grammatical inflection if needed: e.g. "${word.en}d" / "${word.en}ing" / pluralized — but do NOT replace it with a synonym). MUST convey the same meaning/intent as the Korean sentence above (if provided). Tone: business-meeting / professional Slack / email-ready. Avoid casual slang AND avoid stiff/archaic phrasing. Keep the learner's voice; change as little as possible. **If the student's sentence is already correct, natural, and uses the target phrase, return it VERBATIM with zero changes.**
- "why": 1-2 Korean sentences (≤140 chars). **If unchanged, say so explicitly (e.g. "이미 자연스러워요! 그대로 가셔도 됩니다.")** — otherwise explain what changed and why (e.g. "톤을 살짝 비즈니스 미팅 풍으로 다듬었어요.").`;
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
Expression slots — for each slot, the student may use EITHER the main expression OR one of its listed synonyms, AND THEY MAY ALSO USE BOTH (main + synonym in different sentences) AS A LEARNING DEVICE. Treat both variants as equally valid:
${lines}

Student's English attempt: "${text}"

Return JSON:
- "corrected": a polished business-English mini story. **CRITICAL: do NOT condense, deduplicate, or remove sentences just because they repeat the same idea using a synonym variant.** If the student wrote one sentence with the main expression AND another sentence with a synonym (e.g. "We need a first pass." + "First cut is very important."), KEEP BOTH SENTENCES — the student is intentionally practicing both variants. Preserve every expression/synonym the student wrote; only fix grammar, awkward phrasing, or unclear flow. The story may end up 4-7 sentences if the student practiced 6 variants — that's fine. Minimal grammatical inflection allowed (tense, plural). Tone: professional business — clear, confident, concise. Avoid casual slang and stiff/archaic phrasing. **If the student's text is already natural, return it VERBATIM.**
- "why": 1-2 Korean sentences (≤140 chars). **If unchanged, explicitly say so (e.g. "이미 흐름 좋아요! 수정할 부분 없어요.")** — otherwise explain the flow/logic/tone fix. Do NOT mention "removed" or "condensed" — you are not allowed to remove the student's variants.`;
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
      temperature: 0.3,
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

    // 타겟 검증 — slot-based.
    // sentence 모드: 슬롯 1개, 메인 단어 verbatim 강제.
    // story 모드: 슬롯 N개 (단어 수), 각 슬롯은 [메인, ...syn] 중 하나만 들어가면 통과.
    //   PLUS: 사용자가 같은 슬롯에서 메인 + 유의어 둘 다 썼으면 둘 다 보존돼야 함 (학습 의도).
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
    // story 모드에서 메인+유의어를 둘 다 썼으면 둘 다 corrected 에 살아있어야 통과.
    const usedByUser: string[][] = targetSlots.map((slot) =>
      slot.filter((phrase) => correctedContainsTarget(text, phrase))
    );
    const missingSlots = targetSlots.filter((slot, i) => {
      const userUsed = usedByUser[i];
      if (userUsed.length === 0) {
        // 사용자가 슬롯의 어떤 변형도 안 썼으면 → 슬롯에서 아무거나 하나만 있으면 OK.
        return !slot.some((phrase) => correctedContainsTarget(corrected, phrase));
      }
      // 사용자가 1개 이상 변형을 썼으면 → 그 변형들 ALL 이 corrected 에 살아있어야 함.
      return !userUsed.every((phrase) => correctedContainsTarget(corrected, phrase));
    });
    if (missingSlots.length > 0) {
      // 누락 진단 — 어떤 phrase 가 빠졌는지 구체적으로.
      const missingPhrases: string[] = [];
      targetSlots.forEach((slot, i) => {
        const userUsed = usedByUser[i];
        if (userUsed.length === 0) {
          if (!slot.some((p) => correctedContainsTarget(corrected, p))) {
            missingPhrases.push(`(at least one of: ${slot.map((s) => `"${s}"`).join(' / ')})`);
          }
        } else {
          userUsed.forEach((p) => {
            if (!correctedContainsTarget(corrected, p)) missingPhrases.push(`"${p}" (student wrote this)`);
          });
        }
      });
      const missingDesc = missingPhrases.join(', ');
      console.warn('[ai-review] target phrase(s) missing in corrected — retrying:', missingDesc);
      const retryMsg = `Your previous response dropped these phrases that the student EXPLICITLY wrote: ${missingDesc}. ${
        mode === 'story'
          ? 'CRITICAL: keep every phrase the student wrote (main expression AND any synonym variants they practiced). Do NOT condense or de-duplicate even if two sentences express similar ideas — the student is intentionally practicing both variants. Only fix grammar/awkward phrasing.'
          : 'Rewrite so the phrase is contained verbatim (or with grammatical inflection only).'
      } Same JSON shape.`;
      try {
        const retryRaw = await callOpenAI(`${userMessage}\n\n${retryMsg}`);
        const retryParsed = extractJson(retryRaw);
        const retryCorrected = String(retryParsed?.corrected || '').trim();
        const stillMissing = targetSlots.filter((slot, i) => {
          const userUsed = usedByUser[i];
          if (userUsed.length === 0) {
            return !slot.some((p) => correctedContainsTarget(retryCorrected, p));
          }
          return !userUsed.every((p) => correctedContainsTarget(retryCorrected, p));
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
