import { createHmac } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { localTestEnabled } from "./localTest.js";

const hashSecret = defineSecret("REPORT_HASH_KEY");
const options = { region: "australia-southeast1", enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true", secrets: process.env.FUNCTIONS_EMULATOR === "true" ? [] : [hashSecret], maxInstances: 5 };
const ACK = "Report received. It will be reviewed.";
const DAY = 86400000;
const stamp = () => FieldValue.serverTimestamp();
const id = (value: unknown) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new HttpsError("invalid-argument", "A valid reference is required.");
  return value;
};
const trim = (value: unknown, max: number) => {
  if (typeof value !== "string" || value.trim().length > max) throw new HttpsError("invalid-argument", "Check the details and try again.");
  return value.trim();
};
function reporter(request: CallableRequest) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Reopen this page and try again.");
  const key = process.env.FUNCTIONS_EMULATOR === "true" ? "demo-only-report-key" : hashSecret.value();
  if (!key) throw new HttpsError("unavailable", "Reporting is temporarily unavailable.");
  return createHmac("sha256", key).update(request.auth.uid).digest("hex");
}
export function requireOperations(request: CallableRequest) {
  const simulatedReviewer = localTestEnabled() && request.auth?.token.localTestOperations === true;
  if (request.auth?.token.admin !== true || (!request.auth.token.firebase?.sign_in_second_factor && !simulatedReviewer)) {
    throw new HttpsError("permission-denied", "An authorised operations account with multi-factor sign-in is required.");
  }
  return request.auth.uid;
}

export const reportGuestMemory = onCall(options, async request => {
  const reporterKey = reporter(request), slug = id(request.data?.slug), postId = id(request.data?.postId);
  const requestId = id(request.data?.requestId), reason = request.data?.reason;
  if (!["privacy", "inappropriate", "harassment", "spam", "other"].includes(reason)) throw new HttpsError("invalid-argument", "Choose a report reason.");
  const now = Date.now(), db = getFirestore();
  const matches = await db.collection("properties").where("slug", "==", slug).limit(2).get();
  const propertyId = matches.size === 1 ? matches.docs[0].id : null;
  const reportId = `${reporterKey}_${requestId}`, reportRef = db.doc(`contentReports/${reportId}`);
  await db.runTransaction(async tx => {
    const previous = await tx.get(reportRef);
    if (previous.exists) {
      if (previous.get("postId") !== postId || previous.get("slug") !== slug || previous.get("reason") !== reason) throw new HttpsError("already-exists", "Use a new report reference for a different report.");
      return;
    }
    const scope = propertyId ?? slug;
    const rateRef = db.doc(`reportRateLimits/${reporterKey}_${scope}`), wallRef = db.doc(`reportWallLimits/${scope}`);
    const duplicateRef = db.doc(`reportDuplicates/${reporterKey}_${scope}_${postId}`);
    const postRef = propertyId ? db.doc(`properties/${propertyId}/posts/${postId}`) : null;
    const [rate, wall, duplicate, post] = await Promise.all([tx.get(rateRef), tx.get(wallRef), tx.get(duplicateRef), postRef ? tx.get(postRef) : Promise.resolve(null)]);
    const hits: { postId: string; at: number }[] = (rate.get("hits") ?? []).filter((hit: any) => hit.at > now - DAY);
    const wallHits: { postId: string; at: number }[] = (wall.get("hits") ?? []).filter((hit: any) => hit.at > now - 600000);
    const deduped = (duplicate.get("expiresAt")?.toMillis?.() ?? 0) > now;
    const blocked = (rate.get("cooldownUntil")?.toMillis?.() ?? 0) > now || (wall.get("breakerUntil")?.toMillis?.() ?? 0) > now;
    const reviewable = post?.exists && !["deleted", "restricted", "processing"].includes(post.get("visibility"));
    const hide = !deduped && !blocked && reviewable;
    const outcome = deduped ? "duplicate_no_visibility_change" : blocked ? "suspected_abuse_no_visibility_change" : hide ? "hidden_pending_review" : "internal_review";
    const reportData = { propertyId, slug, postId, reporterKey, reason, outcome, status: deduped ? "duplicate" : hide ? "open" : "internal",
      createdAt: stamp(), reviewDueAt: Timestamp.fromMillis(now + 14 * DAY), appCheck: request.app ? "verified" : "emulator",
      previousVisibility: post?.get("visibility") ?? null, newVisibility: hide ? "hidden_pending_review" : post?.get("visibility") ?? null,
      resolver: null, reporterDistinctPosts24h: hits.length, reporterDistinctPosts10m: hits.filter(hit => hit.at > now - 600000).length, wallDistinctPosts10m: wallHits.length };
    tx.create(reportRef, reportData);
    if (!deduped) {
      tx.set(duplicateRef, { expiresAt: Timestamp.fromMillis(now + DAY) });
      const next = [...hits.filter(hit => hit.postId !== postId), { postId, at: now }].slice(-5);
      const wallNext = [...wallHits.filter(hit => hit.postId !== postId), { postId, at: now }].slice(-5);
      const cooldown = next.filter(hit => hit.at > now - 600000).length >= 3 || next.length >= 5;
      const trip = wallNext.length >= 5;
      tx.set(rateRef, { hits: next, cooldownUntil: rate.get("cooldownUntil")?.toMillis?.() > now ? rate.get("cooldownUntil") : Timestamp.fromMillis(cooldown ? now + DAY : 0), expiresAt: Timestamp.fromMillis(now + 2 * DAY) });
      tx.set(wallRef, { hits: wallNext, breakerUntil: wall.get("breakerUntil")?.toMillis?.() > now ? wall.get("breakerUntil") : Timestamp.fromMillis(trip ? now + 600000 : 0), expiresAt: Timestamp.fromMillis(now + DAY) });
      if (trip || blocked) tx.set(db.doc(`operationsAlerts/report-${reportId}`), { kind: "report_circuit_breaker", propertyId, reportId, status: "pending", createdAt: stamp() });
    }
    if (hide && postRef) {
      tx.update(postRef, { visibility: "hidden_pending_review", pinned: false, openReportCount: (post!.get("openReportCount") ?? 0) + 1,
        reportRestoreAllowed: post!.get("openReportCount") > 0 ? post!.get("reportRestoreAllowed") === true : post!.get("visibility") === "visible",
        hold: { source: "guest_report", reason, detail: "", raisedAt: stamp() } });
      tx.set(db.doc(`notificationOutbox/report-${reportId}`), { kind: "post_hidden", propertyId, postId, reportId, status: "pending", createdAt: stamp() });
    }
  });
  return { message: ACK };
});

