const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();fs.mkdirSync('png',{recursive:true});fs.mkdirSync('jpg',{recursive:true});
for(let i=1;i<=10;i++){const n=String(i).padStart(2,'0');
 const c=await b.newContext({viewport:{width:1080,height:1080},deviceScaleFactor:2});const p=await c.newPage();await p.goto('file://'+process.cwd()+`/html/c${n}.html`);await p.waitForTimeout(150);
 await p.screenshot({path:`png/10기_수료식_${n}.png`});
 const of=await p.evaluate(()=>{const c=document.querySelector('.c');return c.scrollHeight>1080});if(of)console.log('OVERFLOW',n);await c.close();
 const c2=await b.newContext({viewport:{width:1080,height:1080},deviceScaleFactor:0.6});const p2=await c2.newPage();await p2.goto('file://'+process.cwd()+`/html/c${n}.html`);await p2.screenshot({path:`jpg/c${n}.jpg`,type:'jpeg',quality:82});await c2.close();}
await b.close();})();
