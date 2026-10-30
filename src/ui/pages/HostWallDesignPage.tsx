import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { propertyIdentityLimits } from "../../domain/property";
import {
  emptyFact,
  emptyHostNote,
  exampleNote,
  factExample,
  hostInitials,
  profileLimits,
  validatePhotoFile,
  unusedFactSuggestions,
  type HostNote,
  type HouseFact,
  type PropertyProfile,
} from "../../domain/propertyProfile";
import { emptyStayAgainLink, stayAgainLimits, stayAgainSuggestions, type StayAgainLink } from "../../domain/stayAgain";
import { isPostMvpFeatureEnabled } from "../../domain/featureFlags";
import { useAuth } from "../auth/AuthProvider";
import { CameraMark } from "../host/CameraMark";
import { ActionDisclosure } from "../ActionDisclosure";

import { PropertySettingsDialog } from "../host/PropertyDialog";
import { navigate } from "../routing";
import { CanvasLine, CanvasParagraph } from "../host/CanvasFields";
import { HostNoteStylePicker } from "../host/HostNoteStylePicker";
import { PropertyShell } from "../host/PropertyShell";
import { stayWallPath } from "../../domain/wallAddress";
import { WallPreview } from "../host/WallPreview";
import { memoriesHeading } from "../wall/memoryHeading";
import { EssentialMark, essentialMarkName } from "../wall/EssentialMark";
import { StayEssentialLinks } from "../wall/WallHeader";
import { WallThemePicker } from "../host/WallThemePicker";
import { wallTheme } from "../../domain/wallTheme";
import type { HostProperty, WallCounts } from "../host/propertyStore";
import { uploadPropertyPhoto } from "../host/propertyStore";
import {
  hostNoteOfSlot,
  hostNoteSlot,
  photoInSlot,
  withPhotoInSlot,
  type PhotoSlot,
} from "../host/photoSlots";
import { propertyBlock, usePropertyDraft } from "../host/usePropertyDraft";
import { MobileWallEditor } from "../host/MobileWallEditor";
import "./hostWallEditor.css";

/**
 * A wall of the property, laid out as the guest meets it, and written into
 * directly.
 *
 * This is the guest wall, the one behind the QR display, at the property's own
 * address. The public page used to be a second view of this page with its own
 * header to write, and a Host changing the cover there was changing it here
 * without being told. It is built from this wall now and shared from the QR
 * page, so there is one wall to write.
 *
 * The page *is* the wall, at the size
 * a Host is actually sitting at: every line a guest reads is the field that
 * sets it. The cover runs across the top with its upload on it, the hosts'
 * photograph sits under it, and the arrival note and the essentials are typed
 * where they will appear.
 *
 * It replaced a list of collapsed forms that stood beside a phone-sized
 * preview and asked a Host to imagine the join. That is what the list did
 * badly, so this page states the difference rather than pretending to be a
 * phone: a guest holds the wall on a phone, a Host builds it on a laptop.
 *
 * The part a Host does not write — the memories guests leave — is still drawn,
 * greyed and labelled, because a wall with the guests' half missing is not the
 * thing being previewed. The hosts' own card stands among those shapes and is
 * the one thing there that is real, because it is the one thing there that is
 * theirs to write.
 */

/** What a phone shows: the list of the wall's parts, the wall to edit, or the guest's view. */
type MobileMode = "sections" | "edit" | "preview";

/** One row of the phone's list of the guest wall's parts. */
type WallSection = {
  /** The element on the wall the row lands on, or "style" for the look. */
  id: string;
  title: string;
  detail: string;
  state: "done" | "todo" | "off" | "optional";
  optional?: boolean;
};

/** The profile's plain-text lines: the ones a Host can leave off the wall. */
type TextField = "stayHeading" | "stayWelcome" | "stayTip";

/**
 * The prompts a Host can choose without writing one. Anything else in the
 * field is a prompt they wrote themselves, which is what puts the box to
 * write it in on the page.
 */
const promptPresets = [
  "",
  "What was your favourite memory of this stay?",
  "What would you recommend to the next guests?",
];

/**
 * The control that takes one line, or the whole note, off the wall. It is
 * quiet until the line it belongs to is hovered or it is tabbed to, because on
 * a page that is meant to read as the finished wall a row of remove buttons is
 * the loudest thing on it.
 */
function Omit({
  label,
  onClick,
  disabled,
  iconOnly = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={`canvas-omit${iconOnly ? " canvas-omit-icon" : ""}`}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {iconOnly ? <span aria-hidden="true">×</span> : label}
    </button>
  );
}

