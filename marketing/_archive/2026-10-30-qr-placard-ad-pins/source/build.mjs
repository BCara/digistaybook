// Builds pins.html from the app's real placard (same words, same QR encoding as
// src/ui/host/QrPlacard.tsx), then exports each pin as a 1000 x 1500 PNG with a
// contact sheet. Run from anywhere: node source/build.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const repo = path.resolve(root, '../../..');
const requireRepo = createRequire(path.join(repo, 'package.json'));
const qrcode = requireRepo('qrcode-generator');
const requireTools = createRequire('C:/Users/clbbe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium} = requireTools('playwright'), sharp = requireTools('sharp');

// Same error correction, quiet zone and run-length path as src/domain/qrCode.ts.
function qrSvg(data, label, cls) {
  const code = qrcode(0, 'M'); code.addData(data); code.make();
  const n = code.getModuleCount(), q = 4, parts = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!code.isDark(r, c)) continue;
    let run = 1; while (c + run < n && code.isDark(r, c + run)) run++;
    parts.push(`M${c + q} ${r + q}h${run}v1h-${run}z`); c += run - 1;
  }
  const s = n + q * 2;
  return `<svg class="${cls}" viewBox="0 0 ${s} ${s}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${parts.join('')}" fill="#14181b"/></svg>`;
}

const wall = 'https://digistaybook.com/stay/demo-cottage';
const wifi = {network: 'SEABREEZE-5G', password: 'sandcastle42'};
const wallCode = qrSvg(wall, 'QR code for the demo guest wall', 'placard-code');
const wifiCode = qrSvg(`WIFI:T:WPA;S:${wifi.network};P:${wifi.password};;`, 'QR code to join the demo Wi-Fi', 'placard-wifi-code');

const placard = ({wifi: withWifi = true, zoom = 1, extra = ''} = {}) => `
<div class="placard-card ${extra}" style="zoom:${zoom}">
  <p class="placard-lead">Everything you need for your stay</p>
  <h4 class="placard-name">Seabreeze Cottage</h4>
  ${wallCode}
  <p class="placard-invite">Scan to read the house guidance and to leave a memory behind.</p>
  <p class="placard-address">digistaybook.com/stay/demo-cottage</p>
  ${withWifi ? `<div class="placard-wifi">${wifiCode}<p class="placard-wifi-text"><strong>Join the Wi-Fi</strong>Scan with your camera to connect to ${wifi.network}</p></div>` : ''}
  <p class="placard-mark">DigiStayBook</p>
</div>`;

const foot = (note = 'Demo property shown') => `
<footer><img src="../reference/logo.png" alt="DigiStayBook"><span>${note} · digistaybook.com</span></footer>`;

