# -*- coding: utf-8 -*-
# 유버디 4주 단어집 생성 (2026-11-13) : 9기 레이아웃 그대로, 데이터는 앱(Nth/index.html)에서 추출, 테마색은 그 기수 앱 색
# 사용: node 앱에서_단어추출.js 10 && python3 생성스크립트_단어집.py 10
import json, html, io, base64, qrcode, sys
N = sys.argv[1] if len(sys.argv) > 1 else '10'
THEME = {'10': ('#7B3B4E', '#2B1A21', '#FBF7F0', '#EBD5DC', '#6B5F58', '#D9A3B4'), '11': ('#2F4A6D', '#16202E', '#FBF7F0', '#D9E3EE', '#5E6672', '#9DB7D6')}[N]
import os; D = os.environ.get('VOCAB_DIR', '/tmp/') + '/'
APP = json.load(open(D+f'app{N}.json'))
d = APP['ch']
BUDDY = {}
import re
SPOON = {int(k): re.sub(r'[\U00010000-\U0010ffff\ufe0f]', '', v).strip() for k, v in APP['spoon'].items()}
def _qr(u):
    b = io.BytesIO(); qrcode.make(u, box_size=8, border=1).save(b, format='PNG'); return base64.b64encode(b.getvalue()).decode()
e = lambda t: html.escape(str(t or ''))
ROSE, CHAR, CREAM, BLUSH, WARM, ROSE_L = THEME
SAGE = '#7DB5A8'
def _rgb(h): return ','.join(str(int(h[i:i+2],16)) for i in (1,3,5))
RR = _rgb(ROSE)

