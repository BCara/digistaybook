import { createHash, randomBytes } from "node:crypto";
import { FieldValue, getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { stripe, stripeSecrets } from "./stripeConfig.js";

/**
 * The secret half of a guestbook link: 16 random bytes, which is the whole of
 * the distance between a forwarded listing URL and a Host's Wi-Fi password.
 * base64url so it survives a path, a QR code and a printed card.
 *
 * It is minted here and it does not drift: nothing rewrites it as a side effect
 * of a rename or a save, because a placard is printed from it and an address
 * that moves is a card that scans to nothing (D-012). The one thing that
 * replaces it is the Host asking for a new link (`reissueStayToken`, D-036),
 * which is the only way to take the house back from a link that has leaked.
 */
export const mintStayToken = () => randomBytes(16).toString("base64url");

function requirePropertyId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Invalid property reference.");
  }
  return value;
}

/**
 * How many unpaid drafts one account may hold at a time. Every draft reserves
 * a guestbook address, so without a ceiling one account could sit on as many
 * addresses as it cared to type. Paid properties are not counted: the limit is
 * on what costs the Host nothing.
 */
export const MAX_DRAFT_PROPERTIES = 5;

/**
 * Whether this session's email address has been proved. Google sign-in arrives
 * proved; a password account is proved by the link in the verification email.
 * The claim is read from the ID token, so a Host who has just verified needs a
 * fresh token before this says yes — the client refreshes and retries once.
 */
export const emailIsVerified = (token: Record<string, unknown> | undefined) => token?.email_verified === true;

/**
 * A draft that has never been paid for or served: no wall was ever open at its
 * address, so no placard that worked was ever printed from it, and the address
 * can go back into the pool when the draft is deleted.
 */
export function neverActivated(data: Record<string, any> | undefined): boolean {
  return Boolean(data) && data!.lifecycle === "draft" && data!.mode !== "live" && !data!.billing?.stripeSubscriptionId && !data!.billing?.status;
}

function requireHost(request: CallableRequest): string {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Sign in with your host account.");
  return request.auth.uid;
}

