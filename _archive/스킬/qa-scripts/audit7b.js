const fs = require('fs');
const src = fs.readFileSync('/sessions/optimistic-gracious-bardeen/mnt/youbuddy-challenge-claude/7th/index.html', 'utf8');
function extractObj(name) {
  const idx = src.indexOf('const ' + name + ' ');
  if (idx < 0) return null;
  const open = src.indexOf(src.slice(idx).match(/[\[{]/)[0], idx);
  const opener = src[open], closer = opener === '{' ? '}' : ']';
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === opener) depth++;
    else if (src[j] === closer) { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
}
const CHALLENGE = eval('(' + extractObj('CHALLENGE') + ')');
const GLOSS = eval('(' + extractObj('SYNONYM_GLOSSARY') + ')');
const NUANCE = eval('(' + extractObj('SYNONYM_NUANCE') + ')');
const WEAK = eval('(' + extractObj('SURVEY_WEAK_WORDS_BY_WEEK') + ')');
const BINGO = eval('(' + extractObj('BINGO_WORDS') + ')');
let issues = [];
const all = [];
CHALLENGE.weeks.forEach(w => w.days.forEach(d => d.words.forEach(word => all.push({ ...word, day: d.day, week: w.n }))));
if (all.length !== 60) issues.push('단어 수 ' + all.length);
const wordSet = new Set(all.map(w => w.en.toLowerCase()));
// syn coverage (앱 lookup: 소문자 glossary / "Word::syn" nuance)
all.forEach(w => (w.syn || []).forEach(s => {
  if (!GLOSS[String(s).toLowerCase()]) issues.push(`GLOSSARY 누락(뜻 fallback 노출): ${w.en} :: ${s}`);
  if (!NUANCE[`${w.en}::${s}`]) issues.push(`NUANCE 누락(fallback 노출): ${w.en}::${s}`);
}));
// weak words (objects with en)
Object.entries(WEAK).forEach(([wk, list]) => list.forEach(x => {
  if (!wordSet.has(String(x.en).toLowerCase())) issues.push(`WEAK W${wk}: '${x.en}' 60단어에 없음`);
}));
// bingo
const bingoEns = BINGO.map(x => typeof x === 'string' ? x : x.en || x.word);
if (bingoEns.length !== 25) issues.push('BINGO ' + bingoEns.length + '개');
bingoEns.forEach(x => { if (!wordSet.has(String(x).toLowerCase())) issues.push(`BINGO: '${x}' 60단어에 없음`); });
// dup bingo
if (new Set(bingoEns.map(s=>s.toLowerCase())).size !== bingoEns.length) issues.push('BINGO 중복 있음');
// meetings
(CHALLENGE.premium?.weekly_meetings || []).forEach(m => {
  const md = new Date(m.date + 'T00:00:00Z');
  if (md.getUTCDay() !== 4) issues.push(`m${m.n} ${m.date} 목요일 아님`);
  if (m.recordingUrl) issues.push(`m${m.n} recordingUrl 잔존`);
  if (m.status && m.status !== 'upcoming') issues.push(`m${m.n} status=${m.status}`);
});
// dates via UTC
const wd = s => new Date(s + 'T00:00:00Z').getUTCDay();
if (wd(CHALLENGE.start_date) !== 1) issues.push('start_date 월요일 아님: ' + CHALLENGE.start_date);
if (wd(CHALLENGE.end_date) !== 5) issues.push('end_date 금요일 아님: ' + CHALLENGE.end_date);
// day fields duplicates/holes
const dayNums = [];
CHALLENGE.weeks.forEach(w => w.days.forEach(d => dayNums.push(d.day)));
for (let i = 1; i <= 20; i++) if (!dayNums.includes(i)) issues.push('Day ' + i + ' 누락');
console.log(issues.length ? issues.join('\n') : 'DATA ALL OK');
console.log('---');
console.log('meetings:', (CHALLENGE.premium?.weekly_meetings || []).map(m => `m${m.n} ${m.date} ${m.status || ''}`).join(' | '));
console.log('start', CHALLENGE.start_date, 'end', CHALLENGE.end_date, 'cohort', CHALLENGE.cohort);
