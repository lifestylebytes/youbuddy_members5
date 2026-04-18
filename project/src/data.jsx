// Mock data for the challenge
const CHALLENGE_MEMBERS = [
  { id: 'me', name: '박지혜', team: 'A', avatar: 'JH', color: 'orange', progress: 18, streak: 7, me: true },
  { id: 'u1', name: '김소영', team: 'A', avatar: 'SY', color: 'ink', progress: 20, streak: 20 },
  { id: 'u2', name: 'Jeonggeun', team: 'B', avatar: 'JG', color: 'cream', progress: 20, streak: 20 },
  { id: 'u3', name: '송유빈', team: 'B', avatar: 'YB', color: 'ink', progress: 20, streak: 18 },
  { id: 'u4', name: '오수진', team: 'B', avatar: 'SJ', color: 'cream', progress: 20, streak: 20 },
  { id: 'u5', name: '이규태', team: 'B', avatar: 'GT', color: 'ink', progress: 20, streak: 14 },
  { id: 'u6', name: '김정희', team: 'A', avatar: 'JH', color: 'cream', progress: 19, streak: 12 },
  { id: 'u7', name: '김세형', team: 'A', avatar: 'SH', color: 'ink', progress: 19, streak: 9 },
  { id: 'u8', name: '김효원', team: 'A', avatar: 'HW', color: 'cream', progress: 18, streak: 11 },
  { id: 'u9', name: 'Jenny', team: 'B', avatar: 'JY', color: 'ink', progress: 18, streak: 6 },
  { id: 'u10', name: '정우영', team: 'B', avatar: 'WY', color: 'cream', progress: 18, streak: 8 },
  { id: 'u11', name: '고민지', team: 'A', avatar: 'MJ', color: 'ink', progress: 17, streak: 5 },
  { id: 'u12', name: '김소윤', team: 'A', avatar: 'SY', color: 'cream', progress: 17, streak: 10 },
  { id: 'u13', name: '이혜정', team: 'B', avatar: 'HJ', color: 'ink', progress: 16, streak: 4 },
  { id: 'u14', name: '손태진', team: 'B', avatar: 'TJ', color: 'cream', progress: 15, streak: 6 },
  { id: 'u15', name: 'Sara', team: 'A', avatar: 'SR', color: 'ink', progress: 15, streak: 7 },
  { id: 'u16', name: '박지혜 (-13)', team: 'A', avatar: 'JH', color: 'cream', progress: 14, streak: 3 },
  { id: 'u17', name: '김민주', team: 'A', avatar: 'MJ', color: 'ink', progress: 13, streak: 2 },
  { id: 'u18', name: '이가현', team: 'B', avatar: 'GH', color: 'cream', progress: 13, streak: 5 },
  { id: 'u19', name: '김민영', team: 'A', avatar: 'MY', color: 'ink', progress: 11, streak: 2 },
  { id: 'u20', name: '이혜란', team: 'B', avatar: 'HR', color: 'cream', progress: 11, streak: 3 },
  { id: 'u21', name: '박선우', team: 'A', avatar: 'SW', color: 'ink', progress: 10, streak: 1 },
  { id: 'u22', name: '손하린', team: 'B', avatar: 'HR', color: 'cream', progress: 7, streak: 2 },
  { id: 'u23', name: '이가현', team: 'B', avatar: 'GH', color: 'ink', progress: 6, streak: 1 },
  { id: 'u24', name: '석서영', team: 'B', avatar: 'SY', color: 'cream', progress: 4, streak: 0 },
];
// Pad to 30
for (let i = 25; i <= 30; i++) {
  CHALLENGE_MEMBERS.push({
    id: 'u' + i, name: '참여자 ' + i, team: i % 2 ? 'A' : 'B',
    avatar: 'P' + i, color: i % 2 ? 'ink' : 'cream',
    progress: Math.max(0, 18 - i), streak: Math.max(0, 5 - i%7),
  });
}

