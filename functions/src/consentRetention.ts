import { FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { warn } from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createHmac } from "node:crypto";
import { defineSecret } from "firebase-functions/params";
import { requireOperations } from "./reporting.js";

const hashSecret = defineSecret("REPORT_HASH_KEY");
const secrets = process.env.FUNCTIONS_EMULATOR === "true" ? [] : [hashSecret];
const project = "digistaybook-cbert";
const options = { region: "australia-southeast1", maxInstances: 1, secrets };
const stamp = () => FieldValue.serverTimestamp();
const millis = (value: any): number => value?.toMillis?.() ?? 0;
const valid = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
export function consentDeadline(anchor: number): number {
  const date = new Date(anchor), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCFullYear(date.getUTCFullYear() + 2);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end));
  return date.getTime();
}
type Assessment = { status: string; reason: string; dueAt?: Timestamp; anchorAt?: Timestamp };
export function assessConsent(inputs: {
  deleted: boolean; deletionAt: number; mediaRemoved: boolean; hold: boolean;
  cases: { status: string; resolvedAt: number }[]; incomplete: boolean;
}, now: number): Assessment {
  if (inputs.hold) return { status: "blocked", reason: "A recorded safety or retention hold is still active. Keep the consent record." };
  if (inputs.incomplete) return { status: "needs_attention", reason: "Deletion or linked-review evidence is incomplete. Verify the retention trigger before deleting consent." };
  if (!inputs.deleted) return { status: "retained", reason: "The associated memory has not been deleted. Keep its consent evidence." };
  if (!inputs.mediaRemoved) return { status: "blocked", reason: "Associated photo deletion has not completed. Keep the consent record." };
  if (inputs.cases.some(item => !["dismissed", "deleted", "released", "resolved", "closed", "rejected", "duplicate"].includes(item.status))) {
    return { status: "blocked", reason: "A linked report, safety case or privacy request is still unresolved. Keep the consent record." };
  }
  if (!inputs.deletionAt || inputs.cases.some(item => item.status !== "duplicate" && !item.resolvedAt)) {
    return { status: "needs_attention", reason: "A deletion date or final review-closure date is missing. Verify it before deleting consent." };
  }
  const anchor = Math.max(inputs.deletionAt, ...inputs.cases.map(item => item.resolvedAt));
  const due = consentDeadline(anchor);
  return { status: due <= now ? "due" : "retained", anchorAt: Timestamp.fromMillis(anchor), dueAt: Timestamp.fromMillis(due),
    reason: "Guest content-consent retention: 24 calendar months after content deletion or final linked dispute closure, whichever is later. Only the guestConsent record is due; check for unrecorded disputes or holds before manual deletion." };
}

// No function in this module deletes consent, submissions, photos or cases.
export async function reviewConsent(id: string, now = Date.now()): Promise<Record<string, any>> {
  if (!valid(id)) throw new HttpsError("invalid-argument", "A valid consent reference is required.");
  const db = getFirestore(), consentRef = db.doc(`guestConsent/${id}`), reviewRef = db.doc(`consentDeletionReview/${id}`);
  const consent = await consentRef.get();
  if (!consent.exists) {
    const previous = await reviewRef.get();
    if (!previous.exists) throw new HttpsError("not-found", "This consent record is unavailable.");
    if (previous.get("status") !== "completed") await reviewRef.update({ status: "completed", completionEvidence: "Consent record absence observed; this worker did not delete it.", completedObservedAt: stamp(), checkedAt: stamp() });
    return (await reviewRef.get()).data()!;
  }
  const propertyId = consent.get("propertyId"), postId = consent.get("postId");
  let result: Assessment;
  if (!valid(propertyId) || postId !== id || !valid(consent.get("sessionUid"))) {
    result = { status: "needs_attention", reason: "Consent references are incomplete or inconsistent. Verify them before deletion." };
  } else {
    const key = process.env.FUNCTIONS_EMULATOR === "true" ? "demo-only-report-key" : hashSecret.value();
    if (!key) throw new Error("Consent retention cannot check linked privacy requests without REPORT_HASH_KEY");
    const reporterKey = createHmac("sha256", key).update(consent.get("sessionUid")).digest("hex");
    const [submission, post, job, reports, safety, privacy, sessionPrivacy] = await Promise.all([
      db.doc(`guestSubmissions/${id}`).get(), db.doc(`properties/${propertyId}/posts/${id}`).get(), db.doc(`deletionJobs/guest-${id}`).get(),
      db.collection("contentReports").where("postId", "==", id).limit(101).get(),
      db.collection("trustSafetyCases").where("postId", "==", id).limit(101).get(),
      db.collection("privacyRequests").where("postId", "==", id).limit(101).get(),
      db.collection("privacyRequests").where("reporterKey", "==", reporterKey).limit(101).get()
    ]);
    const linked = [...new Map([...reports.docs, ...safety.docs, ...privacy.docs, ...sessionPrivacy.docs].map(doc => [doc.ref.path, doc])).values()];
    const deletionAt = Math.max(millis(submission.get("deletedAt")), millis(post.get("deletedAt")), millis(job.get("createdAt")), millis(job.get("completedAt")),
      submission.get("status") === "deleted" ? millis(submission.get("updatedAt")) : 0);
    result = assessConsent({
      deleted: submission.get("status") === "deleted" && post.get("visibility") === "deleted",
      deletionAt, mediaRemoved: submission.get("photoCount") === 0 || job.get("status") === "complete",
      hold: [consent, submission, post].some(doc => Boolean(doc.get("retentionHold"))) || submission.get("safetyCaseOpen") === true || post.get("safetyRestricted") === true || job.get("requiresSafetyReview") === true,
      incomplete: !submission.exists || !post.exists || [reports, safety, privacy, sessionPrivacy].some(page => page.size > 100),
      cases: linked.map(doc => ({ status: doc.get("status"), resolvedAt: millis(doc.get("resolvedAt")) }))
    }, now);
  }
  const record = { kind: "consent_deletion_review", propertyId: valid(propertyId) ? propertyId : null, postId: id,
    consentPath: consentRef.path, ...result, checkedAt: stamp(), reviewDueAt: result.dueAt ?? null,
    // Replacement clears stale deadlines/completion data if a record is restored.
    manualAction: "Recheck this review, confirm no unrecorded dispute/hold, then manually delete only the named guestConsent document. Recheck to record its absence. Backup deletion must be handled separately." };
  await reviewRef.set(record);
  return record;
}

