// Eighteen printable placard styles, six with photographs. Each carries the same content as the app's
// card (src/ui/host/QrPlacard.tsx): lead, property name, the wall code, the
// invite, the address, the Wi-Fi code and the mark. Exports each as a 5 x 7 in
// print file (1500 x 2100, 300 dpi) and a 1000 x 1500 Pinterest image.
// Run: node source/styles.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const repo = path.resolve(root, '../../..');
const qrcode = createRequire(path.join(repo, 'package.json'))('qrcode-generator');
const requireTools = createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium} = requireTools('playwright'), sharp = requireTools('sharp');

// Same settings as src/domain/qrCode.ts: error correction M, four-module quiet zone.
function qr(data, cls) {
  const code = qrcode(0, 'M'); code.addData(data); code.make();
  const n = code.getModuleCount(), q = 4, parts = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!code.isDark(r, c)) continue;
    let run = 1; while (c + run < n && code.isDark(r, c + run)) run++;
    parts.push(`M${c + q} ${r + q}h${run}v1h-${run}z`); c += run - 1;
  }
  const s = n + q * 2;
  return `<svg class="${cls}" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${parts.join('')}" fill="#14181b"/></svg>`;
}
const WALL = qr('https://digistaybook.com/stay/demo-cottage', 'code');
const WIFI = qr('WIFI:T:WPA;S:SEABREEZE-5G;P:sandcastle42;;', 'wcode');
const invite = 'Scan to read the house guidance and to leave a memory behind.';
const address = 'digistaybook.com/stay/demo-cottage';
const wifi = (extra = '') => `<div class="wifi ${extra}">${WIFI}<p><b>Join the Wi-Fi</b>Scan with your camera to connect to SEABREEZE-5G</p></div>`;
const mark = '<p class="mark">DigiStayBook</p>';

// A sprig: a curved stem from (0,0) to (len,0) bowing up by `bow`, with
// pointed leaves alternating sides and shrinking toward the tip.
function sprig({len = 260, bow = 46, count = 11, dark = '#4f7a5c', light = '#7fa58a', stem = '#46664f'} = {}) {
  const at = t => ({x: 2 * (1 - t) * t * (len / 2) + t * t * len, y: 2 * (1 - t) * t * -bow});
  const angle = t => Math.atan2(2 * (1 - t) * -bow + 2 * t * bow, len) * 180 / Math.PI;
  const leafPath = (L, W) => `M0 0 C ${L * .25} ${-W}, ${L * .7} ${-W * .9}, ${L} 0 C ${L * .7} ${W * .9}, ${L * .25} ${W}, 0 0Z`;
  let out = `<path d="M0 0 Q ${len / 2} ${-bow} ${len} 0" fill="none" stroke="${stem}" stroke-width="2.6" stroke-linecap="round"/>`;
  for (let i = 0; i < count; i++) {
    const t = .1 + i * (.84 / (count - 1)), p = at(t), side = i % 2 ? 1 : -1;
    const L = 58 * (1 - .5 * t), W = L * .3, a = angle(t) + side * (48 - 14 * t);
    out += `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})"><path d="${leafPath(L, W)}" fill="${i % 3 === 1 ? light : dark}"/><path d="M2 0 L${(L * .82).toFixed(1)} 0" stroke="#fff" stroke-opacity=".35" stroke-width="1"/></g>`;
  }
  const e = at(1);
  out += `<g transform="translate(${e.x} ${e.y}) rotate(${angle(1).toFixed(1)})"><path d="${leafPath(34, 10)}" fill="${dark}"/></g>`;
  return out;
}

