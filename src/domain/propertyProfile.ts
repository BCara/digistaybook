/* ===========================================================================
   The property profile: everything a Host writes about a property.

   Identity (name, wall address, lifecycle, mode) lives in `property.ts` and is
   either written once or owned by the server. This module covers the opposite
   case — the content a Host edits freely and re-edits for years, and which the
   two wall routes read:

   - The display wall reads the location, the welcome and the hosts.
   - The in-stay wall reads those plus the arrival note and the house facts.

   The house facts carry the Wi-Fi password and the lock-up routine, so they
   are deliberately modelled apart from the public copy and are never rendered
   on the display wall.
   ========================================================================= */

import { defaultWallTheme, readWallTheme, type WallThemeId } from "./wallTheme";

/** One line of house guidance: what it is, the answer, and the detail. */
export type HouseFact = { term: string; detail: string; note: string };

/**
 * An uploaded image. `path` is the Cloud Storage object, kept so a replaced
 * photo can be deleted; `url` is what an `img` renders. Width and height are
 * measured at upload so a wall can reserve the space before the file arrives.
 */
export type PropertyPhoto = {
  path: string;
  url: string;
  alt: string;
  width: number;
  height: number;
};

/* ------------------------- The hosts' own notes -------------------------- */

/**
 * How one of the hosts' notes is fixed to the wall.
 *
 * Two varieties, not a palette. A Host is choosing how a note sits on the
 * paper their wall is already printed on — framed and squared to the page, or
 * tilted and pinned up among the memories — and neither carries a colour, a
 * face or a corner of its own. Both are drawn from the theme's own tokens, so
 * a note is the same stock as everything around it whichever one is picked.
 */
export type HostNoteStyle = "bordered" | "pinned";

/** What each variety is called, and how it sits when it is picked. */
export const hostNoteStyles: readonly { id: HostNoteStyle; name: string; note: string }[] = [
  {
    id: "bordered",
    name: "Bordered",
    note: "A framed card, squared to the page and lying flat on it."
  },
  {
    id: "pinned",
    name: "Pinned",
    note: "Tilted and pinned up, the way the memories around it are."
  }
];

/** The named variety, for a control that has to say which one is on. */
export const hostNoteStyle = (id: HostNoteStyle) =>
  hostNoteStyles.find((style) => style.id === id) ?? hostNoteStyles[0]!;

/** What a note is fixed with before anyone chooses. */
export const defaultHostNoteStyle: HostNoteStyle = "bordered";

const hostNoteStyleIds = new Set<string>(hostNoteStyles.map((style) => style.id));

/** A stored variety, or the default: an unknown one is a card, never nothing. */
export const readHostNoteStyle = (value: unknown): HostNoteStyle =>
  typeof value === "string" && hostNoteStyleIds.has(value) ? (value as HostNoteStyle) : defaultHostNoteStyle;

/**
 * One note from the hosts.
 *
 * The id is the note's own, and it is what a photograph is stored against: a
 * file is uploaded to `hostNote:{id}` while the words are still being typed,
 * so a position in the list would move the picture the moment a note above it
 * was removed. It is written to be safe in both places it is used — a
 * Firestore field path and a Storage object name — so it is letters and
 * digits and nothing else.
 */
export type HostNote = {
  id: string;
  message: string;
  style: HostNoteStyle;
  photo: PropertyPhoto | null;
};

/** An id for a new note: unique, and legal as a path segment either side. */
export function newHostNoteId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  const raw = uuid ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
}

export const emptyHostNote = (style: HostNoteStyle = defaultHostNoteStyle): HostNote => ({
  id: newHostNoteId(),
  message: "",
  style,
  photo: null
});

/**
 * Whether a note has anything on it. A photograph is enough on its own — a
 * picture of the place with nothing written under it is a note a Host might
 * well leave — so this asks whether there is anything to draw rather than
 * whether anything was typed.
 */
export const hostNoteHasContent = (note: HostNote): boolean =>
  note.message.trim().length > 0 || note.photo !== null;

