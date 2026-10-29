import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {videos} from './content.mjs';
const require=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1080,height:1920}});
await page.setContent('<!doctype html><title>Local MP4 export</title>');
for(const video of videos){
 const inputs={...video,scenes:await Promise.all(video.scenes.map(async(s,i)=>({...s,src:'data:image/png;base64,'+(await fs.readFile(path.join(root,'reference',`${video.id}-frame-${i+1}.png`))).toString('base64')})))};
 const encoded=await page.evaluate(async v=>{
  const slides=await Promise.all(v.scenes.map(s=>new Promise((resolve,reject)=>{const img=new Image();img.onload=async()=>{await img.decode();resolve({...s,img})};img.onerror=()=>reject(Error('Could not decode local slide'));img.src=s.src;})));
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(slides[0].img,0,0,1080,1920);
  const stream=canvas.captureStream(30);
  const recorder=new MediaRecorder(stream,{mimeType:'video/mp4;codecs=avc1.42001E',videoBitsPerSecond:5500000});
  const chunks=[];recorder.ondataavailable=evt=>{if(evt.data.size)chunks.push(evt.data)};
  const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
  const started=performance.now();
  await new Promise(resolve=>{const frame=now=>{const t=(now-started)/1000;const index=slides.findIndex(s=>t>=s.start&&t<s.end);const s=slides[Math.max(0,index<0?slides.length-1:index)];const fraction=Math.max(0,Math.min(1,(t-s.start)/(s.end-s.start)));const scale=1+fraction*.018;ctx.fillStyle='#182429';ctx.fillRect(0,0,1080,1920);ctx.drawImage(s.img,(1080-1080*scale)/2,(1920-1920*scale)/2,1080*scale,1920*scale);if(t<v.duration)requestAnimationFrame(frame);else resolve()};requestAnimationFrame(frame)});
  recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
  const blob=new Blob(chunks,{type:'video/mp4'});
  return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob)});
 },inputs);
 const output=path.join(root,'assets',video.file);await fs.writeFile(output,Buffer.from(encoded,'base64'));
 console.log(`${video.file}: ${Math.round((await fs.stat(output)).size/1024)} KiB`);
}
await browser.close();