const styles = [
{id: '01-coastal', name: 'Coastal', backdrop: '#d7e5ec', html: `
<p class="lead">Welcome to</p><h1>Seabreeze Cottage</h1><div class="qrbox">${WALL}</div>
<p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}
<svg class="waves" viewBox="0 0 500 90" preserveAspectRatio="none"><path d="M0 30 Q 62 8 125 30 T 250 30 T 375 30 T 500 30 V90 H0Z" fill="#b9d3de"/><path d="M0 50 Q 62 30 125 50 T 250 50 T 375 50 T 500 50 V90 H0Z" fill="#8db7c9"/><path d="M0 68 Q 62 52 125 68 T 250 68 T 375 68 T 500 68 V90 H0Z" fill="#5f93ad"/></svg>${mark}`},
{id: '02-farmhouse', name: 'Farmhouse', backdrop: '#d9d2c4', html: `
<p class="big">WELCOME</p><h1>Seabreeze Cottage</h1><p class="orn">— ✦ —</p><div class="qrbox">${WALL}</div>
<p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '03-modern', name: 'Modern minimal', backdrop: '#e4e4e1', html: `
<i class="dot"></i><p class="lead">Everything you need for your stay</p><h1>Seabreeze<br>Cottage</h1><hr>
<div class="row"><div class="qrbox">${WALL}</div><div><p class="inv">${invite}</p><p class="addr">${address}</p></div></div>
${wifi()}${mark}`},
{id: '04-boho-arch', name: 'Boho arch', backdrop: '#e3cdb6', html: `
<div class="arch"><p class="lead">welcome to</p><h1>Seabreeze Cottage</h1><div class="qrbox">${WALL}</div><p class="inv">${invite}</p></div>
<p class="addr">${address}</p>${wifi()}${mark}<i class="sun s1"></i><i class="sun s2"></i>`},
{id: '05-botanical', name: 'Botanical', backdrop: '#cfdacb', html: `
<svg class="crest" viewBox="-250 -120 500 130"><g transform="rotate(-14)">${sprig({len: 210, bow: 34, count: 10})}</g><g transform="scale(-1 1) rotate(-14)">${sprig({len: 210, bow: 34, count: 10})}</g><circle r="5" fill="#46664f"/></svg><svg class="corner l" viewBox="-10 -110 240 120"><g transform="rotate(-12)">${sprig({len: 200, bow: 30, count: 9, dark: '#6f9478', light: '#9dbba5'})}</g></svg><svg class="corner r" viewBox="-10 -110 240 120"><g transform="rotate(-12)">${sprig({len: 200, bow: 30, count: 9, dark: '#6f9478', light: '#9dbba5'})}</g></svg>
<p class="lead">Everything you need for your stay</p><h1>Seabreeze Cottage</h1><div class="qrbox">${WALL}</div>
<p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '06-cabin', name: 'Mountain cabin', backdrop: '#c9cfc6', html: `
<svg class="peaks" viewBox="0 0 500 150" preserveAspectRatio="none"><path d="M0 150 L90 60 L150 110 L250 20 L340 100 L410 50 L500 120 V150Z" fill="#2f5546"/><path d="M250 20 L272 40 L258 44 L246 36 L232 38Z" fill="#f3ead8"/><path d="M0 150 L60 110 L130 140 L200 95 L300 150Z M260 150 L380 90 L500 150Z" fill="#3f6b57"/>${[[40,150],[70,150],[420,150],[455,150],[480,150]].map(([x,y],i)=>`<path d="M${x} ${y} l14 -${44+i%2*12} l14 ${44+i%2*12}z" fill="#163126"/>`).join('')}</svg>
<p class="lead">Everything you need for your stay</p><h1>Seabreeze Cottage</h1><div class="qrbox">${WALL}</div>
<p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '07-mid-century', name: 'Mid-century', backdrop: '#e6dcc4', html: `
<i class="c1"></i><i class="c2"></i><i class="c3"></i>
<p class="lead">Welcome to</p><h1>Seabreeze<br>Cottage</h1><div class="qrbox">${WALL}</div>
<p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '08-letterpress', name: 'Classic letterpress', backdrop: '#ddd6ca', html: `
<div class="frame"><span>◆</span><span>◆</span><span>◆</span><span>◆</span></div>
<p class="lead">Everything you need for your stay</p><h1>Seabreeze Cottage</h1><p class="orn">❦</p><div class="qrbox">${WALL}</div>
<p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '09-desert-sun', name: 'Desert sun', backdrop: '#ecd2bd', html: `
<p class="lead">Welcome to</p><h1>Seabreeze Cottage</h1>
<svg class="scene" viewBox="0 0 500 150" preserveAspectRatio="none"><circle cx="250" cy="105" r="62" fill="#eba06f"/><path d="M0 110 Q 120 70 250 105 T 500 95 V150 H0Z" fill="#d9774a"/><path d="M0 130 Q 150 100 300 128 T 500 120 V150 H0Z" fill="#b8553a"/><rect y="142" width="500" height="8" fill="#8e3d2c"/></svg>
<div class="qrbox">${WALL}</div><p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '10-color-block', name: 'Color block', backdrop: '#e9e3d8', html: `
<div class="top"><p class="lead">Everything you need for your stay</p><h1>Seabreeze Cottage</h1></div>
<div class="qrbox">${WALL}</div><p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '11-chalkboard', name: 'Chalkboard', backdrop: '#cdbfae', html: `
<p class="big">Welcome!</p><h1>Seabreeze Cottage</h1>
<svg class="arrow" viewBox="0 0 80 60"><path d="M6 8 C 30 4, 58 14, 64 46 M52 36 l12 12 l8 -16" fill="none" stroke="#f1efe8" stroke-width="3" stroke-linecap="round"/></svg>
<div class="qrbox">${WALL}</div><p class="inv">Scan me for the house guide, and leave a memory behind!</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '12-postcard', name: 'Retro postcard', backdrop: '#d6dce6', html: `
<div class="stamp"><b>SCAN</b><small>&amp; STAY</small></div>
<p class="big">Greetings from</p><h1>SEABREEZE COTTAGE</h1><div class="qrbox">${WALL}</div>
<p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '13-photo-top', name: 'Photo header', backdrop: '#e6ddd0', html: `
<div class="hero"><img class="ph" src="../reference/photos-full/cover.jpg" alt=""><div class="over"><p class="lead">Welcome to</p><h1>Seabreeze Cottage</h1></div></div>
<div class="qrbox">${WALL}</div><p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '14-polaroid', name: 'Polaroid', backdrop: '#d8d2c8', html: `
<div class="pola"><img class="ph" src="../reference/photos-full/memory-window.jpg" alt=""><p>Seabreeze Cottage</p></div>
<div class="qrbox">${WALL}</div><p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}`},
{id: '15-coast-panel', name: 'Coastal photo', backdrop: '#c9d6d6', html: `
<img class="ph" src="../reference/photos-full/memory-coast.jpg" alt=""><div class="panel"><p class="lead">Everything you need for your stay</p><h1>Seabreeze Cottage</h1>
<div class="qrbox">${WALL}</div><p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}${mark}</div>`},
{id: '16-sunset', name: 'Sunset photo', backdrop: '#e9c7b4', html: `
<img class="ph" src="../reference/photos-full/memory-evening.jpg" alt=""><p class="lead">Welcome to</p><h1>Seabreeze Cottage</h1>
<div class="qrbox">${WALL}</div><p class="inv">${invite}</p><div class="foot"><p class="addr">${address}</p>${wifi()}</div>${mark}`},
{id: '17-collage', name: 'Photo collage', backdrop: '#e3ddd2', html: `
<div class="grid4"><img class="ph" src="../reference/photos-full/cover.jpg" alt=""><img class="ph" src="../reference/photos-full/memory-fire.jpg" alt=""><img class="ph" src="../reference/photos-full/memory-table.jpg" alt=""></div>
<p class="lead">Everything you need for your stay</p><h1>Seabreeze Cottage</h1>
<div class="row"><div class="qrbox">${WALL}</div><div class="side"><p class="inv">${invite}</p><p class="addr">${address}</p></div></div>${wifi()}${mark}`},
{id: '18-arch-window', name: 'Arch photo', backdrop: '#d9dccd', html: `
<div class="archph"><img class="ph" src="../reference/photos-full/memory-garden.jpg" alt=""></div><p class="lead">Welcome to</p><h1>Seabreeze Cottage</h1>
<div class="row"><div class="qrbox">${WALL}</div><div class="side"><p class="inv">${invite}</p><p class="addr">${address}</p>${wifi()}</div></div>${mark}`},
];