export const submitPrivacyRequest = onCall(options, async request => {
  const reporterKey = reporter(request), requestId = id(request.data?.requestId);
  const kind = request.data?.kind, details = trim(request.data?.details, 2000), contact = trim(request.data?.contact, 254);
  if (!["privacy", "takedown", "urgent_safety"].includes(kind) || !details || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new HttpsError("invalid-argument", "Add details and a contact email.");
  const ref = getFirestore().doc(`privacyRequests/${reporterKey}_${requestId}`);
  await getFirestore().runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.get("details") !== details || existing.get("contact") !== contact || existing.get("kind") !== kind) throw new HttpsError("already-exists", "Use a new reference for changed details.");
      return;
    }
    tx.create(ref, { reporterKey, kind, details, contact, status: "awaiting_verification", createdAt: stamp(), reviewDueAt: Timestamp.fromMillis(Date.now() + 14 * DAY) });
    tx.create(getFirestore().doc(`operationsAlerts/privacy-${ref.id}`), { kind: "privacy_request", requestId: ref.id, status: "pending", createdAt: stamp() });
  });
  return { message: ACK, reference: ref.id };
});

export const listHostReports = onCall({ ...options, secrets: [] }, async request => {
  const propertyId = id(request.data?.propertyId), db = getFirestore();
  if (!request.auth || (await db.doc(`properties/${propertyId}`).get()).get("ownerUid") !== request.auth.uid) throw new HttpsError("permission-denied", "This property is not yours.");
  let query = db.collection("contentReports").where("propertyId", "==", propertyId).where("status", "==", "open").orderBy(FieldPath.documentId()).limit(26);
  if (request.data?.cursor) {
    const cursor = request.data.cursor;
    if (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) throw new HttpsError("invalid-argument", "Invalid page reference.");
    query = query.startAfter(cursor);
  }
  const page = await query.get(), docs = page.docs.slice(0, 25);
  return { reports: docs.map(doc => ({ id: doc.id, postId: doc.get("postId"), reason: doc.get("reason"), reviewDueAt: doc.get("reviewDueAt").toDate().toISOString() })), nextCursor: page.size > 25 ? docs.at(-1)!.id : null };
});

