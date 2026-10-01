import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST?.includes("9199"));
process.env.FUNCTIONS_EMULATOR = "true"; // Trusted local adapter injection only.
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const sharp = require("sharp");
initializeApp({ projectId: "demo-digistaybook" });
const db = getFirestore();
const { processGuestSubmission, deliverFeedback } = await import("../functions/lib/guestContributions.js");
const { readSafetyCase, resolveSafetyCase } = await import("../functions/lib/reporting.js");
const { guestPolicy } = await import("../functions/lib/guestPolicy.js");
const base = "http://127.0.0.1:5001/demo-digistaybook/australia-southeast1";
async function signup(host = false) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true,
      ...(host ? { email: `${randomUUID()}@example.test`, password: "Emulator-only-2026!" } : {}) })
  });
  const data = await response.json(); assert.ok(data.idToken); return data;
}
const [host, guest, stranger, otherHost] = await Promise.all([signup(true), signup(), signup(), signup(true)]);
async function call(name, data, identity = guest, status = 200) {
  const response = await fetch(`${base}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", ...(identity ? { Authorization: `Bearer ${identity.idToken}` } : {}) }, body: JSON.stringify({ data }) });
  const body = await response.json(); assert.equal(response.status, status, `${name}: ${JSON.stringify(body)}`); return body.result;
}
const propertyId = "guest-flow-property", slug = "guest-flow-property", stayToken = "guestFlowStayToken0001";
await db.doc(`properties/${propertyId}`).set({ slug, name: "Guest flow cottage", ownerUid: host.localId, mode: "live", lifecycle: "active", profile: {}, stayToken });
await db.doc("properties/guest-flow-other").set({ slug: "guest-flow-other", name: "Other", ownerUid: host.localId, mode: "live", lifecycle: "active", stayToken: "guestFlowOtherToken002" });
const input = { slug, stayToken, requestId: randomUUID(), message: "Our memory", photoCount: 10, consentAccepted: true, consentVersion: guestPolicy.consentVersion };
await call("beginGuestContribution", { ...input, photoCount: 11 }, guest, 400);
await call("beginGuestContribution", { ...input, feedback: "A private suggestion" }, guest, 400); // A memory or feedback, never both.
await call("beginGuestContribution", { ...input, consentAccepted: false }, guest, 400);
await call("beginGuestContribution", input, host, 403);
await call("beginGuestContribution", input, null, 401);
const { id } = await call("beginGuestContribution", input);
assert.equal((await call("beginGuestContribution", input)).id, id);
await call("beginGuestContribution", { ...input, message: "Different" }, guest, 409);
await call("beginGuestContribution", { ...input, slug: "guest-flow-other", requestId: randomUUID() }, guest, 403);
await call("finishGuestContribution", { id }, guest, 400);
await call("uploadGuestPhoto", { id, index: 0, base64: Buffer.from("not an image").toString("base64") }, guest, 400);
await call("uploadGuestPhoto", { id, index: 0, base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').toString("base64") }, guest, 400);
await call("uploadGuestPhoto", { id, index: 0, base64: Buffer.alloc(guestPolicy.maxImageBytes + 1).toString("base64") }, guest, 400);
await call("uploadGuestPhoto", { id, index: 10, base64: "AAAA" }, guest, 400);
const bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: "red" } }).jpeg().toBuffer();
const other = await sharp({ create: { width: 30, height: 20, channels: 3, background: "blue" } }).png().toBuffer();
for (let index = 0; index < 10; index++) await call("uploadGuestPhoto", { id, index, base64: bytes.toString("base64") });
await call("uploadGuestPhoto", { id, index: 0, base64: bytes.toString("base64") });
await call("uploadGuestPhoto", { id, index: 0, base64: other.toString("base64") }, guest, 409);
await call("uploadGuestPhoto", { id, index: 0, base64: bytes.toString("base64") }, stranger, 403);
assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get("bytes"), bytes.length * 10);
const consent = (await db.doc(`guestConsent/${id}`).get()).data();
assert.equal(consent.wording, guestPolicy.consentWording); assert.equal(consent.sessionUid, guest.localId); assert.ok(consent.acceptedAt.toMillis());
assert.equal((await call("finishGuestContribution", { id })).status, "pending");
assert.equal((await call("finishGuestContribution", { id })).status, "pending");
assert.equal((await call("getPublicWall", { slug }, null)).posts.length, 0);
assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status, 404);
await call("reviewGuestContribution", { id, action: "approve", revision: 1 }, host, 400);
assert.equal((await call("listHostGuestReview", { propertyId }, host)).posts[0].message, "Awaiting safety screening");
assert.equal((await call("listHostGuestReview", { propertyId }, host)).feedback.length, 0);
await processGuestSubmission(id, async () => { throw new Error("Provider outage"); });
assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get("status"), "pending");
await processGuestSubmission(id, async () => ({ outcome: "clear", feedback: "clear" }));
const publishedSubmission = (await db.doc(`guestSubmissions/${id}`).get()).data();
assert.notEqual(publishedSubmission.bucket, publishedSubmission.publishedBucket);
assert.equal((await getStorage().bucket(publishedSubmission.bucket).file(publishedSubmission.slots[0].path).exists())[0], false);
assert.equal((await getStorage().bucket(publishedSubmission.publishedBucket).file(`properties/${propertyId}/published/${id}/0.webp`).exists())[0], true);
let wall = await call("getPublicWall", { slug }, null);
assert.equal(wall.posts.length, 1); assert.equal(wall.posts[0].photoCount, 10);
assert.doesNotMatch(JSON.stringify(wall), /private suggestion|consentVersion|slots|bucket/);
const imageResponse = await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`);
assert.equal(imageResponse.status, 200); assert.match(imageResponse.headers.get("cache-control"), /no-store/);
const metadata = await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata(); assert.equal(metadata.format, "webp"); assert.equal(metadata.exif, undefined);
await call("listHostGuestReview", { propertyId }, otherHost, 403);
await call("changeGuestContribution", { id, action: "delete", revision: 1 }, stranger, 403);
await call("changeGuestContribution", { id, action: "edit", revision: 1, message: "Changed message" });
assert.equal((await call("getPublicWall", { slug }, null)).posts.length, 0);
assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status, 404);
await call("changeGuestContribution", { id, action: "edit", revision: 1, message: "Stale write" }, guest, 400);
await processGuestSubmission(id, async () => ({ outcome: "standard", feedback: "clear" }));
const heldNotice = (await db.doc(`notificationOutbox/memory-held-${id}-2`).get()).data();
assert.equal(heldNotice.kind, "memory_held_for_host_review");
assert.equal(heldNotice.propertyId, propertyId);
assert.equal(heldNotice.status, "pending");
assert.equal(heldNotice.message, undefined);
assert.ok((await call("readGuestReviewPhoto", { id, index: 0 }, host)).base64);
await call("reviewGuestContribution", { id, action: "approve", revision: 2 }, host);
assert.equal((await call("getPublicWall", { slug }, null)).posts[0].message, "Changed message");
await call("moderatePost", { propertyId, postId: id, action: "hide", requestId: randomUUID() }, host);
assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status, 404);
await call("moderatePost", { propertyId, postId: id, action: "publish", requestId: randomUUID() }, host);
assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status, 200);
await call("changeGuestContribution", { id, action: "delete", revision: 2 });
await call("changeGuestContribution", { id, action: "delete", revision: 2 });
assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status, 404);
assert.equal((await call("listHostGuestReview", { propertyId }, host)).feedback.length, 0);
const job = (await db.doc(`deletionJobs/guest-${id}`).get()).data(); assert.equal(job.paths.length, 10); assert.equal(job.status, "pending");
assert.equal(job.objects.length, 20);
const critical = (await call("beginGuestContribution", { ...input, requestId: randomUUID(), photoCount: 0, message: "Critical fixture" })).id;
await call("finishGuestContribution", { id: critical });
await processGuestSubmission(critical, async () => ({ outcome: "critical", feedback: "held" }));
assert.equal((await call("listHostGuestReview", { propertyId }, host)).posts.length, 0);
assert.equal((await call("listGuestContributions", {})).posts.find(post => post.id === critical).status, "pending");
await call("reviewGuestContribution", { id: critical, action: "approve", revision: 1 }, host, 400);
await call("readGuestReviewPhoto", { id: critical, index: 0 }, host, 403);
assert.ok((await db.doc(`trustSafetyCases/${critical}:1`).get()).exists);
const stale = (await call("beginGuestContribution", { ...input, requestId: randomUUID(), photoCount: 0, message: "Old revision" })).id;
await call("finishGuestContribution", { id: stale });
let signalEntered, releaseScan;
const entered = new Promise(resolve => { signalEntered = resolve; });
const paused = new Promise(resolve => { releaseScan = resolve; });
const scan = processGuestSubmission(stale, async () => { signalEntered(); await paused; return { outcome: "clear", feedback: "clear" }; });
await entered;
await call("changeGuestContribution", { id: stale, revision: 1, action: "edit", message: "New revision" });
releaseScan(); await scan;
assert.equal((await db.doc(`guestSubmissions/${stale}`).get()).get("status"), "pending");
assert.equal((await db.doc(`properties/${propertyId}/posts/${stale}`).get()).get("visibility"), "processing");
await processGuestSubmission(stale, async () => ({ outcome: "clear", feedback: "clear" }));
await call("moderatePost", { propertyId, postId: stale, action: "delete", requestId: randomUUID() }, host);
await call("changeGuestContribution", { id: stale, revision: 2, action: "edit", message: "Must not resurrect host deletion" });
assert.equal((await db.doc(`guestSubmissions/${stale}`).get()).get("status"), "deleted");
assert.equal((await db.doc(`properties/${propertyId}/posts/${stale}`).get()).get("visibility"), "deleted");
// Feedback on its own: no memory, no consent record, no wall post, not in the guest's memory list.
const operations = { uid: "ops", token: { admin: true, firebase: { sign_in_second_factor: "totp" } } };
const asOperations = (fn, data) => fn.run({ data, auth: operations, rawRequest: {} });
const feedbackOnly = { slug, stayToken, requestId: randomUUID(), message: "", feedback: "The smoke alarm beeps all night", photoCount: 0 };
const loneId = (await call("beginGuestContribution", feedbackOnly)).id;
const lone = await call("finishGuestContribution", { id: loneId });
assert.equal(lone.status, "feedback");
assert.equal((await db.doc(`guestConsent/${loneId}`).get()).exists, false);
assert.equal((await db.doc(`properties/${propertyId}/posts/${loneId}`).get()).exists, false);
assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${loneId}`).get()).get("message"), feedbackOnly.feedback);
assert.equal((await call("listGuestContributions", {})).posts.some(post => post.id === loneId), false);
await call("changeGuestContribution", { id: loneId, revision: 1, action: "edit", message: "Now public" }, guest, 400);
await call("beginGuestContribution", { ...feedbackOnly, requestId: randomUUID(), feedback: "" }, guest, 400);
// The Host reports a delivered message: it leaves the inbox for a safety case.
await call("reportPrivateFeedback", { propertyId, id: loneId }, otherHost, 403);
await call("reportPrivateFeedback", { propertyId, id: loneId }, host);
await call("reportPrivateFeedback", { propertyId, id: loneId }, host);
assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${loneId}`).get()).exists, false);
let held = (await db.doc(`trustSafetyCases/feedback-${loneId}`).get()).data();
assert.equal(held.source, "host_report"); assert.equal(held.message, feedbackOnly.feedback); assert.equal(held.status, "open");
// The safety team opens it (audited) and releases it back to the Host.
assert.equal((await asOperations(readSafetyCase, { id: `feedback-${loneId}` })).message, feedbackOnly.feedback);
assert.ok(!(await db.collection("moderationAudit").where("caseId", "==", `feedback-${loneId}`).where("action", "==", "open_case").get()).empty);
await assert.rejects(readSafetyCase.run({ data: { id: `feedback-${loneId}` }, auth: { uid: "ops", token: { admin: true, firebase: {} } }, rawRequest: {} }));
await asOperations(resolveSafetyCase, { id: `feedback-${loneId}`, action: "release", note: "Ordinary complaint" });
assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${loneId}`).get()).get("message"), feedbackOnly.feedback);
held = (await db.doc(`trustSafetyCases/feedback-${loneId}`).get()).data();
assert.equal(held.status, "released"); assert.equal(held.message, undefined);
const releaseAudit = (await db.doc(`moderationAudit/case-feedback-${loneId}-release`).get()).data();
assert.equal(releaseAudit.actor, "ops"); assert.doesNotMatch(JSON.stringify(releaseAudit), /smoke alarm/);
await assert.rejects(asOperations(resolveSafetyCase, { id: `feedback-${loneId}`, action: "delete" }));
// Screening holds a threat for the safety team; it never reaches the inbox, and deleting it removes the text.
async function heldFeedback(text, verdict) {
  const heldId = (await call("beginGuestContribution", { ...feedbackOnly, requestId: randomUUID(), feedback: text })).id;
  await db.doc(`guestSubmissions/${heldId}`).update({ status: "feedback" }); // As finishGuestContribution leaves it, before delivery.
  await deliverFeedback(heldId, verdict);
  assert.equal((await call("finishGuestContribution", { id: heldId })).status, "feedback");
  return heldId;
}
const threat = await heldFeedback("Threat fixture", async () => ({ verdict: "critical", categories: ["Violent"] }));
assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${threat}`).get()).exists, false);
held = (await db.doc(`trustSafetyCases/feedback-${threat}`).get()).data();
assert.equal(held.source, "automated_screening"); assert.deepEqual(held.categories, ["Violent"]); assert.equal(held.message, "Threat fixture");
assert.equal((await db.doc(`guestSubmissions/${threat}`).get()).get("feedback"), "");
assert.equal((await db.doc(`guestSubmissions/${threat}`).get()).get("feedbackStatus"), "held");
await asOperations(resolveSafetyCase, { id: `feedback-${threat}`, action: "delete" });
assert.equal((await db.doc(`trustSafetyCases/feedback-${threat}`).get()).get("message"), undefined);
assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${threat}`).get()).exists, false);
// A provider failure delivers rather than holds.
const outage = await heldFeedback("Outage fixture", async () => { throw new Error("Provider outage"); });
assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${outage}`).get()).get("message"), "Outage fixture");
// A guest who withdraws their submission withdraws feedback that is still held.
const withdrawn = await heldFeedback("Withdrawn fixture", async () => ({ verdict: "critical", categories: ["Sexual"] }));
await call("changeGuestContribution", { id: withdrawn, revision: 1, action: "delete" });
held = (await db.doc(`trustSafetyCases/feedback-${withdrawn}`).get()).data();
assert.equal(held.status, "withdrawn"); assert.equal(held.message, undefined);
assert.equal((await db.doc(`properties/${propertyId}/posts/${withdrawn}`).get()).exists, false);