const fonts = ['Cormorant+Garamond:ital,wght@0,500;0,600;1,500', 'Jost:wght@300;400;500;700', 'Bebas+Neue', 'Satisfy',
  'Libre+Baskerville:wght@400;700', 'Outfit:wght@400;600;800', 'Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,400',
  'DM+Serif+Display', 'Josefin+Sans:wght@400;600', 'Playfair+Display:ital,wght@0,600;1,500', 'Caveat:wght@500;700',
  'Alfa+Slab+One', 'Space+Mono'].map(f => 'family=' + f).join('&');

const css = `
*{box-sizing:border-box}body{margin:0;padding:30px;background:#888;display:flex;flex-wrap:wrap;gap:30px}
.card{position:relative;width:500px;height:700px;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;padding:44px 46px 0}
.card p,.card h1{margin:0}
.qrbox{background:#fff;line-height:0}.code{width:204px;height:204px;display:block}
.wifi{display:flex;align-items:center;gap:12px;text-align:left;margin-top:16px}.wcode{width:78px;height:78px;flex:none;display:block}
.wifi p{font-size:11.5px;line-height:1.4;max-width:190px}.wifi b{display:block;font-size:12.5px}
.inv{font-size:13px;line-height:1.45;max-width:30ch;margin-top:14px!important}
.addr{font:10.5px "Space Mono",monospace;margin-top:6px!important;opacity:.75}
.mark{position:absolute;left:0;right:0;bottom:20px;font:500 9px Jost,sans-serif;letter-spacing:.24em;text-transform:uppercase;opacity:.6}

.s-01-coastal{background:#eaf2f5;color:#1d3a4f;font-family:Jost,sans-serif}
.s-01-coastal .lead{font:italic 500 28px "Cormorant Garamond",serif}
.s-01-coastal h1{font:600 42px/1.05 "Cormorant Garamond",serif;margin:2px 0 18px}
.s-01-coastal .qrbox{padding:8px;border-radius:12px;box-shadow:0 0 0 2px #8db7c9}
.s-01-coastal .waves{position:absolute;left:0;bottom:0;width:100%;height:84px}
.s-01-coastal .mark{color:#fff;opacity:.9;bottom:14px}.s-01-coastal{padding-top:52px}.s-01-coastal .inv{margin-top:18px!important}.s-01-coastal .wifi{margin-top:20px}

.s-02-farmhouse{background:#f6f1e7;color:#222;font-family:"Libre Baskerville",serif;padding-top:52px}
.s-02-farmhouse::before{content:"";position:absolute;inset:16px;border:3px solid #222}
.s-02-farmhouse::after{content:"";position:absolute;inset:24px;border:1px solid #222}
.s-02-farmhouse .big{font:66px/0.9 "Bebas Neue",sans-serif;letter-spacing:.16em;margin-left:.16em!important}
.s-02-farmhouse h1{font:400 38px/1.1 Satisfy,cursive;margin-top:2px}
.s-02-farmhouse .orn{font-size:14px;margin:6px 0 12px!important;letter-spacing:.3em}
.s-02-farmhouse .qrbox{padding:6px;border:2px solid #222}.s-02-farmhouse .inv{font-size:12px}
.s-02-farmhouse .mark{bottom:34px}

.s-03-modern{background:#fff;color:#111;font-family:Outfit,sans-serif;align-items:stretch;text-align:left;padding:56px 48px 0}
.s-03-modern .dot{position:absolute;top:56px;right:48px;width:22px;height:22px;background:#111}
.s-03-modern .lead{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:600}
.s-03-modern h1{font:800 54px/.95 Outfit,sans-serif;letter-spacing:-.03em;margin:16px 0 24px}
.s-03-modern hr{border:0;border-top:2px solid #111;margin:0 0 26px;width:100%}
.s-03-modern .row{display:flex;gap:20px;align-items:flex-end}.s-03-modern .code{width:210px;height:210px}
.s-03-modern .row .inv{margin:0!important;font-size:14px;max-width:none}
.s-03-modern .wifi{margin-top:30px;padding-top:20px;border-top:1px solid #ccc}
.s-03-modern .mark{text-align:left;left:48px;opacity:1;font-weight:700}

.s-04-boho-arch{background:#efe2d2;color:#5a2c1c;font-family:Jost,sans-serif;padding-top:34px}
.s-04-boho-arch .arch{width:350px;padding:40px 30px 26px;border-radius:175px 175px 6px 6px;background:#c4673f;color:#fbf1e6;display:flex;flex-direction:column;align-items:center}
.s-04-boho-arch .lead{font:italic 400 24px Fraunces,serif}
.s-04-boho-arch h1{font:500 34px/1.05 Fraunces,serif;margin:2px 0 16px}
.s-04-boho-arch .qrbox{padding:8px;border-radius:8px}.s-04-boho-arch .code{width:180px;height:180px}
.s-04-boho-arch .inv{font-size:12.5px}.s-04-boho-arch .addr{margin-top:12px!important}.s-04-boho-arch .wifi{margin-top:10px}
.s-04-boho-arch .sun{position:absolute;width:90px;height:45px;border-radius:90px 90px 0 0;background:#d99a6c;bottom:0}
.s-04-boho-arch .s1{left:-20px}.s-04-boho-arch .s2{right:-20px;background:#b8553a;width:70px;height:35px}

.s-05-botanical{background:#e4ebe1;color:#2f4a3a;font-family:Jost,sans-serif;padding-top:26px}
.s-05-botanical .crest{width:300px;height:auto;display:block;margin-bottom:6px}
.s-05-botanical .corner{position:absolute;bottom:-6px;width:190px;height:auto}.s-05-botanical .corner.l{left:-8px}.s-05-botanical .corner.r{right:-8px;transform:scaleX(-1)}
.s-05-botanical .lead{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase}
.s-05-botanical h1{font:400 42px/1.05 "DM Serif Display",serif;margin:8px 0 18px}
.s-05-botanical .qrbox{padding:10px;border-radius:12px;box-shadow:0 0 0 2px #6f9478}.s-05-botanical .inv{margin-top:18px!important}

.s-06-cabin{background:#1e3a2f;color:#f3ead8;font-family:"Josefin Sans",sans-serif;padding-top:50px}
.s-06-cabin .peaks{position:absolute;bottom:0;left:0;width:100%;height:120px}.s-06-cabin .mark{bottom:10px;opacity:.85}.s-06-cabin .wifi{margin-top:14px}
.s-06-cabin .lead{font-size:11px;letter-spacing:.24em;text-transform:uppercase}
.s-06-cabin h1{font:600 38px/1.1 "Playfair Display",serif;margin:8px 0 16px}
.s-06-cabin .qrbox{padding:8px;background:#fff;outline:2px solid #f3ead8;outline-offset:4px}
.s-06-cabin .wifi .wcode{outline:2px solid #f3ead8;outline-offset:2px}

.s-07-mid-century{background:#f4ead5;color:#23302f;font-family:Jost,sans-serif}
.s-07-mid-century i{position:absolute;border-radius:50%}
.s-07-mid-century .c1{width:220px;height:220px;background:#e0a526;top:-90px;right:-70px}
.s-07-mid-century .c2{width:180px;height:180px;background:#2a7c7a;bottom:-110px;left:-60px}
.s-07-mid-century .c3{width:44px;height:44px;background:#d9622b;top:120px;left:40px}
.s-07-mid-century .lead{font-weight:300;font-size:22px;letter-spacing:.3em;text-transform:uppercase;position:relative}
.s-07-mid-century h1{font:700 42px/1 Jost,sans-serif;text-transform:uppercase;letter-spacing:.04em;margin:8px 0 18px;position:relative}
.s-07-mid-century .qrbox{padding:8px;border:4px solid #2a7c7a;position:relative}
.s-07-mid-century .inv,.s-07-mid-century .addr,.s-07-mid-century .wifi{position:relative}

.s-08-letterpress{background:#fbf8f1;color:#1d1d1b;font-family:"Cormorant Garamond",serif;padding-top:58px}
.s-08-letterpress .frame{position:absolute;inset:18px;border:1px solid #7a2a26;outline:4px double #7a2a26;outline-offset:-10px}
.s-08-letterpress .frame span{position:absolute;color:#7a2a26;font-size:14px;background:#fbf8f1;padding:2px}
.s-08-letterpress .frame span:nth-child(1){top:-11px;left:-8px}.s-08-letterpress .frame span:nth-child(2){top:-11px;right:-8px}
.s-08-letterpress .frame span:nth-child(3){bottom:-11px;left:-8px}.s-08-letterpress .frame span:nth-child(4){bottom:-11px;right:-8px}
.s-08-letterpress .lead{font-size:13px;letter-spacing:.22em;text-transform:uppercase;font-weight:600;color:#7a2a26}
.s-08-letterpress h1{font:italic 500 40px/1.1 "Playfair Display",serif;margin-top:8px}
.s-08-letterpress .orn{font-size:24px;color:#7a2a26;margin:2px 0 10px!important}
.s-08-letterpress .inv{font-size:16px;font-weight:500}.s-08-letterpress .wifi p{font-size:13px}
.s-08-letterpress .mark{bottom:38px}

.s-09-desert-sun{background:#fbf1e6;color:#6b2c1e;font-family:Jost,sans-serif;padding-top:38px}
.s-09-desert-sun .lead{font:italic 400 22px Fraunces,serif}
.s-09-desert-sun h1{font:400 40px/1.05 "DM Serif Display",serif;margin-top:2px;position:relative;z-index:1}
.s-09-desert-sun .scene{width:calc(100% + 92px);height:120px;margin:-10px -46px 0;display:block}
.s-09-desert-sun .qrbox{margin-top:-36px;padding:8px;border-radius:6px;box-shadow:0 0 0 3px #8e3d2c;position:relative}
.s-09-desert-sun .code{width:184px;height:184px}.s-09-desert-sun .inv{margin-top:18px!important}

.s-10-color-block{background:#fff;color:#14181b;font-family:Outfit,sans-serif;padding:0}
.s-10-color-block .top{width:100%;height:290px;background:#b4472a;color:#fff;padding:52px 40px 0}
.s-10-color-block .lead{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;font-weight:600;opacity:.9}
.s-10-color-block h1{font:700 52px/1 Fraunces,serif;margin-top:14px}
.s-10-color-block .qrbox{margin-top:-80px;padding:10px;border:3px solid #14181b}
.s-10-color-block .inv,.s-10-color-block .addr,.s-10-color-block .wifi{padding:0 46px}

.s-11-chalkboard{background:radial-gradient(ellipse at 30% 20%,#3a403e,#262a29 70%);color:#f1efe8;font-family:Caveat,cursive;border:18px solid #8a6240;padding-top:24px}
.s-11-chalkboard .big{font:700 58px/1 Caveat,cursive}
.s-11-chalkboard h1{font:500 36px/1 Caveat,cursive;margin:0 0 6px;border-bottom:2px solid rgba(241,239,232,.6);padding-bottom:4px}
.s-11-chalkboard .arrow{position:absolute;width:70px;left:46px;top:150px}
.s-11-chalkboard .qrbox{padding:8px;border-radius:4px;margin-top:8px}.s-11-chalkboard .code{width:166px;height:166px}
.s-11-chalkboard .inv{font-size:22px;line-height:1.1;margin-top:10px!important}
.s-11-chalkboard .addr{color:#f1efe8}.s-11-chalkboard .wifi p{font-size:18px;line-height:1.1}.s-11-chalkboard .wifi b{font-size:21px}
.s-11-chalkboard .mark{font-family:Jost,sans-serif;bottom:8px}

.s-12-postcard{background:#f6efe0;color:#22355e;font-family:Jost,sans-serif;border:14px solid;border-image:repeating-linear-gradient(-45deg,#c0392b 0 14px,#f6efe0 14px 24px,#2c4f8a 24px 38px,#f6efe0 38px 48px) 14;padding-top:40px}
.s-12-postcard .stamp{position:absolute;top:22px;right:22px;width:78px;height:78px;border:2px dashed #c0392b;border-radius:50%;color:#c0392b;display:flex;flex-direction:column;justify-content:center;transform:rotate(12deg);font-size:15px;line-height:1}
.s-12-postcard .stamp small{font-size:10px;letter-spacing:.1em}
.s-12-postcard .big{font:400 40px Satisfy,cursive;color:#c0392b;margin-top:22px!important}
.s-12-postcard h1{font:400 33px/1.05 "Alfa Slab One",serif;letter-spacing:.02em;margin:0 0 16px}
.s-12-postcard .qrbox{padding:8px;border:2px solid #22355e}.s-12-postcard .code{width:166px;height:166px}

.ph{display:block;object-fit:cover}
.s-13-photo-top{background:#fbf7ef;color:#1f2a2e;font-family:Jost,sans-serif;padding:0 46px}
.s-13-photo-top .hero{position:relative;width:calc(100% + 92px);height:268px;margin:0 -46px 22px}
.s-13-photo-top .hero .ph{width:100%;height:100%;object-position:50% 60%}
.s-13-photo-top .over{position:absolute;inset:auto 0 0;padding:60px 20px 18px;background:linear-gradient(transparent,rgba(16,20,22,.78));color:#fff}
.s-13-photo-top .lead{font:italic 400 22px Fraunces,serif}.s-13-photo-top h1{font:500 40px/1.05 Fraunces,serif}
.s-13-photo-top .code{width:186px;height:186px}.s-13-photo-top .qrbox{padding:6px;border:2px solid #1f2a2e}

.s-14-polaroid{background:#f1ece3;color:#2a2622;font-family:Jost,sans-serif;padding-top:28px}
.s-14-polaroid .pola{background:#fff;padding:11px 11px 0;box-shadow:0 10px 18px -8px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.05);transform:rotate(-3deg);margin-bottom:16px}
.s-14-polaroid .pola .ph{width:280px;height:190px}
.s-14-polaroid .pola p{font:700 30px/1 Caveat,cursive;padding:12px 0 14px;color:#2a2622}
.s-14-polaroid .code{width:170px;height:170px}.s-14-polaroid .qrbox{padding:6px;border:2px solid #2a2622}
.s-14-polaroid .inv{margin-top:12px!important}

.s-15-coast-panel{padding:0;justify-content:center;font-family:Jost,sans-serif;color:#1d3a4f}
.s-15-coast-panel>.ph{position:absolute;inset:0;width:100%;height:100%}
.s-15-coast-panel .panel{position:relative;width:392px;padding:28px 26px 46px;background:rgba(255,255,255,.93);border-radius:6px;display:flex;flex-direction:column;align-items:center;box-shadow:0 18px 40px -16px rgba(0,0,0,.5)}
.s-15-coast-panel .lead{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase}
.s-15-coast-panel h1{font:600 36px/1.05 "Cormorant Garamond",serif;margin:6px 0 14px}
.s-15-coast-panel .code{width:176px;height:176px}.s-15-coast-panel .mark{bottom:14px}

.s-16-sunset{color:#fff;font-family:Jost,sans-serif;padding-top:44px}
.s-16-sunset>.ph{position:absolute;inset:0;width:100%;height:100%;object-position:40% 50%}
.s-16-sunset::before{content:"";position:absolute;inset:0;background:linear-gradient(rgba(20,12,20,.35),rgba(20,12,20,.1) 40%,rgba(20,12,20,.72) 72%)}
.s-16-sunset>*{position:relative}
.s-16-sunset .lead{font:italic 400 26px "Cormorant Garamond",serif;text-shadow:0 1px 8px rgba(0,0,0,.4)}
.s-16-sunset h1{font:600 46px/1.02 "Cormorant Garamond",serif;margin-bottom:20px;text-shadow:0 2px 14px rgba(0,0,0,.45)}
.s-16-sunset .qrbox{padding:8px;border-radius:10px}.s-16-sunset .code{width:184px;height:184px}
.s-16-sunset .inv{text-shadow:0 1px 6px rgba(0,0,0,.6)}.s-16-sunset .foot{display:flex;flex-direction:column;align-items:center}
.s-16-sunset .addr{opacity:.9}.s-16-sunset .wcode{border-radius:4px}.s-16-sunset>.mark{position:absolute;opacity:.85}
.s-16-sunset>.ph{position:absolute}

.s-17-collage{background:#fbf8f2;color:#1f2a2e;font-family:Outfit,sans-serif;padding:20px 20px 0}
.s-17-collage .grid4{display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:112px 112px;gap:6px;width:100%;height:230px;margin-bottom:18px}
.s-17-collage .grid4 .ph{width:100%;height:112px}.s-17-collage .grid4 .ph:first-child{grid-row:span 2;height:230px}
.s-17-collage .lead{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;color:#b4472a}
.s-17-collage h1{font:700 34px/1.05 Fraunces,serif;margin:4px 0 14px}
.s-17-collage .row,.s-18-arch-window .row{display:flex;gap:18px;align-items:center;text-align:left;padding:0 26px}
.s-17-collage .code{width:172px;height:172px}.s-17-collage .qrbox{padding:5px;border:2px solid #1f2a2e}
.s-17-collage .side .inv{margin-top:0!important;font-size:13.5px}.s-17-collage .wifi{margin-top:18px}

.s-18-arch-window{background:#eef0e6;color:#2f3d2f;font-family:Jost,sans-serif;padding-top:30px}
.s-18-arch-window .archph{width:300px;height:250px;border-radius:150px 150px 0 0;overflow:hidden;border:6px solid #fff;box-shadow:0 0 0 1px #c9cfbd;margin-bottom:16px}
.s-18-arch-window .archph .ph{width:100%;height:100%;object-position:50% 70%}
.s-18-arch-window .lead{font:italic 400 22px "DM Serif Display",serif;opacity:.8}
.s-18-arch-window h1{font:400 38px/1.05 "DM Serif Display",serif;margin:0 0 16px}
.s-18-arch-window .row{padding:0}.s-18-arch-window .code{width:168px;height:168px}.s-18-arch-window .qrbox{padding:6px;border-radius:6px;box-shadow:0 0 0 2px #7f9a7a}
.s-18-arch-window .side .inv{margin-top:0!important;font-size:12.5px}.s-18-arch-window .side .wifi{margin-top:10px}.s-18-arch-window .wcode{width:66px;height:66px}
.s-18-arch-window .wifi p{font-size:10.5px;max-width:150px}
`;

