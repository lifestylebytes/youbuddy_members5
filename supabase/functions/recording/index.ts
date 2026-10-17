// supabase/functions/recording/index.ts
// 11기 · 앱 녹음 인증 (2026-10-17)
//
// mode 'submit' : 녹음(base64) 받기 → Storage 저장 → OpenAI 음성인식 → 내 문장 3개와 대조 → recording_events 기록
//                 → 2문장 이상 일치면 녹음 체크 자동 ON (mark_recording_check). 음성인식이 실패해도 녹음은 인정 (stt_ok=false).
// mode 'url'    : 본인 녹음 재생용 서명 URL (10분). 버킷은 비공개라 이 경로로만 들을 수 있다.
// mode 'purge'  : 기수 종료 + 30일 지난 파일 삭제. (cron 또는 예약 태스크가 호출)
//
// 배포:  supabase functions deploy recording
// 비밀:  OPENAI_API_KEY 는 ai-review 와 같은 것을 쓴다. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 자동 주입.
//
// 설계 원칙 (멤버가 억울하지 않게):
//  - 음성인식은 "확인"이지 "심판"이 아니다. 서버 오류·인식 실패는 멤버 탓이 아니므로 인증을 막지 않는다.
//  - 2/3 문장만 들려도 통과. 1개 이하면 다시 녹음을 권하되, 3번째 시도부터는 무조건 통과시키고 운영진 확인 플래그만 남긴다.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const BUCKET = 'recordings';
const MAX_BYTES = 5 * 1024 * 1024;
const PASS_MATCHED = 2;       // 3문장 중 2개 들리면 통과
const FORCE_PASS_ATTEMPT = 3; // 3번째 시도부터는 무조건 통과 (운영진 확인 플래그)
// 기수별 종료일. purge 가 "종료 + 30일" 계산에 쓴다. 새 기수 열면 추가.
const COHORT_END: Record<string, string> = { '11기': '2026-12-11' };

function admin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── 문장 대조 ─────────────────────────────────────────────
const STOP = new Set(['the','a','an','to','of','and','is','are','be','it','we','i','you','that','this','for','on','in','at','with','so','as','by','our','my','your','will','can','let','lets',"let's",'just','um','uh']);
function tokens(s: string): string[] {
  return String(s || '').toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/).filter((t) => t && !STOP.has(t));
}
// 문장 하나가 transcript 안에 얼마나 들어있는지 (0~1). 핵심 토큰 기준.
function sentenceScore(target: string, transcriptTokens: string[]): number {
  const t = tokens(target);
  if (t.length === 0) return 1;
  const bag = new Map<string, number>();
  transcriptTokens.forEach((w) => bag.set(w, (bag.get(w) || 0) + 1));
  let hit = 0;
  for (const w of t) {
    const n = bag.get(w) || 0;
    if (n > 0) { hit++; bag.set(w, n - 1); continue; }
    // 어미 차이(rolled/rollout, meeting/meetings) 는 앞 5글자 일치로 인정
    const stem = w.slice(0, Math.max(4, Math.min(5, w.length)));
    for (const [k, c] of bag) {
      if (c > 0 && k.length >= 4 && k.startsWith(stem)) { hit++; bag.set(k, c - 1); break; }
    }
  }
  return hit / t.length;
}