const limits: Record<string, number> = { location: 80, welcome: 400, hosts: 60, hostSince: 60, stayHeading: 80, stayWelcome: 1200, stayTip: 240, guestPrompt: 240 };
export const createHostProperty = onCall({ region: "australia-southeast1", maxInstances: 5, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" }, async request => {
  const ownerUid = requireHost(request), name = request.data?.name, slug = request.data?.slug;
  // A property reserves an address and has email sent in its name, so it is
  // not made for an address nobody has proved they own. `details.reason` is
  // what the client reads: it sends the Host to the verification email.
  if (!emailIsVerified(request.auth!.token)) throw new HttpsError("failed-precondition", "Confirm your email address before adding a property. Use the link in the verification email we sent you, or send a new one from Account settings.", { reason: "email-unverified" });
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60 || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40) throw new HttpsError("invalid-argument", "Check the property name and address.");
  if (slug === "demo-cottage") throw new HttpsError("invalid-argument", "That address is reserved for the demo. Choose another.");
  const incoming = request.data?.profile ?? {}, profile: Record<string, any> = {};
  for (const [key, max] of Object.entries(limits)) {
    if (incoming[key] !== undefined && (typeof incoming[key] !== "string" || incoming[key].length > max)) throw new HttpsError("invalid-argument", "Check the property details.");
    profile[key] = (incoming[key] ?? "").trim();
  }
  // New themes, and the older names walls were saved with, which are still read (see src/domain/wallTheme.ts).
  profile.theme = ["linen", "editorial", "seaside", "journal", "studio", "archive", "harbour", "sage"].includes(incoming.theme) ? incoming.theme : "linen";
  profile.colour = ["sand", "sage", "ocean"].includes(incoming.colour) ? incoming.colour : "sand";
  for (const key of ["displayWallOff", "stayNoteOff", "factsOff"]) profile[key] = incoming[key] === true;
  for (const key of ["cover", "avatar", "hostPhoto"]) profile[key] = null;
  // The hosts' own notes arrive as words and a choice of how each is fixed to
  // the wall. Photographs are not among them: a file can only be stored
  // against a property that exists, so they are uploaded after this returns.
  if (incoming.hostNotes !== undefined && (!Array.isArray(incoming.hostNotes) || incoming.hostNotes.length > 4)) throw new HttpsError("invalid-argument", "Use up to four notes of your own.");
  const noteIds = new Set<string>();
  profile.hostNotes = (incoming.hostNotes ?? []).map((note: any, index: number) => {
    if (typeof note?.message !== "string" || note.message.length > 600) throw new HttpsError("invalid-argument", "Check your notes for the wall.");
    const id = typeof note?.id === "string" ? note.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) : "";
    const noteId = id || `note${index + 1}`;
    if (noteIds.has(noteId)) throw new HttpsError("invalid-argument", "Each note needs its own reference.");
    noteIds.add(noteId);
    return { id: noteId, message: note.message.trim(), style: note?.style === "pinned" ? "pinned" : "bordered", photo: null };
  });
  if (incoming.facts !== undefined && (!Array.isArray(incoming.facts) || incoming.facts.length > 8)) throw new HttpsError("invalid-argument", "Use up to eight house essentials.");
  profile.facts = (incoming.facts ?? []).map((fact: any) => {
    const result: Record<string, string> = {};
    for (const [key, max] of Object.entries({ term: 32, detail: 60, note: 140 })) {
      if (typeof fact?.[key] !== "string" || fact[key].length > max) throw new HttpsError("invalid-argument", "Check the house essentials.");
      result[key] = fact[key].trim();
    }
    return result;
  });
  const fingerprint = createHash("sha256").update(JSON.stringify({ ownerUid, name: name.trim(), slug, profile })).digest("hex");
  const db = getFirestore(), reservation = db.doc(`slugReservations/${slug}`), newRef = db.collection("properties").doc();
  const result = await db.runTransaction(async tx => {
    const existing = await tx.get(reservation);
    if (existing.exists) {
      if (existing.get("ownerUid") !== ownerUid || existing.get("fingerprint") !== fingerprint) throw new HttpsError("already-exists", "That guestbook address is already taken. Choose another.");
      const property = await tx.get(db.doc(`properties/${existing.get("propertyId")}`));
      if (!property.exists || property.get("ownerUid") !== ownerUid) throw new HttpsError("failed-precondition", "This address needs support review.");
      return { id: property.id, ...property.data(), createdAt: null, updatedAt: null };
    }
    const legacy = await tx.get(db.collection("properties").where("slug", "==", slug).limit(1));
    if (!legacy.empty) throw new HttpsError("already-exists", "That guestbook address is already taken. Choose another.");
    // Counted inside the transaction, after the replay above: a retry of a
    // creation that already landed is answered with the property it made.
    const owned = await tx.get(db.collection("properties").where("ownerUid", "==", ownerUid));
    if (owned.docs.filter(doc => doc.get("lifecycle") === "draft").length >= MAX_DRAFT_PROPERTIES) {
      throw new HttpsError("resource-exhausted", `You can keep up to ${MAX_DRAFT_PROPERTIES} unpublished properties at a time. Publish or delete one before adding another.`, { reason: "draft-limit" });
    }
    const property = { ownerUid, name: name.trim(), slug, profile, stayToken: mintStayToken(), lifecycle: "draft", mode: "sandbox", foundationalPostCount: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    tx.create(reservation, { ownerUid, propertyId: newRef.id, fingerprint, createdAt: FieldValue.serverTimestamp() });
    tx.create(newRef, property);
    return { ...property, id: newRef.id, createdAt: null, updatedAt: null };
  });
  return { property: result };
});