export const resolveContentReport = onCall({ ...options, secrets: [] }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in again.");
  const reportId = request.data?.reportId, action = request.data?.action;
  if (typeof reportId !== "string" || !/^[A-Za-z0-9_-]{1,512}$/.test(reportId) || !["dismiss", "delete"].includes(action)) throw new HttpsError("invalid-argument", "Choose a report and action.");
  const db = getFirestore(), reportRef = db.doc(`contentReports/${reportId}`);
  await db.runTransaction(async tx => {
    const report = await tx.get(reportRef);
    if (!report.exists || !report.get("propertyId")) throw new HttpsError("not-found", "This report is unavailable.");
    const propertyRef = db.doc(`properties/${report.get("propertyId")}`), property = await tx.get(propertyRef);
    const settled = ["dismissed", "deleted"].includes(report.get("status"));
    const internal = report.get("status") !== "open" && !(settled && report.get("resolver") === request.auth!.uid);
    if (internal || property.get("ownerUid") !== request.auth!.uid) requireOperations(request);
    if (settled) return;
    const postRef = propertyRef.collection("posts").doc(report.get("postId")), post = await tx.get(postRef);
    if (!post.exists) throw new HttpsError("not-found", "This memory is unavailable.");
    const guestRef = post.get("guestSubmissionId") ? db.doc(`guestSubmissions/${post.get("guestSubmissionId")}`) : null;
    const guest = guestRef ? await tx.get(guestRef) : null;
    if (post.get("safetyRestricted") || post.get("visibility") === "restricted" || guest?.get("safetyCaseOpen")) throw new HttpsError("failed-precondition", "Resolve the separate safety hold first.");
    const remaining = Math.max(0, (post.get("openReportCount") ?? 0) - (report.get("outcome") === "hidden_pending_review" ? 1 : 0));
    const restore = action === "dismiss" && remaining === 0 && post.get("reportRestoreAllowed") === true && post.get("visibility") === "hidden_pending_review" && post.get("hold")?.source === "guest_report"
      && (!guest?.exists || (post.get("screeningStatus") === "clear" && guest.get("mediaLocation") === "published" && ["published", "standard"].includes(guest.get("status"))));
    tx.update(reportRef, { status: action === "delete" ? "deleted" : "dismissed", resolver: request.auth!.uid, resolvedAt: stamp() });
    tx.update(postRef, { openReportCount: remaining, ...(restore ? { visibility: "visible", hold: FieldValue.delete() } : {}),
      ...(action === "delete" ? { visibility: "deleted", pinned: false, message: "", displayName: "", photos: FieldValue.delete(), photo: FieldValue.delete() } : {}) });
    if (restore && guestRef) tx.update(guestRef, { status: "published", updatedAt: stamp() });
    if (action === "delete") {
      if (guest?.exists && guestRef) {
        const data = guest.data()!, submissionId = guestRef.id;
        tx.update(guestRef, { status: "deleted", message: "", feedback: "", revision: data.revision + 1, updatedAt: stamp() });
        tx.delete(propertyRef.collection("privateFeedback").doc(submissionId));
        tx.set(db.doc(`deletionJobs/guest-${submissionId}`), { propertyId: propertyRef.id, postId: postRef.id, status: "pending", createdAt: stamp(), dueAt: Timestamp.fromMillis(Date.now() + 72 * 3600000),
          objects: Array.from({ length: data.photoCount }, (_, index) => [
            { bucket: data.bucket, path: `properties/${propertyRef.id}/quarantine/${submissionId}/${index}.webp` },
            { bucket: data.publishedBucket, path: `properties/${propertyRef.id}/published/${submissionId}/${index}.webp` }
          ]).flat() });
      } else {
        const paths = [post.get("photo"), ...(post.get("photos") ?? [])].map(item => item?.path).filter(path => typeof path === "string" && path.startsWith(`properties/${propertyRef.id}/`));
        tx.set(db.doc(`deletionJobs/report-${reportId}`), { propertyId: propertyRef.id, postId: postRef.id, paths, status: "pending", createdAt: stamp(), dueAt: Timestamp.fromMillis(Date.now() + 72 * 3600000) });
      }
    }
    tx.set(db.doc(`moderationAudit/report-${reportId}`), { propertyId: propertyRef.id, postId: postRef.id, reportId, action, actor: request.auth!.uid,
      previousVisibility: post.get("visibility"), newVisibility: action === "delete" ? "deleted" : restore ? "visible" : post.get("visibility"), createdAt: stamp() });
  });
  return { status: "resolved" };
});

