import { useEffect, useState } from "react";
import { guestPhotoUrl } from "../../lib/guestSession";
import { loadPreviewMemories, type PreviewMemoriesPage } from "./wallPreviewStore";
import type { WallView } from "./WallPreview";

export function PreviewMemories({ slug, view, token }: {
  slug: string;
  view: WallView;
  token: string | null;
}) {
  const [page, setPage] = useState<PreviewMemoriesPage | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setBusy(true);
    setError(null);
    void loadPreviewMemories(slug, view, token, cursor).then(result => {
      if (!current) return;
      if (result.status === "error") setError(result.message);
      else setPage(previous => ({
        ...result.value,
        posts: cursor && previous
          ? [...previous.posts, ...result.value.posts.filter(post => !previous.posts.some(existing => existing.id === post.id))]
          : result.value.posts
      }));
      setBusy(false);
    });
    return () => { current = false; };
  }, [slug, view, token, cursor, attempt]);

  return <section aria-label="Guest memories">
    <div className="note-grid">
      {page?.posts.map(post => <article className="note" key={post.id}>
        {Array.from({ length: post.photoCount ?? 0 }, (_, index) => <img key={index} src={guestPhotoUrl(post.id, index)} alt={`Guest memory photo ${index + 1}`} loading="lazy" />)}
        <p>{post.message}</p>
        {post.displayName?.trim() && <p>{post.displayName}</p>}
      </article>)}
      {page && !page.posts.length && <p className="field-hint">No memories yet.</p>}
    </div>
    {busy && <p className="field-hint" role="status">Loading memories…</p>}
    {error && <>
      <p className="field-hint" role="status">{error}</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </>}
    {!error && page?.nextCursor && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setCursor(page.nextCursor!)}>
      {busy ? "Loading…" : "Load more memories"}
    </button>}
  </section>;
}
