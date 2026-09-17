export type PropertyLifecycle =
  | "draft"
  | "trialing"
  | "active"
  | "grace_period"
  | "suspended"
  | "cancelled_pending_end"
  | "dormant"
  | "deletion_scheduled"
  | "deleted";

export type PropertyMode = "sandbox" | "live";

export type PropertySummary = {
  id: string;
  ownerUid: string;
  name: string;
  slug: string;
  lifecycle: PropertyLifecycle;
  mode: PropertyMode;
  foundationalPostCount: number;
  /** Server-owned entitlement deadline, required after cancellation. */
  serviceEndsAt?: string | null;
};

export const isPubliclyReadable = (property: PropertySummary, now = Date.now()) =>
  property.mode === "live" && (["trialing", "active", "grace_period"].includes(property.lifecycle)
    || (property.lifecycle === "cancelled_pending_end" && Date.parse(property.serviceEndsAt ?? "") > now));

export const canDownloadQrKit = (property: PropertySummary, now = Date.now()) => isPubliclyReadable(property, now);

/* --------------------------- Property identity ---------------------------
   A Host names a property; the wall address is derived from that name and is
   never typed. Guests reach a wall by scanning the QR display, so the address
   is plumbing rather than something a Host has to invent, and generating it
   here keeps one rule for a creation form, a rename and any server check.

   The address is fixed when the property is created. A QR display is printed
   from it, so a later rename must not silently break every placard already on
   a kitchen table; changing a published address is a server-owned move.     */

export const propertyIdentityLimits = {
  nameMin: 2,
  nameMax: 60,
  slugMax: 40,
  slugSuffixLength: 4
} as const;

/** Lowercase words joined by single hyphens — nothing that needs URL escaping. */
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slugs that would collide with the demo wall or a top-level route. */
const reservedSlugs = new Set([
  "demo-cottage",
  "host",
  "stay",
  "wall",
  "terms",
  "privacy",
  "privacy-safety",
  "sign-in",
  "admin",
  "api"
]);

/** Readable part of a wall address. The suffix is what makes it unique. */
export function slugifyPropertyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "") // drop the accents NFKD split off, so "Café" slugs as "cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, propertyIdentityLimits.slugMax)
    .replace(/-+$/, "");
}

/** No vowels and no look-alike characters, so a suffix cannot read as a word. */
const suffixAlphabet = "23456789bcdfghjkmnpqrstvwxz";

function randomSuffix(length: number): string {
  const source = globalThis.crypto;
  const values = new Uint8Array(length);
  if (source?.getRandomValues) {
    source.getRandomValues(values);
  } else {
    for (let index = 0; index < length; index += 1) values[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(values, (value) => suffixAlphabet[value % suffixAlphabet.length]).join("");
}

/**
 * A wall address for a new property: the name, plus a short random suffix.
 *
 * The suffix is what lets this run in the browser at all. Firestore refuses to
 * show this Host another Host's drafts, so `takenSlugs` can only ever be their
 * own properties and a bare name-derived slug could not be shown to be free.
 * A random tail makes a collision improbable rather than checked, and leaves
 * the final word on uniqueness to the server.
 */
export function generatePropertySlug(
  name: string,
  options: { takenSlugs?: Iterable<string>; suffix?: (length: number) => string } = {}
): string {
  const { slugMax, slugSuffixLength } = propertyIdentityLimits;
  const suffix = options.suffix ?? randomSuffix;
  const taken = new Set(options.takenSlugs ?? []);
  const base =
    slugifyPropertyName(name)
      .slice(0, slugMax - slugSuffixLength - 1)
      .replace(/-+$/, "") || "property";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}-${suffix(slugSuffixLength)}`;
    if (!reservedSlugs.has(candidate) && !taken.has(candidate)) return candidate;
  }
  // Ten collisions in a row means the suffix source is not random; a longer
  // tail is a better answer than handing back an address already in use.
  return `${base.slice(0, slugMax - slugSuffixLength * 2 - 1)}-${suffix(slugSuffixLength * 2)}`;
}

export type IdentityField = "name";
export type IdentityProblem = { field: IdentityField; message: string };

/** The name is the only identity field a Host writes, so it is the only one validated. */
export function validatePropertyName(name: string): IdentityProblem[] {
  const { nameMin, nameMax } = propertyIdentityLimits;
  const trimmed = name.trim();

  if (trimmed.length < nameMin) {
    return [{ field: "name", message: `Give the property a name of at least ${nameMin} characters.` }];
  }
  if (trimmed.length > nameMax) {
    return [{ field: "name", message: `Property names are limited to ${nameMax} characters.` }];
  }
  return [];
}

/* ------------------------- Lifecycle presentation ------------------------
   Lifecycle is server-owned (Firestore rules refuse a client write to it), so
   the UI only ever describes it. Keeping the copy beside the type means a new
   state cannot be added without deciding what a Host is told about it.      */

export const lifecycleLabels: Record<PropertyLifecycle, string> = {
  draft: "Draft",
  trialing: "Free trial",
  active: "Active",
  grace_period: "Payment overdue",
  suspended: "Suspended",
  cancelled_pending_end: "Cancelled",
  dormant: "Dormant",
  deletion_scheduled: "Deletion scheduled",
  deleted: "Deleted"
};

export const lifecycleSummaries: Record<PropertyLifecycle, string> = {
  draft: "Not published yet. Set the property up here, then start your trial to take it live.",
  trialing: "Your free trial is running and the wall is live.",
  active: "The subscription is paid and the wall is live.",
  grace_period: "A payment failed. The wall stays live while the payment is retried.",
  suspended: "The wall is offline until a payment succeeds.",
  cancelled_pending_end: "Cancelled. The wall stays live until the paid period ends.",
  dormant: "The wall is offline. Reactivate to bring it back with its memories intact.",
  deletion_scheduled: "This property and its memories are scheduled for deletion.",
  deleted: "This property has been deleted."
};

/**
 * `sandbox` is the BOP's word for the pre-purchase workspace, and it stays the
 * stored value, but it is jargon to a Host looking at their own property: it
 * reads as though the product, rather than their wall, is a test. What the
 * pill has to answer is "can anyone else see this?", so that is what it says.
 */
export const modeLabels: Record<PropertyMode, string> = {
  sandbox: "Private",
  live: "Live"
};

export const modeSummaries: Record<PropertyMode, string> = {
  sandbox: "Only you can open this property. Set it up here; nothing is served to a guest until it goes live.",
  live: "This property is served to guests who scan its QR display or open its wall address."
};
