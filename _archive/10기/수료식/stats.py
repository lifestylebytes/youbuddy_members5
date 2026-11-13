import json,collections
s=json.load(open('sum.json')); f=json.load(open('full.json'))
st={m['member_key']:m['app_state'] or {} for m in f['member_state']}
EX={'유버디','이지흔','','__recording_checks__'}
M=[]
for r in s:
    if r['member_name'] in EX: continue
    a=st.get(r['member_key'],{})
    nick=(r.get('english_name') or r['member_name']).strip()
    if nick=='silvia': nick='Silvia'
    vd=len(r.get('verified_days') or []); ld=len(r.get('late_days') or [])
    sub=a.get('submitted_text') or {}
    chars=sum(len(v) for v in sub.values() if isinstance(v,str))
    ai=sum(len(v) for v in (a.get('ai_history') or {}).values() if isinstance(v,list))
    vt=a.get('verified_time') or {}
    mins=[]
    for k,v in vt.items():
        try: h,m=v.split(':'); mins.append(int(h)*60+int(m))
        except: pass
    ft=a.get('final_test')
    qr=a.get('quiz_results') or {}
    perfectq=sum(1 for v in qr.values() if isinstance(v,dict) and v.get('total') and v.get('score')==v.get('total'))
    vs=a.get('vocab_stats') or {}
    M.append(dict(name=r['member_name'],nick=nick,days=vd,late=ld,ontime=vd-ld,nsent=len(sub),chars=chars,ai=ai,mins=mins,final=bool(ft),fscore=(ft or {}).get('score') if isinstance(ft,dict) else None,ftotal=(ft or {}).get('total') if isinstance(ft,dict) else None,perfectq=perfectq,nq=len(qr),vs=vs,tz=a.get('timezoneOffsetMinutes'),tzl=a.get('timezoneLabel'),syn=len([1 for v in (a.get('saved_syns') or {}).values() if v]),bm=len([1 for v in (a.get('bookmarks') or {}).values() if v])))
json.dump(M,open('members.json','w'),ensure_ascii=False)
if __name__=='__main__':
    print('n',len(M),'verif',sum(m['days'] for m in M),'sent',sum(m['nsent'] for m in M),'chars',sum(m['chars'] for m in M),'ai',sum(m['ai'] for m in M))
    def hm(x): return f"{int(x)//60:02d}:{int(x)%60:02d}"
    for m in sorted(M,key=lambda m:-m['days']):
        mm=m['mins']; early=sum(1 for x in mm if 300<=x<600); night=sum(1 for x in mm if x>=1320 or x<180)
        import statistics
        print(m['nick'],m['days'],'late',m['late'],'sent',m['nsent'],'chars',m['chars'],'ai',m['ai'],'pq',m['perfectq'],'/',m['nq'],'med',hm(statistics.median(mm)) if mm else '-', 'early',early,'night',night,'tz',m['tz'],m['tzl'],'final',m['final'],m['fscore'],'syn',m['syn'],'bm',m['bm'])
    w=collections.Counter(); fw=collections.Counter(); seen=collections.Counter()
    for m in M:
        for k,v in m['vs'].items():
            if not isinstance(v,dict): continue
            seen[k]+=1
            if v.get('w',0)>0: w[k]+=1
            if v.get('firstResult')=='wrong': fw[k]+=1
    print('first wrong',fw.most_common(8)); print('any wrong',w.most_common(8))
