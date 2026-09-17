import { createHash, randomBytes } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

/**
 * The secret half of a guestbook link: 16 random bytes, which is the whole of
 * the distance between a forwarded listing URL and a Host's Wi-Fi password.
 * base64url so it survives a path, a QR code and a printed card.
 *
 * It is minted here and never rewritten (D-012). A placard is printed from it,
 * and an address that moves is a card that scans to nothing.
 */
export const mintStayToken = () => randomBytes(16).toString("base64url");

const limits: Record<string, number> = { location: 80, welcome: 400, hosts: 60, hostSince: 60, stayHeading: 80, stayWelcome: 1200, stayTip: 240, guestPrompt: 240 };
export const createHostProperty = onCall({ region: "australia-southeast1", maxInstances: 5, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" }, async request => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Sign in with your host account.");
  const ownerUid = request.auth.uid, name = request.data?.name, slug = request.data?.slug;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60 || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40) throw new HttpsError("invalid-argument", "Check the property name and address.");
  const incoming = request.data?.profile ?? {}, profile: Record<string, any> = {};
  for (const [key, max] of Object.entries(limits)) {
    if (incoming[key] !== undefined && (typeof incoming[key] !== "string" || incoming[key].length > max)) throw new HttpsError("invalid-argument", "Check the property details.");
    profile[key] = (incoming[key] ?? "").trim();
  }
  profile.theme = ["linen", "studio", "archive", "harbour", "sage"].includes(incoming.theme) ? incoming.theme : "linen";
  for (const key of ["displayWallOff", "stayNoteOff", "factsOff"]) profile[key] = incoming[key] === true;
  for (const key of ["cover", "avatar", "hostPhoto"]) profile[key] = null;
  // The hosts' own notes arrive as words and a choice of how each is fixed to
  // the wall. Photographs are not among them: a file can only be stored
  // against a property that exists, so they are uploaded after this returns.
  if (incoming.hostNotes !== undefined && (!Array.isArray(incoming.hostNotes) || incoming.hostNotes.length > 4)) throw new HttpsError("invalid-argument", "Use up to four notes of your own.");
  profile.hostNotes = (incoming.hostNotes ?? []).map((note: any, index: number) => {
    if (typeof note?.message !== "string" || note.message.length > 600) throw new HttpsError("invalid-argument", "Check your notes for the wall.");
    const id = typeof note?.id === "string" ? note.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) : "";
    return { id: id || `note${index + 1}`, message: note.message.trim(), style: note?.style === "pinned" ? "pinned" : "bordered", photo: null };
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
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Sign in with your host account.");
  const ownerUid = request.auth.uid, propertyId = request.data?.propertyId;
  if (typeof propertyId !== "string" || !propertyId) throw new HttpsError("invalid-argument", "Property ID is required.");
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

export const deleteHostProperty = onCall({ region: "australia-southeast1", maxInstances: 5, enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true" }, async request => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Sign in with your host account.");
  const ownerUid = request.auth.uid;
  const propertyId = request.data?.propertyId;
  if (typeof propertyId !== "string" || !propertyId) throw new HttpsError("invalid-argument", "Property ID is required.");

  const db = getFirestore();
  const propertyRef = db.collection("properties").doc(propertyId);

  await db.runTransaction(async tx => {
    const property = await tx.get(propertyRef);
    if (!property.exists) throw new HttpsError("not-found", "Property not found.");
    if (property.get("ownerUid") !== ownerUid) throw new HttpsError("permission-denied", "This property is not yours.");

    tx.update(propertyRef, {
      lifecycle: "deleted",
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { success: true };
});
