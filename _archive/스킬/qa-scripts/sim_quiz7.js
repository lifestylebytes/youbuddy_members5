const fs = require('fs');
const src = fs.readFileSync('/sessions/optimistic-gracious-bardeen/mnt/youbuddy-challenge-claude/7th/index.html', 'utf8');

function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found fn ' + name);
  let i = src.indexOf('{', idx), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(idx, j + 1); }
  }
}
function extractConst(name) {
  const idx = src.indexOf('const ' + name + ' ');
  if (idx < 0) throw new Error('not found const ' + name);
  const end = src.indexOf(');', idx);
  return src.slice(idx, end + 2);
}
function extractObjConst(name) {
  const idx = src.indexOf('const ' + name + ' ');
  if (idx < 0) throw new Error('nf ' + name);
  let i = src.indexOf('{', idx), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(idx, j + 2); }
  }
}
const code = [
  extractFn('_escRe'), extractFn('inflectionVariants'), extractFn('hyphenVariants'),
  extractObjConst('INFLECT_IRREGULAR'), extractConst('_PHRASAL_PARTICLES'), extractConst('_PRONOUN_TOKENS'),
  extractFn('_buildPhraseAlternatives'), extractFn('computeQuizSplit'),
].join('\n');
eval(code);

const data = JSON.parse(fs.readFileSync('/sessions/optimistic-gracious-bardeen/mnt/youbuddy-challenge-claude/_archive/7기/단어집/7기_단어_데이터_v2.json', 'utf8'));
let leaks = 0;
for (const w of data.weeks) for (const d of w.days) for (const word of d.words) {
  const split = computeQuizSplit({ en: word.en, prompt: word.ex_en });
  // visible text after blanking
  let visible;
  if (split.mode === '2blank') visible = split.before + ' ' + split.middle + ' ' + split.after;
  else visible = split.parts.join(' ');
  const fallback = split.mode === '1blank' && /→\s*$/.test(split.parts[0]);
  // does any variant of the answer remain visible?
  const alts = _buildPhraseAlternatives(word.en);
  let residual = false;
  try { residual = new RegExp(alts.join('|'), 'i').test(visible); } catch (e) {}
  if (fallback || residual) {
    leaks++;
    console.log(`LEAK Day${d.day} [${word.en}] mode=${split.mode}${fallback ? ' FALLBACK' : ''}${residual ? ' RESIDUAL' : ''}`);
    console.log('   ex_en:', word.ex_en);
  }
}
console.log('total leaks:', leaks);
