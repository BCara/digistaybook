/* ----------------------------- QR sign styles -----------------------------
   The free sign maker (/qr-sign-maker) prints the same card in eighteen
   looks. The card's content never changes with the look: a lead line, the
   property's name, the code, a line under it, the address the code opens,
   and the Wi-Fi code when there is one. Only the type, colour and the
   drawing or photograph around it change, so a code that reads on one style
   reads on all of them.

   Each style's id is also its public address (`?style=boho-arch`): Pins and
   links point straight at a look, so an id is never renamed once published.
   ----------------------------------------------------------------------- */

export type SignPhoto = {
  /** Print-weight file, used on the card itself. */
  src: string;
  /** Web-weight file, used for the small preview in the style picker. */
  thumb: string;
  alt: string;
};

export type SignStyle = {
  id: string;
  name: string;
  /** One line on the look, for the picker. */
  note: string;
  /** The line above the property name. */
  lead: string;
  /** Present on the styles built around a photograph; a visitor can swap in their own. */
  photo?: SignPhoto;
};

const photo = (file: string, thumb: string, alt: string): SignPhoto => ({ src: `/signs/${file}.webp`, thumb: `/wall/${thumb}.webp`, alt });

export const signStyles: readonly SignStyle[] = [
  { id: "coastal", name: "Coastal", note: "Sea blue with layered waves", lead: "Welcome to" },
  { id: "farmhouse", name: "Farmhouse", note: "Double frame and a script name", lead: "Welcome" },
  { id: "modern", name: "Modern minimal", note: "Heavy sans, left-aligned", lead: "Everything you need for your stay" },
  { id: "boho-arch", name: "Boho arch", note: "Terracotta arch on sand", lead: "welcome to" },
  { id: "botanical", name: "Botanical", note: "Sage with a laurel crest", lead: "Everything you need for your stay" },
  { id: "cabin", name: "Mountain cabin", note: "Forest green and a pine skyline", lead: "Everything you need for your stay" },
  { id: "mid-century", name: "Mid-century", note: "Mustard, teal and orange circles", lead: "Welcome to" },
  { id: "letterpress", name: "Classic letterpress", note: "Ivory with an oxblood double rule", lead: "Everything you need for your stay" },
  { id: "desert-sun", name: "Desert sun", note: "A setting sun over terracotta hills", lead: "Welcome to" },
  { id: "color-block", name: "Color block", note: "Bold red top, code on the seam", lead: "Everything you need for your stay" },
  { id: "chalkboard", name: "Chalkboard", note: "Slate in a wood frame, hand-lettered", lead: "Welcome!" },
  { id: "postcard", name: "Retro postcard", note: "Airmail border and a postmark", lead: "Greetings from" },
  { id: "photo-header", name: "Photo header", note: "Your photo across the top", lead: "Welcome to", photo: photo("cover", "cover", "A stone cottage with a garden") },
  { id: "polaroid", name: "Polaroid", note: "A tilted instant photo with a caption", lead: "", photo: photo("window", "memory-window", "A cottage window looking out on a field") },
  { id: "coast-photo", name: "Coastal photo", note: "Full-bleed photo behind a white card", lead: "Everything you need for your stay", photo: photo("coast", "memory-coast", "A rocky coastline under a pale sky") },
  { id: "sunset-photo", name: "Sunset photo", note: "Full-bleed photo with white type", lead: "Welcome to", photo: photo("evening", "memory-evening", "A beach at sunset") },
  { id: "collage", name: "Photo collage", note: "Three photos above the code", lead: "Everything you need for your stay", photo: photo("cover", "cover", "A stone cottage with a garden") },
  { id: "arch-photo", name: "Arch photo", note: "A photo framed in an arch", lead: "Welcome to", photo: photo("garden", "memory-garden", "A garden path lined with flowers") }
];

/** The collage's two smaller photos, which a visitor's own photo does not replace. */
export const collageExtras: readonly SignPhoto[] = [
  photo("fire", "memory-fire", "A stone fireplace with a fire lit"),
  photo("table", "memory-table", "A long table set for dinner")
];

export const defaultSignStyle = signStyles[0]!;

/** The style a `?style=` value names, or the first style for anything else. */
export function signStyleFor(id: string | null | undefined): SignStyle {
  return signStyles.find(style => style.id === id) ?? defaultSignStyle;
}

/** The demo guest wall, which the maker's code opens until a visitor gives their own link. */
export const DEMO_SIGN_LINK = "https://digistaybook.com/stay/demo-cottage";

/**
 * A link worth putting in a code: an http or https address, with the scheme
 * added when someone types a bare domain. Anything else is null, so the card
 * never carries a code that opens nothing.
 */
export function signLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** The address as printed under the code: no scheme, no trailing slash. */
export const spokenLink = (href: string) => href.replace(/^https?:\/\//, "").replace(/\/$/, "");
