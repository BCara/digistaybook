import { useEffect, useState, type FormEvent } from "react";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { validatePropertyName } from "../../domain/property";
import {
  defaultHostNoteStyle,
  emptyProfile,
  sameProfileText,
  validateProfile,
  type HostNote,
  type PropertyProfile
} from "../../domain/propertyProfile";
import {
  loadWallCounts,
  savePropertyName,
  savePropertyProfile,
  type HostProperty,
  type WallCounts
} from "./propertyStore";
import { recallProperty } from "./propertyCache";
import { useProperty, type PropertyLoad } from "./useProperty";
import type { IdentityProblem } from "../../domain/property";
import type { ProfileProblem } from "../../domain/propertyProfile";

/**
 * The stored notes with the draft's photographs on them.
 *
 * A photograph is written the moment it uploads, and it is written against the
 * note it was chosen for, so the saved copy has to move with it or the page
 * would offer to save a picture that is already stored. Only the pictures
 * move: a note's words are saved by the button like every other line on the
 * wall. A note the stored property has never seen is added with the picture on
 * it and nothing else, which is exactly what the upload wrote.
 */
function mergeNotePhotos(stored: PropertyProfile, draft: PropertyProfile): HostNote[] {
  const known = new Set(stored.hostNotes.map((note) => note.id));
  const drafted = new Map(draft.hostNotes.map((note) => [note.id, note.photo]));
  return [
    ...stored.hostNotes.map((note) => (drafted.has(note.id) ? { ...note, photo: drafted.get(note.id)! } : note)),
    ...draft.hostNotes
      .filter((note) => !known.has(note.id) && note.photo !== null)
      .map((note) => ({ id: note.id, message: "", style: defaultHostNoteStyle, photo: note.photo }))
  ];
}

/**
 * One property, loaded once and edited as a draft.
 *
 * The reading, the draft and the single save live here rather than on the page
 * that renders them, so what saves, what is trimmed and what a failed write
 * leaves behind is decided once. Two pages edit a property — the wall canvas,
 * which types into the lines a guest reads, and the settings, which change
 * what the property is — and because both come through here, neither can be
 * the one showing a stale name.
 */

/**
 * Everything currently wrong with the draft: what the name rejects, what the
 * profile rejects, and the message from a write that failed. `failure` is the
 * server's, so validation clears it and a fresh failure clears validation —
 * a page never shows a stale reason beside a live one.
 */
export type EditorProblems = { identity: IdentityProblem[]; profile: ProfileProblem[]; failure: string | null };

// The read itself is `useProperty`; the type is re-exported from here because
// this is where the pages already reach for everything about a property load.
export type { PropertyLoad };

/**
 * What a page must render instead of the property: no environment, a read in
 * flight, a read that failed, a property that is not there, or one owned by
 * another account. Firestore already refuses another Host's property; the
 * ownership case is repeated here so a stale document cannot render as owned.
 */
export type PropertyBlock =
  | { kind: "loading"; title: string; message: string }
  | { kind: "blocked"; title: string; strong: string; message: string; alert: boolean; backHref: string; backLabel: string };

export const NO_PROBLEMS: EditorProblems = { identity: [], profile: [], failure: null };

export function propertyBlock(load: PropertyLoad, uid: string | undefined): PropertyBlock | null {
  if (!firebaseConfigured) {
    return {
      kind: "blocked",
      title: "Property unavailable",
      strong: "No Firebase environment is configured.",
      message: "The implementation deliberately fails closed instead of providing a local authentication bypass.",
      alert: false,
      backHref: "/",
      backLabel: "Back to home"
    };
  }

  if (load.status === "loading") {
    return { kind: "loading", title: "Loading property", message: "Fetching this property." };
  }

  if (load.status === "error") {
    return {
      kind: "blocked",
      title: "Property unavailable",
      strong: "We could not open that property.",
      message: load.message,
      alert: true,
      backHref: "/host",
      backLabel: "Back to your properties"
    };
  }

  if (load.status === "missing") {
    return {
      kind: "blocked",
      title: "Property not found",
      strong: "No property matches that address.",
      message: "It may have been removed, or the link may be wrong.",
      alert: false,
      backHref: "/host",
      backLabel: "Back to your properties"
    };
  }

  if (uid && load.property.ownerUid && load.property.ownerUid !== uid) {
    return {
      kind: "blocked",
      title: "Property unavailable",
      strong: "This property belongs to another host account.",
      message: "Sign in with the account that owns it to manage it.",
      alert: true,
      backHref: "/host",
      backLabel: "Back to your properties"
    };
  }

  return null;
}