export type PropertyProfile = {
  /**
   * The paper both walls are printed on. One theme per property: the two
   * walls are the same place seen from two doors, and a Host who could make
   * them look unrelated would be making a mistake rather than a choice.
   */
  theme: WallThemeId;
  /**
   * True when a Host has taken the display wall off this property altogether:
   * no shareable wall and nothing to embed. The words are kept, as with the
   * two switches below, because a Host who turns it back on should not have to
   * write their welcome a second time.
   *
   * The property nav keeps the row and marks it off rather than removing it:
   * the switch that turns the wall back on is on that page, and a row that
   * vanished would take its own way back with it.
   *
   * A property that has never touched this has a display wall, so only an
   * explicit `true` takes it away.
   */
  displayWallOff: boolean;
  /** Public. Where the property is, in the words a guest would use. */
  location: string;
  /** Public. The paragraph under the property name on the display wall. */
  welcome: string;
  /** Public. Who the hosts are, as guests address them: "Ana & Tom". */
  hosts: string;
  /** Public. How long they have been hosting here. */
  hostSince: string;
  /** In-stay only. The heading over the arrival note. */
  stayHeading: string;
  /** In-stay only. The arrival note itself; blank lines separate paragraphs. */
  stayWelcome: string;
  /** In-stay only. One recommendation, set apart from the note. */
  stayTip: string;
  /**
   * In-stay only. True when a Host has taken the whole note off the wall. The
   * note is on by default, so a document written before this existed keeps
   * its words; the words themselves are kept when it is turned off, because a
   * Host who changes their mind should not have to write the note twice.
   */
  stayNoteOff: boolean;
  /**
   * Public. The hosts' own notes, above the memories on both walls.
   *
   * They are not the arrival note: that is a welcome addressed to whoever has
   * just let themselves in, and it is read once, at the top of the in-stay
   * wall. These are the extra things the hosts want said — the fire, the
   * walk to the beach, the bakery that opens at seven — and they are read by
   * anyone who opens either wall.
   *
   * There is a list of them rather than one, because a Host with two things
   * to say was writing both into one paragraph. Each carries its own words,
   * its own photograph and how it is fixed to the wall, and every one of them
   * is signed with the hosts' names and their photograph, which is what tells
   * a reader whose notes these are without a label saying so.
   *
   * Empty is the ordinary state: a property has no note of its own until a
   * Host writes one, so an absence needs no flag the way the arrival note and
   * the house guidance do.
   */
  hostNotes: HostNote[];
  /** In-stay only. Wi-Fi, bins, checkout — the questions a host answers weekly. */
  facts: HouseFact[];
  /**
   * In-stay only. True when a Host has taken the house guidance off the wall
   * altogether. The guidance is on by default, so a document written before
   * this existed keeps its lines; the lines themselves are kept when it is
   * turned off, because turning it back on should not cost a Host their
   * Wi-Fi password twice.
   */
  factsOff: boolean;
  guestPrompt: string;
  /** Public. The photograph at the top of both walls. */
  cover: PropertyPhoto | null;
  /**
   * The property's own small photograph: what identifies it beside its name
   * in the Host area, the way a face identifies a person. It is not the cover
   * — that is the wide picture across the top of the walls — and it is not on
   * a guest's wall at all.
   */
  avatar: PropertyPhoto | null;
  /** Public. The hosts' own photograph, shown beside their names. */
  hostPhoto: PropertyPhoto | null;
};

export const profileLimits = {
  locationMax: 80,
  welcomeMax: 400,
  hostsMax: 60,
  hostSinceMax: 60,
  stayHeadingMax: 80,
  stayWelcomeMax: 1200,
  stayTipMax: 240,
  // A note on the wall, not an essay pinned to it: the cards around it are a
  // few sentences a guest wrote standing in a hallway, and one that ran to a
  // page would stop reading as one of them.
  hostNoteMax: 600,
  // Notes, not a second wall of them: what a Host has to say beside the
  // memories is a handful of things, and a column of ten would be the hosts
  // talking over their guests on the guests' own wall.
  hostNotesMax: 4,
  factsMax: 8,
  factTermMax: 32,
  factDetailMax: 60,
  factNoteMax: 140,
  altMax: 120,
  photoBytesMax: 8 * 1024 * 1024,
  photoTypes: ["image/jpeg", "image/png", "image/webp"] as const
} as const;

