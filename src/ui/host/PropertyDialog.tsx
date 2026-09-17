import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { generatePropertySlug } from "../../domain/property";
import { profileLimits, validatePhotoFile, type PropertyPhoto } from "../../domain/propertyProfile";
import { emptyWizardDraft, wizardProfile, type WizardDraft } from "../../domain/propertyWizard";
import { PhotoDropTarget, PhotoField } from "./PhotoField";
import { photoCopy, PropertyWizard } from "./PropertyWizard";
import { createProperty, uploadPropertyPhoto, type HostProperty } from "./propertyStore";
import {
  hostNoteOfSlot,
  hostNoteSlot,
  photoInSlot,
  withPhotoInSlot,
  type PhotoSlot
} from "./photoSlots";
import type { PropertyDraft } from "./usePropertyDraft";

/**
 * The property, over the page rather than in it.
 *
 * Adding a property used to be a panel that unfolded down the dashboard, and
 * changing one was a separate page reached from the band. They asked
 * overlapping questions in different words and neither held the whole
 * property, so a Host filling one in went round all three surfaces to do it.
 *
 * Both are this window now. It is modal in the full sense — the page behind is
 * inert to a screen reader, Escape and the scrim close it, Tab stays inside,
 * and the control that opened it gets focus back — because in both cases a
 * Host is answering about a property and then going back to what they were
 * looking at. The dashboard stays behind the one, and the wall the Host is
 * building stays behind the other.
 */

/**
 * Everything inside the panel a Tab can land on, in the order it lands. The
 * file inputs are skipped: they are deliberately off-screen, driven by the
 * buttons beside them.
 */
function focusable(panel: HTMLElement) {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      "button:not(:disabled), [href], input:not(:disabled):not(.visually-hidden), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"
    )
  );
}

