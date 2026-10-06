# 나만의 약점 복습 노트 · 9기 (브라운 팔레트)
import json, html, base64, io, qrcode, sys
from weasyprint import HTML
e = lambda t: html.escape(str(t or ''))

state = json.load(open(sys.argv[1]))
name  = sys.argv[2] if len(sys.argv) > 2 else (state.get('englishName') or state.get('name') or '')
D = json.load(open('/tmp/9gi_full.json'))

BY = {}
for w in D['weeks']:
    for day in w['days']:
        for x in day['words']:
            BY[x['en'].lower()] = dict(x, day=day['day'], weekN=w['n'], dayTitle=day['title'])

vs = state.get('vocab_stats') or {}
rows = []
for k, v in vs.items():
    w_, s_, h_, c_ = (v.get('w') or 0), (v.get('s') or 0), (v.get('h') or 0), (v.get('c') or 0)
    sc = w_*3 + s_*2 + h_
    if sc <= 0: continue
    info = BY.get(k.lower())
    if not info: continue
    rows.append((sc, w_, s_, h_, c_, info))
BRN, BRN_D, INK, SOFT, MUT, LINE, PAPER = '#9C6B3F', '#6E4A28', '#2A1F14', '#5B4A32', '#8A7A5C', '#E7DDC8', '#FBF6EC'
rows.sort(key=lambda r: (-r[0], r[5]['day']))
TOP = rows[:12]

# ── 개인 통계 ─────────────────────────────────────────────
ver = {k: v for k, v in (state.get('verified') or {}).items() if v}
vtime = state.get('verified_time') or {}
qres = state.get('quiz_results') or {}
boss = state.get('bingo_boss_results') or {}
sents = [v for v in (state.get('sentences') or {}).values() if str(v or '').strip()]
rc = state.get('review_counts') or {}

days_done = len(ver)
total_try = sum((v.get('c') or 0) + (v.get('w') or 0) + (v.get('s') or 0) for v in vs.values())
total_right = sum((v.get('c') or 0) for v in vs.values())
acc = round(total_right / total_try * 100) if total_try else 0
mastered = len([1 for k, v in vs.items() if (v.get('c') or 0) >= 1 and (v.get('w') or 0) + (v.get('s') or 0) + (v.get('h') or 0) == 0])
weak_n = len(rows)
review_n = sum(int(x or 0) for x in rc.values())
ai_n = len(state.get('ai_history') or [])

# 인증 시각대 분포
def hhmm_h(t):
    try: return int(str(t).split(':')[0])
    except Exception: return None
buckets = [('새벽 5~8시', 5, 8), ('오전 8~12시', 8, 12), ('낮 12~18시', 12, 18), ('저녁 18~22시', 18, 22), ('밤 22시~', 22, 29)]
bhit = {b[0]: 0 for b in buckets}
for k in ver:
    h = hhmm_h(vtime.get(k))
    if h is None: continue
    hh = h if h >= 5 else h + 24
    for nm_, a, b2 in buckets:
        if a <= hh < b2: bhit[nm_] += 1; break
peak = max(bhit.items(), key=lambda x: x[1])[0] if any(bhit.values()) else ''

# 주차별 정답률 (일일 단어시험 기준)
wk_acc = []
for wn in (1, 2, 3, 4):
    sc = tt = 0
    for dn in range((wn - 1) * 5 + 1, wn * 5 + 1):
        q = qres.get('d%d' % dn)
        if q: sc += (q.get('score') or 0); tt += (q.get('total') or 0)
    wk_acc.append((wn, round(sc / tt * 100) if tt else None, tt))

def bar(pct, color, h='4mm'):
    p = max(0, min(100, pct or 0))
    return (f'<span style="display:inline-block;width:58mm;height:{h};background:#EFE7DA;border-radius:2mm;'
            f'vertical-align:middle;position:relative;overflow:hidden;">'
            f'<span style="position:absolute;left:0;top:0;bottom:0;width:{p}%;background:{color};"></span></span>')

