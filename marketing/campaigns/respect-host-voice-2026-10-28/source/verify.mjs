import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {facebook,pinterest,stories,videos,weeks}=JSON.parse(await fs.readFile(path.join(root,'content.json')));
const files=await fs.readdir(path.join(root,'assets'));
const manifest=[];
for(const name of files){const file=path.join(root,'assets',name);const stat=await fs.stat(file);const record={name,bytes:stat.size};if(name.endsWith('.png')){const info=await sharp(file).metadata();record.width=info.width;record.height=info.height;}manifest.push(record);}
if(files.filter(x=>x.endsWith('.png')).length!==18)throw Error('Expected 18 image exports');
if(weeks.flatMap(w=>w.ideas).length!==28)throw Error('Expected 28 daily ideas');
if(facebook.length!==5||pinterest.length!==5||stories.length!==7||videos.length!==2)throw Error('Content counts wrong');
const browser=await chromium.launch({headless:true});const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage({viewport:{width:1440,height:1000}});const errors=[];const failed=[];page.on('pageerror',err=>errors.push(err.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
await page.goto('http://127.0.0.1:15188/CAMPAIGN_PLAN.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
const brokenImages=await page.locator('img').evaluateAll(nodes=>nodes.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));
await page.getByRole('button',{name:'Facebook',exact:true}).click();if(await page.locator('[data-channel]:visible').count()!==5)throw Error('Facebook filter');
await page.getByRole('button',{name:'Pinterest',exact:true}).click();if(await page.locator('[data-channel]:visible').count()!==5)throw Error('Pinterest filter');
await page.getByRole('button',{name:'All posts',exact:true}).click();
await page.locator('#fb-01 button.copy').first().click();const copy=await page.evaluate(()=>navigator.clipboard.readText());if(!copy.includes('Your welcome is a good place to begin.'))throw Error('Copy button content mismatch');
const localLinks=await page.locator('a[href]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('href')).filter(x=>!x.startsWith('http')&&!x.startsWith('#')))]);
const missing=[];for(const href of localLinks){try{await fs.access(path.join(root,href))}catch{missing.push(href)}}
const videoChecks=[];
for(const v of videos){await page.evaluate(file=>{document.body.innerHTML='<video id="qa" muted playsinline controls style="height:90vh" src="/assets/'+file+'"></video>';},v.file);
 await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=1&&v.videoWidth>0});
 const meta=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.message??null}));
 if(meta.width!==1080||meta.height!==1920||meta.error)throw Error('Video decode');
 for(const time of [0.2,...v.scenes.map(s=>(s.start+s.end)/2),v.duration-.2]){await page.locator('video').evaluate((el,t)=>new Promise(resolve=>{el.onseeked=resolve;el.currentTime=t}),time);const data=await page.locator('video').evaluate(v=>{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL('image/jpeg',.85).split(',')[1]});await fs.writeFile(path.join(root,'reference',`${v.id}-qa-${String(time).replace('.','_')}.jpg`),Buffer.from(data,'base64'));}
 await page.locator('video').evaluate(v=>v.play());await page.waitForTimeout(300);if(!await page.locator('video').evaluate(v=>v.currentTime>0))throw Error('Video playback did not advance');
 videoChecks.push({file:v.file,...meta});
}
await page.goto('http://127.0.0.1:15188/CAMPAIGN_PLAN.html',{waitUntil:'networkidle'});
await page.screenshot({path:path.join(root,'reference','review-desktop.jpg'),type:'jpeg',quality:85});
await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'networkidle'});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);await page.screenshot({path:path.join(root,'reference','review-mobile.jpg'),type:'jpeg',quality:85});
await page.goto(pathToFileURL(path.join(root,'source','boards.html')).href,{waitUntil:'networkidle'});
const clippedText=await page.locator('.art').evaluateAll(els=>els.flatMap(el=>{const box=el.getBoundingClientRect();return [...el.querySelectorAll('h1,h2,p,blockquote,.eyebrow')].filter(t=>{const r=t.getBoundingClientRect();return r.bottom>box.bottom+1||r.right>box.right+1||r.left<box.left-1}).map(t=>({art:el.id,text:t.innerText.slice(0,80)}))}));
const imageFiles=manifest.filter(f=>f.name.endsWith('.png'));
const width=1600,tileW=320,tileH=475;const composites=[];
for(let i=0;i<imageFiles.length;i++){const f=imageFiles[i];const tile=await sharp(path.join(root,'assets',f.name)).resize(295,430,{fit:'contain',background:'#f7f2e8'}).toBuffer();composites.push({input:tile,left:i%5*tileW+12,top:Math.floor(i/5)*tileH+30});const label=Buffer.from(`<svg width="320" height="30"><text x="12" y="20" font-family="Arial" font-size="16" fill="#27332e">${f.name}</text></svg>`);composites.push({input:label,left:i%5*tileW,top:Math.floor(i/5)*tileH});}
await sharp({create:{width,height:Math.ceil(imageFiles.length/5)*tileH,channels:3,background:'#e4e1d7'}}).composite(composites).jpeg({quality:90}).toFile(path.join(root,'CONTACT_SHEET.jpg'));
const report={checked:'2026-10-28',imageExports:18,videoExports:2,dailyIdeas:28,counts:{facebook:5,pinterest:5,stories:7},videoChecks,desktopWidth:1440,mobileWidth:390,mobileOverflow:overflow,brokenImages,missingLocalFiles:missing,pageErrors:errors,failedLocalRequests:failed,clippedText,filters:'passed',captionCopy:'passed'};
await fs.writeFile(path.join(root,'ASSET_MANIFEST.json'),JSON.stringify({files:manifest,verification:report},null,2));console.log(JSON.stringify(report,null,2));await browser.close();
if(overflow||brokenImages.length||missing.length||errors.length||failed.length||clippedText.length)process.exitCode=1;
