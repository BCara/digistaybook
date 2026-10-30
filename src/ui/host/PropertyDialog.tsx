import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { generatePropertySlug, propertyIdentityLimits, validatePropertyName } from "../../domain/property";
import { emptyProfile } from "../../domain/propertyProfile";
import { PhotoField } from "./PhotoField";
import { photoCopy, PropertyWizard } from "./PropertyWizard";
import { createProperty, type HostProperty } from "./propertyStore";
import {
  photoInSlot,
  withPhotoInSlot,
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

export type PropertyWizardResult = { property: HostProperty; photoWarning: string | null };

/** Creation asks only for a name. Everything else is reviewed on the sections page. */
export function AddPropertyDialog({ ownerUid, takenSlugs, onCancel, onCreated }: {
  ownerUid: string | null;
  takenSlugs: readonly string[];
  onCancel: () => void;
  onCreated: (result: PropertyWizardResult) => void;
}) {
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Retrying an interrupted response reuses the server's idempotent reservation.
  const attempt = useRef<{ name: string; slug: string } | null>(null);
  async function create() {
    if (inFlight.current || !ownerUid) return;
    const problem = validatePropertyName(name)[0]?.message;
    setFailure(problem ?? null);
    if (problem) return;
    const trimmed = name.trim();
    if (attempt.current?.name !== trimmed) attempt.current = { name: trimmed, slug: generatePropertySlug(trimmed, { takenSlugs }) };
    inFlight.current = true; setBusy(true);
    try {
      const outcome = await createProperty(ownerUid, { name: trimmed, slug: attempt.current.slug, profile: emptyProfile() });
      if (outcome.status === "error") { setFailure(outcome.message); return; }
      onCreated({ property: outcome.value, photoWarning: null });
    } catch { setFailure("Your property could not be created. Check your connection and try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <PropertyDialogFrame title="Add a property" onClose={() => { if (!inFlight.current) onCancel(); }}>
    <form className="property-name-form" onSubmit={event => { event.preventDefault(); void create(); }} noValidate>
      <label>Property name<input value={name} maxLength={propertyIdentityLimits.nameMax} autoComplete="off" required disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <p className="field-hint">Next, review your sections and add the details you want. Your property starts private.</p>
      {failure && <p className="form-feedback" role="alert">{failure}</p>}
      <div className="actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy || !ownerUid}>{busy ? "Creating property…" : "Continue"}</button></div>
    </form>
  </PropertyDialogFrame>;
}

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
              <a className="text-link" href={`/host/property/${propertyId}/qr`}>QR code and sharing &rarr;</a>
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