# 내가 쓴 문장 (제출본 우선, 없으면 작성 중인 것)
RAW_SENT = state.get('sentences') or {}
RAW_SUB  = state.get('submitted_text') or {}
def my_sentences_for(day, idx):
    k = 'd%d-%d' % (day, idx)
    t = str(RAW_SUB.get(k) or RAW_SENT.get(k) or '').strip()
    return t
def my_sentence_any(en, day):
    d_ = next((dd for w in D['weeks'] for dd in w['days'] if dd['day'] == day), None)
    if not d_: return ''
    for i_, x_ in enumerate(d_['words']):
        if x_['en'].lower() == en.lower():
            return my_sentences_for(day, i_)
    return ''

# 전체 내 문장집 (Day 순)
ALL_MINE = []
for w in D['weeks']:
    for day in w['days']:
        for i_, x_ in enumerate(day['words']):
            t = my_sentences_for(day['day'], i_)
            if t: ALL_MINE.append((day['day'], day['title'], x_['en'], t))

# 랜덤 퀴즈: 약한 순서대로, 문항 유형을 번갈아
import random as _rnd
QZ = []
_r = _rnd.Random(sum(ord(c) for c in str(name)) + len(rows))
MODES = ['ko', 'en', 'blank']
for i_, (sc, w_, s_, h_, c_, x) in enumerate(rows[:20]):
    mode = MODES[i_ % 3]
    mine = my_sentence_any(x['en'], x['day'])
    QZ.append({'mode': mode, 'x': x, 'mine': mine, 'rank': i_ + 1})
_r.shuffle(MODES)

stat_cards = "".join([
  f'<div class="stat"><div class="s-n">{days_done}</div><div class="s-l">일 인증</div></div>',
  f'<div class="stat"><div class="s-n">{len(sents)}</div><div class="s-l">문장 작성</div></div>',
  f'<div class="stat"><div class="s-n">{acc}<span class="s-u">%</span></div><div class="s-l">평균 정답률</div></div>',
  f'<div class="stat"><div class="s-n">{mastered}</div><div class="s-l">한 번에 맞힌 표현</div></div>',
])

wk_rows = ""
for wn, pct, tt in wk_acc:
    if pct is None:
        wk_rows += f'<div class="wk"><span class="wk-l">Week {wn}</span>{bar(0, "#DCD2C2")}<span class="wk-v">기록 없음</span></div>'
    else:
        col = BRN_D if pct >= 90 else (BRN if pct >= 75 else '#C2894F')
        wk_rows += f'<div class="wk"><span class="wk-l">Week {wn}</span>{bar(pct, col)}<span class="wk-v">{pct}%</span></div>'

tm_rows = ""
for nm_, _, _ in buckets:
    n_ = bhit[nm_]
    if not n_: continue
    pct = round(n_ / max(1, days_done) * 100)
    col = BRN if nm_ == peak else '#D8C4A8'
    tm_rows += f'<div class="wk"><span class="wk-l" style="flex:0 0 26mm;">{nm_}</span>{bar(pct, col, "3.4mm")}<span class="wk-v">{n_}일</span></div>'

donut_w = round(mastered / max(1, len(vs)) * 100)


qr = qrcode.make('https://youbuddy.co.kr/9th/#my-review', box_size=9, border=1)
b = io.BytesIO(); qr.save(b, format='PNG'); QR = base64.b64encode(b.getvalue()).decode()

def reason(w_, s_, h_):
    p = []
    if w_: p.append(f'틀림 {w_}회')
    if s_: p.append(f'건너뜀 {s_}회')
    if h_: p.append(f'힌트 {h_}회')
    return ' / '.join(p)

