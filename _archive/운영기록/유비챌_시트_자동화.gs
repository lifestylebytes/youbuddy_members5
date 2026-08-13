/**
 * 유비챌 인증률 자동 입력
 * ------------------------------------------------------------
 * Supabase 에서 어제 인증 현황을 직접 읽어와 '인증률' 시트에 한 줄 추가한다.
 * 슬랙을 거치지 않는다. 매일 아침 트리거 하나로 굴러간다.
 *
 * 설치
 *  1. 시트 상단 [확장 프로그램] → [Apps Script]
 *  2. 안에 있는 내용 전부 지우고 이 코드를 붙여넣기 → 저장
 *  3. 상단 함수 선택창에서 setupTrigger 고르고 [실행] (권한 승인 한 번)
 *     → 매일 아침 7시에 자동 실행되게 등록됨
 *  4. 지금 바로 한 번 보고 싶으면 writeYesterday 를 실행
 *
 * 기수가 바뀌면 아래 COHORT 와 START_DATE 두 줄만 고치면 된다.
 */

const SUPABASE_URL = 'https://qaasxvatmribkgtatine.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XNd9sxTnMsuNmdT1JSXtdw_wMj0Ma9R';
const COHORT     = '8기';
const START_DATE = '2026-08-10';   // Day 1 (월요일)
const SHEET_NAME = '인증률';
const STAFF      = ['유버디', '이지흔', '이규태'];   // 통계에서 뺄 운영팀

/** Day N 의 실제 날짜 (평일만 셈) */
function dayDates_() {
  const out = [];
  const d = new Date(START_DATE + 'T00:00:00+09:00');
  while (out.length < 20) {
    const w = d.getDay();
    if (w >= 1 && w <= 5) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function ymd_(d) {
  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
}

/** Supabase 에서 이 기수 전체 멤버 요약을 가져온다 */
function fetchSummaries_() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/get_cohort_member_summaries', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    payload: JSON.stringify({ p_cohort: COHORT }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Supabase 응답 오류 ' + res.getResponseCode() + ' · ' + res.getContentText().slice(0, 200));
  }
  return JSON.parse(res.getContentText());
}

/** 인증률 구간별 코멘트 (렌 톤). day 로 번갈아 써서 매일 똑같지 않게. */
function comment_(pct, dayN) {
  const pool =
    pct >= 85 ? ['어제는 거의 다 인증해주셨어요! 이 흐름 그대로 오늘도 가볍게 가봐요. 딱 10분이면 충분합니다 🔥',
                 '인증률이 정말 좋아요 🎉 이대로면 완주가 멀지 않았습니다. 오늘도 한 줄만 남긴다는 마음으로 가봐요!'] :
    pct >= 70 ? ['어제도 많은 분들이 인증에 성공해주셨네요! 거창하게 하려고 하지 않아도 괜찮아요. 오늘도 딱 10분만, 한 줄이라도 남긴다는 마음으로 가볍게 참여해주세요 💪',
                 '꾸준히 잘 이어지고 있어요. 작은 10분이 쌓여서 한 달 뒤엔 큰 변화가 되어 있을 거예요. 오늘도 함께 화이팅입니다 🔥'] :
    pct >= 55 ? ['어제는 인증률이 조금 출렁였네요 🥲 다들 바쁘셨던 거겠죠, 탓할 일은 아니에요. 오늘은 딱 10분만 다시 흐름을 이어가주세요.',
                 '괜찮아요, 하루 빠졌다고 완주가 멀어지는 건 아니에요. 오늘 한 줄만 남겨도 충분합니다 🧡'] :
                ['어제 흐름이 확 꺾였어요. 다들 바쁜 일 있으셨던 건 아닌지 걱정되네요. 거창하지 않아도 되니 오늘 한 줄만 남겨주세요. 기다리고 있을게요 🧡',
                 '완주는 매일 해내는 게 아니라 다시 시작하는 힘에서 만들어지더라고요. 오늘 10분만 같이 가봐요 💪'];
  return pool[dayN % pool.length];
}

/** 톡방에 그대로 붙여넣는 메시지 한 덩어리 */
function pasteMsg_(tierLabel, dayN, dateStr, o, tzWait) {
  const pct = o.all ? Math.round(o.done / o.all * 1000) / 10 : 0;
  const L = [];
  L.push('Day ' + (dayN + 1) + '입니다 :)');
  L.push('🌅 어제 (' + dateStr + ', Day ' + dayN + ') ' + COHORT + ' 인증율 ' + tierLabel + ': ' + pct + '% (' + o.done + '/' + o.all + '명)');
  L.push('');
  if (o.miss.length) {
    L.push('❌ 미인증 ' + tierLabel + ' (' + o.miss.length + '분): ' + o.miss.map(function (n) { return '@' + n; }).join(' '));
    L.push('');
  }
  if (tzWait.length) {
    L.push('📬 시차 대기중 (' + tzWait.length + '분): ' + tzWait.map(function (n) { return '@' + n; }).join(' '));
    L.push('');
  }
  L.push('💬 ' + comment_(pct, dayN));
  return L.join('\n');
}

/** 어제(직전 평일) 기준으로 한 줄 계산 */
function computeRow_() {
  const dates = dayDates_();
  const today = ymd_(new Date());
  let dayN = 0;
  for (let i = 0; i < dates.length; i++) {
    if (ymd_(dates[i]) < today) dayN = i + 1;
  }
  if (dayN === 0) return null;
  const targetDate = ymd_(dates[dayN - 1]);

  const rows = fetchSummaries_().filter(function (r) {
    const n = String(r.member_name || '');
    return n && n.indexOf('__') !== 0 && STAFF.indexOf(n) === -1;
  });

  const seg = { basic: { done: 0, all: 0, miss: [] }, premium: { done: 0, all: 0, miss: [] } };
  const tzW = { basic: [], premium: [] };

  rows.forEach(function (r) {
    const t = (r.tier === 'premium') ? 'premium' : 'basic';
    seg[t].all += 1;
    const days = (r.verified_days || []).map(Number);
    const name = r.english_name || r.member_name;
    if (days.indexOf(dayN) >= 0) { seg[t].done += 1; return; }
    const tz = String(r.timezone_text || '+0h');
    const h = parseInt(tz.replace(/[^0-9-]/g, ''), 10) || 0;
    if (tz.charAt(0) === '-' && Math.abs(h) >= 2) tzW[t].push(name);
    else seg[t].miss.push(name);
  });

  const pct = function (o) { return o.all ? Math.round(o.done / o.all * 1000) / 10 : 0; };
  const aD = seg.basic.done + seg.premium.done;
  const aC = seg.basic.all + seg.premium.all;

  return [
    targetDate,
    'Day ' + dayN,
    (aC ? Math.round(aD / aC * 1000) / 10 : 0) + '% (' + aD + '/' + aC + ')',
    pct(seg.basic) + '% (' + seg.basic.done + '/' + seg.basic.all + ')',
    pct(seg.premium) + '% (' + seg.premium.done + '/' + seg.premium.all + ')',
    pasteMsg_('베이직', dayN, targetDate, seg.basic, tzW.basic),
    pasteMsg_('프리미엄', dayN, targetDate, seg.premium, tzW.premium),
  ];
}

/** 시트에 어제 한 줄 기록 (같은 날짜가 이미 있으면 덮어씀) */
function writeYesterday() {
  const row = computeRow_();
  if (!row) { Logger.log('아직 시작 전이에요'); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['날짜', 'Day', '전체', '베이직', '프리미엄',
                  '📋 베이직 톡방 (복붙)', '📋 프리미엄 톡방 (복붙)']);
    sh.getRange(1, 1, 1, 7)
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#2E6BA8');
    sh.setFrozenRows(1);
    sh.setColumnWidth(6, 460); sh.setColumnWidth(7, 460);
  }
  const dates = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getDisplayValues().flat();
  const hit = dates.indexOf(row[0]);
  const r = (hit >= 0) ? hit + 2 : sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, row.length).setValues([row]);
  sh.getRange(r, 6, 1, 2).setWrap(true).setVerticalAlignment('top');
  sh.setRowHeight(r, 150);
  Logger.log('기록 완료 · ' + row[0] + ' ' + row[1] + ' · 전체 ' + row[2]);
}

/** 매일 아침 7시 트리거 등록 (한 번만 실행) */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'writeYesterday') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('writeYesterday').timeBased().atHour(7).everyDays(1).create();
  Logger.log('매일 아침 7시 트리거 등록 완료');
}


/* ============================================================
   모닝 공지 20일치를 '메시지' 시트에 미리 채우기
   ------------------------------------------------------------
   한 번만 실행하면 됩니다. (함수 선택창에서 fillMorningNotices 실행)
   이미 같은 Day 가 있으면 덮어쓰지 않고 건너뜁니다.
   ============================================================ */

const MSG_SHEET = '주요 메시지';   // 탭 이름 변경됨 (2026-08-13)

