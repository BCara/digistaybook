import { getFirebaseServices } from "../../lib/firebase";
import { preparePhoto } from "./preparePhoto";
import { transferPhoto } from "./transferPhoto";
import type { PropertyLifecycle, PropertyMode, PropertySummary } from "../../domain/property";
import {
  emptyProfile,
  normalizeProfile,
  readProfile,
  type HostNote,
  type PropertyPhoto,
  type PropertyProfile
} from "../../domain/propertyProfile";
import { hostNoteOfSlot, photoAlt, photoInSlot, type PhotoSlot } from "./photoSlots";
import { isStayToken } from "../../domain/wallAddress";

/**
 * Firestore access for the Host control centre.
 *
 * Every function returns an outcome rather than throwing, for the same reason
 * hostAuth does: a page renders a message, it does not unwind. Firebase is
 * imported dynamically so a signed-out visitor never downloads the SDK.
 */
export type StoreOutcome<T> = { status: "ok"; value: T } | { status: "error"; message: string };

/**
 * Billing is written by the server only (Firestore rules refuse a client write
 * to `billing`), so this is a read-only projection and every field is optional:
 * a draft property has no billing document yet.
 */
export type BillingSnapshot = {
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  lastPaymentAt: string | null;
  /** What the next invoice will be, in minor units of `renewalCurrency`. */
  renewalAmount: number | null;
  renewalCurrency: string | null;
  /** "month" or "year", as Stripe words it. Null when the catalogue is silent. */
  renewalInterval: string | null;
};

export type HostProperty = PropertySummary & {
  createdAt: string | null;
  updatedAt: string | null;
  billing: BillingSnapshot | null;
  /**
   * The secret half of the guestbook link, minted by the server and never
   * written from here. Optional and null the way `serviceEndsAt` is: a
   * property made before there were any tokens carries no token, and the QR
   * page mints one on sight, because a placard without it scans to the public
   * wall.
   */
  stayToken?: string | null;
  /** Server-saved policy; older properties publish clear memories by default. */
  reviewContent?: boolean;
  /** Everything the Host writes about the property; see domain/propertyProfile. */
  profile: PropertyProfile;
};

export type WallCounts = { visible: number; hidden: number };

const UNCONFIGURED =
  "Your property is temporarily unavailable. Please try again later. If this continues, contact support.";

const MESSAGES: Record<string, string> = {
  "functions/already-exists": "That guestbook address is already taken. Try a different property name.",
  "functions/invalid-argument": "Check your property name and details, then try again.",
  "functions/unauthenticated": "We couldn’t verify your session. Refresh the page and sign in again. If this continues, contact support.",
  "functions/permission-denied": "Sign in with your host account and try again.",
  "functions/unavailable": "We couldn’t connect right now. Please check your connection and try again.",
  "functions/not-found": "Property creation is temporarily unavailable. Please try again later. If this continues, contact support.",
  "functions/deadline-exceeded": "We couldn’t confirm your property was created. Refresh the page to check before trying again.",
  "functions/internal": "We couldn’t reach or complete property creation. Please try again shortly. If this continues, contact support.",
  "functions/resource-exhausted": "We’re handling a lot of requests right now. Please wait a moment and try again.",
  "functions/failed-precondition": "We couldn’t create this property right now. Please contact support if this continues.",
  "storage/upload-stalled": "Your photo couldn’t finish uploading. Please check your connection and try again.",
  "storage/bucket-not-found": "Photo uploads are temporarily unavailable. Please try again later. If this continues, contact support.",
  "storage/unauthorized": "You don’t have permission to upload this photo. Check that you’re signed in to the account that owns this property.",
  "permission-denied": "You do not have access to that property.",
  unavailable: "We couldn’t connect right now. Please check your connection and try again.",
  "failed-precondition": "We couldn’t complete that request right now. Please try again later. If this continues, contact support.",
  "not-found": "That property no longer exists.",
  "resource-exhausted": "We’re handling a lot of requests right now. Please wait a moment and try again.",
  unauthenticated: "Your session has expired. Sign in again to continue."
};

/**
 * The Firestore SDK treats an unreachable backend as a transient condition and
 * retries it forever rather than rejecting, so a request that can never land
 * (Cloud Firestore not enabled for the project, a blocked network) would leave
 * a page on its loading state indefinitely. Every request is given a deadline
 * so the UI always reaches a state it can render.
 */
