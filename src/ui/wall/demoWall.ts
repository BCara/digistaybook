import type { GuestPost } from "../../domain/guestContribution";

/**
 * Demo content for the two public wall routes.
 *
 * Real properties load this from Firestore. The demo keeps it local so the
 * marketing routes render with no seeded project.
 *
 * Photographs are served from our own origin out of public/wall — they are
 * committed to the repo, not hotlinked, so the site still makes no third-party
 * request. Provenance and licence for every file are in
 * docs/demo-photo-credits.md.
 */

export const DEMO_SLUG = "demo-cottage";

export type WallPhoto = { src: string; alt: string; width: number; height: number };

const MEMORY_W = 880;
const MEMORY_H = 660;

function memoryPhoto(file: string, alt: string): WallPhoto {
  return { src: `/wall/${file}.webp`, alt, width: MEMORY_W, height: MEMORY_H };
}

export const wallPhotos = {
  coast: memoryPhoto("memory-coast", "A green clifftop above white water on the Cornish coast"),
  fire: memoryPhoto("memory-fire", "A log fire burning in a stone fireplace with armchairs drawn up to it"),
  garden: memoryPhoto("memory-garden", "A narrow path running through a cottage garden crowded with flowers"),
  tide: memoryPhoto("memory-tide", "Wet sand reflecting an orange sky on a wide beach at low tide"),
  evening: memoryPhoto("memory-evening", "A pink and red sunset over the sea, seen from the sand"),
  games: memoryPhoto("memory-games", "A Scrabble board and lit candles on a wooden table at night"),
  window: memoryPhoto("memory-window", "Daylight coming through a small window set deep in a thick white wall"),
  table: memoryPhoto("memory-table", "A long wooden table laid with linen, flowers and glasses for a group dinner")
} satisfies Record<string, WallPhoto>;

export type PhotoKey = keyof typeof wallPhotos;

export type WallPost = GuestPost & {
  /** Key into wallPhotos. Real posts carry an uploaded image instead. */
  photo?: PhotoKey;
  /** When they stayed, not when they posted — a guestbook reads by visit. */
  stayedOn: string;
};

export type WallProperty = {
  slug: string;
  name: string;
  location: string;
  monogram: string;
  cover: WallPhoto;
  hosts: string;
  hostInitials: string;
  hostSince: string;
  /** Shown on the public wall. Warm, and safe for anyone on the internet to read. */
  welcome: string;
};

export const demoProperty: WallProperty = {
  slug: DEMO_SLUG,
  name: "Seabreeze Cottage",
  location: "St Anthony's Head, Cornwall",
  monogram: "SC",
  cover: {
    src: "/wall/cover.webp",
    alt: "The granite front of Seabreeze Cottage, hung with fishing buoys and lined with potted flowers",
    width: 1500,
    height: 660
  },
  hosts: "Ana & Tom",
  hostInitials: "AT",
  hostSince: "Hosting here since 2019",
  welcome:
    "We bought the cottage the year our youngest left home, and we have been slowly putting it back together ever since. This is the wall our guests leave behind."
};

/**
 * House guidance. Deliberately kept off the public wall — it carries the Wi-Fi
 * password, the bin routine and the checkout arrangement, which only belong in
 * front of someone who is actually staying.
 */
export const houseEssentials = [
  { term: "Wi-Fi", detail: "SEABREEZE-5G", note: "Password is on the fridge magnet" },
  { term: "Bins", detail: "Tuesday night", note: "Green bin, by the side gate" },
  { term: "Checkout", detail: "10am", note: "Keys in the drawer. No need to strip the beds." },
  { term: "Heating", detail: "Dial in the hall", note: "It clunks for a minute, then settles" }
];

export const hostWelcome = {
  heading: "Welcome to the cottage",
  body: [
    "The kettle is on the side and there is milk in the fridge. Everything you need for the week is below, and the sunset from the back deck is worth waiting for.",
    "If something is not working, message us before you go hunting for it — we would rather fix it on day one than read about it later."
  ],
  tip: "Our favourite: the bakery behind the lighthouse. Go before 9am or the pasties are gone."
};

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export const demoPosts: WallPost[] = [
  {
    id: "memory-1",
    message:
      "We walked to the lighthouse every morning and stopped at the little bakery on the way back. Four days of sea air and we already want to come back.",
    displayName: "Mia & Sam",
    createdAt: daysAgo(3),
    stayedOn: "June 2026",
    visibility: "visible",
    pinned: false,
    photo: "coast"
  },
  {
    id: "memory-2",
    message: "Thank you for the log fire instructions taped inside the cupboard. Perfect first night after a five hour drive.",
    displayName: "The Aldridges",
    createdAt: daysAgo(9),
    stayedOn: "June 2026",
    visibility: "visible",
    pinned: false,
    photo: "fire"
  },
  {
    id: "memory-3",
    message:
      "Third year running. The garden is somehow better every time. The kids spent the entire week hunting for the frog by the pond and found him twice.",
    displayName: "Priya",
    createdAt: daysAgo(21),
    stayedOn: "May 2026",
    visibility: "visible",
    pinned: false,
    photo: "garden"
  },
  {
    id: "memory-4",
    message: "Tip for whoever stays next: the low tide walk out to the sandbar is worth setting an alarm for.",
    displayName: "Ellis",
    createdAt: daysAgo(34),
    stayedOn: "May 2026",
    visibility: "visible",
    pinned: false,
    photo: "tide"
  },
  {
    id: "memory-5",
    message:
      "We got engaged on the back deck on our last evening. Thank you for keeping it quiet when we asked, and for leaving the good glasses out.",
    displayName: "Jonah & Rae",
    createdAt: daysAgo(52),
    stayedOn: "April 2026",
    visibility: "visible",
    pinned: false,
    photo: "evening"
  },
  {
    id: "memory-6",
    message: "Rained for six days. Did not matter. There are more board games in that cupboard than in our house.",
    displayName: "The Okonjos",
    createdAt: daysAgo(71),
    stayedOn: "April 2026",
    visibility: "visible",
    pinned: false,
    photo: "games"
  },
  {
    id: "memory-7",
    message:
      "My mother stayed here in the eighties when it was her aunt's place. She sat in the window seat for an hour and did not say much. Thank you for looking after it.",
    displayName: "Cathy",
    createdAt: daysAgo(96),
    stayedOn: "March 2026",
    visibility: "visible",
    pinned: false,
    photo: "window"
  },
  {
    id: "memory-8",
    message: "Long table, nine of us, far too much crab. Best night of the year.",
    displayName: "Marek & family",
    createdAt: daysAgo(128),
    stayedOn: "February 2026",
    visibility: "visible",
    pinned: false,
    photo: "table"
  }
];

export function initials(displayName: string): string {
  const letters = displayName
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "G";
}

/**
 * Spreads avatars across four brand tones so the wall does not read as one
 * block of navy. FNV-1a, sampled from the high bits — the low bits of an FNV
 * hash correlate badly with a power-of-two modulus.
 */
export function toneIndex(seed: string): number {
  let hash = 0x811c9dc5;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 16) % 4;
}

/** Nudges each note off square so the wall reads as pinned paper, not a table. */
export function tiltIndex(seed: string): number {
  return (toneIndex(seed) + seed.length) % 3;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