export const emptyFact = (): HouseFact => ({ term: "", detail: "", note: "" });

/**
 * Whether this property has a display wall at all.
 *
 * Read it rather than the flag: the flag is negative because the wall is on by
 * default and a stored `false` should mean nothing, but every caller is asking
 * the positive question — does this property have a wall to show, is there an
 * address worth copying, and does the banner offer a way into it.
 */
export const hasDisplayWall = (profile: PropertyProfile): boolean => !profile.displayWallOff;

/** The notes with something on them, which is what a wall draws. */
export const writtenHostNotes = (profile: PropertyProfile): HostNote[] =>
  profile.hostNotes.filter(hostNoteHasContent);

export const emptyProfile = (): PropertyProfile => ({
  theme: defaultWallTheme,
  displayWallOff: false,
  location: "",
  welcome: "",
  hosts: "",
  hostSince: "",
  stayHeading: "",
  stayWelcome: "",
  stayTip: "",
  stayNoteOff: false,
  hostNotes: [],
  facts: [],
  factsOff: false,
  guestPrompt: "",
  cover: null,
  avatar: null,
  hostPhoto: null
});

/**
 * The arrival note shown as an example, not as text a property is created with.
 *
 * A wall with nothing written on it is the hardest thing to start: a Host
 * opens the property view, meets a blank sheet, and has to invent both what to
 * say and the voice to say it in. So the fields show a note already written —
 * plain, true of nearly every property, and short enough to be worth copying.
 *
 * It is a placeholder and nothing more: it is never stored, so a Host who
 * types nothing has a property with no arrival note on it, and what a guest
 * reads is only ever what a Host wrote.
 */
export const exampleNote = {
  heading: "Welcome, make yourself at home",
  welcome: [
    "We are glad you found the place. Everything you need should be to hand, we have added some essential information below but if you get stuck feel free to message.",
    "Before you go, we would appreciate if you would add a memory to the wall."
  ].join("\n\n")
} as const;

/* ------------------------------- Reading -------------------------------- */

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

const size = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

function readPhoto(value: unknown): PropertyPhoto | null {
  if (typeof value !== "object" || value === null) return null;
  const photo = value as Record<string, unknown>;
  // A record without a URL cannot be rendered, so it reads as no photo rather
  // than as a broken image on a guest's phone.
  if (typeof photo.url !== "string" || !photo.url) return null;
  return {
    path: text(photo.path, 300),
    url: photo.url,
    alt: text(photo.alt, profileLimits.altMax),
    width: size(photo.width),
    height: size(photo.height)
  };
}

/**
 * The hosts' notes, from whichever shape the document is in.
 *
 * A property written before there were several carries one note in `hostNote`
 * and its picture in `hostNotePhoto`, so that pair is read as the first note
 * when no list is stored. The migration is on read alone: the moment a Host
 * saves, the list is written and the two old fields are never consulted again.
 */
function readHostNotes(data: Record<string, unknown>): HostNote[] {
  if (Array.isArray(data.hostNotes)) {
    return data.hostNotes
      .slice(0, profileLimits.hostNotesMax)
      .map((entry, index) => {
        const note = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
        // An id is written with every note, so a missing one is a document
        // half written rather than an older one: it is given a place in the
        // list rather than dropped, because the words are what matter.
        const id = text(note.id, 24).replace(/[^a-zA-Z0-9]/g, "");
        return {
          id: id || `note${index + 1}`,
          message: text(note.message, profileLimits.hostNoteMax),
          style: readHostNoteStyle(note.style),
          photo: readPhoto(note.photo)
        };
      });
  }

  const message = text(data.hostNote, profileLimits.hostNoteMax);
  const photo = readPhoto(data.hostNotePhoto);
  if (!message.trim() && !photo) return [];
  return [{ id: "note1", message, style: defaultHostNoteStyle, photo }];
}

