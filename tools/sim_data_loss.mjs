// 인증·문장 유실 시뮬레이션 (2026-11-05)
// 실제 앱(10th/index.html)을 jsdom 에 띄우고 가짜 Supabase 를 붙여, 저장이 끊기는 온갖 상황을 재현한다.
// 사용: node tools/sim_data_loss.mjs [10th]
// 각 시나리오 끝에 "서버에 인증이 있는가"를 확인한다. 하나라도 FAIL 이면 유실 경로가 남아 있는 것.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire('/tmp/sim/package.json');
const { JSDOM, VirtualConsole } = require('jsdom');

const COHORT = process.argv[2] || '10th';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, COHORT, 'index.html'), 'utf8')
  .replace(/<link[^>]+rel="stylesheet"[^>]*>/g, '')
  .replace(/<script[^>]+src=[^>]*><\/script>/g, '');
const TEST_NAME = '시뮬테스터';
const TEST_CODE = '99';
const DAY = (() => { const s = new Date('2026-10-19T00:00:00+09:00'); const n = new Date(); let d = 0; for (let t = new Date(s); t <= n; t.setDate(t.getDate() + 1)) { const w = t.getDay(); if (w !== 0 && w !== 6) d++; } return Math.min(d, 20); })();

// ── 가짜 서버 ──
function makeServer() {
  const db = { state: {}, events: [] };
  const net = { mode: 'ok', hangGet: false, failUpsert: false, offline: false, log: [] };
  const srv = {
    db, net,
    async rpc(fn, body) {
      net.log.push(fn);
      if (net.offline) throw new Error('offline');
      if (fn === 'get_member_app_state') {
        if (net.hangGet) return new Promise(() => {});
        return db.state[body.p_member_key] ?? null;
      }
      if (fn === 'upsert_member_app_state') {
        if (net.failUpsert) return { status: 500, text: 'boom' };
        db.state[body.p_member_key] = JSON.parse(JSON.stringify(body.p_app_state));
        return null;
      }
      if (fn === 'record_verification_event') { db.events.push({ k: body.p_member_key, d: body.p_verified_day }); return null; }
      if (fn === 'list_verification_times_for_day') return db.events.filter((e) => e.d === body.p_day).map((e) => ({ member_key: e.k, member_name: e.k, verified_at: new Date().toISOString(), verified_hhmm: '09:00' }));
      if (fn === 'get_cohort_member_summaries') return [];
      return [];
    },
  };
  return srv;
}

// ── 기기(브라우저 탭) ──
const browsers = {}; // 브라우저별 localStorage 보존 (같은 기기에서 다시 열기)
async function openTab(srv, browserId, opts = {}) {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => { errors.push(String(e && e.message || e).slice(0, 120)); });
  const dom = new JSDOM(html, {
    url: 'https://youbuddy.co.kr/' + COHORT + '/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // 보존된 localStorage 복원
      const saved = browsers[browserId] || {};
      Object.keys(saved).forEach((k) => window.localStorage.setItem(k, saved[k]));
      window.__tabAlive = true;
      window.fetch = async (url, init) => {
        if (!window.__tabAlive) return new Promise(() => {}); // 닫힌 탭의 요청은 영원히 안 끝남
        const m = String(url).match(/\/rest\/v1\/rpc\/(\w+)/);
        if (!m) return { ok: false, status: 404, text: async () => '', json: async () => null };
        let body = {};
        try { body = JSON.parse(init.body); } catch (_) {}
        const r = await srv.rpc(m[1], body);
        if (r && r.status === 500) return { ok: false, status: 500, text: async () => r.text };
        const txt = r === null || r === undefined ? '' : JSON.stringify(r);
        return { ok: true, status: 200, text: async () => txt, json: async () => (txt ? JSON.parse(txt) : null) };
      };
      window.requestAnimationFrame = (f) => setTimeout(f, 0);
      window.HTMLCanvasElement.prototype.getContext = () => null;
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {}, removeEventListener() {} });
    },
  });
  const w = dom.window;
  await new Promise((r) => setTimeout(r, opts.boot ?? 800));
  return {
    w, dom, errors,
    get state() { return w.eval('state'); },
    async verify(day) {
      // VerifyPage 의 인증 버튼 핸들러와 같은 동작
      w.eval('state').verified['d' + day] = true;
      w.eval('state').verified_at = w.eval('state').verified_at || {}; w.eval('state').verified_at['d' + day] = w.eval('todayStr')();
      w.eval('state').verified_time = w.eval('state').verified_time || {}; w.eval('state').verified_time['d' + day] = w.eval('nowTimeStr')();
      w.eval('recordVerificationEvent')(day);
      return Promise.resolve(w.eval('saveState')({ immediate: true }));
    },
    submitSentence(day, idx, text) {
      w.eval('state').sentences = w.eval('state').sentences || {}; w.eval('state').sentences[`d${day}-${idx}`] = text;
      w.eval('state').submitted = w.eval('state').submitted || {}; w.eval('state').submitted[`d${day}-${idx}`] = true;
      w.eval('saveState')();
    },
    hide() { Object.defineProperty(w.document, 'hidden', { value: true, configurable: true }); w.document.dispatchEvent(new w.Event('visibilitychange')); },
    show() { Object.defineProperty(w.document, 'hidden', { value: false, configurable: true }); w.document.dispatchEvent(new w.Event('visibilitychange')); w.dispatchEvent(new w.Event('focus')); },
    close(opts2 = {}) {
      // 탭을 닫는다: pagehide 는 보통 발생. (hard=true 면 브라우저 강제 종료: pagehide 도 없음)
      if (!opts2.hard) { try { w.dispatchEvent(new w.Event('pagehide')); } catch (_) {} }
      w.__tabAlive = false;
      const ls = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); ls[k] = w.localStorage.getItem(k); }
      browsers[browserId] = ls;
      if (process.env.DBG) console.log('tab closed', browserId);
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, cond, detail = '') { results.push([cond ? 'PASS' : 'FAIL', name, detail]); console.log((cond ? '✅' : '❌'), name, detail); }

