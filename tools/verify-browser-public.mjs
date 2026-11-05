import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import jsQR from 'jsqr';
import { signStyles } from '../src/domain/signStyles.ts';
import { wifiQrPayload } from '../src/domain/wifi.ts';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5181';
assert.ok(['http://127.0.0.1:5181', 'http://127.0.0.1:5182'].includes(base));
const out = process.env.QA_EVIDENCE_DIR ?? 'artifacts/qa/browser';
await fs.mkdir(out, { recursive: true });
const engine = process.env.QA_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const sharp = require('sharp');
const results = [], errors = [];
page.on('pageerror', error => errors.push({ url: page.url(), message: error.message }));
async function test(name, run) {
  try { await run(); results.push({ name, status: 'pass' }); console.log('PASS', name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); console.error('FAIL', name, error.message.slice(0, 350)); await page.screenshot({ path: `${out}/public-failure-${results.length}.png`, fullPage: true }).catch(() => {}); }
}
async function goto(route) { await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.locator('main').first().waitFor(); }
async function qr(selector) {
  const target = page.locator(selector).first();
  await page.evaluate(() => document.fonts.ready);
  await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
  // Photo/font layout and scrolling can still settle after the SVG exists.
  await page.waitForTimeout(500);
  const image = await target.screenshot({ animations: 'disabled' });
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data;
}
try {
  for (const width of [320, 390, 1440]) for (const route of ['/', '/pricing', '/wall/demo-cottage', '/stay/demo-cottage', '/host/sign-in', '/host/sign-up', '/qr-sign-maker', '/blog', '/privacy-safety', '/contact', '/terms', '/privacy', '/guest-terms', '/not-a-real-route', '/reset-password?oobCode=invalid', '/operations']) {
    await test(`${width}px ${route}: renders, fits, and has no serious accessibility violations`, async () => {
      await page.setViewportSize({ width, height: 900 }); await goto(route);
      await page.locator('h1').first().waitFor();
      await page.waitForTimeout(300); // Let the footer observer and 200 ms launcher transition settle.
      const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(dimensions.content <= width + 1, JSON.stringify(dimensions));
      if (width === 390) {
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        assert.deepEqual(scan.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
      }
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const link = `${base}/stay/synthetic-qr-cottage/ABCDEFGHIJKLMNOPQRSTUV`;
  const wifi = { network: 'QA;Cabin:"Guest', password: 'pass;word:\\test' };
  for (const style of signStyles) await test(`${style.name}: rendered guest and escaped Wi-Fi QR codes decode correctly`, async () => {
    await goto(`/qr-sign-maker?style=${style.id}`);
    await page.getByLabel('Name of your place').fill('A long synthetic property name for QA');
    await page.getByLabel('Link the code opens').fill(link);
    await page.getByLabel('Network name').fill(wifi.network); await page.getByLabel('Password', { exact: true }).fill(wifi.password);
    // A frame lets the validated address update the drawing.
    await page.waitForFunction(expected => document.querySelector('#sign-link')?.value === expected && [...document.querySelectorAll('.sign-stage .sign-code')].length > 0, link);
    assert.equal(await qr('.sign-stage .sign-code'), link);
    assert.equal(await qr('.sign-stage .sign-wcode'), wifiQrPayload(wifi));
  });
} finally {
  await fs.writeFile(`${out}/public-browser-${engine.name()}.json`, JSON.stringify({ browser: await browser.version(), origin: base, scope: 'public routes, resized browser, automated accessibility, QR decoder; no physical devices or paper scans', results, errors }, null, 2));
  await browser.close();
}
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} public browser checks passed; ${errors.length} uncaught errors`);
process.exit(results.some(r => r.status === 'fail') || errors.length ? 1 : 0);
