#!/usr/bin/env node
/* YOUBUDDY 5기 · 후기/건의사항 추출기
 * 사용법: node parse_reviews.js <full_export.json> [출력.md]
 * 입력: 운영자 설정 "📦 코호트 데이터 다운로드 (JSON)" 결과 파일.
 * 출력: 주간설문 코멘트 + 미니설문 + 다음기수 건의사항 + 커뮤니티 글/댓글 정리 markdown.
 */
const fs = require('fs');
const path = require('path');

const inPath = process.argv[2];
if (!inPath) { console.error('사용법: node parse_reviews.js <full_export.json> [출력.md]'); process.exit(1); }
const outPath = process.argv[3] || path.join(path.dirname(inPath), '5기_후기_모음.md');

const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const members = Array.isArray(raw.member_state) ? raw.member_state : [];
const posts = Array.isArray(raw.community_posts) ? raw.community_posts : [];
const comments = Array.isArray(raw.community_comments) ? raw.community_comments : [];

// 운영진/스태프/고스트/익명 제외 (export RPC 들과 동일 필터)
const EXCLUDE_NAMES = new Set(['모모', '유버디', '이규태', '이지흔']);
function appState(m) { return m.app_state || m.appState || {}; }
function nameOf(m) {
  const s = appState(m);
  return m.member_name || s.name || '';
}
function isExcluded(m) {
  const s = appState(m);
  const nm = nameOf(m);
  if (s.isOperator || s.isStaff || s.ghost) return true;
  const key = m.member_key || '';
  if (key === 'anonymous' || key === '') return true;
  if (!nm) return true;
  if (EXCLUDE_NAMES.has(nm)) return true;
  return false;
}
function tierOf(m) { const s = appState(m); return m.tier || s.tier || 'basic'; }
function engOf(m) { const s = appState(m); return s.englishName || ''; }
function disp(m) { const e = engOf(m); const n = nameOf(m); return e ? `${n} (${e})` : n; }

const real = members.filter((m) => !isExcluded(m));

// ── 수집 ──────────────────────────────────────────────
const weeklyComments = [];   // { member, tier, week, comment }
const miniRows = [];         // { member, tier, week, difficulty, hardest, amount, comment }
const wantW2 = {};           // week -> {option: count}
const nextWish = {};         // week -> {option: count}

for (const m of real) {
  const s = appState(m);
  const ws = s.week_survey || {};
  for (const wk of Object.keys(ws)) {
    const sv = ws[wk] || {};
    if (sv && typeof sv === 'object') {
      const c = (sv.comment || '').trim();
      if (c) weeklyComments.push({ member: disp(m), tier: tierOf(m), week: wk, comment: c });
      if (Array.isArray(sv.want_w2)) { wantW2[wk] = wantW2[wk] || {}; sv.want_w2.forEach((o) => { wantW2[wk][o] = (wantW2[wk][o] || 0) + 1; }); }
      const mini = sv.mini || {};
      if (mini && typeof mini === 'object' && (mini.at || mini.comment || mini.hardest)) {
        const mc = (mini.comment || '').trim();
        miniRows.push({ member: disp(m), tier: tierOf(m), week: wk, difficulty: mini.difficulty || '', hardest: mini.hardest || '', amount: mini.amount || '', comment: mc });
        if (Array.isArray(mini.next_week_wish)) { nextWish[wk] = nextWish[wk] || {}; mini.next_week_wish.forEach((o) => { nextWish[wk][o] = (nextWish[wk][o] || 0) + 1; }); }
      }
    }
  }
}

// ── 커뮤니티 (스키마 미상이라 방어적으로) ──────────────
function pick(o, keys) { for (const k of keys) { if (o[k] != null && String(o[k]).trim() !== '') return o[k]; } return ''; }
const postRows = posts.map((p) => ({
  member: pick(p, ['member_name', 'author', 'name', 'english_name']),
  text: pick(p, ['content', 'text', 'sentence', 'body', 'message']),
  at: pick(p, ['created_at', 'createdAt', 'at']),
})).filter((r) => String(r.text).trim());
const commentRows = comments.map((c) => ({
  member: pick(c, ['member_name', 'author', 'name', 'english_name']),
  text: pick(c, ['content', 'text', 'body', 'comment', 'message']),
  at: pick(c, ['created_at', 'createdAt', 'at']),
})).filter((r) => String(r.text).trim());

