import type { ReactElement } from "react";

/**
 * A small drawn mark beside each of the essentials.
 *
 * The essentials are the four or five lines a guest hunts for with a suitcase
 * still in their hand — the Wi-Fi, the bins, the hour they have to be out —
 * and until now the grid gave them nothing to aim at but four short words in
 * the same uppercase. A shape is quicker to find than a word is to read, so
 * each line carries one.
 *
 * The mark is decoration and nothing else: the label is written beside it in
 * the Host's own words, so the drawing is hidden from assistive technology and
 * adds nothing to what a screen reader announces. Same rule as the property
 * column's icons.
 *
 * Nothing here is a field a Host fills in. The label is free text — they write
 * "Bins" or "Rubbish" or "Recycling day" as their house says it — so the mark
 * is read off the words they typed, and a label this list does not recognise
 * gets the neutral mark rather than a wrong one. Guessing quietly is the whole
 * point: an essentials line should never become one more thing to configure.
 */

/** The marks this list can draw, plus the one it falls back to. */
export type EssentialMarkName =
  | "wifi"
  | "checkout"
  | "keys"
  | "bins"
  | "heating"
  | "water"
  | "parking"
  | "laundry"
  | "bed"
  | "screen"
  | "pets"
  | "quiet"
  | "help"
  | "home"
  | "book"
  | "note";

/**
 * The words that pick each mark, in the order they are tried.
 *
 * They are fragments rather than whole labels because a Host writes "Wi-Fi
 * password", "Checkout time" or "Bin day", not the bare noun. Order settles
 * the overlaps: a "water heater" is a water line before it is a heating one.
 */
const marks: readonly (readonly [EssentialMarkName, readonly string[]])[] = [
  ["wifi", ["wifi", "internet", "broadband"]],
  ["water", ["water", "shower", "bath", "plumb"]],
  ["heating", ["heat", "warm", "thermostat", "radiator", "boiler"]],
  ["checkout", ["checkout", "checkingout", "leaving", "departure", "depart", "lockup"]],
  ["keys", ["key", "checkin", "arrival", "arriving", "entry", "enter", "lock", "code", "door", "safe", "alarm"]],
  ["bins", ["bin", "rubbish", "recycl", "waste", "trash", "garbage"]],
  ["parking", ["park", "car", "drive", "garage"]],
  ["laundry", ["wash", "laundry", "dish", "dryer"]],
  ["bed", ["bed", "linen", "towel", "sleep", "cot"]],
  ["screen", ["tv", "television", "netflix", "remote"]],
  ["pets", ["dog", "cat", "pet", "animal"]],
  ["quiet", ["quiet", "noise", "neighbour", "neighbor", "music"]],
  ["help", ["break", "broken", "emergency", "help", "contact", "message", "problem", "wrong", "stuck", "question"]]
];

/**
 * The label, reduced to the letters and digits in it, so "Wi-Fi", "wi fi" and
 * "WiFi" are one word and the fragments above only have to be written once.
 */
const squash = (term: string): string => term.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which mark a label gets. Anything unrecognised gets the neutral one. */
export function essentialMarkName(term: string): EssentialMarkName {
  const word = squash(term);
  if (!word) return "note";
  const hit = marks.find(([, fragments]) => fragments.some((fragment) => word.includes(fragment)));
  return hit ? hit[0] : "note";
}

/**
 * The drawings themselves, on the same 20×20 grid and the same stroke weight
 * as the property column's marks, so a Host meets one hand throughout.
 */
