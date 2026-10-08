import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
process.env.FUNCTIONS_EMULATOR = "true";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore, Timestamp } = require("firebase-admin/firestore");
initializeApp({ projectId: "demo-digistaybook" });
const db = getFirestore();
const { reviewConsent, scanConsentReviews, readConsentDeletionReview } = await import("../functions/lib/consentRetention.js");
const now = new Date("2026-10-05T00:00:00Z"); // 11am Sydney: no actual email emission.
const old = Timestamp.fromDate(new Date("2024-10-04T00:00:00Z"));
async function seed(id, patch = {}) {
  await db.doc(`guestConsent/${id}`).set({ propertyId: "consent-proof", postId: id, sessionUid: id, wording: "Synthetic consent", acceptedAt: old });
  await db.doc(`guestSubmissions/${id}`).set({ status: "deleted", photoCount: 0, updatedAt: old, ...patch });
  await db.doc(`properties/consent-proof/posts/${id}`).set({ visibility: "deleted", deletedAt: old });
}
await seed("due-proof");
assert.equal((await reviewConsent("due-proof", now.getTime())).status, "due");
assert.equal((await db.doc("guestConsent/due-proof").get()).exists, true, "Assessment must never delete consent");
await seed("held-proof", { safetyCaseOpen: true });
assert.equal((await reviewConsent("held-proof", now.getTime())).status, "blocked");
await seed("case-proof");
await db.doc("trustSafetyCases/case-proof").set({ postId: "case-proof", status: "open" });
assert.equal((await reviewConsent("case-proof", now.getTime())).status, "blocked");
await db.doc("trustSafetyCases/case-proof").update({ status: "released", resolvedAt: Timestamp.fromDate(now) });
assert.equal((await reviewConsent("case-proof", now.getTime())).dueAt.toDate().toISOString(), "2028-10-05T00:00:00.000Z");
await seed("privacy-proof");
await db.doc("privacyRequests/privacy-proof").set({ reporterKey: createHmac("sha256", "demo-only-report-key").update("privacy-proof").digest("hex"), status: "awaiting_verification" });
assert.equal((await reviewConsent("privacy-proof", now.getTime())).status, "blocked");
await seed("photo-proof", { photoCount: 1 });
await db.doc("deletionJobs/guest-photo-proof").set({ status: "pending", createdAt: old });
assert.equal((await reviewConsent("photo-proof", now.getTime())).status, "blocked");
await db.doc("deletionJobs/guest-photo-proof").update({ status: "completed", completedAt: old });
assert.equal((await reviewConsent("photo-proof", now.getTime())).status, "blocked", "An invented status must not be accepted as worker completion");
await db.doc("deletionJobs/guest-photo-proof").update({ status: "complete", completedAt: old });
assert.equal((await reviewConsent("photo-proof", now.getTime())).status, "due");
await db.doc("guestConsent/orphan-proof").set({ propertyId: "consent-proof", postId: "orphan-proof", sessionUid: "orphan-proof" });
assert.equal((await reviewConsent("orphan-proof", now.getTime())).status, "needs_attention");
const privileged = { uid: "operations-proof", token: { admin: true, firebase: { sign_in_second_factor: "totp" } } };
await assert.rejects(readConsentDeletionReview.run({ data: { id: "due-proof" }, auth: { uid: "host", token: {} }, rawRequest: {} }));
await assert.rejects(readConsentDeletionReview.run({ data: { id: "due-proof" }, auth: { uid: "ops", token: { admin: true, firebase: {} } }, rawRequest: {} }));
assert.equal((await readConsentDeletionReview.run({ data: { id: "due-proof" }, auth: privileged, rawRequest: {} })).status, "due");
await db.doc("guestConsent/due-proof").delete(); // Explicit manual removal in emulator only.
assert.equal((await readConsentDeletionReview.run({ data: { id: "due-proof" }, auth: privileged, rawRequest: {} })).status, "completed");
assert.equal((await db.collection("moderationAudit").where("action", "==", "check_consent_deletion_review").get()).size, 2);
// Verify that a full first page advances, and a second run reaches later records.
const batch = db.batch();
for (let index = 0; index < 105; index++) batch.set(db.doc(`guestConsent/a-page-${String(index).padStart(3, "0")}`), { propertyId: "consent-proof", postId: `a-page-${String(index).padStart(3, "0")}`, sessionUid: "synthetic" });
await batch.commit();
await scanConsentReviews(now);
assert.equal((await db.doc("retentionReminderState/guestConsent").get()).get("consentCursor"), "a-page-099");
await scanConsentReviews(now);
assert.equal((await db.doc("consentDeletionReview/a-page-104").get()).exists, true);
assert.equal((await db.doc("guestConsent/photo-proof").get()).exists, true);
assert.equal((await db.doc("consentDeletionReview/due-proof").get()).get("status"), "completed");
await scanConsentReviews(new Date("2026-10-04T22:00:00Z")); // 9am Sydney: emit the synthetic due reminder.
assert.equal((await db.doc("retentionReminderState/guestConsent").get()).get("notifiedDay"), "2026-10-05");
assert.equal((await db.doc("retentionReminderState/guestConsent").get()).get("dueCount"), 1);
await db.doc("guestSubmissions/photo-proof").update({ retentionHold: true });
await scanConsentReviews(new Date("2026-10-05T22:00:00Z"));
assert.equal((await db.doc("retentionReminderState/guestConsent").get()).get("dueCount"), 0, "A new hold must remove previously-due records from the next daily reminder");
console.log("Consent reminders verified: due dates, holds, linked privacy requests, media completion, missing evidence, MFA/access, manual removal observation and pagination; no automatic consent deletion.");
