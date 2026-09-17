import { useEffect, useState } from "react";
import { getFirebaseServices } from "../../lib/firebase";
import "../guest/guest.css";

type ReviewPost = { id: string; status: string; message: string; revision: number; photoCount: number };
type Result = { posts: ReviewPost[]; feedback: { id: string; message: string }[]; reviewCursor?: string | null; feedbackCursor?: string | null };
export async function hostCall<T>(name: string, data: unknown): Promise<T> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Unavailable");
  const { httpsCallable } = await import("firebase/functions");
  return (await httpsCallable<unknown, T>(services.functions, name)(data)).data;
}
export function GuestReviewPanel({ propertyId, feedbackOnly = false }: { propertyId: string; feedbackOnly?: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const kind = feedbackOnly ? "feedback" : "review";
  const refresh = async () => { setResult(await hostCall<Result>("listHostGuestReview", { propertyId, kind })); setPhotos({}); };
  useEffect(() => { let active = true;
    setResult(null); setPhotos({}); setNotice("");
    void hostCall<Result>("listHostGuestReview", { propertyId, kind }).then(data => { if (active) setResult(data); })
      .catch(() => { if (active) setNotice("This inbox could not be loaded. Try refreshing."); });
    return () => { active = false; };
  }, [propertyId, kind]);
  async function loadMore() {
    if (busy || !result) return;
    setBusy(true); setNotice("");
    try {
      const page = await hostCall<Result>("listHostGuestReview", { propertyId, kind,
        ...(feedbackOnly ? { feedbackCursor: result.feedbackCursor } : { reviewCursor: result.reviewCursor }) });
      setResult(previous => previous ? { ...page,
        posts: [...new Map([...previous.posts, ...page.posts].map(post => [post.id, post])).values()],
        feedback: [...new Map([...previous.feedback, ...page.feedback].map(item => [item.id, item])).values()] } : page);
    } catch { setNotice("More items could not be loaded. Try again."); }
    finally { setBusy(false); }
  }
  async function act(post: ReviewPost, action: "approve" | "reject") {
    setBusy(true); setNotice("");
    try { await hostCall("reviewGuestContribution", { id: post.id, revision: post.revision, action }); await refresh(); setNotice(action === "approve" ? "The memory is now published." : "The memory remains off the wall."); }
    catch { setNotice("The memory could not be changed. Refresh the queue and try again."); }
    finally { setBusy(false); }
  }
  async function loadPhotos(post: ReviewPost) {
    setBusy(true);
    try {
      const loaded: string[] = [];
      for (let index = 0; index < post.photoCount; index++) {
        const result = await hostCall<{ base64: string }>("readGuestReviewPhoto", { id: post.id, index });
        loaded.push(`data:image/webp;base64,${result.base64}`);
      }
      setPhotos(previous => ({ ...previous, [post.id]: loaded }));
    } catch { setNotice("These photos are no longer available for review. Refresh the queue."); }
    finally { setBusy(false); }
  }
  return <section className="guest-review" aria-label={feedbackOnly ? "Private feedback inbox" : "Guest safety review"}>
    <div className="review-heading">
      <h2>{feedbackOnly ? "Private feedback" : "Guest safety review"}</h2>
      {!feedbackOnly && result && <span className="review-status">{result.posts.length === 0 ? "All clear" : `${result.posts.length} to review`}</span>}
      <button className="btn btn-sm btn-secondary" aria-label="Refresh inbox" disabled={busy} onClick={() => void refresh().catch(() => setNotice("The inbox could not be refreshed."))}>Refresh</button>
    </div>
    {feedbackOnly && <p>Private guest feedback. Replies aren’t supported.</p>}
    {notice && <p role="status">{notice}</p>}
    {!result && !notice && <p role="status">Loading inbox…</p>}
    {feedbackOnly ? result?.feedback.map(item => <article key={item.id}><p>{item.message}</p></article>) : result?.posts.map(post => <article key={post.id}>
      <p>{post.message}</p><p>{post.status === "pending" ? "Awaiting safety screening" : "Ready for host review"}</p>
      {post.status === "standard" && <>
        {post.photoCount > 0 && <button disabled={busy} onClick={() => void loadPhotos(post)}>View {post.photoCount} photos</button>}
        {photos[post.id]?.map((src, index) => <img key={index} src={src} alt={`Memory photo ${index + 1} for review`} />)}
        <button disabled={busy} onClick={() => void act(post, "approve")}>Approve memory</button>
        <button disabled={busy} onClick={() => void act(post, "reject")}>Keep off wall</button>
      </>}
    </article>)}
    {feedbackOnly && result?.feedback.length === 0 && <p>No feedback yet.</p>}
    {(feedbackOnly ? result?.feedbackCursor : result?.reviewCursor) && <button disabled={busy} onClick={() => void loadMore()}>{feedbackOnly ? "Load more feedback" : "Load more submissions"}</button>}
  </section>;
}