CSS = f"""
@page {{ size: A4; margin: 15mm 14mm 13mm;
  @bottom-center {{ content: counter(page); font-family:'Noto Sans CJK KR'; font-size:7.5pt; color:{MUT}; }} }}
@page cover {{ margin:0; background:{BRN_D}; @bottom-center {{ content:''; }} }}
* {{ box-sizing:border-box; }}
body {{ font-family:'Noto Sans CJK KR',sans-serif; color:{INK}; font-size:9pt; line-height:1.55; margin:0; }}
.cover {{ page:cover; height:297mm; padding:48mm 24mm; color:#fff; position:relative; }}
.cv-k {{ font-size:9pt; letter-spacing:.32em; color:#E4C08A; font-weight:700; }}
.cv-t {{ margin-top:14mm; font-size:40pt; font-weight:900; line-height:1.1; letter-spacing:-.03em; }}
.cv-n {{ margin-top:9mm; font-size:15pt; color:#E4C08A; font-weight:800; }}
.cv-s {{ margin-top:3mm; font-size:10.5pt; color:#D9C7AE; }}
.cv-box {{ margin-top:16mm; border:.6pt solid rgba(228,192,138,.45); border-radius:3mm; padding:6mm 7mm; }}
.cv-box h3 {{ margin:0 0 3mm; font-size:10pt; color:#E4C08A; font-weight:800; }}
.cv-box p {{ margin:1.6mm 0; font-size:9pt; color:#E8DCCB; line-height:1.75; }}
.cv-f {{ position:absolute; left:24mm; bottom:24mm; font-size:8pt; color:#A8927A; letter-spacing:.1em; }}
.sec {{ page-break-before:always; }}
.sec-h {{ border-bottom:1.4pt solid {INK}; padding-bottom:2mm; margin-bottom:4mm; display:flex; align-items:flex-end; justify-content:space-between; gap:5mm; }}
.sec-h .no {{ font-size:7.2pt; letter-spacing:.2em; color:{BRN}; font-weight:800; }}
.sec-h .ti {{ margin-top:1.4mm; font-size:14pt; white-space:nowrap; font-weight:800; letter-spacing:-.02em; }}
.sec-h .sub {{ margin-top:1mm; font-size:7.8pt; color:{MUT}; }}
.card {{ page-break-inside:avoid; margin-bottom:3mm; border:.5pt solid rgba(156,107,63,.3); border-left:2.6pt solid {BRN};
  border-radius:2mm; padding:3mm 3.6mm; background:#fff; }}
.c-h {{ display:flex; align-items:baseline; gap:2mm; }}
.c-n {{ display:inline-block; min-width:5mm; height:5mm; border-radius:50%; background:{BRN_D}; color:#fff;
  font-size:6.6pt; font-weight:800; text-align:center; line-height:5mm; }}
.c-en {{ font-size:12pt; font-weight:800; letter-spacing:-.015em; }}
.c-pr {{ font-size:7.2pt; color:{MUT}; }}
.c-tag {{ margin-left:auto; font-size:6.8pt; font-weight:800; color:#A6482A; background:#FBEDE7; border-radius:4pt; padding:.5mm 2mm; }}
.c-def {{ margin-top:1.4mm; font-size:9pt; font-weight:700; color:{BRN_D}; }}
.c-fill {{ margin-top:2mm; font-size:7.4pt; color:{MUT}; }}
.c-fill .ln {{ display:inline-block; width:62%; border-bottom:.6pt dotted #C8B49A; height:3.4mm; }}
.lab {{ font-size:6.2pt; letter-spacing:.15em; font-weight:800; color:{BRN}; }}
.blk {{ margin-top:1.8mm; }}
.ex-en {{ margin-top:.5mm; font-size:8.6pt; font-style:italic; }}
.ex-kr {{ margin-top:.3mm; font-size:7.6pt; color:{MUT}; }}
.nu {{ margin-top:.5mm; font-size:7.5pt; color:{SOFT}; line-height:1.55; background:{PAPER};
  border-left:2pt solid rgba(156,107,63,.35); border-radius:0 1.4mm 1.4mm 0; padding:1.6mm 2.4mm; }}
.stats {{ display:flex; gap:3mm; margin-bottom:5mm; }}
.stat {{ flex:1; border:.6pt solid {LINE}; border-radius:2.5mm; padding:3.5mm 2mm; text-align:center; background:#fff; }}
.s-n {{ font-size:19pt; font-weight:900; color:{BRN_D}; line-height:1.1; letter-spacing:-.03em; }}
.s-u {{ font-size:11pt; }}
.s-l {{ margin-top:1.2mm; font-size:7pt; color:{MUT}; font-weight:700; }}
.gsec {{ margin-bottom:5mm; }}
.gsec h4 {{ margin:0 0 2.5mm; font-size:8.6pt; font-weight:800; color:{INK}; }}
.wk {{ display:flex; align-items:center; gap:2.5mm; margin-bottom:1.6mm; }}
.wk-l {{ flex:0 0 16mm; font-size:7.6pt; font-weight:700; color:{SOFT}; }}
.wk-v {{ flex:0 0 16mm; font-size:7.6pt; font-weight:800; color:{BRN_D}; text-align:right; }}
.insight {{ margin-top:1mm; padding:3mm 3.6mm; background:{PAPER}; border-left:2.4pt solid {BRN}; border-radius:0 1.6mm 1.6mm 0;
  font-size:8pt; color:{SOFT}; line-height:1.7; }}
.insight b {{ color:{BRN_D}; }}
.qz {{ page-break-inside:avoid; margin-bottom:2.6mm; border:.5pt solid {LINE}; border-radius:2mm; padding:2.6mm 3.2mm; background:#fff; }}
.qz-h {{ display:flex; align-items:baseline; gap:2mm; font-size:6.6pt; font-weight:800; letter-spacing:.12em; color:{BRN}; }}
.qz-r {{ margin-left:auto; color:{MUT}; font-weight:700; letter-spacing:0; }}
.qz-q {{ margin-top:1.4mm; font-size:10.5pt; font-weight:800; color:{INK}; }}
.qz-s {{ margin-top:1mm; font-size:8.4pt; color:{SOFT}; font-style:italic; }}
.qz-a {{ margin-top:2mm; font-size:7.4pt; color:{MUT}; }}
.qz-a .ln {{ display:inline-block; width:66%; border-bottom:.6pt dotted #C8B49A; height:3.6mm; }}
.ans {{ column-count:3; column-gap:5mm; font-size:7pt; color:{MUT}; line-height:1.6; }}
.ans b {{ color:{BRN_D}; }}
.ms {{ page-break-inside:avoid; margin-bottom:2mm; padding-bottom:1.6mm; border-bottom:.3pt solid rgba(156,107,63,.16); }}
.ms-h {{ font-size:6.6pt; font-weight:800; color:{BRN}; letter-spacing:.1em; }}
.ms-t {{ margin-top:.6mm; font-size:8.6pt; color:{INK}; line-height:1.5; }}
.ms-d {{ font-size:6.4pt; color:{MUT}; font-weight:700; }}
.mine-cols {{ column-count:2; column-gap:7mm; }}
.how li {{ margin-bottom:2.6mm; font-size:9.2pt; line-height:1.7; }}
.how b {{ color:{BRN_D}; }}
.mine {{ margin-top:1.8mm; font-size:8pt; color:{SOFT}; background:rgba(156,107,63,.07); border-radius:1.6mm; padding:2mm 2.6mm; }}
.mine b {{ color:{BRN}; font-size:6.2pt; letter-spacing:.13em; margin-right:1.6mm; }}
"""

