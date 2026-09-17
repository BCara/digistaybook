import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { publicPost } from "./publicWall.js";

const options = { region: "australia-southeast1", enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true", maxInstances: 5, memory: "512MiB" as const };
const id = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new HttpsError("invalid-argument", "Invalid export reference.");
  return value;
};
async function owner(request: CallableRequest) {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("permission-denied", "Sign in as the property owner.");
  const property = await getFirestore().doc(`properties/${id(request.data?.propertyId)}`).get();
  if (!property.exists || property.get("ownerUid") !== request.auth.uid) throw new HttpsError("permission-denied", "This property is not yours.");
  return property;
}
function available(data: any) {
  return data?.visibility === "visible" && !data.safetyRestricted && !data.safetyCaseOpen && !data.openReportCount;
}
export const listHostExport = onCall(options, async request => {
  const property = await owner(request);
  let query = property.ref.collection("posts").orderBy(FieldPath.documentId()).limit(4);
  if (request.data.cursor) query = query.startAfter(id(request.data.cursor));
  const page = await query.get(), selected = page.docs.slice(0, 3);
  const posts = selected.filter(doc => available(doc.data())).map(doc => ({ ...publicPost(doc.id, doc.data()),
    // Legacy external photographs cannot safely be fetched by the export server.
    unsupportedPhotos: !!doc.get("photo") || !!doc.get("photos")?.length }));
  return { name: String(property.get("name") ?? "Guestbook").slice(0, 60), posts,
    nextCursor: page.size > 3 ? selected.at(-1)!.id : null };
});
export const readHostExportPhoto = onCall(options, async request => {
  const property = await owner(request), postId = id(request.data?.postId), index = request.data?.index;
  const db = getFirestore(), postRef = property.ref.collection("posts").doc(postId), guestRef = db.doc(`guestSubmissions/${postId}`);
  const [post, guest] = await Promise.all([postRef.get(), guestRef.get()]);
  const data = guest.data();
  if (!available(post.data()) || !data || data.propertyId !== property.id || data.status !== "published" || data.safetyCaseOpen
    || data.mediaLocation !== "published" || !Number.isInteger(index) || index < 0 || index >= Math.min(10, data.photoCount)) throw new HttpsError("permission-denied", "This photo is no longer exportable.");
  const bucket = process.env.FUNCTIONS_EMULATOR === "true" ? "demo-digistaybook-published.firebasestorage.app" : process.env.GUEST_PUBLISHED_BUCKET;
  if (!bucket || data.publishedBucket !== bucket) throw new HttpsError("failed-precondition", "Photo export is unavailable.");
  const file = getStorage().bucket(bucket).file(`properties/${property.id}/published/${postId}/${index}.webp`);
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) > 5 * 1024 * 1024) throw new HttpsError("resource-exhausted", "This photo needs a larger export service.");
  const [bytes] = await file.download();
  const [latestPost, latestGuest, latestProperty] = await Promise.all([postRef.get(), guestRef.get(), property.ref.get()]);
  if (!available(latestPost.data()) || latestGuest.get("status") !== "published" || latestGuest.get("safetyCaseOpen")
    || latestGuest.get("revision") !== data.revision || latestProperty.get("ownerUid") !== request.auth!.uid) throw new HttpsError("permission-denied", "This photo changed. Restart this export part.");
  return { base64: bytes.toString("base64") };
});