// 4 weeks × 5 days of notes
const WEEKS = [
  {
    n: 1, title: 'Onboarding', subtitle: '방향성 잡고 바로 시작',
    days: [
      { day: 1, title: '목표/방향성 + 킥오프', goal: 'Align on our North Star, then kick off', words: ['North Star', 'align on', 'kick off'], status: 'done', date: '03/23' },
      { day: 2, title: '회의의 시작 (아젠다/목표)', goal: '회의 오프닝 문장 3개 만들기', words: ['at the core', 'just to clarify', 'two main perspectives'], status: 'done', date: '03/24' },
      { day: 3, title: '자연스럽게 스몰톡 → 업무 전환', goal: 'Switch gears from small talk to work', words: ['On that note', 'switched gears to', 'ICYMI'], status: 'done', date: '03/25' },
      { day: 4, title: '쿠션어 (부드러운 반대)', goal: '쿠션어로 반대/우려를 프로답게', words: ['I see where you\'re coming from', 'I\'m not sure', 'raise a concern'], status: 'done', date: '03/26' },
      { day: 5, title: '우선순위/범위 조절', goal: 'Prioritize & trade-off', words: ['prioritizing', 'trade-off', 'bottleneck'], status: 'done', date: '03/27' },
    ],
  },
  {
    n: 2, title: 'Meetings & Messaging', subtitle: '일상 회의 영어 루틴 완성',
    days: [
      { day: 6, title: '업데이트 보고', goal: 'Give a clean status update', words: ['on track', 'heads-up', 'wrapping up'], status: 'done', date: '03/30' },
      { day: 7, title: '질문/확인', goal: 'Ask better clarifying questions', words: ['to double-check', 'walk me through', 'circle back'], status: 'done', date: '03/31' },
      { day: 8, title: '이슈 공유', goal: 'Flag issues without panic', words: ['flag', 'blocker', 'we\'re seeing'], status: 'done', date: '04/01' },
      { day: 9, title: '요청하기', goal: 'Make a crisp ask', words: ['could you', 'when you get a chance', 'if possible'], status: 'done', date: '04/02' },
      { day: 10, title: '감사/마무리', goal: 'Close with warmth', words: ['appreciate', 'thanks for bearing with', 'catch up later'], status: 'done', date: '04/03' },
    ],
  },
  {
    n: 3, title: 'Feedback & Collab', subtitle: '피드백과 협업의 언어',
    days: [
      { day: 11, title: '피드백 받기', goal: 'Receive feedback gracefully', words: ['that\'s fair', 'I hear you', 'let me think on it'], status: 'done', date: '04/06' },
      { day: 12, title: '피드백 주기', goal: 'Give kind-candid feedback', words: ['one thing I\'d push on', 'what if we', 'a small nit'], status: 'done', date: '04/07' },
      { day: 13, title: '의견 차이', goal: 'Disagree and commit', words: ['push back a little', 'see it differently', 'meet in the middle'], status: 'done', date: '04/08' },
      { day: 14, title: '합의 도출', goal: 'Land on a decision', words: ['align on', 'go with', 'for now'], status: 'today', date: '04/09' },
      { day: 15, title: '팔로우업', goal: 'Send a clean recap', words: ['action items', 'recap', 'by EOD'], status: 'locked', date: '04/10' },
    ],
  },
  {
    n: 4, title: 'Own the Room', subtitle: '주도적으로 이끄는 영어',
    days: [
      { day: 16, title: '일정 확정/진행', goal: 'Lock in dates', words: ['lock this in', 'by EOD', 'tentative'], status: 'locked', date: '04/13' },
      { day: 17, title: '논의 보류/우선순위 변경', goal: 'Table or reprioritize', words: ['table it for now', 'open items', 'deprioritize'], status: 'locked', date: '04/14' },
      { day: 18, title: '근거 기반 말하기', goal: 'Lay the groundwork with data', words: ['lay the groundwork', 'data point', 'assumption'], status: 'locked', date: '04/15' },
      { day: 19, title: '검토 요청 (더블 체크)', goal: 'Get a second pair of eyes', words: ['a second pair of eyes', 'nitpick', 'low-stakes'], status: 'locked', date: '04/16' },
      { day: 20, title: '마무리/정리/다음 액션', goal: 'Knock out these deliverables', words: ['knock out', 'deliverables', 'wrap this up'], status: 'locked', date: '04/17' },
    ],
  },
];

// Day 14 full lesson data (the "today" one)
const TODAY_LESSON = {
  day: 14,
  week: 3,
  title: '합의 도출',
  date: '2026년 4월 9일',
  goal_en: 'Let\'s align on the next step and move forward.',
  goal_kr: '오늘은 다양한 의견 속에서 합의를 만들어내는 표현 3개를 배우고, 내 상황에 맞게 문장을 만들어봐요.',
  tip: '2분만 투자해도 Day 14 완료 | 완벽 금지 | 오늘은 "합의 표현 한 번 써보기"만 해요.',
  checkpoints: [
    '미팅에서 팀의 의견이 갈릴 때 자연스럽게 합의 방향으로 유도하기',
    '완벽하지 않아도 "일단 이걸로 가보자" 라고 프로답게 말하기',
  ],
  words: [
    {
      en: 'align on',
      pos: 'phrasal verb',
      def_short: '(기준/방향에) 맞추다, 정렬하다',
      example_en: 'Let\'s **align on** the next milestone before we split up.',
      example_kr: '각자 흩어지기 전에 다음 마일스톤에 대해 합을 맞춥시다.',
      nuance: '서로의 해석을 하나로 맞춰서 오해를 줄이는 느낌. "동의"보다 실무적.',
      syn: ['get on the same page', 'sync on', 'converge on'],
    },
    {
      en: 'go with',
      pos: 'phrasal verb',
      def_short: '~로 결정하다, 그걸로 가다',
      example_en: 'Let\'s **go with** option B for now and iterate next sprint.',
      example_kr: '일단 옵션 B로 가고 다음 스프린트에서 개선해봐요.',
      nuance: '완벽하지 않아도 "일단 결정" 하는 실용적 뉘앙스.',
      syn: ['commit to', 'settle on', 'pick'],
    },
    {
      en: 'for now',
      pos: 'adverbial',
      def_short: '일단, 당분간, 지금으로서는',
      example_en: 'That\'s out of scope **for now**, but let\'s park it.',
      example_kr: '지금은 범위 밖이지만 나중에 다시 봐요.',
      nuance: '영구적이지 않음을 부드럽게 알리는 쿠션 표현.',
      syn: ['at this point', 'for the time being', 'tentatively'],
    },
  ],
  verify_steps: [
    { id: 'copy',   label: '오늘의 표현 3번씩 소리 내어 읽기', icon: 'mic', time: '2분' },
    { id: 'sentence', label: '내 문장 3개 만들고 AI 교정 받기', icon: 'pen', time: '5분' },
    { id: 'capture', label: '단어 시험 캡처 업로드', icon: 'image', time: '1분' },
    { id: 'record',  label: '내 문장 녹음 (화요일/목요일)', icon: 'wave', time: '2분' },
  ],
};