const drawings: Record<EssentialMarkName, ReactElement> = {
  wifi: (
    <>
      <path d="M2.6 7.5a10.4 10.4 0 0 1 14.8 0M5.4 10.5a6.4 6.4 0 0 1 9.2 0M8.1 13.5a2.6 2.6 0 0 1 3.8 0" />
      <circle cx="10" cy="16.4" r=".9" />
    </>
  ),
  checkout: <path d="M11.4 3.2H4.6v13.6h6.8M9.4 10h7.4m-2.8-2.8L16.8 10l-2.8 2.8" />,
  keys: (
    <>
      <circle cx="13.2" cy="6.8" r="3.4" />
      <path d="m10.8 9.2-7.6 7.6v-2.2h2.2v-2.2h2.2l2-2" />
    </>
  ),
  bins: <path d="M4.2 6.2h11.6M8 6.2V4h4v2.2M5.8 6.2l.9 10.6h6.6l.9-10.6M8.6 9v5m2.8-5v5" />,
  heating: <path d="M10 2.8c2.4 2.6 4.4 4.6 4.4 7.4a4.4 4.4 0 0 1-8.8 0c0-1.5.6-2.8 1.6-3.9.1 1.3.8 2 1.6 2 1.1 0 1.6-1.5 1.2-5.5Z" />,
  water: <path d="M10 3.2c2.8 3.3 4.4 5.4 4.4 7.4a4.4 4.4 0 0 1-8.8 0c0-2 1.6-4.1 4.4-7.4Z" />,
  parking: (
    <>
      <path d="M3.4 13h13.2v-2.2l-1.4-.6-1.7-3.4H6.5L4.8 10.2l-1.4.6ZM4.8 10.2h10.4M6.6 13v1.8H4.8V13m10.4 0v1.8h-1.8V13" />
      <circle cx="6.9" cy="11.6" r=".7" />
      <circle cx="13.1" cy="11.6" r=".7" />
    </>
  ),
  laundry: (
    <>
      <path d="M4.4 3.4h11.2v13.2H4.4ZM4.4 6.8h11.2" />
      <circle cx="10" cy="11.8" r="3.2" />
    </>
  ),
  bed: <path d="M3 6.2V16m0-3.6h14V16m0-3.6V9.8a2 2 0 0 0-2-2H8.6v4.6M5.9 8.4a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" />,
  screen: <path d="M3.2 4.4h13.6v8.4H3.2ZM7.4 16.4h5.2m-2.6-3.6v3.6" />,
  pets: (
    <>
      <path d="M10 10.6c2.2 0 3.8 1.7 3.8 3.4 0 1.4-1 2.2-2.2 2.2-.7 0-1.1-.3-1.6-.3s-.9.3-1.6.3c-1.2 0-2.2-.8-2.2-2.2 0-1.7 1.6-3.4 3.8-3.4Z" />
      <circle cx="5.6" cy="9.4" r="1.7" />
      <circle cx="14.4" cy="9.4" r="1.7" />
      <circle cx="8.2" cy="5.9" r="1.7" />
      <circle cx="11.8" cy="5.9" r="1.7" />
    </>
  ),
  quiet: <path d="M15.6 12.4A6.8 6.8 0 0 1 7 3.6a6.8 6.8 0 1 0 8.6 8.8Z" />,
  help: <path d="M3.4 4.2h13.2v9.2H9.2l-4 3.2v-3.2H3.4Z" />,
  home: <path d="M3.4 9.2 10 3.6l6.6 5.6M5.2 7.8v8.6h3.6v-4.6h2.4v4.6h3.6V7.8" />,
  book: <path d="M10 5.6c-1.8-1.3-4-1.8-6.6-1.6v11.2c2.6-.2 4.8.3 6.6 1.6m0-11.2c1.8-1.3 4-1.8 6.6-1.6v11.2c-2.6-.2-4.8.3-6.6 1.6m0-11.2v11.2" />,
  note: (
    <>
      <circle cx="10" cy="10" r="6.6" />
      <path d="M10 13.4V9.6" />
      <circle cx="10" cy="7" r=".5" />
    </>
  )
};

/**
 * The mark for one essentials label, drawn at the size of the text beside it.
 * `name` picks a mark outright, for a link that is not one of the Host's lines.
 */
export function EssentialMark({ term, name, className = "essential-mark" }: { term: string; name?: EssentialMarkName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {drawings[name ?? essentialMarkName(term)]}
    </svg>
  );
}