const MORNING = [
  ['Day 01', '2026-08-10', '상황을 먼저 알린다', '오늘도 좋은 아침이에요, Day 1 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 업체한테 답 오는 대로 바로 공유드릴게요.\n· 법무팀 회신 오면 목요일에 잠깐 다시 모이죠.\n· 그쪽에서 뭐 바뀌면 편하게 한 줄 주세요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 먼저 알리고, 잠깐 모이기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n아직 온보딩 안 하신 분은 오늘 안에 마치고 같이 출발해주세요!\n\n🧡 첫날이라 앱이 좀 낯설게 느껴지실 수도 있어요. 그래도 오늘 딱 한 번 해보시면 내일부터는 훨씬 수월하실 거예요 :) 20일 같이 가봐요, 화이팅입니다!!'],
  ['Day 02', '2026-08-11', '이 일은 내가 끌고 간다', '오늘도 좋은 아침이에요, Day 2 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 이번 업체 선정은 누가 끌고 갈 거예요?\n· 캠페인 컨셉은 알아서 하라고 맡겨줬는데, 처음엔 좀 무섭더라고요.\n· 어느 순간엔 그냥 팔 걷고 파일을 다시 만드는 수밖에 없어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 운전대는 내가 잡기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n아직 온보딩 안 하신 분은 오늘 안에 마치고 같이 출발해주세요!\n\n🧡 어제보다 오늘이 조금 더 수월하게 느껴지실 거예요. 표현 하나만 입 밖으로 내보는 걸로 충분해요, 화이팅입니다 :)'],
  ['Day 03', '2026-08-12', '내가 한 일이 안 보일 때', '오늘도 좋은 아침이에요, Day 3 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 팀이 이 정도 규모면 다들 여러 역할 겸해요.\n· 밑작업은 거의 끝났고, 이제 승인만 받으면 돼요.\n· 콜 한 번 더 하는 것보다 공장에 사람이 직접 가 있어야 해요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 안 보이던 내 일 드러내기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n아직 온보딩 안 하신 분은 오늘 안에 마치고 같이 출발해주세요!\n\n🧡 사흘째예요. 딱 여기까지가 제일 어색한 구간이고, 이번 주만 넘기면 손이 알아서 움직입니다. 오늘도 10분만 같이 가봐요!'],
  ['Day 04', '2026-08-13', '나만 상황을 모를 때', '오늘도 좋은 아침이에요, Day 4 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 클라이언트 들어오기 전에 5분만 상황 설명드릴게요.\n· 아직 일 익히는 중이라, 클라이언트 콜에 바로 넣진 말죠.\n· 리콜 터진 뒤로 계속 우리랑 같이 구르고 있어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 모르면 물어보고 따라잡기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 오늘 표현은 회의에서 바로 써먹기 좋은 것들이에요. 하나만 골라서 오늘 안에 한 번 써보시는 걸 목표로 해보세요 :)'],
  ['Day 05', '2026-08-14', '월요일 아침 주간 보고', '오늘도 좋은 아침이에요, Day 5 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 3분기 출시 관련해서 지금 상황 짧게 공유드려요.\n· 법무 검토 문제없이 나와서 월요일 진행해도 돼요.\n· 공급사에 연락하기 전에 어떻게 접근할지부터 맞추죠.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 지금 어디까지 왔는지 말하기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 첫 주 마지막 날이에요! 여기까지 오신 것만으로 이미 절반은 습관이 잡힌 거예요. 주말엔 푹 쉬시고 월요일에 봬요 🎉'],
  ['Day 06', '2026-08-17', '말이 길어질 것 같으면', '오늘도 좋은 아침이에요, Day 6 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 결론부터 말하면, 날짜는 맞출 수 있는데 두 명이 더 필요해요.\n· 재작업 부담이 큰 것 같긴 한데, 수치로 한번 말해볼까요?\n· 한마디로, 파일럿은 됐는데 지금 상태로는 확대가 안 돼요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 결론부터 꺼내기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 주말 잘 쉬셨나요? 월요일이 제일 무거운 날인데 오늘만 넘기면 이번 주가 쭉 갑니다. 가볍게 시작해봐요!'],
  ['Day 07', '2026-08-18', '숫자로 비교해서 보고할 때', '오늘도 좋은 아침이에요, Day 7 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 반품이 전년 대비 8% 줄었어요.\n· 우리 리드타임을 경쟁사 두 곳이랑 먼저 비교해보죠.\n· 우리 가격이 저쪽이랑 견주면 어때요?\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 작년 대비로 말하기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 오늘 표현들은 숫자로 말할 때 쓰는 것들이에요. 보고 자리에서 바로 꺼내 쓰실 수 있을 거예요 :)'],
  ['Day 08', '2026-08-19', '정확한 숫자가 아직 없을 때', '오늘도 좋은 아침이에요, Day 8 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 3주쯤이요, 며칠 왔다갔다 할 수 있고요.\n· 경험상 재작업 몫으로 15% 정도는 잡아둬요.\n· 대충 계산한 거긴 한데, 2년차에 손익분기 넘을 것 같아요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 어림값이라도 말로 꺼내기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 딱 10분이면 됩니다. 지금 안 하면 저녁에 더 무거워지더라고요, 아침에 가볍게 털어버려요!'],
  ['Day 09', '2026-08-20', '아직 결과를 모를 때', '오늘도 좋은 아침이에요, Day 9 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 지난주에 매출이 좀 올랐는데, 새 패키지 덕인지는 아직 모르겠어요.\n· 저희는 샘플 요청이 선행 지표예요. 한 달쯤 뒤에 주문이 따라와요.\n· 연휴 전에 물건 들어온다고 믿진 않는 게 좋아요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 섣부른 단정 대신 신호만)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 오늘로 절반 가까이 왔어요. 매일 한 줄씩 쌓인 게 생각보다 큽니다, 오늘도 화이팅이에요 :)'],
  ['Day 10', '2026-08-21', '아직 안 정해졌다고 말할 때', '오늘도 좋은 아침이에요, Day 10 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 10월 날짜 확정은 아니니까, 곤란하면 지금 말해주세요.\n· 누가 발표할지는 아직 붕 떠 있어요.\n· 한쪽에 다 걸지 말고 두 번째 공급사도 살려둡시다.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 확정 아님을 분명히 하기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 2주차 마지막이에요! 여기까지 온 분들은 이미 흐름을 잡으신 거예요. 주말에 푹 쉬세요 🙌'],
  ['Day 11', '2026-08-24', '혼자 못 푸는 문제가 생겼을 때', '오늘도 좋은 아침이에요, Day 11 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 금요일까지 회신 없으면 그쪽 이사님께 올릴게요.\n· 이번 주에 샘플 못 받으면 12월 출시가 위태로워요.\n· 업체 확정하기 전에 하나 짚고 넘어가고 싶은 게 있어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 가라앉기 전에 꺼내기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 통계상 3주차가 제일 고비예요. 미리 말씀드렸던 그 주가 왔습니다. 완벽하게 하려고 하지 마시고, 딱 한 문장만 채워주세요 :)'],
  ['Day 12', '2026-08-25', '일정이 밀릴 것 같을 때', '오늘도 좋은 아침이에요, Day 12 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 성수기에 메인 라인 서면 차선책이 뭐예요?\n· 스펙 바뀐 뒤로 2주가 밀렸어요.\n· 고객들한테 먼저 메일 돌려서 컴플레인을 많이 막았어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 밀릴 것 같으면 미리 말하기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 오늘 못 하셔도 괜찮아요. 늦게 하셔도 그날 1일로 그대로 들어갑니다. 부담 내려놓고 편하게 오세요 🧡'],
  ['Day 13', '2026-08-26', '다 못 하겠다 싶을 때', '오늘도 좋은 아침이에요, Day 13 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 세 개 시장으로 줄이고 대신 제대로 하죠.\n· 첫 피드백 받고 2주차에 방향을 틀었어요.\n· 장표를 다섯 장으로 깎았더니 훨씬 잘 먹혔어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 줄이고 방향 틀기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 이 주만 넘기면 마지막 주예요. 지금 흐름 끊기는 게 제일 아까우니까 오늘 10분만 같이 가봐요!'],
  ['Day 14', '2026-08-27', '실수를 인정해야 할 때', '오늘도 좋은 아침이에요, Day 14 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 솔직히 먼저 말씀드리면, 이 물량으로는 그 가격 못 맞춰요.\n· 아끼지 말고 말해주세요. 일정이 비현실적이라고 보면 지금 말해주세요.\n· 그분이 수량 착오를 바로 인정해줘서 하루를 벌었어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 빠르게 인정하기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 오늘 표현들은 솔직하게 말해야 할 때 쓰는 것들이에요. 실무에서 은근히 자주 필요한 말들입니다 :)'],
  ['Day 15', '2026-08-28', '아무도 안 건드리는 문제를 꺼낼 때', '오늘도 좋은 아침이에요, Day 15 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 예산 얘기만 하는데, 안 바꾸면 드는 비용은요?\n· 물량은 늘었는데 응답 시간에선 기준에 못 미쳤어요.\n· 이거 덮고 갈 순 없어요. 감사에서 어차피 나와요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 안 하는 비용도 계산하기)\n\n⏰ 마감은 오늘 자정까지예요. 주말은 쉬어갑니다~\n\n🧡 3주차 완주하셨어요! 제일 힘든 구간을 넘기셨습니다. 이제 마지막 한 주만 남았어요 🎉'],
  ['Day 16', '2026-08-31', '내가 한 일을 어필해야 할 때', '오늘도 좋은 아침이에요, Day 16 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 리드가 휴직했을 때 그분이 나서서 감사 전체를 맡았어요.\n· 초과근무 수치를 근거로 인원 두 명 더 필요하다고 주장했어요.\n· 팀은 작은데 처리 속도에선 체급 이상 해내고 있어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 근거로 내 기여 말하기)\n\n⏰ 마감은 오늘 자정까지예요.\n\n🧡 마지막 주 시작이에요. 여기까지 온 게 진짜 대단한 거예요. 5일만 더 가봐요!'],
  ['Day 17', '2026-09-01', '동료를 띄워줘야 할 때', '오늘도 좋은 아침이에요, Day 17 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 공은 QA팀에 돌리고 싶어요. 출하 전에 잡아냈거든요.\n· 파일 고치느라 늦게까지 남아준 미나님 감사해요.\n· 리더십 미팅에서 그분 매니저가 엄청 칭찬하더라고요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 공은 크게 나누기)\n\n⏰ 마감은 오늘 자정까지예요.\n\n🧡 오늘 표현들은 내 성과를 말할 때 쓰는 것들이에요. 평가 시즌에 꺼내 쓰시면 딱입니다 :)'],
  ['Day 18', '2026-09-02', '평가 면담에 들어갈 때', '오늘도 좋은 아침이에요, Day 18 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 올해 제 성장 포인트는 유관부서 콜에서 더 일찍 말 꺼내는 거예요.\n· 매니저들이 확정 전에 평가 기준을 서로 맞춰요.\n· 어색한 거 아는데, 평가 시즌엔 본인 성과를 직접 말해야 해요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 평가의 언어로 말하기)\n\n⏰ 마감은 오늘 자정까지예요.\n\n🧡 이제 사흘 남았어요. 마무리까지 같이 가봐요, 화이팅입니다!'],
  ['Day 19', '2026-09-03', '더 큰 일을 맡고 싶을 때', '오늘도 좋은 아침이에요, Day 19 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· APAC 확장은 제 수준보다 한 단계 위 과제였는데, 일하는 방식이 바뀌었어요.\n· 멘토는 조언을 주고, 스폰서는 그 자리에서 내 이름을 꺼내줘요.\n· 돕고 싶은데 감사 끝날 때까지는 여력이 좀 없어요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 다음 기회 먼저 잡기)\n\n⏰ 마감은 오늘 자정까지예요.\n\n🧡 내일이면 마지막 날이에요. 20일 동안 쌓은 표현들이 곧 한 번에 지나갑니다 :)'],
  ['Day 20', '2026-09-04', '떠날 때도 프로답게', '오늘도 좋은 아침이에요, Day 20 시작합니다 :)\n\n💌 오늘 표현 미리 맛보기\n· 사람이 나갈 때 뭐가 빠지지 않게 인수인계 체크리스트를 만들고 있어요.\n· 위기에 침착한 사람이 필요한 팀이면 어디든 큰 힘이 될 분이에요.\n· 첫 달은 힘들었는데 그 뒤로는 순조로워요.\n\n이 세 마디, 영어로 바로 안 나오신다면 오늘 표현 꼭 알아가보세요!\n(오늘 테마: 깔끔하게 넘기고 나오기)\n\n⏰ 마감은 오늘 자정까지예요. 주말에는 수료식이 있습니다 🎓\n\n🧡 마지막 날이에요 🎓 여기까지 오신 것만으로 정말 대단하십니다. 오늘 파이널까지 마치고 기분 좋게 마무리해요, 그동안 진짜 수고 많으셨어요 🧡'],
];

const MORNING_SHEET = '모닝공지';

/**
 * 모닝 공지 20일치를 '모닝공지' 전용 시트로 분리한다.
 * ------------------------------------------------------------
 * '메시지' 시트는 렌님이 상황별로 쓰는 원고 전용으로 두고,
 * 매일 반복되는 모닝 공지는 여기로 뺀다. 섞여 있으면 둘 다 관리가 안 된다.
 *
 * 한 번만 실행하면 됩니다. 여러 번 눌러도 안전해요.
 */
function splitMorningSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) '메시지' 시트에 이미 들어간 모닝 공지 행을 걷어낸다 (아래에서 위로 삭제)
  const src = ss.getSheetByName(MSG_SHEET);
  let removed = 0;
  if (src && src.getLastRow() > 0) {
    const c = src.getRange(1, 3, src.getLastRow(), 1).getDisplayValues();
    for (let i = c.length - 1; i >= 0; i--) {
      if (String(c[i][0] || '').indexOf('모닝 공지 · ') === 0) { src.deleteRow(i + 1); removed++; }
    }
  }

  // 2) 전용 시트 준비
  let dst = ss.getSheetByName(MORNING_SHEET);
  if (!dst) {
    dst = ss.insertSheet(MORNING_SHEET);
    dst.appendRow(['Day', '날짜', '오늘 테마', '📋 본문 (그대로 복사)', '대상']);
    dst.getRange(1, 1, 1, 5)
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#2E6BA8')
      .setHorizontalAlignment('center');
    dst.setFrozenRows(1);
    dst.setColumnWidth(1, 70); dst.setColumnWidth(2, 100);
    dst.setColumnWidth(3, 170); dst.setColumnWidth(4, 560); dst.setColumnWidth(5, 150);
  }

  // 3) 날짜순으로 채운다 (이미 있으면 건너뜀)
  const dLast = Math.max(dst.getLastRow(), 1);
  const has = dst.getRange(1, 1, dLast, 1).getDisplayValues().map(function (r) { return String(r[0] || ''); });
  let added = 0;
  MORNING.forEach(function (m) {
    if (has.indexOf(m[0]) >= 0) return;
    dst.appendRow([m[0], m[1], m[2], m[3], '양 톡방 · 06:00 · 매니저']);
    added++;
  });

  // 4) 서식
  const n = dst.getLastRow();
  if (n > 1) {
    dst.getRange(2, 1, n - 1, 5).setVerticalAlignment('top');
    dst.getRange(2, 4, n - 1, 1).setWrap(true);
    dst.getRange(2, 1, n - 1, 2).setHorizontalAlignment('center');
    for (let r = 2; r <= n; r++) dst.setRowHeight(r, 160);
  }

  Logger.log('메시지 시트에서 ' + removed + '행 걷어냄 · 모닝공지 시트에 ' + added + '행 추가');
}


/* ============================================================
   일별 체크리스트 배경색 정리
   ------------------------------------------------------------
   매일 똑같이 반복되는 일은 흰색으로 두고,
   그날에만 있는 일만 색을 입혀서 한눈에 보이게 한다.
   한 번만 실행하면 됩니다. 내용이 바뀌면 다시 실행하세요.
   ============================================================ */

const CHECK_SHEET = '일별 체크리스트';

// 매일 반복되는 일 (이 단어가 들어가면 흰 배경)
const DAILY_KEYS = ['모닝 공지', '유버디 메시지', '녹음 확인', '미인증 명단', '1:1 케어'];

function paintChecklist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CHECK_SHEET);
  if (!sh) throw new Error("'" + CHECK_SHEET + "' 시트를 못 찾았어요");

  const first = 6;
  const last = sh.getLastRow();
  const tasks = sh.getRange(first, 6, last - first + 1, 1).getDisplayValues();

  const WHITE = '#ffffff';
  const SPECIAL = '#FFF7DC';   // 그날만의 일 · 연노랑
  const MEETING = '#F1E9F8';   // 미팅 · 연보라
  const STAR = '#FBE4E4';      // ★ 꼭 챙길 것 · 연분홍

  for (let i = 0; i < tasks.length; i++) {
    const t = String(tasks[i][0] || '');
    const row = first + i;
    if (!t) continue;

    const isDaily = DAILY_KEYS.some(function (k) { return t.indexOf(k) >= 0; });
    const isStar = t.indexOf('★') >= 0;
    const isMeeting = /미팅|발표자|녹화본|피드백 리포트/.test(t);

    let bg = SPECIAL;
    if (isDaily) bg = WHITE;
    else if (isStar) bg = STAR;
    else if (isMeeting) bg = MEETING;

    sh.getRange(row, 4, 1, 5).setBackground(bg);          // 시각~지침
    sh.getRange(row, 6, 1, 1).setFontWeight(isDaily ? 'normal' : 'bold');
  }

  Logger.log('배경색 정리 완료 · ' + tasks.length + '행');
}


/* ============================================================
   '한 스푼 더' (버디 메시지) 를 모닝공지 시트 옆 칸에 채우기
   ------------------------------------------------------------
   모닝공지 시트 F 열에 Day 별로 넣는다. 18:00 에 버디가 보내는 메시지.
   Day 1~3 은 이미 발송했으므로 Day 4~20 만 들어간다.
   여러 번 눌러도 덮어쓰기라 안전해요.
   ============================================================ */