// Statuses that still need staff or worker attention, per queue.
export const OUTSTANDING: Record<string, string[]> = {
  contentReports: ["open", "internal", "escalated"], privacyRequests: ["awaiting_verification", "verified", "escalated"],
  trustSafetyCases: ["open", "escalated"], operationsAlerts: ["pending"],
  deletionJobs: ["pending", "retry", "processing", "held", "needs_attention"], consentDeletionReview: ["due", "needs_attention"]
};
// Consent reviews are rewritten on every scan, so their retention deadline stands in for a received date.
const AGE_FIELD: Record<string, string> = { consentDeletionReview: "reviewDueAt" };
const OVERVIEW_LIMIT = 100, OUTSTANDING_SCAN = 500;
const iso = (value: any) => value?.toDate?.().toISOString() ?? null;

export const listSafetyOperations = onCall({ ...options, secrets: [] }, async request => {
  requireOperations(request);
  const queues = Object.keys(OUTSTANDING), queue = request.data?.queue ?? "all", scope = request.data?.scope ?? "outstanding";
  if (queue !== "all" && !queues.includes(queue)) throw new HttpsError("invalid-argument", "Choose a queue.");
  if (!["outstanding", "everything"].includes(scope)) throw new HttpsError("invalid-argument", "Choose outstanding or all items.");
  const db = getFirestore(), now = Date.now(), selected = queue === "all" ? queues : [queue];
  const rowsOf = (name: string, docs: QueryDocumentSnapshot[]) => docs.map(doc => ({ doc, queue: name, receivedAt: iso(doc.get(AGE_FIELD[name] ?? "createdAt")) as string | null }));
  // Outstanding sets are small working queues: read them whole and order in memory, avoiding composite indexes.
  const queueState = await Promise.all(queues.map(async name => {
    const collection = db.collection(name);
    const [total, open] = await Promise.all([collection.count().get(), collection.where("status", "in", OUTSTANDING[name]).limit(OUTSTANDING_SCAN).get()]);
    const outstanding = open.size < OUTSTANDING_SCAN ? open.size : (await collection.where("status", "in", OUTSTANDING[name]).count().get()).data().count;
    const rows = rowsOf(name, open.docs);
    return { rows, truncated: open.size >= OUTSTANDING_SCAN, summary: { queue: name, total: total.data().count, outstanding,
      overdue: open.docs.filter(doc => (doc.get("reviewDueAt")?.toMillis?.() ?? Infinity) <= now).length,
      oldestOutstandingAt: rows.map(row => row.receivedAt).filter(Boolean).sort()[0] ?? null } };
  }));
  const summary = queueState.map(state => state.summary);
  const pages = scope === "outstanding"
    ? queueState.filter(state => selected.includes(state.summary.queue))
    : await Promise.all(selected.map(async name => {
      const page = await db.collection(name).orderBy(AGE_FIELD[name] ?? "createdAt").limit(OVERVIEW_LIMIT).get();
      return { rows: rowsOf(name, page.docs), truncated: page.size >= OVERVIEW_LIMIT };
    }));
  const rows = pages.flatMap(page => page.rows)
    .sort((a, b) => (a.receivedAt ?? "￿").localeCompare(b.receivedAt ?? "￿") || a.doc.id.localeCompare(b.doc.id));
  const matching = summary.filter(item => selected.includes(item.queue)).reduce((sum, item) => sum + (scope === "outstanding" ? item.outstanding : item.total), 0);
  // Restricted media and report text are never copied into the queue overview.
  return { items: rows.slice(0, OVERVIEW_LIMIT).map(({ doc, queue: name, receivedAt }) => ({ id: doc.id, queue: name, propertyId: doc.get("propertyId") ?? null, status: doc.get("status"),
    kind: doc.get("kind") ?? doc.get("reason") ?? null, receivedAt, outstanding: OUTSTANDING[name].includes(doc.get("status")),
    screeningStatus: doc.get("screeningStatus") ?? null, screeningIncompleteReason: doc.get("screeningIncompleteReason") ?? null,
    reviewDueAt: iso(doc.get("reviewDueAt")) })),
    summary, matching, partial: pages.some(page => page.truncated) || rows.length > OVERVIEW_LIMIT, nextCursor: null };
});