export type PropertyDraft = {
  load: PropertyLoad;
  /** Null until the moderation count lands; `error` when it cannot be read. */
  counts: WallCounts | { error: string } | null;
  name: string;
  profile: PropertyProfile;
  problems: EditorProblems;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  setName: (name: string) => void;
  setProfile: (profile: PropertyProfile) => void;
  /**
   * The one save. It takes the form event when a form submitted it, and
   * nothing when the settings window's own button did.
   */
  save: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function usePropertyDraft(propertyId: string): PropertyDraft {
  // The draft starts as what was read, seeded in the same render the property
  // lands in: a Host must never see the wall arrive empty and fill in after.
  const [load, setLoad] = useProperty(propertyId, (property) => {
    setName(property.name);
    setDraft(property.profile);
  });
  const [counts, setCounts] = useState<WallCounts | { error: string } | null>(null);

  // The draft is what the preview and the canvas render, so a Host sees a
  // change before they commit it. Photographs are already stored by the time
  // they reach the draft.
  //
  // A property already read this session is on the screen in the first render,
  // so the draft is seeded from the same place rather than waiting for the
  // callback above: the fields a Host is editing must never arrive after the
  // property they belong to.
  const [name, setName] = useState(() => recallProperty(propertyId)?.name ?? "");
  const [draft, setDraft] = useState<PropertyProfile>(() => recallProperty(propertyId)?.profile ?? emptyProfile());
  const [problems, setProblems] = useState<EditorProblems>(NO_PROBLEMS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (load.status !== "ready") return;
    let cancelled = false;
    void (async () => {
      const outcome = await loadWallCounts(load.property.id);
      if (cancelled) return;
      setCounts(outcome.status === "ok" ? outcome.value : { error: outcome.message });
    })();
    return () => {
      cancelled = true;
    };
  }, [load.status, load.status === "ready" ? load.property.id : null]);

  const property = load.status === "ready" ? load.property : null;
  const dirty = property !== null && (name !== property.name || !sameProfileText(draft, property.profile));

  /**
   * A photograph is written to the property as it uploads, so when one arrives
   * the saved copy moves with the draft; otherwise the page would offer to
   * save a change that is already stored.
   */
  function setProfile(next: PropertyProfile) {
    setSaved(false);
    setDraft(next);
    // A note's photograph is stored against the note rather than the profile,
    // so it is compared note by note: everything else about a note is words,
    // and words are what the save button is for.
    const notePhoto = (profile: PropertyProfile, id: string) =>
      profile.hostNotes.find((note) => note.id === id)?.photo ?? null;
    const photoMoved =
      next.cover !== draft.cover ||
      next.hostPhoto !== draft.hostPhoto ||
      next.avatar !== draft.avatar ||
      next.hostNotes.some((note) => note.photo !== notePhoto(draft, note.id));
    if (property && photoMoved) {
      setLoad({
        status: "ready",
        property: {
          ...property,
          profile: {
            ...property.profile,
            cover: next.cover,
            hostPhoto: next.hostPhoto,
            avatar: next.avatar,
            // The upload wrote the picture against its note, and appended the
            // note itself if the document had never seen it, so the saved copy
            // says the same. What it does not take is the words beside it:
            // those are still unsaved, and the button still says so.
            hostNotes: mergeNotePhotos(property.profile, next)
          }
        }
      });
    }
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (saving || !property) return;
    setSaved(false);

    const identity = name === property.name ? [] : validatePropertyName(name);
    const profileProblems = validateProfile(draft);
    setProblems({ identity, profile: profileProblems, failure: null });
    if (identity.length > 0 || profileProblems.length > 0) return;

    setSaving(true);
    let next = property;

    if (name !== property.name) {
      const outcome = await savePropertyName(property.id, name);
      if (outcome.status === "error") {
        setSaving(false);
        setProblems({ ...NO_PROBLEMS, failure: outcome.message });
        return;
      }
      next = { ...next, name: outcome.value.name };
      setName(outcome.value.name);
    }

    if (!sameProfileText(draft, property.profile)) {
      const outcome = await savePropertyProfile(property.id, draft);
      if (outcome.status === "error") {
        setSaving(false);
        // A rename that already landed is kept, so the page does not report a
        // change it made as still pending.
        setLoad({ status: "ready", property: next });
        setProblems({ ...NO_PROBLEMS, failure: outcome.message });
        return;
      }
      // What comes back is what was written: trimmed, with blank rows dropped.
      const stored = {
        ...outcome.value,
        cover: draft.cover,
        hostPhoto: draft.hostPhoto
      };
      next = { ...next, profile: stored };
      setDraft(stored);
    }

    setSaving(false);
    setLoad({ status: "ready", property: next });
    setProblems(NO_PROBLEMS);
    setSaved(true);
  }

  return {
    load,
    counts,
    name,
    profile: draft,
    problems,
    saving,
    saved,
    dirty,
    setName: (value: string) => {
      setSaved(false);
      setName(value);
    },
    setProfile,
    save
  };
}
