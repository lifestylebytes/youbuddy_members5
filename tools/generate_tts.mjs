#!/usr/bin/env node
/* ============================================================
   유비챌 단어·예문 AI 음성 생성기 (2026-08-14)
   ------------------------------------------------------------
   8th/index.html 의 CHALLENGE 데이터에서 단어(en)와 예문(ex_en)을 뽑아
   OpenAI TTS 로 mp3 를 만들어 8th/audio/ 에 저장한다.
   이미 있는 파일은 건너뛰므로 끊겨도 다시 실행하면 이어서 만든다.

   사용법:
     OPENAI_API_KEY=sk-... node tools/generate_tts.mjs            # Day 6~20
     OPENAI_API_KEY=sk-... node tools/generate_tts.mjs 1 20      # 전체
     OPENAI_API_KEY=sk-... node tools/generate_tts.mjs 6 20 shimmer  # 목소리 변경

   목소리: nova(기본·밝은 여성) alloy echo fable onyx shimmer
   끝나면: git add 8th/audio && git commit && git push
   ============================================================ */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('❌ OPENAI_API_KEY 환경변수가 필요해요'); process.exit(1); }

const FROM = Number(process.argv[2] || 6);
const TO = Number(process.argv[3] || 20);
const VOICE = process.argv[4] || 'nova';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, '8th/index.html'), 'utf8');

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

const outDir = path.join(ROOT, '8th/audio');
fs.mkdirSync(outDir, { recursive: true });

const jobs = [];
(CHALLENGE.weeks || []).forEach((wk) => (wk.days || []).forEach((d) => {
  if (d.day < FROM || d.day > TO) return;
  (d.words || []).forEach((w, k) => {
    if (w.en) jobs.push({ file: `d${d.day}-${k}-en.mp3`, text: w.en });
    if (w.ex_en) jobs.push({ file: `d${d.day}-${k}-ex.mp3`, text: w.ex_en });
  });
}));
console.log(`Day ${FROM}~${TO} · 목소리 ${VOICE} · 클립 ${jobs.length}개`);

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
console.log('다음: git add 8th/audio && git commit -m "feat(8기): AI 음성" && git push');
