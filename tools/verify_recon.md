# 인증 로그 vs 앱 상태 대조 (매일)

앱(운영자 계정)을 연 브라우저 콘솔에서 아래를 붙여넣으면 "로그엔 있는데 앱 상태엔 없는 날"을 멤버별로 보여준다.
나온 멤버는 `__opRestoreVerify('이름', Day, 'YYYY-MM-DD', 'HH:MM')` 로 복구.

```js
(async()=>{const ms=MEMBER_DIRECTORY.filter(m=>!m.isStaff&&!m.ghost&&!m.hidden);const maxD=Math.min(Number(state.currentDay)||1,20);const ev={};
for(let d=1;d<=maxD;d++){try{(await supabaseRpc('list_verification_times_for_day',{p_cohort:CHALLENGE.cohort,p_day:d})||[]).forEach(r=>{(ev[r.member_key]=ev[r.member_key]||{})[d]=r.verified_at;});}catch(e){}}
for(const m of ms){let p=null;try{p=await supabaseRpc('get_member_app_state',{p_cohort:CHALLENGE.cohort,p_member_key:m.name});}catch(e){}
const v=(p&&p.verified)||{};const miss=Object.keys(ev[m.name]||{}).map(Number).filter(d=>!v['d'+d]);
if(miss.length)console.log(m.name, miss.map(d=>`Day${d} ${new Date(ev[m.name][d]).toLocaleString('ko-KR')}`).join(', '));}
console.log('대조 끝');})();
```
