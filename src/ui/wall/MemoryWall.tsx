import { formatDate, initials, tiltIndex, toneIndex, wallPhotos, type WallPost } from "./demoWall";

/**
 * The shared wall of guest memories.
 *
 * Both wall routes render this. The public wall shows it alone; the in-stay
 * wall shows it under the host's welcome and house guidance.
 */
export function MemoryWall({ posts, heading }: { posts: WallPost[]; heading: string }) {
  return (
    <section className="memory-wall" aria-labelledby="memory-wall-heading">
      <h2 className="wall-heading" id="memory-wall-heading">{heading}</h2>
      <div className="note-grid">
        {posts.map((post, index) => {
          const author = post.displayName ?? "A guest";
          const photo = post.photo ? wallPhotos[post.photo] : undefined;
          return (
            <article className={`note tilt-${tiltIndex(post.id)}`} key={post.id}>
              {photo && (
                <div className="note-photo">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    width={photo.width}
                    height={photo.height}
                    /* The first row is above the fold on most screens. */
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              )}
              <p className="note-message">{post.message}</p>
              <footer className="note-sign">
                <span className={`avatar tone-${toneIndex(author)}`} aria-hidden="true">{initials(author)}</span>
                <span className="note-author">
                  <b>{author}</b>
                  <time dateTime={post.createdAt} title={`Posted ${formatDate(post.createdAt)}`}>
                    Stayed {post.stayedOn}
                  </time>
                </span>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