const caseId = (value: unknown) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_:-]{1,200}$/.test(value)) throw new HttpsError("invalid-argument", "A valid case reference is required.");
  return value;
};

// Restricted case access is limited to operations with MFA and audited.
export const readSafetyCase = onCall({ ...options, secrets: [] }, async request => {
  const actor = requireOperations(request), reference = caseId(request.data?.id), db = getFirestore();
  const snapshot = await db.doc(`trustSafetyCases/${reference}`).get();
  if (!snapshot.exists || !["private_feedback", "guest_memory"].includes(snapshot.get("kind"))) throw new HttpsError("not-found", "This safety case cannot be opened here.");
  await db.collection("moderationAudit").add({ caseId: reference, propertyId: snapshot.get("propertyId"), action: "open_case", actor, createdAt: stamp() });
  return { id: reference, kind: snapshot.get("kind"), propertyId: snapshot.get("propertyId"), source: snapshot.get("source"), categories: snapshot.get("categories") ?? [],
    photoCount: ["open", "escalated"].includes(snapshot.get("status")) ? (snapshot.get("photos") ?? []).length : 0,
    screeningStatus: snapshot.get("screeningStatus") ?? null, screeningIncompleteReason: snapshot.get("screeningIncompleteReason") ?? null,
    status: snapshot.get("status"), message: snapshot.get("message") ?? null, reviewDueAt: snapshot.get("reviewDueAt")?.toDate?.().toISOString() ?? null };
});

export const readSafetyCasePhoto = onCall({ ...options, secrets: [], memory: "512MiB" }, async request => {
  const actor = requireOperations(request), reference = caseId(request.data?.id), index = request.data?.index, db = getFirestore();
  const ref = db.doc(`trustSafetyCases/${reference}`), snapshot = await ref.get(), data = snapshot.data();
  if (!data || data.kind !== "guest_memory" || !["open", "escalated"].includes(data.status)
    || !Number.isInteger(index) || index < 0 || index >= (data.photos ?? []).length) throw new HttpsError("permission-denied", "This photo is not available for safety review.");
  const photo = data.photos[index];
  if (typeof photo.bucket !== "string" || typeof photo.path !== "string"
    || !photo.path.startsWith(`properties/${data.propertyId}/`)) throw new HttpsError("failed-precondition", "The case photo reference is invalid.");
  await db.collection("moderationAudit").add({ caseId: reference, propertyId: data.propertyId, action: "open_case_photo", photoIndex: index, actor, createdAt: stamp() });
  const [bytes] = await getStorage().bucket(photo.bucket).file(photo.path).download();
  const latest = await ref.get();
  if (bytes.length > 5 * 1024 * 1024 || !["open", "escalated"].includes(latest.get("status"))
    || latest.get("revision") !== data.revision) throw new HttpsError("permission-denied", "This photo is no longer available for safety review.");
  return { base64: bytes.toString("base64"), contentType: "image/webp" };
});

