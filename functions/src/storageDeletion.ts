import { randomUUID } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

type Queue = "deletionJobs" | "storageCleanup";
type Target = { bucket: string; path: string };
const SETTLE_MS = 5 * 60_000; // Longer than the 120-second upload/publication handlers.
const LEASE_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;
const ms = (value: any) => value?.toMillis?.() ?? 0;

function targets(data: any): Target[] {
  const allowed = new Set(process.env.FUNCTIONS_EMULATOR === "true"
    ? ["demo-digistaybook.firebasestorage.app", "demo-digistaybook-published.firebasestorage.app"]
    : [process.env.GUEST_QUARANTINE_BUCKET, process.env.GUEST_PUBLISHED_BUCKET, process.env.LEGACY_MEDIA_BUCKET].filter(Boolean));
  const items = data.objects ?? (Array.isArray(data.paths) ? data.paths.map((path: string) => ({ bucket: data.bucket ?? process.env.LEGACY_MEDIA_BUCKET, path })) : null);
  if (!Array.isArray(items) || items.length > 100 || typeof data.propertyId !== "string" || !/^[A-Za-z0-9_-]+$/.test(data.propertyId)) throw new Error("invalid_manifest");
  for (const item of items) {
    if (!allowed.has(item?.bucket) || typeof item.path !== "string" || !item.path.startsWith(`properties/${data.propertyId}/`)
      || item.path.split("/").some((part: string) => !part || part === "." || part === "..")) throw new Error("invalid_manifest");
  }
  return items;
}

// Exported for trusted emulator verification; this is not a client endpoint.
export async function processStorageJob(queue: Queue, id: string, now = Date.now(), remove?: (target: Target) => Promise<void>) {
  const db = getFirestore(), ref = db.collection(queue).doc(id), token = randomUUID();
  const claimed = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    if (!data || !["pending", "retry", "processing"].includes(data.status)) return null;
    const submissionId = data.submissionId ?? (id.startsWith("guest-") ? id.slice(6) : queue === "storageCleanup" ? id : null);
    const submission = submissionId ? await tx.get(db.collection("guestSubmissions").doc(submissionId)) : null;
    const post = data.propertyId && data.postId ? await tx.get(db.doc(`properties/${data.propertyId}/posts/${data.postId}`)) : null;
    if (data.requiresSafetyReview || submission?.get("safetyCaseOpen") || post?.get("safetyRestricted") || post?.get("visibility") === "restricted") {
      tx.update(ref, { status: "held", heldAt: Timestamp.fromMillis(now), holdReason: "safety_review_required" });
      return null;
    }
    if ((queue === "deletionJobs" && ((submission?.exists && submission.get("status") !== "deleted") || (post?.exists && post.get("visibility") !== "deleted")))
      || (queue === "storageCleanup" && (!submission?.exists || submission.get("mediaLocation") !== "published"))) {
      tx.update(ref, { status: "needs_attention", failureCode: "state_mismatch" }); return null;
    }
    const created = ms(data.createdAt);
    if (!created) { tx.update(ref, { status: "needs_attention", failureCode: "missing_created_at" }); return null; }
    if (now < created + SETTLE_MS || now < ms(data.nextAttemptAt) || (data.status === "processing" && now < ms(data.leaseUntil))) return null;
    if ((data.attempts ?? 0) >= MAX_ATTEMPTS) {
      tx.update(ref, { status: "needs_attention", failureCode: "attempt_limit" }); return null;
    }
    tx.update(ref, { status: "processing", leaseToken: token, leaseUntil: Timestamp.fromMillis(now + LEASE_MS), attempts: (data.attempts ?? 0) + 1 });
    return { ...data, propertyId: data.propertyId ?? submission?.get("propertyId"), submissionId, attempts: (data.attempts ?? 0) + 1 };
  });
  if (!claimed) return;
  let failureCode: string | null = null;
  try {
    const objects = targets(claimed);
    if (queue === "storageCleanup" && objects.some(item => !item.path.startsWith(`properties/${claimed.propertyId}/quarantine/${claimed.submissionId}/`))) throw new Error("invalid_manifest");
    // All targets are validated before the first destructive operation.
    for (const target of objects) {
      if (remove) await remove(target);
      else {
        const file = getStorage().bucket(target.bucket).file(target.path);
        await file.delete({ ignoreNotFound: true });
        if ((await file.exists())[0]) throw new Error("object_still_present");
      }
    }
  } catch (error) {
    failureCode = error instanceof Error && error.message === "invalid_manifest" ? "invalid_manifest" : "storage_delete_failed";
  }
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.get("leaseToken") !== token) return;
    const exhausted = claimed.attempts >= MAX_ATTEMPTS || failureCode === "invalid_manifest";
    tx.update(ref, {
      status: !failureCode ? "complete" : exhausted ? "needs_attention" : "retry",
      leaseToken: FieldValue.delete(), leaseUntil: FieldValue.delete(),
      ...(!failureCode ? { completedAt: Timestamp.fromMillis(now), failureCode: FieldValue.delete(), nextAttemptAt: FieldValue.delete() }
        : { failureCode, nextAttemptAt: Timestamp.fromMillis(now + Math.min(3600_000, 60_000 * 2 ** (claimed.attempts - 1))) })
    });
  });
  if (failureCode) logger.error("storage_deletion_failed", { queue, jobId: id, failureCode, attempts: claimed.attempts });
}

export async function runStorageDeletionSweep() {
  const db = getFirestore();
  for (const queue of ["deletionJobs", "storageCleanup"] as const) {
    // Round-robin pages include legacy manifests without new scheduling fields.
    // A held or failing first page cannot starve subsequent jobs.
    const cursorRef = db.doc(`workerState/${queue}`), cursor = (await cursorRef.get()).get("cursor");
    let query = db.collection(queue).where("status", "in", ["pending", "retry", "processing", "held", "needs_attention"]).orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      await processStorageJob(queue, doc.id);
      const current = await doc.ref.get();
      const deadline = ms(current.get("dueAt")) || ms(current.get("createdAt")) + (queue === "storageCleanup" ? 24 : 72) * 3600_000;
      if (current.get("status") !== "complete" && deadline < Date.now()) logger.error("storage_deletion_overdue", { queue, jobId: doc.id, status: current.get("status") });
    }
    await cursorRef.set({ cursor: page.size === 100 ? page.docs.at(-1)!.id : null, updatedAt: FieldValue.serverTimestamp() });
  }
}

export const deleteStoredMedia = onSchedule({ schedule: "every 5 minutes", region: "australia-southeast1",
  timeoutSeconds: 540, maxInstances: 1, concurrency: 1, retryCount: 0 }, async () => { await runStorageDeletionSweep(); });
