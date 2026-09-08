#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI 첨삭 피드백(👍👎 + 한 줄) 수집기.
앱에서 멤버가 보낸 state.ai_review_feedback 을 기수 전원 app_state 에서 긁어
_archive/{기수}/운영/AI첨삭_피드백_로그.md 에 누적한다 (중복 제외).
사용: python3 collect_ai_feedback.py 9기 [8기 ...]
"""
import json, sys, os, urllib.request, datetime
URL='https://qaasxvatmribkgtatine.supabase.co/rest/v1/rpc/'
KEY='sb_publishable_XNd9sxTnMsuNmdT1JSXtdw_wMj0Ma9R'
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
def rpc(fn, payload):
    req=urllib.request.Request(URL+fn, data=json.dumps(payload).encode(), headers={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=40) as r: return json.load(r)
def collect(cohort):
    rows=rpc('get_cohort_member_summaries',{'p_cohort':cohort})
    items=[]
    for r in rows:
        k=r.get('member_key')
        if not k or k.startswith('__'): continue
        try: st=rpc('get_member_app_state',{'p_cohort':cohort,'p_member_key':k}) or {}
        except Exception: continue
        if isinstance(st,str):
            try: st=json.loads(st)
            except Exception: continue
        for f in (st.get('ai_review_feedback') or []):
            if isinstance(f,dict): items.append(dict(f, member=k, nick=st.get('englishName') or ''))
    return items
def main():
    cohorts=sys.argv[1:] or ['9기']
    for c in cohorts:
        items=collect(c)
        d=os.path.join(ROOT,'_archive',c,'운영'); os.makedirs(d,exist_ok=True)
        p=os.path.join(d,'AI첨삭_피드백_로그.md')
        seen=set()
        if os.path.exists(p):
            for line in open(p,encoding='utf-8'):
                if line.startswith('<!--id:'): seen.add(line.strip()[7:-3])
        else:
            open(p,'w',encoding='utf-8').write(f'# {c} AI 첨삭 피드백 로그\n\n멤버가 앱 AI 리뷰 아래 "피드백 주기"로 보낸 것. 최신이 아래. 👎 는 프롬프트 개선 후보.\n\n')
        new=[]
        for f in sorted(items, key=lambda x: x.get('at','')):
            fid=f"{f['member']}|{f.get('key')}|{f.get('at')}"
            if fid in seen: continue
            new.append(f)
            with open(p,'a',encoding='utf-8') as out:
                out.write(f"<!--id:{fid}-->\n")
                out.write(f"## {'👎' if f.get('rating')=='down' else '👍'} {f.get('nick') or f['member']} · {f.get('word','')} · {str(f.get('at',''))[:16]}\n")
                if f.get('text'): out.write(f"- 한 줄: {f['text']}\n")
                out.write(f"- 원문: {f.get('original','')}\n- 교정: {f.get('corrected','')}\n- why: {f.get('why','')}\n\n")
        down=sum(1 for f in items if f.get('rating')=='down')
        print(f"{c}: 총 {len(items)}건 (👎 {down}) · 새로 추가 {len(new)}건 → {p}")
if __name__=='__main__': main()