function readFacts(value: unknown): HouseFact[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, profileLimits.factsMax).map((entry) => {
    const fact = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    return {
      term: text(fact.term, profileLimits.factTermMax),
      detail: text(fact.detail, profileLimits.factDetailMax),
      note: text(fact.note, profileLimits.factNoteMax)
    };
  });
}

/**
 * Documents are validated on read rather than trusted: a profile written by an
 * older build, or half written, must render as a partly filled form rather
 * than crash a page a Host relies on.
 */
export function readProfile(value: unknown): PropertyProfile {
  if (typeof value !== "object" || value === null) return emptyProfile();
  const data = value as Record<string, unknown>;
  return {
    theme: readWallTheme(data.theme),
    // Only an explicit `true` takes the display wall away, so an older
    // document, a missing field or a corrupted one keeps its wall.
    displayWallOff: data.displayWallOff === true,
    location: text(data.location, profileLimits.locationMax),
    welcome: text(data.welcome, profileLimits.welcomeMax),
    hosts: text(data.hosts, profileLimits.hostsMax),
    hostSince: text(data.hostSince, profileLimits.hostSinceMax),
    stayHeading: text(data.stayHeading, profileLimits.stayHeadingMax),
    stayWelcome: text(data.stayWelcome, profileLimits.stayWelcomeMax),
    stayTip: text(data.stayTip, profileLimits.stayTipMax),
    // As with factsOff: only an explicit `true` takes the note off, so an
    // older document, a missing field or a corrupted one leaves it on.
    stayNoteOff: data.stayNoteOff === true,
    hostNotes: readHostNotes(data),
    facts: readFacts(data.facts),
    // Only an explicit `true` turns the guidance off, so anything else — a
    // missing field, an older document, a corrupted one — leaves it on.
    factsOff: data.factsOff === true,
    guestPrompt: text(data.guestPrompt, 240),
    cover: readPhoto(data.cover),
    avatar: readPhoto(data.avatar),
    hostPhoto: readPhoto(data.hostPhoto)
  };
}

/* ------------------------------ Validating ------------------------------ */

export type ProfileField =
  | "location"
  | "welcome"
  | "hosts"
  | "hostSince"
  | "stayHeading"
  | "stayWelcome"
  | "stayTip"
  | "facts";

export type ProfileProblem = { field: ProfileField; index?: number; message: string };

/** Blank rows are how an empty form looks; they are dropped, not rejected. */
const factIsEmpty = (fact: HouseFact) => !fact.term.trim() && !fact.detail.trim() && !fact.note.trim();

/**
 * Trim, drop the empty house-fact rows, and cap everything at its limit. The
 * form and the store both go through this, so what is validated is exactly
 * what is written.
 */
export function normalizeProfile(profile: PropertyProfile): PropertyProfile {
  return {
    theme: profile.theme,
    displayWallOff: profile.displayWallOff,
    location: profile.location.trim().slice(0, profileLimits.locationMax),
    welcome: profile.welcome.trim().slice(0, profileLimits.welcomeMax),
    hosts: profile.hosts.trim().slice(0, profileLimits.hostsMax),
    hostSince: profile.hostSince.trim().slice(0, profileLimits.hostSinceMax),
    stayHeading: profile.stayHeading.trim().slice(0, profileLimits.stayHeadingMax),
    // Paragraph breaks are meaningful in the arrival note, so only the ends are
    // trimmed and runs of blank lines collapse to a single break.
    stayWelcome: profile.stayWelcome.replace(/\n{3,}/g, "\n\n").trim().slice(0, profileLimits.stayWelcomeMax),
    stayTip: profile.stayTip.trim().slice(0, profileLimits.stayTipMax),
    stayNoteOff: profile.stayNoteOff,
    // Cards on a wall of cards, so each is a block of prose like the notes
    // beside it: the ends are trimmed and runs of blank lines collapse, the
    // same treatment the arrival note gets. A note with neither words nor a
    // photograph is how an opened one looks before it is written, so it is
    // dropped rather than stored as a blank card on a guest's wall.
    hostNotes: profile.hostNotes
      .map((note) => ({
        id: note.id,
        message: note.message.replace(/\n{3,}/g, "\n\n").trim().slice(0, profileLimits.hostNoteMax),
        style: note.style,
        photo: note.photo
      }))
      .filter(hostNoteHasContent)
      .slice(0, profileLimits.hostNotesMax),
    facts: profile.facts
      .filter((fact) => !factIsEmpty(fact))
      .slice(0, profileLimits.factsMax)
      .map((fact) => ({
        term: fact.term.trim().slice(0, profileLimits.factTermMax),
        detail: fact.detail.trim().slice(0, profileLimits.factDetailMax),
        note: fact.note.trim().slice(0, profileLimits.factNoteMax)
      })),
    factsOff: profile.factsOff,
    guestPrompt: profile.guestPrompt.trim().slice(0, 240),
    cover: profile.cover,
    avatar: profile.avatar,
    hostPhoto: profile.hostPhoto
  };
}

