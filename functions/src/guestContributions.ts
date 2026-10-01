import { createHash } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp, type Query } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, onRequest, type CallableRequest } from "firebase-functions/v2/https";
import sharp from "sharp";
import { wallIsOpen, stayTokenMatches } from "./publicWall.js";
import { guestPolicy, pendingMessage, feedbackSentMessage } from "./guestPolicy.js";
import { legalApproved, legalVersions } from "./legal.js";
import { screenContent, screenFeedback, type FeedbackScreener, type FeedbackVerdict, type Screener } from "./screening.js";

const options = { region: "australia-southeast1", maxInstances: 10, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true", memory: "512MiB" as const, timeoutSeconds: 120, concurrency: 4 };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stamp = () => FieldValue.serverTimestamp();
const db = () => getFirestore();
const submissionRef = (id: string) => db().collection("guestSubmissions").doc(id);
const validId = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new HttpsError("invalid-argument", "Invalid memory reference.");
  return value;
};
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim().length > max) throw new HttpsError("invalid-argument", `Text must be no longer than ${max} characters.`);
  return value.trim();
}
function uid(request: CallableRequest, guest = true) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Your session has expired. Reopen this guestbook.");
  const anonymous = request.auth.token.firebase?.sign_in_provider === "anonymous";
  if (anonymous !== guest) throw new HttpsError("permission-denied", "This action is not available in this session.");
  return request.auth.uid;
}
// Guests send personal text and photos only under approved Terms, Privacy
// Policy and consent wording (GC-03), so the deployment switch alone cannot
// open intake. The emulator runs on the drafts.
export function guestIntakeEnabled() {
  return process.env.FUNCTIONS_EMULATOR === "true" || (process.env.GUEST_CONTRIBUTIONS_ENABLED === "true" && legalApproved());
}
function bucketName() {
  if (process.env.FUNCTIONS_EMULATOR === "true") return "demo-digistaybook.firebasestorage.app";
  if (!process.env.GUEST_QUARANTINE_BUCKET) throw new HttpsError("failed-precondition", "New memories are temporarily unavailable.");
  return process.env.GUEST_QUARANTINE_BUCKET;
}
function publishedBucketName() {
  if (process.env.FUNCTIONS_EMULATOR === "true") return "demo-digistaybook-published.firebasestorage.app";
  if (!process.env.GUEST_PUBLISHED_BUCKET || process.env.GUEST_PUBLISHED_BUCKET === process.env.GUEST_QUARANTINE_BUCKET) {
    throw new HttpsError("failed-precondition", "Photo publication is temporarily unavailable.");
  }
  return process.env.GUEST_PUBLISHED_BUCKET;
}
const publishedPath = (propertyId: string, id: string, index: number) => `properties/${propertyId}/published/${id}/${index}.webp`;
function photoSource(data: Record<string, any>, id: string, index: number) {
  return data.mediaLocation === "published" ? { bucket: data.publishedBucket, path: publishedPath(data.propertyId, id, index) }
    : { bucket: data.bucket, path: data.slots[index].path };
}
async function promotePhotos(id: string, data: Record<string, any>) {
  if (data.mediaLocation === "published") return;
  for (let index = 0; index < data.photoCount; index++) {
    await getStorage().bucket(data.bucket).file(data.slots[index].path)
      .copy(getStorage().bucket(data.publishedBucket).file(publishedPath(data.propertyId, id, index)));
  }
}
async function clearQuarantine(id: string, data: Record<string, any>) {
  try {
    for (let index = 0; index < data.photoCount; index++) await getStorage().bucket(data.bucket).file(data.slots[index].path).delete({ ignoreNotFound: true });
  } catch {
    // Failed cleanup is retried by the scheduled storage worker.
    await db().doc(`storageCleanup/${id}`).set({ propertyId: data.propertyId, submissionId: id, bucket: data.bucket, paths: Object.values(data.slots as Record<string, any>).map(slot => slot.path),
      status: "pending", dueAt: Timestamp.fromMillis(Date.now() + 24 * 3600000), createdAt: stamp() });
  }
}
async function propertyForSlug(slug: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,40}$/.test(slug)) throw new HttpsError("invalid-argument", "Invalid guestbook address.");
  const matches = await db().collection("properties").where("slug", "==", slug).limit(2).get();
  if (matches.size !== 1 || !wallIsOpen(matches.docs[0].data())) throw new HttpsError("failed-precondition", "This guestbook is currently offline.");
  return matches.docs[0];
}
async function owned(id: string, owner: string) {
  const snapshot = await submissionRef(id).get();
  if (!snapshot.exists || snapshot.get("uid") !== owner) throw new HttpsError("permission-denied", "This memory is not available in your current session.");
  return snapshot;
}

