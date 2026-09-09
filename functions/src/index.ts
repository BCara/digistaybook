import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { wallIsOpen, publicProperty, publicPost } from "./publicWall.js";
import { guestIntakeEnabled } from "./guestContributions.js";
export { deleteStoredMedia } from "./storageDeletion.js";
export { retryPendingScreening } from "./screeningRetry.js";
export { createHostProperty, deleteHostProperty } from "./propertyCreation.js";
export { listHostExport, readHostExportPhoto } from "./hostExport.js";
export { reportGuestMemory, submitPrivacyRequest, listHostReports, resolveContentReport, listSafetyOperations, escalatePrivacyDeadlines } from "./reporting.js";
export { stripeWebhook } from "./stripeWebhook.js";
export { activationOptions, createActivationCheckout } from "./stripeActivation.js";
export { cancelSubscription, resumeSubscription } from "./stripeCancellation.js";
export { beginGuestContribution, uploadGuestPhoto, finishGuestContribution, listGuestContributions,
  changeGuestContribution, listHostGuestReview, reviewGuestContribution, readGuestReviewPhoto, guestMemoryPhoto } from "./guestContributions.js";

setGlobalOptions({ region: "australia-southeast1", maxInstances: 10 });

initializeApp();
const db = getFirestore();

export const getPublicWall = onCall(async request => {
  const slug = request.data?.slug;
  const cursor = request.data?.cursor;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40
    || (cursor !== undefined && (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(cursor)))) {
    throw new HttpsError("invalid-argument", "That wall address is invalid.");
  }
  const matches = await db.collection("properties").where("slug", "==", slug).limit(2).get();
  // Duplicate slugs fail closed until server-owned unique reservation is built.
  if (matches.size !== 1) return { status: "unavailable" };
  const property = matches.docs[0];
  const isOwner = request.auth?.uid && request.auth.uid === property.data().ownerUid;
  if (!isOwner && !wallIsOpen(property.data())) return { status: "unavailable" };
  let query = property.ref.collection("posts").where("visibility", "==", "visible").orderBy("createdAt", "desc").limit(25);
  if (cursor) {
    const after = await property.ref.collection("posts").doc(cursor).get();
    if (!after.exists || after.get("visibility") !== "visible") return { status: "unavailable" };
    query = query.startAfter(after);
  }
  const posts = await query.get();
  // Recheck after the query so a concurrent suspension does not return a stale wall.
  const latest = await property.ref.get();
  if (!latest.exists || !wallIsOpen(latest.data()!)) return { status: "unavailable" };
  return { status: "open", contributionsEnabled: guestIntakeEnabled(), property: publicProperty(latest.data()!),
    posts: posts.docs.map(post => publicPost(post.id, post.data())),
    nextCursor: posts.size === 25 ? posts.docs.at(-1)!.id : null };
});

export const health = onRequest((request, response) => {
  response.status(200).json({ service: "digistaybook-functions", status: "ok" });
});

/* ===========================================================================
   moderatePost — the single transactional endpoint for a Host's moderation.

   The reporting state model (BOP 3.6) requires that every change to a post's
   visibility go through one server endpoint, so that no client write and no
   crafted request can hide, restore or delete another guest's memory. Firestore
   rules enforce the other half of that: `properties/{id}/posts` is readable by
   the owning Host and writable by nobody. This is the only way a post moves.

   The transition table below is a deliberate second copy of the one in
   `src/domain/postModeration.ts`. That one decides which buttons to draw; this
   one decides what may actually happen, and it does not trust the first.

   Guest reporting, self-deletion and automated screening are separate
   endpoints, not yet built. Nothing here is a general-purpose post writer.
   ========================================================================= */

type Visibility = "visible" | "hidden_pending_review" | "hidden_by_host" | "restricted" | "deleted";
type Action = "publish" | "hide" | "delete" | "pin" | "unpin" | "escalate";

const ACTIONS: readonly Action[] = ["publish", "hide", "delete", "pin", "unpin", "escalate"];

/**
 * Which visibilities each action may be applied from.
 *
 * `restricted` appears nowhere: a Tier-2 internal case is out of the Host's
 * hands by design, and a Host who could publish or delete one would be
 * overriding a Trust & Safety decision and destroying its evidence. `deleted`
 * appears nowhere because there is nothing left to move.
 */
const ALLOWED_FROM: Record<Action, readonly Visibility[]> = {
  publish: ["hidden_pending_review", "hidden_by_host"],
  hide: ["visible"],
  delete: ["visible", "hidden_pending_review", "hidden_by_host"],
  pin: ["visible"],
  unpin: ["visible"],
  escalate: ["visible", "hidden_pending_review", "hidden_by_host"]
};