/**
 * Every text field is optional — a Host fills a property in over days, and a
 * half-written profile must be savable. What is rejected is a house fact that
 * would render as a dangling label or an unexplained value, because that is
 * what a guest would be left reading.
 */
export function validateProfile(profile: PropertyProfile): ProfileProblem[] {
  // Guidance that is off the wall is read by nobody, so a half-written line in
  // it cannot strand a Host on a page they are trying to leave. It is checked
  // again the moment they put the guidance back.
  if (profile.factsOff) return [];

  const kept = profile.facts.filter((fact) => !factIsEmpty(fact));
  const problems: ProfileProblem[] = [];

  kept.slice(0, profileLimits.factsMax).forEach((fact, index) => {
    if (!fact.term.trim()) {
      problems.push({ field: "facts", index, message: "Give this line a label, such as Wi-Fi or Checkout." });
      return;
    }
    if (!fact.detail.trim()) {
      problems.push({ field: "facts", index, message: `Add the answer guests need for ${fact.term.trim()}.` });
    }
  });

  if (kept.length > profileLimits.factsMax) {
    problems.push({
      field: "facts",
      message: `Keep house guidance to ${profileLimits.factsMax} lines so it stays readable on a phone.`
    });
  }

  return problems;
}

/**
 * Whether two profiles carry the same words. Photographs are excluded: they
 * save as they upload, so an uploaded cover must not leave a Host looking at
 * an enabled "Save changes" button with nothing left to save.
 */
export function sameProfileText(a: PropertyProfile, b: PropertyProfile): boolean {
  const words = (profile: PropertyProfile) => {
    const {
      cover: _cover,
      avatar: _avatar,
      hostPhoto: _hostPhoto,
      hostNotes,
      ...text
    } = normalizeProfile(profile);
    // A note is words with a picture on it, so the words are compared and the
    // picture is not: a photograph uploaded onto a note is stored as it
    // lands, and counting it here would leave a Host looking at a "Save
    // changes" button with nothing left to save.
    return JSON.stringify({
      ...text,
      hostNotes: hostNotes.map(({ photo: _photo, ...note }) => note)
    });
  };
  return words(a) === words(b);
}

/** Only images, and only ones a phone can actually load. */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!(profileLimits.photoTypes as readonly string[]).includes(file.type)) {
    return "Choose a JPEG, PNG or WebP image.";
  }
  if (file.size > profileLimits.photoBytesMax) {
    return `That image is larger than ${Math.round(profileLimits.photoBytesMax / (1024 * 1024))}MB. Choose a smaller one.`;
  }
  return null;
}

/* ------------------------------- Readiness ------------------------------ */

/**
 * What is still missing before this property is worth a guest's scan.
 *
 * A property starts as a name and nothing else, so without this a Host is left
 * guessing why their wall looks unfinished. Every item is something a wall
 * actually renders. It is guidance, not a gate: going live stays server-owned.
 */
export type SetupStep = { id: string; label: string; hint: string; done: boolean };

