#!/usr/bin/env python3
"""
data.json 으로 수료식 카드뉴스 7장(베이직 3 + 프리미엄 3 + 축하 1)을 1080x1080 PNG 로 렌더.
사용: python build_cards.py --data data.json --out ./cards
필요: pip install weasyprint pymupdf --break-system-packages
      한글 폰트 Noto Sans CJK KR + 시스템 fontconfig (대부분 리눅스에 기본 내장).
규칙: em-dash(긴 줄표, U+2014) 금지 (스크립트가 자동 검증). 이모지 폰트가 없으므로 아이콘은 심볼(★ / ♥) 사용.
발송: 베이직방 B_1 -> B_2 -> B_3 -> 축하 / 프리미엄방 P_1 -> P_2 -> P_3 -> 축하
"""
import argparse, html, os, json
from weasyprint import HTML
import fitz

def e(s): return html.escape(str(s))
HEART = '<span class="hh">&#9829;</span>'
def joinnames(lst): return e(" · ".join(lst))

CSS = """
@page { size: 1080px 1080px; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans CJK KR', sans-serif; }
.card { width:1080px; height:1080px; overflow:hidden; color:#F3EADB; padding:74px 80px;
  background: radial-gradient(ellipse 58% 42% at 84% 10%, rgba(242,118,75,0.30) 0%, transparent 60%),
    radial-gradient(ellipse 66% 46% at 10% 94%, rgba(124,92,255,0.26) 0%, transparent 60%),
    linear-gradient(152deg,#201634 0%,#362646 55%,#45325E 100%); display:flex; flex-direction:column; }
.brand { display:flex; align-items:center; gap:11px; font-size:19px; color:#C8BBD6; font-weight:600; }
.dot { width:9px; height:9px; border-radius:50%; background:#F2764B; display:inline-block; }
.kick { font-size:21px; font-weight:800; letter-spacing:0.2em; color:#FCE8B2; margin-top:20px; }
.h1 { font-size:46px; font-weight:800; line-height:1.18; letter-spacing:-0.02em; color:#fff; margin-top:10px; }
.sub { font-size:20px; color:#D8CCE8; margin-top:14px; font-weight:600; line-height:1.55; }
.stats { margin-top:22px; display:flex; gap:11px; }
.stat { flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); border-radius:18px; padding:16px 6px; text-align:center; }
.stat .n { font-size:36px; font-weight:800; color:#fff; line-height:1; }
.stat .n small { font-size:17px; color:#FCE8B2; font-weight:700; }
.stat .c { font-size:14px; color:#C8BBD6; margin-top:7px; font-weight:600; }
.chartbox { margin-top:26px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:20px; padding:22px 24px; }
.chartbox .ct { font-size:18px; font-weight:800; color:#FCE8B2; }
.hbars { margin-top:16px; display:flex; flex-direction:column; gap:16px; }
.hb .l { font-size:19px; font-weight:700; color:#EDE4F5; display:flex; justify-content:space-between; }
.hb .l b { color:#FCE8B2; }
.hb .track { height:20px; background:rgba(255,255,255,0.09); border-radius:99px; margin-top:7px; overflow:hidden; }
.hb .fill { height:100%; background:#FBA24F; border-radius:99px; }
.awards { margin-top:22px; display:flex; flex-direction:column; gap:14px; }
.aw .lab { font-size:23px; font-weight:800; color:#FCE8B2; }
.aw .lab .st { color:#F2764B; margin-right:8px; }
.aw .nm { font-size:19px; color:#EDE4F5; line-height:1.45; margin-top:4px; }
.aw .nm b { color:#F7A07E; font-weight:800; }
.big-awards .aw .lab { font-size:26px; }
.big-awards .aw .nm { font-size:21px; line-height:1.45; margin-top:4px; }
.rollwrap { margin-top:24px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:20px; padding:22px 24px; }
.rollwrap .t { font-size:18px; font-weight:800; color:#FCE8B2; }
.rollwrap .t .hh { color:#F7A07E; }
.roll { font-size:21px; color:#E7DCF2; line-height:1.75; margin-top:10px; word-break:keep-all; }
.spacer { flex:1 1 auto; }
.foot { font-size:22px; color:#F3D9C8; font-weight:700; margin-top:20px; line-height:1.6; }
.foot .hh { color:#F7A07E; }
.msgbox { margin-top:22px; background:rgba(247,160,126,0.12); border:1px solid rgba(247,160,126,0.3); border-radius:20px; padding:26px 28px; font-size:24px; line-height:1.6; color:#F6E7DB; font-weight:600; }
.msgbox b { color:#FCE8B2; }
.big { font-size:52px; font-weight:800; line-height:1.25; letter-spacing:-0.02em; color:#fff; }
.big .hl { color:#F7A07E; }
.handle { font-size:16px; color:#9E90B8; font-weight:600; margin-top:10px; }
"""

