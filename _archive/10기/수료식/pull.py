import json, urllib.request
U="https://qaasxvatmribkgtatine.supabase.co"; K="sb_publishable_XNd9sxTnMsuNmdT1JSXtdw_wMj0Ma9R"
def rpc(n,p):
    r=urllib.request.Request(f"{U}/rest/v1/rpc/{n}",data=json.dumps(p).encode(),headers={"apikey":K,"Authorization":f"Bearer {K}","Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(r,timeout=60).read().decode())
json.dump(rpc("get_cohort_member_summaries",{"p_cohort":"10기"}),open("sum.json","w"),ensure_ascii=False)
json.dump(rpc("get_cohort_full_export",{"p_cohort":"10기"}),open("full.json","w"),ensure_ascii=False)
t={}
for d in range(1,21):
    try: t[d]=rpc("list_verification_times_for_day",{"p_cohort":"10기","p_day":d})
    except Exception as e: t[d]=str(e)
json.dump(t,open("times.json","w"),ensure_ascii=False)