const pins = [
{file: 'pin-01-scan-connect.png', reason: '9. Guests get online first', html: `
<section class="pin p1" data-file="pin-01-scan-connect.png">
  <p class="kicker">Vacation rental welcome sign</p>
  <h1>Scan, connect,<br>settle in.</h1>
  <p class="sub">One printed card: the house guide, and a Wi-Fi code that joins with a single scan.</p>
  <div class="scene">
    <div class="frame oak">${placard({zoom: 1.32})}</div>
    <div class="shelf"></div>
  </div>
  ${foot()}
</section>`},
{file: 'pin-02-welcome-not-laminated.png', reason: 'Core reason', html: `
<section class="pin p2" data-file="pin-02-welcome-not-laminated.png">
  <p class="kicker">For vacation rental hosts</p>
  <h1>Give your guests a welcome, <em>not a laminated sheet.</em></h1>
  <div class="flatlay">
    <div class="sheet"><b>HOUSE RULES</b><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="lay">${placard({zoom: 1.24})}</div>
    <div class="tag"><span></span>Welcome</div>
  </div>
  ${foot()}
</section>`},
{file: 'pin-03-print-once.png', reason: '10. Update it once, every guest sees it', html: `
<section class="pin p3" data-file="pin-03-print-once.png">
  <p class="kicker">The QR sign you never reprint</p>
  <h1>Print it once.<br>Change the Wi-Fi password anytime.</h1>
  <div class="pair">
    <div class="col">${placard({wifi: false, zoom: .98})}<p class="cap">The card stays the same</p></div>
    <div class="arrow">→</div>
    <div class="col"><div class="phone"><img src="../reference/demo-arrival.png" alt="Demo guest wall on a phone"></div><p class="cap">The page behind it updates</p></div>
  </div>
  ${foot('Demo guest wall shown')}
</section>`},
{file: 'pin-04-where-to-put-it.png', reason: '1. Guests can find everything themselves', html: `
<section class="pin p4" data-file="pin-04-where-to-put-it.png">
  <p class="kicker">Vacation rental host tips</p>
  <h1>Where to put your QR placard</h1>
  <ol class="spots">
    <li><div class="mini door">${placard({wifi: false, zoom: .42})}</div><div><b>By the front door</b><span>The first thing guests see with their bags still in hand.</span></div></li>
    <li><div class="mini counter">${placard({wifi: false, zoom: .42})}</div><div><b>On the kitchen counter</b><span>Next to the kettle or coffee maker, where everyone stops.</span></div></li>
    <li><div class="mini bedside">${placard({wifi: false, zoom: .42})}</div><div><b>On the bedside table</b><span>For the late arrival and checkout morning.</span></div></li>
  </ol>
  <p class="tip"><b>Before guests arrive:</b> scan it from where a guest would stand, in the evening light.</p>
  ${foot()}
</section>`},
{file: 'pin-05-answers-on-counter.png', reason: '1. Guests can find everything themselves', html: `
<section class="pin p5" data-file="pin-05-answers-on-counter.png">
  <p class="kicker">Vacation rental guest guide</p>
  <h1>The answers are on the counter, <em>not in your inbox.</em></h1>
  <div class="counter-scene">
    <div class="acrylic">${placard({zoom: 1})}</div>
    <ul class="chips"><li>Wi-Fi</li><li>Trash day</li><li>Heating</li><li>Checkout</li><li>Parking</li><li>Local favorites</li></ul>
    <div class="worktop"></div>
  </div>
  <p class="sub small">No app, no account. It opens in the phone's browser.</p>
  ${foot()}
</section>`},
{file: 'pin-06-story-of-your-place.png', reason: '3. A guestbook that builds up instead of filling up', html: `
<section class="pin p6" data-file="pin-06-story-of-your-place.png">
  <p class="kicker">A guestbook for vacation rentals</p>
  <h1>Every stay adds to the story of your place.</h1>
  <p class="sub">Guests scan the card to leave a photo, a note or a local tip for the next guest.</p>
  <div class="pair tight">
    <div class="lean">${placard({wifi: false, zoom: 1.12})}</div>
    <div class="phone big"><img src="../reference/demo-public-wall.png" alt="Demo memories page on a phone"></div>
  </div>
  ${foot('Demo memories shown')}
</section>`},
];

