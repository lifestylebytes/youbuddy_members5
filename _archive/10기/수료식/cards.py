import json, html, os, statistics, collections, subprocess
M=json.load(open('members.json'))
e=html.escape
def by(key,n=3,flt=None):
    L=[m for m in M if (flt(m) if flt else True)]
    return sorted(L,key=key,reverse=True)[:n]
tot=dict(verif=sum(m['days'] for m in M),sent=sum(m['nsent'] for m in M),chars=sum(m['chars'] for m in M),ai=sum(m['ai'] for m in M))
order=sorted(M,key=lambda m:(-m['days'],m['late']))
comp=[m for m in order if m['days']>=18]
allclear=[m for m in order if m['days']>=20]
ontime=[m for m in order if m['days']-m['late']>=18]
def early(m): return sum(1 for x in m['mins'] if 300<=x<600)
def night(m): return sum(1 for x in m['mins'] if x>=1320 or x<180)
KST=lambda m: m['tz']==540
eb=by(early,3,KST); ow=by(lambda m:(night(m)/max(1,len(m['mins'])),night(m)),3,lambda m:KST(m) and len(m['mins'])>=10)
wr=by(lambda m:m['chars'],3); ai=by(lambda m:m['ai'],3)
quiz=[m for m in order if m['nq']>=18 and m['perfectq']>=m['nq']-1]
coll=by(lambda m:m['syn']+m['bm'],3)
tz=[m for m in order if m['tz'] not in (540,None)]
MAIN={}
for wk in json.load(open('/home/claude/youbuddy_members5/_archive/10기/단어/10기_단어_60_full.json')):
    for d in wk['days']:
        for w in d['words']: MAIN[w['en'].strip().lower()]=w['en'].strip()
fw=collections.Counter()
for m in M:
    for k,v in m['vs'].items():
        if k.lower() in MAIN and isinstance(v,dict) and v.get('firstResult')=='wrong': fw[MAIN[k.lower()]]+=1
top3=fw.most_common(3)
cap=lambda s: s[0].upper()+s[1:]
N=lambda L: ' / '.join(e(m['nick']) for m in L)
summary=dict(tot=tot,comp=[m['nick'] for m in comp],allclear=[m['nick'] for m in allclear],ontime=[m['nick'] for m in ontime],
 eb=[(m['nick'],early(m)) for m in eb],ow=[(m['nick'],night(m),len(m['mins'])) for m in ow],wr=[(m['nick'],m['chars']) for m in wr],ai=[(m['nick'],m['ai']) for m in ai],
 quiz=[(m['nick'],m['perfectq'],m['nq']) for m in quiz],coll=[(m['nick'],m['syn']+m['bm']) for m in coll],tz=[m['nick'] for m in tz],top3=top3,roll=[m['nick'] for m in order],
 final=[m['nick'] for m in M if m['final']],near=[(m['nick'],m['days']) for m in order if 15<=m['days']<18])
json.dump(summary,open('summary.json','w'),ensure_ascii=False,indent=1)

