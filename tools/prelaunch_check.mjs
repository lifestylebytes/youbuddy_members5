#!/usr/bin/env node
/* ============================================================
   새 기수 시작 전 자동 점검 (2026-10-19)
   ------------------------------------------------------------
   10기 Day 1 아침에 "단어·예문 소리가 안 나요"로 AI 음성 누락을 발견한 뒤 만들었다.
   시작하고 나서 발견하면 늦는 것들을 코드에서 직접 확인한다.

   사용법:
     node tools/prelaunch_check.mjs 11th          # 11기 점검 (이전 기수는 자동으로 10th)
     node tools/prelaunch_check.mjs 11th 10th     # 이전 기수 직접 지정

   결과: ❌ = 시작 전에 반드시 / ⚠️ = 확인 필요 / ✅ = 통과
   자동으로 못 보는 것(배포·SQL 실행·폰 실기 테스트)은 맨 아래 "손으로 확인" 목록으로 나온다.
   ============================================================ */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const COHORT = process.argv[2] || '11th';
const n = parseInt(COHORT, 10);
const PREV = process.argv[3] || `${n - 1}th`;
const html = fs.readFileSync(path.join(ROOT, COHORT, 'index.html'), 'utf8');
const prevHtml = fs.existsSync(path.join(ROOT, PREV, 'index.html')) ? fs.readFileSync(path.join(ROOT, PREV, 'index.html'), 'utf8') : '';

const results = [];
const ok = (t) => results.push(['✅', t]);
const bad = (t, fix) => results.push(['❌', t + (fix ? `\n     → ${fix}` : '')]);
const warn = (t, fix) => results.push(['⚠️', t + (fix ? `\n     → ${fix}` : '')]);

