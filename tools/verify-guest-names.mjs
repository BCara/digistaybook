import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

// Uses only the named local demo emulator and trusted callable handlers.
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
assert.equal(process.env.FUNCTIONS_EMULATOR, "true");
assert.equal(process.env.GCLOUD_PROJECT, "demo-digistaybook");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
const require = createRequire(new URL("../functions/package.json", import.meta.url));
require("firebase-admin/app").initializeApp({ projectId: "demo-digistaybook" });
const db = require("firebase-admin/firestore").getFirestore();
const { beginGuestContribution, processGuestSubmission, listGuestContributions, changeGuestContribution } = await import("../functions/lib/guestContributions.js");
const { guestPolicy } = await import("../functions/lib/guestPolicy.js");
const suffix = randomUUID().slice(0, 8);
const slug = `name-check-${suffix}`, propertyId = slug, stayToken = "GuestNameTestToken0001";
const auth = { uid: `name-guest-${suffix}`, token: { firebase: { sign_in_provider: "anonymous" } } };
const property = db.doc(`properties/${propertyId}`);
await property.set({ slug, name: "Guest name check", ownerUid: `name-host-${suffix}`, lifecycle: "active", mode: "live", stayToken });
const input = { slug, stayToken, message: "A lovely stay", feedback: "", photoCount: 0, consentAccepted: true, consentVersion: guestPolicy.consentVersion };
const begin = data => beginGuestContribution.run({ auth, data });
try {
  await assert.rejects(begin({ ...input, requestId: randomUUID(), displayName: "x".repeat(81) }), { code: "invalid-argument" });
  await assert.rejects(begin({ ...input, requestId: randomUUID(), displayName: 123 }), { code: "invalid-argument" });
  for (const [supplied, expected] of [["  Mia & Sam  ", "Mia & Sam"], ["   ", ""], [undefined, ""]]) {
    const request = { ...input, requestId: randomUUID(), ...(supplied === undefined ? {} : { displayName: supplied }) };
    const { id } = await begin(request);
    assert.equal((await begin(request)).id, id);
    await assert.rejects(begin({ ...request, displayName: "Changed name" }), { code: "already-exists" });
    const submission = db.doc(`guestSubmissions/${id}`), post = property.collection("posts").doc(id);
    assert.equal((await submission.get()).get("displayName"), expected);
    await submission.update({ status: "pending" });
    let screened;
    await processGuestSubmission(id, async content => { screened = content.message; return { outcome: "clear" }; });
    assert.equal(screened, [expected, input.message].filter(Boolean).join("\n"));
    assert.equal((await submission.get()).get("status"), "published");
    assert.equal((await post.get()).get("displayName"), expected);
    assert.equal((await listGuestContributions.run({ auth, data: {} })).posts.find(item => item.id === id).displayName, expected);
    await changeGuestContribution.run({ auth, data: { id, revision: 1, action: "delete" } });
    assert.equal((await submission.get()).get("displayName"), "");
    assert.equal((await post.get()).get("displayName"), "");
  }
  const { id } = await begin({ ...input, requestId: randomUUID(), displayName: "contact@example.test" });
  await db.doc(`guestSubmissions/${id}`).update({ status: "pending" });
  await processGuestSubmission(id, async () => ({ outcome: "clear" }));
  assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get("status"), "standard");
  await changeGuestContribution.run({ auth, data: { id, revision: 1, action: "delete" } });
  const signup = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
  });
  const identity = await signup.json();
  assert.ok(identity.idToken);
  const endpoint = "http://127.0.0.1:5001/demo-digistaybook/australia-southeast1";
  async function call(name, data, authenticated = true) {
    const response = await fetch(`${endpoint}/${name}`, { method: "POST", headers: { "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${identity.idToken}` } : {}) }, body: JSON.stringify({ data }), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result.result;
  }
  for (const displayName of ["Mia & Sam", ""]) {
    const { id: publishedId } = await call("beginGuestContribution", { ...input, requestId: randomUUID(), displayName });
    assert.equal((await call("finishGuestContribution", { id: publishedId })).status, "published");
    const wall = await call("getPublicWall", { slug }, false);
    assert.equal(wall.posts.find(post => post.id === publishedId).displayName, displayName);
    await call("changeGuestContribution", { id: publishedId, revision: 1, action: "delete" });
  }
  console.log("Guest name emulator checks passed: trim, optional/legacy names, validation, retries, screening, publication, owner listing, deletion and HTTP callable/public-wall round trips.");
} finally {
  await property.update({ lifecycle: "deleted" });
}
