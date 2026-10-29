import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { MemoryNote } from "../wall/MemoryNote";
import { MemoryPhoto } from "../wall/MemoryPhoto";
import { loadPreviewMemories, type PreviewMemoriesPage } from "./wallPreviewStore";
import type { WallView } from "./WallPreview";

export function PreviewMemories({ slug, view, token, propertyId }: {
  slug: string;
  view: WallView;
  token: string | null;
  /** The owner's own property: a wall that is not open yet serves its photos only to them. */
  propertyId?: string;
}) {
  const auth = useAuth();
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
      {page?.posts.map(post => <MemoryNote key={post.id} id={post.id} message={post.message} displayName={post.displayName} pinned={post.pinned}
        photos={Array.from({ length: post.photoCount ?? 0 }, (_, index) => <MemoryPhoto postId={post.id} index={index} ownerPropertyId={propertyId} sessionUid={auth.user?.uid} />)} />)}
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