CSS="""*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1080px;font-family:Pretendard,'Noto Sans CJK KR',sans-serif;overflow:hidden}
.c{width:1080px;height:1080px;padding:76px 80px 70px;display:flex;flex-direction:column;position:relative}
.dark{background:#2B1A21;color:#FBF7F0}.light{background:#FBF7F0;color:#2B1A21}.wine{background:#7B3B4E;color:#FBF7F0}
.top{display:flex;justify-content:space-between;align-items:center;font-size:22px;font-weight:700;letter-spacing:.14em}
.dark .top,.wine .top{color:#D9A3B4}.light .top{color:#7B3B4E}
.rule{height:3px;margin-top:22px}.dark .rule{background:#7B3B4E}.light .rule{background:#2B1A21}.wine .rule{background:#FBF7F0}
.k{margin-top:54px;font-size:30px;font-weight:800;letter-spacing:.04em}.dark .k,.wine .k{color:#D9A3B4}.light .k{color:#7B3B4E}
.h{margin-top:14px;font-size:76px;font-weight:900;line-height:1.14;letter-spacing:-2.5px;word-break:keep-all}
.h.s{font-size:62px}
.p{margin-top:24px;font-size:31px;font-weight:600;line-height:1.5;word-break:keep-all}.dark .p{color:#EBD5DC}.light .p{color:#6B5F58}.wine .p{color:#F3E3E8}
.sp{flex:1}
.names{margin-top:40px;font-size:44px;font-weight:800;line-height:1.5;letter-spacing:-.5px;word-break:keep-all}
.names.m{font-size:38px}.names.x{font-size:33px;line-height:1.6}
.box{margin-top:34px;padding:36px 38px;border:3px solid}.dark .box{border-color:#7B3B4E;background:#35212A}.light .box{border-color:#2B1A21;background:#fff}
.box .l{font-size:27px;font-weight:800}.dark .box .l{color:#D9A3B4}.light .box .l{color:#7B3B4E}
.box .n{margin-top:10px;font-size:40px;font-weight:900;letter-spacing:-.5px;line-height:1.35;word-break:keep-all}
.box .d{margin-top:8px;font-size:25px;font-weight:600}.dark .box .d{color:#CDB7BE}.light .box .d{color:#6B5F58}
.grid{margin-top:44px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
.st{padding:34px 34px 30px;border:3px solid #2B1A21;background:#fff}.st .n{font-size:86px;font-weight:900;letter-spacing:-3px;line-height:1;color:#7B3B4E}.st .n small{font-size:34px;letter-spacing:0;margin-left:6px;color:#2B1A21}
.st .l{margin-top:14px;font-size:27px;font-weight:700;color:#6B5F58}
.ft{font-size:25px;font-weight:700;letter-spacing:.02em}.dark .ft,.wine .ft{color:#D9A3B4}.light .ft{color:#7B3B4E}
.row{display:flex;align-items:baseline;gap:26px;padding:26px 0;border-bottom:2px solid #7B3B4E}.row .r{font-size:44px;font-weight:900;color:#D9A3B4;width:60px}.row .w{font-size:44px;line-height:1.2;font-weight:900;letter-spacing:-1px;flex:1}.row .c2{font-size:26px;font-weight:700;color:#CDB7BE}
.gift{display:flex;gap:24px;align-items:flex-start;padding:36px 0;border-bottom:2px solid rgba(251,247,240,.35)}.gift .no{font-size:30px;font-weight:900;width:50px;color:#EBD5DC}.gift .t{font-size:46px;font-weight:900;letter-spacing:-.5px}.gift .d{margin-top:10px;font-size:28px;font-weight:600;color:#F3E3E8}
"""
def card(i,cls,body,foot=''):
    return f"<!doctype html><meta charset=utf-8><style>{CSS}</style><div class='c {cls}'><div class=top><span>YOUBUDDY CHALLENGE 10</span><span>{i:02d} / 10</span></div><div class=rule></div>{body}<div class=sp></div><div class=ft>{foot}</div></div>"