function PropertyDialogFrame({
  title,
  lede,
  onClose,
  children
}: {
  title: string;
  lede?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    // Without this a Tab off the last control lands on the page underneath,
    // which is the page this dialog has just told a screen reader to ignore.
    const stops = focusable(panel.current);
    if (stops.length === 0) return;
    const edge = event.shiftKey ? stops[0]! : stops[stops.length - 1]!;
    if (document.activeElement === edge || document.activeElement === panel.current) {
      event.preventDefault();
      (event.shiftKey ? stops[stops.length - 1]! : stops[0]!).focus();
    }
  }

  // The scrim closes on a press that both starts and ends on it, so a drag
  // that began inside the panel and finished on the backdrop does not.
  function onScrim(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div className="property-dialog-scrim" onMouseDown={onScrim}>
      <div
        className="property-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-dialog-title"
        tabIndex={-1}
        ref={panel}
        onKeyDown={onKeyDown}
      >
        <header className="property-dialog-head">
          <h2 id="property-dialog-title">{title}</h2>
          {lede && <p className="lede">{lede}</p>}
        </header>
        <div className="property-dialog-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------ Adding one ------------------------------ */

/** A file waiting for a property to exist, and the preview shown meanwhile. */
type Staged = { file: File; preview: string };

export type PropertyWizardResult = {
  property: HostProperty;
  /** Set when the property was created but a photograph did not upload. */
  photoWarning: string | null;
};

type Phase = "editing" | "creating" | "uploading";

/**
 * The order photographs are uploaded in, which is the order they are asked
 * for. The property's own three are fixed; the notes are however many the Host
 * has written by the time they press the button, so they are read off the
 * draft rather than listed here.
 */
const photoSlotsOf = (draft: WizardDraft): PhotoSlot[] => [
  "avatar",
  "cover",
  "hostPhoto",
  ...draft.profile.hostNotes.map(hostNoteSlot)
];

/**
 * Adding a property.
 *
 * Nothing is written until the last step. The property is created in one
 * write, from the answers, and the photographs are uploaded straight after it:
 * a file can only be stored against a property that exists, so they are held
 * on the device until there is somewhere to put them. That is also why a
 * failed upload comes back as a warning rather than a failure — by then the
 * property is real, and telling a Host it was not created would be a lie.
 */
export function AddPropertyDialog({
  ownerUid,
  takenSlugs,
  onCancel,
  onCreated
}: {
  ownerUid: string | null;
  /** The addresses this Host already holds, so two properties never collide. */
  takenSlugs: readonly string[];
  onCancel: () => void;
  onCreated: (result: PropertyWizardResult) => void;
}) {
  const [draft, setDraft] = useState<WizardDraft>(emptyWizardDraft);
  const [staged, setStaged] = useState<Partial<Record<PhotoSlot, Staged>>>({});
  const [refused, setRefused] = useState<Partial<Record<PhotoSlot, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("editing");

  const fileInputs = useRef<Partial<Record<PhotoSlot, HTMLInputElement | null>>>({});
  const busy = phase !== "editing";

  // An object URL is a live handle on the file; releasing it keeps a Host who
  // tries several photographs from holding all of them in memory.
  useEffect(() => () => {
    Object.values(staged).forEach((entry) => entry && URL.revokeObjectURL(entry.preview));
  }, [staged]);

  function pickFile(slot: PhotoSlot, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the control so choosing the same file twice still fires a change.
    event.target.value = "";
    if (!file) return;
    const rejected = validatePhotoFile(file);
    if (rejected) {
      setRefused((current) => ({ ...current, [slot]: rejected }));
      return;
    }
    const previous = staged[slot];
    if (previous) URL.revokeObjectURL(previous.preview);
    setRefused((current) => ({ ...current, [slot]: undefined }));
    setStaged((current) => ({ ...current, [slot]: { file, preview: URL.createObjectURL(file) } }));
  }

  function dropFile(slot: PhotoSlot) {
    const previous = staged[slot];
    if (previous) URL.revokeObjectURL(previous.preview);
    setRefused((current) => ({ ...current, [slot]: undefined }));
    setStaged((current) => ({ ...current, [slot]: undefined }));
  }

  /**
   * Upload what was staged, once there is a property to store it against.
   * Each photograph is reported on by name: a Host who chose two and lost one
   * should be told which, rather than that "a photograph" did not upload.
   */
  async function uploadStaged(propertyId: string) {
    const uploaded: Partial<Record<PhotoSlot, PropertyPhoto>> = {};
    const warnings: string[] = [];

    const slots = photoSlotsOf(draft);
    for (const [position, slot] of slots.entries()) {
      const entry = staged[slot];
      if (!entry) continue;
      const outcome = await uploadPropertyPhoto(propertyId, slot, entry.file);
      if (outcome.status === "error") {
        // Notes are numbered from one wherever they stand in the list, which
        // is what the form beside them calls them.
        const note = hostNoteOfSlot(slot) === null ? undefined : position - 2;
        warnings.push(`The ${photoCopy(slot, note).label.toLowerCase()} did not upload: ${outcome.message}`);
      } else {
        uploaded[slot] = outcome.value;
      }
    }

    return { uploaded, warning: warnings.join(" ") || null };
  }

  async function create() {
    if (busy || !ownerUid) return;
    setFailure(null);

    // The wall address is derived here, at the one moment it is ever decided.
    const slug = generatePropertySlug(draft.name, { takenSlugs });

    setPhase("creating");
    const outcome = await createProperty(ownerUid, {
      name: draft.name.trim(),
      slug,
      profile: wizardProfile(draft)
    });
    if (outcome.status === "error") {
      setPhase("editing");
      setFailure(outcome.message);
      return;
    }

    let property = outcome.value;
    let photoWarning: string | null = null;
    if (photoSlotsOf(draft).some((slot) => staged[slot])) {
      setPhase("uploading");
      const { uploaded, warning } = await uploadStaged(property.id);
      photoWarning = warning;
      // Each photograph goes back where its slot says: the property's own on
      // the profile, a note's on the note it was chosen for.
      property = {
        ...property,
        profile: Object.entries(uploaded).reduce(
          (profile, [slot, photo]) => withPhotoInSlot(profile, slot as PhotoSlot, photo ?? null),
          property.profile
        )
      };
    }

    setPhase("editing");
    onCreated({ property, photoWarning });
  }

  function renderPhoto(slot: PhotoSlot, position?: number) {
    const copy = photoCopy(slot, position);
    const chosen = staged[slot];
    const problem = refused[slot];

    return (
      <div className="photo-field" key={slot}>
        <label htmlFor={`photo-input-${slot}`}>
          {copy.label}<span className="label-optional">Optional</span>
        </label>
        {copy.hint && <p className="field-hint">{copy.hint}</p>}

        {chosen ? (
          <figure className="photo-preview">
            <img src={chosen.preview} alt="" />
            <figcaption>{chosen.file.name}</figcaption>
          </figure>
        ) : (
          <PhotoDropTarget
            label={copy.label}
            disabled={busy}
            onChoose={() => fileInputs.current[slot]?.click()}
          />
        )}
        {problem && <p className="form-feedback" role="alert">{problem}</p>}

        {chosen && (
          <div className="actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => fileInputs.current[slot]?.click()}
            >
              Choose a different photograph
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => dropFile(slot)}>
              Remove
            </button>
          </div>
        )}

        {/* Hidden because a bare file input cannot be styled or labelled well;
            the visible button above drives it. */}
        <input
          ref={(element) => {
            fileInputs.current[slot] = element;
          }}
          id={`photo-input-${slot}`}
          className="visually-hidden"
          type="file"
          accept={profileLimits.photoTypes.join(",")}
          aria-label={`${copy.label}: choose an image file`}
          onChange={(event) => pickFile(slot, event)}
        />
      </div>
    );
  }

  return (
    <PropertyDialogFrame title="Add a property" onClose={onCancel}>
      <PropertyWizard
        draft={draft}
        onDraft={setDraft}
        renderPhoto={renderPhoto}
        submitLabel="Create property"
        busy={phase === "creating" ? "Creating property…" : phase === "uploading" ? "Uploading photographs…" : null}
        failure={failure}
        onSubmit={() => void create()}
        onCancel={onCancel}
      />
    </PropertyDialogFrame>
  );
}

/* ----------------------------- Changing one ----------------------------- */

/**
 * The settings of a property that already exists.
 *
 * It asks the same questions in the same order, over whichever screen the Host
 * was on. The difference is what happens to an answer: the property is there,
 * so a photograph is stored the moment it is chosen and the words are saved by
 * the button on the last step. The draft belongs to the page underneath, which
 * is what keeps the band overhead and the wall behind the window from lagging
 * what is being typed into it.
 */
export function PropertySettingsDialog({
  propertyId,
  slug,
  draft,
  onClose
}: {
  propertyId: string;
  slug: string;
  draft: PropertyDraft;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);

  async function save() {
    await draft.save();
    setSaved(true);
  }

  // A save that failed leaves its reason on the draft, so the window stays
  // open on the answers rather than closing over a write that did not happen.
  useEffect(() => {
    if (!saved) return;
    if (draft.saving) return;
    if (draft.problems.failure || draft.problems.identity.length > 0 || draft.problems.profile.length > 0) {
      setSaved(false);
      return;
    }
    onClose();
  }, [saved, draft.saving, draft.problems, onClose]);

  return (
    <PropertyDialogFrame
      title="Property settings"
      lede="The wall behind this window updates as you type."
      onClose={onClose}
    >
      <PropertyWizard
        draft={{ name: draft.name, profile: draft.profile }}
        onDraft={(next) => {
          if (next.name !== draft.name) draft.setName(next.name);
          if (next.profile !== draft.profile) draft.setProfile(next.profile);
        }}
        renderPhoto={(slot, position) => (
          <PhotoField
            key={slot}
            propertyId={propertyId}
            slot={slot}
            photo={photoInSlot(draft.profile, slot)}
            label={photoCopy(slot, position).label}
            hint={photoCopy(slot, position).hint}
            onChange={(photo) => draft.setProfile(withPhotoInSlot(draft.profile, slot, photo))}
          />
        )}
        address={
          <>
            <p className="wall-address"><code>/wall/{slug}</code></p>
            <p className="field-hint">
              Fixed when the property was created, because it is printed on your QR placard. Renaming the property
              does not change it.{" "}
              <a className="text-link" href={`/host/property/${propertyId}/qr`}>Walls and QR display &rarr;</a>
            </p>
          </>
        }
        submitLabel="Save changes"
        busy={draft.saving ? "Saving…" : null}
        failure={draft.problems.failure}
        onSubmit={() => void save()}
        onCancel={onClose}
      />
    </PropertyDialogFrame>
  );
}