const SPOON = [
  ['Day 04', '오늘 <나만 모르고 있을 때> 쓰는 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. loop in.\n직역하면 고리 안에 넣는다는 뜻인데, 회사에선 "이 사람도 이 대화나 상황에 포함시켜 알려주다"를 뜻합니다!\n"Can you loop in Sarah? She should know about this." (Sarah도 이 상황 알아야 하니 포함시켜 주세요.)\n이게 진짜 좋은 이유 - 이메일 CC 넣듯 "I\'ll loop you in"이라고 하면, 정보를 공유하는 동시에 상대가 소외감을 느끼지 않게 해줍니다 😉\n오늘 배운 Bring someone up to speed가 "이미 늦게 들어온 사람을 따라잡게 하는" 말이라면, loop in은 "앞으로 알고 있어야 할 사람을 대화에 포함시키는" 말이에요.\n슬랙이나 이메일 어디서든 바로 쓸 수 있어요. "I\'ll loop you in" 한 마디만으로 팀워크가 느껴집니다 👍'],
  ['Day 05', '오늘 <지금 어디까지 왔는지 보고하는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. on the same page.\n직역하면 같은 페이지에 있다는 뜻인데, 회사에선 "다들 같은 정보를 갖고 같은 방향을 보고 있다"를 뜻합니다!\n"Before we start, let\'s make sure we\'re all on the same page." (시작 전에 다 같이 같은 내용을 공유하고 있는지 확인하죠.)\n이게 진짜 좋은 이유 - 회의 시작 전에 꺼내면 전제 충돌을 미리 막아줘요. "Are we on the same page?"라고 물으면 이견을 부담 없이 꺼낼 기회가 자연스럽게 열립니다 😉\n오늘 배운 Where things stand가 "현재 상태를 전달하는" 말이라면, on the same page는 "상대가 그 내용을 나와 같이 이해했는지 확인하는" 말이에요.\n주간 보고 끝에 "Does everyone feel on the same page?" 한 마디만 더해보세요. 분위기가 달라집니다 👍'],
  ['Day 06', '오늘 <말 길어지기 전에 핵심 꺼내는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. cut to the chase.\n직역하면 추격 장면으로 바로 건너뛰다는 뜻인데, 회사에선 "서론 빼고 바로 본론으로 들어가다"를 뜻합니다!\n"Let me cut to the chase, we\'re over budget by 20%." (바로 본론으로 가면, 예산이 20% 초과됐어요.)\n이게 진짜 좋은 이유 - 영화 편집자들이 지루한 장면을 건너뛰고 추격 장면(chase)으로 잘라내던 데서 왔어요. 보고 자리에서 "Let me cut to the chase"로 시작하면 듣는 사람이 바로 집중합니다 😉\n오늘 배운 Bottom line이 "결론 자체"를 말하는 표현이라면, cut to the chase는 "결론으로 건너뛰는 행동"을 말하는 표현이에요.\n다음 번에 말이 길어질 것 같으면 딱 이 한 마디로 시작해보세요 👍'],
  ['Day 07', '오늘 <숫자로 비교해서 말하는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. apples to apples.\n직역하면 사과 대 사과인데, 회사에선 "같은 기준끼리 공정하게 비교하다"를 뜻합니다!\n"We need to make sure we\'re comparing apples to apples here." (같은 조건으로 비교하고 있는 건지 먼저 확인해야 해요.)\n이게 진짜 좋은 이유 - 사과랑 오렌지를 비교하면 의미가 없듯, 조건이 다른 숫자를 나란히 놓으면 결론이 왜곡돼요. 상대가 기준 없이 숫자를 던질 때 "Is that apples to apples?"라고 물으면 대화가 사실 위로 돌아옵니다 😉\n오늘 배운 Benchmark가 "외부 기준을 가져와 비교하는 것"이라면, apples to apples는 "그 비교 자체가 공정한지 확인하는 것"이에요.\n다음에 데이터 비교할 때 한 번 써보세요. 준비된 사람처럼 들립니다 👍'],
  ['Day 08', '오늘 <어림값이라도 자신 있게 말하는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. ballpark.\n직역하면 야구장인데, 회사에선 "대략적인 숫자 범위" 또는 "어림잡아"를 뜻합니다!\n"What\'s the ballpark cost?" (대략 얼마나 들까요?)\n"We\'re in the same ballpark." (비슷한 수준이에요.)\n이게 진짜 좋은 이유 - 야구장처럼 넓은 범위 안에 있다는 그림이에요. "Just a ballpark"이라고 먼저 붙이면 정확하지 않아도 숫자를 꺼낼 수 있고, 나중에 틀려도 말 바꿨다는 소리를 안 듣습니다 😉\n오늘 배운 Give or take가 "숫자 뒤에 붙이는 오차 표시"라면, ballpark은 "처음부터 어림잡은 범위"를 말할 때 써요.\n"Just a ballpark"이라고 먼저 붙이면 틀려도 괜찮아집니다. 오늘 바로 써보세요 👍'],
  ['Day 09', '오늘 <결론은 아직 모르는데 신호만 읽는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. read the tea leaves.\n직역하면 찻잎을 읽다인데, 회사에선 "초기 신호를 분석해서 앞을 예측하다"를 뜻합니다!\n"I\'m trying to read the tea leaves here, but it still looks promising." (아직 확실하진 않지만, 초기 신호를 보면 나쁘지 않아 보여요.)\n이게 진짜 좋은 이유 - 홍차 점술에서 찻잎 패턴으로 운명을 읽던 데서 온 말이에요. "I\'ve been reading the tea leaves"라고 하면 데이터가 아직 없는 게 아니라 신호를 해석 중이라는 전문가적 인상을 줍니다 😉\n오늘 배운 Leading indicator가 "앞서 움직이는 지표 자체"라면, read the tea leaves는 "그 지표를 해석하는 행위"예요.\n다음 보고에서 "Here\'s what I\'m reading from the tea leaves"라고 시작해보세요 👍'],
  ['Day 10', '오늘 <아직 확정 안 됐다고 말하는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. put a pin in it.\n직역하면 핀을 꽂아두다인데, 회사에선 "지금은 잠깐 보류하고 나중에 다시 돌아오다"를 뜻합니다!\n"Let\'s put a pin in the timeline discussion and come back to it after the call." (일정 얘기는 잠깐 보류하고, 콜 끝나고 다시 보죠.)\n이게 진짜 좋은 이유 - 지도에 핀 꽂아놓듯 "위치를 표시해두고 나중에 돌아온다"는 그림이에요. 논의를 그냥 끊는 게 아니라 "우리 이 대화 기억하고 있어요"라는 뉘앙스라 분위기가 훨씬 부드럽습니다 😉\n오늘 배운 Up in the air가 "아직 아무것도 결정이 안 된 상태"라면, put a pin in it은 "잠깐 다른 걸 먼저 처리하고 다시 오겠다"는 적극적인 보류예요.\n다음 회의에서 옆길로 새는 대화가 있으면 써보세요. "Let\'s pin that." 한 마디로 정리됩니다 👍'],
  ['Day 11', '오늘 <가라앉기 전에 문제 꺼내는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. give someone a heads-up.\n직역하면 누군가의 고개를 들게 한다는 뜻인데, 회사에선 "무언가가 일어나기 전에 미리 알려주다"를 뜻합니다!\n"Just a heads-up, the client might push back on the pricing." (미리 알려드리는 건데, 클라이언트가 가격에 이의를 제기할 수 있어요.)\n이게 진짜 좋은 이유 - "이미 터진 상황"을 보고하는 게 아니라 "터지기 전에 예고하는" 말이에요. 이 말을 쓰는 순간, 준비된 사람이라는 인상이 생깁니다 😉\n오늘 배운 Surface an issue가 "묻혀 있던 문제를 수면 위로 올리는 것"이라면, heads-up은 "아직 안 터진 상황을 미리 알리는 것"이에요.\n문자나 슬랙 첫 줄에 "Quick heads-up:"이라고 쓰는 것만으로 분위기가 달라집니다 👍'],
  ['Day 12', '오늘 <일정 밀릴 것 같을 때 미리 대처하는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. wiggle room.\n직역하면 꼼지락거릴 공간인데, 회사에선 "일정이나 예산에서 약간 조정할 수 있는 여유 공간"을 뜻합니다!\n"Is there any wiggle room on the delivery date?" (납기일이 조금 유동적으로 조정될 수 있나요?)\n이게 진짜 좋은 이유 - "여유 없다" "당겨달라"는 말은 부담이지만, "wiggle room이 있나요?"는 부드럽게 협상의 문을 열어줍니다. 가격이나 일정이나 스펙 어디서든 쓸 수 있어요 😉\n오늘 배운 Fallback이 "안 됐을 때 쓸 차선책"이라면, wiggle room은 "처음부터 남겨두는 여유 공간"이에요.\n납기일이나 예산 협상에서 "Any wiggle room there?" 한 마디만 더해보세요 👍'],
  ['Day 13', '오늘 <줄이고 방향 트는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. trade-off.\n직역하면 무언가를 교환으로 포기하다인데, 회사에선 "하나를 얻으면 다른 하나를 포기하는 선택의 균형"을 뜻합니다!\n"There\'s always a trade-off between speed and quality." (속도와 품질 사이에는 항상 트레이드오프가 있어요.)\n이게 진짜 좋은 이유 - "못 한다"고 하면 무능해 보이지만, "trade-off가 있다"고 하면 전략적으로 선택하는 사람처럼 들려요. 우선순위를 설명할 때 이 프레임을 쓰면 반응이 달라집니다 😉\n오늘 배운 Scale back이 "규모를 줄이는 행동"이라면, trade-off는 "그 선택 안에서 얻는 것과 잃는 것을 설명하는 언어"예요.\n"We can do this, but the trade-off is..." 이 한 문장이 논의를 명확하게 만듭니다 👍'],
  ['Day 14', '오늘 <실수를 빠르게 인정하는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. come clean.\n직역하면 깨끗하게 나오다인데, 회사에선 "숨겼던 것을 완전히 털어놓다, 완전히 솔직해지다"를 뜻합니다!\n"I should come clean, I made an error in the forecast." (솔직하게 말씀드려야 할 것 같아요. 예측 수치에 오류가 있었어요.)\n이게 진짜 좋은 이유 - "I need to come clean about something"이라고 시작하면 상대가 들을 준비를 해요. 털어놓기 무서울수록 먼저 꺼낼수록 신뢰를 삽니다 😉\n오늘 배운 Be upfront가 "처음부터 솔직하게 말하는 것"이라면, come clean은 "이미 일어난 일에 대해 완전히 털어놓는" 한 박자 늦은 버전이에요.\n"I should come clean" 이 한 마디가 위기를 신뢰로 바꿉니다 👍'],
  ['Day 15', '오늘 <아무도 안 꺼내는 문제를 꺼내는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. elephant in the room.\n직역하면 방 안의 코끼리인데, 회사에선 "다들 알고 있지만 아무도 꺼내지 않는 크고 불편한 문제"를 뜻합니다!\n"Let\'s address the elephant in the room, our churn rate has doubled." (다들 아는 얘기 꺼내죠. 이탈률이 두 배로 늘었어요.)\n이게 진짜 좋은 이유 - 방에 코끼리가 있어도 아무도 말 안 하듯, 모두가 보고 있지만 먼저 꺼내면 어색해질 것 같아 침묵하는 문제가 회사엔 많아요. 이 표현을 쓰는 순간 "내가 감수하고 꺼내는 거야"라는 용기가 전달됩니다 😉\n오늘 배운 Sweep it under the rug가 "덮으려는 시도"를 가리킨다면, elephant in the room은 "덮어도 다 보이는 그 문제 자체"예요.\n"Let\'s talk about the elephant in the room." 이 한 문장이 회의를 바꿉니다 👍'],
  ['Day 16', '오늘 <근거로 내 기여를 말하는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. track record.\n직역하면 트랙 기록인데, 회사에선 "지금까지 쌓아온 실적과 성과의 이력"을 뜻합니다!\n"She has a strong track record of hitting her targets." (그분은 목표를 꾸준히 달성해온 탄탄한 실적이 있어요.)\n이게 진짜 좋은 이유 - "잘했어요"보다 "track record가 있어요"라고 하면 데이터로 말하는 사람처럼 들려요. 이직 면접, 제안서, 평가 면담에서 모두 쓸 수 있는 만능 표현입니다 😉\n오늘 배운 Punch above your weight가 "체급 이상의 성과를 냈다"는 평가라면, track record는 "그 성과가 반복됐다는 증거"예요.\n"My track record shows..."로 시작하는 문장 하나 미리 준비해보세요 👍'],
  ['Day 17', '오늘 <동료 공을 크게 나누는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. put in a good word.\n직역하면 좋은 말 한 마디 넣어주다인데, 회사에선 "다른 사람 앞에서 누군가를 위해 추천하거나 칭찬해주다"를 뜻합니다!\n"Could you put in a good word for me with the hiring manager?" (채용 담당자한테 저 좀 좋게 말해줄 수 있어요?)\n이게 진짜 좋은 이유 - Sing someone\'s praises가 "그 자리에서 크게 칭찬하는 것"이라면, put in a good word는 좀 더 조용하게 비공개 자리에서 누군가를 챙겨주는 느낌이에요. 부탁할 때도 해드릴 때도 모두 쓸 수 있습니다 😉\n"I\'ll put in a good word for you." 라고 해주면 받는 사람이 정말 고마워하는 한 마디예요 👍'],
  ['Day 18', '오늘 <평가 면담에서 쓰는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. brag sheet.\n직역하면 자랑 목록인데, 회사에선 "평가 시즌 전에 내 성과를 미리 정리해둔 문서나 목록"을 뜻합니다!\n"Before review season, I always put together a brag sheet so I don\'t forget what I did." (평가 전에 항상 제 성과 목록을 미리 만들어둬요. 뭘 했는지 잊어버리지 않게요.)\n이게 진짜 좋은 이유 - 평가 면담에서 기억을 더듬으면 핵심이 빠져요. 미리 정리해둔 brag sheet이 있으면 Toot your own horn도 훨씬 자연스럽게 됩니다 😉\n오늘 배운 Toot your own horn이 "자기 성과를 말하는 행동"이라면, brag sheet은 "그 말을 준비하게 해주는 도구"예요.\n지금 바로 메모장에 올해 한 일 5개만 적어보세요. 그게 brag sheet의 시작입니다 👍'],
  ['Day 19', '오늘 <다음 기회 먼저 잡는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. throw your hat in the ring.\n직역하면 모자를 링 안에 던지다인데, 회사에선 "경쟁이나 기회에 공개적으로 참가 의사를 밝히다"를 뜻합니다!\n"I\'m going to throw my hat in the ring for the team lead position." (팀 리더 자리에 지원해볼 생각이에요.)\n이게 진짜 좋은 이유 - 권투에서 도전자가 모자를 링 안으로 던지며 싸움에 나서겠다는 뜻을 밝히던 데서 왔어요. 아직 "하고 싶어요"라고 말하는 게 어색하다면, 이 표현으로 시작해보세요. 과감하고 명확하게 들립니다 😉\n오늘 배운 Stretch assignment가 "맡고 싶은 한 단계 위 과제"라면, throw your hat in the ring은 "그 과제를 달라고 손 드는 행동"이에요.\n"I\'d like to throw my hat in the ring for this one." 한 마디가 기회를 만들어요 👍'],
  ['Day 20', '오늘 <마무리를 깔끔하게 넘기는> 표현들이었죠 :)\n여기에 딱 붙는 말 하나 더 드릴게요. 바로.. close the loop.\n직역하면 고리를 닫다인데, 회사에선 "논의나 일이 완전히 마무리됐음을 상대에게 알리다"를 뜻합니다!\n"Just reaching out to close the loop on the vendor selection." (업체 선정 건 최종 마무리 확인차 연락드려요.)\n이게 진짜 좋은 이유 - 열어뒀던 대화나 과제가 끝났을 때 상대에게 알려주는 말이에요. 이 한 마디 없으면 상대는 "그거 어떻게 됐지?"를 계속 신경 써야 해요. 닫아주는 사람이 신뢰를 삽니다 😉\n오늘 배운 Offboarding이 "떠나는 절차 전체"라면, close the loop은 "각각의 업무 하나하나를 매듭짓는 행동"이에요.\n챌린지 마지막 날에 잘 어울리는 표현이에요. 오늘 이 표현으로 20일을 닫아보세요 👍'],
];

function fillOneSpoon() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(MORNING_SHEET);
  if (!sh) throw new Error("'" + MORNING_SHEET + "' 시트를 먼저 만들어주세요 (splitMorningSheet 실행)");

  if (String(sh.getRange(1, 6).getDisplayValue() || '').trim() === '') {
    sh.getRange(1, 6).setValue('\ud83e\udde1 \ud55c \uc2a4\ud476 \ub354 (18:00 \u00b7 \ubc84\ub514)')
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#7B5E8C')
      .setHorizontalAlignment('center');
    sh.setColumnWidth(6, 560);
  }

  const last = sh.getLastRow();
  const days = sh.getRange(1, 1, last, 1).getDisplayValues().map(function (r) { return String(r[0] || '').trim(); });

  let n = 0;
  SPOON.forEach(function (sp) {
    const idx = days.indexOf(sp[0]);
    if (idx < 0) return;
    sh.getRange(idx + 1, 6).setValue(sp[1]).setWrap(true).setVerticalAlignment('top');
    n++;
  });

  Logger.log('\ud55c \uc2a4\ud476 \ub354 ' + n + '\uc77c\uce58 \uc785\ub825 \uc644\ub8cc');
}

/* ============================================================
   운영 메시지 원고를 '주요 메시지' 시트에 채우기
   ------------------------------------------------------------
   체크리스트에서 링크가 비어 있던 항목들의 원고. 같은 제목이 이미 있으면
   덮어쓰므로 여러 번 실행해도 중복이 안 생깁니다.
   ============================================================ */

