import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const root=process.argv[2]||path.dirname(path.dirname(here)),url=process.argv[3]||'http://127.0.0.1:15189/MARKETING_PLAN.html';
const browser=await chromium.launch({headless:true,args:['--disable-gpu','--renderer-process-limit=1','--disable-extensions']});
const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1440,height:1000}});
const page=await context.newPage(),errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(new URL(url).origin)&&r.status()>=400)failed.push({url:r.url(),status:r.status()})});
await page.goto(url,{waitUntil:'networkidle'});
const data=await page.locator('#marketing-content').evaluate(n=>JSON.parse(n.textContent));
assert.equal(data.posts.length,38);assert.equal(data.decisions.length,98);
assert.equal(data.posts.filter(p=>p.role==='Main').length,20);
assert.equal(data.posts.filter(p=>p.role==='Main'&&p.format==='Reel').length,8);
assert.equal(data.posts.filter(p=>p.role==='Main'&&p.media_ready).length,15);
assert.equal(data.posts.filter(p=>p.role==='Main'&&p.destination).length,19);
assert.equal(new Set(data.posts.filter(p=>p.role==='Main').map(p=>p.date)).size,20);
assert.equal(new Set(data.decisions.map(p=>p.id)).size,98);
for(const p of data.decisions)for(const t of p.targets)assert.ok(data.posts.some(x=>x.id===t),t);
for(const p of data.posts){assert.ok(p.caption.length>50);for(const a of p.assets)assert.ok((await fs.stat(path.join(root,a))).size>0);if(p.destination){const u=new URL(p.destination);for(const k of ['utm_source','utm_medium','utm_campaign','utm_content'])assert.ok(u.searchParams.get(k));assert.equal(u.searchParams.get('utm_content'),p.id);}}
const ids=await page.locator('[id]').evaluateAll(ns=>ns.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);
const refs=await page.locator('a[href],img[src],video[src]').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')||n.getAttribute('src')));
for(const ref of refs){if(ref.startsWith('#'))assert.ok(ids.includes(ref.slice(1)),ref);else if(!/^https?:/.test(ref)){const [file,hash]=ref.split('#');await fs.access(path.resolve(root,file));if(hash){const target=await fs.readFile(path.resolve(root,file),'utf8');assert.ok(target.includes('id="'+hash+'"'),ref);}}}
assert.equal(await page.locator('tr.post:visible').count(),38);
await page.selectOption('#f-role','Main');assert.equal(await page.locator('tr.post:visible').count(),20);
await page.selectOption('#f-format','Reel');assert.equal(await page.locator('tr.post:visible').count(),8);
await page.selectOption('#f-media','missing');assert.equal(await page.locator('tr.post:visible').count(),5);
await page.selectOption('#f-role','');await page.selectOption('#f-format','');await page.selectOption('#f-media','');
await page.selectOption('#f-channel','Pinterest');assert.equal(await page.locator('tr.post:visible').count(),8);
await page.selectOption('#f-channel','');await page.fill('#search','rainy-day');assert.equal(await page.locator('tr.post:visible').count(),1);await page.fill('#search','');
// Preserve old source statuses and captions; do not apply them to revised copy/dates.
await page.evaluate(()=>localStorage.setItem('dsb-marketing-review-20261023',JSON.stringify({'r-01':{status:'Scheduled',comment:'Original queue record'},'r-07':{status:'Posted',caption:'Earlier caption',comment:'Keep my original note'}})));
await page.evaluate(()=>localStorage.setItem('dsb-home-review-20261102',JSON.stringify({'r-04':{status:'Manual review – confirmed',comment:'From prior campaign page'}})));
await page.reload({waitUntil:'networkidle'});
assert.equal(await page.locator('select.st[data-key="r-07"]').first().inputValue(),'Planned');
await page.locator('#r-07 > summary').click();assert.equal(await page.locator('#r-07 .saved-warning').isVisible(),true);
assert.notEqual(await page.locator('#caption-r-07').inputValue(),'Earlier caption');
await page.locator('select.st[data-key="r-07"]').last().selectOption('Manual review – confirmed');
assert.equal(await page.locator('select.st[data-key="r-07"]').first().inputValue(),'Manual review – confirmed');
await page.fill('#comment-r-07','New source review note');
await page.fill('#caption-r-07','Edited caption in isolated verification context.');
assert.equal(await page.locator('select.st[data-key="r-07"]').first().inputValue(),'Manual review – changes needed');
await page.locator('#r-07 .copy-caption').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Edited caption in isolated verification context.');
await page.locator('#copy').click();const exported=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));
assert.equal(exported.allBrowserReviews['r-01'].status,'Scheduled');assert.equal(exported.allBrowserReviews['r-07'].prior_reviews[0].status,'Posted');assert.equal(exported.allBrowserReviews['r-07'].prior_reviews[0].caption,'Earlier caption');assert.equal(exported.allBrowserReviews['r-04'].comment,'From prior campaign page');assert.equal(exported.posts.length,38);assert.equal(exported.sourceDecisions.length,98);
await page.reload({waitUntil:'networkidle'});await page.locator('#r-07 > summary').click();assert.equal(await page.locator('#caption-r-07').inputValue(),'Edited caption in isolated verification context.');
const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;const downloaded=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(downloaded.posts.length,38);assert.equal(downloaded.allBrowserReviews['r-01'].status,'Scheduled');
// Rendering and media checks in a clean context, with all post cards expanded.
await context.close();const clean=await browser.newContext({viewport:{width:1440,height:1000}});const visual=await clean.newPage();visual.on('pageerror',e=>errors.push(e.message));
await visual.goto(url,{waitUntil:'networkidle'});await visual.evaluate(()=>{for(const el of document.querySelectorAll('details.card'))el.open=true;for(const img of document.images)img.loading='eager';});
try{await visual.waitForFunction(()=>[...document.images].every(i=>i.complete),{},{timeout:60000});}catch(e){console.log('Incomplete images',await visual.locator('img').evaluateAll(ns=>ns.filter(n=>!n.complete).map(n=>n.src)));throw e;}
const brokenImages=await visual.locator('img').evaluateAll(ns=>ns.filter(n=>!n.naturalWidth).map(n=>n.src));assert.deepEqual(brokenImages,[]);
const videos=[];
for(const v of await visual.locator('video').all()){
 await v.evaluate(el=>new Promise((resolve,reject)=>{el.onloadedmetadata=resolve;el.onerror=()=>reject(Error(el.error?.message));el.load();}));
 const metadata=await v.evaluate(el=>({width:el.videoWidth,height:el.videoHeight,duration:el.duration}));assert.equal(metadata.width,1080);assert.equal(metadata.height,1920);assert.ok(metadata.duration>=17);
 await v.evaluate(el=>{el.muted=true;return el.play();});await visual.waitForTimeout(200);assert.ok(await v.evaluate(el=>el.currentTime>0));await v.evaluate(el=>el.pause());videos.push(metadata);
}
await visual.evaluate(()=>{for(const el of document.querySelectorAll('details.card'))el.open=false;});
await visual.screenshot({path:path.join(here,'plan-desktop.jpg'),type:'jpeg',quality:85});
await visual.setViewportSize({width:390,height:844});await visual.reload({waitUntil:'networkidle'});assert.equal(await visual.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile page overflow');await visual.screenshot({path:path.join(here,'plan-mobile.jpg'),type:'jpeg',quality:85});
await visual.locator('.filter-panel > summary').click();await visual.selectOption('#f-channel','Pinterest');await visual.evaluate(()=>location.hash='m1-06');await visual.waitForFunction(()=>document.getElementById('m1-06').open&&!document.getElementById('m1-06').hidden);assert.equal(await visual.locator('#f-channel').inputValue(),'');
await visual.locator('#m1-06').scrollIntoViewIfNeeded();await visual.waitForTimeout(250);await visual.screenshot({path:path.join(here,'post-mobile.jpg'),type:'jpeg',quality:85});
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
const report={checked:'2026-10-28',root,url,activeItems:38,main:20,mainMediaExports:15,newVideosNeeded:5,sourceDecisions:98,allLinksResolve:true,allAssetsExist:true,filters:'PASS',reviewMigrationAndHistory:'PASS',statusSync:'PASS',captionEditsInvalidateApproval:'PASS',persistence:'PASS',copyAndDownload:'PASS',mobileWidth:390,mobileOverflow:false,hashNavigation:'PASS',brokenImages,videos,scriptErrors:errors,failedLocalResponses:failed,notice:'Isolated browser verification only. No user browser reviews or external schedules changed.'};
await fs.writeFile(path.join(here,'VERIFICATION.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