/** The offer to put a line back, in the place the line would be. */
function Include({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="canvas-include"
      onClick={onClick}
      disabled={disabled}
    >
      + {label}
    </button>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Host control centre</p>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

/** The strip of guest chrome a Host cannot type into, said once per place. */
function GuestOnly({ children }: { children: ReactNode }) {
  return <p className="canvas-guest-note">{children}</p>;
}

function MemoryChrome({
  property,
  counts,
  invitation,
  children,
}: {
  property: HostProperty;
  counts: WallCounts | { error: string } | null;
  invitation: string;
  children?: ReactNode;
}) {
  // A wall with nothing on it says so, in the words the phone beside it and
  // the wall itself use; the shapes below already say where the notes will go.
  const heading = memoriesHeading(
    counts !== null && !("error" in counts) ? counts.visible : null,
  );

  return (
    <section className="canvas-memories wall-memories" aria-label="Memories from guests">
      <h2 className="wall-heading">{heading}</h2>
      {children}
      {/* Guests' notes cannot be shown here — they are read on the wall and
          judged on the moderation page — so what stands in for them is drawn
          the way the wall draws them: paper, lifted, faintly askew, signed.
          A flat grey block would read as something still loading. */}
      <div className="canvas-notes">
        {[3, 2].map((lines, ghost) => (
          <div
            className={`canvas-note-ghost tilt-${ghost}`}
            aria-hidden="true"
            key={ghost}
          >
            <span className="canvas-ghost-lines">
              {Array.from({ length: lines }, (_, line) => (
                <i key={line} />
              ))}
            </span>
            <span className="canvas-ghost-sign">
              <span className="canvas-ghost-avatar" />
              <span className="canvas-ghost-author">
                <i />
                <i />
              </span>
            </span>
          </div>
        ))}
      </div>
      <GuestOnly>
        {invitation}{" "}
        <a
          className="text-link"
          href={`/host/inbox?property=${property.id}`}
        >
          Moderate what guests leave &rarr;
        </a>
      </GuestOnly>
    </section>
  );
}

export function HostWallDesignPage({
  propertyId,
  settings = false,
}: {
  propertyId: string;
  /**
   * Whether the settings window stands open over this wall. Settings is not a
   * screen of its own any more: it is this screen with the property's own
   * questions in front of it, so a Host who changes the name watches the wall
   * behind the window change with it, and closing the window puts them back
   * where they were rather than on a page they have to navigate out of.
   */
  settings?: boolean;
}) {
  const { user } = useAuth();
  const draft = usePropertyDraft(propertyId);

  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [portraitProgress, setPortraitProgress] = useState(0);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;

  const noteInput = useRef<HTMLInputElement>(null);
  const noteTarget = useRef<string | null>(null);
  const [noteBusy, setNoteBusy] = useState<string | null>(null);
  const [noteProgress, setNoteProgress] = useState(0);
  const [noteError, setNoteError] = useState<{ id: string; message: string } | null>(null);

  async function uploadNote(file: File) {
    const target = noteTarget.current;
    if (!target) return;
    const problem = validatePhotoFile(file);
    if (problem) {
      setNoteError({ id: target, message: problem });
      return;
    }
    setNoteError(null);
    setNoteBusy(target);
    setNoteProgress(0);
    try {
      const outcome = await uploadPropertyPhoto(propertyId, `hostNote:${target}`, file, setNoteProgress);
      if (outcome.status === "error") {
        setNoteError({ id: target, message: outcome.message });
      } else {
        const current = latestDraft.current;
        current.setProfile(withPhotoInSlot(current.profile, `hostNote:${target}`, outcome.value));
      }
    } catch {
      setNoteError({ id: target, message: "Your photograph could not upload. Please try again." });
    } finally {
      setNoteBusy(null);
      noteTarget.current = null;
    }
  }

  async function uploadCover(file: File) {
    const problem = validatePhotoFile(file);
    setCoverError(problem);
    if (problem) return;
    setCoverBusy(true);
    setCoverProgress(0);
    try {
      const outcome = await uploadPropertyPhoto(propertyId, "cover", file, setCoverProgress);
      if (outcome.status === "error") {
        setCoverError(outcome.message);
      } else {
        const current = latestDraft.current;
        current.setProfile(withPhotoInSlot(current.profile, "cover", outcome.value));
      }
    } catch {
      setCoverError("Your cover photo could not upload. Please try again.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function uploadPortrait(file: File) {
    const problem = validatePhotoFile(file);
    setPortraitError(problem);
    if (problem) return;
    setPortraitBusy(true);
    setPortraitProgress(0);
    try {
      const outcome = await uploadPropertyPhoto(propertyId, "hostPhoto", file, setPortraitProgress);
      if (outcome.status === "error") {
        setPortraitError(outcome.message);
      } else {
        const current = latestDraft.current;
        current.setProfile(withPhotoInSlot(current.profile, "hostPhoto", outcome.value));
      }
    } catch {
      setPortraitError("Your photograph could not upload. Please try again.");
    } finally {
      setPortraitBusy(false);
    }
  }
  // A line a Host has opened but not yet written into. Nothing else marks the
  // difference between "left out" and "not written yet": an empty line is not
  // on the wall, so an empty line is not on the canvas either, and what is
  // offered instead is the button that puts it back.
  //
  // The note's own two lines start open. Nearly every property says something
  // to a guest who has just let themselves in, so the canvas opens with the
  // note on it and a Host who has nothing to say takes it off — the same way
  // the house guidance below works.
  const [opened, setOpened] = useState<ReadonlySet<TextField>>(
    new Set(["stayHeading", "stayWelcome"]),
  );
  // The names sign the note, but they are the same names the public wall
  // carries, so they are offered here and never taken away from here.
  const [signing, setSigning] = useState(false);
  // A Host builds this at desk width and a guest reads it on a phone, and the
  // join between the two is what asking a Host to imagine was doing badly. The
  // phone stands beside the canvas rather than replacing it, so the wall being
  // typed into and the wall as it will be read are on the screen at once.
  //
  // It starts open. Behind a button it was a thing a Host had to think to ask
  // for, and the join it shows is most useful to the Host who does not yet
  // know to look for it; the button is still there for the one who wants the
  // canvas to itself.
  const [phoneWanted, setShowPhone] = useState(true);
  // Tablets stack the preview; phones switch between editing and previewing.
  const phoneBelow = useMediaQuery(PHONE_BELOW_QUERY);
  const showPhone = phoneWanted || phoneBelow;
  const mobileEditor = useMediaQuery(MOBILE_EDITOR_QUERY);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  // On a phone the guest wall opens on a list of its parts, so a Host sees
  // what is done and what is left before they are dropped into the wall
  // itself.
  const [mobileMode, setMobileMode] = useState<MobileMode>("sections");
  const modeSwitch = useRef<HTMLDivElement>(null);
  const modeScroll = useRef<Partial<Record<MobileMode, number>>>({});
  const modeChanged = useRef(false);
  // The part of the wall a tapped row of the list should land on.
  const pendingSection = useRef<string | null>(null);
  const mobilePreview = mobileEditor && mobileMode === "preview";
  const mobileSections = mobileEditor && mobileMode === "sections";
  const editDock = useRef<HTMLDivElement>(null);
  const [styleOpen, setStyleOpen] = useState(false);

  useLayoutEffect(() => {
    const dock = editDock.current;
    if (!mobileEditor || mobilePreview || mobileSections || !dock) return;
    const form = dock.closest("form");
    const update = () => {
      const height = Math.ceil(dock.getBoundingClientRect().height);
      if (height > 0) form?.style.setProperty("--mobile-edit-dock-height", `${height}px`);
    };
    update();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(dock);
    return () => {
      observer?.disconnect();
      form?.style.removeProperty("--mobile-edit-dock-height");
    };
  }, [mobileEditor, mobilePreview, mobileSections, draft.load.status]);

  function changeMobileMode(next: MobileMode, section?: string) {
    pendingSection.current = section ?? null;
    if (next === mobileMode && !section) return;
    modeScroll.current[mobileMode] = window.scrollY;
    modeChanged.current = true;
    setStyleOpen(false);
    setMobileMode(next);
  }

  useLayoutEffect(() => {
    if (!mobileEditor || !modeChanged.current || !modeSwitch.current) return;
    modeChanged.current = false;
    const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;
    const section = pendingSection.current && document.getElementById(pendingSection.current);
    pendingSection.current = null;
    if (section) {
      const top = section.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return;
    }
    // The banner scrolls normally; the switch's sticky position is not its
    // original place in the document when a host switches far down the wall.
    const bannerBottom = modeSwitch.current.previousElementSibling?.getBoundingClientRect().bottom ?? 0;
    const start = bannerBottom + window.scrollY + 14 - headerHeight;
    window.scrollTo({ top: Math.max(0, modeScroll.current[mobileMode] ?? start), behavior: "instant" });
  }, [mobileEditor, mobileMode]);
  // A Host who has asked to write their own prompt keeps the box to write it
  // in, even while it is empty. Deciding from the value alone would take the
  // box away the moment they cleared it to start again.
  const [writingPrompt, setWritingPrompt] = useState(false);
  // The essential whose editor is open over the canvas, and the button it
  // grew from (none for a line that was just added).
  const [openFact, setOpenFact] = useState<{ index: number; from: DOMRect | null } | null>(null);

  const block = propertyBlock(draft.load, user?.uid);
  if (block) {
    return (
      <Shell title={block.title}>
        {block.kind === "loading" ? (
          <p className="lede" role="status">
            {block.message}
          </p>
        ) : (
          <>
            <div className="notice" role={block.alert ? "alert" : undefined}>
              <strong>{block.strong}</strong>
              <p>{block.message}</p>
            </div>
            <div className="actions">
              <a className="btn btn-secondary" href={block.backHref}>
                {block.backLabel}
              </a>
            </div>
          </>
        )}
      </Shell>
    );
  }

  // propertyBlock returns null only once the read has landed on a property
  // this account owns.
  const property = (draft.load as { status: "ready"; property: HostProperty })
    .property;
  const profile = draft.profile;
  const requestedSetup = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "1";
  if ((mobileEditor || mobileFormOpen || requestedSetup) && !settings) {
    return <MobileWallEditor property={property} draft={draft} onEditingChange={setMobileFormOpen} />;
  }
  // Which note the open photograph dialog belongs to, numbered the way the
  // cards on the wall are numbered, so the window says which one it changes.

  const nameProblem = draft.problems.identity[0]?.message;
  const addFact = (fact: PropertyProfile["facts"][number]) => {
    set("facts", [...profile.facts, fact]);
    setOpenFact({ index: profile.facts.length, from: null });
  };
  const factProblem = (index: number) =>
    draft.problems.profile.find(
      (problem) => problem.field === "facts" && problem.index === index,
    )?.message;

  function set<K extends keyof PropertyProfile>(
    field: K,
    value: PropertyProfile[K],
  ) {
    draft.setProfile({ ...profile, [field]: value });
  }

  const written = (field: TextField) => profile[field].trim().length > 0;
  // A prompt that is not one of the offered ones is one the Host wrote, so a
  // saved custom prompt comes back with its box already open.
  const ownPrompt = writingPrompt || !promptPresets.includes(profile.guestPrompt);
  const shows = (field: TextField) => written(field) || opened.has(field);

  function open(...fields: TextField[]) {
    setOpened((was) => new Set([...was, ...fields]));
  }

  /** Take a line off the wall: what it said goes, and so does the field. */
  function omit(...fields: TextField[]) {
    draft.setProfile({
      ...profile,
      ...Object.fromEntries(fields.map((field) => [field, ""])),
    });
    setOpened(
      (was) => new Set([...was].filter((field) => !fields.includes(field))),
    );
  }

  /**
   * Take the whole note off. Because the note is on by default, an absence no
   * longer says "off" — the decision has to be stored, or a reload would put
   * the note straight back under a Host who had just removed it. One write,
   * so clearing the lines and storing the decision cannot clobber each other.
   */
  function omitStayNote() {
    draft.setProfile({
      ...profile,
      stayHeading: "",
      stayWelcome: "",
      stayTip: "",
      stayNoteOff: true,
    });
    setOpened(new Set());
  }

  /** Put it back, opened at the two lines the note is mostly made of. */
  function includeStayNote() {
    draft.setProfile({ ...profile, stayNoteOff: false });
    setOpened(
      (was) => new Set([...was, "stayHeading", "stayWelcome"] as TextField[]),
    );
  }

  function setFact(index: number, field: keyof HouseFact, value: string) {
    draft.setProfile({
      ...profile,
      facts: profile.facts.map((fact, position) =>
        position === index ? { ...fact, [field]: value } : fact,
      ),
    });
  }

  const hosts = (
    <CanvasLine
      label="Your names"
      value={profile.hosts}
      placeholder="Ana & Tom"
      maxLength={profileLimits.hostsMax}
      disabled={draft.saving}
      className="canvas-hosts"
      onChange={(value) => set("hosts", value)}
    />
  );

  /**
   * The hosts' own notes, drawn where they stand on the wall: above the
   * memories, not among them.
   *
   * There used to be one, a card in the grid told apart from the guests' notes
   * by its paper alone. That is not what the field is for — it is the extra
   * things a host wants said — and read among the memories it looked like one.
   * They are their own panels now, the width of the wall, under one line
   * saying whose they are, and the canvas draws them exactly that way.
   *
   * A Host writes as many as they have things to say, and each is fixed to the
   * wall the way they chose: framed and squared to the page, or tilted and
   * pinned up like the memories below. The picker is on the card rather than
   * in a settings panel, because this is the one screen where the difference
   * between the two can be seen while it is being chosen.
   */

  function setNote(id: string, change: Partial<Omit<HostNote, "id">>) {
    set(
      "hostNotes",
      profile.hostNotes.map((note) =>
        note.id === id ? { ...note, ...change } : note,
      ),
    );
  }

  /**
   * The Host's own booking or guest-list pages, under their notes where the
   * wall puts them. Plain fields rather than words typed onto the tile: what
   * a Host is writing here is an address, and it is checked as one on save.
   * The platforms' rules are said beside the fields, because the Host is the
   * one who knows which platform their guests came from.
   */
  const setLink = (index: number, change: Partial<StayAgainLink>) =>
    set("stayAgainLinks", profile.stayAgainLinks.map((link, position) => (position === index ? { ...link, ...change } : link)));
  /* Save-time problems are numbered among the rows with something in them. */
  const linkProblem = (index: number) => {
    const link = profile.stayAgainLinks[index];
    if (!link || (!link.label.trim() && !link.url.trim())) return undefined;
    const kept = profile.stayAgainLinks.slice(0, index).filter((row) => row.label.trim() || row.url.trim()).length;
    return draft.problems.profile.find((problem) => problem.field === "stayAgainLinks" && problem.index === kept)?.message;
  };
  const stayAgainCard = isPostMvpFeatureEnabled("directBookingLinks") && (
    <div className="stay-wall canvas-stay-again">
      <section className="stay-links stay-again" aria-labelledby="canvas-stay-again">
        <h2 className="stay-section-title" id="canvas-stay-again" aria-level={3}>Stay with us again</h2>
        <p className="field-hint">
          Your own booking site, or a page where guests can join your list for a
          future stay. Guests see them here, under your notes, and nowhere else.
        </p>
        {profile.stayAgainLinks.map((link, index) => (
          <div className="stacked-form stay-card canvas-again-link" key={index}>
            <label>Link {index + 1}: what it says
              <input
                value={link.label}
                maxLength={stayAgainLimits.labelMax}
                placeholder="Book your next stay with us"
                disabled={draft.saving}
                aria-invalid={linkProblem(index) ? true : undefined}
                onChange={(event) => setLink(index, { label: event.target.value })}
              />
            </label>
            <label>Link {index + 1}: web address
              <input
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                value={link.url}
                maxLength={stayAgainLimits.urlMax}
                placeholder="seabreezecottage.com.au/book"
                disabled={draft.saving}
                aria-invalid={linkProblem(index) ? true : undefined}
                onChange={(event) => setLink(index, { url: event.target.value })}
              />
            </label>
            {linkProblem(index) && <p className="form-feedback" role="alert">{linkProblem(index)}</p>}
            <p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={draft.saving}
                onClick={() => set("stayAgainLinks", profile.stayAgainLinks.filter((_, position) => position !== index))}
              >
                Remove link {index + 1}
              </button>
            </p>
          </div>
        ))}
        {profile.stayAgainLinks.length < stayAgainLimits.linksMax && (
          <p className="canvas-includes">
            {stayAgainSuggestions
              .filter((suggestion) => !profile.stayAgainLinks.some((link) => link.label.trim() === suggestion.label))
              .map((suggestion) => (
                <Include
                  key={suggestion.label}
                  label={suggestion.label}
                  disabled={draft.saving}
                  onClick={() => set("stayAgainLinks", [...profile.stayAgainLinks, { ...suggestion }])}
                />
              ))}
            <Include
              label="Custom link"
              disabled={draft.saving}
              onClick={() => set("stayAgainLinks", [...profile.stayAgainLinks, emptyStayAgainLink()])}
            />
          </p>
        )}
        <p className="field-hint canvas-again-rules">
          Booking platforms have their own rules about pointing guests elsewhere.
          Airbnb, for example, does not allow offering a discount for booking
          outside Airbnb. Check the rules of the platforms you list on before you
          add a link. What it says and what your page offers are up to you.
        </p>
      </section>
    </div>
  );

  const hostNoteCards = (
    <section className="host-notes canvas-note-panel" id="wall-section-notes" aria-label="Your own notes">
      {profile.hostNotes.length > 0 && (
        <p className="host-note-eyebrow">More from your hosts</p>
      )}

      {profile.hostNotes.map((note, index) => (
        <article
          className="host-note canvas-note"
          data-note-style={note.style}
          key={note.id}
        >
          <div className="wizard-note-header">
            <h5 className="wizard-note-title">Note {index + 1}</h5>
            <ActionDisclosure className="canvas-note-settings" label="Note options">
            <HostNoteStylePicker
              compact
              name={`canvas-note-style-${note.id}`}
              theme={profile.theme}
              colour={profile.colour}
              value={note.style}
              disabled={draft.saving}
              onChange={(style) => setNote(note.id, { style })}
            />
            {note.photo && <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setNote(note.id, { photo: null })}
              disabled={draft.saving || noteBusy === note.id}>Remove photo</button>}
            <button type="button" className="btn btn-ghost btn-sm"
              aria-label={`Take note ${index + 1} off the wall`}
              disabled={draft.saving}
              onClick={() => set("hostNotes", profile.hostNotes.filter(entry => entry.id !== note.id))}>
              Remove note
            </button>
            </ActionDisclosure>
          </div>
          
          <div className="host-note-body">
            <div className="host-note-photo-wrap">
              <button
                type="button"
                className="host-note-photo canvas-note-photo"
                aria-label={
                  note.photo
                    ? `Change the photograph on note ${index + 1}`
                    : `Add a photograph to note ${index + 1}`
                }
                disabled={draft.saving || noteBusy === note.id}
                onClick={() => {
                  noteTarget.current = note.id;
                  noteInput.current?.click();
                }}
              >
                {noteBusy === note.id ? (
                  <span className="canvas-note-photo-empty">
                    <b>{noteProgress >= 1 ? "Saving photo…" : noteProgress > 0 ? `Uploading ${Math.round(noteProgress * 100)}%…` : "Uploading…"}</b>
                  </span>
                ) : note.photo ? (
                  <img src={note.photo.url} alt={note.photo.alt} />
                ) : (
                  <span className="canvas-note-photo-empty">
                    <CameraMark />
                    <b>Add a photograph</b>
                  </span>
                )}
              </button>
              {noteError?.id === note.id && <p className="form-feedback" role="alert">{noteError.message}</p>}
            </div>
            <div className="host-note-words">
              <CanvasParagraph
                label={`Note ${index + 1}: anything else you want to say`}
                value={note.message}
                placeholder="Anything else worth saying: the walk to the beach, the bakery that opens at seven, where the spare key lives."
                maxLength={profileLimits.hostNoteMax}
                disabled={draft.saving}
                className="host-note-message canvas-note-message"
                onChange={(value) => setNote(note.id, { message: value })}
              />
              {/* Signed the way the wall signs it, from the names and the
                photograph already on this page. There is nothing to sign with
                until a Host has typed them, and an empty signature line would
                read as a bug. */}
              {profile.hosts.trim() !== "" && (
                <p className="canvas-note-sign">
                  <b>{profile.hosts}</b>
                </p>
              )}
            </div>
          </div>

        </article>
      ))}

      {/* The offer stands where the next note would, so what it opens is
        obvious from where it is. */}
      {profile.hostNotes.length < profileLimits.hostNotesMax && (
        <div className="canvas-note-offer">
          <Include
            label={
              profile.hostNotes.length === 0 ? "a note of your own" : "another note"
            }
            disabled={draft.saving}
            onClick={() => set("hostNotes", [...profile.hostNotes, emptyHostNote()])}
          />
          {profile.hostNotes.length === 0 && (
            <small>
              Anything else you want said, above the memories on both walls. It is
              not the welcome above, and it is not a memory.
            </small>
          )}
        </div>
      )}
    </section>
  );

  const coverControl = (
    <>
        {/* The whole cover is the control, not the pill sitting on it: an
          empty photograph area reads as somewhere to drop a photograph, and
          a Host who aims at the middle of it should not find nothing there.
          The pill stays as the visible affordance, drawn inside the button
          rather than beside it, so there is still exactly one control. */}
        <div className="canvas-cover-wrap" style={{ position: "relative" }}>
          <div className="canvas-cover">
            <button
              type="button"
              className="canvas-cover-hit"
              aria-label={
                profile.cover ? "Change cover photo" : "Add a cover photo"
              }
              disabled={coverBusy}
              onClick={() => coverInput.current?.click()}
            >
              {profile.cover ? (
                <img
                  className="canvas-cover-photo"
                  src={profile.cover.url}
                  alt={profile.cover.alt}
                />
              ) : (
                <span className="canvas-cover-empty">
                  <CameraMark />
                  <b>The photograph across the top of both walls</b>A wide one
                  of the property works best. It is the first thing a guest
                  sees.
                </span>
              )}
              {(!profile.cover || coverBusy) && <span
                className="btn btn-secondary btn-sm canvas-cover-action"
                role={coverBusy ? "status" : undefined}
              >
                {coverBusy ? (coverProgress >= 1 ? "Saving photo…" : coverProgress > 0 ? `Uploading ${Math.round(coverProgress * 100)}%…` : "Uploading…") : profile.cover ? "Change cover photo" : "Add a cover photo"}
              </span>}
            </button>
            <input
              ref={coverInput}
              className="visually-hidden"
              type="file"
              accept={profileLimits.photoTypes.join(",")}
              aria-label="Cover photo: choose an image file"
              disabled={coverBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file && !coverBusy) void uploadCover(file);
              }}
            />
            {coverError && <p className="form-feedback" role="alert">{coverError}</p>}
          </div>
          {profile.cover && (
            <ActionDisclosure className="canvas-cover-menu" label="Edit cover">
              <div className="cover-menu-actions">
                <button type="button" disabled={coverBusy} onClick={() => coverInput.current?.click()}>Change cover photo</button>
            <button
              type="button"
              onClick={() => set("cover", null)}
              disabled={coverBusy}
            >
              Remove cover photo
            </button>
              </div>
            </ActionDisclosure>
          )}
        </div>
    </>
  );

      {/* Same again for the portrait: the frame itself is the button,
        so clicking the picture — or the empty square where one
        belongs — is what a Host expects it to be. */}
  const portraitControl = (
      <div className="canvas-portrait-wrap" style={{ position: "relative" }}>
        <button
          type="button"
          className="canvas-portrait"
          aria-label={
            profile.hostPhoto
              ? "Change your photograph"
              : "Add your photograph"
          }
          disabled={portraitBusy}
          onClick={() => photoInput.current?.click()}
        >
          {profile.hostPhoto ? (
            <img
              className="canvas-portrait-photo stay-portrait"
              src={profile.hostPhoto.url}
              alt={profile.hostPhoto.alt}
            />
          ) : (
            <span className="canvas-portrait-mark stay-portrait" aria-hidden="true">
              {/* Initials stand for a Host who has typed their names; with
                nothing to draw, the square says what it wants — a
                photograph — rather than asking a question back. */}
              {profile.hosts ? (
                hostInitials(profile.hosts)
              ) : (
                <CameraMark />
              )}
            </span>
          )}
          <span
            className="btn btn-ghost btn-sm canvas-portrait-action"
            role={portraitBusy ? "status" : undefined}
          >
            {portraitBusy ? (portraitProgress >= 1 ? "Saving photo…" : portraitProgress > 0 ? `Uploading ${Math.round(portraitProgress * 100)}%…` : "Uploading…") : profile.hostPhoto
              ? "Change your photograph"
              : "Add your photograph"}
          </span>
        </button>
        <input
          ref={photoInput}
          className="visually-hidden"
          type="file"
          accept={profileLimits.photoTypes.join(",")}
          aria-label="Your photograph: choose an image file"
          disabled={portraitBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file && !portraitBusy) void uploadPortrait(file);
          }}
        />
        {profile.hostPhoto && (
          <button
            type="button"
            className="canvas-portrait-remove"
            aria-label="Remove photo"
            onClick={() => set("hostPhoto", null)}
            disabled={portraitBusy}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        )}
      {portraitError && <p className="form-feedback" role="alert">{portraitError}</p>}
    </div>
  );

  const nameInput = (
      <CanvasParagraph
        label="Property name"
        value={draft.name}
        placeholder="The name guests see"
        maxLength={propertyIdentityLimits.nameMax}
        disabled={draft.saving}
        invalid={nameProblem ? true : undefined}
        onChange={value => draft.setName(value.replace(/[\r\n]+/g, " "))}
      />
  );
  const nameFeedback = nameProblem && (
    <p className="form-feedback" role="alert">
      {nameProblem}
    </p>
  );
  const locationInput = (
      <CanvasParagraph
        label="Where the property is"
        value={profile.location}
        placeholder="10 Street Name, Town, Postcode"
        maxLength={profileLimits.locationMax}
        disabled={draft.saving}
        className="canvas-location"
        onChange={(value) => set("location", value.replace(/[\r\n]+/g, " "))}
      />
  );

  const themePicker = (
    <WallThemePicker
      value={profile.theme}
      colour={profile.colour}
      disabled={draft.saving}
      onChange={(theme) => set("theme", theme)}
      onColourChange={(colour) => set("colour", colour)}
    />
  );
  // The button sits outside the form on the phone's list of parts, so it
  // names the form it submits.
  const saveButton = (
    <button type="submit" form="wall-edit-panel" disabled={draft.saving || !draft.dirty}>
      {draft.saving ? "Saving…" : "Save changes"}
    </button>
  );
  const saveNote = draft.problems.failure ? (
    <span className="save-note failed" role="alert">{draft.problems.failure}</span>
  ) : draft.saved ? (
    <span className="save-note" role="status">Saved. Your walls read this immediately.</span>
  ) : (
    <span className="save-note">
      {draft.dirty
        ? mobileEditor ? "You have unsaved changes." : "Unsaved changes. This is what they will read."
        : "Everything here is saved."}
    </span>
  );
  const saveBar = (
    <div className="save-bar canvas-savebar">
      {saveButton}
      {saveNote}
    </div>
  );

  // The phone's list of the guest wall's parts, each saying whether it is
  // done, and landing on that part of the wall when tapped.
  const currentTheme = wallTheme(profile.theme);
  const currentColour = currentTheme.colourways.find((option) => option.id === profile.colour) ?? currentTheme.colourways[0]!;
  const sections: WallSection[] = [
    {
      id: "wall-section-cover",
      title: "Cover photo",
      state: profile.cover ? "done" : "todo",
      detail: profile.cover ? "Added" : "Add a wide photo of the property",
    },
    {
      id: "wall-section-name",
      title: "Name and address",
      state: draft.name.trim() && profile.location.trim() ? "done" : "todo",
      detail: [draft.name.trim(), profile.location.trim()].filter(Boolean).join(" · ") || "Add your property's name and address",
    },
    {
      id: "wall-section-welcome",
      title: "Your photo",
      state: profile.hostPhoto ? "done" : "todo",
      detail: profile.hostPhoto ? "Added" : "Add a photo so guests know who you are",
    },
    {
      id: "wall-section-welcome",
      title: "Welcome note",
      state: profile.stayNoteOff ? "off" : profile.stayWelcome.trim() ? "done" : "todo",
      detail: profile.stayNoteOff
        ? "Hidden from the wall"
        : profile.stayWelcome.trim() || "Say hello to guests who have just arrived",
    },
    {
      id: "wall-section-essentials",
      title: "Wi-Fi and essentials",
      state: profile.factsOff ? "off" : profile.facts.length > 0 ? "done" : "todo",
      detail: profile.factsOff
        ? "Hidden from the wall"
        : profile.facts.map((fact) => fact.term.trim()).filter(Boolean).join(", ") || "Wi-Fi, check-out, parking",
    },
    {
      id: "wall-section-notes",
      title: "More notes",
      optional: true,
      state: profile.hostNotes.length > 0 ? "done" : "optional",
      detail: profile.hostNotes.length > 0
        ? `${profile.hostNotes.length} ${profile.hostNotes.length === 1 ? "note" : "notes"}`
        : "Anything else you want guests to know",
    },
    {
      id: "style",
      title: "Look and colors",
      optional: true,
      state: "optional",
      detail: `${currentTheme.name}, ${currentColour.name}`,
    },
  ];
  const required = sections.filter((section) => !section.optional);
  const finished = required.filter((section) => section.state !== "todo").length;

  const sectionList = (
    <section className="wall-sections" aria-labelledby="wall-sections-title">
      <p className="wall-sections-name">{draft.name.trim() || property.name}</p>
      <h2 id="wall-sections-title">Set up your guest wall</h2>
      <div className="wall-sections-progress">
        <progress max={required.length} value={finished} aria-label="Parts of the wall done" />
        <span>{finished} of {required.length} done</span>
      </div>
      <ul className="wall-sections-list">
        {sections.map((section, index) => (
          <li key={section.title}>
            <button
              type="button"
              className="wall-section-row"
              data-state={section.state}
              onClick={() => {
                if (section.id === "style") {
                  changeMobileMode("edit");
                  setStyleOpen(true);
                } else {
                  changeMobileMode("edit", section.id);
                }
              }}
            >
              <span className="wall-section-mark" aria-hidden="true">
                {section.state === "done" ? (
                  <svg viewBox="0 0 24 24" focusable="false"><path d="m5 12 5 5 9-10" /></svg>
                ) : section.state === "off" ? (
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M6 12h12" /></svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className="wall-section-words">
                <b>
                  {section.title}
                  {section.optional && <span className="wall-section-optional"> · optional</span>}
                </b>
                <span className="wall-section-detail">{section.detail}</span>
              </span>
              <svg className="wall-section-go" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          </li>
        ))}
      </ul>
      <div className="wall-sections-dock">
        {saveNote}
        <div className="wall-sections-actions">
          <button type="button" className="btn btn-secondary" onClick={() => changeMobileMode("preview")}>See guest view</button>
          {draft.dirty ? (
            <span className="mobile-save">{saveButton}</span>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => changeMobileMode("edit")}>Edit the wall</button>
          )}
        </div>
      </div>
    </section>
  );

  return (
    // The band overhead is fed the draft rather than the saved property: this
    // is the screen the name, the place and the cover are typed on, and a
    // banner still showing the old one while the page shows the new one would
    // be the page contradicting itself.
    // Opening the phone widens the page rather than narrowing the canvas: on a
    // wide window there is already a margin of nothing beside it, and that is
    // what the preview is spent on.
    // The paper the wall is printed on stands in the column on the left, with
    // the views: it is a setting about this screen rather than a line on the
    // wall, and above the canvas it pushed the thing being edited down the
    // page behind a row of swatches.
    <PropertyShell
      property={property}
      current={settings ? "settings" : "design"}
      name={draft.name}
      profile={profile}
      onChangeAvatar={(photo) => draft.setProfile(withPhotoInSlot(draft.profile, "avatar", photo))}
      className={`design-page${showPhone ? " has-phone" : ""}${mobilePreview ? " is-mobile-preview" : ""}${mobileSections ? " is-mobile-sections" : ""}`}
      toolbar={mobileEditor && (
        <div className="mobile-wall-switch" ref={modeSwitch} role="group" aria-label="Wall editor mode"
          data-modes={3}>
          <button type="button" aria-pressed={mobileMode === "sections"}
            onClick={() => changeMobileMode("sections")}>Overview</button>
          <button type="button" aria-pressed={mobileMode === "edit"} aria-controls="wall-edit-panel"
            onClick={() => changeMobileMode("edit")}>Edit</button>
          <button type="button" aria-pressed={mobileMode === "preview"} aria-controls="wall-preview-panel"
            onClick={() => changeMobileMode("preview")}>Preview</button>
        </div>
      )}
      aside={mobileEditor ? undefined : themePicker}
    >
      {/* Each wall opens on its name and one sentence on what it is for, the
          way every other page of the property does, so a Host who arrives
          from the nav knows which of the two walls they are writing on.

          The two walls used to be a switch here too. They are two rows in the
          nav on the left instead: they are different walls, not two states of
          one screen, and a Host asks for one of them the way they ask for
          moderation or billing. */}
      {mobileSections && sectionList}

      {/* On a phone the guest wall's intro gives way to one line on how the
          page works; the list of parts has already said what the wall is. */}
      {mobileEditor && mobileMode === "edit" && (
        <p className="mobile-edit-hint">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></svg>
          Tap anything with a dotted outline to change it.
        </p>
      )}

      <header className="design-intro" hidden={mobilePreview || mobileEditor}>
        <div className="design-intro-head">
          <h2>Guest wall</h2>
          {/* The wall as a visitor or a guest gets it, one click from the page
              that writes it. The guest wall opens with its token, or it would
              answer with the public wall instead. */}
          {property.slug && (
            <a
              className="btn btn-secondary btn-sm"
              href={stayWallPath(property.slug, property.stayToken)}
              target="_blank"
              rel="noreferrer"
            >
              View wall
            </a>
          )}
        </div>
        <p className="design-intro-what">
          Memories plus your house info: welcome, Wi-Fi, house rules and check-out.
        </p>
        <p>
          What guests see when they scan your QR code during their stay. Click any text on the wall to change it.
          {/* The public page is made from this wall, so the one place a Host
              learns that is the one place they write it. */}
          {" "}Your cover, name and photo also head your public page, which you share from{" "}
          <a href={`/host/property/${property.id}/qr`}>QR code and sharing</a>.
        </p>
      </header>

      {!phoneBelow && (
        <div className="design-controls">
          {/* The preview is a phone that opens down the right of the page and
              follows the draft as it is typed. It does not take the page over:
              a Host reads the phone and keeps writing on the wall beside it. */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-pressed={showPhone}
            onClick={() => setShowPhone(!showPhone)}
          >
            {showPhone ? "Hide the phone" : "Preview"}
          </button>
        </div>
      )}

      <div className={showPhone ? "design-body with-phone" : "design-body"}>
        <form
          className="wall-canvas"
          id="wall-edit-panel"
          hidden={mobilePreview || mobileSections}
          onSubmit={draft.save}
          noValidate
          aria-label="Guest wall"
        >
          {/* The sheet is printed on the theme the property chose, so what a
            Host types into is the paper a guest will read it on. */}
          <div
            className="canvas-sheet"
            id="design-canvas"
            data-wall-theme={profile.theme}
            data-wall-colour={profile.colour}
          >
            {/* Both walls are drawn with the guest walls' own classes, so each
              theme dresses the canvas exactly as it dresses the wall it
              stands for: the public wall's one header card, or the in-stay
              wall's cover, hosts' card, tip and essentials. Only the fields
              and their controls are the canvas's own. */}
            <div className="canvas-body stay-wall canvas-stay">
              <header className="stay-cover canvas-stay-cover" id="wall-section-cover">
                {coverControl}
                <div className="stay-cover-titles canvas-stay-titles" id="wall-section-name">
                  <h1 className="canvas-name" aria-level={2}>{nameInput}</h1>
                  {nameFeedback}
                  <div className="stay-location">
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 18s5.6-5.4 5.6-9.6a5.6 5.6 0 0 0-11.2 0C4.4 12.6 10 18 10 18Z" /><circle cx="10" cy="8.4" r="2" /></svg>
                    {locationInput}
                  </div>
                </div>
              </header>

              <>
                {/* The hosts' card, as the guest's wall draws it: the
                  photograph beside the heading and the names, the note under
                  them. With the note off, the card still says whose house
                  this is, and the offer to put the note back stands in it. */}
                {!profile.stayNoteOff ? (
                  <section className="stay-welcome stay-card canvas-welcome-card" id="wall-section-welcome" aria-label="A note from your hosts">
                    {portraitControl}
                    <div className="stay-welcome-words">
                      <div className="canvas-eyebrow canvas-eyebrow-omit">
                        A note from your hosts
                        {/* A phone has no room for a remove button beside
                          every line, so the note's lines are taken off from
                          one menu at its head instead. */}
                        {mobileEditor ? (
                          <ActionDisclosure
                            className="canvas-section-menu"
                            title="Options for the note from your hosts"
                            label={<>
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                              <span className="visually-hidden">Options for the note from your hosts</span>
                            </>}
                          >
                            <div className="cover-menu-actions">
                              {shows("stayHeading") && (
                                <button type="button" disabled={draft.saving} onClick={() => omit("stayHeading")}>Hide the heading</button>
                              )}
                              {(profile.hosts.trim() || signing) && (
                                <button type="button" disabled={draft.saving} onClick={() => { set("hosts", ""); setSigning(false); }}>Hide your names</button>
                              )}
                              {shows("stayWelcome") && (
                                <button type="button" disabled={draft.saving} onClick={() => omit("stayWelcome")}>Hide the arrival note</button>
                              )}
                              {shows("stayTip") && (
                                <button type="button" disabled={draft.saving} onClick={() => omit("stayTip")}>Hide the local tip</button>
                              )}
                              <button type="button" disabled={draft.saving} onClick={omitStayNote}>Hide the whole note</button>
                            </div>
                          </ActionDisclosure>
                        ) : (
                          <Omit
                            label="Leave the whole note out"
                            iconOnly
                            disabled={draft.saving}
                            onClick={omitStayNote}
                          />
                        )}
                      </div>

                      {shows("stayHeading") && (
                        <div className="canvas-optional canvas-heading-edit">
                          <h2 className="canvas-heading" aria-level={3}>
                            <CanvasParagraph
                              label="Arrival heading"
                              value={profile.stayHeading}
                              placeholder={exampleNote.heading}
                              maxLength={profileLimits.stayHeadingMax}
                              disabled={draft.saving}
                              onChange={(value) => set("stayHeading", value.replace(/[\r\n]+/g, " "))}
                            />
                          </h2>
                          <Omit
                            label="Leave the heading out"
                            iconOnly
                            disabled={draft.saving}
                            onClick={() => omit("stayHeading")}
                          />
                        </div>
                      )}

                      {(profile.hosts.trim() || signing) && (
                        <div className="canvas-optional">
                          <p className="stay-hosts"><span className="stay-eyebrow">Your hosts,</span> <b>{hosts}</b></p>
                          <Omit
                            label="Leave your names out"
                            iconOnly
                            disabled={draft.saving}
                            onClick={() => {
                              set("hosts", "");
                              setSigning(false);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {shows("stayWelcome") && (
                      <div className="stay-welcome-body canvas-optional">
                        <CanvasParagraph
                          label="Arrival note"
                          value={profile.stayWelcome}
                          placeholder={exampleNote.welcome}
                          maxLength={profileLimits.stayWelcomeMax}
                          disabled={draft.saving}
                          className="canvas-stay-note"
                          onChange={(value) => set("stayWelcome", value)}
                        />
                        <Omit
                          label="Leave the arrival note out"
                          iconOnly
                          disabled={draft.saving}
                          onClick={() => omit("stayWelcome")}
                        />
                      </div>
                    )}

                    {(!shows("stayHeading") ||
                      !shows("stayWelcome") ||
                      !shows("stayTip") ||
                      !(profile.hosts.trim() || signing)) && (
                      <p className="canvas-includes">
                        {!shows("stayHeading") && (
                          <Include
                            label="a heading"
                            disabled={draft.saving}
                            onClick={() => open("stayHeading")}
                          />
                        )}
                        {!shows("stayWelcome") && (
                          <Include
                            label="an arrival note"
                            disabled={draft.saving}
                            onClick={() => open("stayWelcome")}
                          />
                        )}
                        {!shows("stayTip") && (
                          <Include
                            label="a local recommendation"
                            disabled={draft.saving}
                            onClick={() => open("stayTip")}
                          />
                        )}
                        {!(profile.hosts.trim() || signing) && (
                          <Include
                            label="your names"
                            disabled={draft.saving}
                            onClick={() => setSigning(true)}
                          />
                        )}
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="stay-welcome-plain stay-card canvas-welcome-card" id="wall-section-welcome" aria-label="Your hosts">
                    {portraitControl}
                    <p className="canvas-includes">
                      <Include
                        label="a note from your hosts"
                        disabled={draft.saving}
                        onClick={includeStayNote}
                      />
                    </p>
                  </section>
                )}

                {/* Part of the hosts' welcome on the wall, so it stands with
                  it here too, ahead of the essentials. */}
                {!profile.stayNoteOff && shows("stayTip") && (
                  <aside className="stay-tip-card stay-card" aria-label="A tip from your hosts">
                    <span className="stay-icon stay-icon-quiet">
                      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7.6 14.4h4.8M8.2 17h3.6M10 2.6a5 5 0 0 0-2.9 9.1c.4.3.5.7.5 1.2v.5h4.8v-.5c0-.5.2-.9.5-1.2A5 5 0 0 0 10 2.6Z" /></svg>
                    </span>
                    <div>
                      <p className="stay-eyebrow">A little tip from your hosts</p>
                      <div className="canvas-optional">
                        <CanvasParagraph
                          label="One local recommendation"
                          value={profile.stayTip}
                          placeholder="The bakery behind the lighthouse. Go before 9am."
                          maxLength={profileLimits.stayTipMax}
                          disabled={draft.saving}
                          className="canvas-tip stay-tip-text"
                          onChange={(value) => set("stayTip", value.replace(/[\r\n]+/g, " "))}
                        />
                        <Omit
                          label="Leave the recommendation out"
                          iconOnly
                          disabled={draft.saving}
                          onClick={() => omit("stayTip")}
                        />
                      </div>
                    </div>
                  </aside>
                )}

                {/* The essentials sit where the guest's wall puts them, as
                  the same row of buttons, on every theme. A tapped one opens
                  that line's editor over the page, as the guest's wall opens
                  the line itself. A line still missing its label or answer
                  gets a button too, so the Host can get back to it. They are
                  on the wall unless a Host says otherwise; the lines are kept
                  when the section goes, so putting it back does not cost them
                  the Wi-Fi password twice. */}
                {profile.factsOff ? (
                  <p className="canvas-includes canvas-includes-lead" id="wall-section-essentials">
                    <Include
                      label="the essentials"
                      disabled={draft.saving}
                      onClick={() => set("factsOff", false)}
                    />
                  </p>
                ) : (
                  <div className="stay-wall canvas-stay-links" id="wall-section-essentials">
                    <StayEssentialLinks
                      id="canvas-stay-essentials"
                      headingLevel={3}
                      links={profile.facts.map((fact, index) => ({
                        label: fact.term.trim() || `Line ${index + 1}`,
                        mark: essentialMarkName(fact.term),
                        invalid: Boolean(factProblem(index)),
                      }))}
                      onOpen={(index, from) => setOpenFact({ index, from })}
                    >
                      <p className="field-hint">
                        Wi-Fi, bins, heating, checkout &mdash; the questions you
                        answer every week. Tap one to change it. Up to{" "}
                        {profileLimits.factsMax} lines, and only ever on this wall.
                      </p>
                      {/* Suggestions rather than rows written into every new
                        property: nothing is here until a Host picks it. What a
                        pick brings is the whole line (label, answer and
                        detail), not a label with the answer left as an
                        example. The pick opens at once, which is what makes
                        correcting the example the obvious next move. */}
                      {profile.facts.length < profileLimits.factsMax && (
                        <p className="canvas-includes">
                          {unusedFactSuggestions(profile.facts)
                            .slice(
                              0,
                              profileLimits.factsMax - profile.facts.length,
                            )
                            .map((suggestion) => (
                              <Include
                                key={suggestion.term}
                                label={suggestion.term}
                                disabled={draft.saving}
                                onClick={() => addFact({ ...suggestion })}
                              />
                            ))}
                          {/* The same offer, for a line none of the
                            suggestions cover: it starts empty, so the Host
                            types the label as well as the answer. */}
                          <Include
                            label="Custom"
                            disabled={draft.saving}
                            onClick={() => addFact(emptyFact())}
                          />
                        </p>
                      )}
                      <p className="canvas-essentials-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => addFact(emptyFact())}
                          disabled={
                            draft.saving ||
                            profile.facts.length >= profileLimits.factsMax
                          }
                        >
                          Add a line
                        </button>
                        <Omit
                          label="Leave the essentials out"
                          disabled={draft.saving}
                          onClick={() => { setOpenFact(null); set("factsOff", true); }}
                        />
                      </p>
                    </StayEssentialLinks>
                    {/* Every line's editor is drawn, closed, so its fields
                      stay part of the form; only the tapped one opens. */}
                    {profile.facts.map((fact, index) => (
                      <EssentialSheet
                        key={index}
                        label={fact.term.trim() || `Line ${index + 1}`}
                        open={openFact?.index === index}
                        from={openFact?.index === index ? openFact.from : null}
                        onClose={() => setOpenFact(null)}
                      >
                        <article className="stay-fact stay-card canvas-essential" id={`canvas-essential-${index}`}>
                          <div className="stay-fact-head">
                            <span className="stay-icon">
                              <EssentialMark
                                term={fact.term}
                                className="essential-mark canvas-essential-mark"
                              />
                            </span>
                            <h3 aria-level={4}>
                              <CanvasLine
                                label={`Line ${index + 1}: label`}
                                value={fact.term}
                                placeholder="Wi-Fi"
                                maxLength={profileLimits.factTermMax}
                                disabled={draft.saving}
                                invalid={factProblem(index) ? true : undefined}
                                onChange={(value) =>
                                  setFact(index, "term", value)
                                }
                              />
                            </h3>
                          </div>
                          <div className="stay-fact-body">
                            <CanvasParagraph
                              label={`Line ${index + 1}: answer`}
                              value={fact.detail}
                              placeholder={factExample(fact.term).detail}
                              maxLength={profileLimits.factDetailMax}
                              disabled={draft.saving}
                              invalid={factProblem(index) ? true : undefined}
                              className="canvas-essential-detail stay-fact-detail"
                              onChange={(value) =>
                                setFact(index, "detail", value)
                              }
                            />
                          </div>
                          <CanvasParagraph
                            label={`Line ${index + 1}: detail`}
                            value={fact.note}
                            placeholder={factExample(fact.term).note}
                            maxLength={profileLimits.factNoteMax}
                            disabled={draft.saving}
                            className="canvas-essential-note stay-fact-note"
                            onChange={(value) =>
                              setFact(index, "note", value)
                            }
                          />
                          {factProblem(index) && (
                            <p className="form-feedback" role="alert">
                              {factProblem(index)}
                            </p>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setOpenFact(null);
                              set(
                                "facts",
                                profile.facts.filter(
                                  (_, position) => position !== index,
                                ),
                              );
                            }}
                            disabled={draft.saving}
                          >
                            Remove {fact.term.trim() || `line ${index + 1}`}
                          </button>
                        </article>
                      </EssentialSheet>
                    ))}
                  </div>
                )}

                {hostNoteCards}

                {stayAgainCard}

                {/* The box a guest types into used to be drawn here, above the
                  notes, greyed and captioned as theirs. It said one thing —
                  that guests write on the wall itself — and the line under
                  the notes says it in words, with the wall itself a click
                  away. What stands here now is the Host's own card, in the
                  grid, because that is where it will be read. It is drawn
                  above the essentials now, where the wall reads it. */}
                <MemoryChrome
                  property={property}
                  counts={draft.counts}
                  invitation="Everything else on this wall is written by guests, on the wall itself, and waits here before it appears."
                >
                  <div className="stacked-form">
                    <label>Writing prompt for guests
                      <select
                        value={ownPrompt ? "custom" : profile.guestPrompt}
                        disabled={draft.saving}
                        onChange={event => {
                          const choice = event.target.value;
                          setWritingPrompt(choice === "custom");
                          set("guestPrompt", choice === "custom" ? "Share a memory from your stay." : choice);
                        }}
                      >
                        <option value="">No suggested prompt</option>
                        <option>What was your favourite memory of this stay?</option>
                        <option>What would you recommend to the next guests?</option>
                        <option value="custom">Custom prompt</option>
                      </select>
                    </label>
                    {/* The box to type in belongs to the Host who is writing
                      their own prompt. For the offered ones it only said back
                      what the list above it already says. */}
                    {ownPrompt && (
                      <label>Your prompt
                        <input value={profile.guestPrompt} maxLength={240} disabled={draft.saving} onChange={event => set("guestPrompt", event.target.value)} />
                      </label>
                    )}
                  </div>
                </MemoryChrome>
                {property.slug && (
                  <GuestOnly>
                    <a
                      className="text-link"
                      /* With the token on it: the in-stay wall answers
                         with the arrival note and the essentials only to
                         the address printed on the placard, so a tokenless
                         link opens the public wall and this Host is left
                         looking for the words they just wrote. */
                      href={stayWallPath(property.slug, property.stayToken)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open the guest wall as guests see it"
                    >
                      Open this wall as guests see it &rarr;
                    </a>
                  </GuestOnly>
                )}
              </>
            </div>
          </div>

          {/* On a phone the look of the wall waits behind one button, so the
            bar at the bottom is the save and nothing else a Host has to read. */}
          {mobileEditor ? (
            <div className="mobile-edit-dock" ref={editDock}>
              {styleOpen && (
                <div className="mobile-style-panel" role="group" aria-label="Look and colors">
                  {themePicker}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStyleOpen(false)}>Done</button>
                </div>
              )}
              {saveNote}
              <div className="mobile-edit-actions">
                <button
                  type="button"
                  className="btn btn-secondary mobile-style-toggle"
                  aria-expanded={styleOpen}
                  onClick={() => setStyleOpen((was) => !was)}
                >
                  <span className="mobile-style-dot" data-wall-theme={profile.theme} data-wall-colour={profile.colour} aria-hidden="true" />
                  Style
                </button>
                <span className="mobile-save">{saveButton}</span>
              </div>
            </div>
          ) : saveBar}
        </form>

        {showPhone && (
          <aside className="design-phone" id="wall-preview-panel" hidden={mobileEditor && !mobilePreview} aria-label="This wall on a phone">
            {/* The phone follows the canvas as it is typed, which is not obvious
              from a picture of a phone standing beside a page. One line says
              so, above the thing it is describing. */}
            {/* Which way the canvas lies depends on how wide the window is:
              beside the phone on a desk, above it once the column drops. The
              word is swapped rather than dropped, because "on the left" is
              the whole point of the sentence on the screen it is true of. */}
            <p className="design-phone-note">
              {mobileEditor ? (
                draft.dirty ? "Preview includes your unsaved changes." : "This is how your guests see the wall."
              ) : (
                <>Edit the wall <span className="where-beside">on the left</span>
                <span className="where-above">above</span>. The phone follows as you type.</>
              )}
            </p>
            <WallPreview
              name={draft.name.trim() || property.name}
              profile={profile}
              counts={draft.counts}
              view="stay"
              slug={property.slug}
              stayToken={property.stayToken}
              propertyId={property.id}
            />
          </aside>
        )}
      </div>


      {settings && (
        <PropertySettingsDialog
          propertyId={property.id}
          slug={property.slug}
          draft={draft}
          onClose={() => navigate(`/host/property/${property.id}`)}
        />
      )}

      <input
        ref={noteInput}
        className="visually-hidden"
        type="file"
        accept={profileLimits.photoTypes.join(",")}
        aria-label="Note photograph: choose an image file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && !noteBusy) void uploadNote(file);
        }}
      />
    </PropertyShell>
  );
}

/** Matches the width at which styles.css drops the phone under the canvas. */
const PHONE_BELOW_QUERY = "(max-width: 1340px)";
const MOBILE_EDITOR_QUERY = "(max-width: 620px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/**
 * One essential's editor, opened over the canvas from its button the way the
 * guest's wall opens the line itself. Always in the page, so its fields stay
 * part of the form, and closed until it is tapped: a native modal dialog, so
 * Escape, the backdrop and focus behave. It must sit inside the `.stay-wall`,
 * where the guest's sheet takes its styles.
 */
function EssentialSheet({ label, open, from, onClose, children }: {
  label: string; open: boolean; from: DOMRect | null; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const sheet = dialog.current;
    if (!sheet || !open) return;
    sheet.showModal();
    if (from) {
      const box = sheet.getBoundingClientRect();
      sheet.style.transformOrigin = `${from.left + from.width / 2 - box.left}px ${from.top + from.height / 2 - box.top}px`;
    } else {
      sheet.style.transformOrigin = "";
    }
    return () => sheet.close();
  }, [open, from]);
  return (
    <dialog
      ref={dialog}
      className="stay-fact-sheet"
      aria-label={label}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      {children}
      <button type="button" className="stay-sheet-close" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5.5 5.5 9 9m0-9-9 9" /></svg>
      </button>
    </dialog>
  );
}
