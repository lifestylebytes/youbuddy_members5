const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for(let i=1;i<=3;i++){const c=await b.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:2});const p=await c.newPage();await p.goto('file://'+process.cwd()+`/guide/g${i}.html`);await p.waitForTimeout(300);
const of=await p.evaluate(()=>document.querySelector('.c').scrollHeight>1350);if(of)console.log('OVERFLOW',i);await p.screenshot({path:`guide/10기_단어집활용_${i}.png`});await c.close();
const c2=await b.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:0.6});const p2=await c2.newPage();await p2.goto('file://'+process.cwd()+`/guide/g${i}.html`);await p2.waitForTimeout(300);await p2.screenshot({path:`guide/g${i}.jpg`,type:'jpeg',quality:82});await c2.close();}
await b.close()})()
