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
- "corrected" is natural, minimally-edited business English.
- "why" is 1-2 sentences in Korean, friendly tone, under 140 characters.
Do not include markdown, code fences, or any prose outside the JSON.`;

function buildSentenceUserMessage(word: { en: string; def?: string }, sentence: string) {
  return `Phrase being practiced: "${word.en}" (${word.def || ''})
Student's attempt: "${sentence}"

Return JSON:
- "corrected": a natural business-English sentence that MUST naturally contain "${word.en}". Keep the learner's voice; change as little as possible.
- "why": 1-2 Korean sentences (≤140 chars) explaining what changed and why.`;
}

function buildStoryUserMessage(words: { en: string; def?: string }[], text: string) {
  const lines = (words || []).map((w) => `- "${w.en}" (${w.def || ''})`).join('\n');
  return `The student is tying today's 3 expressions into ONE short business-scenario mini story (1-3 sentences).
Expressions to use:
${lines}
Student's attempt: "${text}"

Return JSON:
- "corrected": a natural business-English mini story (1-3 sentences) that uses ALL 3 expressions in a believable flow.
- "why": 1-2 Korean sentences (≤140 chars) explaining the flow/logic fix.`;
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
  if (!text) return json({ error: 'text required' }, 400);
  if (text.length > 800) return json({ error: 'text too long' }, 400);

  try {
    let userMessage: string;
    if (mode === 'sentence') {
      const word = body?.word;
      if (!word?.en) return json({ error: 'word required' }, 400);
      userMessage = buildSentenceUserMessage(word, text);
    } else if (mode === 'story') {
      const words = Array.isArray(body?.words) ? body.words : [];
      if (words.length < 1) return json({ error: 'words required' }, 400);
      userMessage = buildStoryUserMessage(words, text);
    } else {
      return json({ error: 'mode must be sentence|story' }, 400);
    }

    const raw = await callOpenAI(userMessage);
    const parsed = extractJson(raw);
    const corrected = String(parsed?.corrected || text).trim();
    const why = String(parsed?.why || '').trim() ||
      '표현이 더 자연스럽게 들리도록 다듬었어요.';

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
