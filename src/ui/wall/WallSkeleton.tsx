/**
 * What a guest looks at while the wall is being fetched.
 *
 * A guest opens this standing in a hallway on a phone, often on the property's
 * own patchy wifi, so the wait is not always brief. Rather than a line of text
 * on an empty page, the wait shows the shape of the thing arriving: a cover
 * band, a property heading, and the first memories. When the wall lands it
 * replaces this in the same places, so nothing jumps.
 *
 * Only the status line is announced. Everything else is scaffolding and is
 * hidden from assistive technology.
 */
export function WallSkeleton({ view = "public", label }: { view?: "public" | "stay"; label: string }) {
  return <div className="wall-skeleton">
    <p className="wall-skeleton-status" role="status">
      <span className="wall-skeleton-spinner" aria-hidden="true" />
      {label}
    </p>
    <div className="wall-skeleton-body" aria-hidden="true">
      <div className="wall-skeleton-cover" />
      <div className="wall-skeleton-head">
        <span className="wall-skeleton-bar w-location" />
        <span className="wall-skeleton-bar w-title" />
        <span className="wall-skeleton-bar w-welcome" />
        <span className="wall-skeleton-bar w-welcome-end" />
      </div>
      <div className="wall-skeleton-byline">
        <span className="wall-skeleton-avatar" />
        <span className="wall-skeleton-bar w-host" />
      </div>
      {/* The in-stay wall carries house guidance above the memories; the
          public wall never does, so the wait does not promise it one. */}
      {view === "stay" && <div className="wall-skeleton-panel">
        <span className="wall-skeleton-bar w-panel-title" />
        <span className="wall-skeleton-bar w-line" />
        <span className="wall-skeleton-bar w-line-end" />
      </div>}
      <div className="wall-skeleton-notes">
        {[0, 1, 2, 3].map(index => <div className="wall-skeleton-note" key={index}>
          <span className="wall-skeleton-bar w-line" />
          <span className="wall-skeleton-bar w-line" />
          <span className="wall-skeleton-bar w-line-end" />
          <span className="wall-skeleton-bar w-sign" />
        </div>)}
      </div>
    </div>
  </div>;
}
