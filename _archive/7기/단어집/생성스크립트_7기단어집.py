# -*- coding: utf-8 -*-
import json, html, datetime
d = json.load(open('/tmp/7gi.json'))
WEEKS = {int(k): v for k, v in d['weeks'].items()}   # JSON 키가 문자열이라 int 로 정규화 (안 하면 week 매칭 전부 실패)
DAYS = d['days']
e = lambda t: html.escape(str(t or ''))

GREEN, DARK, GOLD, PAPER, INK, SOFT, MUTED = '#2E6B4F', '#1F4D38', '#C9942F', '#FFFDF7', '#2A2620', '#5C5449', '#94897A'

CSS = f"""
@page {{ size: A4; margin: 17mm 15mm 16mm; background: {PAPER};
  @bottom-center {{ content: counter(page); font-family: 'Noto Sans CJK KR'; font-size: 8pt; color: {MUTED}; }} }}
@page cover {{ margin: 0; background: {DARK}; @bottom-center {{ content: ''; }} }}
@page divider {{ margin: 0; background: {PAPER}; @bottom-center {{ content: ''; }} }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Noto Sans CJK KR', sans-serif; color: {INK}; font-size: 9.5pt; line-height: 1.6; margin: 0; }}
.cover {{ page: cover; height: 297mm; padding: 34mm 24mm; color: #fff; position: relative; }}
.cv-k {{ font-size: 9pt; letter-spacing: .34em; color: {GOLD}; font-weight: 700; }}
.cv-t {{ margin-top: 15mm; font-size: 46pt; font-weight: 900; line-height: 1.04; letter-spacing: -.03em; }}
.cv-s {{ margin-top: 6mm; font-size: 13pt; color: #BFD6C8; font-weight: 500; }}
.cv-rule {{ margin-top: 9mm; width: 26mm; height: 2.4pt; background: {GOLD}; }}
.cv-list {{ margin-top: 11mm; font-size: 10pt; color: #D3E3D9; line-height: 2.15; }}
.cv-list b {{ color: #fff; font-weight: 700; }}
.cv-foot {{ position: absolute; left: 24mm; bottom: 26mm; font-size: 8.5pt; color: #7FA592; letter-spacing: .1em; }}
.divider {{ page: divider; height: 297mm; padding: 62mm 26mm 0; }}
.dv-n {{ font-size: 9pt; letter-spacing: .3em; color: {GOLD}; font-weight: 800; }}
.dv-t {{ margin-top: 7mm; font-size: 31pt; font-weight: 900; color: {DARK}; letter-spacing: -.025em; line-height: 1.1; }}
.dv-s {{ margin-top: 5mm; font-size: 12.5pt; color: {GREEN}; font-weight: 600; }}
.dv-rule {{ margin-top: 8mm; width: 22mm; height: 2.2pt; background: {GOLD}; }}
.dv-days {{ margin-top: 12mm; }}
.dv-row {{ display: flex; gap: 5mm; padding: 3.1mm 0; border-bottom: .4pt solid rgba(46,107,79,.13); font-size: 9.5pt; }}
.dv-row .n {{ flex: 0 0 15mm; color: {GOLD}; font-weight: 800; font-size: 8.5pt; padding-top: .5mm; }}
.dv-row .w {{ flex: 1; color: {INK}; font-weight: 600; }}
.dv-row .w i {{ display: block; font-style: normal; font-size: 8.5pt; color: {MUTED}; font-weight: 400; margin-top: .6mm; }}
.day {{ page-break-before: always; }}
.day-h {{ border-bottom: 1.6pt solid {DARK}; padding-bottom: 3mm; margin-bottom: 4.6mm; }}
.day-h .no {{ font-size: 8pt; letter-spacing: .24em; color: {GOLD}; font-weight: 800; }}
.day-h .ti {{ margin-top: 2.2mm; font-size: 15pt; font-weight: 800; color: {DARK}; letter-spacing: -.02em; }}
.day-h .go {{ margin-top: 1.8mm; font-size: 9pt; color: {GREEN}; font-style: italic; }}
.card {{ page-break-inside: avoid; margin-bottom: 3.2mm; border: .5pt solid rgba(46,107,79,.2); border-left: 2.6pt solid {GREEN};
  border-radius: 2.2mm; padding: 3.2mm 4mm; background: #fff; }}
.w-top {{ line-height: 1.25; }}
.w-meta {{ margin-top: .9mm; margin-left: 7.4mm; }}
.w-num {{ display: inline-block; width: 5mm; height: 5mm; border-radius: 50%; background: {GREEN}; color: #fff;
  font-size: 7pt; font-weight: 800; text-align: center; line-height: 5mm; margin-right: 2.4mm; vertical-align: 1.1mm; }}
.w-en {{ font-size: 12.5pt; font-weight: 800; color: {DARK}; letter-spacing: -.015em; }}
.w-pron {{ font-size: 8pt; color: {MUTED}; }}
.w-pos {{ font-size: 6.8pt; color: {GREEN}; border: .4pt solid rgba(46,107,79,.35); border-radius: 6pt; padding: .3mm 1.6mm; }}
.w-def {{ margin-top: 1.2mm; margin-left: 7.4mm; font-size: 9.5pt; font-weight: 700; color: {INK}; }}
.blk {{ margin-top: 2.2mm; margin-left: 7.4mm; }}
.lab {{ font-size: 6.8pt; letter-spacing: .16em; font-weight: 800; color: {GOLD}; }}
.ex-en {{ margin-top: .9mm; font-size: 9.1pt; color: {DARK}; font-style: italic; }}
.ex-kr {{ margin-top: .6mm; font-size: 8.2pt; color: {SOFT}; }}
.nu {{ margin-top: .8mm; font-size: 8pt; color: {SOFT}; line-height: 1.5; }}
.syn {{ margin-top: 2.2mm; margin-left: 7.4mm; padding-top: 1.8mm; border-top: .4pt dashed rgba(46,107,79,.26); }}
.syn-i {{ display: inline-block; font-size: 8.4pt; color: {GREEN}; font-weight: 600; background: rgba(46,107,79,.07);
  border-radius: 5pt; padding: .7mm 2.4mm; margin-right: 1.6mm; }}
.close {{ page-break-before: always; padding-top: 54mm; text-align: center; }}
.heart {{ position: relative; width: 13mm; height: 13mm; margin: 0 auto; }}
.heart span {{ position: absolute; top: 0; width: 6.5mm; height: 10mm; background: {GOLD}; border-radius: 3.25mm 3.25mm 0 0; }}
.heart span:first-child {{ left: 3.25mm; transform: rotate(-45deg); transform-origin: 0 100%; }}
.heart span:last-child {{ left: 0; transform: rotate(45deg); transform-origin: 100% 100%; }}
.close .t {{ margin-top: 6mm; font-size: 22pt; font-weight: 900; color: {DARK}; letter-spacing: -.025em; }}
.close .b {{ margin: 8mm auto 0; max-width: 118mm; font-size: 10pt; color: {SOFT}; line-height: 2; }}
.close .s {{ margin-top: 14mm; font-size: 9pt; color: {GOLD}; letter-spacing: .16em; font-weight: 700; }}
"""

