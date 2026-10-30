import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),sharp=require('sharp');
const dir=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const checks=[];
for(const d of manifest){
 for(const kind of ['pins','print']){
  const file=path.join(dir,kind,d.id+'.svg');
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(()=>document.fonts.ready);
  const clipped=await page.evaluate(()=>[...document.querySelectorAll('text')].filter(t=>{const b=t.getBBox(),s=t.ownerSVGElement,v=s.viewBox.baseVal;const w=v.width||s.width.baseVal.value,h=v.height||s.height.baseVal.value;return b.x<0||b.y<0||b.x+b.width>w+1||b.y+b.height>h+1}).map(t=>t.textContent));
  const meta=await sharp(path.join(dir,kind,d.id+'.png')).metadata();
  if(clipped.length)throw Error(d.id+' clipped text '+JSON.stringify(clipped));
  if(kind==='pins'&&(meta.width!==1000||meta.height!==1500))throw Error('Incorrect pin dimensions');
  if(kind==='print'&&(meta.width!==1748||meta.height!==2480||meta.density!==300))throw Error('Incorrect print export');
  checks.push({file:kind+'/'+d.id+'.png',width:meta.width,height:meta.height,dpi:meta.density,textClipping:clipped});
 }
}
const review=[];
for(const width of [390,1280]){
 await page.setViewportSize({width,height:900});
 await page.goto(pathToFileURL(path.join(dir,'review.html')).href);
 const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length}));
 if(result.overflow||result.brokenImages)throw Error('Review page failure '+JSON.stringify(result));
 review.push({width,...result});
}
await browser.close();
await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify({checks,review,visualReview:'All four concepts inspected together in design-board.png. No clipping or overlapping text observed.',qr:'Deterministic qrcode-generator output; M correction and four-module quiet zone. Device scanning and physical print not tested.'},null,2));
console.log(JSON.stringify({exports:checks.length,review,textClipping:0}));