export const beginGuestContribution = onCall(options, async request => {
  const owner = uid(request);
  if (!guestIntakeEnabled()) throw new HttpsError("failed-precondition", "New memories are temporarily unavailable.");
  const property = await propertyForSlug(request.data?.slug);
  // A memory is left by someone who was in the property, and holding the
  // guestbook link is what stands for that. The slug alone is public - it is
  // in the listing and embedded on the Host's own site - so gating only the
  // reading of the house would leave every live wall open to be written on by
  // anyone who found its address. This is the gate: the calls after it are
  // reached through a submission this session already owns.
  if (!stayTokenMatches(property.data(), request.data?.stayToken)) throw new HttpsError("permission-denied", "Open this guestbook from the QR code in the property to add a memory.");
  const message = text(request.data?.message, guestPolicy.maxMessage);
  const feedback = text(request.data?.feedback ?? "", guestPolicy.maxFeedback);
  const count = request.data?.photoCount;
  if (!Number.isInteger(count) || count < 0 || count > guestPolicy.maxPhotos) throw new HttpsError("invalid-argument", "Add a message or up to ten photos.");
  // A submission is a memory for the wall or private feedback for the Host,
  // never both. Feedback is not published, so the public-display consent is
  // asked only of a memory.
  const memory = Boolean(message) || count > 0;
  if (memory && feedback) throw new HttpsError("invalid-argument", "Send a memory or private feedback, not both.");
  if (!memory && !feedback) throw new HttpsError("invalid-argument", "Add a message, a photo or private feedback.");
  if (memory && (request.data?.consentAccepted !== true || request.data?.consentVersion !== guestPolicy.consentVersion)) throw new HttpsError("invalid-argument", "Please read and accept the current consent wording.");
  const requestId = validId(request.data?.requestId);
  const id = `${owner}_${requestId}`;
  validId(id);
  const fingerprint = hash(JSON.stringify({ message, feedback, count, propertyId: property.id }));
  const ref = submissionRef(id);
  const sessionRef = db().doc(`guestSessions/${owner}`);
  const bucket = memory ? bucketName() : null;
  const publishedBucket = memory ? publishedBucketName() : null;
  await db().runTransaction(async tx => {
    const [existing, session, latest] = await Promise.all([tx.get(ref), tx.get(sessionRef), tx.get(property.ref)]);
    if (!latest.exists || !wallIsOpen(latest.data()!)) throw new HttpsError("failed-precondition", "This guestbook is currently offline.");
    if (session.exists && session.get("propertyId") !== property.id) throw new HttpsError("permission-denied", "Open a new session for this property.");
    if (existing.exists) {
      if (existing.get("fingerprint") !== fingerprint) throw new HttpsError("already-exists", "This attempt already contains different content.");
      return;
    }
    const hour = Math.floor(Date.now() / 3600000);
    const attempts = session.get("hour") === hour ? session.get("attempts") ?? 0 : 0;
    if (attempts >= 10) throw new HttpsError("resource-exhausted", "Too many attempts. Please try again later.");
    tx.set(sessionRef, { propertyId: property.id, hour, attempts: attempts + 1, updatedAt: stamp() });
    tx.create(ref, { propertyId: property.id, uid: owner, kind: memory ? "memory" : "feedback", fingerprint, message, feedback, photoCount: count,
      bucket, publishedBucket, slots: {}, bytes: 0, revision: 1, status: "uploading", createdAt: stamp(), updatedAt: stamp() });
    if (memory) tx.create(db().doc(`guestConsent/${id}`), { propertyId: property.id, postId: id, sessionUid: owner,
      wording: guestPolicy.consentWording, version: guestPolicy.consentVersion,
      guestTermsVersion: legalVersions.guestTerms, privacyVersion: legalVersions.privacy, acceptedAt: stamp() });
  });
  return { id };
});