window.APP_DATA = { CHALLENGE_MEMBERS, WEEKS, TODAY_LESSON };

// Generate per-member per-day check matrix (20 days x 30 members)
// Each member's first `progress` days are checked, with some realistic gaps
const CHECK_MATRIX = {};
CHALLENGE_MEMBERS.forEach((m, mi) => {
  const arr = Array(20).fill(false);
  let filled = 0;
  for (let d = 0; d < 20 && filled < m.progress; d++) {
    // skip occasionally for realism
    if (Math.random() > 0.08 || filled + (20 - d) <= m.progress) {
      arr[d] = true; filled++;
    }
  }
  // top off if needed
  for (let d = 0; d < 20 && filled < m.progress; d++) { if (!arr[d]) { arr[d] = true; filled++; } }
  CHECK_MATRIX[m.id] = arr;
});
window.APP_DATA.CHECK_MATRIX = CHECK_MATRIX;

// Community feed — recent submissions today
const COMMUNITY_FEED = [
  { id: 'p1', user: 'u2', word: 'align on', sentence: "Before we split up, let's align on the ownership of each action item.", translate: '각자 흩어지기 전에 액션 아이템의 담당자를 맞춰봐요.', time: '방금', likes: 8, comments: 2 },
  { id: 'p2', user: 'u4', word: 'go with', sentence: "Given the timeline, I think we should go with option B and revisit next sprint.", translate: '타임라인을 고려하면 B안으로 가고 다음 스프린트에 다시 봐야 할 것 같아요.', time: '2분 전', likes: 12, comments: 4 },
  { id: 'p3', user: 'u3', word: 'for now', sentence: "Let's park that question for now and bring it up in the retro.", translate: '일단 그 이슈는 보류하고 회고 때 꺼내봐요.', time: '5분 전', likes: 6, comments: 1 },
  { id: 'p4', user: 'u1', word: 'align on', sentence: "We should align on naming conventions before the PR review.", translate: 'PR 리뷰 전에 네이밍 컨벤션을 맞춰야 해요.', time: '8분 전', likes: 9, comments: 3 },
  { id: 'p5', user: 'u5', word: 'go with', sentence: "I'll go with your suggestion — let's move forward.", translate: '제안대로 진행할게요 — 앞으로 가봐요.', time: '12분 전', likes: 5, comments: 0 },
  { id: 'p6', user: 'u7', word: 'for now', sentence: "That's low-stakes for now; let's come back to it after the launch.", translate: '지금은 우선순위가 낮으니 런칭 후에 다시 봐요.', time: '14분 전', likes: 4, comments: 1 },
  { id: 'p7', user: 'u9', word: 'align on', sentence: "Can we align on what 'done' means for this epic?", translate: "이 에픽에서 '완료'의 기준을 맞출 수 있을까요?", time: '20분 전', likes: 11, comments: 5 },
  { id: 'p8', user: 'u10', word: 'go with', sentence: "Let's go with the simpler UI for the MVP and iterate.", translate: 'MVP는 심플한 UI로 가고 개선해나가요.', time: '25분 전', likes: 7, comments: 2 },
];
window.APP_DATA.COMMUNITY_FEED = COMMUNITY_FEED;

// My profile
const MY_PROFILE = {
  name: '박지혜',
  role: 'Product Manager · B2B SaaS',
  joined: '2026년 3월 23일',
  cohort: '5기',
  team: 'A',
  day1_goals: [
    { i: 1, text: '미팅에서 끼어들기 (어휘를 놓쳐서 적절히 받아칠 수 있도록)' },
    { i: 2, text: '내 의견 말할 때 딱딱하지 않게 말하기' },
    { i: 3, text: '피드백 줄 때 쿠션어 꽉꽉 넣기' },
  ],
  north_star: '20일 동안 흔들릴 때마다 돌아올 나만의 기준 만들기',
  stats: { done: 13, streak: 7, words: 39, sentences: 39 },
};
window.APP_DATA.MY_PROFILE = MY_PROFILE;