/**
 * The guestbook link for a property created before there was one.
 *
 * Properties made under the old model reach the in-stay wall from their slug
 * alone, which is the thing this change removes; they need a token before
 * their placard means anything. Minting is a server job because the token is
 * the whole of the secret, and it happens once: a property that already has
 * one is handed the one it has, so opening the QR page twice does not print
 * two different cards.
 */
export const ensureStayToken = onCall({ region: "australia-southeast1", maxInstances: 5, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" }, async request => {
  const ownerUid = requireHost(request), propertyId = requirePropertyId(request.data?.propertyId);
  const db = getFirestore(), ref = db.collection("properties").doc(propertyId);
  const stayToken = await db.runTransaction(async tx => {
    const property = await tx.get(ref);
    if (!property.exists) throw new HttpsError("not-found", "Property not found.");
    if (property.get("ownerUid") !== ownerUid) throw new HttpsError("permission-denied", "This property is not yours.");
    const existing = property.get("stayToken");
    if (typeof existing === "string" && /^[A-Za-z0-9_-]{22}$/.test(existing)) return existing;
    const minted = mintStayToken();
    // `updatedAt` is deliberately left alone: nothing a Host wrote changed.
    tx.update(ref, { stayToken: minted });
    return minted;
  });
  return { stayToken };
});

/**
 * A new guestbook link, and the end of the old one (D-036).
 *
 * The token is the only thing between a forwarded address and the Wi-Fi
 * password, and it used to be for life: every past guest kept the house
 * information and could go on leaving memories, and a link that leaked could
 * not be withdrawn. This replaces it. The old token stops matching the moment
 * this commits — `stayTokenMatches` compares against the stored value and
 * nothing else — so the old placard opens the public page from then on, with
 * no house information and no way to post.
 *
 * That is also the cost, and it is why the Host has to say so in words: every
 * placard already printed stops working and has to be printed again. The
 * client sends `confirm: "reissue"` after its own warning; a call without it
 * is refused, so nothing replaces a link by accident.
 *
 * The audit record says who asked and when. It never carries either token.
 */
