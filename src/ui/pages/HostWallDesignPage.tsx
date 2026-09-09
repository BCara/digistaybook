import { useRef, useState, type ReactNode } from "react";
import { propertyIdentityLimits } from "../../domain/property";
import {
  emptyFact,
  emptyHostNote,
  factExample,
  hostInitials,
  profileLimits,
  validatePhotoFile,
  unusedFactSuggestions,
  type HostNote,
  type HouseFact,
  type PropertyProfile,
} from "../../domain/propertyProfile";
import { useAuth } from "../auth/AuthProvider";
import { CameraMark } from "../host/CameraMark";
import { PhotoDialog } from "../host/PhotoDialog";
import { PropertySettingsDialog } from "../host/PropertyDialog";
import { navigate } from "../routing";
import { CanvasLine, CanvasParagraph } from "../host/CanvasFields";
import { HostNoteStylePicker } from "../host/HostNoteStylePicker";
import { PropertyShell } from "../host/PropertyShell";
import { WallPreview } from "../host/WallPreview";
import { memoriesHeading } from "../wall/memoryHeading";
import { WallThemePicker } from "../host/WallThemePicker";
import { PublicWallSettings } from "../host/PublicWallSettings";
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

/**
 * A wall of the property, laid out as the guest meets it, and written into
 * directly.
 *
 * Both of a property's walls are this page, told by `view` which one it is:
 * the wall behind the QR display lives at the property's own address, and the
 * public wall behind the shared link is a row of its own in the nav on the
 * left. They were one screen with a switch across the top, which asked a Host
 * to hold two walls in one place when the column beside them was already the
 * thing that answers "which wall".
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

type View = "public" | "stay";

/**
 * The photographs on the wall itself, and what the dialog over one says about
 * it. The property's own small photograph is not here: it belongs to the band
 * overhead, and is taken there.
 *
 * A note's photograph is named for the note it is on, because a Host with
 * three notes on the wall would otherwise open the same dialog three times
 * over and be told nothing about which one they were changing.
 */
type CanvasPhoto = Exclude<PhotoSlot, "avatar">;

function canvasPhoto(
  slot: CanvasPhoto,
  position?: number,
): { label: string; hint?: string } {
  if (slot === "cover") {
    return {
      label: "Cover photo",
      hint: "Across the top of both walls. A wide photograph of the property works best.",
    };
  }
  if (slot === "hostPhoto") {
    return {
      label: "Your photograph",
      hint: "Beside your names. Without one, guests see your initials.",
    };
  }
  return {
    label:
      position === undefined
        ? "The photograph on your note"
        : `The photograph on note ${position}`,
  };
}

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
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="canvas-omit"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
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
    <section className="canvas-memories" aria-label="Memories from guests">
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
          href={`/host/property/${property.id}/moderation`}
        >
          Moderate what guests leave &rarr;
        </a>
      </GuestOnly>
    </section>
  );
}

