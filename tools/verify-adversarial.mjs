// Destructive fixtures are restricted to the local demo emulators. No live credentials.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080', 'Use the isolated local demo emulators');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
process.env.FUNCTIONS_EMULATOR = 'true';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
require('firebase-admin/app').initializeApp({ projectId: 'demo-digistaybook' });
const db = require('firebase-admin/firestore').getFirestore();
const { Timestamp } = require('firebase-admin/firestore');
const sharp = require('sharp');
const { guestPolicy } = await import('../functions/lib/guestPolicy.js');
const base = 'http://127.0.0.1:5001/demo-digistaybook/australia-southeast1';
const prefix = `qa-${randomUUID().slice(0, 8)}`;
const results = [];
async function test(name, run) {
  try { await run(); results.push({ name, status: 'pass' }); console.log('PASS', name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); console.error('FAIL', name, error.message); }
}
async function identity(host = false) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true, ...(host ? { email: `${randomUUID()}@example.test`, password: 'LocalTest-2026!' } : {}) }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function call(name, data, user = null, expected = 200) {
  const response = await fetch(`${base}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}) }, body: JSON.stringify({ data }), signal: AbortSignal.timeout(60000) });
  const body = await response.json();
  assert.equal(response.status, expected, `${name}: ${JSON.stringify(body)}`);
  return body.result;
}
const [host, other, guest, stranger] = await Promise.all([identity(true), identity(true), identity(), identity()]);
const creation = { name: 'Synthetic adversarial cottage', slug: prefix, profile: { facts: [{ term: 'Wi-Fi', detail: 'PRIVATE-NETWORK', note: 'PRIVATE-PASSWORD' }], hostNotes: [{ id: 'one', message: 'PRIVATE-HOST-NOTE' }] } };
let property;
await test('concurrent property creation is idempotent', async () => {
  const all = await Promise.all(Array.from({ length: 5 }, () => call('createHostProperty', creation, host)));
  assert.equal(new Set(all.map(r => r.property.id)).size, 1);
  property = all[0].property;
  assert.equal(property.ownerUid, host.localId); assert.equal(property.lifecycle, 'draft'); assert.match(property.stayToken, /^[A-Za-z0-9_-]{22}$/);
});
if (!property) throw new Error('Cannot continue without the isolated test property');
for (const [name, data, user, expected] of [
  ['property creation rejects signed-out users', creation, null, 403],
  ['property creation rejects anonymous guests', creation, guest, 403],
  ['property address cannot be taken by another host', creation, other, 409],
  ['different content cannot reuse a creation attempt', { ...creation, name: 'Different' }, host, 409],
  ['property creation refuses the hardcoded demo address', { ...creation, slug: 'demo-cottage' }, host, 400],
  ['property creation rejects duplicate note identities', { ...creation, slug: `${prefix}-dupes`, profile: { hostNotes: [{ id: 'same', message: 'One' }, { id: 'same', message: 'Two' }] } }, host, 400],
  ['property creation rejects too many facts', { ...creation, slug: `${prefix}-facts`, profile: { facts: Array.from({ length: 9 }, () => ({ term: '', detail: '', note: '' })) } }, host, 400],
  ['property creation rejects malformed facts', { ...creation, slug: `${prefix}-badfact`, profile: { facts: [null] } }, host, 400],
]) await test(name, () => call('createHostProperty', data, user, expected));
for (const name of ['ensureStayToken', 'deleteHostProperty']) {
  for (const propertyId of ['a/b', 'a/b/c', '', 123]) await test(`${name} rejects invalid reference ${JSON.stringify(propertyId)}`, () => call(name, { propertyId }, host, 400));
  await test(`${name} denies another host`, () => call(name, { propertyId: property.id }, other, 403));
  await test(`${name} denies anonymous users`, () => call(name, { propertyId: property.id }, guest, 403));
}
await test('concurrent legacy-token requests mint exactly one persistent token', async () => {
  await db.doc(`properties/${property.id}`).update({ stayToken: null });
  const tokens = await Promise.all(Array.from({ length: 6 }, () => call('ensureStayToken', { propertyId: property.id }, host)));
  assert.equal(new Set(tokens.map(t => t.stayToken)).size, 1); property.stayToken = tokens[0].stayToken;
});
await db.doc(`properties/${property.id}`).update({ mode: 'live', lifecycle: 'active' });
await test('public projection withholds all house guidance and the stay token', async () => {
  const wall = await call('getPublicWall', { slug: prefix, view: 'stay', token: 'WRONG-TOKEN' });
  assert.equal(wall.property.houseInformation, null);
  assert.doesNotMatch(JSON.stringify(wall), /PRIVATE-|stayToken|ownerUid|billing/);
});
await test('correct stay token reveals house guidance', async () => {
  const wall = await call('getPublicWall', { slug: prefix, view: 'stay', token: property.stayToken });
  assert.equal(wall.property.houseInformation.facts[0].detail, 'PRIVATE-NETWORK');
});
const input = { slug: prefix, stayToken: property.stayToken, requestId: randomUUID(), message: 'A synthetic memory', photoCount: 0, consentAccepted: true, consentVersion: guestPolicy.consentVersion };
for (const [name, change] of [
  ['missing stay token', { stayToken: null }], ['forged stay token', { stayToken: 'A'.repeat(22) }],
  ['empty content', { message: '' }], ['negative photo count', { photoCount: -1 }], ['fractional photo count', { photoCount: 0.5 }],
  ['eleven photos', { photoCount: 11 }], ['wrong consent version', { consentVersion: 'obsolete' }], ['false consent', { consentAccepted: false }],
  ['string consent', { consentAccepted: 'true' }], ['1201-character message', { message: 'x'.repeat(1201) }],
  ['overlong guest name', { displayName: 'x'.repeat(guestPolicy.maxName + 1) }], ['memory plus private feedback', { feedback: 'Private' }],
]) await test(`guest intake rejects ${name}`, () => call('beginGuestContribution', { ...input, ...change }, guest, /stay token/.test(name) ? 403 : 400));
let submission;
await test('simultaneous guest retries create one memory and one consent record', async () => {
  const all = await Promise.all(Array.from({ length: 5 }, () => call('beginGuestContribution', input, guest)));
  assert.equal(new Set(all.map(r => r.id)).size, 1); submission = all[0].id;
  assert.equal((await db.doc(`guestSessions/${guest.localId}`).get()).get('attempts'), 1);
  assert.equal((await db.doc(`guestConsent/${submission}`).get()).get('version'), guestPolicy.consentVersion);
});
await test('changed guest retry cannot silently replace accepted text', () => call('beginGuestContribution', { ...input, message: 'Different' }, guest, 409));
await test('another anonymous session cannot finish a memory', () => call('finishGuestContribution', { id: submission }, stranger, 403));
await test('another anonymous session cannot edit a memory', () => call('changeGuestContribution', { id: submission, revision: 1, action: 'delete' }, stranger, 403));
await test('host sessions cannot impersonate guest submission sessions', () => call('beginGuestContribution', input, host, 403));
await test('guest memory finishes once even when requests overlap', async () => {
  const all = await Promise.all(Array.from({ length: 3 }, () => call('finishGuestContribution', { id: submission }, guest)));
  assert.ok(all.every(r => r.status === 'published'));
  assert.equal((await db.doc(`properties/${property.id}/posts/${submission}`).get()).get('visibility'), 'visible');
});
await test('stale edit revision is rejected', () => call('changeGuestContribution', { id: submission, revision: 0, action: 'edit', message: 'Changed' }, guest, 400));
await test('clear text edit is rescreened and advances its revision', async () => {
  await call('changeGuestContribution', { id: submission, revision: 1, action: 'edit', message: 'An updated synthetic memory' }, guest);
  assert.equal((await db.doc(`guestSubmissions/${submission}`).get()).get('revision'), 2);
});
await test('host review policy keeps clear new memories private until approval', async () => {
  await call('setGuestReviewPolicy', { propertyId: property.id, reviewContent: true }, host);
  const id = (await call('beginGuestContribution', { ...input, requestId: randomUUID() }, guest)).id;
  await call('finishGuestContribution', { id }, guest);
  assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get('status'), 'standard');
  await call('reviewGuestContribution', { id, revision: 1, action: 'approve' }, other, 403);
  await call('reviewGuestContribution', { id, revision: 1, action: 'approve' }, host);
  assert.equal((await db.doc(`properties/${property.id}/posts/${id}`).get()).get('visibility'), 'visible');
  await call('setGuestReviewPolicy', { propertyId: property.id, reviewContent: false }, host);
});
await test('missing image slots cannot be submitted', async () => {
  const id = (await call('beginGuestContribution', { ...input, requestId: randomUUID(), photoCount: 1 }, guest)).id;
  await call('finishGuestContribution', { id }, guest, 400);
  const bytes = await sharp({ create: { width: 20, height: 30, channels: 3, background: 'blue' } }).jpeg().withMetadata().toBuffer();
  for (const base64 of ['@@@@', Buffer.from('not an image').toString('base64'), Buffer.from('<svg/>').toString('base64')]) await call('uploadGuestPhoto', { id, index: 0, base64 }, guest, 400);
  await Promise.all(Array.from({ length: 3 }, () => call('uploadGuestPhoto', { id, index: 0, base64: bytes.toString('base64') }, guest)));
  assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get('bytes'), bytes.length);
  await call('finishGuestContribution', { id }, guest);
  const response = await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`);
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.exif, undefined);
  await call('changeGuestContribution', { id, revision: 1, action: 'delete' }, guest);
  assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status, 404);
});
await test('private feedback is delivered only to the owner inbox', async () => {
  const id = (await call('beginGuestContribution', { ...input, requestId: randomUUID(), message: '', feedback: 'PRIVATE-QA-FEEDBACK', consentAccepted: false }, guest)).id;
  await call('finishGuestContribution', { id }, guest);
  assert.equal((await db.doc(`properties/${property.id}/privateFeedback/${id}`).get()).get('message'), 'PRIVATE-QA-FEEDBACK');
  assert.doesNotMatch(JSON.stringify(await call('getPublicWall', { slug: prefix })), /PRIVATE-QA-FEEDBACK/);
  await call('listHostGuestReview', { propertyId: property.id }, other, 403);
});
await test('critical and outage fixtures never reach host review or public walls', async () => {
  for (const marker of ['[safety]', '[outage]']) {
    const id = (await call('beginGuestContribution', { ...input, requestId: randomUUID(), message: `${marker} harmless routing fixture` }, guest)).id;
    await call('finishGuestContribution', { id }, guest);
    assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get('safetyCaseOpen'), true);
    await call('reviewGuestContribution', { id, revision: 1, action: 'approve' }, host, 400);
    assert.doesNotMatch(JSON.stringify(await call('getPublicWall', { slug: prefix })), /harmless routing fixture/);
  }
});
await test('ordinary host cannot read operations queues', () => call('listSafetyOperations', { queue: 'trustSafetyCases' }, host, 403));
await test('public wall switch preserves in-stay access', async () => {
  await db.doc(`properties/${property.id}`).update({ 'profile.displayWallOff': true });
  assert.equal((await call('getPublicWall', { slug: prefix })).status, 'unavailable');
  assert.equal((await call('getPublicWall', { slug: prefix, view: 'stay', token: property.stayToken })).status, 'open');
});
await test('cancellation expiry closes the wall and further intake', async () => {
  await db.doc(`properties/${property.id}`).update({ lifecycle: 'cancelled_pending_end', serviceEndsAt: Timestamp.fromMillis(Date.now() - 1000) });
  assert.equal((await call('getPublicWall', { slug: prefix, view: 'stay', token: property.stayToken })).status, 'unavailable');
  await call('beginGuestContribution', { ...input, requestId: randomUUID() }, guest, 400);
});
const out = process.env.QA_EVIDENCE_DIR ?? 'artifacts/qa/2026-11-05';
await mkdir(out, { recursive: true });
await writeFile(`${out}/adversarial-results.json`, JSON.stringify({ scope: 'local emulators; simulated screening', propertyId: property.id, prefix, results }, null, 2));
console.log(`${results.filter(r => r.status === 'pass').length}/${results.length} checks passed`);
process.exit(results.some(r => r.status === 'fail') ? 1 : 0);