export const resolveSafetyCase = onCall({ ...options, secrets: [] }, async request => {
  const actor = requireOperations(request), reference = caseId(request.data?.id), action = request.data?.action, db = getFirestore();
  if (!["release", "delete"].includes(action)) throw new HttpsError("invalid-argument", "Choose release or delete.");
  const note = request.data?.note === undefined ? "" : trim(request.data.note, 500);
  const ref = db.doc(`trustSafetyCases/${reference}`);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    if (!data || !["private_feedback", "guest_memory"].includes(data.kind)) throw new HttpsError("not-found", "This safety case cannot be resolved here.");
    if (!["open", "escalated"].includes(data.status)) throw new HttpsError("failed-precondition", "This case has already been resolved.");
    const property = await tx.get(db.doc(`properties/${data.propertyId}`));
    if (data.kind === "guest_memory") {
      const submissionRef = db.doc(`guestSubmissions/${data.postId}`), postRef = db.doc(`properties/${data.propertyId}/posts/${data.postId}`);
      const [submission, post] = await Promise.all([tx.get(submissionRef), tx.get(postRef)]), memory = submission.data();
      if (!memory || memory.propertyId !== data.propertyId || memory.safetyCaseOpen !== true) throw new HttpsError("failed-precondition", "This memory no longer has this safety hold.");
      if (action === "release") {
        if (!property.exists || !post.exists || memory.status === "deleted" || post.get("visibility") === "deleted") throw new HttpsError("failed-precondition", "A removed memory cannot be released.");
        const changed = memory.revision !== data.revision;
        tx.update(submissionRef, { safetyCaseOpen: false, status: changed ? "pending" : "standard", updatedAt: stamp() });
        tx.update(postRef, { safetyRestricted: false, visibility: changed ? "processing" : "hidden_pending_review", screeningStatus: changed ? "pending" : "standard",
          hold: { source: "safety_review", reason: "released_to_host_review", detail: "", raisedAt: stamp() } });
        if (changed) tx.update(submissionRef, { screeningRetryState: FieldValue.delete(), screeningRetryAt: FieldValue.delete() });
        else tx.set(db.doc(`notificationOutbox/memory-held-${data.postId}-${memory.revision}`), { kind: "memory_held_for_host_review", propertyId: data.propertyId, postId: data.postId,
          revision: memory.revision, status: "pending", createdAt: stamp() });
      } else {
        tx.update(submissionRef, { status: "deleted", message: "", safetyCaseOpen: false, updatedAt: stamp() });
        if (post.exists) tx.update(postRef, { visibility: "deleted", message: "", pinned: false, safetyRestricted: false });
        const objects = Array.from({ length: memory.photoCount }, (_, index) => [
          { bucket: memory.bucket, path: `properties/${data.propertyId}/quarantine/${data.postId}/${index}.webp` },
          { bucket: memory.publishedBucket, path: `properties/${data.propertyId}/published/${data.postId}/${index}.webp` }
        ]).flat();
        tx.set(db.doc(`deletionJobs/guest-${data.postId}`), { propertyId: data.propertyId, postId: data.postId, bucket: memory.bucket, objects,
          paths: objects.filter(object => object.bucket === memory.bucket).map(object => object.path), source: "safety_review_delete", requiresSafetyReview: false,
          status: "pending", createdAt: stamp(), dueAt: Timestamp.fromMillis(Date.now() + 72 * 3600000) });
      }
    } else if (action === "release") {
      if (!property.exists) throw new HttpsError("failed-precondition", "This property no longer exists, so the message can only be deleted.");
      tx.set(property.ref.collection("privateFeedback").doc(data.feedbackId), { message: data.message, createdAt: data.feedbackCreatedAt ?? stamp(), releasedAt: stamp() });
    }
    const status = action === "release" ? "released" : "deleted";
    tx.update(ref, { status, message: FieldValue.delete(), photos: FieldValue.delete(), resolvedAt: stamp(), resolvedBy: actor });
    // The audit records the decision, never the message.
    tx.set(db.doc(`moderationAudit/case-${reference}-${action}`), { caseId: reference, propertyId: data.propertyId, action,
      previousStatus: data.status, newStatus: status, actor, note, createdAt: stamp() });
  });
  return { status: action === "release" ? "released" : "deleted" };
});

export const escalatePrivacyDeadlines = onSchedule({ schedule: "every 60 minutes", region: "australia-southeast1", maxInstances: 1 }, async () => {
  const db = getFirestore();
  const open: Record<string, string[]> = { contentReports: ["open", "internal"], privacyRequests: ["awaiting_verification", "verified"], trustSafetyCases: ["open"] };
  for (const queue of Object.keys(open)) {
    const due = await db.collection(queue).where("status", "in", open[queue]).where("reviewDueAt", "<=", Timestamp.now()).limit(100).get();
    for (const doc of due.docs) await db.runTransaction(async tx => {
      const current = await tx.get(doc.ref);
      if (!["open", "internal", "awaiting_verification", "verified"].includes(current.get("status"))) return;
      if (current.get("reviewDueAt")?.toMillis?.() > Date.now()) return;
      tx.update(doc.ref, { status: "escalated", escalatedAt: stamp() });
      tx.set(db.doc(`operationsAlerts/deadline-${doc.id}`), { kind: queue === "trustSafetyCases" ? "safety_case_overdue" : "privacy_deadline", sourceQueue: queue, requestId: doc.id, status: "pending", createdAt: stamp() });
    });
  }
});
