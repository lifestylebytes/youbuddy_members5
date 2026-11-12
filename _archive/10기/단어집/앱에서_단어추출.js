const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))r.continue();else r.abort()});
await p.goto('file:///home/claude/youbuddy_members5/10th/index.html?demo=1',{waitUntil:'domcontentloaded'}).catch(()=>{});await p.waitForTimeout(2500);
const d=await p.evaluate(()=>({ch:CHALLENGE,gloss:SYNONYM_GLOSSARY,spoon:OPS_TALK.spoon}));fs.writeFileSync('app.json',JSON.stringify(d));
const ch=d.ch;console.log(Object.keys(ch));console.log(JSON.stringify(ch.weeks?ch.weeks[0]:null).slice(0,1500));console.log('gloss',Object.keys(d.gloss).length);await b.close()})()
