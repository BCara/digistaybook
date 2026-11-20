/* ===========================================================================
   Who is staying: the guests a Host has named, and when.

   The in-stay wall is one wall behind one printed code, so it cannot know who
   scanned it. What a Host can tell it is who is in the house on which nights,
   and the wall then greets whoever is there by name: "Welcome, Sarah & Tom".

   Three rules shape everything here.

   - The greeting must never outlive the stay. A name left up for the next
     guests is the worst thing this feature can do, so a stay is shown from
     midday on the day it starts until midday on the day it ends, and at no
     other time. An early arrival reads the ordinary welcome for an hour; a
     late one never reads somebody else's name.
   - Dates are calendar days in the house, not instants. A Host types them, a
     guest's phone standing in the hallway decides what "today" is, and no
     time zone is stored anywhere.
   - Names are first names and stays are short-lived. A stay that has ended is
     dropped the next time the list is saved and is never served to a wall.

   The list is stored at `profile.guestStays` but is deliberately not part of
   `PropertyProfile`: the wall editor saves a property's words field by field
   and has no business rewriting a list a Host changes every week from another
   page.
   ========================================================================= */

export type GuestStay = {
  id: string;
  /** How the guests are greeted: "Sarah & Tom", "the Hendersons". */
  names: string;
  /** The day they arrive, as YYYY-MM-DD in the property's own calendar. */
  arrives: string;
  /** The day they leave. */
  leaves: string;
  /** One optional line for these guests alone, shown above the arrival note. */
  note: string;
};

/** A stay as a wall is handed it: no id, and only ones near today. */
export type ServedStay = Omit<GuestStay, "id">;

export const guestStayLimits = {
  namesMax: 60,
  noteMax: 240,
  staysMax: 20,
  /** The hour a departing guest's greeting gives way to an arriving one's. */
  changeoverHour: 12,
  /** What a Host may paste for the quick-add to read. */
  pasteMax: 2000
} as const;

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day, written the way a date input writes it. */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !dayPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The calendar day on the device holding the wall. */
export function localDay(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function newGuestStayId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  const raw = uuid ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
}

export const emptyGuestStay = (): GuestStay => ({ id: newGuestStayId(), names: "", arrives: "", leaves: "", note: "" });

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.slice(0, max) : "");

/** Validated on read, like the rest of a property: a bad row is a blank one. */
export function readGuestStays(value: unknown): GuestStay[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, guestStayLimits.staysMax).map((entry, index) => {
    const stay = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    const id = text(stay.id, 24).replace(/[^a-zA-Z0-9]/g, "");
    return {
      id: id || `stay${index + 1}`,
      names: text(stay.names, guestStayLimits.namesMax),
      arrives: isDay(stay.arrives) ? stay.arrives : "",
      leaves: isDay(stay.leaves) ? stay.leaves : "",
      note: text(stay.note, guestStayLimits.noteMax)
    };
  });
}

const isBlank = (stay: GuestStay) => !stay.names.trim() && !stay.arrives && !stay.leaves && !stay.note.trim();

/**
 * What is written: trimmed, in the order the guests arrive, without the rows
 * nobody filled in and without the stays that are over. Dropping an ended
 * stay here is what keeps a guest's name from sitting in a property document
 * for years after they have gone home.
 */
export function normalizeGuestStays(stays: readonly GuestStay[], today: string = localDay()): GuestStay[] {
  return stays
    .filter((stay) => !isBlank(stay))
    .map((stay) => ({
      id: stay.id,
      names: stay.names.replace(/\s+/g, " ").trim().slice(0, guestStayLimits.namesMax),
      arrives: stay.arrives,
      leaves: stay.leaves,
      note: stay.note.replace(/\s+/g, " ").trim().slice(0, guestStayLimits.noteMax)
    }))
    .filter((stay) => !isDay(stay.leaves) || stay.leaves >= today)
    .sort((a, b) => a.arrives.localeCompare(b.arrives))
    .slice(0, guestStayLimits.staysMax);
}

export type GuestStayProblem = { index: number; field: "names" | "arrives" | "leaves"; message: string };

/**
 * What would greet the wrong people, or nobody. Checked against the list as
 * `normalizeGuestStays` leaves it, so an index here is a row on the screen.
 */
export function guestStayProblems(stays: readonly GuestStay[]): GuestStayProblem[] {
  const problems: GuestStayProblem[] = [];
  stays.forEach((stay, index) => {
    if (!stay.names.trim()) problems.push({ index, field: "names", message: "Add the names to greet, such as Sarah & Tom." });
    if (!isDay(stay.arrives)) problems.push({ index, field: "arrives", message: "Add the day they arrive." });
    if (!isDay(stay.leaves)) problems.push({ index, field: "leaves", message: "Add the day they leave." });
    else if (isDay(stay.arrives) && stay.leaves <= stay.arrives) {
      problems.push({ index, field: "leaves", message: "The day they leave must be after the day they arrive." });
    }
  });
  if (problems.length) return problems;
  // Two stays may share a changeover day and nothing more: a night claimed by
  // two sets of guests means one of them is greeted with the other's name.
  stays.forEach((stay, index) => {
    const clash = stays.findIndex((other, at) => at < index && other.leaves > stay.arrives && other.arrives < stay.leaves);
    if (clash >= 0) {
      problems.push({ index, field: "arrives", message: `These dates overlap with ${stays[clash]!.names}. Two stays can share a changeover day, but not a night.` });
    }
  });
  return problems;
}

/** Whether a stay is the one in the house at this moment. */
function inHouse(stay: ServedStay, day: string, hour: number): boolean {
  if (!isDay(stay.arrives) || !isDay(stay.leaves) || !stay.names.trim()) return false;
  const arrived = stay.arrives < day || (stay.arrives === day && hour >= guestStayLimits.changeoverHour);
  const stillHere = stay.leaves > day || (stay.leaves === day && hour < guestStayLimits.changeoverHour);
  return arrived && stillHere;
}

/**
 * The guests to greet right now, or nobody. `now` is the clock of the device
 * showing the wall, which is standing in the property.
 */
export function currentStay<T extends ServedStay>(stays: readonly T[] | null | undefined, now: Date = new Date()): T | null {
  if (!stays?.length) return null;
  const day = localDay(now);
  const here = stays.filter((stay) => inHouse(stay, day, now.getHours()));
  // Overlaps are refused when a Host saves, so more than one is a document
  // from somewhere else; the later arrival is the likelier to be in the house.
  return here.sort((a, b) => a.arrives.localeCompare(b.arrives)).at(-1) ?? null;
}

/** Where a stay stands for the Host reading their own list. */
export function stayState(stay: GuestStay, now: Date = new Date()): "now" | "upcoming" | "ended" | "unset" {
  if (!isDay(stay.arrives) || !isDay(stay.leaves)) return "unset";
  if (inHouse(stay, localDay(now), now.getHours())) return "now";
  return stay.leaves < localDay(now) || (stay.leaves === localDay(now) && stay.arrives < localDay(now)) ? "ended" : "upcoming";
}

/** The line the wall leads with. */
export const greetingFor = (names: string): string => `Welcome, ${names.trim()}`;

/** A day written for a person: "Fri 20 Nov". */
export function formatDay(day: string, locale?: string): string {
  if (!isDay(day)) return "";
  return new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}