export const reissueStayToken = onCall({ region: "australia-southeast1", maxInstances: 5, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" }, async request => {
  const ownerUid = requireHost(request), propertyId = requirePropertyId(request.data?.propertyId);
  if (request.data?.confirm !== "reissue") throw new HttpsError("invalid-argument", "Confirm that you want to replace this guest link.");
  const db = getFirestore(), ref = db.collection("properties").doc(propertyId);
  const stayToken = await db.runTransaction(async tx => {
    const property = await tx.get(ref);
    if (!property.exists || property.get("lifecycle") === "deleted") throw new HttpsError("not-found", "Property not found.");
    if (property.get("ownerUid") !== ownerUid) throw new HttpsError("permission-denied", "This property is not yours.");
    let minted = mintStayToken();
    // Sixteen random bytes do not repeat, but "the old link is dead" must not rest on that.
    while (minted === property.get("stayToken")) minted = mintStayToken();
    const reissues = Number.isInteger(property.get("stayTokenReissues")) ? property.get("stayTokenReissues") : 0;
    tx.update(ref, { stayToken: minted, stayTokenIssuedAt: FieldValue.serverTimestamp(), stayTokenReissues: reissues + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.set(ref.collection("stayLinkEvents").doc(), {
      action: "reissue", ownerUid, hadToken: typeof property.get("stayToken") === "string",
      appCheck: request.app ? "verified" : "absent", at: FieldValue.serverTimestamp()
    });
    return minted;
  });
  return { stayToken };
});

/** Subscription states Stripe will still bill; anything else has nothing left to stop. */
const BILLABLE = ["trialing", "active", "past_due", "unpaid", "incomplete"];

/**
 * End a subscription now, if it is one Stripe would still bill. Answers with
 * the id it cancelled, or null when there was nothing to stop. Throws
 * `unavailable` when Stripe cannot be reached, so a caller stops before it
 * deletes anything.
 */
export async function endSubscription(subscriptionId: unknown): Promise<string | null> {
  if (typeof subscriptionId !== "string" || !subscriptionId) return null;
  try {
    const subscription = await stripe().subscriptions.retrieve(subscriptionId);
    if (!BILLABLE.includes(subscription.status)) return null;
    await stripe().subscriptions.cancel(subscriptionId, { invoice_now: false, prorate: false });
    return subscriptionId;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("unavailable", "We could not reach our payment provider to end this property's subscription, so nothing has been deleted. Try again in a moment.");
  }
}

/**
 * Take one property out of service: the step behind both "delete this
 * property" and "delete my account".
 *
 * A deleted property has no wall left to pay for, so its subscription ends
 * with it — first, so a Stripe failure leaves the property exactly as it was
 * rather than gone from the dashboard and still billing. Ended now rather
 * than at period end: the wall is going now, and a later webhook must not
 * find a running subscription to bring it back with.
 *
 * `deletedAt` starts the clock the purge reads (`propertyPurge.ts`). The
 * content is not removed here; it is removed when that clock runs out.
 *
 * A draft that was never activated gives its address back: the reservation
 * is deleted and the slug moves to `releasedSlug`, so neither the reservation
 * check nor the legacy slug query finds it and the next Host can have the
 * address. A property that was ever paid for keeps its reservation, because
 * a placard may still hang somewhere with that address on it.
 */
export async function retireProperty(propertyRef: DocumentReference, ownerUid: string, source: "host_delete" | "account_delete") {
  const db = getFirestore();
  const before = await propertyRef.get();
  if (!before.exists || before.get("lifecycle") === "deleted") throw new HttpsError("not-found", "Property not found.");
  if (before.get("ownerUid") !== ownerUid) throw new HttpsError("permission-denied", "This property is not yours.");
  const cancelled = await endSubscription(before.get("billing.stripeSubscriptionId"));

  const slugReleased = await db.runTransaction(async tx => {
    const property = await tx.get(propertyRef);
    if (!property.exists) throw new HttpsError("not-found", "Property not found.");
    if (property.get("ownerUid") !== ownerUid) throw new HttpsError("permission-denied", "This property is not yours.");
    const slug = property.get("slug");
    const release = !cancelled && neverActivated(property.data()) && typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
    const reservationRef = release ? db.doc(`slugReservations/${slug}`) : null;
    const reservation = reservationRef ? await tx.get(reservationRef) : null;

    tx.update(propertyRef, {
      lifecycle: "deleted", deletedAt: FieldValue.serverTimestamp(), deletedBy: source,
      ...(cancelled ? { "billing.status": "canceled", "billing.cancelAtPeriodEnd": false } : {}),
      ...(release ? { slug: FieldValue.delete(), releasedSlug: slug } : {}),
      updatedAt: FieldValue.serverTimestamp()
    });
    // Only this property's own reservation: an address someone else holds is not ours to free.
    if (reservation?.exists && reservation.get("propertyId") === propertyRef.id) tx.delete(reservationRef!);
    if (cancelled) tx.set(propertyRef.collection("billingActions").doc(), {
      ownerUid, action: source === "account_delete" ? "cancel_on_account_delete" : "cancel_on_delete", stripeSubscriptionId: cancelled, at: FieldValue.serverTimestamp()
    });
    return release;
  });
  return { subscriptionCancelled: cancelled !== null, slugReleased };
}

export const deleteHostProperty = onCall({ region: "australia-southeast1", maxInstances: 5, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true", secrets: stripeSecrets }, async request => {
  const ownerUid = requireHost(request);
  const propertyId = requirePropertyId(request.data?.propertyId);
  const result = await retireProperty(getFirestore().collection("properties").doc(propertyId), ownerUid, "host_delete");
  return { success: true, subscriptionCancelled: result.subscriptionCancelled };
});