export const uploadGuestPhoto = onCall({ ...options, memory: "1GiB", concurrency: 1 }, async request => {
  const owner = uid(request), id = validId(request.data?.id), index = request.data?.index;
  const encoded = request.data?.base64;
  if (!Number.isInteger(index) || index < 0 || index >= guestPolicy.maxPhotos || typeof encoded !== "string"
    || encoded.length > Math.ceil(guestPolicy.maxImageBytes / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new HttpsError("invalid-argument", "Choose a JPEG, PNG or WebP image up to 5 MB.");
  const source = Buffer.from(encoded, "base64");
  if (!source.length || source.length > guestPolicy.maxImageBytes) throw new HttpsError("invalid-argument", "This image is too large.");
  const ref = submissionRef(id), snapshot = await owned(id, owner), data = snapshot.data()!;
  if (data.status !== "uploading" || index >= data.photoCount) throw new HttpsError("failed-precondition", "This upload is already closed.");
  const digest = hash(source);
  if (data.slots[index]?.ready && data.slots[index]?.digest === digest) return { index, uploaded: true };
  let image: { data: Buffer; info: { width: number; height: number } };
  try {
    const decoder = sharp(source, { limitInputPixels: guestPolicy.maxPixels, failOn: "warning" });
    const metadata = await decoder.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
    image = await decoder.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch { throw new HttpsError("invalid-argument", "This photo could not be read. Choose a non-animated JPEG, PNG or WebP image under 40 megapixels."); }
  const path = `properties/${data.propertyId}/quarantine/${id}/${index}.webp`;
  await db().runTransaction(async tx => {
    const current = await tx.get(ref), property = await tx.get(db().doc(`properties/${data.propertyId}`));
    if (current.get("uid") !== owner || current.get("status") !== "uploading" || !property.exists || !wallIsOpen(property.data()!)) throw new HttpsError("failed-precondition", "This upload is no longer available.");
    const previous = current.get(`slots.${index}`);
    if (previous && previous.digest !== digest) throw new HttpsError("already-exists", "That photo slot already contains another photo.");
    if (!previous && current.get("bytes") + source.length > guestPolicy.maxPostBytes) throw new HttpsError("invalid-argument", "Keep the total photo size under 25 MB.");
    tx.update(ref, { [`slots.${index}`]: { digest, path, ready: previous?.ready ?? false, width: image.info.width, height: image.info.height },
      bytes: current.get("bytes") + (previous ? 0 : source.length), updatedAt: stamp() });
  });
  // No Firebase download token is minted. Private Storage rules deny direct access.
  await getStorage().bucket(data.bucket).file(path).save(image.data, { resumable: false, metadata: { contentType: "image/webp", cacheControl: "private, no-store" } });
  await db().runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.get("status") !== "uploading") throw new HttpsError("failed-precondition", "This upload has been closed.");
    tx.update(ref, { [`slots.${index}.ready`]: true, updatedAt: stamp() });
  });
  return { index, uploaded: true };
});

export const finishGuestContribution = onCall(options, async request => {
  const owner = uid(request), id = validId(request.data?.id), ref = submissionRef(id);
  await owned(id, owner);
  await db().runTransaction(async tx => {
    const current = await tx.get(ref), data = current.data()!;
    const property = await tx.get(db().doc(`properties/${data.propertyId}`));
    if (!property.exists || !wallIsOpen(property.data()!)) throw new HttpsError("failed-precondition", "This guestbook is currently offline.");
    if (data.status === "deleted") throw new HttpsError("failed-precondition", "This memory has been deleted.");
    if (data.status !== "uploading") return;
    for (let index = 0; index < data.photoCount; index++) if (!data.slots[index]?.ready) throw new HttpsError("failed-precondition", "Some photos are still uploading. Retry the upload.");
    tx.update(ref, { status: data.kind === "feedback" ? "feedback" : "pending", updatedAt: stamp() });
  });
  if ((await ref.get()).get("kind") === "feedback") {
    await deliverFeedback(id);
    return { id, status: "feedback", message: feedbackSentMessage };
  }
  await processGuestSubmission(id);
  const current = await ref.get();
  return { id, status: current.get("status") === "published" ? "published" : "pending",
    message: current.get("status") === "pending" ? "Your memory has been saved and is waiting for safety screening. You do not need to upload it again." : pendingMessage };
});

