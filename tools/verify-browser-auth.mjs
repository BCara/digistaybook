// Synthetic local accounts only. No real email is sent.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
require('firebase-admin/app').initializeApp({ projectId: 'demo-digistaybook' });
const db = require('firebase-admin/firestore').getFirestore();
const auth = require('firebase-admin/auth').getAuth();
const base = 'http://127.0.0.1:5181';
const out = process.env.QA_EVIDENCE_DIR ?? 'artifacts/qa/browser';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER_EXECUTABLE ? { executablePath: process.env.QA_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage(); page.setDefaultTimeout(20000);
const email = `browser-account-${randomUUID().slice(0, 8)}@example.test`;
const results = [];
async function test(name, run) {
  try { await run(); results.push({ name, status: 'pass' }); console.log('PASS', name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); console.error('FAIL', name, error.message.slice(0, 300)); }
}
async function goto(url) { await page.goto(url.startsWith('http') ? url : base + url, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
async function latestLink(kind, since) {
  const rows = await db.collection('authEmailRequests').where('kind', '==', kind).get();
  const row = rows.docs.filter(d => d.get('createdAt')?.toMillis() >= since && d.get('status') === 'emulated').sort((a, b) => b.get('createdAt').toMillis() - a.get('createdAt').toMillis())[0];
  assert.ok(row, 'The actual local notification outbox contains an action link');
  const link = row.get('link'); assert.equal(new URL(link).origin, base); return link;
}
try {
  await test('signup still reaches the dashboard when optional Auth display-name saving fails', async () => {
    let failed = false;
    await page.route('**/accounts:update*', async route => {
      if (route.request().postDataJSON()?.displayName) { failed = true; await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'INVALID_ARGUMENT' } }) }); }
      else await route.continue();
    });
    await goto('/host/sign-up');
    await page.locator('#display-name').fill('Synthetic Host');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('LocalTest-2026!');
    await page.getByLabel('Confirm password', { exact: true }).fill('LocalTest-2026!');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.waitForURL('**/host'); assert.ok(failed);
    const user = await auth.getUserByEmail(email); assert.equal((await db.doc(`users/${user.uid}`).get()).get('displayName'), 'Synthetic Host');
    await page.unroute('**/accounts:update*');
  });
  await test('verification outbox link opens the local action page, verifies the account and cannot be reused', async () => {
    await goto('/host/account'); const since = Date.now();
    await page.getByRole('button', { name: 'Send verification email', exact: true }).click();
    await page.getByText(/Verification email sent/).waitFor();
    const link = await latestLink('verifyEmail', since); await goto(link);
    await page.getByRole('button', { name: 'Verify email', exact: true }).click();
    await page.getByRole('heading', { name: 'Email verified', exact: true }).waitFor();
    assert.equal((await auth.getUserByEmail(email)).emailVerified, true);
    assert.ok(!page.url().includes('oobCode'));
    await goto(link); await page.getByRole('heading', { name: 'This link is no longer valid', exact: true }).waitFor();
  });
  const resetContext = await browser.newContext(); const reset = await resetContext.newPage();
  await test('password-reset journey rejects mismatch, updates the synthetic password and consumes its code', async () => {
    await reset.goto(base + '/host/sign-in', { waitUntil: 'domcontentloaded' });
    await reset.getByLabel('Email', { exact: true }).fill(email); const since = Date.now();
    await reset.getByRole('button', { name: 'Forgot your password?', exact: true }).click();
    await reset.getByText('If that address belongs to a host account, a password reset email is on its way.').waitFor();
    const link = await latestLink('resetPassword', since); await reset.goto(link, { waitUntil: 'domcontentloaded' });
    await reset.getByLabel('New password', { exact: true }).fill('Replacement-2026!');
    await reset.getByLabel('Confirm new password', { exact: true }).fill('Mismatch-2026!');
    await reset.getByRole('button', { name: 'Update password', exact: true }).click();
    await reset.getByText(/make sure both passwords match/).waitFor();
    await reset.getByLabel('Confirm new password', { exact: true }).fill('Replacement-2026!');
    await reset.getByRole('button', { name: 'Update password', exact: true }).click();
    await reset.getByRole('heading', { name: 'Password updated', exact: true }).waitFor();
    await reset.goto(link, { waitUntil: 'domcontentloaded' }); await reset.getByRole('heading', { name: 'This link is no longer valid', exact: true }).waitFor();
  });
  await resetContext.close();
} finally { await fs.writeFile(`${out}/browser-auth.json`, JSON.stringify({ scope: 'local Auth emulator; synthetic account; local outbox action links, not inbox delivery', results }, null, 2)); await browser.close(); }
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} browser account journeys passed`);
process.exit(results.some(r => r.status === 'fail') ? 1 : 0);