const css = `
*{box-sizing:border-box}body{margin:0;background:#ddd;display:grid;gap:40px;padding:40px;justify-content:center;font-family:"Segoe UI",system-ui,sans-serif}
.pin{position:relative;width:1000px;height:1500px;overflow:hidden;padding:88px 84px 0;color:#14181b;display:flex;flex-direction:column}
.kicker{margin:0 0 22px;font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:#5d6d78;font-weight:600}
h1{margin:0;font-family:"Palatino Linotype",Palatino,Georgia,serif;font-weight:400;font-size:82px;line-height:1.04;letter-spacing:-.015em}
h1 em{font-style:italic;color:#b4472a}
.sub{margin:26px 0 0;max-width:30ch;font-size:28px;line-height:1.45;color:#33404a}.sub.small{font-size:24px;max-width:none;margin-top:18px}
footer{position:absolute;left:0;right:0;bottom:0;height:104px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;background:#f7f2e8;border-top:1px solid rgba(20,24,27,.1)}
footer img{height:54px}footer span{font-size:19px;color:#5d6d78}

/* The placard, as styled in src/styles.css and src/ui/pages/hostQr.css. */
.placard-card{width:340px;padding:26px 24px 18px;text-align:center;background:#fff;color:#14181b;border:1px solid rgba(20,24,27,.16);border-radius:3px}
.placard-lead{margin:0;font-size:12.3px;letter-spacing:.12em;text-transform:uppercase;color:#5d6d78}
.placard-name{margin:6px 0 18px;font-family:"Palatino Linotype",Palatino,Georgia,serif;font-size:22px;font-weight:600;line-height:1.2}
.placard-code{display:block;width:210px;height:auto;margin:0 auto}
.placard-invite{margin:16px auto 0;max-width:26ch;font-size:14.4px;line-height:1.5;color:#33404a}
.placard-address{margin:10px 0 0;font-family:Consolas,ui-monospace,monospace;font-size:12.3px;color:#5d6d78}
.placard-wifi{display:flex;align-items:center;gap:14px;margin:16px 0 0;padding-top:14px;border-top:1px solid rgba(20,24,27,.12);text-align:left}
.placard-wifi-code{flex:none;width:96px;height:auto}
.placard-wifi-text{margin:0;font-size:13.5px;line-height:1.45;color:#33404a}.placard-wifi-text strong{display:block;color:#14181b}
.placard-mark{margin:16px 0 0;padding-top:12px;border-top:1px solid rgba(20,24,27,.12);font-size:12.3px;letter-spacing:.14em;text-transform:uppercase;color:#7d8c96}

/* 1: framed on a shelf against a sage wall */
.p1{background:linear-gradient(#dfe7e0,#cfdbd2)}
.p1 .scene{position:relative;flex:1;display:flex;justify-content:center;align-items:flex-end;padding-bottom:168px}
.frame.oak{position:relative;z-index:1;padding:22px;background:linear-gradient(135deg,#c79a63,#a87442 45%,#c08e58 70%,#9c6a3b);border-radius:4px;box-shadow:0 30px 40px -18px rgba(40,30,15,.55),inset 0 0 0 2px rgba(255,255,255,.18);transform:rotate(-1.5deg)}
.frame.oak .placard-card{width:376px;border:18px solid #faf7f0;outline:1px solid rgba(0,0,0,.08);padding:20px 18px 14px}
.p1 .shelf{position:absolute;left:-84px;right:-84px;bottom:104px;height:72px;background:linear-gradient(#e9dcc6,#d2bf9f 30%,#bca582);box-shadow:0 -6px 18px rgba(60,45,20,.18)}

/* 2: flat lay, the card beside the sheet it replaces */
.p2{background:#efe8da}
.p2 h1{font-size:76px}
.flatlay{position:relative;flex:1}
.sheet{position:absolute;left:-40px;top:190px;width:330px;height:440px;padding:34px 30px;background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(235,240,245,.75));border:2px solid rgba(255,255,255,.95);border-radius:10px;box-shadow:0 0 0 1px rgba(20,24,27,.12),0 14px 26px -12px rgba(0,0,0,.3);transform:rotate(-9deg);opacity:.92;filter:saturate(.4)}
.sheet b{display:block;font:700 22px/1 Arial,sans-serif;letter-spacing:.06em;color:#4a5560;margin-bottom:22px}
.sheet i{display:block;height:10px;margin:0 0 17px;background:#b9c2ca;border-radius:2px}.sheet i:nth-of-type(3n){width:72%}.sheet i:nth-of-type(4n){width:86%}
.lay{position:absolute;right:0;top:60px;transform:rotate(3deg);box-shadow:0 34px 46px -22px rgba(40,30,15,.55);z-index:1}
.tag{position:absolute;left:120px;bottom:190px;z-index:2;padding:16px 30px 16px 52px;background:#b4472a;color:#fdfaf4;font:italic 30px/1 "Palatino Linotype",Georgia,serif;clip-path:polygon(28px 0,100% 0,100% 100%,28px 100%,0 50%);transform:rotate(-12deg);box-shadow:0 10px 20px rgba(0,0,0,.2)}
.tag span{position:absolute;left:24px;top:50%;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:#efe8da}

/* 3: card and phone */
.p3{background:#14181b;color:#f5f1e8}.p3 .kicker{color:#a4b0b8}.p3 h1{font-size:74px}
.pair{flex:1;display:flex;align-items:center;justify-content:center;gap:26px;padding-bottom:110px}
.col{display:flex;flex-direction:column;align-items:center}
.cap{margin:22px 0 0;font-size:22px;color:#cd6844;font-weight:600;letter-spacing:.02em}
.arrow{font-size:60px;color:#cd6844;margin-bottom:40px}
.phone{width:300px;height:620px;padding:12px;border-radius:44px;background:#05080a;box-shadow:0 0 0 2px #3a444c,0 30px 50px -20px rgba(0,0,0,.6);overflow:hidden}
.phone img{display:block;width:100%;height:100%;object-fit:cover;object-position:top;border-radius:33px}
.phone.big{width:350px;height:740px}

/* 4: placement guide */
.p4{background:#fdfaf4}.p4 h1{font-size:76px}
.spots{list-style:none;margin:44px 0 0;padding:0;display:grid;gap:26px}
.spots li{display:flex;align-items:center;gap:34px;padding:22px 26px;background:#f7f2e8;border-radius:10px;border:1px solid rgba(20,24,27,.08)}
.spots b{display:block;font:600 36px/1.15 "Palatino Linotype",Georgia,serif;margin-bottom:8px}.spots span{font-size:24px;line-height:1.4;color:#33404a}
.mini{flex:none;width:210px;height:220px;border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.mini .placard-card{box-shadow:0 10px 16px -8px rgba(0,0,0,.35);position:relative;z-index:1}
.mini.door{background:linear-gradient(90deg,#c9d6cc 0 62%,#33604c 62% 64%,#e2ebe4 64%)}
.mini.counter{background:linear-gradient(#efe8da 0 76%,#bca582 76%)}.mini.counter .placard-card{margin-top:-14px}
.mini.bedside{background:linear-gradient(#e7dfd2 0 74%,#8f6a48 74%)}.mini.bedside .placard-card{margin-top:-12px}
.tip{margin:30px 0 0;padding:22px 26px;border-left:6px solid #b4472a;background:#f6e6de;font-size:24px;line-height:1.45;color:#33404a}.tip b{color:#14181b}

/* 5: counter with acrylic stand */
.p5{background:linear-gradient(#f7f2e8 0 70%,#efe8da)}.p5 h1{font-size:76px}
.counter-scene{position:relative;flex:1;display:flex;align-items:flex-end;justify-content:center;padding-bottom:40px;margin-top:10px}
.acrylic{position:relative;z-index:2;padding:16px 16px 34px;background:linear-gradient(115deg,rgba(255,255,255,.85),rgba(220,232,236,.35) 40%,rgba(255,255,255,.7));border:1px solid rgba(160,180,190,.6);border-radius:6px;box-shadow:0 26px 34px -20px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.7);margin-left:250px}
.chips{position:absolute;left:0;top:30px;z-index:3;list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.chips li{width:max-content;padding:12px 22px;background:#fff;border-radius:999px;font-size:23px;font-weight:600;color:#33604c;box-shadow:0 6px 14px -6px rgba(0,0,0,.25);border:1px solid rgba(51,96,76,.25)}
.chips li:nth-child(odd){margin-left:28px}
.worktop{position:absolute;left:-84px;right:-84px;bottom:0;height:70px;background:linear-gradient(#d9d2c4,#c6bba7);border-top:3px solid #ece5d6;z-index:1}
.p5 .sub.small{margin-bottom:130px}

/* 6: the story */
.p6{background:#b4472a;color:#fdfaf4}.p6 .kicker{color:#f6e6de}.p6 .sub{color:#f6e6de}.p6 h1{font-size:76px}
.pair.tight{gap:0;align-items:flex-end;padding-bottom:140px}
.lean{transform:rotate(-4deg) translateX(40px);z-index:1;box-shadow:0 30px 40px -20px rgba(0,0,0,.5)}
.p6 .phone{transform:rotate(3deg) translateX(-10px)}
`;

