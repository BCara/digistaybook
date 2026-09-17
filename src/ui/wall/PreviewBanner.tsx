import { wallUnavailableReason } from "../../domain/wallAvailability";

export type WallOwner = { propertyId: string; lifecycle: string; mode: string; publicWallOff: boolean };

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
          {guestView ? "Back to your preview" : "Guest's view"}
        </button>
        <a className="btn btn-secondary btn-sm" href={`${base}${view === "public" ? "/public" : ""}`}>Edit this wall</a>
        <a className="btn btn-primary btn-sm" href={`${base}/${reason.section}`}>{reason.action}</a>
      </div>
    </aside>
  );
}