CSS = f"""
@page {{ size: A4; margin: 12mm 13mm 11mm; background: {CREAM};
  @bottom-center {{ content: counter(page); font-family: 'Noto Sans CJK KR'; font-size: 7.5pt; color: {WARM}; }} }}
@page cover {{ margin: 0; background: {CHAR}; @bottom-center {{ content: ''; }} }}
@page last {{ margin: 0; background: {CHAR}; @bottom-center {{ content: ''; }} }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Noto Sans CJK KR', sans-serif; color: {CHAR}; font-size: 8.2pt; line-height: 1.5; margin: 0; }}
.cover {{ page: cover; height: 297mm; padding: 36mm 24mm; color: #fff; position: relative; }}
.cv-k {{ font-size: 9pt; letter-spacing: .34em; color: {ROSE_L}; font-weight: 700; }}
.cv-t {{ margin-top: 15mm; font-size: 44pt; font-weight: 900; line-height: 1.06; letter-spacing: -.03em; }}
.cv-s {{ margin-top: 6mm; font-size: 13pt; color: {BLUSH}; font-weight: 500; }}
.cv-rule {{ margin-top: 9mm; width: 26mm; height: 2.4pt; background: {ROSE_L}; }}
.cv-list {{ margin-top: 11mm; font-size: 10pt; color: #E9E1EA; line-height: 2.15; }}
.cv-list b {{ color: #fff; font-weight: 700; }}
.cv-foot {{ position: absolute; left: 24mm; bottom: 26mm; font-size: 8.5pt; color: #A39AA8; letter-spacing: .1em; }}
.day {{ page-break-before: always; }}
.day-h {{ border-bottom: 1.4pt solid {CHAR}; padding-bottom: 2mm; margin-bottom: 3mm; }}
.day-h .no {{ font-size: 7.2pt; letter-spacing: .22em; color: {ROSE}; font-weight: 800; }}
.day-h .ti {{ margin-top: 1.4mm; font-size: 13pt; font-weight: 800; color: {CHAR}; letter-spacing: -.02em; }}
.card {{ page-break-inside: avoid; margin-bottom: 2.4mm; border: .5pt solid rgba({RR},.32); border-left: 2.4pt solid {ROSE};
  border-radius: 2mm; padding: 2.4mm 3.2mm; background: #fff; }}
.w-num {{ display: inline-block; width: 4.4mm; height: 4.4mm; border-radius: 50%; background: {ROSE}; color: #fff;
  font-size: 6.4pt; font-weight: 800; text-align: center; line-height: 4.4mm; margin-right: 2mm; vertical-align: .9mm; }}
.w-en {{ font-size: 11pt; font-weight: 800; color: {CHAR}; letter-spacing: -.015em; }}
.w-pron {{ font-size: 7.2pt; color: {WARM}; margin-left: 1.4mm; }}
.w-def {{ display: inline; margin-left: 2mm; font-size: 8.6pt; font-weight: 700; color: {ROSE}; }}
.blk {{ margin-top: 1.5mm; margin-left: 6.4mm; }}
.lab {{ font-size: 6.2pt; letter-spacing: .15em; font-weight: 800; color: {ROSE}; }}
.ex-en {{ margin-top: .5mm; font-size: 8.3pt; color: {CHAR}; font-style: italic; }}
.ex-kr {{ margin-top: .3mm; font-size: 7.4pt; color: {WARM}; }}
.nu {{ margin-top: .5mm; font-size: 7.3pt; color: {WARM}; line-height: 1.5; }}
.bd {{ margin-top: 1.5mm; margin-left: 6.4mm; background: {BLUSH}; border-radius: 1.4mm; padding: 1.4mm 2.2mm;
  font-size: 7.4pt; color: {CHAR}; line-height: 1.5; }}
.bd b {{ color: {ROSE}; font-size: 6.2pt; letter-spacing: .13em; margin-right: 1.6mm; }}
.syn {{ display: inline; margin-left: 2mm; }}
.syn-i {{ display: inline-block; font-size: 7.2pt; color: {ROSE}; font-weight: 600; background: rgba({RR},.09);
  border-radius: 4pt; padding: .4mm 1.8mm; margin-right: 1.2mm; vertical-align: .2mm; }}
.spoon {{ margin-top: 2.6mm; background: rgba(125,181,168,.1); border: .5pt solid rgba(125,181,168,.4);
  border-radius: 2mm; padding: 2.4mm 3.2mm; page-break-inside: avoid; }}
.spoon .lab2 {{ font-size: 6.4pt; letter-spacing: .15em; font-weight: 800; color: #4E8A7B; }}
.spoon .tx {{ margin-top: 1mm; font-size: 7.4pt; color: #3F5B54; line-height: 1.6; white-space: pre-line; }}
.last {{ page: last; page-break-before: always; height: 297mm; padding: 70mm 26mm 0; color: #fff; text-align: center; }}
.ls-t {{ font-size: 20pt; font-weight: 900; letter-spacing: -.02em; line-height: 1.3; }}
.ls-s {{ margin-top: 6mm; font-size: 10pt; color: {BLUSH}; line-height: 1.9; }}
.ls-btn {{ display: block; width: 96mm; margin: 4mm auto 0; padding: 4.6mm 0; border-radius: 10mm; font-size: 10.5pt;
  font-weight: 800; text-decoration: none; }}
.ls-b1 {{ background: {ROSE}; color: #fff; margin-top: 14mm; }}
.ls-b2 {{ background: transparent; color: {BLUSH}; border: 1pt solid rgba(245,230,220,.5); }}
.ls-f {{ margin-top: 16mm; font-size: 8pt; color: #A39AA8; letter-spacing: .12em; }}
"""

def buddy_line(en):
    if en in BUDDY: return BUDDY[en]
    for k, v in BUDDY.items():
        if k.lower() == en.lower(): return v
    return ''

QR_RANDOM = _qr(f'https://youbuddy.co.kr/{N}th/#random-test')
P = []
WEEKLIST = "<br/>".join(f"<b>Week {w['n']}</b> · {e(w['subtitle'])}" for w in d['weeks'])
P.append(f"""<div class="cover">
  <div class="cv-k">YOUBUDDY BUSINESS ENGLISH</div>
  <div class="cv-t">유버디 {N}기<br/>4주 단어집</div>
  <div class="cv-s">외국계 실무에서 진짜 쓰는 표현 60</div>
  <div class="cv-rule"></div>
  <div class="cv-list">
    {WEEKLIST}
  </div>
  <div class="cv-foot">20일 완주를 축하드려요 · 이 단어집은 여러분의 것입니다</div>
  <div style="position:absolute;right:24mm;bottom:22mm;text-align:center;">
    <img src="data:image/png;base64,{QR_RANDOM}" style="width:20mm;height:20mm;border-radius:2mm;"/>
    <div style="font-size:6.5pt;color:#E9E1EA;font-weight:700;margin-top:1.2mm;line-height:1.35;">QR 찍으면 앱에서<br/>랜덤 단어 테스트</div>
  </div>
</div>""")

