/**
 * A Host's own details, handed from their property to the sign maker.
 *
 * They travel in session storage rather than the address because the Wi-Fi
 * password is among them, and an address ends up in history, logs and shared
 * links. The address carries only `?from=property`, which says to look: the
 * sign maker reached any other way is the public tool, on its own defaults,
 * and a reload of a Host's sign comes back with their details rather than the
 * demo cottage's.
 */
export type SignPrefill = {
  ownerUid: string;
  name: string;
  link: string;
  wifi: { network: string; password: string } | null;
  /** Where "Back to the property" leads. */
  backHref: string;
};

const key = "digistaybook.signPrefill";

/** Private print details belong to the host session that supplied them. */
export function clearSignPrefill() {
  try { window.sessionStorage.removeItem(key); } catch { /* Storage may be blocked. */ }
}

/** The sign maker, opened on a Host's own details. */
export const signMakerForPropertyHref = "/qr-sign-maker?from=property";

export function handOffToSignMaker(prefill: SignPrefill) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(prefill));
    return true;
  } catch {
    clearSignPrefill();
    return false;
  }
}

export function takeSignPrefill(ownerUid: string): SignPrefill | null {
  try {
    if (new URLSearchParams(window.location.search).get("from") !== "property") return null;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SignPrefill>;
    if (!ownerUid || value.ownerUid !== ownerUid) return null;
    if (typeof value.name !== "string" || typeof value.link !== "string" || typeof value.backHref !== "string") return null;
    const wifi = value.wifi && typeof value.wifi.network === "string" && typeof value.wifi.password === "string" ? value.wifi : null;
    return { ownerUid, name: value.name, link: value.link, wifi, backHref: value.backHref };
  } catch {
    return null;
  }
}
