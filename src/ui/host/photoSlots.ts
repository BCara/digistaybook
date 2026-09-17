import {
  defaultHostNoteStyle,
  type HostNote,
  type PropertyPhoto,
  type PropertyProfile
} from "../../domain/propertyProfile";

/**
 * Where a photograph lives on a property, and how to reach it.
 *
 * This is the one thing the upload path, the forms and the wall canvas all
 * have to agree on, and none of it touches Firestore: a slot is a name for a
 * place on the profile, so it is decided here and read by whichever of them
 * needs it. Keeping it out of `propertyStore` also keeps it out of the mock
 * every page test puts in that module's place — a test that stubs the network
 * should not have to restate what a slot is.
 */

/**
 * The photograph slots a property carries. None is a gallery: each holds one
 * file. `cover` and `hostPhoto` are rendered on the walls, one note slot per
 * note the hosts have written is rendered on the note it belongs to, and
 * `avatar` is the property's own small photograph, shown beside its name in
 * the Host area.
 *
 * The first three are fields of the same name on the profile. A note's slot
 * names the note instead — `hostNote:{id}` — because the hosts write as many
 * as they have things to say, and a photograph has to follow its own note
 * rather than a position in a list that shifts the moment one above it goes.
 */
export type PhotoSlot = "cover" | "hostPhoto" | "avatar" | `hostNote:${string}`;

const NOTE_SLOT = "hostNote:";

/** The slot a note's photograph lives in. */
export const hostNoteSlot = (note: Pick<HostNote, "id">): `hostNote:${string}` =>
  `hostNote:${note.id}`;

/** The note a slot belongs to, or null for the property's own three. */
export const hostNoteOfSlot = (slot: PhotoSlot): string | null =>
  slot.startsWith(NOTE_SLOT) ? slot.slice(NOTE_SLOT.length) : null;

/** What is in a slot right now, wherever on the profile it is kept. */
export function photoInSlot(profile: PropertyProfile, slot: PhotoSlot): PropertyPhoto | null {
  const note = hostNoteOfSlot(slot);
  if (note === null) return profile[slot as "cover" | "hostPhoto" | "avatar"];
  return profile.hostNotes.find((entry) => entry.id === note)?.photo ?? null;
}

/**
 * The same profile with one slot changed, which is what a page renders next.
 *
 * A picture can land on a note the profile has never carried: a Host opens a
 * note on the form, drops a photograph on it and has not typed a word, so the
 * note itself has never been stored. The note is added with the picture on it
 * and nothing else, which is exactly what the upload wrote to the document.
 */
export function withPhotoInSlot(
  profile: PropertyProfile,
  slot: PhotoSlot,
  photo: PropertyPhoto | null
): PropertyProfile {
  let base = profile;
  if (slot === "avatar") {
    base = { ...base, avatar: photo, hostPhoto: photo };
  } else if (slot === "hostPhoto") {
    base = { ...base, hostPhoto: photo, avatar: photo };
  }

  const note = hostNoteOfSlot(slot);
  if (note === null) {
    if (slot === "avatar" || slot === "hostPhoto") return base;
    return { ...base, [slot]: photo };
  }
  if (!profile.hostNotes.some((entry) => entry.id === note)) {
    if (photo === null) return profile;
    const added: HostNote = { id: note, message: "", style: defaultHostNoteStyle, photo };
    return { ...profile, hostNotes: [...profile.hostNotes, added] };
  }
  return {
    ...profile,
    hostNotes: profile.hostNotes.map((entry) => (entry.id === note ? { ...entry, photo } : entry))
  };
}

/**
 * What a screen reader is read in place of each photograph.
 *
 * A Host used to be asked to describe every file they chose, and the box was
 * left empty nearly every time: they are looking at the photograph, and the
 * only thing the field stands between is them and their wall. The slot
 * already says what the photograph is of — a cover is the property, a portrait
 * is the hosts — so the description is written from that, and nobody is held
 * up by a sentence they were never going to write.
 *
 * It is deliberately plain. A guess at what is *in* the photograph would be
 * worse than the shape of it, because a wrong description is read out with the
 * same confidence as a right one.
 */
export function photoAlt(slot: PhotoSlot): string {
  if (hostNoteOfSlot(slot) !== null) return "A photograph from your hosts";
  return slot === "hostPhoto" ? "Your hosts" : "The property";
}