const REQUEST_TIMEOUT_MS = 15_000;

const UNREACHABLE_READ =
  "We couldn’t load your property right now. Please try again in a moment.";

const UNREACHABLE_WRITE =
  "We couldn’t confirm your changes were saved. Refresh the page to check. If your changes are missing, please try again.";

class RequestTimeout extends Error {}

function withDeadline<T>(work: Promise<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeout()), timeoutMs);
    void work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

/**
 * `kind` separates the two honest answers to a timeout: a read that never
 * landed returned nothing, while a write that never landed may still be
 * applied server-side, so the Host is told to reload rather than to retry.
 */
export function describeStoreError(error: unknown, kind: "read" | "write" = "read"): StoreOutcome<never> {
  if (error instanceof RequestTimeout) {
    return { status: "error", message: kind === "read" ? UNREACHABLE_READ : UNREACHABLE_WRITE };
  }
  const message = MESSAGES[errorCode(error)];
  return {
    status: "error",
    message: message ?? "We couldn’t complete that request. Please try again. If this continues, contact support."
  };
}

/** Firestore returns Timestamps; the UI only ever formats them, so store ISO strings. */
function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/**
 * Documents are validated on read rather than trusted. A field the server has
 * not written yet (or a shape from an older schema) must not crash the page,
 * so each field falls back to a safe default.
 */
function toHostProperty(id: string, data: Record<string, unknown>): HostProperty {
  const billing = (data.billing ?? null) as Record<string, unknown> | null;
  return {
    id,
    ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "",
    name: typeof data.name === "string" ? data.name : "Untitled property",
    slug: typeof data.slug === "string" ? data.slug : "",
    lifecycle: (typeof data.lifecycle === "string" ? data.lifecycle : "draft") as PropertyLifecycle,
    mode: (data.mode === "live" ? "live" : "sandbox") as PropertyMode,
    foundationalPostCount: typeof data.foundationalPostCount === "number" ? data.foundationalPostCount : 0,
    serviceEndsAt: isoOrNull(data.serviceEndsAt),
    createdAt: isoOrNull(data.createdAt),
    updatedAt: isoOrNull(data.updatedAt),
    stayToken: isStayToken(data.stayToken) ? data.stayToken : null,
    reviewContent: data.reviewContent === true,
    profile: readProfile(data.profile),
    billing: billing && {
      trialEndsAt: isoOrNull(billing.trialEndsAt),
      currentPeriodEndsAt: isoOrNull(billing.currentPeriodEndsAt),
      lastPaymentAt: isoOrNull(billing.lastPaymentAt),
      renewalAmount: typeof billing.renewalAmount === "number" ? billing.renewalAmount : null,
      renewalCurrency: typeof billing.renewalCurrency === "string" ? billing.renewalCurrency : null,
      renewalInterval: typeof billing.renewalInterval === "string" ? billing.renewalInterval : null
    }
  };
}

async function firestore() {
  const services = await getFirebaseServices();
  return services?.firestore ?? null;
}

/** Every property this Host owns, newest first. */
export async function listOwnedProperties(ownerUid: string): Promise<StoreOutcome<HostProperty[]>> {
  const database = await firestore();
  if (!database) return { status: "error", message: UNCONFIGURED };
  try {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const snapshot = await withDeadline(
      getDocs(query(collection(database, "properties"), where("ownerUid", "==", ownerUid)))
    );
    // Sorted here rather than with orderBy so the query needs no composite index.
    const properties = snapshot.docs
      .map((entry) => toHostProperty(entry.id, entry.data() as Record<string, unknown>))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.name.localeCompare(b.name));
    return { status: "ok", value: properties };
  } catch (error) {
    return describeStoreError(error);
  }
}

export async function loadProperty(propertyId: string): Promise<StoreOutcome<HostProperty | null>> {
  const database = await firestore();
  if (!database) return { status: "error", message: UNCONFIGURED };
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const snapshot = await withDeadline(getDoc(doc(database, "properties", propertyId)));
    if (!snapshot.exists()) return { status: "ok", value: null };
    return { status: "ok", value: toHostProperty(snapshot.id, snapshot.data() as Record<string, unknown>) };
  } catch (error) {
    return describeStoreError(error);
  }
}