def card(w, i):
    syn = ''.join(f'<span class="syn-i">{e(s)}</span>' for s in w['syn'])
    return f"""<div class="card">
  <div class="w-top"><span class="w-num">{i}</span><span class="w-en">{e(w['en'])}</span></div>
  <div class="w-meta"><span class="w-pron">{e(w['pron'])}</span><span class="w-pos">{e(w['pos'])}</span></div>
  <div class="w-def">{e(w['def'])}</div>
  <div class="blk"><div class="lab">EXAMPLE</div>
    <div class="ex-en">{e(w['ex_en'])}</div><div class="ex-kr">{e(w['ex_kr'])}</div></div>
  <div class="blk"><div class="lab">이럴 때 써요</div><div class="nu">{e(w['nuance'])}</div></div>
  {f'<div class="syn"><span class="lab">같이 알아두기</span> &nbsp;{syn}</div>' if syn else ''}
</div>"""

parts = [f"""<div class="cover">
  <div class="cv-k">YOUBUDDY · 7기</div>
  <div class="cv-t">4주<br>단어집</div>
  <div class="cv-rule"></div>
  <div class="cv-s">비즈니스 영어 챌린지 · 20일의 기록</div>
  <div class="cv-list">
    <b>단어 60개</b> · Day 1 ~ Day 20<br>
    <b>유의어 120개</b> · 같이 알아두면 좋은 표현<br>
    <b>예문 60개</b> · 실제 회사에서 쓰는 문장으로<br>
    <b>이럴 때 써요</b> · 원어민이 이 말을 꺼내는 순간
  </div>
  <div class="cv-foot">완주자 전용 학습 자료 · 2026</div>
</div>"""]

for n in sorted(WEEKS):
    wk, wdays = WEEKS[n], [x for x in DAYS if x['week'] == n]
    rows = ''.join(
        f'<div class="dv-row"><span class="n">DAY {x["day"]:02d}</span>'
        f'<span class="w">{e(" · ".join(w["en"] for w in x["words"]))}<i>{e(x["title"])}</i></span></div>'
        for x in wdays)
    parts.append(f"""<div class="divider">
  <div class="dv-n">WEEK {n}</div><div class="dv-t">{e(wk['title'])}</div>
  <div class="dv-rule"></div><div class="dv-s">{e(wk['subtitle'])}</div>
  <div class="dv-days">{rows}</div></div>""")
    for x in wdays:
        parts.append(f"""<div class="day"><div class="day-h">
  <div class="no">WEEK {n} · DAY {x['day']:02d}</div>
  <div class="ti">{e(x['title'])}</div><div class="go">{e(x['goal_en'])}</div></div>
  {''.join(card(w, i + 1) for i, w in enumerate(x['words']))}</div>""")

parts.append(f"""<div class="close"><div class="heart"><span></span><span></span></div>
  <div class="t">20일, 끝까지 오셨어요</div>
  <div class="b">여기 담긴 60개는 외워야 할 목록이 아니라,<br>
    이미 한 번씩 입 밖으로 꺼내본 표현들이에요.<br><br>
    다음 회의 전에 한 장만 펼쳐보세요.<br>
    그날 필요한 한마디가 거기 있을 거예요.</div>
  <div class="s">YOUBUDDY · 유버디</div></div>""")

doc = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{''.join(parts)}</body></html>"
open('/tmp/book.html', 'w', encoding='utf-8').write(doc)

from weasyprint import HTML
out = '/sessions/optimistic-gracious-bardeen/mnt/youbuddy-challenge-claude/_archive/7기/단어집/유버디_7기_4주단어집.pdf'
HTML(string=doc).write_pdf(out)
print('생성:', out)