cards = ''
for i, (sc, w_, s_, h_, c_, x) in enumerate(TOP, 1):
    _mine = my_sentence_any(x['en'], x['day'])
    mine_html = (f'<div class="mine"><b>내가 쓴 문장</b>{e(_mine)}</div>' if _mine else '')
    cards += f"""<div class="card">
      <div class="c-h"><span class="c-n">{i}</span><span class="c-en">{e(x['en'])}</span>
        <span class="c-pr">{e(x.get('pron',''))}</span><span class="c-tag">{e(reason(w_,s_,h_))}</span></div>
      <div class="c-def">{e(x['def'])}</div>
      <div class="c-fill">뜻을 기억나는 대로 써보세요 <span class="ln"></span></div>
      <div class="blk"><span class="lab">EXAMPLE</span>
        <div class="ex-en">{e(x['ex_en'])}</div><div class="ex-kr">{e(x['ex_kr'])}</div></div>
      <div class="blk"><span class="lab">이럴 때 써요</span><div class="nu">{e(x.get('nuance',''))}</div></div>
      {mine_html}
    </div>"""

P = []
P.append(f"""<div class="cover">
  <div class="cv-k">YOUBUDDY BUSINESS ENGLISH</div>
  <div class="cv-t">나만의<br/>약점 복습 노트</div>
  <div class="cv-n">{e(name)} 님</div>
  <div class="cv-s">유버디 비즈니스 영어 챌린지 9기 / 20일 학습 기록 기반</div>
  <div class="cv-box">
    <h3>이 노트는 이렇게 만들었어요</h3>
    <p>/ 20일 동안 {e(name)} 님이 실제로 푼 기록만 봤어요.</p>
    <p>/ 틀린 것, 건너뛴 것, 힌트를 본 것에 가중치를 줘서 순서를 매겼어요.</p>
    <p>/ 흔들린 표현 {len(rows)}개 중 가장 자주 걸린 {len(TOP)}개만 담았습니다.</p>
    <p>/ 잘 맞힌 표현은 일부러 뺐어요. 이미 {e(name)} 님 것이니까요.</p>
  </div>
  <div class="cv-f">세상에 하나뿐인 PDF / 이 조합은 {e(name)} 님에게만 나옵니다</div>
</div>""")
P.append(f"""<div class="sec"><div class="sec-h"><div>
  <div class="no">SECTION 1</div><div class="ti">{e(name)} 님의 20일, 숫자로</div>
  <div class="sub">앱에 남은 실제 기록이에요</div></div></div>
  <div class="stats">{stat_cards}</div>
  <div class="gsec"><h4>주차별 정답률</h4>{wk_rows}</div>
  <div class="gsec"><h4>주로 인증한 시간대</h4>{tm_rows}</div>
  <div class="insight">
    전체 {len(vs)}개 표현 중 <b>{mastered}개</b>는 한 번도 안 틀리고 바로 맞히셨어요 ({donut_w}%).<br/>
    반대로 <b>{weak_n}개</b>는 한 번이라도 흔들렸고, 그중 자주 걸린 {len(TOP)}개를 다음 장에 담았습니다.<br/>
    복습 테스트는 <b>{review_n}번</b>, AI 첨삭은 <b>{ai_n}번</b> 쓰셨어요.{(' 인증은 주로 <b>' + peak + '</b>에 하셨네요.') if peak else ''}
  </div>
</div>""")
P.append(f"""<div class="sec"><div class="sec-h">
  <div><div class="no">SECTION 2</div><div class="ti">가장 자주 흔들린 표현 {len(TOP)}</div>
  <div class="sub">위에서부터 더 자주 걸린 순서예요</div></div>
  <div style="text-align:center;flex-shrink:0;">
    <img src="data:image/png;base64,{QR}" style="width:17mm;height:17mm;"/>
    <div style="font-size:5.8pt;color:{MUT};font-weight:700;margin-top:.6mm;line-height:1.3;">QR 찍으면 앱에서<br/>약점 단어 테스트</div>
  </div>
</div>{cards}</div>""")
# ── SECTION 3 · 랜덤 퀴즈 ──────────────────────────────────
qz_html = ""
ans_list = []
for i_, q in enumerate(QZ, 1):
    x = q['x']; mode = q['mode']
    if mode == 'ko':
        head, qline, sub = '뜻 보고 영어로', e(x['def']), (f'<div class="qz-s">{e(x["ex_kr"])}</div>' if x.get('ex_kr') else '')
        ans_list.append(f'<b>{i_}.</b> {e(x["en"])}')
    elif mode == 'en':
        head, qline, sub = '영어 보고 뜻 쓰기', e(x['en']), (f'<div class="qz-s">{e(x["ex_en"])}</div>' if x.get('ex_en') else '')
        ans_list.append(f'<b>{i_}.</b> {e(x["def"])}')
    else:
        import re as _re
        blanked = _re.sub(_re.escape(x['en']), '____________', x['ex_en'], flags=_re.I) if x.get('ex_en') else '____________'
        head, qline, sub = '빈칸 채우기', blanked, (f'<div class="qz-s">{e(x["ex_kr"])}</div>' if x.get('ex_kr') else '')
        ans_list.append(f'<b>{i_}.</b> {e(x["en"])}')
    mine_q = f'<div class="qz-s" style="color:{MUT};">내 문장: {e(q["mine"])}</div>' if q['mine'] else ''
    qz_html += f"""<div class="qz">
      <div class="qz-h"><span>{i_:02d} / {head}</span><span class="qz-r">약점 {q['rank']}위</span></div>
      <div class="qz-q">{qline}</div>{sub}{mine_q}
      <div class="qz-a">답 <span class="ln"></span></div>
    </div>"""