export function HostWallDesignPage({
  propertyId,
  view = "stay",
  settings = false,
}: {
  propertyId: string;
  view?: View;
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
  // Uploading is the one thing that cannot happen inline: a file has to be
  // chosen off the device. It opens over the wall rather than in it — see
  // `PhotoDialog` — so changing a photograph never moves the page underneath.
  const [panel, setPanel] = useState<CanvasPhoto | null>(null);
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
  const [showPhone, setShowPhone] = useState(true);
  // A Host who has asked to write their own prompt keeps the box to write it
  // in, even while it is empty. Deciding from the value alone would take the
  // box away the moment they cleared it to start again.
  const [writingPrompt, setWritingPrompt] = useState(false);

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
  // Which note the open photograph dialog belongs to, numbered the way the
  // cards on the wall are numbered, so the window says which one it changes.
  const panelNoteId = panel === null ? null : hostNoteOfSlot(panel);
  const panelNote =
    panelNoteId === null
      ? undefined
      : profile.hostNotes.findIndex((note) => note.id === panelNoteId) + 1 || undefined;
  const nameProblem = draft.problems.identity[0]?.message;
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
  const hostNoteSigned =
    profile.hosts.trim() !== "" || profile.hostPhoto !== null;

  function setNote(id: string, change: Partial<Omit<HostNote, "id">>) {
    set(
      "hostNotes",
      profile.hostNotes.map((note) =>
        note.id === id ? { ...note, ...change } : note,
      ),
    );
  }

  const hostNoteCards = (
    <section className="host-notes canvas-note-panel" aria-label="Your own notes">
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
            <HostNoteStylePicker
              compact
              name={`canvas-note-style-${note.id}`}
              theme={profile.theme}
              value={note.style}
              disabled={draft.saving}
              onChange={(style) => setNote(note.id, { style })}
            />
          </div>
          
          <div className="host-note-body">
            <button
              type="button"
              className="host-note-photo canvas-note-photo"
              aria-label={
                note.photo
                  ? `Change the photograph on note ${index + 1}`
                  : `Add a photograph to note ${index + 1}`
              }
              onClick={() => setPanel(hostNoteSlot(note))}
            >
              {note.photo ? (
                <img src={note.photo.url} alt={note.photo.alt} />
              ) : (
                <span className="canvas-note-photo-empty">
                  <CameraMark />
                  <b>Add a photograph</b>
                </span>
              )}
            </button>
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
              {hostNoteSigned && (
                <p className="canvas-note-sign">
                  {profile.hostPhoto ? (
                    <img
                      className="avatar avatar-photo"
                      src={profile.hostPhoto.url}
                      alt={profile.hostPhoto.alt}
                    />
                  ) : (
                    <span className="avatar tone-2" aria-hidden="true">
                      {hostInitials(profile.hosts)}
                    </span>
                  )}
                  <b>{profile.hosts}</b>
                </p>
              )}
            </div>
          </div>

          {/* A photograph is stored the moment it uploads, so what this takes
            away is the note; the picture on it goes with the note it was on. */}
          <Omit
            label={`Take note ${index + 1} off the wall`}
            disabled={draft.saving}
            onClick={() =>
              set(
                "hostNotes",
                profile.hostNotes.filter((entry) => entry.id !== note.id),
              )
            }
          />
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
      current={settings ? "settings" : view === "public" ? "public" : "design"}
      name={draft.name}
      profile={profile}
      onChangeAvatar={(photo) => draft.setProfile(withPhotoInSlot(draft.profile, "avatar", photo))}
      className={showPhone ? "design-page has-phone" : "design-page"}
      aside={
        <WallThemePicker
          value={profile.theme}
          disabled={draft.saving}
          onChange={(theme) => set("theme", theme)}
        />
      }
    >
      {/* The page opens on the wall itself. A title, a lede and a line about
          who can reach this wall used to stand here, and all three said what
          the banner overhead, the nav beside it and the wall below already
          say. The one control left is the phone, in the canvas's own corner.

          The two walls used to be a switch here too. They are two rows in the
          nav on the left instead: they are different walls, not two states of
          one screen, and a Host asks for one of them the way they ask for
          moderation or billing. */}
      {/* On the public wall, what it is for and what to do with it stand
          above the wall itself: the decision to have one, then the link and
          the embed code that are the two ways of using it. */}
      {view === "public" && (
        <PublicWallSettings
          property={property}
          off={profile.displayWallOff}
          disabled={draft.saving}
          onChange={(off) => set("displayWallOff", off)}
        />
      )}

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

      <div className={showPhone ? "design-body with-phone" : "design-body"}>
        <form
          className="wall-canvas"
          onSubmit={draft.save}
          noValidate
          aria-label={view === "public" ? "Public wall" : "Property view"}
        >
          {/* The sheet is printed on the theme the property chose, so what a
            Host types into is the paper a guest will read it on. */}
          <div
            className="canvas-sheet"
            id="design-canvas"
            data-wall-theme={profile.theme}
          >
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
                  <span
                    className="btn btn-secondary btn-sm canvas-cover-action"
                    role={coverBusy ? "status" : undefined}
                  >
                    {coverBusy ? (coverProgress >= 1 ? "Saving photo…" : coverProgress > 0 ? `Uploading ${Math.round(coverProgress * 100)}%…` : "Uploading…") : profile.cover ? "Change cover photo" : "Add a cover photo"}
                  </span>
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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => set("cover", null)}
                  disabled={coverBusy}
                  style={{ position: "absolute", right: 8, bottom: -36 }}
                >
                  Remove cover photo
                </button>
              )}
            </div>
            
            <div className="canvas-body">
              <div className="canvas-identity">
                {/* Same again for the portrait: the frame itself is the button,
                  so clicking the picture — or the empty square where one
                  belongs — is what a Host expects it to be. */}
                <div className="canvas-portrait-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
                        className="canvas-portrait-photo"
                        src={profile.hostPhoto.url}
                        alt={profile.hostPhoto.alt}
                      />
                    ) : (
                      <span className="canvas-portrait-mark" aria-hidden="true">
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
                      className="btn btn-ghost btn-sm"
                      onClick={() => set("hostPhoto", null)}
                      disabled={portraitBusy}
                      style={{ marginTop: 4 }}
                    >
                      Remove photo
                    </button>
                  )}
                </div>
                {portraitError && <p className="form-feedback" role="alert">{portraitError}</p>}

                <div className="canvas-titles">
                  <h2 className="canvas-name">
                    <CanvasLine
                      label="Property name"
                      value={draft.name}
                      placeholder="The name guests see"
                      maxLength={propertyIdentityLimits.nameMax}
                      disabled={draft.saving}
                      invalid={nameProblem ? true : undefined}
                      onChange={draft.setName}
                    />
                  </h2>
                  {nameProblem && (
                    <p className="form-feedback" role="alert">
                      {nameProblem}
                    </p>
                  )}
                  <CanvasLine
                    label="Where the property is"
                    value={profile.location}
                    placeholder="10 Street Name, Town, Postcode"
                    maxLength={profileLimits.locationMax}
                    disabled={draft.saving}
                    className="canvas-location"
                    onChange={(value) => set("location", value)}
                  />
                </div>
              </div>

              {view === "public" ? (
                <>
                  <CanvasParagraph
                    label="A short welcome for the public wall"
                    value={profile.welcome}
                    placeholder="We bought the cottage the year our youngest left home, and we have been putting it back together ever since."
                    maxLength={profileLimits.welcomeMax}
                    disabled={draft.saving}
                    className="canvas-welcome"
                    onChange={(value) => set("welcome", value)}
                  />

                  <div className="canvas-byline">
                    <span className="canvas-byline-mark" aria-hidden="true">
                      {profile.hostPhoto ? (
                        <img
                          className="avatar avatar-photo"
                          src={profile.hostPhoto.url}
                          alt=""
                        />
                      ) : (
                        <span className="avatar tone-2">
                          {profile.hosts ? hostInitials(profile.hosts) : "?"}
                        </span>
                      )}
                    </span>
                    <span className="canvas-byline-text">
                      {hosts}
                      {/* The wall writes the words and the Host writes only the
                        year, so the sentence is split rather than asking them
                        to type a line they cannot see the shape of. */}
                      <span className="canvas-since-row">
                        <span>Hosting here since</span>
                        <CanvasLine
                          label="Hosting here since"
                          value={profile.hostSince}
                          placeholder="2019"
                          maxLength={profileLimits.hostSinceMax}
                          disabled={draft.saving}
                          className="canvas-since"
                          onChange={(value) => set("hostSince", value)}
                        />
                      </span>
                    </span>
                  </div>

                  {hostNoteCards}
                  <MemoryChrome
                    property={property}
                    counts={draft.counts}
                    invitation="Everything else here is a guest's. Nobody can add to this wall from the public link."
                  />
                </>
              ) : (
                <>
                  {/* The note is on the wall unless a Host says otherwise, and
                    every line in it is still optional: a Host who answers
                    everything at the door can take the whole thing off, and a
                    blank line printed on a guest's wall is worse than no line.
                    Leaving a line out is leaving it empty, so what is stored
                    says the same thing the page does. */}
                  {!profile.stayNoteOff ? (
                    <>
                      <p className="canvas-eyebrow canvas-eyebrow-omit">
                        A note from your hosts
                        <Omit
                          label="Leave the whole note out"
                          disabled={draft.saving}
                          onClick={omitStayNote}
                        />
                      </p>

                      {shows("stayHeading") && (
                        <div className="canvas-optional">
                          <h3 className="canvas-heading">
                            <CanvasLine
                              label="Arrival heading"
                              value={profile.stayHeading}
                              placeholder="Welcome to the cottage"
                              maxLength={profileLimits.stayHeadingMax}
                              disabled={draft.saving}
                              onChange={(value) => set("stayHeading", value)}
                            />
                          </h3>
                          <Omit
                            label="Leave the heading out"
                            disabled={draft.saving}
                            onClick={() => omit("stayHeading")}
                          />
                        </div>
                      )}

                      {shows("stayWelcome") && (
                        <div className="canvas-optional">
                          <CanvasParagraph
                            label="Arrival note"
                            value={profile.stayWelcome}
                            placeholder={
                              "The kettle is on the side and there is milk in the fridge.\n\nIf something is not working, message us before you go hunting for it."
                            }
                            maxLength={profileLimits.stayWelcomeMax}
                            disabled={draft.saving}
                            className="canvas-stay-note"
                            onChange={(value) => set("stayWelcome", value)}
                          />
                          <Omit
                            label="Leave the arrival note out"
                            disabled={draft.saving}
                            onClick={() => omit("stayWelcome")}
                          />
                        </div>
                      )}

                      {shows("stayTip") && (
                        <div className="canvas-optional">
                          <CanvasLine
                            label="One local recommendation"
                            value={profile.stayTip}
                            placeholder="The bakery behind the lighthouse. Go before 9am."
                            maxLength={profileLimits.stayTipMax}
                            disabled={draft.saving}
                            className="canvas-tip"
                            onChange={(value) => set("stayTip", value)}
                          />
                          <Omit
                            label="Leave the recommendation out"
                            disabled={draft.saving}
                            onClick={() => omit("stayTip")}
                          />
                        </div>
                      )}

                      {(profile.hosts.trim() || signing) && (
                        <div className="canvas-optional">
                          <p className="canvas-signature">{hosts}</p>
                          <Omit
                            label="Leave your names out"
                            disabled={draft.saving}
                            onClick={() => {
                              set("hosts", "");
                              setSigning(false);
                            }}
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
                    </>
                  ) : (
                    <p className="canvas-includes canvas-includes-lead">
                      <Include
                        label="a note from your hosts"
                        disabled={draft.saving}
                        onClick={includeStayNote}
                      />
                    </p>
                  )}

                  {/* The essentials are on the wall unless a Host says otherwise:
                    most properties answer these questions, and one that does
                    not can take the whole section off. The lines are kept when
                    it goes, so putting it back does not cost them the Wi-Fi
                    password twice. */}
                  <div className="stacked-form">
                    <label className="check-row"><input type="checkbox" checked={profile.publishHouseInformation} disabled={draft.saving} onChange={event => set("publishHouseInformation", event.target.checked)} />
                      Show the arrival note and house essentials to anyone with the guestbook link
                    </label>
                    <p className="field-hint">Shared links can be forwarded. Review Wi-Fi details and access instructions before enabling this.</p>
                  </div>
                  {profile.factsOff ? (
                    <p className="canvas-includes canvas-includes-lead">
                      <Include
                        label="the essentials"
                        disabled={draft.saving}
                        onClick={() => set("factsOff", false)}
                      />
                    </p>
                  ) : (
                    <>
                      <h3 className="wall-heading canvas-essentials-heading">
                        The essentials
                        <Omit
                          label="Leave the essentials out"
                          disabled={draft.saving}
                          onClick={() => set("factsOff", true)}
                        />
                      </h3>
                      <p className="field-hint">
                        Wi-Fi, bins, heating, checkout &mdash; the questions you
                        answer every week. Up to {profileLimits.factsMax} lines,
                        and only ever on this wall.
                      </p>
                      <dl className="canvas-essentials">
                        {profile.facts.map((fact, index) => (
                          <div className="canvas-essential" key={index}>
                            <dt>
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
                            </dt>
                            <dd>
                              <CanvasParagraph
                                label={`Line ${index + 1}: answer`}
                                value={fact.detail}
                                placeholder={factExample(fact.term).detail}
                                maxLength={profileLimits.factDetailMax}
                                disabled={draft.saving}
                                invalid={factProblem(index) ? true : undefined}
                                className="canvas-essential-detail"
                                onChange={(value) =>
                                  setFact(index, "detail", value)
                                }
                              />
                              <CanvasParagraph
                                label={`Line ${index + 1}: detail`}
                                value={fact.note}
                                placeholder={factExample(fact.term).note}
                                maxLength={profileLimits.factNoteMax}
                                disabled={draft.saving}
                                className="canvas-essential-note"
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
                                onClick={() =>
                                  set(
                                    "facts",
                                    profile.facts.filter(
                                      (_, position) => position !== index,
                                    ),
                                  )
                                }
                                disabled={draft.saving}
                              >
                                Remove {fact.term.trim() || `line ${index + 1}`}
                              </button>
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {/* Suggestions rather than rows written into every new
                    property: nothing is here until a Host picks it. What a pick
                    brings is the whole line — label, answer and detail — not a
                    label with the answer left as an example. A label on its own
                    is drawn on this canvas but dropped from the wall, so the
                    line would read as written while guests never saw it. The
                    example answer is on the wall from the moment it is picked,
                    which is what makes correcting it the obvious next move. */}
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
                                onClick={() =>
                                  set("facts", [...profile.facts, { ...suggestion }])
                                }
                              />
                            ))}
                        </p>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          set("facts", [...profile.facts, emptyFact()])
                        }
                        disabled={
                          draft.saving ||
                          profile.facts.length >= profileLimits.factsMax
                        }
                      >
                        Add a line
                      </button>
                    </>
                  )}

                  {/* The box a guest types into used to be drawn here, above the
                    notes, greyed and captioned as theirs. It said one thing —
                    that guests write on the wall itself — and the line under
                    the notes says it in words, with the wall itself a click
                    away. What stands here now is the Host's own card, in the
                    grid, because that is where it will be read. */}
                  {hostNoteCards}
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
                        href={`/stay/${property.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open the in-stay wall as guests see it"
                      >
                        Open this wall as guests see it &rarr;
                      </a>
                    </GuestOnly>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="save-bar canvas-savebar">
            <button type="submit" disabled={draft.saving || !draft.dirty}>
              {draft.saving ? "Saving…" : "Save changes"}
            </button>
            {draft.problems.failure ? (
              <span className="save-note failed" role="alert">
                {draft.problems.failure}
              </span>
            ) : draft.saved ? (
              <span className="save-note" role="status">
                Saved. Your walls read this immediately.
              </span>
            ) : (
              <span className="save-note">
                {draft.dirty
                  ? "Unsaved changes. This is what they will read."
                  : "Everything here is saved."}
              </span>
            )}
          </div>
        </form>

        {showPhone && (
          <aside className="design-phone" aria-label="This wall on a phone">
            {/* The phone follows the canvas as it is typed, which is not obvious
              from a picture of a phone standing beside a page. One line says
              so, above the thing it is describing. */}
            {/* Which way the canvas lies depends on how wide the window is:
              beside the phone on a desk, above it once the column drops. The
              word is swapped rather than dropped, because "on the left" is
              the whole point of the sentence on the screen it is true of. */}
            <p className="design-phone-note">
              Edit the wall <span className="where-beside">on the left</span>
              <span className="where-above">above</span>. The phone follows as
              you type.
            </p>
            <WallPreview
              name={draft.name.trim() || property.name}
              profile={profile}
              counts={draft.counts}
              view={view}
            />
          </aside>
        )}
      </div>

      {/* One dialog for whichever photograph is being changed, rather than a
          panel per frame: only one can be open, and the wall it sits over
          stays exactly where the Host left it. */}
      {panel && (
        <PhotoDialog
          propertyId={property.id}
          slot={panel}
          photo={photoInSlot(profile, panel)}
          label={canvasPhoto(panel, panelNote).label}
          hint={canvasPhoto(panel, panelNote).hint}
          onChange={(photo) => {
            draft.setProfile(withPhotoInSlot(profile, panel, photo));
            // An uploaded photograph is already on the wall behind the dialog,
            // so it closes rather than showing the same picture twice.
            // Removing one leaves it open, because the next thing a Host wants
            // is usually to choose another.
            if (photo) setPanel(null);
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {settings && (
        <PropertySettingsDialog
          propertyId={property.id}
          slug={property.slug}
          draft={draft}
          onClose={() => navigate(`/host/property/${property.id}`)}
        />
      )}
    </PropertyShell>
  );
}
