import base64
b=lambda p:'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
CSS="""*{margin:0;padding:0;box-sizing:border-box}body{width:1080px;height:1350px;font-family:Pretendard,'Noto Sans CJK KR',sans-serif;overflow:hidden}
.c{width:1080px;height:1350px;padding:72px 76px;display:flex;flex-direction:column}
.light{background:#FBF7F0;color:#2B1A21}.dark{background:#2B1A21;color:#FBF7F0}
.top{display:flex;justify-content:space-between;font-size:22px;font-weight:700;letter-spacing:.14em}.light .top{color:#7B3B4E}.dark .top{color:#D9A3B4}
.rule{height:3px;margin-top:20px}.light .rule{background:#2B1A21}.dark .rule{background:#7B3B4E}
.k{margin-top:44px;font-size:28px;font-weight:800}.light .k{color:#7B3B4E}.dark .k{color:#D9A3B4}
.h{margin-top:12px;font-size:64px;font-weight:900;letter-spacing:-2px;line-height:1.16}
.p{margin-top:18px;font-size:29px;font-weight:600;line-height:1.5}.light .p{color:#6B5F58}.dark .p{color:#EBD5DC}
.sp{flex:1}.ft{font-size:24px;font-weight:700}.light .ft{color:#7B3B4E}.dark .ft{color:#D9A3B4}
"""
def page(cls,body,foot,n):
    return f"<!doctype html><meta charset=utf-8><style>{CSS}</style><div class='c {cls}'><div class=top><span>10기 단어집 PDF 활용법</span><span>{n} / 3</span></div><div class=rule></div>{body}<div class=sp></div><div class=ft>{foot}</div></div>"

# 1. 구성
items=[('th0.png','표지','4주 60개 표현 + 유의어 120개'),('th6.png','Day 1~20','뜻 / 예문 / 이럴 때 써요'),('th21.png','전체 인덱스','180개 한눈에 + 약점 테스트 QR'),('th23.png','셀프 테스트 A / B','영어 보고 뜻 / 뜻 보고 영어')]
g=''.join(f"<div style='border:3px solid #2B1A21;background:#fff;display:flex;flex-direction:column'><img src='{b(p)}' style='width:100%;height:270px;object-fit:cover;object-position:top;border-bottom:3px solid #2B1A21'><div style='padding:18px 22px'><div style='font-size:32px;font-weight:900'>{t}</div><div style='margin-top:6px;font-size:23px;font-weight:600;color:#6B5F58'>{d}</div></div></div>" for p,t,d in items)
A=page('light',f"<div class=k>먼저, 안에 뭐가 있냐면</div><div class=h>26쪽 단어집,<br>이렇게 생겼어요</div><div style='margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:22px'>{g}</div>","앱 수료 리포트에서 받을 수 있어요",1)

# 2. 망각곡선
W,H=928,440;x0,y0=70,30;pw,ph=W-100,H-90
days=[0,1,3,7,14,30]
def X(d): import math; return x0+pw*(math.log(d+1)/math.log(31))
import math
path=[];path2=[]
for i in range(0,301):
    t=i/10; path.append(f"{X(t):.1f},{y0+ph*(1-math.exp(-t/0.9)*0.92-0.08):.1f}")
# review curve: resets at each review with slower decay
seg=[];S=[0.9,2.2,5,10,22,60]
for j,d0 in enumerate(days):
    d1=days[j+1] if j+1<len(days) else 30
    pts=[]
    for i in range(0,41):
        t=d0+(d1-d0)*i/40; v=math.exp(-(t-d0)/S[j]); pts.append(f"{X(t):.1f},{y0+ph*(1-(0.08+0.92*(0.55+0.45*v) if j>0 else 0.08+0.92*v))+0:.1f}")
    seg.append(pts)
