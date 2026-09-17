import { randomUUID } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { processGuestSubmission } from "./guestContributions.js";
import type { Screener } from "./screening.js";

export async function retryScreening(id: string, now = Date.now(), screener?: Screener) {
  const db = getFirestore(), ref = db.doc(`guestSubmissions/${id}`), token = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    if (!data || data.status !== "pending") return null;
    const sameRevision = data.screeningRetryRevision === data.revision;
    if (sameRevision && ((data.screeningRetryAt?.toMillis?.() ?? 0) > now || (data.screeningLeaseUntil?.toMillis?.() ?? 0) > now || data.screeningRetryState === "needs_attention")) return null;
    const attempts = sameRevision ? (data.screeningAttempts ?? 0) + 1 : 1;
    if (attempts > 8) {
      tx.update(ref, { screeningRetryState: "needs_attention" });
      tx.set(db.doc(`operationsAlerts/screening-${id}`), { kind: "screening_failed", submissionId: id, propertyId: data.propertyId, status: "pending", createdAt: FieldValue.serverTimestamp() });
      return null;
    }
    tx.update(ref, { screeningRetryRevision: data.revision, screeningAttempts: attempts, screeningLeaseToken: token, screeningLeaseUntil: Timestamp.fromMillis(now + 10 * 60000) });
    return { revision: data.revision, attempts, propertyId: data.propertyId };
  });
  if (!claim) return;
  try { await processGuestSubmission(id, screener); } catch { /* The bounded retry below records the unavailable outcome without content. */ }
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.get("screeningLeaseToken") !== token || current.get("revision") !== claim.revision) return;
    const failed = current.get("status") === "pending", exhausted = failed && claim.attempts >= 8;
    tx.update(ref, { screeningLeaseToken: FieldValue.delete(), screeningLeaseUntil: FieldValue.delete(),
      screeningRetryState: exhausted ? "needs_attention" : failed ? "retry" : "complete",
      screeningRetryAt: failed ? Timestamp.fromMillis(now + Math.min(3600000, 60000 * 2 ** (claim.attempts - 1))) : FieldValue.delete() });
    if (exhausted) tx.set(db.doc(`operationsAlerts/screening-${id}`), { kind: "screening_failed", submissionId: id, propertyId: claim.propertyId, status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
}

export const retryPendingScreening = onSchedule({ schedule: "every 5 minutes", region: "australia-southeast1", timeoutSeconds: 540, memory: "1GiB", concurrency: 1, maxInstances: 1 }, async () => {
  const db = getFirestore(), state = db.doc("workerState/screening"), cursor = (await state.get()).get("cursor");
  let query = db.collection("guestSubmissions").where("status", "==", "pending").orderBy(FieldPath.documentId()).limit(10);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  for (let index = 0; index < page.docs.length; index += 3) await Promise.all(page.docs.slice(index, index + 3).map(doc => retryScreening(doc.id)));
  await state.set({ cursor: page.size === 10 ? page.docs.at(-1)!.id : null, updatedAt: FieldValue.serverTimestamp() });
});
