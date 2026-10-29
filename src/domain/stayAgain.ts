/* ---------------------------- Stay with us again ---------------------------
   A Host's own links on the in-stay wall: their booking site, or a page where
   a guest can join their list for a future stay. Hosts already do this with a
   framed poster and a stack of business cards, and repeat guests still rebook
   on the platform they came from, because the poster is on a wall and the
   phone is in their hand. The guest has the wall open for the Wi-Fi anyway.

   What the link says is the Host's to choose, and so is what the page behind
   it offers. Booking platforms set their own rules about steering guests off
   them — Airbnb's off-platform policy bans offering a discount for booking
   outside Airbnb — so the editor says so beside the fields, and DigiStayBook
   never writes "book direct and save" on a Host's behalf. Nothing a guest
   does here is collected by DigiStayBook: the link opens the Host's own page.

   Only on the in-stay wall: the guests reading it are the ones who stayed,
   and the public wall is often embedded on the Host's own site already.
   ----------------------------------------------------------------------- */

export type StayAgainLink = { label: string; url: string };

export const stayAgainLimits = {
  // Two: one to book, one to stay in touch. A third would be a menu.
  linksMax: 2,
  labelMax: 40,
  urlMax: 300
} as const;

/** What a Host is offered to start from; either can be reworded. */
export const stayAgainSuggestions: readonly StayAgainLink[] = [
  { label: "Book your next stay with us", url: "" },
  { label: "Join our guest list", url: "" }
];

export const emptyStayAgainLink = (): StayAgainLink => ({ label: "", url: "" });

/**
 * The address a link opens, or null when it is not one a guest's phone should
 * be sent to. Hosts type addresses the way they say them — "seabreeze.com.au"
 * — so a missing scheme is taken as https. Only https is accepted: a booking
 * or sign-up page asks for details, and an address with a username or password
 * in it is a trick rather than a website.
 */
export function readWebAddress(value: string): string | null {
  const typed = value.trim();
  if (!typed || typed.length > stayAgainLimits.urlMax || /\s/.test(typed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;
  let address: URL;
  try {
    address = new URL(withScheme);
  } catch {
    return null;
  }
  if (address.protocol !== "https:" || address.username || address.password) return null;
  // A real site has a dot in its name: "https://book" is a typo, not a site.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(address.hostname)) return null;
  return address.href.length > stayAgainLimits.urlMax ? null : address.href;
}

/** The address as a guest sees it under the label: no scheme, no trailing slash. */
export const displayWebAddress = (url: string): string =>
  url.replace(/^https:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

const linkIsEmpty = (link: StayAgainLink) => !link.label.trim() && !link.url.trim();

/**
 * Trim, drop empty rows and keep at most two. A valid address is stored in
 * its full form, so the wall never has to guess at a scheme; one that is not
 * valid is kept as typed, so the Host can see and fix it.
 */
export function normalizeStayAgainLinks(links: readonly StayAgainLink[]): StayAgainLink[] {
  return links
    .filter((link) => !linkIsEmpty(link))
    .slice(0, stayAgainLimits.linksMax)
    .map((link) => {
      const url = link.url.trim().slice(0, stayAgainLimits.urlMax);
      return { label: link.label.trim().slice(0, stayAgainLimits.labelMax), url: readWebAddress(url) ?? url };
    });
}

/** What is wrong with each kept row, by its position among the kept rows. */
export function stayAgainProblems(links: readonly StayAgainLink[]): { index: number; message: string }[] {
  const problems: { index: number; message: string }[] = [];
  links.filter((link) => !linkIsEmpty(link)).slice(0, stayAgainLimits.linksMax).forEach((link, index) => {
    if (!link.label.trim()) {
      problems.push({ index, message: "Say what the link is for, such as Book your next stay with us." });
    } else if (!link.url.trim()) {
      problems.push({ index, message: `Add the web address for ${link.label.trim()}.` });
    } else if (/^http:\/\//i.test(link.url.trim())) {
      problems.push({ index, message: "Use your page's secure address, starting https://." });
    } else if (!readWebAddress(link.url)) {
      problems.push({ index, message: "Use your page's full web address, such as seabreezecottage.com.au/book." });
    }
  });
  return problems;
}

/** The links worth drawing on a wall: labelled, with an address that opens. */
export const wallStayAgainLinks = (links: readonly StayAgainLink[]): StayAgainLink[] =>
  links
    .filter((link) => link.label.trim() && readWebAddress(link.url))
    .slice(0, stayAgainLimits.linksMax)
    .map((link) => ({ label: link.label.trim(), url: readWebAddress(link.url)! }));
