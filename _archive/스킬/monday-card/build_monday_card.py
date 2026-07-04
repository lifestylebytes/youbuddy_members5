# -*- coding: utf-8 -*-
"""유비챌 월요일 주간 카드 생성기 (코호트 무관).
사용: python3 build_monday_card.py data.json out.png
data.json 형식:
{
  "cohort": "7기", "week_done": 1, "week_next": 2,
  "date_range": "7/13 ~ 7/17",
  "rate": 86, "rate_note": "첫 주 스타트로 아주 좋아요",
  "perfect": ["이름1", "이름2"],
  "earlybird": {"name": "모브", "time": "07:35"},
  "best": [{"name": "베니", "word": "RALLY", "sentence": "We need to rally the team for this opening party."}],
  "moti": "2~3주차가 원래 제일 고비예요. 이번 주는 '한 줄이라도'가 목표!"
}
"""
import json, sys, html
from weasyprint import HTML

def e(s): return html.escape(str(s or ""))

def build(data, out):
    cohort=data.get("cohort","7기"); wd=data.get("week_done",1); wn=data.get("week_next",wd+1)
    perfect=data.get("perfect") or []; eb=data.get("earlybird") or {}
    best=data.get("best") or []
    CSS="""
@page { size:1080px 1350px; margin:0; }
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Noto Sans CJK KR',sans-serif;}
.card{width:1080px;height:1350px;position:relative;padding:70px 84px 56px;color:#3B3125;display:flex;flex-direction:column;
 background:
  radial-gradient(ellipse 55% 40% at 88% 8%, rgba(242,118,75,0.16) 0%, transparent 60%),
  radial-gradient(ellipse 60% 45% at 8% 100%, rgba(233,76,107,0.10) 0%, transparent 55%),
  linear-gradient(160deg,#FFFDF7 0%,#FFF6E9 60%,#FFEFDC 100%);}
.kick{font-size:23px;font-weight:800;letter-spacing:0.26em;color:#E2683C;}
.h1{font-size:54px;font-weight:800;letter-spacing:-0.02em;color:#2B2118;line-height:1.2;margin-top:14px;}
.sub{font-size:26px;color:#8A7A64;margin-top:10px;font-weight:600;}
.rate{margin-top:26px;display:flex;align-items:flex-end;gap:20px;}
.rate .num{font-size:108px;font-weight:800;color:#E2683C;line-height:0.9;}
.rate .pct{font-size:44px;font-weight:800;color:#E2683C;}
.rate .cap{font-size:25px;color:#8A7A64;font-weight:600;padding-bottom:10px;}
.box{margin-top:22px;background:rgba(255,255,255,0.75);border:1.5px solid #F0E2CC;border-radius:26px;padding:30px 34px;}
.box .label{font-size:21px;font-weight:800;color:#C2872B;letter-spacing:0.12em;}
.chips{margin-top:14px;font-size:0;}
.chip{display:inline-block;margin:0 10px 12px 0;font-size:27px;font-weight:800;color:#7A4B12;background:#FDEBC8;border-radius:999px;padding:10px 24px;}
.eb{margin-top:6px;font-size:27px;font-weight:700;color:#3B3125;line-height:1.5;}
.eb b{color:#E2683C;}
.q{margin-top:16px;padding-left:22px;border-left:5px solid #E2683C;}
.q .en{font-family:'Liberation Serif',serif;font-style:italic;font-size:28px;color:#2B2118;line-height:1.4;}
.q .who{margin-top:8px;font-size:23px;color:#8A7A64;font-weight:700;}
.q .who b{color:#B5482E;}
.moti{margin-top:auto;background:#26331F;border-radius:26px;padding:28px 34px;color:#ECEFE3;}
.moti .label{font-size:19px;font-weight:800;color:#FBE7A1;letter-spacing:0.14em;}
.moti .txt{margin-top:9px;font-size:25px;font-weight:700;line-height:1.5;color:#fff;}
.foot{margin-top:20px;font-size:19px;color:#B8A88E;font-weight:600;text-align:center;}
"""
    chips="".join(f'<span class="chip">{e(n)}</span>' for n in perfect) or '<span class="chip">이번 주 개근 도전!</span>'
    bests="".join(
        f'<div class="q"><div class="en">&#8220;{e(b.get("sentence"))}&#8221;</div>'
        f'<div class="who"><b>{e(b.get("name"))}</b> 님 · {e(b.get("word"))}</div></div>'
        for b in best[:2])
    ebline = (f'<div class="eb">EARLY BIRD · <b>{e(eb.get("name"))}</b> 님 (평균 {e(eb.get("time"))} 인증!)</div>' if eb.get("name") else '')
    doc=f"""<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="card">
  <div class="kick">MONDAY BRIEF · {e(cohort)}</div>
  <div class="h1">Week {wd} 지난주,<br>이렇게 달렸어요</div>
  <div class="sub">{e(data.get("date_range",""))}</div>
  <div class="rate"><span class="num">{e(data.get("rate","?"))}</span><span class="pct">%</span><span class="cap">지난주 평균 인증률<br>{e(data.get("rate_note",""))}</span></div>
  <div class="box"><div class="label">BADGE · 지난주 개근 버디</div><div class="chips">{chips}</div>{ebline}</div>
  <div class="box"><div class="label">BEST LINE · 이번 주 베스트 문장</div>{bests or '<div class="eb">이번 주 베스트 문장을 기다려요!</div>'}</div>
  <div class="moti"><div class="label">WEEK {wn} 들어가며</div><div class="txt">{e(data.get("moti",""))}</div></div>
  <div class="foot">@youbuddy_day · 유버디 비즈니스 영어 챌린지 {e(cohort)}</div>
</div></body></html>"""
    HTML(string=doc).write_pdf("/tmp/_monday.pdf")
    import fitz
    d=fitz.open("/tmp/_monday.pdf"); p=d[0]
    p.get_pixmap(matrix=fitz.Matrix(1080/p.rect.width,1080/p.rect.width)).save(out)
    print("saved:",out)

if __name__=="__main__":
    data=json.load(open(sys.argv[1],encoding="utf-8"))
    build(data, sys.argv[2])