const feedbackCaseRef = (id: string) => db().doc(`trustSafetyCases/feedback-${id}`);
export const feedbackReviewDue = () => Timestamp.fromMillis(Date.now() + guestPolicy.feedbackReviewDays * 86400000);

// Private feedback is its own submission and never waits on memory screening.
// The raw text leaves the submission once it is delivered or held, so the
// inbox or the safety case holds its only copy.
export async function deliverFeedback(id: string, screener: FeedbackScreener = screenFeedback) {
  const ref = submissionRef(id), data = (await ref.get()).data();
  if (!data?.feedback || data.feedbackStatus || ["uploading", "deleted"].includes(data.status)) return;
  let result: FeedbackVerdict;
  try { result = await screener(data.feedback); } catch { result = { verdict: "deliver" }; }
  await db().runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.get("feedback") !== data.feedback || current.get("feedbackStatus") || current.get("status") === "deleted") return;
    if (result.verdict === "critical") tx.set(feedbackCaseRef(id), { kind: "private_feedback", source: "automated_screening", categories: result.categories,
      propertyId: data.propertyId, feedbackId: id, message: data.feedback, feedbackCreatedAt: data.createdAt, status: "open", createdAt: stamp(), reviewDueAt: feedbackReviewDue() });
    else tx.set(db().doc(`properties/${data.propertyId}/privateFeedback/${id}`), { message: data.feedback, createdAt: data.createdAt });
    tx.update(ref, { feedback: "", feedbackStatus: result.verdict === "critical" ? "held" : "delivered", updatedAt: stamp() });
  });
}

// Trusted adapter boundary only. No request parameter can select a scan result.
export async function processGuestSubmission(id: string, screener: Screener = screenContent) {
  const ref = submissionRef(id), snapshot = await ref.get(), data = snapshot.data();
  if (!data || data.status !== "pending" || data.safetyCaseOpen === true) return;
  let result;
  try { result = await screener({ message: data.message,
    photos: Array.from({ length: data.photoCount }, (_, index) => photoSource(data, id, index)) }); }
  catch { result = { outcome: "unavailable" } as const; }
  if (result.outcome === "unavailable") return;
  if (result.outcome === "clear") await promotePhotos(id, data);
  // Approved photos move out of quarantine. The delivery bucket remains
  // private at IAM/rules level; the endpoint checks publication on each read.
  const published = await db().runTransaction(async tx => {
    const current = await tx.get(ref), propertyRef = db().doc(`properties/${data.propertyId}`), property = await tx.get(propertyRef);
    const postRef = propertyRef.collection("posts").doc(id), existingPost = await tx.get(postRef);
    if (current.get("revision") !== data.revision || current.get("status") !== "pending") return false;
    if (!property.exists || !wallIsOpen(property.data()!)) return false;
    const openReports = existingPost.get("openReportCount") ?? 0;
    if (existingPost.get("safetyRestricted") === true || current.get("safetyCaseOpen") === true) return false;
    const status = result.outcome === "clear" ? openReports > 0 ? "standard" : "published" : result.outcome;
    tx.update(ref, { status, updatedAt: stamp(),
      ...(result.outcome === "clear" ? { mediaLocation: "published" } : {}),
      ...(["critical", "reject"].includes(result.outcome) ? { safetyCaseOpen: true } : {}) });
    tx.set(postRef, { guestSubmissionId: id, message: data.message, createdAt: data.createdAt,
      visibility: status === "published" ? "visible" : status === "standard" ? "hidden_pending_review" : "restricted",
      screeningStatus: result.outcome, pinned: false, revision: data.revision,
      guestMediaPublished: data.mediaLocation === "published" || result.outcome === "clear",
      hold: openReports > 0 ? existingPost.get("hold") : { source: "automated_screening", reason: null, detail: "Safety screening", raisedAt: stamp() },
      guestPhotoCount: data.photoCount }, { merge: true });
    if (result.outcome === "critical" || result.outcome === "reject") tx.set(db().doc(`trustSafetyCases/${id}:${data.revision}`), {
      propertyId: data.propertyId, postId: id, revision: data.revision, status: "open", message: data.message,
      photos: Array.from({ length: data.photoCount }, (_, index) => photoSource(data, id, index)), createdAt: stamp(), reviewDueAt: Timestamp.fromMillis(Date.now() + 30 * 86400000)
    });
    return status === "published";
  });
  if (published && !data.safetyCaseOpen) await clearQuarantine(id, data);
}

