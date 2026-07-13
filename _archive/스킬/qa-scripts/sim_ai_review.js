const fs = require('fs');
const src = fs.readFileSync('/sessions/optimistic-gracious-bardeen/mnt/youbuddy-challenge-claude/7th/index.html', 'utf8');
function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('nf ' + name);
  let i = src.indexOf('{', idx), d = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) return src.slice(idx, j + 1); }
  }
}
// state 목업 + 필요한 함수 로드
global.state = { ai_history: {} };
global.saveState = () => {};
eval(extractFn('__normalizeForCompare'));
eval(extractFn('__normalizeKoForCompare'));
eval(extractFn('__koreanMatches'));
eval(extractFn('__matchesPriorCorrection'));
eval(extractFn('__getHistory').replace('function __getHistory', 'function __getHistoryX'));
eval(extractFn('__recordSubmission').replace(/const __submissionHistory[^;]*;?/, ''));
// __submissionHistory / __MAX_HISTORY 선언
global.__submissionHistory = new Map(); global.__MAX_HISTORY = 5;

let pass = 0, fail = 0;
const t = (name, cond) => { cond ? pass++ : (fail++, console.log('FAIL:', name)); };

// 시나리오 1: 첨삭 결과 붙여넣기 → 에코 매치
const hist = [{ sentence: "Let's put out some fillers with the sales team", corrected: "Let's put out some feelers with the sales team.", why: '어휘 교정', attemptN: 1 }];
t('에코: 첨삭 결과 그대로', !!__matchesPriorCorrection("Let's put out some feelers with the sales team.", hist));
t('에코: 구두점/대소문자 달라도', !!__matchesPriorCorrection("LET'S PUT OUT SOME FEELERS WITH THE SALES TEAM", hist));
t('에코 아님: 다른 문장', !__matchesPriorCorrection("We should put out feelers before the pitch.", hist));
t('에코 아님: 원래 틀린 문장 재제출', !__matchesPriorCorrection("Let's put out some fillers with the sales team", hist));

// 시나리오 2: 영속화 (record → state.ai_history → 새 Map 에서 복원)
__recordSubmission('S|Put out feelers', hist[0]);
t('persist: state 에 기록됨', Array.isArray(state.ai_history['S|Put out feelers']) && state.ai_history['S|Put out feelers'].length === 1);
__submissionHistory.clear(); // 새로고침 시뮬레이션
const restored = __getHistoryX('S|Put out feelers');
t('restore: 새로고침 후 복원', restored.length === 1 && restored[0].corrected.includes('feelers'));
t('restore 후 에코 매치 동작', !!__matchesPriorCorrection("Let's put out some feelers with the sales team.", restored));

// 시나리오 3: 히스토리 상한
for (let i = 0; i < 8; i++) __recordSubmission('S|Moat', { sentence: 's' + i, corrected: 'c' + i, why: '', attemptN: i + 1 });
t('메모리 상한 5', __submissionHistory.get('S|Moat').length === 5);
t('persist 상한 3', state.ai_history['S|Moat'].length === 3);


// 시나리오 4: 한국어 컨텍스트 가드
const hist2 = [{ sentence: 'I can give you a soft commit for Friday', corrected: 'I can give you a soft commit for Friday, but I will confirm after the review.', why: '', attemptN: 1, korean: '금요일로 잠정 약속드릴게요' }];
t('한국어 같으면 에코 발동', !!__matchesPriorCorrection('I can give you a soft commit for Friday, but I will confirm after the review.?', hist2, '금요일로 잠정 약속드릴게요'));
t('한국어 다르면 에코 미발동', !__matchesPriorCorrection('I can give you a soft commit for Friday, but I will confirm after the review.', hist2, '그건 잠정 약속인가요? 확약으로 표시할까요?'));
const hist3 = [{ sentence: 'a b c', corrected: 'a b c d', why: '', attemptN: 1 }];
t('구기록(한국어 없음)+새 한국어 → 미발동', !__matchesPriorCorrection('a b c d', hist3, '새 한국어 문장'));
t('둘 다 한국어 없음 → 발동', !!__matchesPriorCorrection('a b c d', hist3, ''));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
