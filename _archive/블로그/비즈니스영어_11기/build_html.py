import re, html
src=open('원고.md',encoding='utf-8').read()
body=src.split('## 본문',1)[1]
title=re.search(r'## 제목\n\n(.+)\n',src).group(1).strip()
FONT="font-family:'나눔바른고딕',NanumBarunGothic,sans-serif;"
P=f"style=\"{FONT}font-size:13pt;line-height:1.9;text-align:center;margin:0;\""
ALTS={'01':'비즈니스 영어 하루 20분 4주 루틴','02':'비즈니스 영어 공부 방법','03':'비즈니스 영어 챌린지 후기','04':'비즈니스 영어 챌린지 후기 2','05':'비즈니스 영어 챌린지 11기 신청','06':'비즈니스 영어 앱 오늘의 학습','07':'비즈니스 영어 내 업무 문장 쓰기','08':'비즈니스 영어 단어 시험 인증','09':'비즈니스 영어 AI 첨삭','10':'비즈니스 영어 챌린지 성장 리포트','11':'비즈니스 영어 단어집 PDF'}
def inline(t):
    t=html.escape(t,quote=False); return re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',t)
out=[]; buf=[]
def blank(): out.append(f'<p {P}>&nbsp;</p>')
def flush():
    global buf
    if buf: out.append(f'<p {P}>'+'<br>'.join(buf)+'</p>'); blank(); buf=[]
lines=body.strip('\n').split('\n'); i=0
while i<len(lines):
    l=lines[i].rstrip()
    if not l: flush(); i+=1; continue
    if l.startswith('[사진]'):
        flush(); n=l.split(' ',1)[1].strip()[:2]
        out.append(f'<p {P}><img src="https://youbuddy.co.kr/blog/biz-english/business-english-{n}{"b" if n=="11" else ""}.png" alt="{ALTS[n]}" style="width:100%;max-width:700px;height:auto;"></p>'); blank(); i+=1; continue
    if l.startswith('### '):
        flush(); out.append(f'<blockquote style="border-left:4px solid #333;margin:10px 0;padding:4px 14px;"><p style="{FONT}font-size:16pt;font-weight:bold;margin:0;text-align:left;">{inline(l[4:])}</p></blockquote>'); blank(); i+=1; continue
    if l.startswith('|'):
        flush(); rows=[]
        while i<len(lines) and lines[i].startswith('|'):
            cells=[c.strip() for c in lines[i].strip('|').split('|')]
            if not set(''.join(cells))<=set('-: '): rows.append(cells)
            i+=1
        t=f'<table style="border-collapse:collapse;margin:0 auto;{FONT}font-size:12pt;">'
        for r,cells in enumerate(rows):
            tag='th' if r==0 else 'td'
            t+='<tr>'+''.join(f'<{tag} style="border:1px solid #ccc;padding:8px 14px;{"background:#f3f3f3;font-weight:bold;" if r==0 or k==0 else ""}">{inline(c)}</{tag}>' for k,c in enumerate(cells))+'</tr>'
        out.append(t+'</table>'); blank(); continue
    if l.startswith('LINK::'):
        flush(); url=l[6:].rsplit('::',1)[0]; txt=l.rsplit('::',1)[1]
        out.append(f'<p {P}><a href="{html.escape(url)}" style="font-weight:bold;color:#0068c3;">{html.escape(txt)}</a></p>'); blank(); i+=1; continue
    if l.startswith('RED::'):
        buf.append(f'<span style="color:#ff0010;font-weight:bold;">{inline(l[5:])}</span>'); i+=1; continue
    if l.startswith('- '):
        flush(); items=[]
        while i<len(lines) and lines[i].startswith('- '): items.append(inline(lines[i][2:])); i+=1
        out.append(f'<ul style="{FONT}font-size:13pt;line-height:1.9;text-align:left;">'+''.join(f'<li>{x}</li>' for x in items)+'</ul>'); blank(); continue
    buf.append(inline(l)); i+=1
flush()
content='\n'.join(out)
page=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>네이버 블로그 붙여넣기용 / 비즈니스 영어</title>
<style>body{{background:#eee;margin:0;font-family:sans-serif}} .bar{{position:sticky;top:0;background:#222;color:#fff;padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;z-index:9}} .bar button{{font-size:15px;font-weight:bold;padding:10px 16px;border:0;border-radius:8px;cursor:pointer}} .b1{{background:#03c75a;color:#fff}} .b2{{background:#fff;color:#222}} .tip{{font-size:12px;opacity:.8}} #post{{background:#fff;max-width:760px;margin:20px auto;padding:40px 30px}} #title{{max-width:760px;margin:20px auto 0;background:#fff;padding:18px 30px;font-size:20px;font-weight:bold}}</style></head><body>
<div class="bar"><button class="b2" onclick="copyTitle()">① 제목 복사</button><button class="b1" onclick="copyBody()">② 본문 복사 (서식+사진)</button><span class="tip" id="msg">네이버 글쓰기 → 제목 칸에 ①, 본문 칸에 ② 붙여넣기 (Cmd+V). 사진까지 같이 들어가요!</span></div>
<div id="title">{html.escape(title)}</div>
<div id="post">{content}</div>
<script>
function msg(t){{document.getElementById('msg').textContent=t;}}
function sel(id){{const r=document.createRange(); r.selectNodeContents(document.getElementById(id)); const s=getSelection(); s.removeAllRanges(); s.addRange(r);}}
async function copyTitle(){{const t=document.getElementById('title').innerText; try{{await navigator.clipboard.writeText(t);}}catch(e){{sel('title'); document.execCommand('copy');}} msg('제목 복사됐어요 ✔');}}
async function copyBody(){{const el=document.getElementById('post'); try{{await navigator.clipboard.write([new ClipboardItem({{'text/html':new Blob([el.innerHTML],{{type:'text/html'}}),'text/plain':new Blob([el.innerText],{{type:'text/plain'}})}})]);}}catch(e){{sel('post'); document.execCommand('copy');}} msg('본문 복사됐어요 ✔ 네이버 본문에 붙여넣으세요');}}
</script></body></html>'''
open('네이버_붙여넣기.html','w',encoding='utf-8').write(page)
print('ok', content.count('<img'), content.count('<blockquote'))