async function readPage(query: Query, cursor: unknown) {
  let paged = query.orderBy(FieldPath.documentId()).limit(26);
  if (cursor !== undefined && cursor !== null) paged = paged.startAfter(validId(cursor));
  const snapshot = await paged.get(), docs = snapshot.docs.slice(0, 25);
  return { docs, nextCursor: snapshot.size > 25 ? docs.at(-1)!.id : null };
}

export const listGuestContributions = onCall(options, async request => {
  const owner = uid(request);
  const session = await db().doc(`guestSessions/${owner}`).get();
  if (!session.exists) return { posts: [] };
  const snapshots = await readPage(db().collection("guestSubmissions").where("uid", "==", owner), request.data?.cursor);
  return { nextCursor: snapshots.nextCursor, posts: snapshots.docs.filter(doc => doc.get("kind") !== "feedback").map(doc => ({ id: doc.id, message: doc.get("message"), revision: doc.get("revision"),
    status: doc.get("status") === "published" ? "published" : doc.get("status") === "deleted" ? "deleted" : doc.get("status") === "uploading" ? "uploading" : "pending" })) };
});

export const changeGuestContribution = onCall(options, async request => {
  const owner = uid(request), id = validId(request.data?.id), action = request.data?.action;
  if (!["edit", "delete"].includes(action)) throw new HttpsError("invalid-argument", "Choose edit or delete.");
  const ref = submissionRef(id);
  await owned(id, owner);
  await db().runTransaction(async tx => {
    const current = await tx.get(ref), data = current.data()!, heldFeedback = await tx.get(feedbackCaseRef(id));
    if (data.status === "deleted") return;
    if (request.data?.revision !== data.revision) throw new HttpsError("failed-precondition", "This memory has changed. Refresh it before editing.");
    if (action === "edit" && data.status === "uploading") throw new HttpsError("failed-precondition", "Finish uploading first.");
    if (action === "edit" && data.kind === "feedback") throw new HttpsError("failed-precondition", "Private feedback can't be edited once it is sent.");
    const message = action === "edit" ? text(request.data?.message, guestPolicy.maxMessage) : "";
    if (action === "edit" && !message && data.photoCount === 0) throw new HttpsError("invalid-argument", "Add a message to this memory.");
    tx.update(ref, { message, status: action === "delete" ? "deleted" : "pending", revision: data.revision + 1, updatedAt: stamp(), ...(action === "delete" ? { feedback: "" } : {}) });
    if (data.kind !== "feedback") tx.set(db().doc(`properties/${data.propertyId}/posts/${id}`), { visibility: action === "delete" ? "deleted" : "processing", message, pinned: false,
      screeningStatus: "pending", guestSubmissionId: id, revision: data.revision + 1 }, { merge: true });
    if (action === "delete") {
      tx.delete(db().doc(`properties/${data.propertyId}/privateFeedback/${id}`));
      // A guest who withdraws their memory withdraws its feedback, held or not.
      if (heldFeedback.exists && ["open", "escalated"].includes(heldFeedback.get("status"))) tx.update(heldFeedback.ref, {
        status: "withdrawn", message: FieldValue.delete(), resolvedAt: stamp() });
      tx.set(db().doc(`deletionJobs/guest-${id}`), { propertyId: data.propertyId, postId: id, bucket: data.bucket,
        paths: Array.from({ length: data.photoCount }, (_, index) => `properties/${data.propertyId}/quarantine/${id}/${index}.webp`),
        objects: Array.from({ length: data.photoCount }, (_, index) => [
          { bucket: data.bucket, path: `properties/${data.propertyId}/quarantine/${id}/${index}.webp` },
          { bucket: data.publishedBucket, path: publishedPath(data.propertyId, id, index) }
        ]).flat(),
        status: "pending", source: "guest_self_delete", createdAt: stamp(), dueAt: Timestamp.fromMillis(Date.now() + 72 * 3600000),
        requiresSafetyReview: data.safetyCaseOpen === true || ["critical", "reject"].includes(data.status) });
    }
  });
  if (action === "edit") await processGuestSubmission(id);
  return { status: action === "delete" ? "deleted" : "pending" };
});