/** The state-model name recorded on the audit event for each action. */
const OUTCOME: Record<Action, string> = {
  publish: "rejected_restored",
  hide: "host_hidden",
  delete: "confirmed_delete",
  pin: "host_curation",
  unpin: "host_curation",
  escalate: "host_escalation"
};

const ID = /^[A-Za-z0-9_-]{1,128}$/;

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new HttpsError("invalid-argument", `A valid ${field} is required.`);
  }
  return value;
}

/**
 * The post fields this action rewrites. Everything else on the document — the
 * message, the photograph, who wrote it — is never touched by moderation.
 */
function changes(action: Action, uid: string): Record<string, unknown> {
  const now = FieldValue.serverTimestamp();
  const stamp = { moderatedAt: now, moderatedBy: uid };
  switch (action) {
    case "publish":
      // Restoring clears the hold: the reason it was down no longer applies,
      // and leaving it would keep the memory in a review pile forever.
      return { ...stamp, visibility: "visible", hold: FieldValue.delete() };
    case "hide":
      return {
        ...stamp,
        visibility: "hidden_by_host",
        // A hidden post cannot also be pinned to the top of the wall.
        pinned: false,
        hold: { source: "host_decision", reason: null, detail: "", raisedAt: now }
      };
    case "delete":
      // The document is tombstoned rather than removed, so the retention sweep
      // still has the record it needs to delete the Storage object and close
      // any open report. Nothing readable by a guest survives it.
      return { ...stamp, visibility: "deleted", pinned: false, deletedAt: now, message: "", displayName: "", photo: FieldValue.delete() };
    case "pin":
      return { ...stamp, pinned: true };
    case "unpin":
      return { ...stamp, pinned: false };
    case "escalate":
      // An escalation opens an internal case and leaves the wall alone. Hiding
      // the post here would tell the Host their wall had changed when the
      // decision is still ours to make; they can take it off the wall as well.
      return { ...stamp, escalatedAt: now };
  }
}