review=' '.join(' '.join(p) for p in seg)
ticks=''.join(f"<line x1='{X(d):.1f}' y1='{y0}' x2='{X(d):.1f}' y2='{y0+ph}' stroke='#4A2F39' stroke-width='2'/><text x='{X(d):.1f}' y='{y0+ph+40}' fill='#EBD5DC' font-size='24' font-weight='800' text-anchor='middle'>{'받은 날' if d==0 else str(d)+'일'}</text>" for d in days)
dots=''.join(f"<rect x='{X(d)-9:.1f}' y='{y0-9}' width='18' height='18' fill='#D9A3B4'/>" for d in days)
svg=f"<svg width='{W}' height='{H}' viewBox='0 0 {W} {H}'>{ticks}<polyline points='{' '.join(path)}' fill='none' stroke='#8E6B78' stroke-width='5' stroke-dasharray='12 10'/><polyline points='{review}' fill='none' stroke='#F3E3E8' stroke-width='6'/>{dots}<text x='{x0}' y='{y0-2}' fill='#CDB7BE' font-size='20' font-weight='700' text-anchor='end' dx='-12' dy='8'>기억</text></svg>"
leg="<div style='margin-top:18px;display:flex;gap:34px;font-size:24px;font-weight:700;color:#EBD5DC'><span><b style='display:inline-block;width:40px;height:6px;background:#F3E3E8;vertical-align:middle;margin-right:10px'></b>잊을 만할 때 다시 본 경우</span><span><b style='display:inline-block;width:40px;height:0;border-top:5px dashed #8E6B78;vertical-align:middle;margin-right:10px'></b>한 번 보고 끝낸 경우</span></div>"
chips=''.join(f"<div style='border:3px solid #7B3B4E;background:#35212A;padding:16px 0;text-align:center'><div style='font-size:34px;font-weight:900'>{'오늘' if d==0 else str(d)+'일 뒤'}</div></div>" for d in days)
B=page('dark',f"<div class=k>망각곡선</div><div class=h>배운 건 하루만 지나도<br>흐려져요</div><div class=p>잊을 만할 때 한 번씩 다시 꺼내면 훨씬 오래 남아요.</div><div style='margin-top:34px'>{svg}</div>{leg}<div style='margin-top:40px;font-size:28px;font-weight:800;color:#D9A3B4'>달력에 이 6번만 적어두세요 (한 번에 10분)</div><div style='margin-top:16px;display:grid;grid-template-columns:repeat(6,1fr);gap:12px'>{chips}</div>","그래프는 이해를 돕기 위한 그림이에요",2)

# 3. AI 복습법
chat=f"""<div style='border:3px solid #2B1A21;background:#fff;padding:20px 24px;display:flex;flex-direction:column;gap:12px'>
<div style='display:flex;gap:12px;align-items:center'><img src='{b('th0.png')}' style='width:62px;height:88px;object-fit:cover;object-position:top;border:2px solid #2B1A21'><div style='font-size:22px;font-weight:700;color:#6B5F58'>유버디_10기_4주단어집.pdf</div></div>
<div style='align-self:flex-end;max-width:84%;background:#7B3B4E;color:#fff;padding:14px 18px;font-size:22px;font-weight:600;line-height:1.5'>첨부한 PDF는 내가 4주 동안 배운 비즈니스 영어 표현 60개야. 망각곡선에 맞춰서 복습하고 싶어...</div>
<div style='max-width:86%;background:#F1E1E6;padding:14px 18px;font-size:22px;font-weight:600;line-height:1.5'>좋아요! 첫 번째 상황이에요.<br>"잘 될지 모르겠지만 일단 해볼게요"<br>영어로 뭐라고 할까요?</div>
<div style='align-self:flex-end;max-width:70%;background:#7B3B4E;color:#fff;padding:14px 18px;font-size:22px;font-weight:600'>Take a stab at it?</div></div>"""
step=lambda n,t,d: f"<div style='display:flex;gap:20px;align-items:flex-start'><div style='flex:0 0 54px;height:54px;background:#7B3B4E;color:#fff;font-size:30px;font-weight:900;display:flex;align-items:center;justify-content:center'>{n}</div><div><div style='font-size:34px;font-weight:900;letter-spacing:-.5px'>{t}</div><div style='margin-top:4px;font-size:24px;font-weight:600;color:#6B5F58'>{d}</div></div></div>"
C=page('light',f"<div class=k>AI로 10분 복습</div><div class=h style='font-size:58px'>PDF 올리고,<br>프롬프트 붙여넣기</div><div style='margin-top:26px;display:flex;flex-direction:column;gap:18px'>{step(1,'ChatGPT나 Claude에 PDF 올리기','파일 첨부 버튼으로 단어집을 그대로 올려요')}{step(2,'공지의 프롬프트 붙여넣기','[직무], [회의/메일/슬랙] 칸만 내 걸로 바꿔요')}{chat}{step(3,'다음엔 \"복습 이어서\" 한 마디','지난번에 틀린 표현부터 다시 물어봐요')}</div><div style='margin-top:22px;display:flex;gap:20px;align-items:center;border-top:3px solid #2B1A21;padding-top:18px'><img src='{b('qr.png')}' style='width:96px;height:96px;border:2px solid #2B1A21;background:#fff'><div style='font-size:25px;font-weight:700;line-height:1.5'>앱으로도 할 수 있어요<br><span style='color:#6B5F58;font-weight:600'>PDF 인덱스 쪽 QR을 찍으면 약점 단어 테스트가 열려요</span></div></div>","프롬프트 전문은 단톡 공지에 있어요",3)
import os
os.makedirs('guide',exist_ok=True)
for i,h in enumerate([A,B,C],1):
    assert '—' not in h and '–' not in h
    open(f'guide/g{i}.html','w').write(h)
