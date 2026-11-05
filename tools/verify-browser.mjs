// Requires the local Test launcher. Uses synthetic accounts/data only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import jsQR from 'jsqr';
import { unzipSync, strFromU8 } from 'fflate';

const base = 'http://127.0.0.1:5181';
const out = process.env.QA_EVIDENCE_DIR ?? 'artifacts/qa/browser';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
require('firebase-admin/app').initializeApp({ projectId: 'demo-digistaybook' });
const db = require('firebase-admin/firestore').getFirestore();
const sharp = require('sharp');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) });
const results = [], faults = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU', acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => faults.push({ url: page.url(), error: error.message }));
page.on('dialog', dialog => dialog.accept());
async function test(name, run, target = page) {
  try { await run(); results.push({ name, status: 'pass' }); console.log('PASS', name); }
  catch (error) {
    results.push({ name, status: 'fail', error: error.message }); console.error('FAIL', name, error.message.slice(0, 350));
    await target.screenshot({ path: `${out}/failure-${results.length}.png`, fullPage: true }).catch(() => {});
    await target.keyboard.press('Escape').catch(() => {});
  }
  await fs.writeFile(`${out}/browser-journeys.json`, JSON.stringify({ scope: 'Chromium; simulated desktop and phone viewports; local demo services', results, faults }, null, 2));
}
async function goto(route, target = page) { await target.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
async function signIn(email = 'host@example.test', target = page) {
  await goto('/host/sign-in', target);
  await target.getByLabel('Email', { exact: true }).fill(email);
  await target.getByLabel('Password', { exact: true }).fill('LocalTest-2026!');
  await target.getByRole('button', { name: 'Sign in', exact: true }).click();
  await target.waitForURL('**/host');
}
async function saveSection() { await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); }
async function decode(bytes) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data;
}
let propertyId, slug, token;
const name = `Browser QA ${randomUUID().slice(0, 8)}`;
try {
  await test('real keyboard skip link reaches main content past the local test banner', async () => {
    await goto('/'); await page.locator('.skip-link').waitFor({ state: 'attached' }); await page.keyboard.press('Tab');
    if ((await page.locator(':focus').getAttribute('href')) === '/__test') await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    await page.keyboard.press('Enter'); assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
  });
  await test('invalid credentials show a recoverable error, then valid host sign-in succeeds', async () => {
    await goto('/host/sign-in');
    await page.getByLabel('Email', { exact: true }).fill('host@example.test');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('That email address and password do not match a host account.').waitFor();
    await page.getByLabel('Password', { exact: true }).fill('LocalTest-2026!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/host');
  });
  await test('new-property dialog validates, traps keyboard focus and creates a private property', async () => {
    await page.getByRole('button', { name: 'Add property', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.getByText(/at least 2 characters/).waitFor();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).focus();
    await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)));
    await dialog.getByLabel('Property name').fill(name);
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(/\/host\/property\//); propertyId = new URL(page.url()).pathname.split('/')[3];
    const data = (await db.doc(`properties/${propertyId}`).get()).data(); slug = data.slug; token = data.stayToken;
    assert.equal(data.lifecycle, 'draft'); assert.equal(data.mode, 'sandbox');
  });
  if (!propertyId) throw new Error('Creation failed; dependent browser journeys cannot proceed');
  await test('all six phone editor sections save and retain their review checks after reload', async () => {
    for (const section of [/Property details/, /Welcome & hosts/, /Wi-Fi and essentials/, /More notes/, /Stay with us again/, /Look & feel/]) {
      await page.getByRole('navigation', { name: 'Guest wall sections' }).getByRole('button', { name: section }).click();
      if (section.source === 'Welcome & hosts') await page.getByRole('textbox', { name: /^Welcome message/ }).fill('QA private arrival note.');
      await saveSection();
    }
    await page.reload();
    await page.locator('[aria-label="Guest wall sections"] button[data-state="done"]').nth(5).waitFor();
    assert.equal((await db.doc(`properties/${propertyId}`).get()).get('profile.reviewedSections').length, 6);
  });
  await test('unsafe host links are rejected without discarding the draft', async () => {
    await page.getByRole('navigation', { name: 'Guest wall sections' }).getByRole('button', { name: /Stay with us again/ }).click();
    await page.getByRole('button', { name: '+ Book direct', exact: true }).click();
    await page.getByLabel('Web address', { exact: true }).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('alert').waitFor(); assert.equal(await page.getByLabel('Web address', { exact: true }).inputValue(), 'javascript:alert(1)');
    await page.getByLabel('Web address', { exact: true }).fill('example.test/book'); await saveSection();
  });
  await test('a cover upload completing while another section is open retains both photo and words', async () => {
    const photo = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#698b78' } }).jpeg().withMetadata().toBuffer();
    let release; const gate = new Promise(resolve => { release = resolve; }); let held = false;
    const intercept = async route => {
      if (route.request().method() === 'POST') { held = true; await gate; }
      await route.continue().catch(() => {}); // A failed test may have closed the intercepted request.
    };
    await page.route('**/v0/b/**', intercept);
    try {
      await page.getByRole('navigation', { name: 'Guest wall sections' }).getByRole('button', { name: /Property details/ }).click();
      await page.getByLabel('Cover photo', { exact: true }).setInputFiles({ name: 'synthetic-cover.jpg', mimeType: 'image/jpeg', buffer: photo });
      await saveSection();
      await page.getByRole('navigation', { name: 'Guest wall sections' }).getByRole('button', { name: /Welcome & hosts/ }).click();
      await page.getByRole('textbox', { name: /^Welcome message/ }).fill('Words edited while the cover was uploading.');
      release();
      for (let i = 0; i < 60 && !(await db.doc(`properties/${propertyId}`).get()).get('profile.cover'); i++) await page.waitForTimeout(250);
      assert.ok(held, 'A real Storage upload was delayed');
      await saveSection();
      const stored = (await db.doc(`properties/${propertyId}`).get()).data();
      assert.equal(stored.profile.stayWelcome, 'Words edited while the cover was uploading.');
      assert.ok(stored.profile.cover?.url); assert.ok(stored.profile.cover.width <= 1600);
      await page.reload(); await page.getByRole('navigation', { name: 'Guest wall sections' }).waitFor();
    } finally { release(); await page.unroute('**/v0/b/**', intercept); }
  });
  await test('corrupt host image fails visibly and the editor remains usable', async () => {
    await page.getByRole('navigation', { name: 'Guest wall sections' }).getByRole('button', { name: /Welcome & hosts/ }).click();
    await page.getByLabel('Welcome photo', { exact: true }).setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a photograph') });
    await saveSection(); await page.getByText(/welcome photo could not upload/).waitFor();
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.getByRole('navigation', { name: 'Guest wall sections' }).getByRole('button', { name: /Welcome & hosts/ }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  });
  // Explicit local entitlement fixture; this is not a payment test.
  await db.doc(`properties/${propertyId}`).update({ lifecycle: 'active', mode: 'live' });
  await test('downloaded QR PNG decodes to the complete token-bearing guest link', async () => {
    await goto(`/host/property/${propertyId}/qr`);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download QR code', exact: true }).click();
    const file = await download; const bytes = await fs.readFile(await file.path());
    assert.equal(await decode(bytes), `${base}/stay/${slug}/${token}`);
    await fs.writeFile(`${out}/downloaded-guest-qr.png`, bytes);
  });
  await test('host placard handoff contains the property and full stay URL; reload keeps it', async () => {
    await page.getByRole('link', { name: 'Design a placard', exact: true }).click();
    await page.getByLabel('Name of your place', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Name of your place', { exact: true }).inputValue(), name);
    assert.equal(await page.getByLabel('Link the code opens', { exact: true }).inputValue(), `${base}/stay/${slug}/${token}`);
    await page.reload(); assert.equal(await page.getByLabel('Name of your place', { exact: true }).inputValue(), name);
  });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-AU' });
  const guest = await guestContext.newPage(); guest.setDefaultTimeout(15000);
  const memory = `Synthetic browser memory ${randomUUID()}`;
  const guestRoute = `/stay/${slug}/${token}`;
  const openMemory = async () => { await guest.getByRole('button', { name: 'Add to guestbook', exact: true }).first().click(); await guest.getByLabel('Your message', { exact: true }).waitFor(); };
  await test('public view withholds arrival guidance; the private guest link reveals it', async () => {
    await goto(`/wall/${slug}`, guest); await guest.getByRole('heading', { name, exact: true }).waitFor();
    assert.ok(!(await guest.locator('body').innerText()).includes('Words edited while the cover was uploading.'));
    await goto(guestRoute, guest); await guest.getByText('Words edited while the cover was uploading.').waitFor();
  }, guest);
  await test('guest cannot submit without consent, then a named memory with a real photo publishes', async () => {
    await openMemory(); await guest.getByLabel('Your message', { exact: true }).fill(memory);
    await guest.getByRole('button', { name: 'Submit memory', exact: true }).click();
    await guest.getByText('Please read and accept the consent before submitting.').waitFor();
    await guest.getByLabel(/Guest name/).fill('Synthetic Guest');
    const bytes = await sharp({ create: { width: 200, height: 150, channels: 3, background: 'blue' } }).png().toBuffer();
    await guest.getByLabel('Choose photos', { exact: true }).setInputFiles({ name: 'qa.png', mimeType: 'image/png', buffer: bytes });
    await guest.locator('.guest-consent input').check(); await guest.getByRole('button', { name: 'Submit memory', exact: true }).click();
    await guest.getByText('Thank you. Your memory is now on the wall.').waitFor();
    await guest.getByText(memory, { exact: true }).first().waitFor();
    await guest.locator('.note-grid img').first().waitFor();
    await guest.waitForFunction(() => [...document.querySelectorAll('.note-grid img')].some(img => img.naturalWidth > 0));
  }, guest);
  await test('lost finish response can be retried without publishing duplicate memories', async () => {
    await openMemory(); const text = `${memory} retry`; await guest.getByLabel('Your message', { exact: true }).fill(text); await guest.locator('.guest-consent input').check();
    let intercepted = false;
    await guest.route('**/finishGuestContribution', async route => { if (!intercepted) { intercepted = true; await route.fetch(); await route.abort('failed'); } else await route.continue(); });
    await guest.getByRole('button', { name: 'Submit memory', exact: true }).click();
    await guest.getByRole('button', { name: 'Retry this submission', exact: true }).waitFor();
    assert.equal(await guest.getByRole('textbox', { name: /^Your message/ }).inputValue(), text);
    await guest.getByRole('button', { name: 'Retry this submission', exact: true }).click(); await guest.getByText('Thank you. Your memory is now on the wall.').waitFor();
    const posts = await db.collection(`properties/${propertyId}/posts`).where('message', '==', text).get(); assert.equal(posts.size, 1);
    await guest.unroute('**/finishGuestContribution');
  }, guest);
  await test('ZIP export contains the real messages and local photos, without house guidance', async () => {
    await goto(`/host/property/${propertyId}/export`);
    const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download ZIP part 1', exact: true }).click();
    const zip = unzipSync(await fs.readFile(await (await downloading).path()));
    assert.ok(Object.keys(zip).some(key => key.endsWith('messages.json')));
    const text = Object.entries(zip).filter(([key]) => /\.(html|json|txt)$/.test(key)).map(([, bytes]) => strFromU8(bytes)).join('\n');
    assert.ok(text.includes(memory)); assert.ok(!text.includes('Words edited while the cover was uploading.'));
    assert.ok(Object.keys(zip).some(key => /\.(webp|png|jpe?g)$/.test(key)));
  });
  await test('signed-in ordinary host is refused operations access', async () => {
    await goto('/operations'); await page.getByText(/authorised reviewer account is required/).waitFor();
    assert.equal(await page.getByRole('heading', { name: /Safety operations/ }).count(), 0);
  });
  for (const width of [320, 390, 768, 1024, 1440]) await test(`host editor, QR and live guest wall fit a ${width}px viewport`, async () => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [`/host/property/${propertyId}`, `/host/property/${propertyId}/qr`, guestRoute]) {
      await goto(route); await page.getByRole('heading', { name, exact: true }).first().waitFor();
      const dimensions = await page.evaluate(() => ({ inner: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(dimensions.content <= dimensions.inner + 1, JSON.stringify({ route, ...dimensions }));
    }
  });
  for (const scheme of ['light', 'dark']) await test(`${scheme} accessibility scan on host, guest and privacy forms`, async () => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const route of [`/host/property/${propertyId}`, `/host/property/${propertyId}/qr`, guestRoute, '/privacy-safety']) {
      await goto(route); await page.locator('h1').first().waitFor();
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await fs.writeFile(`${out}/axe-${scheme}-${route.replace(/[^a-z0-9]/gi, '-')}.json`, JSON.stringify(scan.violations, null, 2));
      assert.deepEqual(scan.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
    }
  });
  await guestContext.close();
} finally {
  await fs.writeFile(`${out}/browser-journeys.json`, JSON.stringify({ propertyId, slug, scope: 'local demo emulators; simulated screening and entitlement; resized Chromium is not a physical phone', results, faults }, null, 2));
  await browser.close();
}
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} browser journeys passed; ${faults.length} uncaught application errors`);
process.exit(results.some(r => r.status === 'fail') || faults.length ? 1 : 0);
