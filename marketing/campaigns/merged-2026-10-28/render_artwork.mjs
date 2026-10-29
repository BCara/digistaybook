import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),sharp=require('sharp');
const root=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1200,height:1600}});
await page.goto(pathToFileURL(path.join(root,'artwork.html')).href);await page.evaluate(()=>document.fonts.ready);
const manifest=[];
for(const board of await page.locator('.art').all()){
 const name=await board.getAttribute('data-file');
 const clipping=await board.evaluate(el=>{const b=el.getBoundingClientRect(),f=el.querySelector('footer').getBoundingClientRect();return [...el.querySelectorAll('h1,h2,p,blockquote,.strip,.steps,.tips')].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>f.top+1||r.right>b.right+1||r.left<b.left-1}).map(n=>n.textContent.slice(0,70));});
 if(clipping.length)throw Error(name+' text overflow '+JSON.stringify(clipping));
 await board.screenshot({path:path.join(root,'assets',name)});
 const meta=await sharp(path.join(root,'assets',name)).metadata();manifest.push({name,width:meta.width,height:meta.height,bytes:(await fs.stat(path.join(root,'assets',name))).size});
}
const tiles=[];for(let i=0;i<manifest.length;i++){
 tiles.push({input:await sharp(path.join(root,'assets',manifest[i].name)).resize(270,370,{fit:'contain',background:'#e9e4d8'}).toBuffer(),left:(i%4)*290+10,top:Math.floor(i/4)*405+25});
 tiles.push({input:Buffer.from(`<svg width="290" height="25"><text x="10" y="19" font-family="Arial" font-size="16">${manifest[i].name}</text></svg>`),left:(i%4)*290,top:Math.floor(i/4)*405});
}
await sharp({create:{width:1160,height:Math.ceil(manifest.length/4)*405,channels:3,background:'#e9e4d8'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(root,'CONTACT_SHEET.jpg'));
await fs.writeFile(path.join(root,'ARTWORK_MANIFEST.json'),JSON.stringify(manifest,null,2));
const live=[];
for(const url of ['https://digistaybook.com/','https://digistaybook.com/stay/demo-cottage']){
 try{const response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});live.push({url,status:response?.status(),finalUrl:page.url(),title:await page.title(),text:(await page.locator('body').innerText()).slice(0,14000),links:await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>({text:n.textContent.trim(),href:n.getAttribute('href')})))});}catch(e){live.push({url,error:e.message})}
}
await fs.writeFile(path.join(root,'LIVE_DESTINATION_CHECK.json'),JSON.stringify({checked:'2026-10-28',method:'Read-only headless browser. No account creation, publishing or form submission.',pages:live},null,2));
console.log(JSON.stringify({artwork:manifest.length,live:live.map(p=>({url:p.url,status:p.status,title:p.title,error:p.error,links:p.links}))},null,2));
await browser.close();
