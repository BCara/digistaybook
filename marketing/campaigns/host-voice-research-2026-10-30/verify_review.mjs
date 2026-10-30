import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:15214';
const browser=await chromium.launch({headless:true,args:['--disable-gpu','--renderer-process-limit=1']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const result=[];
for(const filename of ['CAMPAIGN_REVIEW.html','CLAUDE_REVIEW.html']){
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});
    const response=await page.goto(`${base}/campaigns/host-voice-research-2026-10-30/${filename}`,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    assert.equal(await page.locator('h1').count(),1);
    assert(await page.locator('main').innerText());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow');
    for(const link of await page.locator('a[href]').evaluateAll(links=>links.map(a=>a.href))){
      if(!link.startsWith(base))continue;
      assert((await page.request.get(link.split('#')[0])).ok(),`Broken local link: ${link}`);
    }
    result.push({filename,width,overflow:false});
    if(filename==='CAMPAIGN_REVIEW.html')await page.screenshot({path:new URL(`./review-${width}.png`,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:false});
  }
}
assert.deepEqual(errors,[]);
await browser.close();
await fs.writeFile(new URL('./PAGE_QA.json',import.meta.url),JSON.stringify({checks:result,errors},null,2));
console.log(JSON.stringify({checks:result,errors}));