// ── markdown 빌드 ──────────────────────────────────────
const esc = (v) => String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n+/g, ' / ').trim();
const L = [];
L.push(`# 유비챌 5기 · 후기 & 건의사항 모음`);
L.push('');
L.push(`> 운영자 전체 데이터 export 기준 · 운영진/스태프/익명 제외 · 실제 멤버 ${real.length}명`);
L.push(`> 생성 소스 export 시각: ${esc(raw.exported_at || '?')}`);
L.push('');

function sortWeek(a, b) { return Number(a.week) - Number(b.week) || a.member.localeCompare(b.member); }

// 1. 주간 설문 자유 코멘트
L.push(`## 1. 주간 설문 자유 코멘트 (${weeklyComments.length}건)`);
L.push('');
if (weeklyComments.length) {
  for (const tier of ['premium', 'basic']) {
    const rows = weeklyComments.filter((r) => r.tier === tier).sort(sortWeek);
    if (!rows.length) continue;
    L.push(`### ${tier === 'premium' ? '💎 프리미엄' : '🌱 베이직'}`);
    L.push('');
    L.push('| Week | 멤버 | 후기 |');
    L.push('|---|---|---|');
    rows.forEach((r) => L.push(`| W${esc(r.week)} | ${esc(r.member)} | ${esc(r.comment)} |`));
    L.push('');
  }
} else { L.push('_데이터 없음_'); L.push(''); }

// 2. 미니 설문
L.push(`## 2. 미니 설문 (난이도·분량·코멘트) (${miniRows.length}건)`);
L.push('');
if (miniRows.length) {
  L.push('| Week | 멤버 | 난이도 | 가장 어려웠던 점 | 분량 | 코멘트 |');
  L.push('|---|---|---|---|---|---|');
  miniRows.sort(sortWeek).forEach((r) => L.push(`| W${esc(r.week)} | ${esc(r.member)} | ${esc(r.difficulty)} | ${esc(r.hardest)} | ${esc(r.amount)} | ${esc(r.comment)} |`));
  L.push('');
} else { L.push('_데이터 없음_'); L.push(''); }

// 3. 다음 기수 건의사항 (집계)
L.push(`## 3. 다음 기수 건의사항 (선택지 집계)`);
L.push('');
function distBlock(title, obj) {
  const weeks = Object.keys(obj).sort((a, b) => Number(a) - Number(b));
  if (!weeks.length) return;
  L.push(`### ${title}`);
  L.push('');
  for (const wk of weeks) {
    const entries = Object.entries(obj[wk]).sort((a, b) => b[1] - a[1]);
    L.push(`- **W${wk}**: ` + entries.map(([k, v]) => `${k} (${v})`).join(', '));
  }
  L.push('');
}
distBlock('Week 설문 — 다음 주 원하는 것 (want_w2)', wantW2);
distBlock('미니 설문 — 다음 기수 바라는 점 (next_week_wish)', nextWish);
if (!Object.keys(wantW2).length && !Object.keys(nextWish).length) { L.push('_데이터 없음_'); L.push(''); }

// 4. 커뮤니티
L.push(`## 4. 커뮤니티 글 (${postRows.length}건) · 댓글 (${commentRows.length}건)`);
L.push('');
if (postRows.length) {
  L.push('### 글');
  L.push('');
  L.push('| 멤버 | 내용 |');
  L.push('|---|---|');
  postRows.forEach((r) => L.push(`| ${esc(r.member)} | ${esc(r.text)} |`));
  L.push('');
}
if (commentRows.length) {
  L.push('### 댓글');
  L.push('');
  L.push('| 멤버 | 댓글 |');
  L.push('|---|---|');
  commentRows.forEach((r) => L.push(`| ${esc(r.member)} | ${esc(r.text)} |`));
  L.push('');
}
if (!postRows.length && !commentRows.length) { L.push('_커뮤니티 데이터 없음 (또는 스키마 키 불일치 — 콘솔 로그 확인)_'); L.push(''); }

fs.writeFileSync(outPath, L.join('\n'), 'utf8');
console.log('✅ 생성:', outPath);
console.log(`   주간코멘트 ${weeklyComments.length} · 미니 ${miniRows.length} · 글 ${postRows.length} · 댓글 ${commentRows.length} · 실제멤버 ${real.length}`);
// 커뮤니티 스키마 디버그
if (posts[0]) console.log('   community_posts keys:', Object.keys(posts[0]).join(', '));
if (comments[0]) console.log('   community_comments keys:', Object.keys(comments[0]).join(', '));