export const listHostGuestReview = onCall(options, async request => {
  const owner = uid(request, false), propertyId = validId(request.data?.propertyId);
  const property = await db().doc(`properties/${propertyId}`).get();
  if (property.get("ownerUid") !== owner) throw new HttpsError("permission-denied", "This property is not yours.");
  const kind = request.data?.kind ?? "both";
  if (!["both", "review", "feedback"].includes(kind)) throw new HttpsError("invalid-argument", "Choose an inbox.");
  const snapshots = kind === "feedback" ? { docs: [], nextCursor: null } : await readPage(db().collection("guestSubmissions").where("propertyId", "==", propertyId).where("status", "in", ["pending", "standard"]), request.data?.reviewCursor);
  const feedback = kind === "review" ? { docs: [], nextCursor: null } : await readPage(property.ref.collection("privateFeedback"), request.data?.feedbackCursor);
  return { reviewCursor: snapshots.nextCursor, feedbackCursor: feedback.nextCursor, posts: snapshots.docs.map(doc => ({
    id: doc.id, revision: doc.get("revision"), status: doc.get("status"),
    message: doc.get("status") === "standard" ? doc.get("message") : "Awaiting safety screening",
    photoCount: doc.get("status") === "standard" ? doc.get("photoCount") : 0
  })), feedback: feedback.docs.map(doc => ({ id: doc.id, message: doc.get("message") })) };
});

// The screener cannot catch every threat, so the Host can send any feedback
// message to the safety team. It leaves the inbox at once and comes back only
// if the safety team releases it.
export const reportPrivateFeedback = onCall(options, async request => {
  const owner = uid(request, false), propertyId = validId(request.data?.propertyId), id = validId(request.data?.id);
  const propertyRef = db().doc(`properties/${propertyId}`), feedbackRef = propertyRef.collection("privateFeedback").doc(id);
  await db().runTransaction(async tx => {
    const [property, feedback, existing] = await Promise.all([tx.get(propertyRef), tx.get(feedbackRef), tx.get(feedbackCaseRef(id))]);
    if (property.get("ownerUid") !== owner) throw new HttpsError("permission-denied", "This property is not yours.");
    if (!feedback.exists) {
      if (existing.exists && existing.get("propertyId") === propertyId) return;
      throw new HttpsError("not-found", "This feedback is no longer in your inbox.");
    }
    tx.set(feedbackCaseRef(id), { kind: "private_feedback", source: "host_report", categories: [], propertyId, feedbackId: id, message: feedback.get("message"),
      feedbackCreatedAt: feedback.get("createdAt") ?? null, status: "open", reportedBy: owner, createdAt: stamp(), reviewDueAt: feedbackReviewDue() });
    tx.delete(feedbackRef);
  });
  return { status: "reported" };
});

