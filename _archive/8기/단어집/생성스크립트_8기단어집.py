# -*- coding: utf-8 -*-
# 유버디 8기 4주 단어집 PDF 생성기 (7기 스크립트 계승 · 2026-09-03)
# 변경점: 8기 오렌지 팔레트 · 단어마다 '♥ 버디 톡' 한 줄 추가 (버디 실제 말투, 비유문 없음)
import json, html
d = json.load(open('/tmp/8gi_full.json'))
BUDDY = json.load(open('버디톡_60줄.json'))
e = lambda t: html.escape(str(t or ''))

MAIN, DARK, GOLD, PAPER, INK, SOFT, MUTED = '#C4622D', '#7A3A15', '#E0A458', '#FFFDF7', '#2A2620', '#5C5449', '#94897A'

CSS = f"""
@page {{ size: A4; margin: 17mm 15mm 16mm; background: {PAPER};
  @bottom-center {{ content: counter(page); font-family: 'Noto Sans CJK KR'; font-size: 8pt; color: {MUTED}; }} }}
@page cover {{ margin: 0; background: {DARK}; @bottom-center {{ content: ''; }} }}
@page divider {{ margin: 0; background: {PAPER}; @bottom-center {{ content: ''; }} }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Noto Sans CJK KR', sans-serif; color: {INK}; font-size: 9.5pt; line-height: 1.6; margin: 0; }}
.cover {{ page: cover; height: 297mm; padding: 34mm 24mm; color: #fff; position: relative; }}
.cv-k {{ font-size: 9pt; letter-spacing: .34em; color: {GOLD}; font-weight: 700; }}
.cv-t {{ margin-top: 15mm; font-size: 44pt; font-weight: 900; line-height: 1.06; letter-spacing: -.03em; }}
.cv-s {{ margin-top: 6mm; font-size: 13pt; color: #F0D9C4; font-weight: 500; }}
.cv-rule {{ margin-top: 9mm; width: 26mm; height: 2.4pt; background: {GOLD}; }}
.cv-list {{ margin-top: 11mm; font-size: 10pt; color: #F2E3D2; line-height: 2.15; }}
.cv-list b {{ color: #fff; font-weight: 700; }}
.cv-foot {{ position: absolute; left: 24mm; bottom: 26mm; font-size: 8.5pt; color: #C99B72; letter-spacing: .1em; }}
.divider {{ page: divider; height: 297mm; padding: 58mm 26mm 0; page-break-before: always; }}
.dv-n {{ font-size: 9pt; letter-spacing: .3em; color: {GOLD}; font-weight: 800; }}
.dv-t {{ margin-top: 7mm; font-size: 30pt; font-weight: 900; color: {DARK}; letter-spacing: -.025em; line-height: 1.1; }}
.dv-rule {{ margin-top: 8mm; width: 22mm; height: 2.2pt; background: {GOLD}; }}
.dv-days {{ margin-top: 12mm; }}
.dv-row {{ display: flex; gap: 5mm; padding: 3.1mm 0; border-bottom: .4pt solid rgba(196,98,45,.15); font-size: 9.5pt; }}
.dv-row .n {{ flex: 0 0 15mm; color: {GOLD}; font-weight: 800; font-size: 8.5pt; padding-top: .5mm; }}
.dv-row .w {{ flex: 1; color: {INK}; font-weight: 600; }}
.dv-row .w i {{ display: block; font-style: normal; font-size: 8.5pt; color: {MUTED}; font-weight: 400; margin-top: .6mm; }}
.day {{ page-break-before: always; }}
.day-h {{ border-bottom: 1.6pt solid {DARK}; padding-bottom: 3mm; margin-bottom: 4.6mm; }}
.day-h .no {{ font-size: 8pt; letter-spacing: .24em; color: {GOLD}; font-weight: 800; }}
.day-h .ti {{ margin-top: 2.2mm; font-size: 15pt; font-weight: 800; color: {DARK}; letter-spacing: -.02em; }}
.card {{ page-break-inside: avoid; margin-bottom: 3.2mm; border: .5pt solid rgba(196,98,45,.22); border-left: 2.6pt solid {MAIN};
  border-radius: 2.2mm; padding: 3.2mm 4mm; background: #fff; }}
.w-num {{ display: inline-block; width: 5mm; height: 5mm; border-radius: 50%; background: {MAIN}; color: #fff;
  font-size: 7pt; font-weight: 800; text-align: center; line-height: 5mm; margin-right: 2.4mm; vertical-align: 1.1mm; }}
.w-en {{ font-size: 12.5pt; font-weight: 800; color: {DARK}; letter-spacing: -.015em; }}
.w-pron {{ font-size: 8pt; color: {MUTED}; margin-left: 1.6mm; }}
.w-pos {{ font-size: 6.8pt; color: {MAIN}; border: .4pt solid rgba(196,98,45,.4); border-radius: 6pt; padding: .3mm 1.6mm; margin-left: 1.6mm; }}
.w-def {{ margin-top: 1.2mm; margin-left: 7.4mm; font-size: 9.5pt; font-weight: 700; color: {INK}; }}
.blk {{ margin-top: 2.2mm; margin-left: 7.4mm; }}
.lab {{ font-size: 6.8pt; letter-spacing: .16em; font-weight: 800; color: {GOLD}; }}
.ex-en {{ margin-top: .9mm; font-size: 9.1pt; color: {DARK}; font-style: italic; }}
.ex-kr {{ margin-top: .6mm; font-size: 8.2pt; color: {SOFT}; }}
.nu {{ margin-top: .8mm; font-size: 8pt; color: {SOFT}; line-height: 1.55; }}
.bd {{ margin-top: 2.2mm; margin-left: 7.4mm; background: rgba(196,98,45,.06); border-left: 2pt solid {GOLD};
  border-radius: 1.5mm; padding: 1.8mm 2.6mm; font-size: 8.3pt; color: #6B4A2E; line-height: 1.55; }}
.bd b {{ color: {DARK}; font-size: 6.8pt; letter-spacing: .14em; display: block; margin-bottom: .6mm; }}
.syn {{ margin-top: 2.2mm; margin-left: 7.4mm; padding-top: 1.8mm; border-top: .4pt dashed rgba(196,98,45,.28); }}
.syn-i {{ display: inline-block; font-size: 8.4pt; color: {MAIN}; font-weight: 600; background: rgba(196,98,45,.07);
  border-radius: 5pt; padding: .7mm 2.4mm; margin-right: 1.6mm; }}
.close {{ page-break-before: always; padding-top: 60mm; text-align: center; }}
.cl-t {{ font-size: 17pt; font-weight: 900; color: {DARK}; letter-spacing: -.02em; }}
.cl-s {{ margin-top: 5mm; font-size: 10pt; color: {SOFT}; line-height: 1.9; }}
.cl-f {{ margin-top: 12mm; font-size: 8.5pt; color: {MUTED}; letter-spacing: .1em; }}
"""