const OPS_MSGS = [
  ['day 04', '당일 미팅 알림 + 참여자 조사', '프리미엄 · 미팅 당일 · 버디', '오늘 저녁 9시, 미팅이에요! 🎥\n\n🗓 오늘 밤 9:00~10:00 · Google Meet\nhttps://meet.google.com/sff-fgce-npj\n\nWeek 1은 오리엔테이션이라 발표가 없습니다!\n서로 인사하고, 이번 20일 동안 뭘 가져가고 싶은지 정하는 자리예요.\n그리고 제가 여러분들을 알아가는 자리기도 하고요 :)\n\n편한 마음으로 오시되, 어떤 상황에서 영어를 잘하고 싶은지\n구체적으로 말씀해주시면 남은 한 달을 훨씬 알차게 쓰실 수 있을 거예요.\n\n미팅 전에 세 가지만 부탁드려요 (앱 홈 \'미팅 전 할 일\'에서 확인 가능해요)\n· 사전 진단지 작성\n· Meeting 1 페이지 채우기\n· 이 방에 간단히 자기소개 남기기\n\n📌 참석 가능하신 분은 이모지 눌러주세요!\n못 오시는 분들을 위해 녹화본도 남겨드릴게요 :)'],
  ['day 04', '미팅 전 할 일 리마인드', '프리미엄 · 미팅 전날/당일 · 매니저', '미팅 전에 세 가지만 부탁드려요 :)\n앱 홈의 <미팅 전 할 일> 카드에서 하나씩 체크하실 수 있어요.\n\n· 사전 진단지 작성\n· Meeting 1 페이지 채우기\n· 이 방에 간단히 자기소개 남기기\n\n@아직 안 하신 분 태그\n\n셋 다 하시면 배너가 <미팅 준비 완료>로 바뀐답니다~\n특히 사전 진단지는 미팅과 예문을 여러분 상황에 맞춰 준비하는 데 그대로 쓰여서\n꼭 채워주시면 좋아요 🧡'],
  ['day 05', '미팅 녹화본 공지 (매주 금)', '프리미엄 · 금요일 08:00 · 버디', '어젯밤 미팅 정말 고생 많으셨어요 🧡\nWeek {N} 미팅 녹화본 올려드립니다!\n\n📹 녹화본\n{드라이브 링크}\n\n못 오신 분들은 이걸로 보시면 돼요.\n앱 회의록 페이지의 [📑 미팅 슬라이드 보기]로 자료도 같이 보시면 좋아요.\n\n어제 나온 <안 들렸던 단어>는 다음 주 미팅에서 짧게 정리해드릴게요.\n미팅 노트에 적어두신 것들, 잊기 전에 한 번씩 다시 보시면 훨씬 오래 남습니다 :)'],
  ['day 05', '주간 테스트 오픈 안내', '양 톡방 · Day 5/10/15 · 버디', '이번 주 5일을 다 채우신 분들은 <주간 테스트>가 열렸어요! 🎁\n\n앱 [내 학습]에서 이번 주 카드를 눌러보시면 보입니다.\n익히기 → 떠올리기 → 섞어보기 3단계고, 5분이면 끝나요.\n\n통과하시면 <단어 잠금화면>을 드려요.\n휴대폰 잠금화면에 이번 주 표현을 걸어두시면 하루에 몇 번씩 저절로 복습됩니다 :)\n\n아직 5일을 못 채우셨어도 괜찮아요!\n빠진 날을 채우시면 그때 바로 열립니다~'],
  ['day 05', '첫 주 마무리 격려', '양 톡방 · Day 5 · 버디', '첫 주 마지막 날이에요! 🎉\n\n솔직히 첫 주가 제일 어색하고 손에 안 붙는 구간인데,\n여기까지 오신 것만으로 이미 절반은 습관이 잡히신 거예요.\n\n주말은 쉬어갑니다. 푹 쉬시고 월요일에 봬요~\n혹시 이번 주에 빠진 날이 있으시면 주말에 편하게 채우셔도 됩니다.\n늦게 하셔도 그날 1일로 그대로 들어가니 부담 갖지 마세요 🧡'],
  ['day 06', '2주차 오프닝 + 모닝 밋업 안내', '양 톡방 · Day 6 · 버디', '2주차 시작입니다 :)\n\n주말 잘 쉬셨나요? 월요일이 제일 무거운 날인데\n오늘만 넘기면 이번 주가 쭉 갑니다. 가볍게 시작해봐요!\n\n📌 이번 주부터 2주간 <모닝 밋업>이 열려요!\n아침 7시에 구글 미트로 만나서 50분간 함께 있는 시간입니다.\n\n말은 안 해요, 노토킹이에요 :)\n영어 공부를 하셔도 되고, 각자의 루틴을 하셔도 됩니다.\n그냥 같이 켜두고 각자 할 일 하는 거예요.\n\n혼자 하면 미루게 되는데 누가 같이 켜져 있으면 신기하게 하게 되더라고요.\n참여하실 분은 이모지 눌러주세요!'],
  ['day 09', '발표자 모집 안내', '프리미엄 · Day 9/14/19 · 매니저', '이번 주 미팅 발표자 자리를 열었어요! 🎤\n\n7분 발표 + 3분 피드백이고, 주당 4명 선착순입니다.\n앱 프리미엄 탭 → 이번 주 미팅 카드에서 <발표 자리 잡기> 누르시면 예약돼요.\n\n발표라고 하면 부담스러우실 수 있는데요,\n거창한 준비 없이 <내 상황으로 만든 문장>을 들고 오시면 됩니다.\n동료들이 "나라면 이렇게" 버전을 얹어주는 자리예요.\n\n발표하신 분께는 개인 피드백 리포트를 따로 만들어 드려요 🧡'],
  ['day 10', '절반 지점 격려', '양 톡방 · Day 10 · 버디', '벌써 절반 왔어요! 🙌\n\n2주 동안 표현 30개를 지나왔고, 그중 몇 개는 이미 입에 붙으셨을 거예요.\n아직 안 떠오르는 게 더 많아도 정상이에요. Day 1~10은 원래 그렇습니다.\n\n지금부터가 진짜인데요,\n통계상 둘째~셋째 주가 제일 고비예요. 미리 말씀드릴게요 💀\n\n완벽하게 하려고 하지 마시고, 딱 한 문장만 채운다는 마음으로 오세요.\n그게 쌓여서 완주가 됩니다 :)'],
  ['day 10', '발표 피드백 리포트 발행 알림', '프리미엄 · 미팅 후 · 버디', '이번 주 발표해주신 분들 리포트가 나왔어요 📝\n\n앱 프리미엄 탭에서 확인하실 수 있고, 팝업으로도 뜹니다.\n발표에서 좋았던 점, 다음에 바꿔보면 좋을 한 가지,\n그리고 그 자리에서 쓰면 좋았을 표현을 정리해뒀어요.\n\n발표 안 하신 분들도 샘플 리포트를 열어보실 수 있어요.\n다음 주 발표 자리는 미팅 카드에서 예약 가능합니다 :)'],
  ['day 11', '★ 3주차 고비 정상화', '양 톡방 · Day 11 · 버디', '3주차입니다. 미리 말씀드렸던 그 주가 왔어요 💀\n\n통계상 여기가 제일 많이 빠지는 구간이에요.\n그런데 그게 의지가 약해서가 아니라, 원래 이 구간이 그렇습니다.\n처음의 새로움은 사라졌는데 아직 습관은 안 됐거든요.\n\n그래서 이번 주만 목표를 낮춰주세요.\n· 3개 다 안 하셔도 돼요. 1번 하나만\n· 문장이 어색해도 돼요. 제출만\n· 하루 빠지셔도 돼요. 다음 날 오시면 됩니다\n\n수료는 20일 중 18일이라 아직 여유가 있어요.\n그리고 늦게 하셔도 그날 1일로 그대로 들어갑니다.\n\n이번 주만 넘기면 마지막 주는 신기하게 쉬워요.\n같이 가봐요 🧡'],
  ['day 15', '3주 완주 칭찬', '양 톡방 · Day 15 · 버디', '3주차 완주하셨어요! 🎉\n\n제일 힘든 구간을 넘기셨습니다.\n여기까지 오신 분들은 이제 흐름이 몸에 붙으신 거예요.\n\n이제 마지막 한 주만 남았어요.\n다음 주는 <내 성과 말하기> 표현들이라, 평가 시즌이나 면담에서\n바로 꺼내 쓰실 수 있는 것들입니다.\n\n주말 푹 쉬시고 월요일에 마지막 주 시작해요 :)'],
  ['day 16', '★ 단어집 PDF 예고', '양 톡방 · Day 16 · 버디', '마지막 주 시작이에요! 그리고 예고 하나 드릴게요 📖\n\n20일 동안 배운 표현 60개 + 유의어 120개를\n예문·뉘앙스까지 정리한 <8기 단어 모음집 PDF>를 드립니다.\n\n수료하신 분께 드리는 자료라, 지금 상황을 한 번 확인해보시면 좋아요.\n앱 [내 학습]에서 왼쪽 상단 <전체 커리큘럼>을 누르면\n지금까지 몇 일 채우셨는지 한눈에 보입니다.\n\n📌 수료 기준은 18일 이상 학습 + 파이널 테스트 응시예요.\n20일 중 18일이라 이틀은 빠지셔도 되고, 지각도 1일로 인정됩니다.\n빠진 날이 있으시면 이번 주에 채우셔도 늦지 않아요!'],
  ['day 16', '수료 기준 재안내', '양 톡방 · Day 16~17 · 버디', '수료 기준 다시 한 번 정리해드릴게요 :)\n\n📌 18일 이상 학습 + 파이널 테스트 응시\n\n보상은 두 갈래예요.\n1. 18일 이상 <정시> 인증 + 파이널 → 1일1비 체험권 + 8기 단어 모음집 PDF\n2. 18일 이상 인증 (지각 포함) + 파이널 → 8기 단어 모음집 PDF\n\n지금 몇 일 채우셨는지는 앱 [내 학습] → <전체 커리큘럼>에서 보실 수 있어요.\n빠진 날은 지금 채우셔도 그대로 1일로 들어갑니다. 마감이 따로 없어요!\n\n혹시 계산이 헷갈리시면 편하게 물어봐주세요.\n남은 날 다 하시면 몇 일인지 같이 세어드릴게요 🧡'],
  ['day 20', '파이널 테스트 안내', '양 톡방 · Day 20 · 버디', '마지막 날이에요 🎓 그리고 파이널 테스트가 열렸습니다!\n\n20일 동안 쌓은 표현 60개가 한 번에 지나가요.\n어떤 게 진짜 내 것이 됐는지 눈으로 확인하는 자리예요.\n\n📌 점수로 거르지 않아요. 응시 자체가 수료 조건입니다.\n10분이면 끝나고, 모르면 힌트 보기나 Skip 하셔도 돼요.\n\n앱 홈에서 <파이널 테스트> 배너를 누르시면 바로 시작됩니다.\n마감도 없으니 오늘 못 하셔도 나중에 하시면 그대로 인정돼요!\n\n20일 동안 정말 고생 많으셨어요 🧡'],
  ['day 20', '파이널 미응시자 리마인드', '양 톡방 · Day 20 이후 · 매니저', '파이널 테스트 아직 안 보신 분들 안내드려요 :)\n\n@미응시자 태그\n\n📌 점수로 거르지 않습니다. 응시만 하시면 수료 조건 충족이에요.\n10분이면 끝나고, 모르는 건 Skip 하셔도 됩니다.\n\n앱 홈 → <파이널 테스트> 배너에서 바로 시작하실 수 있어요.\n마감이 없어서 지금 하셔도 그대로 인정됩니다!\n\n여기까지 오셨는데 이것만 남기시면 아까우니까,\n오늘 10분만 내주세요 🧡'],
  ['day 01', '이전 기수 경험자 개인 과제 안내', '양 톡방 · Day 1 · 버디', '<이전 기수 함께하셨던 분들께>\n\n다시 와주신 분들은 개인 과제가 따로 있어요!\n같은 걸 또 하시는 것보다 훨씬 남는 게 많을 거예요 :)\n과제도 이 방에 그대로 올려주시면 됩니다~'],
  ['day 03', '빈도 안내 + 초급자 안심', '양 톡방 · Day 3 · 버디', '<하나만 바로잡을게요>\n\n매일 나오는 표현 3개, 어려운 순서가 아니에요!\n자주 쓰는 순서예요 :)\n\n앱에서 표현마다 <빈도>를 점 5개로 표시해뒀어요.\n1번 ●●●●● 회사에서 가장 자주 나오는 표현\n3번 ●●●○○ 자주는 아니지만 알면 티 나는 표현\n\n그래서 시간 없으신 날은 1번만 챙기셔도 충분합니다.\n3번이 더 어려운 게 아니라, 덜 자주 나오는 것뿐이에요~\n\n<혹시 "나만 못 따라가나" 싶으셨다면>\n\n전혀 아니에요! Day 1~10까지는 원래 단어가 바로바로 안 떠올라요.\n그게 정상이고, 그러다 어느 순간 저절로 파박 떠오르는 때가 옵니다.\n지금은 그냥 매일 입에 한 번 올려보는 것만 해주세요 :)'],
  ['day 01', '인증 방법 안내 (앱 인증만으론 절반)', '양 톡방 · Day 1 · 버디', '<하루 인증은 두 가지예요>\n\n앱에서 학습만 하시면 절반만 된 거예요! 😮\n카톡 녹음까지 올려주셔야 그날 인증이 완성됩니다.\n\n1️⃣ 웹 학습 인증\n   문장 3번 읽기 → 내 문장 만들기 → 단어 퀴즈 제출\n   → 대시보드 오늘 칸이 <연한 하늘색>으로 바뀌면 완료\n\n2️⃣ 카톡 녹음 인증\n   앱에서 만든 내 문장 3개를 녹음해서 이 방에 올리기\n   → 운영자가 확인하면 <진한 파랑>으로 바뀌어요\n\n둘 다 되면 진한 파랑, 앱만 하시면 연한 하늘색으로 남아요.\n지금 본인 색이 어떤지 대시보드에서 한 번 확인해보세요 :)\n\n녹음은 잘하려고 하지 마시고, 그냥 소리내어 읽는다는 마음으로 올려주세요.\n입 밖으로 한 번 내보는 게 전부예요 🧡'],
  ['day 03', '앱 사용 설명서 링크 공유', '양 톡방 · Day 3 · 버디', '앱 사용 설명서를 만들어뒀어요! 📖\n\n앱 오른쪽 위 <?> 아이콘을 누르시면 언제든 열립니다.\n· 하루 흐름이 어떻게 되는지\n· 대시보드 색이 각각 무슨 뜻인지\n· 지난 Day 를 어떻게 다시 여는지\n· 학습 꿀팁 4가지\n\n특히 <학습 꿀팁>은 꼭 한 번 읽어보세요.\n같은 10분을 써도 남는 게 달라집니다 :)\n\n읽으시다가 "이건 설명이 없네" 싶은 게 있으면 편하게 말씀해주세요.\n바로 추가해드릴게요 🧡'],
  ['day 17', '턱걸이 인원 개별 안내', '1:1 개인톡 · Day 17 전후 · 매니저', '{이름}님 안녕하세요 🧡 ~~\n\n요즘 일정은 괜찮으세요?\n혹시 어려움이나 피드백 있으면 편하게 알려주시구요~!\n\n수료 보상은 18일 이상 인증 기준인데,\n{이름}님 지금 {N}일이시라 남은 {M}일 다 인증해주시면 정확히 18점입니다!\n\n빠진 날은 지금 채우셔도 그대로 1일로 들어가요. 마감이 따로 없어요.\n앱 [내 학습] → 왼쪽 상단 <전체 커리큘럼>에서 지난 Day 를 여실 수 있습니다.\n\n혹시 하시면서 재미 없어진 점 / 귀찮아진 이유가 (…솔직한 게 좋아요!!!) 있으시다면\n부담 없이 답장 부탁드려요!'],
  ['day 11', '쉬는 상태 진입자 1:1', '1:1 개인톡 · 4일 연속 미인증 · 매니저', '{이름}님 안녕하세요 🧡 ~~\n\n며칠 인증이 안 보이셔서 혹시 무슨 일 있으신가 해서 연락드려요.\n바쁘신 시기일 수도 있고요, 그럴 수 있어요!\n\n혹시 시작이 막막하셨거나, 앱에서 막히는 부분이 있으셨을까요?\n(…솔직한 게 좋아요!!!) 편하게 말씀해주시면 바로 도와드릴게요.\n\n📌 4일 연속 참여가 없으면 계정이 잠시 <쉬는 상태>가 되는데,\n벌이 아니라 그냥 숨 돌리는 공간이에요. 단톡방에 언급되지도 않고요.\n돌아오고 싶으실 때 저한테 톡 한 번만 주시면 바로 풀어드립니다!\n\n빠진 날도 나중에 채우시면 그대로 1일로 들어가요.\n부담 없이 답장 부탁드려요 🧡'],
  ['day 05', '(주말·토) 주말 리마인드', '양 톡방 · 토 14:00 · 매니저', '주말 잘 보내고 계신가요?~\n\n이번 주 5일 다 채우신 분들은 <진짜 외우기> 열려 있어요!\n틈날 때 봐주시면 체크 보드 오른쪽에 살짜쿵 표시된답니다 ✅\n\n아직 이번 주 인증 못 하신 날이 있다면 주말에 편하게 채워주세요 :)\n늦게 하셔도 그대로 1일로 들어가요~\n\n@all 다들 이번 주도 고생 많으셨습니다! 푹 쉬면서 에너지 채워봐요 🧡'],
  ['day 05', '(주말·일) 주간 마무리 리마인드', '양 톡방 · 일 19:00 · 매니저', '여러분 주말 잘 마무리하고 계신가요? :)\n\n아직 이번 주 <진짜 외우기> 안 풀어주신 분들은\n복습 차원에서 꼭 풀어봐주세요~ @all\n\n밀린 인증 채우기도 오늘까지가 딱 좋아요!\n내일부터 새로운 한 주, 가볍게 시작해봐요 😊\n\n보내주신 피드백 잘 보고 있습니다 :)\n적용할 수 있는 건 바로바로 반영할게요~'],

];