export function setupSteps(profile: PropertyProfile): SetupStep[] {
  return [
    {
      id: "location",
      label: "Where the property is",
      hint: "Shown under the name on the display wall.",
      // The two lines below it are the display wall's alone, so a property
      // without one has decided about them rather than left them missing.
      done: profile.displayWallOff || profile.location.trim().length > 0
    },
    {
      id: "welcome",
      label: "A welcome for the display wall",
      hint: "The paragraph that introduces the place to anyone who opens the link.",
      done: profile.displayWallOff || profile.welcome.trim().length > 0
    },
    {
      id: "hosts",
      label: "Who is hosting",
      hint: "The names guests use for you.",
      done: profile.hosts.trim().length > 0
    },
    {
      id: "cover",
      label: "A cover photo",
      hint: profile.displayWallOff
        ? "The photograph at the top of the in-stay wall."
        : "The photograph at the top of both walls.",
      done: profile.cover !== null
    },
    {
      id: "stayWelcome",
      label: "An arrival note",
      hint: "What guests read first after scanning the QR display.",
      // As with the guidance below: deliberately left off the wall counts as
      // decided, not as missing.
      done: profile.stayNoteOff || profile.stayWelcome.trim().length > 0
    },
    {
      id: "facts",
      label: "House guidance",
      hint: "Wi-Fi, bins, checkout — the questions you answer every week.",
      // Deliberately left off the wall counts as decided, not as missing.
      done: profile.factsOff || profile.facts.some((fact) => fact.term.trim() && fact.detail.trim())
    }
  ];
}

export function setupProgress(profile: PropertyProfile): { done: number; total: number; complete: boolean } {
  const steps = setupSteps(profile);
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}

/* ------------------------------ Suggestions ----------------------------- */

/**
 * The lines almost every property answers, offered as labels a Host fills the
 * answer into rather than as questions they have to think of.
 *
 * They are suggestions, not defaults: nothing is written to a property until a
 * Host picks one. Writing them in as empty rows would leave every new property
 * carrying seven labels with no answers, which is exactly the thing
 * `validateProfile` refuses to put in front of a guest.
 *
 * Picking one writes the whole line — `term`, `detail` and `note` — so the
 * line is on the wall from that moment and a Host edits an answer rather than
 * meeting an empty field. The example answer is a starting point they are
 * expected to correct, not a fact about their property. `factExample` serves
 * the same strings as placeholder text for a label typed by hand.
 */
export type FactSuggestion = { term: string; detail: string; note: string };

export const factSuggestions: readonly FactSuggestion[] = [
  { term: "Wi-Fi", detail: "SEABREEZE-5G", note: "Password is on the fridge magnet" },
  { term: "Checkout", detail: "10am", note: "Leave the key in the safe and pull the door to" },
  { term: "Bins", detail: "Thursday morning", note: "Green lid for recycling, black for the rest" },
  { term: "Heating", detail: "Dial in the hall", note: "It takes an hour to come through" },
  { term: "Hot water", detail: "On all day", note: "The shower runs hot after a minute" },
  { term: "Parking", detail: "Two cars, on the gravel", note: "Please leave the lane clear" },
  { term: "If something breaks", detail: "Message us first", note: "We would rather fix it than have you go without" }
];

/** The suggestions a property has not used yet, matched on the label. */
export function unusedFactSuggestions(facts: HouseFact[]): FactSuggestion[] {
  const used = new Set(facts.map((fact) => fact.term.trim().toLowerCase()).filter(Boolean));
  return factSuggestions.filter((suggestion) => !used.has(suggestion.term.toLowerCase()));
}

/** The example answer for a line, so a known label prompts with a real one. */
export function factExample(term: string): { detail: string; note: string } {
  const match = factSuggestions.find(
    (suggestion) => suggestion.term.toLowerCase() === term.trim().toLowerCase()
  );
  return match ? { detail: match.detail, note: match.note } : { detail: "SEABREEZE-5G", note: "Password is on the fridge magnet" };
}

/** Paragraphs for a wall to render, from the one field a Host types into. */
export const welcomeParagraphs = (stayWelcome: string): string[] =>
  stayWelcome.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

/** Two letters for the avatar shown beside the hosts' names when they have no photo. */
export function hostInitials(hosts: string): string {
  const letters = hosts
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !["and", "the", "of"].includes(word.toLowerCase()))
    .map((word) => word[0]?.toUpperCase() ?? "");
  return letters.slice(0, 2).join("") || "•";
}
