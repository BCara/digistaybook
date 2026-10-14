import type { HostProperty } from "./propertyStore";

/**
 * Properties this session has already read.
 *
 * A property is spread over four screens, and each of them read the property
 * again from nothing: every click in the property nav blanked the banner, the
 * nav and the screen, printed "Loading property", and drew the whole frame
 * back a moment later. The property had not changed — the reader had simply
 * moved one link, and the page flinched at them for it.
 *
 * So a property read once is kept here for the rest of the session, and the
 * next screen opens on it while the fresh read is still in the air. The read
 * still happens: this decides what is on the screen while it runs, not whether
 * to run it.
 *
 * It is a session cache and nothing more — no expiry, no persistence. It is
 * emptied when the Host signs out, so a second account on the same browser
 * never opens on the first one's property.
 */
const seen = new Map<string, HostProperty>();
const lists = new Map<string, string[]>();

/** A complete list, including an empty one, belongs to the account that read it. */
export function recallOwnedProperties(ownerUid: string): HostProperty[] | null {
  const ids = lists.get(ownerUid);
  return ids ? ids.flatMap(id => {
    const property = seen.get(id);
    return property?.ownerUid === ownerUid ? [property] : [];
  }) : null;
}

export function rememberOwnedProperties(ownerUid: string, properties: readonly HostProperty[]): void {
  rememberProperties(properties);
  lists.set(ownerUid, properties.filter(property => property.ownerUid === ownerUid).map(property => property.id));
}

/** What is known about a property right now, or null if it has not been read. */
export function recallProperty(propertyId: string): HostProperty | null {
  return seen.get(propertyId) ?? null;
}

export function rememberProperty(property: HostProperty): void {
  seen.set(property.id, property);
}

/** The dashboard reads every property it lists, so each opens instantly too. */
export function rememberProperties(properties: readonly HostProperty[]): void {
  for (const property of properties) rememberProperty(property);
}

/** Called on sign-out, and between tests. */
export function forgetProperties(): void {
  seen.clear();
  lists.clear();
}
