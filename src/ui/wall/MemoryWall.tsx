import { MemoryNote } from "./MemoryNote";
import { wallPhotos, type WallPost } from "./demoWall";

/**
 * The demo walls' memories, drawn with the served wall's own note.
 *
 * Only guests' memories are on it. The hosts' own notes are not — see
 * `HostNotes`, which stands above this on the guest wall.
 */
export function MemoryWall({
  posts,
  heading,
}: {
  posts: WallPost[];
  heading: string;
}) {
  return (
    <>
      <h2 className="wall-heading" id="wall-memories">{heading}</h2>
      <section aria-label="Guest memories" className="note-grid">
        {posts.map((post, index) => {
          const photo = post.photo ? wallPhotos[post.photo] : undefined;
          return (
            <MemoryNote
              key={post.id}
              id={post.id}
              message={post.message}
              displayName={post.displayName}
              pinned={post.pinned}
              photos={photo ? [
                <img
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  /* The first row is above the fold on most screens. */
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                />
              ] : []}
            />
          );
        })}
      </section>
    </>
  );
}
