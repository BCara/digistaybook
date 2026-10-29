// Capture the live demo in phone emulation through the Chrome DevTools protocol.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, out] = process.argv.slice(2);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cap-'))}`, 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
await send('Page.enable'); await send('Page.navigate', { url }); await sleep(6000);
const js = e => send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
const snap = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name), Buffer.from(r.data, 'base64')); console.log('saved', name); };
const byText = t => `[...document.querySelectorAll('h1,h2,h3,button,a,p,div')].find(e => e.children.length < 4 && e.textContent.trim().startsWith(${JSON.stringify(t)}))`;
const scrollTo = async (t, pad = 120) => { await js(`(()=>{const e=${byText(t)};window.scrollTo(0,e.getBoundingClientRect().top+scrollY-${pad});})()`); await sleep(1800); };
await snap('screen-1-welcome.png');
await scrollTo('Your stay essentials'); await snap('screen-2-essentials.png');
await js(`${byText('Checkout')}.click()`); await sleep(1800); await snap('screen-3-checkout.png');
await send('Page.reload'); await sleep(5000);
for (let y = 0; y < 7000; y += 600) { await js(`window.scrollTo(0,${y})`); await sleep(250); }
await scrollTo('8 memories left here', 110); await sleep(1500); await snap('screen-4-wall.png');
ws.close(); chrome.kill();