export const moderatePost = onCall(
  // App Check keeps the endpoint to builds of our own client, which is the
  // precondition the state model puts on every privileged report path. It is
  // relaxed inside the Functions emulator and nowhere else: a demo project
  // cannot mint an attestation token, so enforcing it locally would mean this
  // endpoint could never be exercised or tested before it was deployed. Every
  // audit event records which of the two it was.
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" },
  async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError("unauthenticated", "Sign in to moderate this wall.");
    // Anonymous sessions exist for guests only. A Host session is never one,
    // and this mirrors the `isHost()` check in the Firestore rules.
    if (auth.token.firebase?.sign_in_provider === "anonymous") {
      throw new HttpsError("permission-denied", "Moderation requires a host account.");
    }

    const data = (request.data ?? {}) as Record<string, unknown>;
    const propertyId = requireId(data.propertyId, "property");
    const postId = requireId(data.postId, "post");
    const requestId = requireId(data.requestId, "request id");
    const action = ACTIONS.find((candidate) => candidate === data.action);
    if (!action) throw new HttpsError("invalid-argument", "That is not a moderation action.");

    const propertyRef = db.doc(`properties/${propertyId}`);
    const postRef = propertyRef.collection("posts").doc(postId);
    // Keyed by the client's request id, so a retry lands on the same document
    // and a double tap cannot open two Trust & Safety cases for one memory.
    const eventRef = propertyRef.collection("moderationEvents").doc(requestId);

    const post = await db.runTransaction(async (tx) => {
      const [property, existing, replay] = await Promise.all([
        tx.get(propertyRef),
        tx.get(postRef),
        tx.get(eventRef)
      ]);

      if (!property.exists || property.get("ownerUid") !== auth.uid) {
        // The same answer whether the property is missing or someone else's:
        // a probe must not be able to tell those apart.
        throw new HttpsError("permission-denied", "That property is not yours.");
      }
      if (!existing.exists) throw new HttpsError("not-found", "That memory is no longer here.");
      const guestId = existing.get("guestSubmissionId");
      const guestRef = typeof guestId === "string" ? db.collection("guestSubmissions").doc(guestId) : null;
      const guestSnapshot = guestRef ? await tx.get(guestRef) : null;
      const guestData = guestSnapshot?.data();
      if (guestRef && (!guestData || guestData.propertyId !== propertyId)) throw new HttpsError("failed-precondition", "This memory needs internal review.");

      // A replay returns the post as it already stands rather than applying
      // the action twice; the first attempt may simply have lost its answer.
      if (existing.get("visibility") === "restricted") {
        throw new HttpsError("permission-denied", "This case is managed by Privacy & Safety.");
      }
      if (replay.exists) {
        if (replay.get("postId") !== postId || replay.get("action") !== action || replay.get("resolvedBy") !== auth.uid) {
          throw new HttpsError("already-exists", "This request reference was already used for another action.");
        }
        return existing.data();
      }

      const from = existing.get("visibility") as Visibility | undefined;
      if (!from || !ALLOWED_FROM[action].includes(from)) {
        throw new HttpsError("failed-precondition", "That memory has already changed. Reload the queue.");
      }

      if (action === "publish" && (existing.get("openReportCount") > 0 || existing.get("safetyRestricted") === true)) {
        throw new HttpsError("failed-precondition", "Resolve the outstanding reports before restoring this memory.");
      }
      if (guestData && action === "publish" && (guestData.mediaLocation !== "published" || !["standard", "hidden_by_host", "published"].includes(guestData.status))) {
        throw new HttpsError("failed-precondition", "Use the screened guest review controls for this memory.");
      }
      if (guestRef && guestData && ["publish", "hide", "delete"].includes(action)) {
        tx.update(guestRef, { status: action === "publish" ? "published" : action === "hide" ? "hidden_by_host" : "deleted",
          ...(action === "delete" ? { message: "", feedback: "", revision: guestData.revision + 1 } : {}), updatedAt: FieldValue.serverTimestamp() });
        if (action === "delete") {
          tx.delete(propertyRef.collection("privateFeedback").doc(guestId));
          tx.set(db.collection("deletionJobs").doc(`guest-${guestId}`), { propertyId, postId,
            objects: Array.from({ length: guestData.photoCount }, (_, index) => [
              { bucket: guestData.bucket, path: `properties/${propertyId}/quarantine/${guestId}/${index}.webp` },
              { bucket: guestData.publishedBucket, path: `properties/${propertyId}/published/${guestId}/${index}.webp` }
            ]).flat(), status: "pending", source: "host_delete", createdAt: FieldValue.serverTimestamp(),
            dueAt: Timestamp.fromMillis(Date.now() + 72 * 3600000),
            requiresSafetyReview: guestData.safetyCaseOpen === true });
        }
      }
      if (action === "delete") {
        // Preserve object targets privately before clearing the public record.
        // A worker must finish this job before permanent deletion is claimed.
        const photo = existing.get("photo");
        const photos = existing.get("photos");
        const paths = [photo, ...(Array.isArray(photos) ? photos : [])]
          .map(item => item?.path).filter((path): path is string => typeof path === "string" && path.startsWith(`properties/${propertyId}/`));
        tx.set(db.collection("deletionJobs").doc(`${propertyId}:${requestId}`), {
          propertyId, postId, paths: [...new Set(paths)], status: "pending",
          createdAt: FieldValue.serverTimestamp(), requestedBy: auth.uid
        });
      }
      tx.update(postRef, { ...changes(action, auth.uid), ...(action === "delete" ? { photos: FieldValue.delete() } : {}) });

      // The audit event records what moved and who moved it, and deliberately
      // never copies the reported message or media into itself (BOP 3.6).
      tx.set(eventRef, {
        propertyId,
        postId,
        action,
        outcome: OUTCOME[action],
        previousVisibility: from,
        resolvedBy: auth.uid,
        appCheck: request.app ? "verified" : "absent",
        createdAt: FieldValue.serverTimestamp()
      });

      if (action === "escalate") {
        // The restricted internal queue. It is written outside the property
        // tree because Firestore rules deny every client read of this path,
        // and a Host must not be able to read or clear their own escalation.
        tx.set(db.collection("trustSafetyCases").doc(`${propertyId}:${requestId}`), {
          propertyId,
          postId,
          source: "host_escalation",
          raisedBy: auth.uid,
          status: "open",
          createdAt: FieldValue.serverTimestamp(),
          // The daily sweep and the 30-day review both read this.
          reviewDueAt: Timestamp.fromMillis(Date.now() + 30 * 86_400_000)
        });
      }

      return existing.data();
    });

    // Read back what was actually written, so the queue renders the server's
    // state rather than the client's prediction of it.
    const settled = await postRef.get();
    if (settled.get("visibility") === "restricted") throw new HttpsError("permission-denied", "This case is managed by Privacy & Safety.");
    return { post: { ...(settled.data() ?? post), id: postId } };
  }
);

// Privileged report, contribution, billing, email and deletion handlers are
// added only with App Check, idempotency, transaction and emulator tests.
// No permissive placeholder endpoint is exported for those workflows.
