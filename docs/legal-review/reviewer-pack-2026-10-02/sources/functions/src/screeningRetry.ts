import { randomUUID } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { processGuestSubmission, deliverFeedback } from "./guestContributions.js";
import type { Screener, FeedbackScreener } from "./screening.js";
import { screeningCapacityAvailable } from "./screeningBudget.js";

export async function retryScreening(id: string, now = Date.now(), screener?: Screener, feedbackScreener?: FeedbackScreener) {
  if (!screener && !feedbackScreener && !await screeningCapacityAvailable()) return;
  const db = getFirestore(), ref = db.doc(`guestSubmissions/${id}`), token = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    if (!data) return null;
    const feedback = data.kind === "feedback";
    if (feedback ? data.status !== "feedback" || data.feedbackStatus || !data.feedback : data.status !== "pending") return null;
    const sameRevision = data.screeningRetryRevision === data.revision;
    if (sameRevision && ((data.screeningRetryAt?.toMillis?.() ?? 0) > now || (data.screeningLeaseUntil?.toMillis?.() ?? 0) > now || data.screeningRetryState === "needs_attention")) return null;
    const attempts = sameRevision ? (data.screeningAttempts ?? 0) + 1 : 1;
    if (attempts > 8) {
      tx.update(ref, { screeningRetryState: "needs_attention" });
      tx.set(db.doc(`operationsAlerts/screening-${id}`), { kind: "screening_failed", submissionId: id, propertyId: data.propertyId, status: "pending", createdAt: FieldValue.serverTimestamp() });
      return null;
    }
    tx.update(ref, { screeningRetryRevision: data.revision, screeningAttempts: attempts, screeningLeaseToken: token, screeningLeaseUntil: Timestamp.fromMillis(now + 10 * 60000) });
    return { revision: data.revision, attempts, propertyId: data.propertyId, feedback };
  });
  if (!claim) return;
  try {
    if (claim.feedback) await deliverFeedback(id, feedbackScreener);
    else await processGuestSubmission(id, screener);
  } catch { /* The bounded retry below records the unavailable outcome without content. */ }
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.get("screeningLeaseToken") !== token || current.get("revision") !== claim.revision) return;
    if (current.get("screeningBudgetWaiting") === true) {
      tx.update(ref, { screeningAttempts: claim.attempts - 1, screeningLeaseToken: FieldValue.delete(), screeningLeaseUntil: FieldValue.delete(),
        screeningRetryState: "retry", screeningRetryAt: Timestamp.fromMillis(now + 5 * 60000) });
      return;
    }
    const failed = claim.feedback ? current.get("status") === "feedback" && !current.get("feedbackStatus") : current.get("status") === "pending";
    const exhausted = failed && claim.attempts >= 8;
    tx.update(ref, { screeningLeaseToken: FieldValue.delete(), screeningLeaseUntil: FieldValue.delete(),
      screeningRetryState: exhausted ? "needs_attention" : failed ? "retry" : "complete",
      screeningRetryAt: failed ? Timestamp.fromMillis(now + Math.min(3600000, 60000 * 2 ** (claim.attempts - 1))) : FieldValue.delete() });
    if (exhausted) tx.set(db.doc(`operationsAlerts/screening-${id}`), { kind: "screening_failed", submissionId: id, propertyId: claim.propertyId, status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
}

export const retryPendingScreening = onSchedule({ schedule: "every 5 minutes", region: "australia-southeast1", timeoutSeconds: 540, memory: "1GiB", concurrency: 1, maxInstances: 1 }, async () => {
  if (!await screeningCapacityAvailable()) return;
  const db = getFirestore(), state = db.doc("workerState/screening"), worker = await state.get(), cursor = worker.get("cursor");
  let query = db.collection("guestSubmissions").where("status", "==", "pending").orderBy(FieldPath.documentId()).limit(10);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  for (let index = 0; index < page.docs.length; index += 3) await Promise.all(page.docs.slice(index, index + 3).map(doc => retryScreening(doc.id)));
  await state.set({ cursor: page.size === 10 ? page.docs.at(-1)!.id : null, updatedAt: FieldValue.serverTimestamp() });
  let feedbackQuery = db.collection("guestSubmissions").where("screeningFeedbackPending", "==", true).orderBy(FieldPath.documentId()).limit(20);
  if (worker.get("feedbackCursor")) feedbackQuery = feedbackQuery.startAfter(worker.get("feedbackCursor"));
  const feedback = await feedbackQuery.get();
  for (const doc of feedback.docs) await retryScreening(doc.id);
  await state.set({ feedbackCursor: feedback.size === 20 ? feedback.docs.at(-1)!.id : null }, { merge: true });
  // Preserve recovery for feedback deferred by the previous budget-only worker.
  const legacy = await db.collection("guestSubmissions").where("screeningBudgetWaiting", "==", true).limit(20).get();
  for (const doc of legacy.docs) if (doc.get("kind") === "feedback" && !doc.get("screeningFeedbackPending")) await retryScreening(doc.id);
});