const html = `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>QR placard pins</title><style>${css}</style></head><body>${pins.map(p => p.html).join('')}</body></html>`;
await fs.writeFile(path.join(here, 'pins.html'), html);

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1100, height: 1600}});
await page.goto(pathToFileURL(path.join(here, 'pins.html')).href, {waitUntil: 'load'});
await page.evaluate(() => document.fonts.ready);
const manifest = [];
for (const pin of pins) {
  const el = page.locator(`[data-file="${pin.file}"]`);
  const overlap = await el.evaluate(n => {
    const f = n.querySelector('footer').getBoundingClientRect();
    return [...n.querySelectorAll('h1,.sub,.kicker,.tip,.spots li,.cap')].filter(x => x.getBoundingClientRect().bottom > f.top + 1).map(x => x.textContent.slice(0, 50));
  });
  if (overlap.length) console.warn(pin.file, 'runs into the footer:', overlap);
  const out = path.join(root, 'assets', pin.file);
  await el.screenshot({path: out});
  manifest.push({file: pin.file, reason: pin.reason, width: 1000, height: 1500});
}
await browser.close();

const tiles = [];
for (let i = 0; i < pins.length; i++) {
  tiles.push({input: await sharp(path.join(root, 'assets', pins[i].file)).resize(360, 540).toBuffer(), left: (i % 3) * 380 + 20, top: Math.floor(i / 3) * 580 + 20});
}
await sharp({create: {width: 1160, height: Math.ceil(pins.length / 3) * 580 + 20, channels: 3, background: '#e9e4d8'}}).composite(tiles).jpeg({quality: 88}).toFile(path.join(root, 'CONTACT_SHEET.jpg'));
await fs.writeFile(path.join(root, 'ASSET_MANIFEST.json'), JSON.stringify(manifest, null, 2));
console.log('exported', manifest.length);