P.append(f"""<div class="sec"><div class="sec-h"><div>
  <div class="no">SECTION 3</div><div class="ti">랜덤 복습 퀴즈 {len(QZ)}</div>
  <div class="sub">약했던 순서대로 / 뜻→영어, 영어→뜻, 빈칸 채우기를 번갈아 냈어요</div></div></div>
  {qz_html}
  <div style="margin-top:5mm;padding-top:3mm;border-top:.6pt solid {LINE};">
    <div class="lab" style="margin-bottom:2mm;">ANSWER</div>
    <div class="ans">{' / '.join(ans_list)}</div>
  </div>
</div>""")

# ── SECTION 4 · 내가 쓴 문장 전체 ─────────────────────────
mine_html_all = ""
_lastday = None
for dayn, daytitle, en, txt in ALL_MINE:
    if dayn != _lastday:
        mine_html_all += f'<div class="ms-d" style="margin-top:3mm;">DAY {dayn:02d} / {e(daytitle)}</div>'
        _lastday = dayn
    mine_html_all += f'<div class="ms"><div class="ms-h">{e(en)}</div><div class="ms-t">{e(txt)}</div></div>'
P.append(f"""<div class="sec"><div class="sec-h"><div>
  <div class="no">SECTION 4</div><div class="ti">{e(name)} 님의 문장집 {len(ALL_MINE)}</div>
  <div class="sub">20일 동안 직접 쓰신 문장 전부예요 / 회의 전에 이 장만 훑어보세요</div></div></div>
  <div class="mine-cols">{mine_html_all}</div>
</div>""")