export const reviewGuestContribution = onCall(options, async request => {
  const owner = uid(request, false), id = validId(request.data?.id), ref = submissionRef(id);
  if (!["approve", "reject"].includes(request.data?.action)) throw new HttpsError("invalid-argument", "Choose approve or reject.");
  const before = await ref.get(), original = before.data();
  if (!original || (await db().doc(`properties/${original.propertyId}`).get()).get("ownerUid") !== owner) throw new HttpsError("permission-denied", "This property is not yours.");
  if (original.status !== "standard" || request.data?.revision !== original.revision) throw new HttpsError("failed-precondition", "This memory has changed. Refresh the queue.");
  if (request.data.action === "approve") await promotePhotos(id, original);
  await db().runTransaction(async tx => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    if (!data) throw new HttpsError("not-found", "Memory not found.");
    const property = await tx.get(db().doc(`properties/${data.propertyId}`));
    const post = await tx.get(property.ref.collection("posts").doc(id));
    if (property.get("ownerUid") !== owner) throw new HttpsError("permission-denied", "This property is not yours.");
    if (data.status !== "standard" || request.data?.revision !== data.revision || !wallIsOpen(property.data()!)
      || post.get("openReportCount") > 0 || post.get("safetyRestricted") === true) throw new HttpsError("failed-precondition", "This memory is not available for approval.");
    const approved = request.data.action === "approve";
    tx.update(ref, { status: approved ? "published" : "rejected", updatedAt: stamp(), ...(approved ? { mediaLocation: "published" } : {}) });
    tx.update(post.ref, { visibility: approved ? "visible" : "hidden_by_host", guestMediaPublished: approved || data.mediaLocation === "published", moderatedAt: stamp(), moderatedBy: owner });
    tx.set(property.ref.collection("moderationEvents").doc(`${id}-${data.revision}`), { postId: id, previousVisibility: "hidden_pending_review",
      action: request.data.action, resolvedBy: owner, createdAt: stamp() });
  });
  if (request.data.action === "approve" && !original.safetyCaseOpen) await clearQuarantine(id, original);
  return { status: "ok" };
});

export const readGuestReviewPhoto = onCall(options, async request => {
  const owner = uid(request, false), id = validId(request.data?.id), index = request.data?.index;
  const snapshot = await submissionRef(id).get(), data = snapshot.data();
  if (!data || !Number.isInteger(index) || index < 0 || index >= data.photoCount || data.status !== "standard") throw new HttpsError("permission-denied", "This photo is not available for review.");
  const property = await db().doc(`properties/${data.propertyId}`).get();
  if (property.get("ownerUid") !== owner) throw new HttpsError("permission-denied", "This property is not yours.");
  const source = photoSource(data, id, index);
  const [bytes] = await getStorage().bucket(source.bucket).file(source.path).download();
  const latest = await submissionRef(id).get();
  if (latest.get("status") !== "standard" || latest.get("revision") !== data.revision) throw new HttpsError("permission-denied", "This photo is no longer available for review.");
  return { base64: bytes.toString("base64") };
});

export const guestMemoryPhoto = onRequest({ region: "australia-southeast1", maxInstances: 10 }, async (request, response) => {
  response.set("Cache-Control", "private, no-store");
  response.set("X-Content-Type-Options", "nosniff");
  try {
    const id = validId(request.query.id), index = Number(request.query.index);
    const submission = await submissionRef(id).get(), data = submission.data();
    if (!data || data.status !== "published" || !Number.isInteger(index) || index < 0 || index >= data.photoCount) { response.sendStatus(404); return; }
    const [property, post] = await Promise.all([db().doc(`properties/${data.propertyId}`).get(), db().doc(`properties/${data.propertyId}/posts/${id}`).get()]);
    if (!property.exists || !wallIsOpen(property.data()!) || post.get("visibility") !== "visible") { response.sendStatus(404); return; }
    const source = photoSource(data, id, index);
    const [bytes] = await getStorage().bucket(source.bucket).file(source.path).download();
    const [latestSubmission, latestPost, latestProperty] = await Promise.all([submissionRef(id).get(), post.ref.get(), property.ref.get()]);
    if (latestSubmission.get("status") !== "published" || latestSubmission.get("revision") !== data.revision
      || latestPost.get("visibility") !== "visible" || !latestProperty.exists || !wallIsOpen(latestProperty.data()!)) { response.sendStatus(404); return; }
    response.type("image/webp").send(bytes);
  } catch { response.sendStatus(404); }
});