async function seedMember(srv) {
  // 가입 완료된 멤버 상태를 서버와 브라우저 A 에 심는다
  if (process.env.DBG) console.log('seed: opening');
  const tab = await openTab(srv, 'A');
  if (process.env.DBG) console.log('seed: opened, hydrated=', tab.w.eval('stateHydrated'), 'hasSupabase=', tab.w.eval('hasSupabase')());
  const w = tab.w;
  w.eval('state').name = TEST_NAME; w.eval('state').accessCode = TEST_CODE; w.eval('state').accountKey = TEST_NAME;
  w.eval('state').onboarded = true; w.eval('state').signedUp = true; w.eval('state').goal = '시뮬'; w.eval('state').role = '시뮬';
  for (let d = 1; d < DAY; d++) { w.eval('state').verified['d' + d] = true; }
  const ok = await w.eval('saveState')({ immediate: true });
  if (process.env.DBG) console.log('seed: saved', ok, 'log', srv.net.log.slice(-4));
  await sleep(300);
  tab.close();
  return srv.db.state[TEST_NAME];
}
const serverHas = (srv, day) => !!(srv.db.state[TEST_NAME] && srv.db.state[TEST_NAME].verified && srv.db.state[TEST_NAME].verified['d' + day]);
const serverSent = (srv, key) => !!(srv.db.state[TEST_NAME] && srv.db.state[TEST_NAME].sentences && srv.db.state[TEST_NAME].sentences[key]);