P.append(f"""<div class="sec"><div class="sec-h"><div><div class="no">SECTION 5</div>
  <div class="ti">이 노트 쓰는 법</div><div class="sub">한 번에 다 하지 마세요. 하루 5분이면 충분해요</div></div></div>
  <ol class="how">
    <li><b>뜻부터 가리고 시작하세요.</b> 영어만 보고 뜻이 3초 안에 안 나오면 아직 내 것이 아닙니다.</li>
    <li><b>점선 칸에 직접 써보세요.</b> 눈으로 읽는 것과 손으로 쓰는 것은 기억에 남는 정도가 다릅니다.</li>
    <li><b>예문은 소리 내어 한 번.</b> 회의에서 꺼낼 말은 입이 먼저 기억합니다.</li>
    <li><b>내 상황으로 바꿔 한 문장.</b> "이번 주 내 업무"에 이 표현을 넣어 한 문장만 만들어 보세요. 앱 AI 첨삭에 넣으면 바로 봐드립니다.</li>
    <li><b>일주일 뒤에 한 번 더.</b> 잊을 때쯤 다시 보는 게 가장 오래 갑니다.</li>
  </ol>
  <div style="margin-top:10mm;padding:5mm 6mm;border:.6pt solid {LINE};border-radius:2.5mm;background:{PAPER};">
    <div style="font-size:9.5pt;font-weight:800;color:{BRN_D};">20일, 끝까지 오셨어요</div>
    <div style="margin-top:2mm;font-size:8.6pt;color:{SOFT};line-height:1.75;">
      이 노트에 남은 표현들은 {e(name)} 님이 <b>포기하지 않고 계속 부딪힌</b> 것들이에요.<br/>
      쉽게 외워진 것보다, 여기 있는 게 결국 더 오래 갑니다.</div>
  </div>
</div>""")

doc = f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{"".join(P)}</body></html>'
doc = doc.replace(' · ', ' / ').replace('·', '/')
out = sys.argv[3] if len(sys.argv) > 3 else '/tmp/wk/약점노트.pdf'
HTML(string=doc).write_pdf(out)
print('ok', out, '· 흔들린', len(rows), '· 수록', len(TOP))