function fillOpsMessages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(MSG_SHEET);
  if (!sh) throw new Error("'" + MSG_SHEET + "' 시트를 못 찾았어요");

  const last = Math.max(sh.getLastRow(), 1);
  const titles = sh.getRange(1, 3, last, 1).getDisplayValues()
    .map(function (r) { return String(r[0] || '').trim(); });

  let added = 0, updated = 0;
  OPS_MSGS.forEach(function (m) {
    const idx = titles.indexOf(m[1]);
    if (idx >= 0) {
      sh.getRange(idx + 1, 4).setValue(m[3]);
      sh.getRange(idx + 1, 5).setValue(m[2]);
      updated++;
    } else {
      sh.appendRow(['Ongoing', m[0], m[1], m[3], m[2]]);
      added++;
    }
  });

  const n = sh.getLastRow();
  sh.getRange(1, 4, n, 1).setWrap(true).setVerticalAlignment('top');
  sh.getRange(1, 5, n, 1).setWrap(true).setVerticalAlignment('top');
  sh.setColumnWidth(4, 540);
  sh.setColumnWidth(5, 190);

  Logger.log('\uc6b4\uc601 \uba54\uc2dc\uc9c0 \uc2e0\uaddc ' + added + '\uac74 \u00b7 \uac31\uc2e0 ' + updated + '\uac74');
}

/* ============================================================
   일별 체크리스트 → 메시지 링크 자동 연결
   ------------------------------------------------------------
   할 일(F열) 문구를 보고 '주요 메시지' 시트의 해당 원고 행으로 링크를 겁니다.
   06:00 모닝 공지 / 18:00 한 스푼 더 는 '모닝공지' 탭의 그 Day 칸으로 갑니다.
   fillOpsMessages() 를 먼저 돌린 뒤 실행하세요.
   ============================================================ */

// [할 일에 들어 있는 말, '주요 메시지' 시트의 제목]
const LINK_MAP = [
  ['이전 기수 경험자',        '이전 기수 경험자 개인 과제 안내'],
  ['빈도 안내',               '빈도 안내 + 초급자 안심'],
  ['미팅 알림',               '당일 미팅 알림 + 참여자 조사'],
  ['미팅 전 할 일',           '미팅 전 할 일 리마인드'],
  ['녹화본',                  '미팅 녹화본 공지 (매주 금)'],
  ['주간 테스트 1',           '주간 테스트 오픈 안내'],
  ['첫 주 마무리',            '첫 주 마무리 격려'],
  ['2주차 오프닝',            '2주차 오프닝 + 모닝 밋업 안내'],
  ['약점 복습',               '★ 내 약점 복습 오픈 안내'],
  ['주말·토',                 '(주말·토) 주말 리마인드'],
  ['주말·일',                 '(주말·일) 주간 마무리 리마인드'],
  ['발표자',                  '발표자 모집 안내'],
  ['절반 지점',               '절반 지점 격려'],
  ['피드백 리포트',           '발표 피드백 리포트 발행 알림'],
  ['3주차 고비',              '★ 3주차 고비 정상화'],
  ['3주 완주',                '3주 완주 칭찬'],
  ['단어집 PDF',              '★ 단어집 PDF 예고'],
  ['수료 기준 재안내',        '수료 기준 재안내'],
  ['파이널 테스트 안내',      '파이널 테스트 안내'],
  ['파이널 미응시자',         '파이널 미응시자 리마인드'],
  ['인증 방법 안내',          '인증 방법 안내'],
  ['앱 사용 설명서',          '앱 사용 설명서 안내'],
  ['미인증 명단',             '아직 학습 안된 사람'],
  ['1:1 케어',                '임시 비활성화 사전안내'],
  ['턱걸이',                  '턱걸이 인원 개별 안내'],
  ['쉬는 상태',               '쉬는 상태 진입자 1:1']
];

function linkChecklistMessages() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const chk = ss.getSheetByName(CHECK_SHEET);
  const msg = ss.getSheetByName(MSG_SHEET);
  const mor = ss.getSheetByName(MORNING_SHEET);
  if (!chk) throw new Error("'" + CHECK_SHEET + "' 시트를 못 찾았어요");
  if (!msg) throw new Error("'" + MSG_SHEET + "' 시트를 못 찾았어요");

  const msgGid = msg.getSheetId();
  const morGid = mor ? mor.getSheetId() : null;

  // '주요 메시지' 제목(C열) → 행번호
  const mLast = Math.max(msg.getLastRow(), 1);
  const mTitles = msg.getRange(1, 3, mLast, 1).getDisplayValues();
  function findMsgRow(title) {
    for (let i = 0; i < mTitles.length; i++) {
      const t = String(mTitles[i][0] || '');
      if (t && (t === title || t.indexOf(title) >= 0)) return i + 1;
    }
    return 0;
  }

  // '모닝공지' Day → 행번호
  const morRow = {};
  if (mor) {
    const oLast = Math.max(mor.getLastRow(), 1);
    const oDays = mor.getRange(1, 1, oLast, 1).getDisplayValues();
    for (let i = 0; i < oDays.length; i++) {
      const m = String(oDays[i][0] || '').match(/Day\s*0?(\d+)/i);
      if (m) morRow[Number(m[1])] = i + 1;
    }
  }

  const first = 6;
  const last = chk.getLastRow();
  const days = chk.getRange(first, 1, last - first + 1, 1).getDisplayValues();
  const times = chk.getRange(first, 4, last - first + 1, 1).getDisplayValues();
  const tasks = chk.getRange(first, 6, last - first + 1, 1).getDisplayValues();

  let curDay = 0, done = 0;
  const miss = [];

  for (let i = 0; i < tasks.length; i++) {
    // Day 칸은 병합이라 맨 윗행에만 값이 있다. 값이 보이면 갱신하고, 아니면 직전 값을 이어 쓴다.
    const dm = String(days[i][0] || '').match(/Day\s*(\d+)/i);
    if (dm) curDay = Number(dm[1]);

    const task = String(tasks[i][0] || '');
    const time = String(times[i][0] || '');
    const row = first + i;
    if (!task) continue;

    let gid = null, cell = '', label = '';

    if (task.indexOf('모닝 공지') >= 0 && morGid && morRow[curDay]) {
      gid = morGid; cell = 'D' + morRow[curDay]; label = '📋 모닝 공지';
    } else if (task.indexOf('한 스푼 더') >= 0 && morGid && morRow[curDay]) {
      gid = morGid; cell = 'F' + morRow[curDay]; label = '🧡 한 스푼 더';
    } else {
      for (let k = 0; k < LINK_MAP.length; k++) {
        if (task.indexOf(LINK_MAP[k][0]) >= 0) {
          const r = findMsgRow(LINK_MAP[k][1]);
          if (r) { gid = msgGid; cell = 'D' + r; label = '📄 메시지 보기'; }
          break;
        }
      }
    }

    if (gid) {
      chk.getRange(row, 8).setFormula(
        '=HYPERLINK("#gid=' + gid + '&range=' + cell + '","' + label + '")'
      );
      done++;
    } else if (!/미팅 진행|가이드 투어|녹음 확인|집계 쿼리/.test(task)) {
      miss.push(row + '행 · ' + task);
      chk.getRange(row, 8).clearContent();
    }
  }

  Logger.log('링크 ' + done + '개 연결 완료');
  if (miss.length) Logger.log('원고 없음 (' + miss.length + '건)\n' + miss.join('\n'));
}

