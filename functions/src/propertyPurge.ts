import { FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { DELETED_CONTENT_ARCHIVE } from "./deletedContentArchive.js";
import { endSubscription } from "./propertyCreation.js";
import { hostMediaBucket } from "./storageDeletion.js";
import { stripeSecrets } from "./stripeConfig.js";

/* ===========================================================================
   propertyPurge — what "deleted" finally means.

   Deleting a property (or the account that owns it) takes it out of service
   at once: `lifecycle` becomes `deleted`, the wall stops being served and the
   subscription is cancelled. Nothing was removed after that. The guests'
   memories, their photographs, the house information and the Wi-Fi password
   all stayed where they were, indefinitely.

   This worker removes them once the grace period has run. For each property
   it:

   1. ends any subscription Stripe would still bill (a property deleted before
      cancel-on-delete existed could still have one);
   2. stops if anything about the property is under an open safety hold, and
      looks again on the next run — a hold is released by the people who
      opened it, never by a timer;
   3. clears every guest submission and post to the same tombstone a guest's
      own deletion leaves, and queues their photographs through `deletionJobs`
      so the existing worker removes the files with its retries and checks;
   4. deletes private feedback and the Host-deletion archive for the property
      (the archive exists so a mistaken delete can be undone; once the property
      itself is purged there is nothing to restore it to);
   5. queues the Host's own photographs the same way;
   6. clears the property document down to what accounting and the address
      reservation still need, and writes a content-free audit record.

   Kept on purpose: billing references and `billingActions` (accounting, five
   years), `moderationEvents` and closed safety cases (content-free audit),
   `guestConsent` (its own 24-month rule, `consentRetention.ts`), and the slug
   reservation of a property that was ever live.
   ========================================================================= */

/**
 * How long a deleted property is kept before its content is removed.
 *
 * The retention schedule (BOP §5.10) gives a deadline, not a grace period:
 * primary deletion "within 30 days of a host deletion request". Fourteen days
 * leaves a Host who deleted the wrong property time to ask for it back, and
 * leaves the photo worker its 72 hours, well inside the 30. The exact figure
 * is the owner's decision and is not yet recorded as one.
 */
export const DELETED_PROPERTY_GRACE_DAYS = 14;

const DAY_MS = 86_400_000;
const OPEN_CASE = ["open", "escalated"];
const OPEN_REPORT = ["open", "internal", "escalated"];
const OPEN_PRIVACY = ["awaiting_verification", "verified", "escalated"];
const millis = (value: any): number => value?.toMillis?.() ?? 0;

/** When a deleted property becomes due. Older deletions carry no `deletedAt`, so the last write stands in. */
export function purgeDueAt(data: Record<string, any>): number | null {
  if (data.lifecycle !== "deleted" || data.purgedAt) return null;
  const deleted = millis(data.deletedAt) || millis(data.updatedAt);
  return deleted ? deleted + DELETED_PROPERTY_GRACE_DAYS * DAY_MS : null;
}

type Photo = { bucket: string; path: string };

/** Both copies of every photograph a submission could have: quarantine and published. */
export function submissionPhotos(propertyId: string, id: string, data: Record<string, any>): Photo[] {
  const count = Number.isInteger(data.photoCount) ? Math.max(0, Math.min(10, data.photoCount)) : 0;
  const objects: Photo[] = [];
  for (let index = 0; index < count; index++) {
    if (typeof data.bucket === "string" && data.bucket) objects.push({ bucket: data.bucket, path: `properties/${propertyId}/quarantine/${id}/${index}.webp` });
    if (typeof data.publishedBucket === "string" && data.publishedBucket) objects.push({ bucket: data.publishedBucket, path: `properties/${propertyId}/published/${id}/${index}.webp` });
  }
  return objects;
}

async function pages(query: FirebaseFirestore.Query, each: (doc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void> | void) {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let page = query.orderBy(FieldPath.documentId()).limit(200);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();
    for (const doc of snapshot.docs) await each(doc);
    if (snapshot.size < 200) return;
    cursor = snapshot.docs.at(-1);
  }
}

/**
 * Why a property cannot be purged yet, or null when nothing holds it.
 *
 * Each collection is read by `propertyId` alone and the status is checked
 * here, so no composite index stands between a hold and its being respected.
 */
async function openHold(propertyId: string): Promise<string | null> {
  const db = getFirestore(), mine = (name: string) => db.collection(name).where("propertyId", "==", propertyId);
  const any = async (query: FirebaseFirestore.Query, test: (doc: FirebaseFirestore.QueryDocumentSnapshot) => boolean) => {
    let found = false;
    await pages(query, doc => { if (test(doc)) found = true; });
    return found;
  };
  const status = (allowed: string[]) => (doc: FirebaseFirestore.QueryDocumentSnapshot) => allowed.includes(doc.get("status"));
  if (await any(mine("trustSafetyCases"), status(OPEN_CASE))) return "open_safety_case";
  if (await any(mine("guestSubmissions"), doc => doc.get("safetyCaseOpen") === true)
    || await any(db.collection(`properties/${propertyId}/posts`), doc => doc.get("visibility") === "restricted" || doc.get("safetyRestricted") === true)) return "content_under_safety_review";
  if (await any(mine("deletionJobs"), doc => doc.get("status") === "held" || doc.get("requiresSafetyReview") === true && doc.get("status") !== "complete")) return "photo_deletion_held";
  if (await any(mine("contentReports"), status(OPEN_REPORT))) return "open_content_report";
  if (await any(mine("privacyRequests"), status(OPEN_PRIVACY))) return "open_privacy_request";
  return null;
}

export type PurgeOutcome =
  | { status: "skipped"; reason: "not_due" | "not_deleted" | "missing" }
  | { status: "held"; reason: string }
  | { status: "purged"; counts: Record<string, number> };

type PurgeOptions = {
  /** The Host's own photographs, listed from Storage. Replaced in tests. */
  listMedia?: (bucket: string, prefix: string) => Promise<string[]>;
  /** Ends a subscription Stripe would still bill. Replaced in tests. */
  cancel?: (subscriptionId: unknown) => Promise<string | null>;
};

async function listStoredMedia(bucket: string, prefix: string): Promise<string[]> {
  const [files] = await getStorage().bucket(bucket).getFiles({ prefix });
  return files.map(file => file.name);
}

// Exported for trusted emulator verification; this is not a client endpoint.
export async function purgeProperty(propertyId: string, now = Date.now(), options: PurgeOptions = {}): Promise<PurgeOutcome> {
  const db = getFirestore(), propertyRef = db.doc(`properties/${propertyId}`);
  const property = await propertyRef.get();
  if (!property.exists) return { status: "skipped", reason: "missing" };
  const data = property.data()!;
  if (data.lifecycle !== "deleted" || data.purgedAt) return { status: "skipped", reason: "not_deleted" };
  const due = purgeDueAt(data);
  if (due === null || due > now) return { status: "skipped", reason: "not_due" };

  // Billing first: content is never removed from under a subscription that is still charging.
  const billing = data.billing ?? {};
  if (billing.stripeSubscriptionId && billing.status !== "canceled") {
    const cancelled = await (options.cancel ?? endSubscription)(billing.stripeSubscriptionId);
    if (cancelled) {
      await propertyRef.update({ "billing.status": "canceled", "billing.cancelAtPeriodEnd": false });
      await propertyRef.collection("billingActions").add({ ownerUid: data.ownerUid ?? null, action: "cancel_on_purge", stripeSubscriptionId: cancelled, at: FieldValue.serverTimestamp() });
    }
  }

  const hold = await openHold(propertyId);
  if (hold) {
    await propertyRef.update({ purge: { status: "held", reason: hold, checkedAt: Timestamp.fromMillis(now) } });
    logger.warn("property_purge_held", { propertyId, reason: hold });
    return { status: "held", reason: hold };
  }

  const counts = { submissions: 0, posts: 0, photoJobs: 0, privateFeedback: 0, archived: 0, hostMediaObjects: 0 };
  // Every write is awaited below: a write that fails must fail the purge, so
  // the property is not marked purged over content that is still there.
  const writer = db.bulkWriter(), failures: unknown[] = [];
  const track = (write: Promise<unknown>) => { write.catch(cause => { failures.push(cause); }); };
  const stamp = Timestamp.fromMillis(now), dueAt = Timestamp.fromMillis(now + 72 * 3600_000);

  await pages(db.collection("guestSubmissions").where("propertyId", "==", propertyId), async submission => {
    const objects = submissionPhotos(propertyId, submission.id, submission.data());
    if (objects.length) {
      const jobRef = db.doc(`deletionJobs/guest-${submission.id}`), job = await jobRef.get();
      // A job that already ran removed these files; one still waiting keeps its own clock.
      if (!job.exists) {
        track(writer.set(jobRef, { propertyId, postId: submission.id, bucket: submission.get("bucket") ?? null, objects,
          paths: objects.filter(object => object.bucket === submission.get("bucket")).map(object => object.path),
          status: "pending", source: "property_purge", requiresSafetyReview: false, createdAt: stamp, dueAt }));
        counts.photoJobs += 1;
      }
    }
    track(writer.update(submission.ref, { status: "deleted", message: "", feedback: "", displayName: "",
      ...(submission.get("deletedAt") ? {} : { deletedAt: stamp }), updatedAt: stamp }));
    counts.submissions += 1;
  });

  await pages(propertyRef.collection("posts"), post => {
    // The same tombstone a guest's own deletion leaves. The archive hold is
    // released with it, because the archive record goes below.
    track(writer.update(post.ref, { visibility: "deleted", message: "", displayName: "", pinned: false,
      photo: FieldValue.delete(), photos: FieldValue.delete(), hold: FieldValue.delete(), retentionHold: FieldValue.delete(),
      ...(post.get("deletedAt") ? {} : { deletedAt: stamp }) }));
    counts.posts += 1;
  });

  await pages(propertyRef.collection("privateFeedback"), feedback => { track(writer.delete(feedback.ref)); counts.privateFeedback += 1; });
  await pages(db.collection(DELETED_CONTENT_ARCHIVE).where("propertyId", "==", propertyId), archived => { track(writer.delete(archived.ref)); counts.archived += 1; });

  // The Host's own photographs, in manifests the worker accepts (at most 100 objects each).
  const mediaBucket = hostMediaBucket();
  if (mediaBucket) {
    const media = await (options.listMedia ?? listStoredMedia)(mediaBucket, `properties/${propertyId}/media/`);
    for (let index = 0; index < media.length; index += 100) {
      track(writer.set(db.doc(`deletionJobs/property-${propertyId}-media-${index / 100}`), { propertyId,
        objects: media.slice(index, index + 100).map(path => ({ bucket: mediaBucket, path })),
        status: "pending", source: "property_purge", requiresSafetyReview: false, createdAt: stamp, dueAt }));
    }
    counts.hostMediaObjects = media.length;
  } else logger.error("property_purge_no_media_bucket", { propertyId });

  await writer.close();
  if (failures.length) throw new Error(`property_purge_incomplete:${failures.length}`);

  // Last, so a run that dies above is simply run again: everything before this is idempotent.
  await propertyRef.update({
    name: "", profile: {}, stayToken: FieldValue.delete(), reviewContent: FieldValue.delete(), foundationalPostCount: 0,
    purgedAt: stamp, purge: { status: "complete", completedAt: stamp }
  });
  await db.doc(`deletionAudits/property-${propertyId}`).set({
    kind: "property_purge", propertyId, ownerUid: data.ownerUid ?? null, deletedBy: data.deletedBy ?? "host_delete",
    deletedAt: data.deletedAt ?? data.updatedAt ?? null, purgedAt: stamp, graceDays: DELETED_PROPERTY_GRACE_DAYS, counts
  });
  logger.info("property_purged", { propertyId, ...counts });
  return { status: "purged", counts };
}

export async function runPropertyPurgeSweep(now = Date.now(), options: PurgeOptions = {}) {
  const db = getFirestore(), cursorRef = db.doc("workerState/propertyPurge"), cursor = (await cursorRef.get()).get("cursor");
  // Round-robin pages, as the photo worker does: a property held on the first
  // page cannot keep the ones behind it from ever being reached.
  let query = db.collection("properties").where("lifecycle", "==", "deleted").orderBy(FieldPath.documentId()).limit(50);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  const tally = { purged: 0, held: 0, failed: 0 };
  for (const doc of page.docs) {
    if (doc.get("purgedAt")) continue;
    try {
      const outcome = await purgeProperty(doc.id, now, options);
      if (outcome.status === "purged") tally.purged += 1;
      if (outcome.status === "held") tally.held += 1;
    } catch (cause) {
      tally.failed += 1;
      logger.error("property_purge_failed", { propertyId: doc.id, reason: cause instanceof Error ? cause.message : "unknown" });
    }
  }
  await cursorRef.set({ cursor: page.size === 50 ? page.docs.at(-1)!.id : null, updatedAt: FieldValue.serverTimestamp() });
  return tally;
}

export const purgeDeletedProperties = onSchedule({ schedule: "every 24 hours", region: "australia-southeast1",
  timeoutSeconds: 540, maxInstances: 1, concurrency: 1, retryCount: 0, secrets: stripeSecrets }, async () => { await runPropertyPurgeSweep(); });
