// Handbook §§5.2 and 5.11: never return the source property/post documents.
import { timingSafeEqual } from "node:crypto";

/* ---------------------------- The stay token ----------------------------
   The in-stay wall answers with the Wi-Fi password and the lock-up routine,
   so it cannot be reachable from the slug alone: that slug is printed in
   listings and embedded on a Host's own site, and `/wall/` swapped for
   `/stay/` would otherwise hand the house to anyone who noticed.

   The token is minted at creation, stored on the property document and
   served to nobody — not by `publicProperty`, not by `ownerRecovery`, both
   of which name every field they return. A caller without it is reading the
   public wall, whatever view it asked for.

   The pattern is a deliberate second copy of the one in
   `src/domain/wallAddress.ts`: this is the half that decides, and it must not
   depend on a build of the web app to be right.
   ---------------------------------------------------------------------- */
const stayTokenPattern = /^[A-Za-z0-9_-]{22}$/;

/**
 * Whether a caller's token is this property's. Compared in constant time:
 * the comparison is cheap, and a secret compared with `===` is a secret
 * compared one character at a time.
 */
export function stayTokenMatches(data: Record<string, any> | undefined, token: unknown): boolean {
  const actual = data?.stayToken;
  if (typeof actual !== "string" || !stayTokenPattern.test(actual)) return false;
  if (typeof token !== "string" || !stayTokenPattern.test(token)) return false;
  // Both matched a fixed-length pattern, so the buffers are the same size.
  return timingSafeEqual(Buffer.from(actual), Buffer.from(token));
}

/**
 * Which wall a caller is actually reading. Asking for the in-stay wall is not
 * the same as reaching it: the token is what reaches it, and an owner reaching
 * their own property is the second way, because a Host previewing the wall
 * they are about to print should not have to hold their own placard.
 */
export function resolveWallView(
  data: Record<string, any> | undefined,
  requested: "public" | "stay",
  token: unknown,
  uid?: string
): "public" | "stay" {
  if (requested !== "stay") return "public";
  return stayTokenMatches(data, token) || ownsProperty(data, uid) ? "stay" : "public";
}

export function wallIsOpen(data: Record<string, any>, now = Date.now(), view: "public" | "stay" = "stay"): boolean {
  return data.mode === "live" && (view === "stay" || data.profile?.displayWallOff !== true) && (
    ["trialing", "active", "grace_period"].includes(data.lifecycle)
    || (data.lifecycle === "cancelled_pending_end" && typeof data.serviceEndsAt?.toMillis === "function"
      && data.serviceEndsAt.toMillis() > now)
  );
}

const text = (value: unknown, max = 1200) => typeof value === "string" ? value.slice(0, max) : "";
function photo(value: any) {
  if (!value || typeof value.url !== "string" || !/^https:\/\//.test(value.url)) return null;
  return { url: value.url.slice(0, 4096), alt: text(value.alt, 120) };
}
// The hosts' own notes. A property saved before there were several carries
// one in `hostNote` with its picture beside it, so that pair is served as the
// first note: the wall reads one shape whatever shape the document is in.
function hostNotes(profile: Record<string, any>) {
  if (!Array.isArray(profile.hostNotes)) {
    const message = text(profile.hostNote, 600), picture = photo(profile.hostNotePhoto);
    return message || picture ? [{ id: "note1", message, style: "bordered", photo: picture }] : [];
  }
  return profile.hostNotes.slice(0, 4).map((note: any, index: number) => ({
    id: text(note?.id, 24).replace(/[^a-zA-Z0-9]/g, "") || `note${index + 1}`,
    message: text(note?.message, 600),
    style: note?.style === "pinned" ? "pinned" : "bordered",
    photo: photo(note?.photo)
  })).filter((note: any) => note.message.trim() || note.photo);
}

export function publicProperty(data: Record<string, any>, view: "public" | "stay" = "public") {
  const profile = data.profile ?? {};
  return {
    name: text(data.name, 60), location: text(profile.location, 200),
    welcome: text(profile.welcome), hosts: text(profile.hosts, 100), hostPhoto: photo(profile.hostPhoto),
    hostNotes: hostNotes(profile), theme: text(profile.theme, 30), cover: photo(profile.cover), guestPrompt: text(profile.guestPrompt, 240),
    /* The house guidance is the in-stay wall's whole reason for existing
       (D-013), so reaching that wall is what earns it: the stay token is the
       gate, and `resolveWallView` has already turned a caller without one
       back to the public wall. What a Host chooses not to say is said with
       `stayNoteOff` and `factsOff` — the same switches the canvas draws. */
    houseInformation: view === "stay" ? {
      heading: profile.stayNoteOff ? "" : text(profile.stayHeading, 80),
      welcome: profile.stayNoteOff ? "" : text(profile.stayWelcome),
      tip: profile.stayNoteOff ? "" : text(profile.stayTip, 240),
      facts: profile.factsOff || !Array.isArray(profile.facts) ? [] : profile.facts.slice(0, 8).map((fact: any) => ({ term: text(fact?.term, 32), detail: text(fact?.detail, 60), note: text(fact?.note, 140) }))
    } : null
  };
}

export function publicPost(id: string, data: Record<string, any>) {
  return { id, message: text(data.message), displayName: text(data.displayName, 80),
    photoCount: Number.isInteger(data.guestPhotoCount) ? Math.max(0, Math.min(10, data.guestPhotoCount)) : 0,
    createdAt: typeof data.createdAt?.toDate === "function" ? data.createdAt.toDate().toISOString() : null };
}

/**
 * The signed-in account that owns this property, and nobody else. A closed
 * wall tells its owner why it is closed and serves them its content as a
 * preview; to every other caller it is simply unavailable, because the
 * lifecycle and the management ID are the owner's business.
 */
export function ownsProperty(data: Record<string, any> | undefined, uid?: string) {
  return Boolean(data && uid && data.ownerUid === uid);
}

/**
 * Whether a closed wall may be previewed by its owner at all. A property on
 * its way out is not previewed: its content is being removed, and showing it
 * back would promise something the deletion is about to take away.
 */
export function wallPreviewable(data: Record<string, any> | undefined, uid?: string) {
  return ownsProperty(data, uid) && !["deleted", "deletion_scheduled"].includes(String(data!.lifecycle ?? ""));
}

/** The owner's recovery fields: status and management ID, nothing else. */
export function ownerRecovery(data: Record<string, any>, propertyId: string) {
  return {
    propertyId, lifecycle: String(data.lifecycle ?? ""), mode: String(data.mode ?? ""),
    publicWallOff: data.profile?.displayWallOff === true
  };
}

/** Never disclose an unpublished property's status or management ID to visitors. */
export function unavailableWall(data: Record<string, any> | undefined, propertyId: string, uid?: string) {
  if (!ownsProperty(data, uid)) return { status: "unavailable" as const };
  return { status: "unavailable" as const, owner: ownerRecovery(data!, propertyId) };
}