export const readConsentDeletionReview = onCall({ ...options, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" }, async request => {
  const actor = requireOperations(request), id = request.data?.id;
  if (!valid(id)) throw new HttpsError("invalid-argument", "A valid consent reference is required.");
  const record = await reviewConsent(id);
  await getFirestore().collection("moderationAudit").add({ action: "check_consent_deletion_review", consentId: id, actor, status: record.status, createdAt: stamp() });
  return { id, status: record.status, consentPath: record.consentPath, reason: record.reason, manualAction: record.manualAction,
    dueAt: record.dueAt?.toDate?.().toISOString() ?? null, completionEvidence: record.completionEvidence ?? null,
    recordUrl: `https://console.firebase.google.com/project/${project}/firestore/databases/-default-/data/~2FguestConsent~2F${id}` };
});

export async function scanConsentReviews(now = new Date()) {
  const db = getFirestore(), stateRef = db.doc("retentionReminderState/guestConsent"), state = await stateRef.get();
  // Persistent cursors bound reads and revisit every record without first-page starvation.
  for (const collection of ["guestConsent", "consentDeletionReview"]) {
    const cursorKey = collection === "guestConsent" ? "consentCursor" : "reviewCursor";
    let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(100);
    if (state.get(cursorKey)) query = query.startAfter(state.get(cursorKey));
    const page = await query.get();
    for (const doc of page.docs) {
      if (collection === "guestConsent") await reviewConsent(doc.id, now.getTime());
      else if (doc.get("status") !== "completed") await reviewConsent(doc.id, now.getTime());
    }
    await stateRef.set({ [cursorKey]: page.size === 100 ? page.docs.at(-1)!.id : null, scannedAt: stamp() }, { merge: true });
  }
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  if (Number(part("hour")) !== 9 || state.get("notifiedDay") === day) return;
  // Reassess every previously-due record before including it; a new hold must remove it.
  let cursor: string | undefined;
  do {
    let query = db.collection("consentDeletionReview").where("status", "==", "due").orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) await reviewConsent(doc.id, now.getTime());
    cursor = page.size === 100 ? page.docs.at(-1)!.id : undefined;
  } while (cursor);
  const [count, sample] = await Promise.all([
    db.collection("consentDeletionReview").where("status", "==", "due").count().get(),
    db.collection("consentDeletionReview").where("status", "==", "due").orderBy(FieldPath.documentId()).limit(2).get()
  ]);
  const dueCount = count.data().count;
  if (dueCount) warn("DigiStayBook consent records need manual deletion review", {
    event: "consent_deletion_reminder", day, dueCount,
    records: sample.docs.map(doc => `${doc.get("consentPath")} (due ${doc.get("dueAt").toDate().toISOString().slice(0, 10)})`).join("; "),
    operationsUrl: "https://digistaybook-cbert.web.app/operations", recipient: "codebertcreations@gmail.com"
  });
  await stateRef.set({ notifiedDay: day, dueCount, notificationLogEmittedAt: dueCount ? stamp() : null }, { merge: true });
}

export const notifyConsentDeletionReview = onSchedule({ ...options, schedule: "0 * * * *", timeZone: "Australia/Sydney", timeoutSeconds: 540,
  concurrency: 1, retryCount: 3, minBackoffSeconds: 60 }, async () => { await scanConsentReviews(); });