const html = `<!doctype html><html lang="en-US"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=block"><style>${css}</style></head>
<body>${styles.map(s => `<section class="card s-${s.id}" data-id="${s.id}">${s.html}</section>`).join('')}</body></html>`;
await fs.writeFile(path.join(here, 'styles.html'), html);

const outPrint = path.join(root, 'styles', 'print-5x7'), outPin = path.join(root, 'styles', 'pinterest');
await fs.mkdir(outPrint, {recursive: true}); await fs.mkdir(outPin, {recursive: true});
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1700, height: 1200}, deviceScaleFactor: 3});
await page.goto(pathToFileURL(path.join(here, 'styles.html')).href, {waitUntil: 'networkidle'});
await page.evaluate(() => document.fonts.ready);
const missing = await page.evaluate(() => ['Cormorant Garamond', 'Jost', 'Bebas Neue', 'Satisfy', 'Outfit', 'Fraunces', 'DM Serif Display', 'Caveat', 'Alfa Slab One', 'Playfair Display'].filter(f => !document.fonts.check(`20px "${f}"`)));
if (missing.length) throw Error('fonts did not load: ' + missing.join(', '));
const shadow = Buffer.from(`<svg width="1000" height="1500"><defs><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs><rect x="82" y="128" width="836" height="1270" rx="4" fill="rgba(40,30,20,.35)" filter="url(#b)"/></svg>`);
const manifest = [];
for (const s of styles) {
  const card = page.locator(`[data-id="${s.id}"]`);
  const overflow = await card.evaluate(el => { const b = el.getBoundingClientRect(); return [...el.querySelectorAll('p,h1,.wifi,.qrbox')].filter(n => { const r = n.getBoundingClientRect(); return r.bottom > b.bottom - 14 || r.right > b.right || r.left < b.left; }).map(n => n.className || n.tagName); });
  if (overflow.length) console.warn(s.id, 'near or past the edge:', overflow);
  const print = path.join(outPrint, `placard-${s.id}.png`);
  await card.screenshot({path: print});
  await sharp(print).withMetadata({density: 300}).toFile(print + '.tmp'); await fs.rename(print + '.tmp', print);
  const pin = path.join(outPin, `pin-placard-${s.id}.png`);
  const scaled = await sharp(print).resize(860, 1204).toBuffer();
  await sharp({create: {width: 1000, height: 1500, channels: 3, background: s.backdrop}})
    .composite([{input: shadow}, {input: scaled, left: 70, top: 140}]).png().toFile(pin);
  manifest.push({id: s.id, style: s.name, print: path.relative(root, print), pinterest: path.relative(root, pin)});
}
await browser.close();
const tiles = [];
for (let i = 0; i < styles.length; i++) tiles.push({input: await sharp(path.join(outPrint, `placard-${styles[i].id}.png`)).resize(250, 350).toBuffer(), left: (i % 6) * 270 + 20, top: Math.floor(i / 6) * 370 + 20});
await sharp({create: {width: 1640, height: 3 * 370 + 20, channels: 3, background: '#cfc8bb'}}).composite(tiles).jpeg({quality: 88}).toFile(path.join(root, 'styles', 'STYLES_CONTACT_SHEET.jpg'));
await fs.writeFile(path.join(root, 'styles', 'STYLES_MANIFEST.json'), JSON.stringify(manifest, null, 2));
console.log('exported', manifest.length);
