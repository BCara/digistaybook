import type { ReactNode } from "react";
import { initials, tiltIndex, toneIndex } from "./demoWall";
import "../guest/guest.css";

/**
 * The pieces every wall is built from below the header: a guest's memory, the
 * way to add one, and the two links that end the page.
 *
 * The served wall, the phone preview in the editor and the two demo walls each
 * used to draw these themselves, and they drifted: the demo signed its notes
 * with an avatar the real wall never drew, the preview dropped the Host's
 * favourite mark, and none of the three ended the same way. They are drawn
 * here once so that what a Host previews, what a visitor demos and what a
 * guest reads are the same wall.
 */

export function MemoryNote({ id, message, displayName, pinned = false, photos = [], stayedOn, createdAt, children }: {
  id: string;
  message: string;
  displayName?: string;
  pinned?: boolean;
  /** One node per photograph, each already drawn by the caller. */
  photos?: ReactNode[];
  /** "June 2026". Only the demo knows when a guest stayed. */
  stayedOn?: string;
  createdAt?: string;
  /** Anything that belongs to the note but is not part of it, such as the report flag. */
  children?: ReactNode;
}) {
  const author = displayName?.trim() ?? "";
  return (
    <article className={`note tilt-${tiltIndex(id)}${pinned ? " note-pinned" : ""}`}>
      {pinned && <span className="note-pinned-label">Host favorite</span>}
      {photos.map((photo, index) => <div className="note-photo" key={index}>{photo}</div>)}
      <p className="note-message">{message}</p>
      {(author || stayedOn) && (
        <footer className="note-sign">
          {author && <span className={`avatar tone-${toneIndex(author)}`} aria-hidden="true">{initials(author)}</span>}
          <span className="note-author">
            {author && <b>{author}</b>}
            {stayedOn && <time dateTime={createdAt}>Stayed {stayedOn}</time>}
          </span>
        </footer>
      )}
      {children}
    </article>
  );
}

/**
 * The end of the guest wall: the invitation and the two ways to answer it.
 * In the editor's phone it is drawn `inert`, so it looks exactly as a guest
 * will meet it without being something a Host can press.
 */
export function WallContributionPrompt({ prompt, onMemory, onFeedback, inert = false }: {
  prompt?: string;
  onMemory?: () => void;
  onFeedback?: () => void;
  inert?: boolean;
}) {
  return (
    <div className="wall-contribution-choices wall-contribution-panel" inert={inert}>
      <p className="wall-contribution-lede">{prompt?.trim() || "Leave a memory from your stay."}</p>
      <button type="button" className="btn btn-primary" aria-expanded={false} aria-controls="wall-contribution" onClick={onMemory}>
        Add to guestbook
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {/* A guest with a complaint should not have to guess that it lives
          behind the guestbook, so the private route is offered by name. */}
      <button type="button" className="btn btn-ghost" aria-expanded={false} aria-controls="wall-contribution" onClick={onFeedback}>Private feedback</button>
    </div>
  );
}

/**
 * The guestbook offered again near the top of the in-stay wall. It sits in the
 * page like the essentials around it rather than floating over them, and opens
 * the same form the closing panel does.
 */
export function GuestbookShortcut({ onMemory }: { onMemory: () => void }) {
  return (
    <aside className="stay-guestbook-shortcut stay-card" aria-label="The guestbook">
      <p>Enjoying your stay? Leave a memory for the guestbook.</p>
      <button type="button" className="btn btn-secondary btn-sm" aria-expanded={false} aria-controls="wall-contribution" onClick={onMemory}>
        Add to guestbook
      </button>
    </aside>
  );
}

/**
 * The two links every wall carries, wherever the page got to: the wall, the
 * closed notice and the failure all end here. They are the only chrome on a
 * guest's page, so they sit under a rule and stay quiet.
 */
export function WallFooter() {
  return (
    <footer className="wall-footer">
      <p><a href="/privacy-safety">Privacy &amp; Safety</a></p>
      <p className="wall-footer-brand">
        <a href="/" aria-label="Powered by DigiStayBook: create a digital guestbook for your property">Powered by DigiStayBook</a>
      </p>
    </footer>
  );
}
