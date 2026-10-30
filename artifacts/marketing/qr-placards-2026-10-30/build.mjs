import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const qr=require('qrcode-generator');
const runtime=createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/package.json');
const sharp=runtime('sharp');
const dir=path.dirname(fileURLToPath(import.meta.url));
await fs.mkdir(path.join(dir,'pins'),{recursive:true});
await fs.mkdir(path.join(dir,'print'),{recursive:true});
const destination='https://digistaybook.com/stay/demo-cottage';
const code=qr(0,'M');code.addData(destination);code.make();
const n=code.getModuleCount(),side=n+8;
let modules='';
for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(code.isDark(y,x))modules+=`M${x+4} ${y+4}h1v1h-1z`;
const logo=(await fs.readFile(path.resolve(dir,'../../../marketing/reference/digistaybook-logo-long-transparent.png'))).toString('base64');
const t=(x,y,text,size=22,color='currentColor',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${text}</text>`;
const center=(y,text,size,color,extra='')=>t(370,y,text,size,color,`text-anchor="middle" ${extra}`);
const rule=(x,y,w,color)=>`<path d="M${x} ${y}h${w}" stroke="${color}" fill="none"/>`;
const qrBlock=(x,y,w)=>`<svg x="${x}" y="${y}" width="${w}" height="${w}" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="#fff"/><path d="${modules}" fill="#171b19"/></svg>`;
const brand=(y,color='#4d4b43')=>`${center(y,'DigiStayBook',24,color,'font-family="Georgia"')}${center(y+29,'DEMO PROPERTY · SCAN TO PREVIEW',10,color,'letter-spacing="2"')}`;
const plants=`<g fill="none" stroke="#60735c" stroke-width="2.2"><path d="M104 330Q79 234 127 158M97 279Q58 249 67 223Q94 230 97 279M99 252Q134 224 131 199Q103 210 99 252M111 200Q85 177 99 155Q119 169 111 200"/><path d="M632 334Q664 261 619 172M641 282Q679 265 678 239Q650 240 641 282M642 254Q606 236 610 212Q638 219 642 254M631 211Q659 190 646 169Q624 183 631 211"/></g>`;
const designs=[
 {id:'01-warm-welcome',name:'Warm welcome',style:'Terracotta / warm white / soft arch',bg:'#e8d7c9',ink:'#6f3526',pinTitle:['A little sign.','A warmer welcome.'],pinSub:'A QR placard for a place with personality.',card:`
 <rect width="740" height="1050" fill="#fcf7ee"/>
 <path d="M55 990V348a315 315 0 0 1 630 0V990Z" fill="none" stroke="#bb6a4e" stroke-width="2"/>
 ${center(132,'SEABREEZE COTTAGE',15,'#6f3526','letter-spacing="4"')}
 ${center(246,'Make yourself',61,'#6f3526','font-family="Georgia"')}
 ${center(318,'at home.',69,'#6f3526','font-family="Georgia" font-style="italic"')}
 ${center(382,'Your stay starts here.',23,'#6f3526')}
 ${qrBlock(239,429,262)}
 ${center(737,'SCAN TO EXPLORE',15,'#6f3526','letter-spacing="3"')}
 ${center(786,'House tips. Local favorites.',24,'#6f3526')}
 ${center(821,'A place to leave your memories.',24,'#6f3526')}
 ${center(875,'Open your camera. No app or account needed.',17,'#6f3526')}
 ${brand(945,'#6f3526')}`},
 {id:'02-botanical-stay',name:'Botanical stay',style:'Sage / forest ink / botanical linework',bg:'#dfe5d9',ink:'#2c4637',pinTitle:['A thoughtful stay,','down to the details.'],pinSub:'A botanical QR sign for cabins and cottages.',card:`
 <rect width="740" height="1050" fill="#f7f7ef"/>
 <rect x="30" y="30" width="680" height="990" fill="none" stroke="#a5b09b"/>
 ${center(114,'SEABREEZE COTTAGE',15,'#2c4637','letter-spacing="3"')}
 ${plants}
 ${center(216,'Settle in.',67,'#2c4637','font-family="Georgia"')}
 ${center(289,'Stay awhile.',58,'#2c4637','font-family="Georgia" font-style="italic"')}
 ${center(359,'A few things to help you feel at home.',21,'#2c4637')}
 ${qrBlock(239,414,262)}
 ${center(724,'YOUR GUIDE TO THIS LITTLE CORNER',13,'#2c4637','letter-spacing="2"')}
 ${center(776,'Find house tips and favorite places.',23,'#2c4637')}
 ${center(811,'Leave a note from your stay.',23,'#2c4637')}
 ${rule(215,856,310,'#a5b09b')}
 ${center(893,'Scan with your camera. No app. No account.',17,'#2c4637')}
 ${brand(953,'#2c4637')}`},
 {id:'03-coastal-notes',name:'Coastal notes',style:'Ocean blue / ivory / hand-drawn waves',bg:'#dce9ec',ink:'#244b63',pinTitle:['Beach-house style.','One simple scan.'],pinSub:'A coastal welcome sign guests can explore.',card:`
 <rect width="740" height="1050" fill="#fcfaf3"/>
 <rect width="740" height="171" fill="#244b63"/>
 ${center(78,'SEABREEZE',35,'#fcfaf3','letter-spacing="8" font-family="Georgia"')}
 ${center(116,'C O T T A G E',15,'#fcfaf3')}
 ${center(264,'Hello,',72,'#244b63','font-family="Georgia" font-style="italic"')}
 ${center(332,'vacation mode.',62,'#244b63','font-family="Georgia"')}
 ${center(390,'Your guide to a lovely stay.',24,'#244b63')}
 ${qrBlock(239,436,262)}
 ${center(744,'SCAN &amp; SETTLE IN',15,'#244b63','letter-spacing="3"')}
 ${center(793,'House tips · Local favorites · Memories',21,'#244b63')}
 ${center(847,'No app. No account. Just your camera.',18,'#244b63')}
 <g fill="none" stroke="#8fbbc5" stroke-width="2"><path d="M52 901q53-24 106 0t106 0t106 0t106 0t106 0t106 0"/><path d="M52 912q53-24 106 0t106 0t106 0t106 0t106 0t106 0"/></g>
 ${brand(962,'#244b63')}`},
 {id:'04-the-house-edit',name:'The house edit',style:'Ink / cream / editorial typography',bg:'#e5e1da',ink:'#242822',pinTitle:['Your guest guide,','beautifully placed.'],pinSub:'An editorial QR sign for modern vacation rentals.',card:`
 <rect width="740" height="1050" fill="#fbf8f1"/>
 ${t(56,82,'SEABREEZE COTTAGE',16,'#242822','letter-spacing="2"')}
 ${t(684,82,'01',17,'#242822','text-anchor="end"')}
 ${rule(56,107,628,'#242822')}
 ${t(56,221,'The house',79,'#242822','font-family="Georgia"')}
 ${t(56,305,'is yours.',79,'#242822','font-family="Georgia" font-style="italic"')}
 ${t(56,369,'Make yourself at home. Start with a scan.',23,'#242822')}
 ${qrBlock(56,429,270)}
 ${t(371,481,'YOUR STAY,',15,'#242822','letter-spacing="2"')}
 ${t(371,506,'IN ONE PLACE.',15,'#242822','letter-spacing="2"')}
 ${t(371,560,'House tips',25,'#242822','font-family="Georgia"')}
 ${t(371,601,'Local favorites',25,'#242822','font-family="Georgia"')}
 ${t(371,642,'Guest memories',25,'#242822','font-family="Georgia"')}
 ${rule(56,751,628,'#242822')}
 ${t(56,800,'SCAN. EXPLORE. ENJOY.',16,'#242822','letter-spacing="3"')}
 ${t(56,840,'Open your camera to discover the house',22,'#242822')}
 ${t(56,873,'and leave a little of your stay behind.',22,'#242822')}
 ${t(56,925,'No app or account needed.',17,'#242822')}
 ${t(56,987,'DigiStayBook',24,'#242822','font-family="Georgia"')}
 ${t(684,984,'DEMO PROPERTY',10,'#242822','text-anchor="end" letter-spacing="1"')}`}
];
const svg=(body,w,h,attrs='')=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ${attrs}><g font-family="Arial, sans-serif">${body}</g></svg>`;
const manifest=[];
for(const d of designs){
 const print=svg(d.card,'148mm','210mm','viewBox="0 0 740 1050"');
 await fs.writeFile(path.join(dir,'print',d.id+'.svg'),print);
 await sharp(Buffer.from(print),{density:300}).resize(1748,2480).png().withMetadata({density:300}).toFile(path.join(dir,'print',d.id+'.png'));
 const pin=svg(`<rect width="1000" height="1500" fill="${d.bg}"/>
 ${t(64,77,'THE WELCOME COLLECTION',14,d.ink,'letter-spacing="4"')}
 ${t(64,157,d.pinTitle[0],52,d.ink,'font-family="Georgia"')}
 ${t(64,219,d.pinTitle[1],52,d.ink,'font-family="Georgia" font-style="italic"')}
 <rect x="187" y="299" width="650" height="923" fill="${d.ink}" opacity=".10"/>
 <svg x="175" y="284" width="650" height="923" viewBox="0 0 740 1050">${d.card}</svg>
 ${t(64,1290,d.name,35,d.ink,'font-family="Georgia"')}
 ${t(64,1330,d.pinSub,21,d.ink)}
 <image x="64" y="1380" width="222" height="56" href="data:image/png;base64,${logo}" preserveAspectRatio="xMinYMid meet"/>
 ${t(936,1415,'digistaybook.com',18,d.ink,'text-anchor="end"')}
 `,1000,1500);
 await fs.writeFile(path.join(dir,'pins',d.id+'.svg'),pin);
 await sharp(Buffer.from(pin)).png().toFile(path.join(dir,'pins',d.id+'.png'));
 manifest.push({id:d.id,name:d.name,palette:d.style,pin:[1000,1500],print:'A5 portrait, 148 x 210 mm; PNG 1748 x 2480 at 300 dpi',qrDestination:destination,qrModules:n,quietZoneModules:4,status:'Concept draft; fictional demo property. Replace property name and QR together before actual guest use.'});
}
const tiles=[];
for(let i=0;i<designs.length;i++)tiles.push({input:await sharp(path.join(dir,'pins',designs[i].id+'.png')).resize(600,900).toBuffer(),left:(i%2)*600,top:Math.floor(i/2)*900});
await sharp({create:{width:1200,height:1800,channels:3,background:'#fff'}}).composite(tiles).png().toFile(path.join(dir,'design-board.png'));
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(path.join(dir,'review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DigiStayBook — QR placard concepts</title><style>body{margin:0;background:#f6f3ed;color:#262c25;font:17px/1.6 Arial,sans-serif}main{max-width:1160px;margin:60px auto;padding:0 24px}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(36px,6vw,64px);max-width:800px}header p{max-width:790px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:44px 28px;margin-top:40px}article img{width:100%;display:block}a{color:inherit;text-underline-offset:4px}h2{font-size:32px;margin-bottom:8px}.meta{font-size:14px;opacity:.75}nav{display:flex;flex-wrap:wrap;gap:16px}@media(max-width:650px){.grid{grid-template-columns:1fr}main{margin:30px auto}}</style><main><header><p class="meta">DIGISTAYBOOK / DESIGN EXPLORATION / OCTOBER 30, 2026</p><h1>A small sign.<br>A thoughtful welcome.</h1><p>Four printed QR placard directions, each paired with a 1000 × 1500 Pinterest image. Each code opens the fictional Seabreeze Cottage demo. Personalize the property name and replace the QR with the property's in-stay link before using a sign with guests.</p><p class="meta">Original typography and vector artwork. Actual brand logo. No generated photography. Draft concepts; nothing posted or scheduled.</p></header><div class="grid">${designs.map(d=>`<article><img src="pins/${d.id}.png" alt="${d.name} Pinterest design"><h2>${d.name}</h2><p>${d.style}</p><nav><a href="pins/${d.id}.png" download>Pinterest PNG</a><a href="print/${d.id}.svg" target="_blank">A5 vector artwork</a><a href="print/${d.id}.png" download>300 dpi print PNG</a></nav></article>`).join('')}</div><p>Print: A5 portrait, 148 × 210 mm, at actual size. For home or office printing; no bleed or crop marks. Codes include a four-module quiet zone. Verify scanning on the physical print after personalization.</p></main></html>`);
await fs.writeFile(path.join(dir,'DESIGN_NOTES.md'),`# DigiStayBook QR placard concepts\n\nCreated October 30, 2026. Draft design exploration only; not added to the active campaign or published.\n\nFour original code-native designs: warm terracotta arch; botanical sage; coastal blue; editorial black and cream. Rendered with Sharp from editable SVG. No image-generation tool used. Existing logo: marketing/reference/digistaybook-logo-long-transparent.png. No photography or customer claims. Copy supports the product's house guidance, local favorites, and guest memories.\n\nEach pin is 1000 × 1500 px. Print artwork is A5 (148 × 210 mm), plus 1748 × 2480 px PNG with 300 dpi metadata. For home/office printing; no bleed or crop marks.\n\nAll codes encode ${destination}, the fictional demo property; four-module white quiet zone, M error correction. Replace BOTH property name and QR destination with the actual in-stay link (including its access token where needed) for a host's sign. These are concept drafts rather than a claim that the product already offers these templates. Physical print/device scanning remains to be checked.\n\n## Pinterest copy drafts\n\n${designs.map(d=>`### ${d.name}\nTitle: ${d.name}: a QR welcome sign for vacation rentals\nDescription: ${d.pinSub} Give guests a warm welcome and one place to find house tips, local favorites, and guest memories with DigiStayBook. Shown with our fictional demo property. Placard design concept.\nSuggested destination: https://digistaybook.com/\nAlt text: ${d.name} QR placard for Seabreeze Cottage, showing the guest demo code and a welcome message in ${d.style.toLowerCase()}.\n`).join('\n')}\nRebuild: node artifacts/marketing/qr-placards-2026-10-30/build.mjs\n`);
console.log(JSON.stringify({folder:dir,designs:manifest.length,outputs:'4 Pinterest PNGs + 4 A5 SVGs + 4 print PNGs + design board + review page + notes + manifest'}));