num = 0
for wk in d['weeks']:
    for day in wk['days']:
        cards = ''
        for x in day['words']:
            num += 1
            bl = buddy_line(x['en'])
            syns = ''.join(f'<span class="syn-i">{e(s)}</span>' for s in (x.get('syn') or []))
            cards += f"""<div class="card">
              <div><span class="w-num">{num}</span><span class="w-en">{e(x['en'])}</span><span class="w-pron">{e(x.get('pron',''))}</span><span class="w-def">{e(x['def'])}</span></div>
              <div class="blk"><span class="lab">EXAMPLE</span>
                <div class="ex-en">{e(x['ex_en'])}</div>
                <div class="ex-kr">{e(x['ex_kr'])}</div></div>
              <div class="blk"><span class="lab">이럴 때 써요</span>
                <div class="nu">{e(x.get('nuance',''))}</div></div>
              {f'<div class="bd"><b>♥ 버디 톡</b>{e(bl)}</div>' if bl else ''}
              {f'<div class="blk"><span class="lab">유의어</span><span class="syn">{syns}</span></div>' if syns else ''}
            </div>"""
        sp = SPOON.get(day['day'])
        spoon_html = f'<div class="spoon"><div class="lab2">그날 저녁, 유버디 톡 · 한 스푼 더</div><div class="tx">{e(sp)}</div></div>' if sp else ''
        P.append(f"""<div class="day">
          <div class="day-h"><div class="no">WEEK {wk['n']} · DAY {day['day']:02d}</div><div class="ti">{e(day['title'])}</div></div>
          {cards}
          {spoon_html}
        </div>""")


# ── 부록: 180개 전체 인덱스 + 종이 테스트 (2026-09-04 버디 요청) ──
SYN_GLOSS = APP['gloss']
def syn_ko(en):
    if en in SYN_GLOSS: return SYN_GLOSS[en]
    low = en.lower()
    for k, v in SYN_GLOSS.items():
        if k.lower() == low: return v
    return ''

ALL_WORDS = []  # (en, ko, day, is_syn)
for wk in d['weeks']:
    for day in wk['days']:
        for x in day['words']:
            ALL_WORDS.append((x['en'], x['def'], day['day'], False))
            for sy in (x.get('syn') or []):
                ALL_WORDS.append((sy, syn_ko(sy), day['day'], True))
missing_syn = [w for w in ALL_WORDS if w[3] and not w[1]]
print('전체:', len(ALL_WORDS), '· 유의어 뜻 누락:', len(missing_syn), [w[0] for w in missing_syn][:6])

IDX_CSS = """
.appx { page-break-before: always; }
.ap-h { border-bottom: 1.4pt solid CHARX; padding-bottom: 2mm; margin-bottom: 3mm; }
.ap-h .no { font-size: 7.2pt; letter-spacing: .22em; color: ROSEX; font-weight: 800; }
.ap-h .ti { margin-top: 1.4mm; font-size: 13pt; font-weight: 800; color: CHARX; }
.ap-h .sub { margin-top: 1mm; font-size: 7.6pt; color: #6B6260; }
.idx-cols { column-count: 2; column-gap: 6mm; }
.idx-row { display: flex; gap: 2mm; font-size: 6.9pt; line-height: 1.5; padding: .55mm 0; border-bottom: .3pt solid rgba(RRX,.16); break-inside: avoid; }
.idx-row .n { flex: 0 0 6.5mm; color: ROSEX; font-weight: 700; font-size: 6.2pt; }
.idx-row .en { flex: 0 0 34mm; font-weight: 700; color: CHARX; }
.idx-row .en.syn { font-weight: 500; color: #6B6260; padding-left: 2mm; }
.idx-row .ko { flex: 1; color: #5C5449; }
.tst-row .ko { color: CHARX; }
.blank { display: inline-block; width: 90%; border-bottom: .8pt solid #8A7F78; height: 3.2mm; margin-right: 2.5mm; }
"""
s_css_anchor = '.ls-f {'
assert s_css_anchor in CSS

