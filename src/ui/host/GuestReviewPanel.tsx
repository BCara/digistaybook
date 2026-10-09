import { useEffect, useState } from "react";
import { getFirebaseServices } from "../../lib/firebase";
import "../guest/guest.css";

type ReviewPost = { id: string; status: string; message: string; displayName?: string; revision: number; photoCount: number };
type Result = { posts: ReviewPost[]; feedback: { id: string; message: string }[]; reviewContent?: boolean; reviewCursor?: string | null; feedbackCursor?: string | null };
export async function hostCall<T>(name: string, data: unknown): Promise<T> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Unavailable");
  const { httpsCallable } = await import("firebase/functions");
  return (await httpsCallable<unknown, T>(services.functions, name)(data)).data;
}
type PanelProps = {
  propertyId: string; feedbackOnly?: boolean;
  /** Told how many memories wait, so a page can say "all caught up" once for every inbox. */
  onCount?: (count: number) => void;
  /** Draw nothing but the switch while the inbox is empty. */
  collapseWhenEmpty?: boolean;
  /** Changing it reads the inbox again. */
  refreshSignal?: number;
} & (
  | { settingsOnly: true; reviewContent: boolean; onReviewContentSaved?: (reviewContent: boolean) => void }
  | { settingsOnly?: false; reviewContent?: never; onReviewContentSaved?: never }
);
export function GuestReviewPanel({ propertyId, feedbackOnly = false, settingsOnly = false, reviewContent, onReviewContentSaved, onCount, collapseWhenEmpty = false, refreshSignal = 0 }: PanelProps) {
  const [result, setResult] = useState<Result | null>(() => settingsOnly ? { posts: [], feedback: [], reviewContent } : null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const kind = feedbackOnly ? "feedback" : "review";
  const refresh = async () => { setResult(await hostCall<Result>("listHostGuestReview", { propertyId, kind })); setPhotos({}); };
  useEffect(() => { let active = true;
    // The QR page already read the policy with the property. Opening its
    // switch must not start (or wait for) a moderation inbox request.
    if (settingsOnly) return;
    // The switch stays drawn while the inbox is read again; only the
    // memories under it are replaced.
    setPhotos({}); setNotice("");
    void hostCall<Result>("listHostGuestReview", { propertyId, kind }).then(data => { if (active) setResult(data); })
      .catch(() => { if (active) setNotice("This inbox could not be loaded. Try refreshing."); });
    return () => { active = false; };
  }, [propertyId, kind, settingsOnly, refreshSignal]);
  const waiting = result?.posts.length;
  useEffect(() => { if (!settingsOnly && !feedbackOnly && waiting !== undefined) onCount?.(waiting); }, [waiting, settingsOnly, feedbackOnly, onCount]);
  const collapsed = collapseWhenEmpty && !feedbackOnly && result?.posts.length === 0 && !result.reviewCursor && !notice;
  useEffect(() => {
    if (settingsOnly) setResult({ posts: [], feedback: [], reviewContent });
  }, [settingsOnly, reviewContent]);
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
  async function setReviewContent(reviewContent: boolean) {
    setBusy(true); setNotice("");
    try {
      const saved = await hostCall<{ reviewContent: boolean }>("setGuestReviewPolicy", { propertyId, reviewContent });
      setResult(previous => previous ? { ...previous, reviewContent: saved.reviewContent } : previous);
      onReviewContentSaved?.(saved.reviewContent);
      setNotice(saved.reviewContent ? "New memories will wait for your approval after screening." : "Clear new memories can publish automatically after screening. Memories already waiting still need review.");
    } catch { setNotice("The review setting could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  async function report(id: string) {
    if (!window.confirm("Send this message to the DigiStayBook safety team? It will leave your inbox and only come back if they find it acceptable.")) return;
    setBusy(true); setNotice("");
    try {
      await hostCall("reportPrivateFeedback", { propertyId, id });
      setResult(previous => previous ? { ...previous, feedback: previous.feedback.filter(item => item.id !== id) } : previous);
      setNotice("Reported. The safety team will review this message.");
    } catch { setNotice("The message could not be reported. Refresh the inbox and try again."); }
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
  return <>
    {/* One slim bar: the switch already names the setting, so a heading and a
        paragraph restating it only pushed the memories down the page. */}
    {!feedbackOnly && result && <section className={`approval-settings${settingsOnly ? " approval-settings-compact" : ""}`} aria-label="Memory approval">
      <label className="switch approval-switch">
        <input type="checkbox" aria-describedby="approval-settings-note" checked={result.reviewContent === true} disabled={busy} onChange={event => void setReviewContent(event.target.checked)} />
        <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
        <span className="switch-label">Require approval for new memories</span>
        <span className="approval-switch-state" aria-hidden="true">{result.reviewContent ? "On" : "Off"}</span>
      </label>
      <p id="approval-settings-note" className="approval-settings-note">{settingsOnly
        ? result.reviewContent ? "New memories wait for approval after safety checks." : "Clear memories publish automatically after safety checks."
        : result.reviewContent
        ? "Every new memory waits for you to approve it."
        : "New memories go live once they pass safety checks. Anything flagged waits for you."}</p>
      {settingsOnly && <a className="text-link approval-settings-link" href={`/host/property/${propertyId}/moderation#new-memories`}>Review waiting memories</a>}
    </section>}
    {settingsOnly && result && notice && <p className="form-feedback" role="status">{notice}</p>}
    {!settingsOnly && !collapsed && <section id={feedbackOnly ? undefined : "new-memories"} className={`guest-review${feedbackOnly ? "" : " moderation-panel"}`} aria-label={feedbackOnly ? "Private feedback inbox" : "Guest safety review"}>
    <div className="review-heading">
      <h2>{feedbackOnly ? "Private feedback" : "New memories"}</h2>
      {!feedbackOnly && result && <span className="review-status" data-attention={result.posts.length > 0}>{result.posts.length === 0 ? "All clear" : `${result.posts.length}${result.reviewCursor ? "+" : ""} to review`}</span>}
      <button className="btn btn-sm btn-secondary" aria-label="Refresh inbox" disabled={busy} onClick={() => void refresh().catch(() => setNotice("The inbox could not be refreshed."))}>Refresh</button>
    </div>
    {feedbackOnly && <p>Private guest feedback. Replies aren’t supported. If a message is threatening or abusive, report it to our safety team.</p>}
    {!feedbackOnly && <p className="review-description">New guest submissions awaiting safety checks or your approval.</p>}
    {notice && <p className="review-notice" role="status">{notice}</p>}
    {!result && !notice && <p role="status">Loading inbox…</p>}
    {feedbackOnly ? result?.feedback.map(item => <article key={item.id}><p>{item.message}</p>
      <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void report(item.id)}>Report message</button></article>) : result?.posts.map(post => <article className="review-memory" key={post.id}>
      <div className="review-memory-heading">
        {post.displayName?.trim() && <p className="review-memory-author">{post.displayName}</p>}
        <span className="review-memory-state" data-pending={post.status === "pending"}>{post.status === "pending" ? "Safety checks in progress" : "Awaiting your approval"}</span>
      </div>
      {post.status === "pending" ? <p className="review-description">This memory will be available to review once safety checks finish.</p> : <p className="review-memory-message">{post.message}</p>}
      {post.status === "standard" && <>
        {post.photoCount > 0 && <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void loadPhotos(post)}>View {post.photoCount} photos</button>}
        <div className="review-memory-photos">{photos[post.id]?.map((src, index) => <img key={index} src={src} alt={`Memory photo ${index + 1} for review`} />)}</div>
        <div className="review-memory-actions">
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void act(post, "approve")}>Approve memory</button>
          <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void act(post, "reject")}>Keep off wall</button>
        </div>
      </>}
    </article>)}
    {!feedbackOnly && result?.posts.length === 0 && <p className="review-empty">No new memories waiting.</p>}
    {feedbackOnly && result?.feedback.length === 0 && <p>No feedback yet.</p>}
    {(feedbackOnly ? result?.feedbackCursor : result?.reviewCursor) && <button disabled={busy} onClick={() => void loadMore()}>{feedbackOnly ? "Load more feedback" : "Load more submissions"}</button>}
  </section>}</>;
}