// 중괄호/대괄호 짝 맞춰 리터럴 잘라내기
function literal(src, decl) {
  const s = src.indexOf(decl);
  if (s < 0) return null;
  const open = src.slice(s).search(/[{[]/) + s;
  const oc = src[open], cc = oc === '{' ? '}' : ']';
  let depth = 0, inStr = null, esc = false;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === oc) depth++;
    else if (c === cc) { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return null;
}
const evalLit = (lit, ctx = {}) => { try { return vm.runInNewContext('(' + lit + ')', ctx); } catch (e) { return null; } };

function challengeOf(src) {
  const lit = literal(src, 'const CHALLENGE = {');
  return lit ? evalLit(lit) : null;
}
function wordsOf(ch) {
  const out = [];
  (ch?.weeks || []).forEach((wk) => (wk.days || []).forEach((d) => (d.words || []).forEach((w, i) => out.push({ day: d.day, i, ...w }))));
  return out;
}

const CH = challengeOf(html);
if (!CH) { console.log('❌ CHALLENGE 를 못 읽었어요. index.html 구조 확인 필요'); process.exit(1); }
const words = wordsOf(CH);
const prevWords = wordsOf(challengeOf(prevHtml));

console.log(`\n🚦 ${CH.cohort} 시작 전 점검  (${CH.start_date} ~ ${CH.end_date}, 비교 기수 ${PREV})\n`);

// 1. 단어 60
if (words.length === 60 && words.every((w) => w.en && w.def && w.ex_en && w.ex_kr)) ok('단어 60개 · 뜻·예문 다 있음');
else bad(`단어 ${words.length}개, 빈 칸 있는 단어 ${words.filter((w) => !(w.en && w.def && w.ex_en && w.ex_kr)).length}개`, '단어 데이터 주입 다시 확인');

// 2. 이전 기수 단어와 겹침
const prevSet = new Set(prevWords.map((w) => w.en.toLowerCase()));
const dup = words.filter((w) => prevSet.has(w.en.toLowerCase()));
if (dup.length) warn(`이전 기수(${PREV})와 같은 단어 ${dup.length}개: ${dup.map((w) => w.en).join(', ')}`, '재사용 의도인지 확인');
else ok(`이전 기수(${PREV})와 단어 안 겹침`);

// 3. AI 음성
const audioDir = path.join(ROOT, COHORT, 'audio');
const audioFiles = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter((f) => f.endsWith('.mp3')) : [];
const needAudio = [];
words.forEach((w) => {
  needAudio.push(`d${w.day}-${w.i}-en.mp3`, `d${w.day}-${w.i}-ex.mp3`);
  (w.syn || []).forEach((_, k) => needAudio.push(`d${w.day}-${w.i}-s${k}-en.mp3`));
});
const missingAudio = needAudio.filter((f) => !audioFiles.includes(f));
if (!missingAudio.length) ok(`AI 음성 ${audioFiles.length}개 (단어·예문·유의어 전부)`);
else bad(`AI 음성 ${missingAudio.length}개 없음 (있는 것 ${audioFiles.length}개). 이대로 시작하면 🔊 가 기계음/무음`,
  `터미널: COHORT=${COHORT} OPENAI_API_KEY=sk-... node tools/generate_tts.mjs 1 20  →  git add ${COHORT}/audio && git commit -m "AI 음성" && git push`);

// 4. 유의어 설명·예문
const SG = evalLit(literal(html, 'const SYNONYM_GLOSSARY = {') || '{}') || {};
const SE = evalLit(literal(html, 'const SYN_EXAMPLES = {') || '{}') || {};
let synTotal = 0, synNoGloss = [], synNoEx = [];
words.forEach((w) => (w.syn || []).forEach((sy) => {
  synTotal++;
  if (!SG[sy] && !SG[sy.toLowerCase()]) synNoGloss.push(sy);
  if (!SE[`${w.en}::${sy}`]) synNoEx.push(`${w.en}::${sy}`);
}));
if (!synNoGloss.length && !synNoEx.length) ok(`유의어 ${synTotal}개 뜻·예문 다 있음`);
else warn(`유의어 ${synTotal}개 중 뜻 없음 ${synNoGloss.length} · 예문 없음 ${synNoEx.length} (기본 문구로 나감)`, 'SYNONYM_GLOSSARY / SYN_EXAMPLES 채우기');

// 5. 멤버 명단
const dirLit = literal(html, 'const MEMBER_DIRECTORY = [');
const dir = evalLit(dirLit || '[]') || [];
const members = dir.filter((m) => !m.isStaff && !m.isOperator);
if (members.length) ok(`멤버 명단 ${members.length}명 등록`);
else bad('멤버 명단 0명', '결제자 시트 순서대로 MEMBER_DIRECTORY 에 code 03~ 추가 + 접속 코드 1:1 발송');

// 6. 카톡방 / 드라이브
const kakao = (html.match(/basic:\s*'(https:\/\/open\.kakao\.com\/o\/[^']+)'/) || [])[1] || '';
const prevKakao = (prevHtml.match(/basic:\s*'(https:\/\/open\.kakao\.com\/o\/[^']+)'/) || [])[1] || '';
if (!kakao) bad('카톡방 링크 없음', 'KAKAO_ROOMS.basic');
else if (kakao === prevKakao) bad(`카톡방 링크가 ${PREV} 와 같음 (${kakao})`, '새 기수 방 링크로');
else ok(`카톡방 ${kakao}`);
const drive = (html.match(/const COHORT_DRIVE_URL = '([^']*)'/) || [])[1];
if (drive) ok('단어집 드라이브 링크 있음');
else warn('단어집 드라이브 링크(COHORT_DRIVE_URL) 비어 있음', '수료일 전까지만 채우면 됨. 시작 전엔 경고만');

// 7. 유버디 톡 원고: 이전 기수 단어가 남아 있나
const opsLine = html.split('\n').find((l) => l.startsWith('const OPS_TALK = '));
let OPS = null;
try { OPS = JSON.parse(opsLine.replace('const OPS_TALK = ', '').replace(/;\s*$/, '')); } catch (e) {}
if (!OPS) warn('OPS_TALK 를 못 읽었어요');
else {
  const curSet = new Set(words.map((w) => w.en.toLowerCase()));
  const prevOnly = prevWords.map((w) => w.en).filter((e) => !curSet.has(e.toLowerCase()) && e.length >= 6);
  const hits = [];
  for (const sec of ['morning', 'spoon', 'tip', 'senior', 'review']) {
    for (const [d, txt] of Object.entries(OPS[sec] || {})) {
      const low = String(txt).toLowerCase();
      prevOnly.forEach((e) => { if (low.includes(e.toLowerCase())) hits.push(`${sec} ${d}: ${e}`); });
    }
  }
  if (hits.length) bad(`유버디 톡 원고에 ${PREV} 단어가 ${hits.length}곳 남음 (예: ${hits.slice(0, 5).join(' / ')})`, 'OPS_TALK 모닝·스푼·팁을 이번 기수 단어로 다시 쓰기');
  else ok('유버디 톡 원고에 이전 기수 단어 없음');
  const missDays = [];
  for (let d = 1; d <= 20; d++) { if (!OPS.morning?.[d]) missDays.push(`모닝${d}`); if (!OPS.spoon?.[d]) missDays.push(`스푼${d}`); }
  if (missDays.length) warn(`유버디 톡 빈 원고: ${missDays.join(', ')}`);
  else ok('유버디 톡 모닝·스푼 20일치 다 있음');
  const banned = [];
  for (const sec of Object.keys(OPS)) for (const [d, txt] of Object.entries(OPS[sec] || {})) if (/마감[이은도]?\s*없/.test(String(txt))) banned.push(`${sec} ${d}`);
  if (banned.length) bad(`"마감 없어요" 문구 남음: ${banned.join(', ')}`, 'CLAUDE.md 규칙: "빠진 날은 나중에 채워도 1일로 인정 (지각으로 표시)"');
}

// 8. 유버디 톡 이미지 파일
const imgRefs = [...html.matchAll(/'(assets\/tips\/[^']+\.png)'/g)].map((m) => m[1]);
const missingImg = [...new Set(imgRefs)].filter((f) => !fs.existsSync(path.join(ROOT, COHORT, f)));
if (missingImg.length) bad(`유버디 톡 이미지 파일 없음: ${missingImg.join(', ')}`, `${COHORT}/assets/tips/ 에 넣기 (파일명은 영문)`);
else ok(`유버디 톡 이미지 ${new Set(imgRefs).size}개 연결 OK`);

// 9. 이전 기수 경로·이름 잔재
const leak = (html.match(new RegExp(`['"/]${PREV}/`, 'g')) || []).length;
if (leak) warn(`'${PREV}/' 경로가 ${leak}곳 남음 (manifest·서비스워커면 사고)`, `grep -n "${PREV}/" ${COHORT}/index.html`);
else ok(`'${PREV}/' 경로 잔재 없음`);
const manifest = fs.readFileSync(path.join(ROOT, COHORT, 'manifest.json'), 'utf8');
if (manifest.includes(`/${COHORT}/`)) ok('manifest 경로 이번 기수'); else bad('manifest start_url/scope 가 이번 기수가 아님');

// 10. 수료일·SQL 파일
const grad = (html.match(/from: '(\d{4}-\d{2}-\d{2})',\s*\/\//) || [])[1];
const [ey, em_, ed] = CH.end_date.split('-').map(Number);
const expGrad = new Date(Date.UTC(ey, em_ - 1, ed + 1)).toISOString().slice(0, 10);
if (grad === expGrad) ok(`수료식 날짜 ${grad}`); else warn(`GRADUATION.from = ${grad}, 마지막 날 다음 날은 ${expGrad}`);
for (const f of [`supabase_migration_${COHORT}_summaries.sql`, `supabase_migration_${COHORT}_awards_late_days.sql`]) {
  if (fs.existsSync(path.join(ROOT, f))) ok(`SQL 파일 있음: ${f} (실행은 손으로 확인)`);
  else bad(`SQL 파일 없음: ${f}`, '없으면 Day 1 인증자가 전부 지각으로 찍힘. 이전 기수 파일 복사해서 시작일만 바꾸기');
}

// 11. 검증 3종
const em = (html.match(/\u2014/g) || []).length, gaby = (html.match(/가비/g) || []).length;
let parseBad = 0;
for (const m of html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) { try { new vm.Script(m[1]); } catch (e) { parseBad++; } }
if (!em && !gaby && !parseBad) ok('검증 3종 (스크립트 파싱 · em dash 0 · "가비" 0)');
else bad(`검증 3종 실패: 파싱 오류 ${parseBad} · em dash ${em} · 가비 ${gaby}`);

// 12. 녹음 기능이 있는 기수면
const hasRec = /function RecorderCard\(/.test(html);

// 출력
for (const [ic, t] of results) console.log(`${ic} ${t}`);
const fails = results.filter((r) => r[0] === '❌').length;
const warns = results.filter((r) => r[0] === '⚠️').length;
console.log(`\n자동 점검: ❌ ${fails} · ⚠️ ${warns} · ✅ ${results.length - fails - warns}`);

console.log(`
📋 손으로 확인 (자동으로 못 봄) · 버디에게 하나씩 물어볼 것
  [ ] Supabase SQL Editor 에서 ${COHORT} summaries / awards_late_days SQL 실행했나
  [ ] supabase functions deploy ai-review${hasRec ? ' / recording' : ''} (코드 바뀐 뒤 배포했나)${hasRec ? `
  [ ] 녹음 SQL (supabase_migration_${COHORT}_recordings*.sql) 실행했나` : ''}
  [ ] 상세페이지(youbuddy-detail-page) push 했나 · 다음 기수 모집 날짜 맞나
  [ ] 1:1 접속코드 메시지 시작 날짜·요일 맞나 (10기 때 10/17(월) 오타)
  [ ] 보상 문구 5곳 일치: 앱 FAQ · 졸업 선물 팝업 · 보상 팝업 · 유버디 톡 · reward.png
  [ ] 1일1비 체험권/정기권 지급 방법 정해졌나
  [ ] 폰(아이폰 사파리 + 갤럭시 크롬) 실기 테스트, 운영자 미리보기로 Day 1 한 바퀴:
      🔊 단어·예문 소리 / 문장 제출 + AI 첨삭 / 단어 시험 70% 자동 완료 / 인증 완료하기 /${hasRec ? ' 녹음 제출 + 정확도 /' : ''} 인증 카드 → 보상 팝업
  [ ] 홈 화면에 추가 → 이번 기수 앱이 설치되나 (갤럭시)
  [ ] 유버디 톡 D-1 안내가 뜨고, 이미지 복사가 되나
`);
process.exit(fails ? 1 : 0);
