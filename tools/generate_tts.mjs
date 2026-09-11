#!/usr/bin/env node
/* ============================================================
   유비챌 단어·예문 AI 음성 생성기 (2026-08-14)
   ------------------------------------------------------------
   {기수}/index.html 의 CHALLENGE 데이터에서 단어(en)와 예문(ex_en)을 뽑아
   OpenAI TTS 로 mp3 를 만들어 {기수}/audio/ 에 저장한다. (기수는 COHORT 환경변수, 기본 9th)
   이미 있는 파일은 건너뛰므로 끊겨도 다시 실행하면 이어서 만든다.

   사용법:
     OPENAI_API_KEY=sk-... node tools/generate_tts.mjs 1 20              # 9기 전체 (기본)
     COHORT=8th OPENAI_API_KEY=sk-... node tools/generate_tts.mjs 6 20   # 다른 기수
     OPENAI_API_KEY=sk-... node tools/generate_tts.mjs 1 20 shimmer      # 목소리 변경

   목소리: nova(기본·밝은 여성) alloy echo fable onyx shimmer
   끝나면: git add {기수}/audio && git commit && git push
   ============================================================ */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('❌ OPENAI_API_KEY 환경변수가 필요해요'); process.exit(1); }

const COHORT = process.env.COHORT || '9th';
const FROM = Number(process.argv[2] || 1);
const TO = Number(process.argv[3] || 20);
const VOICE = process.argv[4] || 'nova';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, `${COHORT}/index.html`), 'utf8');

// CHALLENGE 리터럴을 중괄호 짝 맞춰 잘라낸다
const start = html.indexOf('const CHALLENGE = {');
if (start < 0) throw new Error('CHALLENGE 를 못 찾았어요');
let i = html.indexOf('{', start), depth = 0, end = -1;
for (let j = i; j < html.length; j++) {
  const c = html[j];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
}
const CHALLENGE = vm.runInNewContext('(' + html.slice(i, end) + ')');

const outDir = path.join(ROOT, `${COHORT}/audio`);
fs.mkdirSync(outDir, { recursive: true });

// 유의어 예문 사전(SYN_EXAMPLES)도 같이 읽는다 (유의어 듣기 버튼이 기계음이 되지 않게)
let SYN_EX = {};
try {
  const ms = html.match(/const SYN_EXAMPLES = \{[\s\S]*?\n\};/);
  if (ms) SYN_EX = vm.runInNewContext(ms[0] + '\nSYN_EXAMPLES');
} catch (e) { console.warn('SYN_EXAMPLES 파싱 실패, 유의어 예문은 건너뜁니다'); }

const jobs = [];
(CHALLENGE.weeks || []).forEach((wk) => (wk.days || []).forEach((d) => {
  if (d.day < FROM || d.day > TO) return;
  (d.words || []).forEach((w, k) => {
    if (w.en) jobs.push({ file: `d${d.day}-${k}-en.mp3`, text: w.en });
    if (w.ex_en) jobs.push({ file: `d${d.day}-${k}-ex.mp3`, text: w.ex_en });
    (w.syn || []).forEach((sy, si) => {
      if (sy) jobs.push({ file: `d${d.day}-${k}-s${si}-en.mp3`, text: sy });
      const ex = SYN_EX[`${w.en}::${sy}`];
      if (ex && ex.en) jobs.push({ file: `d${d.day}-${k}-s${si}-ex.mp3`, text: ex.en });
    });
  });
}));
console.log(`${COHORT} · Day ${FROM}~${TO} · 목소리 ${VOICE} · 클립 ${jobs.length}개`);

let made = 0, skipped = 0, failed = 0;
for (const job of jobs) {
  const fp = path.join(outDir, job.file);
  if (fs.existsSync(fp) && fs.statSync(fp).size > 1000) { skipped++; continue; }
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: VOICE, input: job.text, response_format: 'mp3' }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
    fs.writeFileSync(fp, Buffer.from(await res.arrayBuffer()));
    made++;
    process.stdout.write(`\r✅ ${made}개 생성 (건너뜀 ${skipped})  ${job.file}        `);
    await new Promise((r) => setTimeout(r, 150));
  } catch (e) {
    failed++;
    console.error(`\n✗ ${job.file}: ${e.message}`);
  }
}
console.log(`\n완료: 생성 ${made} · 건너뜀 ${skipped} · 실패 ${failed}`);
console.log(`다음: git add ${COHORT}/audio && git commit -m "feat(${COHORT}): AI 음성" && git push`);
