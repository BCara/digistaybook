import "./runtimeOptions.js";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { wallIsOpen, publicProperty, publicPost, unavailableWall, wallPreviewable, ownerRecovery, resolveWallView } from "./publicWall.js";
import { guestIntakeEnabled } from "./guestContributions.js";
import { ARCHIVE_RETENTION_HOLD, archiveDeletedPost } from "./deletedContentArchive.js";
export { deleteStoredMedia } from "./storageDeletion.js";
export { retryPendingScreening } from "./screeningRetry.js";
export { notifyScreeningAllowance } from "./screeningBudget.js";
export { notifyConsentDeletionReview, readConsentDeletionReview } from "./consentRetention.js";
export { notifyNewOperationsItems } from "./operationsNotify.js";
export { createHostProperty, deleteHostProperty, ensureStayToken } from "./propertyCreation.js";
export { listHostExport, readHostExportPhoto } from "./hostExport.js";
export { reportGuestMemory, submitPrivacyRequest, listHostReports, resolveContentReport, listSafetyOperations, readSafetyCase, readSafetyCasePhoto, resolveSafetyCase, escalatePrivacyDeadlines } from "./reporting.js";
export { stripeWebhook } from "./stripeWebhook.js";
export { activationOptions, createActivationCheckout } from "./stripeActivation.js";
export { cancelSubscription, resumeSubscription } from "./stripeCancellation.js";
export { beginGuestContribution, uploadGuestPhoto, finishGuestContribution, listGuestContributions,
  changeGuestContribution, listHostGuestReview, setGuestReviewPolicy, reportPrivateFeedback, reviewGuestContribution, readGuestReviewPhoto, guestMemoryPhoto } from "./guestContributions.js";

initializeApp();
const db = getFirestore();

/**
 * The wall a guest opens, and the only endpoint they reach without doing
 * anything first.
 *
 * It scales to zero. It was declared with `minInstances: 1`, because this one
 * is the whole page - it is what the placard in the hallway points at, and a
 * cold container in Sydney put two to five seconds in front of someone
 * standing in a doorway with a suitcase. A resident instance removes that and
 * bills about six US dollars a month whether or not anybody scans anything.
 * Before the first property is paid for there is no guest in that doorway, so
 * the warm instance is bought back when the product earns it rather than now.
 * The warm path itself is already short (D-024); what returns without this is
 * the first request after an idle spell.
 */
export const getPublicWall = onCall({ maxInstances: 10 }, async request => {
  const slug = request.data?.slug;
  const cursor = request.data?.cursor;
  const requestedView = request.data?.view ?? "public";
  if (requestedView !== "public" && requestedView !== "stay") throw new HttpsError("invalid-argument", "That wall view is invalid.");
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40
    || (cursor !== undefined && (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(cursor)))) {
    throw new HttpsError("invalid-argument", "That wall address is invalid.");
  }
  const matches = await db.collection("properties").where("slug", "==", slug).limit(2).get();
  // Duplicate slugs fail closed until server-owned unique reservation is built.
  if (matches.size !== 1) return { status: "unavailable" };
  const property = matches.docs[0];
  const uid = request.auth?.uid;
  // Asking for the in-stay wall is not reaching it. A caller without the
  // token minted into this property's placard reads the public wall instead:
  // no house information, no contributions, and nothing in the answer to say
  // whether there was house information to be had.
  const view = resolveWallView(property.data(), requestedView, request.data?.token, uid);
  // A closed wall is still served to the account that owns it, as a preview:
  // a Host who cannot read their own wall before it is published is being
  // asked to publish something they have never seen. Every other caller gets
  // the closed notice, so a preview discloses nothing that a guest would not
  // read once the wall opens.
  if (!wallIsOpen(property.data(), Date.now(), view) && !wallPreviewable(property.data(), uid)) {
    return unavailableWall(property.data(), property.id, uid);
  }
  let query = property.ref.collection("posts").where("visibility", "==", "visible").orderBy("createdAt", "desc").limit(25);
  if (cursor) {
    const after = await property.ref.collection("posts").doc(cursor).get();
    if (!after.exists || after.get("visibility") !== "visible") return { status: "unavailable" };
    query = query.startAfter(after);
  }
  // The posts and the second look at the property are asked for together.
  // The re-read is here because the property was read before the posts were,
  // and a wall suspended in between must not be served on the strength of the
  // older snapshot; running it alongside rather than after narrows the window
  // it covers by the length of the posts query, which is the price of one
  // fewer round trip in front of every guest. Neither ordering is airtight -
  // a suspension committed after this read still lands after the response -
  // and the next request is what closes that in both.
  // Pinned memories lead the first page, whatever their date: pinning is the
  // Host saying "read this one first", and a pin the wall ignores is a button
  // that does nothing. They are left out of the dated pages so none appears
  // twice. Equality filters only, so no composite index is needed.
  const pinnedQuery = cursor ? null : property.ref.collection("posts")
    .where("visibility", "==", "visible").where("pinned", "==", true).limit(12);
  const [posts, latest, pinned] = await Promise.all([query.get(), property.ref.get(), pinnedQuery?.get()]);
  if (!latest.exists) return { status: "unavailable" };
  const open = wallIsOpen(latest.data()!, Date.now(), view);
  if (!open && !wallPreviewable(latest.data(), uid)) return unavailableWall(latest.data(), property.id, uid);
  return { status: open ? "open" : "preview",
    // A closed wall takes no contributions, whoever is reading it.
    contributionsEnabled: open && view === "stay" && guestIntakeEnabled(property.id),
    ...(open ? {} : { owner: ownerRecovery(latest.data()!, property.id) }),
    property: publicProperty(latest.data()!, view),
    posts: [
      ...(pinned?.docs ?? []).map(post => ({ ...publicPost(post.id, post.data()), pinned: true }))
        .sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? "")),
      ...posts.docs.filter(post => post.get("pinned") !== true).map(post => publicPost(post.id, post.data()))
    ],
    nextCursor: posts.size === 25 ? posts.docs.at(-1)!.id : null };
});

export const health = onRequest({ maxInstances: 10 }, (request, response) => {
  response.status(200).json({ service: "digistaybook-functions", status: "ok" });
});

/* ===========================================================================
   moderatePost � the single transactional endpoint for a Host's moderation.

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
 * The post fields this action rewrites. Everything else on the document � the
 * message, the photograph, who wrote it � is never touched by moderation.
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
      // The document is tombstoned so nothing readable by a guest or the Host
      // survives it. The content itself is copied to the private deleted
      // content archive first and kept, so a mistaken delete can be undone.
      return { ...stamp, visibility: "deleted", pinned: false, deletedAt: now, message: "", displayName: "", photo: FieldValue.delete(),
        retentionHold: ARCHIVE_RETENTION_HOLD };
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
  { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true", maxInstances: 10 },
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
      const feedbackRef = guestRef ? propertyRef.collection("privateFeedback").doc(guestRef.id) : null;
      const feedback = action === "delete" && feedbackRef ? await tx.get(feedbackRef) : null;

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
        if (action === "delete") tx.delete(propertyRef.collection("privateFeedback").doc(guestId));
      }
      if (action === "delete") {
        // Host deletions are retained rather than purged: no deletion job is
        // queued and the photographs stay in Storage. See deletedContentArchive.
        archiveDeletedPost(tx, { propertyId, postId, source: "host_delete", deletedBy: auth.uid, post: existing.data()!,
          guestSubmissionId: guestRef?.id ?? null, guestSubmission: guestData ?? null, privateFeedback: feedback?.data() ?? null });
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