/* ============================================================
   2026-08-13 수정분
   ------------------------------------------------------------
   ⚠️ D(시각) E(담당) G(지침) H(메시지 링크) 는 6행에 걸린 배열 수식이다.
      중간 셀에 setValue 를 하면 수식 전체가 #REF! 로 깨진다.
      규칙을 바꾸려면 반드시 6행 수식을 다시 쓸 것.
   ============================================================ */

const TIME_FORMULA = '=MAP($F6:$F200,LAMBDA(t,IF(t="","",IFS(REGEXMATCH(t,"모닝 공지"),"06:00",REGEXMATCH(t,"인증률"),"07:00",REGEXMATCH(t,"한 스푼 더"),"19:00",REGEXMATCH(t,"녹음 확인"),"20:30",REGEXMATCH(t,"미인증 명단|미팅 진행"),"21:00",REGEXMATCH(t,"1:1 케어|쉬는 상태"),"21:30",REGEXMATCH(t,"녹화본"),"22:00",REGEXMATCH(t,"주말·토"),"토 14:00",REGEXMATCH(t,"주말·일"),"일 19:00",REGEXMATCH(t,"가이드 투어|집계 쿼리|피드백 리포트 작성"),"그날 중",TRUE,"08:00"))))';

// 시각(D열) 배열 수식 복구 + 아침 발송 규칙 반영
function fixChecklistTimes() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECK_SHEET);
  const last = Math.max(sh.getLastRow(), 7);
  sh.getRange(6, 4, last - 5, 1).clearContent();   // 깨진 값·#REF! 전부 비우고
  SpreadsheetApp.flush();
  sh.getRange('D6').setFormula(TIME_FORMULA);
  Logger.log('시각 수식 복구 완료');
}

// 미팅 하루 전 예고 행 추가 (Day 3 / 8 / 13 / 18 끝에)
function addMeetingPreviewRows() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECK_SHEET);
  const TASK = '다음날 미팅 예고 + 참여자 조사';
  const targets = [3, 8, 13, 18];

  // 이미 있으면 건너뛴다
  const last = sh.getLastRow();
  const all = sh.getRange(6, 6, last - 5, 1).getDisplayValues()
    .map(function (r) { return String(r[0] || ''); });
  if (all.some(function (t) { return t === TASK; })) {
    Logger.log('예고 행이 이미 있어요. 건너뜁니다.');
    return;
  }

  // Day 번호별 마지막 행을 먼저 구한다 (아래에서 위로 넣어야 행번호가 안 밀린다)
  const days = sh.getRange(6, 1, last - 5, 1).getDisplayValues();
  let cur = 0;
  const endRow = {};
  for (let i = 0; i < days.length; i++) {
    const m = String(days[i][0] || '').match(/Day\s*(\d+)/i);
    if (m) cur = Number(m[1]);
    if (cur) endRow[cur] = 6 + i;
  }

  targets.sort(function (a, b) { return b - a; }).forEach(function (d) {
    const r = endRow[d];
    if (!r) return;
    sh.insertRowAfter(r);
    sh.getRange(r + 1, 6).setValue(TASK);
  });

  fixChecklistTimes();
  Logger.log('예고 행 ' + targets.length + '개 추가 완료');
}

// 미팅 예고(D-1) 원고를 '주요 메시지' 에 추가
function addMeetingPreviewMessage() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MSG_SHEET);
  const last = Math.max(sh.getLastRow(), 1);
  const titles = sh.getRange(1, 3, last, 1).getDisplayValues()
    .map(function (r) { return String(r[0] || ''); });
  const TITLE = '미팅 예고 (하루 전) + 참여자 조사';
  const BODY = '오늘 밤이 아니라 하루 먼저 알려드릴게요 :)\n\n🗓 내일 밤 9:00~10:00 · Google Meet\nhttps://meet.google.com/sff-fgce-npj\n\n내일 미팅에서 뭘 하는지 미리 알려드리면\n마음의 준비를 하고 오실 수 있을 것 같아서요 ㅎㅎ\n\n부담 노노! 우리는 회사에서 더 잘하려고 모이는 거잖아요~\n회사에서 어떤 업무를 하고 계신지, 골은 뭔지 나누는 자리예요.\n\n미팅 전에 세 가지만 부탁드려요~ (앱 홈 <미팅 전 할 일>에서 확인 가능해요)\n· 사전 진단지 작성\n· Meeting 페이지 채우기\n· 이 방에 간단히 자기소개 남기기\n\n📌 인원 파악을 위해, 오실 수 있는 분은 미리 이모지 눌러주세요!\n못 오시는 분들껜 녹화본이 제공되니 편하게 봐주세요 :)';
  const WHO = '프리미엄 · 미팅 전날 아침 · 버디';

  const idx = titles.indexOf(TITLE);
  if (idx >= 0) {
    sh.getRange(idx + 1, 4).setValue(BODY);
    sh.getRange(idx + 1, 5).setValue(WHO);
  } else {
    sh.appendRow(['Ongoing', 'day 03', TITLE, BODY, WHO]);
  }
  const n = sh.getLastRow();
  sh.getRange(1, 4, n, 1).setWrap(true).setVerticalAlignment('top');
  Logger.log('미팅 예고 원고 반영 완료');
}

/* ============================================================
   Day 6 · '내 약점 복습' 오픈 안내 + '진짜 외우기' 원고 교정
   (2026-08-13 추가)
   ------------------------------------------------------------
   · 약점 복습은 앱에서 Day 6 에 자동 해제되는데 톡 안내가 없어 놓치는 사람이 많다.
   · 주간 테스트의 앱 정식 명칭은 '진짜 외우기' 이고, 3단계는
     익히기/떠올리기/섞어보기 가 아니라
     떠올려보기 → '기억 안나요' 체크 → 체크한 것만 복습 이다.
   ============================================================ */

function addWeaknessReviewRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CHECK_SHEET);
  const TASK = '★ 내 약점 복습 오픈 안내 (Week 2 신기능)';

  const last = sh.getLastRow();
  const tasks = sh.getRange(6, 6, last - 5, 1).getDisplayValues()
    .map(function (r) { return String(r[0] || ''); });

  if (tasks.indexOf(TASK) >= 0) {
    Logger.log('체크리스트 항목은 이미 있어요.');
  } else {
    // Day 6 의 마지막 행. Day 칸은 병합이라 값이 보이는 행에서만 갱신된다.
    const days = sh.getRange(6, 1, last - 5, 1).getDisplayValues();
    let cur = 0, endRow = 0;
    for (let i = 0; i < days.length; i++) {
      const m = String(days[i][0] || '').match(/Day\s*(\d+)/i);
      if (m) cur = Number(m[1]);
      if (cur === 6) endRow = 6 + i;
    }
    if (!endRow) throw new Error('Day 6 을 못 찾았어요');
    sh.insertRowAfter(endRow);
    sh.getRange(endRow + 1, 6).setValue(TASK);
    fixChecklistTimes();
  }

  // 원고 3건 (약점 복습 2건 + 진짜 외우기 교정본)
  const msg = ss.getSheetByName(MSG_SHEET);
  const rows = [
    ['day 06', '★ 내 약점 복습 오픈 안내', '양 톡방 · Day 6 아침 · 버디', '2주차 첫날, 새 기능이 하나 열렸어요! 🔓\n\n<내 약점 복습>이 생겼습니다.\n앱 홈에서 ✍️ 내 약점 복습 버튼을 눌러보세요.\n\n지금까지 단어시험에서 틀렸던 단어, 힌트 봤던 단어를\n앱이 알아서 다 모아뒀어요.\n\n📊 내 숙련도 게이지 + 약점 막대그래프\n   지금 내 실력이 어디쯤인지 한눈에 보여요\n🎯 약한 단어만 골라서 다시 시험\n   전체 다시 볼 필요 없이, 안 외워진 것만 콕 집어서요\n\n일주일 지나면 "내가 뭘 모르는지"가 제일 먼저 흐려지잖아요.\n그걸 앱이 대신 기억해뒀다가 알려주는 거라 복습이 훨씬 빨라집니다 :)\n\n오늘 딱 3분만 들어가보세요~'],
    ['day 06', '내 약점 복습 · 프리미엄 추가 안내', '프리미엄 · Day 6 아침 · 버디', '프리미엄 여러분께는 하나 더 있어요 👑\n\n<내 약점 복습>에 들어가시면\n직접 쓰신 문장으로 만든 빈칸 테스트가 같이 나옵니다.\n\n남이 만든 예문이 아니라 내가 쓴 문장이라\n"이 표현을 내 상황에서 쓸 수 있나"를 바로 확인하실 수 있어요.\n\n목요일 미팅 전에 한 번 돌려보시면\n발표할 때 문장이 훨씬 잘 나옵니다 :)'],
    ['day 05', '주간 테스트 오픈 안내', '양 톡방 · Day 5/10/15 아침 · 버디', '이번 주 5일을 다 채우신 분들은 <진짜 외우기>가 열렸어요! 🎁\n\n앱 [내 학습]에서 이번 주 카드를 눌러보시면 보입니다.\n3단계인데, 10분이면 끝나요.\n\n1️⃣ 한국어 문장만 보고 영어로 떠올려보기\n   바로 탭하지 마시고 머릿속으로 먼저요! 그다음 탭해서 정답과 비교\n2️⃣ 안 떠올랐으면 <기억 안나요> 체크\n   부끄러운 게 아니라 이게 핵심이에요. 체크한 단어만 복습 큐에 담겨요\n3️⃣ 체크한 단어로 복습 시작\n   내가 못 외운 것만 골라서 빠르게 한 바퀴, 끝나면 주간 테스트로 마무리\n\n통과하시면 <잠금화면 단어장>을 드려요.\n휴대폰 잠금화면에 이번 주 표현을 걸어두시면\n하루에 몇 번씩 저절로 복습됩니다 :)\n\n아직 5일을 못 채우셨어도 괜찮아요!\n빠진 날을 채우시면 그때 바로 열립니다~']
  ];
  const mLast = Math.max(msg.getLastRow(), 1);
  const titles = msg.getRange(1, 3, mLast, 1).getDisplayValues()
    .map(function (r) { return String(r[0] || ''); });
  rows.forEach(function (r) {
    const idx = titles.indexOf(r[1]);
    if (idx >= 0) {
      msg.getRange(idx + 1, 4).setValue(r[3]);
      msg.getRange(idx + 1, 5).setValue(r[2]);
    } else {
      msg.appendRow(['Ongoing', r[0], r[1], r[3], r[2]]);
    }
  });
  const n = msg.getLastRow();
  msg.getRange(1, 4, n, 1).setWrap(true).setVerticalAlignment('top');

  Logger.log('약점 복습 안내 + 진짜 외우기 교정 반영 완료');
}