// ── OpenAI 음성인식 ───────────────────────────────────────
async function transcribe(bytes: Uint8Array, mime: string, hint: string): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const ext = mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac') ? 'm4a'
    : mime.includes('mpeg') ? 'mp3' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime || 'audio/webm' }), `rec.${ext}`);
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('language', 'en');
  form.append('response_format', 'json');
  // 학습자가 읽을 문장을 힌트로 주면 고유명사·구동사 인식률이 크게 오른다.
  if (hint) form.append('prompt', hint.slice(0, 800));
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 40000);
  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`stt ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return String(data?.text || '');
  } finally { clearTimeout(to); }
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',').pop()! : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// Storage 키는 ASCII 만 허용된다 (한글 넣으면 "Invalid key"). 한글은 URL 인코딩 후 % 를 _ 로.
const safe = (s: string) => encodeURIComponent(String(s || '')).replace(/%/g, '_').replace(/[^A-Za-z0-9_.\-]/g, '_').slice(0, 80);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const mode = body?.mode;

  // ── submit ─────────────────────────────────────────────
  if (mode === 'submit') {
    const cohort = String(body.cohort || '').trim();
    const member = String(body.member || '').trim();
    const day = Number(body.day);
    const mime = String(body.mime || 'audio/webm');
    const durationMs = Number(body.duration_ms || 0);
    const attempt = Math.max(1, Number(body.attempt || 1));
    const sentences: string[] = Array.isArray(body.sentences) ? body.sentences.map((s: any) => String(s || '').slice(0, 400)).filter(Boolean).slice(0, 3) : [];
    if (!cohort || !member || !day || !body.audio_b64) return json({ error: 'cohort, member, day, audio_b64 required' }, 400);

    let bytes: Uint8Array;
    try { bytes = b64ToBytes(body.audio_b64); } catch { return json({ error: 'bad audio' }, 400); }
    if (bytes.length < 2000) return json({ error: 'too_short', message: '녹음이 너무 짧아요. 다시 한 번 눌러서 녹음해주세요.' }, 400);
    if (bytes.length > MAX_BYTES) return json({ error: 'too_large', message: '녹음이 너무 길어요. 60초 안에 세 문장만 읽어주세요.' }, 400);

    const sb = admin();
    const ext = mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : mime.includes('ogg') ? 'ogg' : 'webm';
    const path = `${safe(cohort)}/${safe(member)}/d${day}-${Date.now()}.${ext}`;

    // 1) 저장 (실패하면 인증도 못 하니 여기서 멈춘다)
    const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (up.error) return json({ error: 'upload_failed', message: '녹음을 저장하지 못했어요. 네트워크 확인 후 다시 시도해주세요.', detail: up.error.message }, 500);

    // 2) 음성인식 + 대조 (실패해도 인증은 막지 않는다)
    let transcript = ''; let sttOk = true; let scores: number[] = []; let matched = 0;
    try {
      transcript = await transcribe(bytes, mime, sentences.join(' '));
      const tt = tokens(transcript);
      scores = sentences.map((s) => Math.round(sentenceScore(s, tt) * 100) / 100);
      matched = scores.filter((x) => x >= 0.6).length;
    } catch (e) {
      sttOk = false; scores = sentences.map(() => 0); matched = 0;
      console.error('stt failed', String(e));
    }
    const forced = attempt >= FORCE_PASS_ATTEMPT;
    const verified = sttOk ? (matched >= PASS_MATCHED || forced) : true; // STT 실패 = 멤버 탓 아님 → 인정
    const needsReview = !sttOk || (forced && matched < PASS_MATCHED);

    // 3) 로그 (append-only)
    await sb.from('recording_events').insert({
      cohort, member_key: member, day_n: day, path, mime, duration_ms: durationMs,
      transcript: transcript.slice(0, 2000), scores, matched, verified, stt_ok: sttOk,
    });

    // 4) 녹음 체크 자동 ON
    if (verified) {
      const r = await sb.rpc('mark_recording_check', { p_cohort: cohort, p_member: member, p_day: day });
      if (r.error) console.error('mark_recording_check failed', r.error.message);
    }

    return json({
      ok: true, verified, matched, scores, stt_ok: sttOk, needs_review: needsReview, path,
      transcript: transcript.slice(0, 600),
      // 멤버에게 보여줄 한 줄 (앱이 그대로 써도 되고 자체 문구를 써도 된다)
      message: !sttOk ? '녹음은 잘 받았어요. 음성 확인이 잠깐 안 돼서 운영진이 한 번 들어볼게요. 인증은 완료예요!'
        : verified ? (matched === 3 ? '세 문장 다 들렸어요! 오늘 녹음 인증 완료 🎉' : forced && matched < PASS_MATCHED ? '여러 번 시도해주셨네요. 녹음 인증은 완료로 처리하고, 운영진이 한 번 들어볼게요.' : '두 문장은 또렷하게 들렸어요. 녹음 인증 완료!')
        : (matched === 1 ? '한 문장만 들렸어요. 조금 천천히, 또박또박 세 문장을 읽어주세요.' : '제가 쓴 문장이 잘 안 들려요. 마이크 가까이에서 세 문장을 읽어주세요.'),
    });
  }

  // ── url : 본인 녹음 재생용 서명 URL ─────────────────────
  if (mode === 'url') {
    const path = String(body.path || '');
    if (!path || path.includes('..')) return json({ error: 'path required' }, 400);
    const sb = admin();
    const r = await sb.storage.from(BUCKET).createSignedUrl(path, 600);
    if (r.error) return json({ error: 'sign_failed', detail: r.error.message }, 500);
    return json({ ok: true, url: r.data.signedUrl });
  }

  // ── purge : 기수 종료 + 30일 지난 파일 삭제 ───────────────
  if (mode === 'purge') {
    const sb = admin();
    const now = Date.now();
    const removed: string[] = [];
    for (const [cohort, end] of Object.entries(COHORT_END)) {
      const cutoff = new Date(end).getTime() + 30 * 86400000;
      if (now < cutoff) continue;
      const { data: rows } = await sb.from('recording_events').select('id,path').eq('cohort', cohort).not('path', 'is', null);
      const paths = (rows || []).map((r: any) => r.path).filter(Boolean);
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100);
        const del = await sb.storage.from(BUCKET).remove(chunk);
        if (!del.error) removed.push(...chunk);
      }
      // 로그는 남기되 파일 경로만 비운다 (인증 이력은 보존)
      await sb.from('recording_events').update({ path: '' }).eq('cohort', cohort);
    }
    return json({ ok: true, removed: removed.length });
  }

  return json({ error: 'mode must be submit|url|purge' }, 400);
});
