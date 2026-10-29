import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),here=path.dirname(fileURLToPath(import.meta.url));
const root=process.argv[2]||path.dirname(path.dirname(here)),base=process.argv[3]||'http://127.0.0.1:15189/';
const names=['MARKETING_PLAN.html','MARKETING_PRODUCTION.html','MARKETING_STRATEGY.html','MARKETING_REFERENCE.html'];
for(const name of names){const html=await fs.readFile(path.join(root,name),'utf8');const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,name+' duplicate IDs');for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){const ref=m[1];if(/^https?:/.test(ref))continue;const [file,hash]=ref.split('#');const target=path.join(root,file||name);await fs.access(target);if(hash)assert.ok((await fs.readFile(target,'utf8')).includes('id="'+hash+'"'),name+' → '+ref);}}
const browser=await chromium.launch({headless:true,args:['--disable-gpu','--renderer-process-limit=1','--disable-extensions']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'MARKETING_PLAN.html',{waitUntil:'networkidle'});assert.equal(await page.locator('#traffic,#production,#scorecard,#archive,#existing,#files').count(),0);assert.equal(await page.locator('#more .more-links a').count(),3);
await page.locator('header a[href="MARKETING_PRODUCTION.html#production"]').tap();await page.waitForURL('**/MARKETING_PRODUCTION.html#production');assert.equal(await page.locator('#production tbody tr').count(),5);
await page.screenshot({path:path.join(here,'phone-production-page.jpg'),type:'jpeg',quality:85});
await page.locator('#production tbody a').first().tap();await page.waitForURL('**/MARKETING_PLAN.html#m1-01');await page.waitForFunction(()=>document.getElementById('m1-01').open);
await page.locator('.mobile-jump a[href="#top"]').tap();await page.waitForFunction(()=>scrollY<5);
await page.locator('#more a[href="MARKETING_STRATEGY.html"]').tap();await page.waitForURL('**/MARKETING_STRATEGY.html');assert.equal(await page.locator('#traffic,#scorecard').count(),2);
await page.locator('.mobile-jump a[href="MARKETING_PLAN.html#posts"]').tap();await page.waitForURL('**/MARKETING_PLAN.html#posts');
await page.evaluate(()=>localStorage.setItem('dsb-marketing-review-20261023',JSON.stringify({'r-01':{status:'Scheduled',comment:'Keep this reference record'}})));
await page.goto(base+'MARKETING_REFERENCE.html#archive',{waitUntil:'networkidle'});assert.equal(await page.locator('[data-archive-id]').count(),98);assert.ok((await page.locator('[data-archive-id="r-01"]').innerText()).includes('Keep this reference record'));
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dsb-marketing-review-20261023'))['r-01'].status),'Scheduled');
for(const file of names){await page.goto(base+file,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,file+' mobile overflow');}
await page.goto(base+'MARKETING_PLAN.html#production',{waitUntil:'networkidle'});await page.waitForURL('**/MARKETING_PRODUCTION.html#production');
assert.deepEqual(errors,[]);
const result={checked:'2026-10-28',base,mainPageOnlySummaryCalendarAndPostDetails:true,supportPages:names.slice(1),allLocalLinksAndAnchorsResolve:true,productionToPostLink:true,backToPlan:true,preservedBrowserReview:true,sourceRecords:98,legacySectionLinkRedirect:true,mobileOverflow:false,scriptErrors:errors};
await fs.writeFile(path.join(here,'INFO_PAGES_VERIFICATION.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