const pagingGuest = await signup();
const pagingProperty = "paging-property";
await db.doc(`properties/${pagingProperty}`).set({ ownerUid: host.localId });
await db.doc(`guestSessions/${pagingGuest.localId}`).set({ propertyId: pagingProperty });
const batch = db.batch();
for (let i = 0; i < 140; i++) batch.set(db.doc(`guestSubmissions/paging-closed-${String(i).padStart(3, "0")}`), { propertyId: pagingProperty, uid: "someone-else", status: "published", message: "Closed item", revision: 1 });
for (let i = 0; i < 61; i++) {
  const key = `paging-open-${String(i).padStart(3, "0")}`;
  batch.set(db.doc(`guestSubmissions/${key}`), { propertyId: pagingProperty, uid: pagingGuest.localId, status: "standard", message: `Review ${i}`, revision: 1, photoCount: 0 });
  batch.set(db.doc(`properties/${pagingProperty}/privateFeedback/${key}`), { message: `Feedback ${i}` });
}
await batch.commit();
async function collect(name, data, identity, field, cursorField, requestField) {
  const found = []; let cursor;
  do {
    const page = await call(name, { ...data, ...(cursor ? { [requestField]: cursor } : {}) }, identity);
    found.push(...page[field]); cursor = page[cursorField];
  } while (cursor);
  assert.equal(found.length, 61); assert.equal(new Set(found.map(item => item.id)).size, 61);
}
await collect("listGuestContributions", {}, pagingGuest, "posts", "nextCursor", "cursor");
await collect("listHostGuestReview", { propertyId: pagingProperty, kind: "review" }, host, "posts", "reviewCursor", "reviewCursor");
await collect("listHostGuestReview", { propertyId: pagingProperty, kind: "feedback" }, host, "feedback", "feedbackCursor", "feedbackCursor");
await call("listHostGuestReview", { propertyId: pagingProperty, reviewCursor: "paging-open-025" }, otherHost, 403);
await call("listGuestContributions", { cursor: "bad/path" }, pagingGuest, 400);
console.log("PASS: guest contribution lifecycle and paginated guest history/host review/private feedback, including unresolved items after 140 closed entries and cross-owner cursor protection.");
console.log("PASS: private feedback as its own submission (never with a memory), host report, held-case open/release/delete with audit, fail-open delivery and guest withdrawal.");