async function run() {
  console.log(`\n=== ${COHORT} · 오늘 = Day ${DAY} ===`);

  // S1. 인증 직후 업로드가 끝나기 전에 탭 닫힘 (요청 유실) → 같은 브라우저로 다시 열면 서버에 올라가야 함
  { const srv = makeServer(); await seedMember(srv);
    if (process.env.DBG) console.log('S1 start');
    const t = await openTab(srv, 'A'); if (process.env.DBG) console.log('S1 tab open'); srv.net.offline = true; t.verify(DAY); await sleep(100); t.close({ hard: true });
    check('S1a 탭 강제 종료 직후 서버엔 아직 없음(정상)', !serverHas(srv, DAY));
    srv.net.offline = false; const t2 = await openTab(srv, 'A'); await sleep(1500); t2.close();
    check('S1 인증 후 즉시 탭 종료 → 다시 열면 서버에 올라감', serverHas(srv, DAY)); }

  // S2. 업로드가 500 으로 실패하고 탭 닫힘 → 다시 열면 복구
  { const srv = makeServer(); await seedMember(srv);
    const t = await openTab(srv, 'A'); srv.net.failUpsert = true; await t.verify(DAY).catch(() => {}); await sleep(300); t.close({ hard: true });
    srv.net.failUpsert = false; const t2 = await openTab(srv, 'A'); await sleep(1500); t2.close();
    check('S2 서버 저장 실패 + 탭 종료 → 다시 열면 복구', serverHas(srv, DAY)); }

  // S3. 부팅 요청이 영원히 안 끝남 → 그 세션에서 인증 → 잠금 해제 후 올라가야 함 (최대 25초)
  { const srv = makeServer(); await seedMember(srv);
    srv.net.hangGet = true; const t = await openTab(srv, 'A', { boot: 500 });
    srv.net.hangGet = false; await t.verify(DAY).catch(() => {}); await sleep(27000);
    check('S3 부팅 요청 멈춤 상태에서 인증 → 25초 내 서버 반영', serverHas(srv, DAY)); t.close(); }

  // S4. 탭 2개: 옛 탭이 열려 있는 채로 새 탭에서 인증 → 옛 탭이 포커스 받고 다른 걸 저장해도 서버 인증 유지
  { const srv = makeServer(); await seedMember(srv);
    const old = await openTab(srv, 'A'); const nw = await openTab(srv, 'A'); await nw.verify(DAY); await sleep(300);
    old.show(); await sleep(800); old.w.eval('state').bookmarks['d1-0'] = true; await old.w.eval('saveState')({ immediate: true }); await sleep(300);
    check('S4 옛 탭이 저장해도 새 탭의 인증 유지', serverHas(srv, DAY)); old.close(); nw.close(); }

  // S5. 다른 기기(폰, 옛 캐시)에서 열고 저장 → 서버 인증 유지
  { const srv = makeServer(); await seedMember(srv);
    browsers['B'] = Object.assign({}, browsers['A']); // 같은 계정으로 로그인된 폰(옛 캐시)
    const mac = await openTab(srv, 'A'); await mac.verify(DAY); await sleep(300); mac.close();
    const ph2 = await openTab(srv, 'B'); await sleep(1200);
    check('S5a 폰에서 열면 맥 인증이 보임', !!ph2.w.eval('state').verified['d' + DAY]);
    ph2.w.eval('state').bookmarks['d2-0'] = true; await ph2.w.eval('saveState')({ immediate: true }); await sleep(300); ph2.close();
    check('S5 폰이 저장해도 서버 인증 유지', serverHas(srv, DAY)); }

  // S6. 문장 제출 직후(디바운스 450ms 안) 탭 숨김/닫힘 → 복구
  { const srv = makeServer(); await seedMember(srv);
    const t = await openTab(srv, 'A'); t.submitSentence(DAY, 0, 'Sim sentence one.'); srv.net.offline = true; t.hide(); await sleep(100); t.close({ hard: true });
    srv.net.offline = false; const t2 = await openTab(srv, 'A'); await sleep(1500); t2.close();
    check('S6 문장 제출 직후 종료 → 다시 열면 문장 서버 반영', serverSent(srv, `d${DAY}-0`)); }

  // S7. 완전 오프라인에서 인증 → 온라인 복귀(탭 유지) → 자동 재시도로 반영
  { const srv = makeServer(); await seedMember(srv);
    const t = await openTab(srv, 'A'); srv.net.offline = true; await t.verify(DAY).catch(() => {}); await sleep(500); srv.net.offline = false; await sleep(5000);
    check('S7 오프라인 인증 → 온라인 복귀 시 자동 재전송', serverHas(srv, DAY)); t.close(); }

  // S8. 인증 직후 60초 갱신/포커스 복귀가 끼어들어도 유지
  { const srv = makeServer(); await seedMember(srv);
    const t = await openTab(srv, 'A'); const p = t.verify(DAY); t.hide(); t.show(); await p; await sleep(800);
    check('S8 인증 중 탭 전환/복귀 → 로컬·서버 모두 유지', serverHas(srv, DAY) && !!t.w.eval('state').verified['d' + DAY]); t.close(); }

  // S9. 로그인 화면을 다시 거침(캐시엔 있고 서버엔 없는 인증) → 로그인 후 서버 반영
  { const srv = makeServer(); await seedMember(srv);
    const t = await openTab(srv, 'A'); srv.net.offline = true; await t.verify(DAY).catch(() => {}); await sleep(200); t.close({ hard: true });
    srv.net.offline = false; const t2 = await openTab(srv, 'A', { boot: 300 });
    // 가입 상태로 서버 병합 경로(로그인)를 태운다
    try { const remote = await t2.w.eval('loadRemoteState')(); t2.w.eval('mergePersistedState')(t2.w.eval('mergeRemoteKeepLocal')(remote)); await t2.w.eval('saveState')({ immediate: true }); } catch (e) { console.log('S9 err', e.message); }
    await sleep(800); t2.close();
    check('S9 로그인 병합 경로에서도 로컬 인증 보존·업로드', serverHas(srv, DAY)); }

  console.log('\n요약:', results.filter((r) => r[0] === 'PASS').length, 'PASS /', results.filter((r) => r[0] === 'FAIL').length, 'FAIL');
  process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(2); });
