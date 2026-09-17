import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080", "Run only through the local emulator command");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
initializeApp({ projectId: "demo-digistaybook" });
const db = getFirestore();
const property = db.doc("properties/verify-public-wall");
await property.set({ slug: "verify-public-wall", name: "Verified cottage", mode: "live", lifecycle: "active",
  billing: { internal: "DO-NOT-RETURN" }, profile: { welcome: "Welcome", facts: [{ detail: "SECRET" }] } });
for (let i = 0; i < 27; i++) await property.collection("posts").doc(`post-${i}`).set({ visibility: "visible", message: `Memory ${i}`, createdAt: Timestamp.fromMillis(1000 + i), sessionId: "PRIVATE-SESSION" });
await property.collection("posts").doc("hidden").set({ visibility: "restricted", message: "RESTRICTED", createdAt: Timestamp.now() });
async function call(data, token) {
  const response = await fetch("http://127.0.0.1:5001/demo-digistaybook/australia-southeast1/getPublicWall", {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data })
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.result;
}
const first = await call({ slug: "verify-public-wall" });
assert.equal(first.property.name, "Verified cottage");
assert.equal(first.posts.length, 25);
assert.doesNotMatch(JSON.stringify(first), /DO-NOT-RETURN|SECRET|PRIVATE-SESSION|RESTRICTED/);
const second = await call({ slug: "verify-public-wall", cursor: first.nextCursor });
assert.equal(second.posts.length, 2);
assert.equal(new Set([...first.posts, ...second.posts].map(post => post.id)).size, 27);
assert.equal((await call({ slug: "does-not-exist" })).status, "unavailable");
await property.update({ lifecycle: "cancelled_pending_end", serviceEndsAt: Timestamp.fromMillis(Date.now() + 60000) });
assert.equal((await call({ slug: "verify-public-wall" })).status, "open");
await property.update({ serviceEndsAt: Timestamp.fromMillis(Date.now() - 1000) });
assert.equal((await call({ slug: "verify-public-wall" })).status, "unavailable");
await property.update({ lifecycle: "active", "profile.displayWallOff": true });
assert.equal((await call({ slug: "verify-public-wall" })).status, "unavailable");
console.log("PASS: actual callable projection, pagination, missing wall, cancellation deadline and visibility switch; emulator data only.");

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
const signup = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: `moderation-${Date.now()}@example.test`, password: "Emulator-only-2026!", returnSecureToken: true })
}).then(response => response.json());
assert.ok(signup.idToken);
await property.update({ ownerUid: signup.localId });

// The public wall is still switched off here, so this is a closed wall: its
// owner reads it as a preview, and everyone else still gets the closed notice.
const preview = await call({ slug: "verify-public-wall" }, signup.idToken);
assert.equal(preview.status, "preview");
assert.equal(preview.property.name, "Verified cottage");
assert.equal(preview.contributionsEnabled, false);
assert.equal(preview.owner.propertyId, property.id);
assert.equal(preview.owner.publicWallOff, true);
assert.doesNotMatch(JSON.stringify(preview), /DO-NOT-RETURN|SECRET|PRIVATE-SESSION|RESTRICTED/);
assert.equal((await call({ slug: "verify-public-wall" })).status, "unavailable");
const previewStay = await call({ slug: "verify-public-wall", view: "stay" }, signup.idToken);
assert.equal(previewStay.status, "open", "the in-stay wall is unaffected by the public switch");
// The house guidance is the in-stay wall's reason for existing, so reaching
// that wall is all it takes: the stay token (or ownership) is the gate, and
// the public wall behind the shared link still carries none of it.
assert.equal(previewStay.property.houseInformation.facts[0].detail, "SECRET",
  "the in-stay wall carries the house guidance without a second opt-in");
assert.equal((await call({ slug: "verify-public-wall" }, signup.idToken)).property.houseInformation, null,
  "the public wall carries no house guidance, even for its owner");
await property.update({ lifecycle: "deletion_scheduled" });
assert.equal((await call({ slug: "verify-public-wall", view: "stay" }, signup.idToken)).status, "unavailable",
  "a property being removed is not previewed");
await property.update({ lifecycle: "active", "profile.displayWallOff": false });
console.log("PASS: owner preview of a closed wall, closed to everyone else, and withheld from a property being removed.");
async function moderate(data, expectedStatus = 200) {
  const response = await fetch("http://127.0.0.1:5001/demo-digistaybook/australia-southeast1/moderatePost", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${signup.idToken}` },
    body: JSON.stringify({ data: { propertyId: property.id, ...data } })
  });
  const body = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(body));
  return body;
}
await property.collection("posts").doc("delete-me").set({ visibility: "visible", message: "Delete this", photo: { path: `properties/${property.id}/media/test.jpg` } });
await moderate({ postId: "delete-me", action: "delete", requestId: "delete-request" });
await moderate({ postId: "delete-me", action: "delete", requestId: "delete-request" });
assert.equal((await property.collection("posts").doc("delete-me").get()).get("photo"), undefined);
assert.deepEqual((await db.doc(`deletionJobs/${property.id}:delete-request`).get()).get("paths"), [`properties/${property.id}/media/test.jpg`]);
await moderate({ postId: "post-0", action: "hide", requestId: "delete-request" }, 409);
await moderate({ postId: "hidden", action: "publish", requestId: "critical-attempt" }, 403);
await property.collection("posts").doc("reported").set({ visibility: "hidden_pending_review", message: "Reported", openReportCount: 1 });
await moderate({ postId: "reported", action: "publish", requestId: "unresolved-report" }, 400);
console.log("PASS: authenticated moderation, repeat deletion, preserved object target, replay collision, restricted payload denial and unresolved-report guard.");