/**
 * A new property is always an owned sandbox draft, the only shape Firestore
 * rules accept from a client. Going live is a billing transition the server
 * owns, so nothing here can set `lifecycle` or `mode` to anything else.
 *
 * `profile` is what the add-property wizard collected. It defaults to the
 * starter profile, so a property created without one still arrives with its
 * arrival note written: a Host who opens a blank sheet has to invent both
 * what to say and the voice to say it in, and editing a plain note that is
 * true of nearly every property is the shorter road.
 *
 * Photographs are not part of it. A file has to be uploaded against a
 * property that already exists, so a cover is written by
 * `uploadPropertyPhoto` in the step after this one.
 */
export async function createProperty(
  ownerUid: string,
  input: { name: string; slug: string; profile?: PropertyProfile }
): Promise<StoreOutcome<HostProperty>> {
  const database = await firestore();
  if (!database) return { status: "error", message: UNCONFIGURED };
  try {
    const services = await getFirebaseServices();
    if (!services || services.auth.currentUser?.uid !== ownerUid) return { status: "error", message: "Sign in with your host account and try again." };
    const { httpsCallable } = await import("firebase/functions");
    const draft = {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      // Normalized here so the document a property is created with is the
      // same shape `savePropertyProfile` would write to it a day later.
      profile: normalizeProfile(input.profile ?? emptyProfile())
    };
    const result = await withDeadline(httpsCallable<typeof draft, { property: Record<string, unknown> & { id: string } }>(services.functions, "createHostProperty")(draft));
    return {
      status: "ok",
      value: toHostProperty(result.data.property.id, result.data.property)
    };
  } catch (error) {
    return describeStoreError(error, "write");
  }
}

/**
 * The guestbook link's token for a property created before there were any.
 *
 * Minting belongs to the server, because the token is the whole of the secret
 * between a forwarded listing URL and a Host's Wi-Fi password; this only asks
 * for it. It happens once: a property that already has a token is handed the
 * one it has, so asking twice does not print two different cards.
 */
export async function ensureStayToken(propertyId: string): Promise<StoreOutcome<string>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { httpsCallable } = await import("firebase/functions");
    const result = await withDeadline(httpsCallable<{ propertyId: string }, { stayToken: string }>(services.functions, "ensureStayToken")({ propertyId }));
    return { status: "ok", value: result.data.stayToken };
  } catch (error) {
    return describeStoreError(error, "write");
  }
}

export async function deleteProperty(propertyId: string): Promise<StoreOutcome<void>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { httpsCallable } = await import("firebase/functions");
    await withDeadline(httpsCallable<{ propertyId: string }, { success: boolean }>(services.functions, "deleteHostProperty")({ propertyId }));
    return { status: "ok", value: undefined };
  } catch (error) {
    return describeStoreError(error, "write");
  }
}

/**
 * The name is the only property field a Host may write after creation. The
 * wall address is set once, at creation, because a QR display is printed from
 * it; Firestore rules refuse a client change to `slug` for the same reason.
 */
export async function savePropertyName(
  propertyId: string,
  name: string
): Promise<StoreOutcome<{ name: string }>> {
  const database = await firestore();
  if (!database) return { status: "error", message: UNCONFIGURED };
  try {
    const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");
    const trimmed = name.trim();
    await withDeadline(
      updateDoc(doc(database, "properties", propertyId), { name: trimmed, updatedAt: serverTimestamp() })
    );
    return { status: "ok", value: { name: trimmed } };
  } catch (error) {
    return describeStoreError(error, "write");
  }
}

/* ---------------------------- Property profile ---------------------------
   The profile is written field by field under a `profile` map rather than as
   one object, because two things write it: this form, and the photo controls,
   which save the moment a file finishes uploading. Writing the whole map from
   either would silently drop the other's work.                              */

