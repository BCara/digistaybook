/* ===========================================================================
   Where a wall lives, and how a Host puts it on their own site.

   The in-stay wall's address is encoded into a printed placard, so it lives
   beside the code that draws one (`qrCode.ts`). The public wall's address is
   the opposite kind of thing: it is copied, pasted into a listing, mailed to a
   guest and embedded in a Host's own website, and every one of those needs the
   same string built the same way.

   The embed is a route of its own rather than a flag on the wall, because an
   embedded wall is a different page: no site header, no site footer, and no
   demo ribbon, since inside someone else's website those are our furniture in
   their room. What it keeps is the attribution link (D-010) — inside a Host's
   own site that link is the whole point of the embed.
   ========================================================================= */

const site = (origin: string) => origin.replace(/\/+$/, "");

/** The wall a Host shares: the link itself, and the path behind it. */
export const publicWallPath = (slug: string) => `/wall/${slug}`;
export const publicWallUrl = (origin: string, slug: string) => `${site(origin)}${publicWallPath(slug)}`;

/** The same wall with the chrome taken off, for an iframe on a Host's site. */
export const embedWallPath = (slug: string) => `/embed/wall/${slug}`;
export const embedWallUrl = (origin: string, slug: string) => `${site(origin)}${embedWallPath(slug)}`;

/** Whether a path is the embedded rendering of a wall, and which wall. */
export function embeddedWallSlug(pathname: string): string | null {
  const prefix = "/embed/wall/";
  if (!pathname.startsWith(prefix)) return null;
  return pathname.slice(prefix.length).replace(/\/+$/, "") || null;
}

/** Attribute-safe: a property called `Tom & "The Barn"` must not break the tag. */
const attribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The snippet a Host pastes into their own page.
 *
 * It is written to be pasted rather than read: one element, no script, no
 * stylesheet, a fixed height a Host can change, and a title, because an
 * untitled iframe is a nameless region to anyone using a screen reader on
 * their site. `loading="lazy"` keeps a wall low down a Host's page from
 * costing them anything until it is scrolled to.
 */
export const wallEmbedCode = (origin: string, slug: string, propertyName: string): string =>
  [
    `<iframe src="${embedWallUrl(origin, slug)}"`,
    `        title="${attribute(`Memories left at ${propertyName}`)}"`,
    `        style="width:100%;height:800px;border:0"`,
    `        loading="lazy"></iframe>`
  ].join("\n");

/* ------------------------- The guestbook link ---------------------------
   The in-stay wall carries the Wi-Fi password and the lock-up routine, so
   its address cannot be the public one with a different first word. The slug
   is chosen by a Host, printed in listings and embedded on their own site;
   anyone holding it could otherwise read the house by swapping `/wall/` for
   `/stay/`. So the in-stay address carries a second segment the server mints
   and nobody can guess, and the wall without it is the public wall.

   It is minted once and never changes (D-012): it is printed into a placard,
   and a code that drifts is a card that scans to nothing.
   ---------------------------------------------------------------------- */

/** 16 random bytes as base64url: 22 characters, no padding, URL- and QR-safe. */
export const stayTokenPattern = /^[A-Za-z0-9_-]{22}$/;

export const isStayToken = (value: unknown): value is string =>
  typeof value === "string" && stayTokenPattern.test(value);

/**
 * The in-stay wall's path. Without a token this is still a real address —
 * it answers with the public wall — so a truncated or forwarded link lands
 * somewhere honest rather than on an error.
 */
export const stayWallPath = (slug: string, token?: string | null) =>
  isStayToken(token) ? `/stay/${slug}/${token}` : `/stay/${slug}`;

/**
 * Read a stay address back. The token is separated from the slug here rather
 * than at each call site so one definition decides what a guestbook link is.
 * A path with more than the two segments is not one.
 */
export function stayRoute(pathname: string): { slug: string; token: string | null } | null {
  const match = /^\/stay\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return null;
  return { slug: match[1], token: isStayToken(match[2]) ? match[2] : null };
}
