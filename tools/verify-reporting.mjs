import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
process.env.FUNCTIONS_EMULATOR = "true";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore, Timestamp } = require("firebase-admin/firestore");
initializeApp({ projectId: "demo-digistaybook" });
const db = getFirestore();
const { requireOperations, escalatePrivacyDeadlines } = await import("../functions/lib/reporting.js");
const { retryScreening } = await import("../functions/lib/screeningRetry.js");
async function signup(host = false) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true, ...(host ? { email: `${randomUUID()}@example.test`, password: "Synthetic-password-2026!" } : {}) })
  });
  const user = await response.json(); assert.ok(user.idToken); return user;
}
const host = await signup(true), stranger = await signup(true), guest = await signup(), other = await signup();
async function call(name, data, user = guest, expected = 200) {
  const response = await fetch(`http://127.0.0.1:5001/demo-digistaybook/australia-southeast1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.idToken}` }, body: JSON.stringify({ data }) });
  const result = await response.json(); assert.equal(response.status, expected, `${name}: ${JSON.stringify(result)}`); return result.result;
}
const propertyId = "reporting-proof", slug = propertyId;
const creation = { name: "Address proof cottage", slug: "address-proof", profile: {} };
const [created, replayed] = await Promise.all([call("createHostProperty", creation, host), call("createHostProperty", creation, host)]);
assert.equal(created.property.id, replayed.property.id);
assert.equal((await db.doc(`slugReservations/${creation.slug}`).get()).get("propertyId"), created.property.id);
await call("createHostProperty", creation, stranger, 409);
await call("createHostProperty", { ...creation, slug: "anonymous-property" }, guest, 403);
assert.equal(created.property.lifecycle, "draft"); assert.equal(created.property.mode, "sandbox");
await db.doc(`properties/${propertyId}`).set({ slug, ownerUid: host.localId, mode: "live", lifecycle: "active", profile: {} });
for (let i = 0; i < 10; i++) await db.doc(`properties/${propertyId}/posts/post-${i}`).set({ message: "Synthetic memory", visibility: "visible", createdAt: Timestamp.now() });
await call("listHostExport", { propertyId }, stranger, 403);
await call("listHostExport", { propertyId }, guest, 403);
await db.doc(`properties/${propertyId}/posts/excluded-deleted`).set({ message: "Never export", visibility: "deleted" });
await db.doc(`properties/${propertyId}/posts/excluded-restricted`).set({ message: "Never export", visibility: "restricted" });
let exportCursor = null; const exported = [];
do {
  const page = await call("listHostExport", { propertyId, cursor: exportCursor }, host);
  exported.push(...page.posts); exportCursor = page.nextCursor;
} while (exportCursor);
assert.equal(exported.length, 10);
assert.ok(exported.every(post => !post.id.startsWith("excluded")));
await call("readHostExportPhoto", { propertyId, postId: "excluded-restricted", index: 0 }, host, 403);
const { getStorage } = require("firebase-admin/storage");
const exportBucket = "demo-digistaybook-published.firebasestorage.app";
const exportBytes = Buffer.from("synthetic export photo bytes");
await getStorage().bucket(exportBucket).file(`properties/${propertyId}/published/post-9/0.webp`).save(exportBytes);
await db.doc(`guestSubmissions/post-9`).set({ propertyId, status: "published", mediaLocation: "published", publishedBucket: exportBucket, photoCount: 1, revision: 1 });
const exportedPhoto = await call("readHostExportPhoto", { propertyId, postId: "post-9", index: 0 }, host);
assert.deepEqual(Buffer.from(exportedPhoto.base64, "base64"), exportBytes);
await db.doc(`properties/${propertyId}/posts/post-9`).update({ visibility: "hidden_pending_review" });
await call("readHostExportPhoto", { propertyId, postId: "post-9", index: 0 }, host, 403);
const request = { slug, postId: "post-0", reason: "privacy", requestId: randomUUID() };
const ack = await call("reportGuestMemory", request);
assert.deepEqual(ack, { message: "Report received. It will be reviewed." });
await call("reportGuestMemory", request); // Lost-response replay.
await call("reportGuestMemory", { ...request, requestId: randomUUID() }); // Semantic duplicate.
assert.equal((await db.doc(`properties/${propertyId}/posts/post-0`).get()).get("openReportCount"), 1);
await call("reportGuestMemory", { ...request, requestId: randomUUID() }, other);
assert.equal((await db.doc(`properties/${propertyId}/posts/post-0`).get()).get("openReportCount"), 2);
const reports = (await call("listHostReports", { propertyId }, host)).reports;
assert.equal(reports.length, 2);
await call("resolveContentReport", { reportId: reports[0].id, action: "dismiss" }, stranger, 403);
await call("resolveContentReport", { reportId: reports[0].id, action: "dismiss" }, host);
assert.equal((await db.doc(`properties/${propertyId}/posts/post-0`).get()).get("visibility"), "hidden_pending_review");
await call("resolveContentReport", { reportId: reports[1].id, action: "dismiss" }, host);
assert.equal((await db.doc(`properties/${propertyId}/posts/post-0`).get()).get("visibility"), "visible");
await call("resolveContentReport", { reportId: reports[1].id, action: "dismiss" }, host);
for (const index of [1, 2, 3]) await call("reportGuestMemory", { ...request, postId: `post-${index}`, requestId: randomUUID() });
assert.equal((await db.doc(`properties/${propertyId}/posts/post-2`).get()).get("visibility"), "hidden_pending_review");
assert.equal((await db.doc(`properties/${propertyId}/posts/post-3`).get()).get("visibility"), "visible"); // Reporter cooldown.
const all = await db.collection("contentReports").where("propertyId", "==", propertyId).get();
assert.ok(all.docs.some(doc => doc.get("outcome") === "suspected_abuse_no_visibility_change"));
assert.equal((await db.collection("notificationOutbox").where("postId", "==", "post-3").get()).size, 0);
await call("listSafetyOperations", { queue: "contentReports" }, host, 403);
assert.throws(() => requireOperations({ auth: { uid: "admin", token: { admin: true, firebase: {} } } }));
assert.equal(requireOperations({ auth: { uid: "admin", token: { admin: true, firebase: { sign_in_second_factor: "totp" } } } }), "admin");
const privacy = { kind: "takedown", details: "Synthetic lost-session privacy request", contact: "synthetic@example.test", requestId: randomUUID() };
const received = await call("submitPrivacyRequest", privacy);
await call("submitPrivacyRequest", privacy);
assert.equal((await db.doc(`privacyRequests/${received.reference}`).get()).get("status"), "awaiting_verification");
await db.doc(`privacyRequests/${received.reference}`).update({ reviewDueAt: Timestamp.fromMillis(Date.now() - 1) });
await escalatePrivacyDeadlines.run({ scheduleTime: new Date().toISOString() });
assert.equal((await db.doc(`privacyRequests/${received.reference}`).get()).get("status"), "escalated");
assert.equal((await db.doc(`operationsAlerts/deadline-${received.reference}`).get()).get("status"), "pending");
const retryId = "reporting-screen-retry";
await db.doc(`guestSubmissions/${retryId}`).set({ propertyId, status: "pending", revision: 1, message: "Synthetic text", feedback: "", photoCount: 0, createdAt: Timestamp.now() });
await retryScreening(retryId, Date.now(), async () => ({ outcome: "unavailable", feedback: "held" }));
assert.equal((await db.doc(`guestSubmissions/${retryId}`).get()).get("screeningRetryState"), "retry");
await retryScreening(retryId, Date.now() + 60001, async () => ({ outcome: "clear", feedback: "clear" }));
assert.equal((await db.doc(`guestSubmissions/${retryId}`).get()).get("status"), "published");
await db.doc(`guestSubmissions/${retryId}`).update({ status: "pending", revision: 2, screeningRetryRevision: 2, screeningAttempts: 7, screeningRetryAt: Timestamp.fromMillis(0) });
await retryScreening(retryId, Date.now(), async () => ({ outcome: "unavailable", feedback: "held" }));
assert.equal((await db.doc(`guestSubmissions/${retryId}`).get()).get("screeningRetryState"), "needs_attention");
assert.equal((await db.doc(`operationsAlerts/screening-${retryId}`).get()).get("status"), "pending");
const { processGuestSubmission } = await import("../functions/lib/guestContributions.js");
await db.doc(`guestSubmissions/${retryId}`).update({ status: "pending", revision: 3, safetyCaseOpen: true });
await db.doc(`properties/${propertyId}/posts/${retryId}`).update({ visibility: "processing" });
await processGuestSubmission(retryId, async () => ({ outcome: "clear", feedback: "clear" }));
assert.equal((await db.doc(`guestSubmissions/${retryId}`).get()).get("status"), "pending");
assert.equal((await db.doc(`properties/${propertyId}/posts/${retryId}`).get()).get("visibility"), "processing");
console.log("PASS: owner-only paged ZIP source, excluded records, actual photo bytes, hidden-photo denial and open safety-case publication guard.");
console.log("PASS: actual report hide/dedupe/cooldown, neutral acknowledgement, multiple-report restoration, ownership/MFA guards, private intake retry and deadline escalation. No email delivery claimed.");