def stat(n, u, c): return '<div class="stat"><div class="n">%s<small>%s</small></div><div class="c">%s</div></div>' % (n, e(u), e(c))
def aw(lab, names_html): return '<div class="aw"><div class="lab"><span class="st">&#9733;</span>%s</div><div class="nm">%s</div></div>' % (e(lab), names_html)
def hbars(title, rows):  # rows: (label, value, pct)
    body = "".join('<div class="hb"><div class="l"><span>%s</span><b>%s</b></div><div class="track"><div class="fill" style="width:%s%%"></div></div></div>' % (e(l), e(v), p) for l, v, p in rows)
    return '<div class="chartbox"><div class="ct">%s</div><div class="hbars">%s</div></div>' % (e(title), body)

def render_cards(data):
    C = e(data["cohort"]); B = data["basic"]; P = data["premium"]; BS = data["best_sentence"]
    brand = '<div class="brand"><span class="dot"></span>YOUBUDDY %s · 유버디 챌린지</div>' % C
    ba = B["awards"]; pa = P["awards"]
    hmax = max([v for _, v in B["hist"]] + [1])
    hist_rows = [(k, "%d명" % v, round(v / hmax * 100)) for k, v in B["hist"]]
    act_rows = [(l, v, 100) for l, v in P["activities"]]
    b_ebtop = " · ".join("%s %d개" % (n, c) for n, c in ba["earlybird_top"])
    b_eb = '<b>%s</b> · 아침 8시 전 인증, 제일 많이 모았어요' % e(b_ebtop) if b_ebtop else "&nbsp;"
    b_tz = (joinnames(ba["timezone"]) + " · 시차 속에서도 끝까지") if ba["timezone"] else "&nbsp;"
    b_nc = (joinnames(ba["near_complete"]) + " · 18~19일, 완주선 넘었어요") if ba["near_complete"] else "&nbsp;"
    b_best = '<b>%s</b> · Day %d "%s"<br><span style="font-size:0.86em;color:#D8CCE8;">%s</span>' % (e(BS["name"]), BS["day"], e(BS["word"].lower()), e(BS["sentence"]))
    p_eb = '<b>%s</b> · 스탬프 %d개, 5개 이상 약속대로 호명!' % (e(pa["earlybird_award"][0]), pa["earlybird_top"][0][1]) if pa["earlybird_award"] else "&nbsp;"
    p_glob = (joinnames(pa["global"] if "global" in pa else pa["timezone"]) + " · 시차 속에서도 끝까지 함께") if pa.get("timezone") else "함께한 모두 · 각자 자리에서"
    p_writer = joinnames(pa["full_writer"]) + " · 20일 내내 매일 3문장, 총 60문장" if pa["full_writer"] else "&nbsp;"
    b_writer = joinnames(ba["full_writer"]) + " · 20일 x 3문장 = 60문장 전부" if ba["full_writer"] else "&nbsp;"

    cards = []
    cards.append(("B_1_시작",
      brand + '<div class="kick">GRADUATION · 베이직</div>'
      + '<div class="h1">베이직 %d명,<br>4주 완주 리포트</div>' % B["members"]
      + '<div class="stats">%s%s%s%s</div>' % (stat(B["members"],"명","함께"), stat(B["verif"],"번","인증"), stat(B["completers"],"명","완주 (18일+)"), stat(B["perfect"],"명","개근 (20일)"))
      + '<div class="sub" style="margin-top:30px;font-size:25px;">4주 동안 문장 <b style="color:#FCE8B2">%s개</b>를 직접 쓰고 인증했어요.<br>지금부터 한 분 한 분, 성과를 짚어드릴게요 %s</div>' % (format(B["posts"], ","), HEART)
      + '<div class="sub" style="font-size:19px;color:#C8BBD6;">파이널 테스트까지 마친 수료 확정 %d명 · 파이널은 마감 없이 열려 있어요</div>' % B["certified"]
      + '<div class="spacer"></div><div class="handle">@youbuddy_day</div>'))
    cards.append(("B_2_성과1",
      brand + '<div class="kick">성과 &#9312;</div><div class="h1">베이직, 이렇게 해냈어요</div>'
      + hbars("인증 일수 분포 · %d명" % B["members"], hist_rows)
      + '<div class="awards">' + aw("개근왕 (20일 만점)", joinnames(ba["perfect_attend"])) + aw("얼리버드 스탬프", b_eb) + '</div>'
      + '<div class="spacer"></div><div class="handle">@youbuddy_day</div>'))
    cards.append(("B_3_성과2",
      brand + '<div class="kick">성과 &#9313;</div>'
      + '<div class="awards big-awards">' + aw("베스트 문장", b_best) + aw("정시 장인 (지각 0)", joinnames(ba["on_time"])) + aw("완주 버디", b_nc) + aw("시차 불사왕", b_tz) + '</div>'
      + '<div class="rollwrap"><div class="t"><span class="hh">&#9829;</span> 함께한 %d명, 한 명도 빠짐없이</div><div class="roll">%s</div></div>' % (B["members"], joinnames(B["roll"]))
      + '<div class="spacer"></div><div class="foot">%d명 모두, 4주 진짜 고생 많았어요 %s</div><div class="handle">@youbuddy_day</div>' % (B["members"], HEART)))
    cards.append(("P_1_시작",
      brand + '<div class="kick">GRADUATION · 프리미엄</div>'
      + '<div class="h1">프리미엄 %d인,<br>4주 완주 리포트</div>' % P["members"]
      + '<div class="stats">%s%s%s%s</div>' % (stat(P["verif"],"번","인증"), stat(P["completers"],"명","완주 (18일+)"), stat(P["perfect"],"명","개근 (20일)"), stat(4,"주","미팅 · 발표"))
      + '<div class="sub" style="margin-top:30px;font-size:25px;">매주 미팅과 발표까지, 진짜 실전으로 달린 4주.<br>문장 <b style="color:#FCE8B2">%s개</b>를 직접 쓰고 입 밖에 냈어요 %s</div>' % (P["posts"], HEART)
      + '<div class="sub" style="font-size:19px;color:#C8BBD6;">파이널 테스트까지 마친 수료 확정 %d명 · 파이널은 마감 없이 열려 있어요</div>' % P["certified"]
      + '<div class="spacer"></div><div class="handle">@youbuddy_day</div>'))
    cards.append(("P_2_성과1",
      brand + '<div class="kick">성과 &#9312;</div><div class="h1">프리미엄, 발표까지 해냈어요</div>'
      + hbars("프리미엄만의 4주 (실전)", act_rows)
      + '<div class="awards">' + aw("얼리버드 어워드 (스탬프 5개+)", p_eb) + aw("개근왕 (20일 만점)", joinnames(pa["perfect_attend"])) + '</div>'
      + '<div class="spacer"></div><div class="handle">@youbuddy_day</div>'))
    cards.append(("P_3_성과2",
      brand + '<div class="kick">성과 &#9313;</div>'
      + '<div class="awards big-awards">' + aw("정시 장인 (지각 0)", joinnames(pa["on_time"])) + aw("60문장 완성", p_writer) + aw("글로벌 참여상", p_glob) + aw("실전 파이터", "매주 미팅 + 롤플레잉 + 개인 발표 + 피드백까지") + '</div>'
      + '<div class="rollwrap"><div class="t"><span class="hh">&#9829;</span> 함께한 %d명</div><div class="roll">%s</div></div>' % (P["members"], joinnames(P["roll"]))
      + '<div class="spacer"></div><div class="foot">회의에서 바로 쓰는 영어까지. 정말 대단했어요 %s</div><div class="handle">@youbuddy_day</div>' % HEART))
    cards.append(("_축하",
      brand + '<div class="kick">CONGRATULATIONS</div><div class="spacer"></div>'
      + '<div class="big">여러분은 4주간의<br><span class="hl">루틴</span>을 만드셨어요</div>'
      + '<div class="sub">축하드려요! 끝까지 함께해주셔서 감사합니다 %s</div>' % HEART
      + '<div class="msgbox">이번 기수에 배운 표현은 이제 <b>장기기억으로 저장</b>될 거예요.<br>좀 흐려진다 싶으면, 웹페이지로 돌아와서 한 번씩 테스트 쳐주세요 :)<br><span style="font-size:0.85em;color:#D8CCE8;">18일 이상 학습 + 파이널 응시면 4주 단어집 PDF. 마감 없으니 늦어도 괜찮아요.</span></div>'
      + '<div class="spacer"></div><div class="handle">@youbuddy_day · 조금 먼저 배우고 나누는 사람들</div>'))
    return [(name, '<div class="card">' + inner + '</div>') for name, inner in cards]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data.json")
    ap.add_argument("--out", default="./cards")
    a = ap.parse_args()
    data = json.load(open(a.data, encoding="utf-8"))
    pages = render_cards(data)
    os.makedirs(a.out, exist_ok=True)
    doc = "<html><head><meta charset='utf-8'><style>" + CSS + "</style></head><body>" + "".join(x[1] for x in pages) + "</body></html>"
    pdf = os.path.join(a.out, "cards.pdf")
    HTML(string=doc).write_pdf(pdf)
    d = fitz.open(pdf)
    if "".join(p.get_text() for p in d).count("\u2014"):
        raise SystemExit("em-dash 발견! 문구에서 제거하세요.")
    for i, p in enumerate(d):
        s = 1080 / p.rect.width
        p.get_pixmap(matrix=fitz.Matrix(s, s)).save(os.path.join(a.out, "수료식%s.png" % pages[i][0]))
    print("완료: %s 에 7장 PNG + cards.pdf (em-dash 0)" % a.out)
    print("발송 · 베이직방: B_1 -> B_2 -> B_3 -> 축하 / 프리미엄방: P_1 -> P_2 -> P_3 -> 축하")

if __name__ == "__main__":
    main()
