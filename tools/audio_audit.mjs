#!/usr/bin/env node
/* AI 음성 전수검사 (2026-11-02, 10기 Sue님 제보: 화면은 "We tend to undersell" 인데 음성은 "We undersold")
   원인: 예문 글자를 고쳐도 mp3 는 옛 문장 그대로 남는다 (generate_tts 는 이미 있는 파일을 건너뜀).
   검사: 각 mp3 가 마지막으로 커밋된 시점의 index.html 에 지금 화면 문장이 있었는지 본다.
         없었으면 = 음성을 만든 뒤에 문장이 바뀐 것 = 다시 만들어야 함.
   사용: node tools/audio_audit.mjs 10th            (전체)
         node tools/audio_audit.mjs 10th --fix-list (다시 만들 파일 지우는 명령까지 출력) */
import fs from 'fs';
import vm from 'vm';
import { execSync } from 'child_process';

const C = process.argv[2] || '10th';
const FIX = process.argv.includes('--fix-list');
const html = fs.readFileSync(`${C}/index.html`, 'utf8');
const s = html.indexOf('const CHALLENGE = {');
let i = html.indexOf('{', s), d = 0, end = -1, q = null, e = false;
for (let j = i; j < html.length; j++) {
  const c = html[j];
  if (q) { if (e) e = false; else if (c === '\\') e = true; else if (c === q) q = null; continue; }
  if (c === '"' || c === "'" || c === '`') { q = c; continue; }
  if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j + 1; break; } }
}
const CH = vm.runInNewContext('(' + html.slice(i, end) + ')');
let SYN = {};
const ms = html.match(/const SYN_EXAMPLES = \{[\s\S]*?\n\};/);
if (ms) SYN = vm.runInNewContext(ms[0] + '\nSYN_EXAMPLES');

const jobs = [];
CH.weeks.forEach((wk) => wk.days.forEach((dd) => dd.words.forEach((w, k) => {
  jobs.push({ day: dd.day, file: `d${dd.day}-${k}-en.mp3`, text: w.en });
  jobs.push({ day: dd.day, file: `d${dd.day}-${k}-ex.mp3`, text: w.ex_en });
  (w.syn || []).forEach((sy, si) => {
    jobs.push({ day: dd.day, file: `d${dd.day}-${k}-s${si}-en.mp3`, text: sy });
    const ex = SYN[`${w.en}::${sy}`];
    if (ex && ex.en) jobs.push({ day: dd.day, file: `d${dd.day}-${k}-s${si}-ex.mp3`, text: ex.en });
  });
})));

const cache = {};
const variants = (t) => [t, JSON.stringify(t).slice(1, -1), t.replace(/'/g, "\\'"), t.replace(/"/g, '\\"')];
const missing = [], mismatch = [];
let ok = 0;
for (const j of jobs) {
  const fp = `${C}/audio/${j.file}`;
  if (!fs.existsSync(fp)) { missing.push(j.file); continue; }
  const sha = execSync(`git log -1 --format=%H -- "${fp}"`).toString().trim();
  if (!sha) { missing.push(j.file + ' (커밋 안 됨)'); continue; }
  if (!cache[sha]) cache[sha] = execSync(`git show ${sha}:${C}/index.html`, { maxBuffer: 1e9 }).toString();
  if (!variants(j.text).some((v) => cache[sha].includes(v))) mismatch.push({ day: j.day, file: j.file, now: j.text });
  else ok++;
}
console.log(`\n🔊 ${C} 음성 전수검사: 전체 ${jobs.length} · 정상 ${ok} · 없음 ${missing.length} · 문장 바뀜 ${mismatch.length}`);
if (missing.length) console.log('\n없는 파일:\n  ' + missing.join('\n  '));
if (mismatch.length) {
  console.log('\n음성 만든 뒤 문장이 바뀐 파일 (다시 만들어야 함):');
  mismatch.forEach((m) => console.log(`  Day ${m.day}  ${m.file}  →  지금 화면: "${m.now}"`));
  if (FIX) {
    console.log('\n터미널에 붙여넣기:');
    console.log(`rm ${mismatch.map((m) => `${C}/audio/${m.file}`).join(' ')}`);
    console.log(`COHORT=${C} OPENAI_API_KEY=sk-... node tools/generate_tts.mjs 1 20`);
    console.log(`git add ${C}/audio && git commit -m "음성 다시 생성 (문장 바뀐 것)" && git push`);
  }
}
process.exit(mismatch.length || missing.length ? 1 : 0);