/** Photos are written by their own path, so a text save never touches them. */
/** Everything a Host writes about a property, bar the photographs. */
const PROFILE_FIELDS = [
  "theme",
  "colour",
  "displayWallOff",
  "location",
  "welcome",
  "hosts",
  "hostSince",
  "stayHeading",
  "stayWelcome",
  "stayTip",
  "stayNoteOff",
  // The whole list in one field. Each note carries its own photograph, so a
  // text save writes pictures too — which is safe because the form's draft is
  // where an upload lands the moment it finishes, and it is that draft being
  // written here. The single `hostNote` and `hostNotePhoto` a property used to
  // carry are deliberately not written any more: once a list is stored, the
  // read stops looking at them.
  "hostNotes",
  "facts",
  "factsOff",
  "guestPrompt"
] as const;

export async function savePropertyProfile(
  propertyId: string,
  profile: PropertyProfile
): Promise<StoreOutcome<PropertyProfile>> {
  const database = await firestore();
  if (!database) return { status: "error", message: UNCONFIGURED };
  try {
    const { doc, serverTimestamp, updateDoc } = await import("firebase/firestore");
    const normalized = normalizeProfile(profile);
    const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const field of PROFILE_FIELDS) update[`profile.${field}`] = normalized[field];
    await withDeadline(updateDoc(doc(database, "properties", propertyId), update));
    return { status: "ok", value: normalized };
  } catch (error) {
    return describeStoreError(error, "write");
  }
}

/**
 * The slots themselves are named in `photoSlots`, which is where a page reads
 * them from too: what a slot is has nothing to do with Firestore, and every
 * page test that stubs this module would otherwise have to restate it. The
 * type is passed on from here because every caller already asks this module
 * for it, and a type cannot be stubbed out from under them.
 */
export type { PhotoSlot } from "./photoSlots";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/** How far along an upload is, between 0 and 1. */
export type UploadProgress = (fraction: number) => void;

/**
 * Send the bytes, reporting how many have gone.
 *
 * A resumable task is used for the progress it reports rather than for its
 * resumability: a Host watching a photograph upload needs to see it moving,
 * and a single-shot `uploadBytes` says nothing at all until it is finished.
 */

/**
 * Upload one photograph and record it on the property in a single step.
 *
 * The Storage object is written under the property it belongs to, which is
 * what the Storage rules check ownership against. The previous file in the
 * slot is deleted after the new one is recorded: losing the old object matters
 * far less than leaving the document pointing at a file that is already gone.
 *
 * Only two of the steps here are ones a Host has to wait for — shrinking the
 * file and sending it. Reading the property to learn which object is being
 * replaced is started alongside them, and deleting that object is not waited
 * for at all: a leftover file in the bucket is nobody's emergency, and it used
 * to be charged to the Host as a second or two of "Uploading…".
 */
export async function uploadPropertyPhoto(
  propertyId: string,
  slot: PhotoSlot,
  file: File,
  onProgress?: UploadProgress
): Promise<StoreOutcome<PropertyPhoto>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const replacing = loadProperty(propertyId);
    const [{ getDownloadURL, ref, uploadBytesResumable }, prepared] = await Promise.all([
      import("firebase/storage"),
      preparePhoto(file)
    ]);

    const extension = EXTENSIONS[prepared.contentType] ?? "img";
    // The slot names the object so a bucket listing reads as the wall does.
    // A note's slot carries a colon, which an object name is better off
    // without, so it is written with a dash: the document is what the wall
    // reads, and this is only ever a name for a human looking at the bucket.
    const named = slot.replace(":", "-");
    const path = `properties/${propertyId}/media/${named}-${Date.now()}.${extension}`;
    const object = ref(services.storage, path);

    await transferPhoto(
        uploadBytesResumable(object, prepared.blob, {
          contentType: prepared.contentType,
          cacheControl: "public, max-age=31536000"
        }),
        onProgress
    );
    const url = await withDeadline(getDownloadURL(object));
    const photo: PropertyPhoto = {
      path,
      url,
      alt: photoAlt(slot),
      width: prepared.width,
      height: prepared.height
    };

    await withDeadline(writePhoto(services.firestore, propertyId, slot, photo));

    if (slot === "avatar") {
      await withDeadline(writePhoto(services.firestore, propertyId, "hostPhoto", photo));
    } else if (slot === "hostPhoto") {
      await withDeadline(writePhoto(services.firestore, propertyId, "avatar", photo));
    }

    void replacing.then((previous) => {
      const replaced =
        previous.status === "ok" && previous.value ? photoInSlot(previous.value.profile, slot)?.path : undefined;
      if (replaced && replaced !== path) void deleteObject(services.storage, replaced);
    });

    return { status: "ok", value: photo };
  } catch (error) {
    return describeStoreError(error, "write");
  }
}

