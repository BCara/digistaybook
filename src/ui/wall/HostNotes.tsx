import { initials, type WallPhoto } from "./demoWall";
import type { HostNoteStyle } from "../../domain/propertyProfile";

/**
 * The hosts' own notes on the wall.
 *
 * They used to be one note, pinned in among the guests' memories as the first
 * card in the grid, on the theory that a reader would tell it apart by its
 * paper. They did not: it read as a memory the hosts had left about their own
 * house, and the field is not for that. It is for the extra things a host
 * wants said — the ones that are not the welcome, not the Wi-Fi and not a
 * memory — so they are lifted out of the wall of memories entirely and given
 * their own panels above them, said in the hosts' voice and signed by them.
 *
 * There are several because a host with two things to say was writing both
 * into one paragraph. They stand together under one line saying whose they
 * are, so a stack of them still reads as the hosts speaking once.
 *
 * Each note is fixed to the wall the way its author chose — framed and squared
 * to the page, or tilted and pinned up like the memories below. Neither
 * variety carries a colour or a corner of its own: both are drawn from the
 * theme's tokens, so a note is on the same stock as the wall around it.
 */
/**
 * A photograph on a note. The demo knows its files' dimensions and a live wall
 * does not always, so the two numbers are optional: given, they reserve the
 * space before the file lands; missing, the frame's own aspect ratio holds it.
 */
export type WallNotePhoto = { src: string; alt: string; width?: number; height?: number };

export type WallHostNote = {
  id: string;
  message: string;
  style: HostNoteStyle;
  photo?: WallNotePhoto;
};

export function HostNotes({
  notes,
  author,
  /** The hosts' own photograph, when they have one; initials stand in otherwise. */
  portrait
}: {
  notes: readonly WallHostNote[];
  /** How the hosts sign the wall: "Ana & Tom". */
  author: string;
  portrait?: WallNotePhoto;
}) {
  if (notes.length === 0) return null;

  return (
    <aside className="host-notes" aria-label={`More from ${author}, who host here`}>
      {/* One line over the stack rather than one per note: a reader is being
          told whose these are, and being told it three times would read as
          three unrelated asides rather than as the hosts talking. */}
      <p className="host-note-eyebrow">More from your hosts</p>
      {notes.map((note) => (
        <article className="host-note" data-note-style={note.style} key={note.id}>
          <div className="host-note-body">
            {note.photo && (
              <div className="host-note-photo">
                <img
                  src={note.photo.src}
                  alt={note.photo.alt}
                  width={note.photo.width}
                  height={note.photo.height}
                  loading="eager"
                  decoding="async"
                />
              </div>
            )}
            <div className="host-note-words">
              {note.message && <p className="host-note-message">{note.message}</p>}
              {author && (
                <p className="host-note-sign">
                  <b>{author}</b>
                </p>
              )}
            </div>
          </div>
        </article>
      ))}
    </aside>
  );
}