def buddy_line(en):
    if en in BUDDY: return BUDDY[en]
    for k, v in BUDDY.items():
        if k.lower() == en.lower(): return v
    return ''

P = []
P.append(f"""<div class="cover">
  <div class="cv-k">YOUBUDDY BUSINESS ENGLISH</div>
  <div class="cv-t">유버디 8기<br/>4주 단어집</div>
  <div class="cv-s">외국계 실무에서 진짜 쓰는 표현 60</div>
  <div class="cv-rule"></div>
  <div class="cv-list">
    <b>Week 1</b> · 내가 한 일이 보이게<br/>
    <b>Week 2</b> · 숫자로 말하기<br/>
    <b>Week 3</b> · 문제를 정면으로<br/>
    <b>Week 4</b> · 성과를 내 것으로
  </div>
  <div class="cv-foot">20일 완주를 축하드려요 · 이 단어집은 여러분의 것입니다</div>
</div>""")

missing = []
num = 0
for wk in d['weeks']:
    rows = ''.join(
        f'<div class="dv-row"><span class="n">DAY {day["day"]:02d}</span><span class="w">{e(day["theme"])}<i>{e(" · ".join(x["en"] for x in day["words"]))}</i></span></div>'
        for day in wk['days'])
    P.append(f"""<div class="divider">
      <div class="dv-n">WEEK {wk['n']}</div>
      <div class="dv-t">{e(wk['title'])}</div>
      <div class="dv-rule"></div>
      <div class="dv-days">{rows}</div>
    </div>""")
    for day in wk['days']:
        cards = ''
        for x in day['words']:
            num += 1
            bl = buddy_line(x['en'])
            if not bl: missing.append(x['en'])
            syns = ''.join(f'<span class="syn-i">{e(s)}</span>' for s in (x.get('syn') or []))
            cards += f"""<div class="card">
              <div><span class="w-num">{num}</span><span class="w-en">{e(x['en'])}</span><span class="w-pron">{e(x.get('pron',''))}</span>{f'<span class="w-pos">{e(x["pos"])}</span>' if x.get('pos') else ''}</div>
              <div class="w-def">{e(x['def'])}</div>
              <div class="blk"><span class="lab">EXAMPLE</span>
                <div class="ex-en">{e(x['ex_en'])}</div>
                <div class="ex-kr">{e(x['ex_kr'])}</div></div>
              <div class="blk"><span class="lab">이럴 때 써요</span>
                <div class="nu">{e(x.get('nuance',''))}</div></div>
              {f'<div class="bd"><b>♥ 버디 톡</b>{e(bl)}</div>' if bl else ''}
              {f'<div class="syn">{syns}</div>' if syns else ''}
            </div>"""
        P.append(f"""<div class="day">
          <div class="day-h"><div class="no">WEEK {wk['n']} · DAY {day['day']:02d}</div><div class="ti">{e(day['theme'])}</div></div>
          {cards}
        </div>""")

P.append(f"""<div class="close">
  <div class="cl-t">여기까지 온 당신이 이 단어집의 저자예요</div>
  <div class="cl-s">20일 동안 매일 이 표현들을 입에 올렸잖아요.<br/>
  이제 외운 단어가 아니라, 써 본 문장이 남았습니다.<br/>
  회의 전 5분, 이 단어집을 펼치는 습관 하나만 이어가 보세요.</div>
  <div class="cl-f">YOUBUDDY · 8TH COHORT · 2026</div>
</div>""")

html_doc = f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{"".join(P)}</body></html>'
open('/tmp/8gi_vocab.html', 'w').write(html_doc)
print('단어 수:', num, '· 버디톡 누락:', missing)

from weasyprint import HTML
HTML(string=html_doc).write_pdf('/tmp/유버디_8기_4주단어집.pdf')
import os
print('PDF 생성:', os.path.getsize('/tmp/유버디_8기_4주단어집.pdf'), 'bytes')