f=lambda n: f"{n:,}"
C=[]
C.append(card(1,'wine',"<div class=k>유비챌 10기 수료식</div><div class=h style='font-size:124px;margin-top:40px'>20일,<br>여기까지<br>같이 왔어요</div><div class=p>실무 표현 60개를 내 업무 문장으로.<br>오늘은 4주 동안 각자 빛났던 순간을<br>한 분씩 불러드리는 날이에요.</div>","2026.10.19 - 11.13"))
C.append(card(2,'light',f"<div class=k>숫자로 본 10기</div><div class='h s'>우리가 4주 동안<br>쌓은 것</div><div class=grid><div class=st><div class=n>{f(tot['verif'])}<small>번</small></div><div class=l>하루 인증</div></div><div class=st><div class=n>{f(tot['sent'])}<small>개</small></div><div class=l>직접 쓴 내 업무 문장</div></div><div class=st><div class=n>{f(tot['ai'])}<small>번</small></div><div class=l>AI 첨삭으로 다시 고친 횟수</div></div><div class=st><div class=n>{f(tot['chars'])}<small>자</small></div><div class=l>영어로 쓴 글자 수</div></div></div>","한 문장씩 쌓은 게 이만큼이에요"))
C.append(card(3,'dark',f"<div class=k>완주상</div><div class='h s'>18일 넘게,<br>끝까지 해낸 분들</div><div class=names style='font-size:58px;line-height:1.55;margin-top:56px'>{N(comp)}</div>","파이널 테스트까지 보면 수료 선물이 전부 열려요"))
C.append(card(4,'light',f"<div class=k>정시 장인상</div><div class='h s'>18일을 전부<br>자정 전에 끝낸 분들</div><div class='names m'>{N(ontime)}</div><div class=box><div class=l>20일 올클리어</div><div class=n>{N(allclear)}</div></div>","하루도 안 밀린다는 것, 해본 사람은 알아요"))
C.append(card(5,'dark',f"<div class=k>얼리버드상 / 막차 장인상</div><div class='h s'>하루의 시작과 끝을<br>영어로 연 분들</div><div class=box><div class=l>얼리버드상 (아침 10시 전 인증)</div><div class=n>{' / '.join(f'{e(n)} {c}번' for n,c in summary['eb'])}</div></div><div class=box><div class=l>막차 장인상 (밤 10시 이후 인증)</div><div class=n>{' / '.join(f'{e(n)} {c}번' for n,c,_ in summary['ow'])}</div></div>","언제 하든, 한 날이 이긴 날이에요"))
C.append(card(6,'light',f"<div class=k>예문 장인상 / AI 단짝상</div><div class='h s'>문장에 진심이었던<br>분들</div><div class=box><div class=l>예문 장인상 (가장 많이 쓴 분)</div><div class=n>{' / '.join(f'{e(n)} {f(c)}자' for n,c in summary['wr'])}</div></div><div class=box><div class=l>AI 단짝상 (가장 많이 다시 고친 분)</div><div class=n>{' / '.join(f'{e(n)} {c}번' for n,c in summary['ai'])}</div></div>","고쳐 쓴 문장이 제일 오래 남아요"))
C.append(card(7,'dark',f"<div class=k>퀴즈 만점왕 / 수집왕 / 시차 불사상</div><div class='h s'>각자의 방식으로<br>빛난 분들</div><div class=box><div class=l>퀴즈 만점왕 (데일리 퀴즈 거의 전부 만점)</div><div class=n>{N(quiz)}</div></div><div class=box><div class=l>수집왕 (표현, 유의어 저장 최다)</div><div class=n>{' / '.join(f'{e(n)} {c}개' for n,c in summary['coll'])}</div></div><div class=box><div class=l>시차 불사상 (한국 밖에서 함께)</div><div class=n>{N(tz)}</div></div>",""))
rows=''.join(f"<div class=row><div class=r>{i+1}</div><div style='flex:1;min-width:0'><div class=w>{e(cap(w))}</div><div class=c2 style='margin-top:6px'>첫 시도에 {c}명 오답</div></div></div>" for i,(w,c) in enumerate(top3))
C.append(card(8,'dark',f"<div class=k>보너스</div><div class='h s'>10기가 가장 많이<br>헷갈린 표현 TOP 3</div><div class=p style='margin-top:14px'>60개 메인 표현 기준</div><div style='margin-top:40px'>{rows}</div><div class=p>틀렸던 표현이 제일 오래 기억나요.<br>오늘 이 세 개만 다시 보고 가세요.</div>",""))
C.append(card(9,'light',f"<div class=k>10기, 한 분도 빠짐없이</div><div class='h s'>4주를 함께한<br>모든 이름</div><div class=names style='font-size:47px;line-height:1.62;margin-top:50px'>{N(order)}</div>","속도는 달라도, 같이 걸은 4주였어요"))
gifts=[("단어집 PDF","18일 이상 + 파이널 응시 (지각 포함)"),("1일1비 1개월 정기권","18일 이상 + 파이널 응시. 이용 중이면 1개월 연장"),("나만의 약점 복습 노트","정시 18일 이상 + 파이널 응시")]
g=''.join(f"<div class=gift><div class=no>{i+1}</div><div><div class=t>{t}</div><div class=d>{d}</div></div></div>" for i,(t,d) in enumerate(gifts))
C.append(card(10,'wine',f"<div class=k>수료를 축하합니다</div><div class='h s'>받아가실 선물,<br>이렇게 열려요</div><div style='margin-top:34px'>{g}</div>","앱 수료 리포트에서 바로 받을 수 있어요"))
os.makedirs('html',exist_ok=True)
for i,h in enumerate(C,1):
    assert '—' not in h and '–' not in h and '가비' not in h
    open(f'html/c{i:02d}.html','w').write(h)
print(json.dumps(summary,ensure_ascii=False))
