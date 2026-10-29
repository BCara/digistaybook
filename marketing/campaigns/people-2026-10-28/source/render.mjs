import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),sharp=require('sharp');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// fflate is the app's own dependency: from the repository copy, or from the repository itself when run on the NAS.
const fflate=()=>{try{return createRequire(path.join(root,'../../../package.json'))('fflate')}catch{return createRequire('C:/Users/clbbe/Documents/Projects/DigiStayBook/package.json')('fflate')}};
const {zipSync,strToU8}=fflate();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:2000}});
await page.goto(pathToFileURL(path.join(root,'source/boards.html')).href);
await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
const manifest=[];
for(const board of await page.locator('.art').all()){
 const name=await board.getAttribute('data-file');
 const errors=await board.evaluate(el=>{const b=el.getBoundingClientRect(),f=el.querySelector('footer').getBoundingClientRect();return [...el.querySelectorAll('h1,.copy .sub,.copy .eyebrow,.link-space')].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>f.top||r.right>b.right||r.left<b.left}).map(n=>n.textContent)});
 if(errors.length)throw Error(name+' overflowing text: '+JSON.stringify(errors));
 await board.screenshot({path:path.join(root,'assets',name)});
 const meta=await sharp(path.join(root,'assets',name)).metadata();
 manifest.push({name,width:meta.width,height:meta.height,bytes:(await fs.stat(path.join(root,'assets',name))).size});
}
const tiles=[];
for(let i=0;i<manifest.length;i++){
 const m=manifest[i];
 tiles.push({input:await sharp(path.join(root,'assets',m.name)).resize(324,480,{fit:'contain',background:'#e7e0d3'}).toBuffer(),left:(i%4)*348+12,top:Math.floor(i/4)*526+32});
 tiles.push({input:Buffer.from(`<svg width="348" height="25"><text x="12" y="20" font-family="Arial" font-size="17">${m.name}</text></svg>`),left:(i%4)*348,top:Math.floor(i/4)*526});
}
await sharp({create:{width:1392,height:1052,channels:3,background:'#e7e0d3'}}).composite(tiles).jpeg({quality:92}).toFile(path.join(root,'CONTACT_SHEET.jpg'));
const files={};
for(const m of manifest)files['assets/'+m.name]=new Uint8Array(await fs.readFile(path.join(root,'assets',m.name)));
for(const name of ['CAPTIONS.md','SOURCES.md','content.json','CONTACT_SHEET.jpg'])files[name]=new Uint8Array(await fs.readFile(path.join(root,name)));
files['README.txt']=strToU8('DigiStayBook photo-led content drafts, prepared 29 October 2026. Five feed posts + three companion Stories. See CAPTIONS.md and SOURCES.md. Review before publishing. Story link stickers must be added natively.');
await fs.writeFile(path.join(root,'DigiStayBook-people-content.zip'),zipSync(files,{level:6}));
await page.goto(pathToFileURL(path.join(root,'REVIEW.html')).href);
await page.getByRole('button',{name:'5 feed posts',exact:true}).click();
if(await page.locator('article:visible').count()!==5)throw Error('Feed filter failed');
await page.getByRole('button',{name:'3 Stories',exact:true}).click();
if(await page.locator('article:visible').count()!==3)throw Error('Story filter failed');
await page.getByRole('button',{name:'All 8',exact:true}).click();
const first=page.locator('article').first();
await first.locator('.status').selectOption('Keep');await first.locator('.note').fill('QA persistence check');
await page.reload();
if(await first.locator('.status').inputValue()!=='Keep'||await first.locator('.note').inputValue()!=='QA persistence check')throw Error('Review persistence failed');
await page.evaluate(()=>localStorage.removeItem('dsb-people-moments-20261029'));await page.reload();
await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode()}))});
const missing=await page.locator('img').evaluateAll(ns=>ns.filter(n=>!n.complete||!n.naturalWidth).map(n=>n.src));
if(missing.length)throw Error('Missing images '+missing);
await page.screenshot({path:path.join(root,'reference/review-desktop.jpg'),fullPage:false});
await page.setViewportSize({width:390,height:844});await page.reload();
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile horizontal overflow');
await page.screenshot({path:path.join(root,'reference/review-mobile.jpg'),fullPage:false});
await fs.writeFile(path.join(root,'VALIDATION.json'),JSON.stringify({prepared:'2026-10-29',exports:manifest,checks:['Eight images decoded and rendered','Artwork text inside frame and above footer','Feed and Story filters','Browser review persistence','Review page images loaded','390px mobile no horizontal overflow','Finished-media ZIP produced; original stock images excluded'],visualReview:'See CONTACT_SHEET.jpg and reference review screenshots'},null,2));
await browser.close();console.log(JSON.stringify({exports:manifest,checks:'passed'}));
