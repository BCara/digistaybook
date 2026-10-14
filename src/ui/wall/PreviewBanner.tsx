import { wallUnavailableReason } from "../../domain/wallAvailability";

export type WallOwner = { propertyId: string; lifecycle: string; mode: string; publicWallOff: boolean };

function ActionIcon({ action }: { action: "view" | "edit" | "next" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {action === "view" && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
    {action === "edit" && <><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z" /><path d="M13 20h7" /></>}
    {action === "next" && <><path d="M5 12h14m-6-6 6 6-6 6" /></>}
  </svg>;
}

/**
 * The bar an owner reads above their own closed wall.
 *
 * A Host is asked to publish a wall, which means they have to be able to read
 * it first. The server serves a closed wall to the account that owns it, and
 * this says the one thing the content itself cannot: nobody else is seeing any
 * of it.
 *
 * It is one row and it sticks, because it is chrome rather than wall — on a
 * long wall a card at the top scrolls away and takes the only reminder with
 * it, and a Host who has forgotten which of the two they are reading is the
 * whole failure this bar exists to prevent. The reason's own wording is left
 * to the action button: "Choose a plan and publish" says more about what to do
 * next than a sentence explaining draft state, and says it in three words.
 */
export function PreviewBanner({
  owner, view, guestView, onGuestView
}: {
  owner: WallOwner;
  view: "stay" | "public";
  guestView: boolean;
  onGuestView: (next: boolean) => void;
}) {
  const reason = wallUnavailableReason(owner, view);
  const base = `/host/property/${encodeURIComponent(owner.propertyId)}`;
  return (
    <aside className="wall-preview-bar" aria-label="Preview of a closed wall">
      <p className="wall-preview-status">
        <span className="wall-preview-chip">Preview</span>
        <b>{reason.title}</b>
        <span>Only you can see this. Guests get a closed notice.</span>
      </p>
      <div className="wall-preview-actions">
        <button type="button" className="btn btn-secondary btn-sm" aria-pressed={guestView} onClick={() => onGuestView(!guestView)}>
          <ActionIcon action="view" />
          <span>{guestView ? "Back to your preview" : "Guest's view"}</span>
        </button>
        <a className="btn btn-secondary btn-sm" href={`${base}${view === "public" ? "/public" : ""}`}><ActionIcon action="edit" /><span>Edit this wall</span></a>
        <a className="btn btn-primary btn-sm" href={`${base}/${reason.section}`}><ActionIcon action="next" /><span>{reason.action}</span></a>
      </div>
    </aside>
  );
}