/**
 * Record a photograph against the property, wherever the slot lives.
 *
 * The property's own three are single fields, so each is written by its own
 * path and nothing else in the document is touched. The notes are a list, and
 * Firestore cannot address one entry of a list by path, so a note's picture is
 * written in a transaction: what is read is what is stored a moment before it
 * is written back, so words typed on another tab are not overwritten by a
 * photograph landing on this one. A note the stored list has never seen — one
 * a Host opened and dropped a file onto before saving — is appended, so the
 * picture has something to belong to until the words arrive.
 */
async function writePhoto(
  database: import("firebase/firestore").Firestore,
  propertyId: string,
  slot: PhotoSlot,
  photo: PropertyPhoto | null
): Promise<void> {
  const { deleteField, doc, runTransaction, serverTimestamp, updateDoc } = await import("firebase/firestore");
  const reference = doc(database, "properties", propertyId);
  const noteId = hostNoteOfSlot(slot);

  if (noteId === null) {
    await updateDoc(reference, {
      [`profile.${slot}`]: photo ?? deleteField(),
      updatedAt: serverTimestamp()
    });
    return;
  }

  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const notes = readProfile(snapshot.get("profile")).hostNotes;
    const known = notes.some((note) => note.id === noteId);
    const next: HostNote[] = known
      ? notes.map((note) => (note.id === noteId ? { ...note, photo } : note))
      : [...notes, { id: noteId, message: "", style: "bordered" as const, photo }];
    transaction.update(reference, { "profile.hostNotes": next, updatedAt: serverTimestamp() });
  });
}

/** Remove the photograph in a slot, from the property first and the bucket after. */
export async function removePropertyPhoto(
  propertyId: string,
  slot: PhotoSlot,
  path: string
): Promise<StoreOutcome<null>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    await withDeadline(writePhoto(services.firestore, propertyId, slot, null));

    if (slot === "avatar") {
      await withDeadline(writePhoto(services.firestore, propertyId, "hostPhoto", null));
    } else if (slot === "hostPhoto") {
      await withDeadline(writePhoto(services.firestore, propertyId, "avatar", null));
    }

    if (path) await deleteObject(services.storage, path);
    return { status: "ok", value: null };
  } catch (error) {
    return describeStoreError(error, "write");
  }
}

/**
 * A leftover object costs storage; a failed delete must not be reported to the
 * Host as a failed change, because the change they asked for has happened.
 */
async function deleteObject(storage: import("firebase/storage").FirebaseStorage, path: string): Promise<void> {
  try {
    const { deleteObject: remove, ref } = await import("firebase/storage");
    await withDeadline(remove(ref(storage, path)));
  } catch {
    /* The document no longer points at it; a sweep can collect it later. */
  }
}

/**
 * The two numbers the property dashboard shows at a glance: how many memories
 * are on the wall, and how many are off it. Counted rather than listed, because
 * the moderation route is where a Host reads and acts on them individually.
 *
 * `hidden` spans both off-wall states named in the reporting state model — a
 * post held for review and one the Host took down themselves. A Host reading a
 * single number wants "not on my wall", and splitting it here would only make
 * the dashboard restate what the queue already lays out.
 */
export async function loadWallCounts(propertyId: string): Promise<StoreOutcome<WallCounts>> {
  const database = await firestore();
  if (!database) return { status: "error", message: UNCONFIGURED };
  try {
    const { collection, getCountFromServer, query, where } = await import("firebase/firestore");
    const posts = collection(database, "properties", propertyId, "posts");
    const [visible, hidden] = await withDeadline(
      Promise.all([
        getCountFromServer(query(posts, where("visibility", "==", "visible"))),
        getCountFromServer(query(posts, where("visibility", "in", ["hidden_pending_review", "hidden_by_host"])))
      ])
    );
    return {
      status: "ok",
      value: { visible: visible.data().count, hidden: hidden.data().count }
    };
  } catch (error) {
    return describeStoreError(error);
  }
}