/* ============================================================
   시간순 정렬 (2026-08-13)
   ------------------------------------------------------------
   ⚠️ D(시각) E(담당) G(지침) H(메시지 링크) 는 F(할 일) 을 읽는 배열 수식이다.
      그래서 F 와 I(✅ 체크) 만 순서를 바꾸면 나머지는 알아서 따라온다.
      K(메모/로그) 는 Day 단위 병합이라 건드리지 않는다.

   유버디가 보내는 안내는 하루 두 번, 08:00 과 19:00 뿐이다.
     06:00 모닝 공지 (매니저)
     07:00 어제 인증률 (자동)
     08:00 유버디 아침 안내  ← 주간 테스트·약점 복습·미팅 예고 등 전부 여기
     19:00 유버디 저녁 (한 스푼 더)
     20:30 녹음 확인 마감
     21:00 미인증 명단 리마인드 · 미팅 진행
     21:30 1:1 케어 톡
     22:00 미팅 녹화본 링크 입력
   ============================================================ */

function sortChecklistByTime() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECK_SHEET);
  const first = 6;
  const last = sh.getLastRow();
  const n = last - first + 1;

  const days = sh.getRange(first, 1, n, 1).getDisplayValues();
  const times = sh.getRange(first, 4, n, 1).getDisplayValues();
  const tasks = sh.getRange(first, 6, n, 1).getValues();
  const checks = sh.getRange(first, 9, n, 1).getValues();

  // Day 블록 경계 찾기 (Day 칸은 병합이라 첫 행에만 값이 있다)
  const starts = [];
  for (let i = 0; i < n; i++) {
    if (/Day\s*\d+/i.test(String(days[i][0] || ''))) starts.push(i);
  }
  if (!starts.length) throw new Error('Day 블록을 못 찾았어요');
  starts.push(n);

  const rank = function (t) {
    const v = String(t || '').trim();
    if (!v || v === '그날 중') return '99:99';
    return v.replace('~', '');
  };

  let moved = 0;
  for (let b = 0; b < starts.length - 1; b++) {
    const from = starts[b], to = starts[b + 1];
    const rows = [];
    for (let i = from; i < to; i++) {
      if (!String(tasks[i][0] || '').trim()) continue;
      rows.push({ t: rank(times[i][0]), f: tasks[i][0], c: checks[i][0], ord: i });
    }
    if (rows.length < 2) continue;

    const before = rows.map(function (r) { return r.ord; }).join(',');
    // 같은 시각이면 원래 순서 유지 (안정 정렬)
    rows.sort(function (a, b2) { return a.t === b2.t ? a.ord - b2.ord : (a.t < b2.t ? -1 : 1); });
    if (rows.map(function (r) { return r.ord; }).join(',') === before) continue;

    const outF = [], outC = [];
    for (let k = 0; k < to - from; k++) {
      outF.push([rows[k] ? rows[k].f : '']);
      outC.push([rows[k] ? rows[k].c : '']);
    }
    sh.getRange(first + from, 6, to - from, 1).setValues(outF);
    sh.getRange(first + from, 9, to - from, 1).setValues(outC);
    moved++;
  }

  SpreadsheetApp.flush();
  Logger.log('시간순 정렬 완료 · Day ' + moved + '개 블록 재배치');
}

// 시각 수식 갱신 → 시간순 정렬 → 색 다시 칠하기. 이거 하나만 돌리면 됩니다.
function refreshChecklist() {
  fixChecklistTimes();
  fixChecklistOwners();
  SpreadsheetApp.flush();
  sortChecklistByTime();
  try { paintChecklist(); } catch (e) {}
  Logger.log('체크리스트 정리 완료');
}

/* ============================================================
   담당(E열) 배열 수식 복구 (2026-08-13)
   ------------------------------------------------------------
   E6 한 칸에 걸린 MAP 수식이 E열 전체를 만든다.
   중간 셀에 값을 쓰면 통째로 #REF! 가 되니 절대 직접 입력하지 말 것.
   ============================================================ */

const OWNER_FORMULA = '=MAP($F6:$F200,LAMBDA(t,IF(t="","",IF(REGEXMATCH(t,"모닝 공지|인증률|녹음 확인|미인증 명단|1:1|미완료자 리마인드|미팅 전 할 일|발표자|미응시자|턱걸이|쉬는 상태|주말"),"매니저","버디"))))';

function fixChecklistOwners() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECK_SHEET);
  const last = Math.max(sh.getLastRow(), 7);
  sh.getRange(6, 5, last - 5, 1).clearContent();
  SpreadsheetApp.flush();
  sh.getRange('E6').setFormula(OWNER_FORMULA);
  Logger.log('담당 수식 복구 완료');
}

/* ============================================================
   금요일 녹화본 공지 행 (2026-08-14 버디 확정)
   ------------------------------------------------------------
   미팅은 목요일 밤이라 녹화본은 금요일 아침에 나온다.
   Day 5 / 10 / 15 / 20 (매주 금) 에 공지 행을 넣는다.
   실행 후 refreshChecklist() 가 자동으로 시각·담당·정렬을 잡는다.
   ============================================================ */

function addRecordingNoticeRows() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECK_SHEET);
  const TASK = '미팅 녹화본 공지 · 드라이브 링크 넣어서 (프리미엄)';
  const targets = [5, 10, 15, 20];

  const last = sh.getLastRow();
  const tasks = sh.getRange(6, 6, last - 5, 1).getDisplayValues()
    .map(function (r) { return String(r[0] || ''); });
  if (tasks.indexOf(TASK) >= 0) { Logger.log('이미 있어요.'); return; }

  const days = sh.getRange(6, 1, last - 5, 1).getDisplayValues();
  let cur = 0;
  const endRow = {};
  for (let i = 0; i < days.length; i++) {
    const m2 = String(days[i][0] || '').match(/Day\s*(\d+)/i);
    if (m2) cur = Number(m2[1]);
    if (cur) endRow[cur] = 6 + i;
  }

  targets.sort(function (a, b) { return b - a; }).forEach(function (d) {
    const r = endRow[d];
    if (!r) return;
    sh.insertRowAfter(r);
    sh.getRange(r + 1, 6).setValue(TASK);
  });

  refreshChecklist();
  Logger.log('녹화본 공지 행 4개 추가 완료');
}

/* ============================================================
   월요일 주간 회고 (구 슬랙 월요 카드 대체 · 2026-08-14)
   ------------------------------------------------------------
   슬랙 자동 발송 4건을 끄면서, 시트에 없던 것은 이것 하나였다:
   "지난주 인증 요약 + 개근 명단 + 월요일 카톡 복붙 메시지".
   매주 월요일 07:00 에 '인증률' 시트 끝에 주간 회고 블록을 쓴다.
   setupWeeklyTrigger() 를 한 번 실행하면 트리거가 걸린다.
   ============================================================ */

function writeWeeklyRecap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("'" + SHEET_NAME + "' 시트를 못 찾았어요");

  // 지난주 (월~금) 의 Day 번호 범위 계산
  const dates = dayDates_();
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // 이번 주 월요일
  const lastMon = new Date(monday); lastMon.setDate(monday.getDate() - 7);
  const lastFri = new Date(monday); lastFri.setDate(monday.getDate() - 3);
  const inLastWeek = [];
  for (let d = 1; d <= dates.length; d++) {
    const dt = new Date(dates[d - 1] + 'T00:00:00');
    if (dt >= lastMon && dt <= lastFri) inLastWeek.push(d);
  }
  if (!inLastWeek.length) { Logger.log('지난주에 해당하는 Day 가 없어요 (기수 시작 전이거나 종료 후)'); return; }
  const wkN = Math.ceil(inLastWeek[0] / 5);

  const rows = fetchSummaries_().filter(function (r) { return STAFF.indexOf(r.member_name) < 0; });
  const stat = { basic: { n: 0, sum: 0 }, premium: { n: 0, sum: 0 } };
  const perfect = [];
  rows.forEach(function (r) {
    const days = (r.verified_days || []);
    const hit = inLastWeek.filter(function (d) { return days.indexOf(d) >= 0; }).length;
    const t = (r.tier === 'premium') ? 'premium' : 'basic';
    stat[t].n++; stat[t].sum += hit;
    if (hit === inLastWeek.length) perfect.push(r.english_name || r.member_name);
  });
  const pct = function (o) { return o.n ? Math.round(o.sum / (o.n * inLastWeek.length) * 100) : 0; };

  const msg = 'Week ' + wkN + ' 마무리 회고예요 :)\n\n'
    + '지난주 우리 인증률\n'
    + '· 베이직 ' + pct(stat.basic) + '%  · 프리미엄 ' + pct(stat.premium) + '%\n\n'
    + (perfect.length
        ? '🏅 지난주 개근 (' + perfect.length + '분)\n' + perfect.join(' · ') + '\n짝짝짝 👏 이 흐름 그대로 가봐요!\n\n'
        : '')
    + '이번 주도 하루 10분씩, 가볍게 시작해요.\n'
    + '빠진 날이 있어도 채우면 그대로 1일이에요 🧡';

  const r0 = sh.getLastRow() + 2;
  sh.getRange(r0, 1).setValue('📅 Week ' + wkN + ' 회고 (' + ymd_(lastMon) + '~' + ymd_(lastFri) + ')');
  sh.getRange(r0, 1).setFontWeight('bold');
  sh.getRange(r0 + 1, 1).setValue(msg);
  sh.getRange(r0 + 1, 1, 1, 1).setWrap(true);
  Logger.log('주간 회고 기록 완료 · Week ' + wkN);
}

function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'writeWeeklyRecap') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('writeWeeklyRecap').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  Logger.log('월요일 07시 주간 회고 트리거 설정 완료');
}

/* ============================================================
   주말 행 추가 (2026-08-14 · 7기 톡 패턴에서 복원)
   ------------------------------------------------------------
   7기에서 토(14시쯤)·일(저녁)에 실제로 보내던 주말 리마인드가
   체크리스트에 빠져 있었다. Day 5/10/15 블록 끝에 넣는다.
   (Day 20 주말은 수료식이 따로 있어 제외)
   ============================================================ */

function addWeekendRows() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECK_SHEET);
  const T1 = '(주말·토) 주간 테스트 + 밀린 인증 리마인드 발송';
  const T2 = '(주말·일) 주간 마무리 리마인드 + 늦참 녹음 체크';
  const targets = [5, 10, 15];

  const last = sh.getLastRow();
  const tasks = sh.getRange(6, 6, last - 5, 1).getDisplayValues()
    .map(function (r) { return String(r[0] || ''); });
  if (tasks.indexOf(T1) >= 0) { Logger.log('이미 있어요.'); return; }

  const days = sh.getRange(6, 1, last - 5, 1).getDisplayValues();
  let cur = 0;
  const endRow = {};
  for (let i = 0; i < days.length; i++) {
    const m2 = String(days[i][0] || '').match(/Day\s*(\d+)/i);
    if (m2) cur = Number(m2[1]);
    if (cur) endRow[cur] = 6 + i;
  }

  targets.sort(function (a, b) { return b - a; }).forEach(function (d) {
    const r = endRow[d];
    if (!r) return;
    sh.insertRowsAfter(r, 2);
    sh.getRange(r + 1, 6).setValue(T1);
    sh.getRange(r + 2, 6).setValue(T2);
  });

  refreshChecklist();
  Logger.log('주말 행 6개 추가 완료 (Day 5/10/15 × 토·일)');
}