def idx_rows(items, hide):
    # items = (원번호, (en, ko, day, is_syn)) · 번호는 APPENDIX 1 기준 고정 (테스트에서도 동일 → 정답 찾기 쉬움)
    rows = []
    for n, (en, ko, day, is_syn) in items:
        en_html = '<span class="blank"></span>' if hide == 'en' else e(en)
        ko_html = '<span class="blank"></span>' if hide == 'ko' else e(ko)
        cls = 'en syn' if is_syn else 'en'
        rows.append(f'<div class="idx-row{" tst-row" if hide else ""}"><span class="n">{n:03d}</span><span class="{cls}">{en_html}</span><span class="ko">{ko_html}</span></div>')
    return ''.join(rows)

NUMBERED = list(enumerate(ALL_WORDS, 1))
import random
rnd = random.Random(8)
SHUF = NUMBERED[:]
rnd.shuffle(SHUF)
HALF_A, HALF_B = SHUF[:90], SHUF[90:]  # 순서는 랜덤 유지, 앞 번호만 APPENDIX 1 정답 번호

APPX = []
QR_B64 = _qr(f'https://youbuddy.co.kr/{N}th/#weak-test')
APPX.append(f"""<div class="appx"><div class="ap-h" style="display:flex;align-items:flex-end;justify-content:space-between;gap:4mm;">
  <div><div class="no">APPENDIX 1</div><div class="ti">전체 표현 인덱스 · 180</div><div class="sub">메인 60 (진하게) + 유의어 120 · Day 순서</div></div>
  <div style="text-align:center;flex-shrink:0;">
    <img src="data:image/png;base64,{QR_B64}" style="width:17mm;height:17mm;"/>
    <div style="font-size:5.8pt;color:#6B6260;font-weight:700;margin-top:.5mm;line-height:1.3;">QR 찍으면 앱에서<br/>약점 단어 테스트</div>
  </div>
</div><div class="idx-cols">{idx_rows(NUMBERED, None)}</div></div>""")
APPX.append(f"""<div class="appx"><div class="ap-h"><div class="no">APPENDIX 2 · SELF TEST A</div><div class="ti">영어 보고 뜻 쓰기 · 90</div><div class="sub">무작위 추출 90개 · 앞 번호 = APPENDIX 1 정답 번호예요. 채우고 바로 맞춰보세요</div></div><div class="idx-cols">{idx_rows(HALF_A, 'ko')}</div></div>""")
APPX.append(f"""<div class="appx"><div class="ap-h"><div class="no">APPENDIX 2 · SELF TEST B</div><div class="ti">뜻 보고 영어 쓰기 · 90</div><div class="sub">나머지 90개 · 앞 번호 = APPENDIX 1 정답 번호. 입으로 먼저, 손으로 확인</div></div><div class="idx-cols">{idx_rows(HALF_B, 'en')}</div></div>""")

CSS = CSS + IDX_CSS.replace('RRX', RR).replace('ROSEX', ROSE).replace('CHARX', CHAR)
for a in APPX: P.append(a)

APPLY = 'https://docurise.io/v/youbuddy-challenge-11-apply?src=pdf_vocab'+N
P.append(f"""<div class="last">
  <div class="ls-t">여기까지 온 당신이<br/>이 단어집의 저자입니다</div>
  <div class="ls-s">20일 동안 매일 이 표현들을 입에 올렸잖아요.<br/>
  이제 외운 단어가 아니라, 써 본 문장이 남았습니다.<br/>
  회의 전 5분, 이 단어집을 펼치는 습관 하나만 이어가 보세요.</div>
  <a class="ls-btn ls-b1" href="{APPLY}">유비챌 등록하러 가기 →</a>
  <a class="ls-btn ls-b2" href="https://www.instagram.com/youbuddy_day">Instagram @youbuddy_day</a>
  <div class="ls-f">YOUBUDDY · {N}TH COHORT · 2026</div>
</div>""")

html_doc = f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{"".join(P)}</body></html>'
# 가운뎃점 전부 슬래시로 (2026-09-04 버디 요청 · 원고 출처 무관 전체 적용)
html_doc = html_doc.replace(' · ', ' / ').replace('·', '/')
open(D+f'vocab{N}.html', 'w').write(html_doc)
from weasyprint import HTML
HTML(string=html_doc).write_pdf(D+f'유버디_{N}기_4주단어집.pdf')
from pypdf import PdfReader
n = len(PdfReader(D+f'유버디_{N}기_4주단어집.pdf').pages)
print('단어:', num, '· 총 페이지:', n, '(목표 22: 표지1+본문20+마지막1)')
