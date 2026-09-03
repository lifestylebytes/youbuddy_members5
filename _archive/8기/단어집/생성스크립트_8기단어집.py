# -*- coding: utf-8 -*-
# 유버디 8기 4주 단어집 v2 (2026-09-03 버디 요청 반영)
# · 홈페이지(상세페이지) 팔레트 (로즈·차콜·크림) · 목차 없음 · Day 1장씩 총 20장
# · 카드마다 ♥ 버디 톡 한 줄 + 페이지 하단에 그날 실제 발송한 '유버디 톡 (한 스푼 더)'
# · 마지막 장: 인스타 + 다음 기수 신청 링크
import json, html
d = json.load(open('/tmp/8gi_full.json'))
BUDDY = json.load(open('버디톡_60줄.json'))
SPOON = {int(k): v for k, v in json.load(open('/tmp/spoon.json')).items()}
e = lambda t: html.escape(str(t or ''))

ROSE, CHAR, CREAM, BLUSH, WARM, SAGE = '#C97F7F', '#2C2828', '#FDF9F4', '#F5E6DC', '#6B6260', '#7DB5A8'

CSS = f"""
@page {{ size: A4; margin: 12mm 13mm 11mm; background: {CREAM};
  @bottom-center {{ content: counter(page); font-family: 'Noto Sans CJK KR'; font-size: 7.5pt; color: {WARM}; }} }}
@page cover {{ margin: 0; background: {CHAR}; @bottom-center {{ content: ''; }} }}
@page last {{ margin: 0; background: {CHAR}; @bottom-center {{ content: ''; }} }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Noto Sans CJK KR', sans-serif; color: {CHAR}; font-size: 8.2pt; line-height: 1.5; margin: 0; }}
.cover {{ page: cover; height: 297mm; padding: 36mm 24mm; color: #fff; position: relative; }}
.cv-k {{ font-size: 9pt; letter-spacing: .34em; color: {ROSE}; font-weight: 700; }}
.cv-t {{ margin-top: 15mm; font-size: 44pt; font-weight: 900; line-height: 1.06; letter-spacing: -.03em; }}
.cv-s {{ margin-top: 6mm; font-size: 13pt; color: {BLUSH}; font-weight: 500; }}
.cv-rule {{ margin-top: 9mm; width: 26mm; height: 2.4pt; background: {ROSE}; }}
.cv-list {{ margin-top: 11mm; font-size: 10pt; color: #E8DCD3; line-height: 2.15; }}
.cv-list b {{ color: #fff; font-weight: 700; }}
.cv-foot {{ position: absolute; left: 24mm; bottom: 26mm; font-size: 8.5pt; color: #A08B85; letter-spacing: .1em; }}
.day {{ page-break-before: always; }}
.day-h {{ border-bottom: 1.4pt solid {CHAR}; padding-bottom: 2mm; margin-bottom: 3mm; }}
.day-h .no {{ font-size: 7.2pt; letter-spacing: .22em; color: {ROSE}; font-weight: 800; }}
.day-h .ti {{ margin-top: 1.4mm; font-size: 13pt; font-weight: 800; color: {CHAR}; letter-spacing: -.02em; }}
.card {{ page-break-inside: avoid; margin-bottom: 2.4mm; border: .5pt solid rgba(201,127,127,.32); border-left: 2.4pt solid {ROSE};
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
  font-size: 7.4pt; color: #7A5348; line-height: 1.5; }}
.bd b {{ color: {ROSE}; font-size: 6.2pt; letter-spacing: .13em; margin-right: 1.6mm; }}
.syn {{ display: inline; margin-left: 2mm; }}
.syn-i {{ display: inline-block; font-size: 7.2pt; color: {ROSE}; font-weight: 600; background: rgba(201,127,127,.09);
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
.ls-f {{ margin-top: 16mm; font-size: 8pt; color: #A08B85; letter-spacing: .12em; }}
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
          <div class="day-h"><div class="no">WEEK {wk['n']} · DAY {day['day']:02d}</div><div class="ti">{e(day['theme'])}</div></div>
          {cards}
          {spoon_html}
        </div>""")

APPLY = 'https://lifestylebytes.github.io/youbuddy-challenge/?utm_source=pdf&utm_medium=vocabbook&utm_campaign=8th_grad'
P.append(f"""<div class="last">
  <div class="ls-t">여기까지 온 당신이<br/>이 단어집의 저자예요</div>
  <div class="ls-s">20일 동안 매일 이 표현들을 입에 올렸잖아요.<br/>
  이제 외운 단어가 아니라, 써 본 문장이 남았습니다.<br/>
  회의 전 5분, 이 단어집을 펼치는 습관 하나만 이어가 보세요.</div>
  <a class="ls-btn ls-b1" href="{APPLY}">유비챌 다음 기수 신청 바로가기 →</a>
  <a class="ls-btn ls-b2" href="https://www.instagram.com/youbuddy_day">Instagram @youbuddy_day</a>
  <div class="ls-f">YOUBUDDY · 8TH COHORT · 2026</div>
</div>""")

html_doc = f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{"".join(P)}</body></html>'
open('/tmp/8gi_vocab.html', 'w').write(html_doc)
from weasyprint import HTML
HTML(string=html_doc).write_pdf('/tmp/유버디_8기_4주단어집.pdf')
from pypdf import PdfReader
n = len(PdfReader('/tmp/유버디_8기_4주단어집.pdf').pages)
print('단어:', num, '· 총 페이지:', n, '(목표 22: 표지1+본문20+마지막1)')
