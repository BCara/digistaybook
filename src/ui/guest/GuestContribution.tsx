import { useEffect, useRef, useState, type FormEvent } from "react";
import { guestCall } from "../../lib/guestSession";
import { guestPolicy, feedbackBoundary } from "../../../functions/src/guestPolicy";

type OwnPost = { id: string; message: string; revision: number; status: string };
type OwnPage = { posts: OwnPost[]; nextCursor?: string | null };
type Photo = { file: File; preview: string };
function explain(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "functions/invalid-argument" || code === "functions/failed-precondition" || code === "functions/resource-exhausted") return (error as Error).message;
  return "We couldn’t complete that action. Check your connection and try again. Your draft is still here.";
}
async function base64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("This photo could not be read."));
    reader.readAsDataURL(file);
  });
}

export type ContributionMode = "memory" | "feedback";
export function GuestContribution({ slug, stayToken = null, onChanged, mode: requestedMode, onModeChange }: {
  slug: string;
  /**
   * The guestbook link's token. A memory is left by someone who was in the
   * property, and holding this is what stands for that, so it is sent with
   * the call that opens a submission; the calls after it are reached through
   * a submission this session already owns.
   */
  stayToken?: string | null;
  onChanged: () => void;
  /** Which form is showing, when the page around it chooses; otherwise the form keeps its own. */
  mode?: ContributionMode;
  onModeChange?: (mode: ContributionMode) => void;
}) {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  // A submission is a memory for the wall or a private note to the Host, never
  // both: the two go to different readers, under different screening.
  const [ownMode, setOwnMode] = useState<ContributionMode>("memory");
  const mode = requestedMode ?? ownMode, setMode = onModeChange ?? setOwnMode;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photoRef = useRef<Photo[]>([]);
  photoRef.current = photos;
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (confirmation) confirmationDialog.current?.showModal(); }, [confirmation]);
  const [own, setOwn] = useState<OwnPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const attempt = useRef<{ requestId: string; id?: string; uploaded: number } | null>(null);
  useEffect(() => {
    let mounted = true;
    setOwn([]); setCursor(null);
    void guestCall<OwnPage>(slug, "listGuestContributions", {}).then(result => { if (mounted) { setOwn(result.posts); setCursor(result.nextCursor ?? null); } })
      .catch(() => { if (mounted) setNotice("Your previous memories could not be loaded. Use Refresh my memories to try again."); });
    return () => { mounted = false; photoRef.current.forEach(photo => URL.revokeObjectURL(photo.preview)); };
  }, [slug]);
  async function refresh() { const result = await guestCall<OwnPage>(slug, "listGuestContributions", {}); setOwn(result.posts); setCursor(result.nextCursor ?? null); }
  async function loadMore() {
    if (busy || !cursor) return;
    setBusy(true);
    try {
      const result = await guestCall<OwnPage>(slug, "listGuestContributions", { cursor });
      setOwn(previous => [...new Map([...previous, ...result.posts].map(post => [post.id, post])).values()]);
      setCursor(result.nextCursor ?? null);
    } catch (error) { setNotice(explain(error)); }
    finally { setBusy(false); }
  }
  function pick(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (photos.length + selected.length > guestPolicy.maxPhotos) { setNotice("Choose no more than ten photos."); return; }
    if (selected.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > guestPolicy.maxImageBytes)) { setNotice("Choose JPEG, PNG or WebP photos up to 5 MB each. Videos and animated images are not supported."); return; }
    if ([...photos.map(photo => photo.file), ...selected].reduce((sum, file) => sum + file.size, 0) > guestPolicy.maxPostBytes) { setNotice("Keep the total photo size under 25 MB."); return; }
    setPhotos(previous => [...previous, ...selected.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
    setNotice("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const memory = mode === "memory";
    if (memory && !message.trim() && !photos.length) { setNotice("Add a message or at least one photo."); return; }
    if (!memory && !feedback.trim()) { setNotice("Write your feedback before sending it."); return; }
    if (memory && !consent) { setNotice("Please read and accept the consent before submitting."); return; }
    setBusy(true); setNotice(memory ? "Preparing your memory…" : "Sending your feedback…"); setProgress(0);
    const current = attempt.current ?? { requestId: crypto.randomUUID(), uploaded: 0 };
    attempt.current = current;
    try {
      if (!current.id) current.id = (await guestCall<{ id: string }>(slug, "beginGuestContribution", {
        slug, stayToken, requestId: current.requestId, ...(memory
          ? { message, feedback: "", photoCount: photos.length, consentAccepted: consent, consentVersion: guestPolicy.consentVersion }
          : { message: "", feedback, photoCount: 0 })
      })).id;
      for (let index = current.uploaded; memory && index < photos.length; index++) {
        setNotice(`Uploading photo ${index + 1} of ${photos.length}…`);
        await guestCall(slug, "uploadGuestPhoto", { id: current.id, index, base64: await base64(photos[index].file) });
        current.uploaded = index + 1;
        setProgress(Math.round(current.uploaded / Math.max(photos.length, 1) * 90));
      }
      if (memory) setNotice("Saving your memory for safety screening…");
      const result = await guestCall<{ status: string; message: string }>(slug, "finishGuestContribution", { id: current.id });
      setProgress(100);
      setNotice(result.status === "published" ? "Your memory is now on the wall." : result.message);
      if (result.status === "pending") setConfirmation(result.message);
      if (memory) { photos.forEach(photo => URL.revokeObjectURL(photo.preview)); setPhotos([]); setMessage(""); setConsent(false); }
      else setFeedback("");
      attempt.current = null;
      await refresh(); onChanged();
    } catch (error) { setNotice(explain(error)); }
    finally { setBusy(false); }
  }
  async function change(post: OwnPost, action: "edit" | "delete") {
    setBusy(true);
    try {
      await guestCall(slug, "changeGuestContribution", { id: post.id, revision: post.revision, action, ...(action === "edit" ? { message: editText } : {}) });
      setEditing(null); setNotice(action === "delete" ? "Your memory is hidden and deletion has been scheduled." : "Your updated message has been saved and will be screened again.");
      await refresh(); onChanged();
    } catch (error) { setNotice(explain(error)); }
    finally { setBusy(false); }
  }
  const locked = busy || attempt.current !== null;
  return <section className="guest-contribution" aria-labelledby="guest-contribution-heading">
    <dialog className="guest-pending-dialog" ref={confirmationDialog} aria-labelledby="guest-pending-heading" onClose={() => setConfirmation("")}>
      <h2 id="guest-pending-heading">Memory received</h2><p>{confirmation}</p>
      <button type="button" onClick={() => confirmationDialog.current?.close()}>Back to the guestbook</button>
    </dialog>
    <h2 id="guest-contribution-heading">{mode === "memory" ? "Add a memory" : "Private feedback for your host"}</h2>
    <form onSubmit={event => void submit(event)}>
      <fieldset className="guest-mode" disabled={locked}>
        <legend>What would you like to leave?</legend>
        <label><input type="radio" name="guest-mode" checked={mode === "memory"} onChange={() => setMode("memory")} /><span>A memory for the wall</span></label>
        <label><input type="radio" name="guest-mode" checked={mode === "feedback"} onChange={() => setMode("feedback")} /><span>Private feedback for your host</span></label>
      </fieldset>
      {mode === "memory" ? <>
      <label>Your message<textarea value={message} maxLength={guestPolicy.maxMessage} disabled={locked} onChange={event => setMessage(event.target.value)} /></label>
      <div className="guest-photo-picker">
        <label className="guest-photo-trigger" data-disabled={locked}>
          <input aria-label="Choose photos" aria-describedby="guest-photo-count" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={locked} onChange={event => { pick(event.target.files); event.target.value = ""; }} />
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
          </svg>
          <span aria-hidden="true">{photos.length ? "Add more photos" : "Choose photos"}</span>
        </label>
        <span id="guest-photo-count" className="guest-photo-count" aria-live="polite">
          {photos.length ? `${photos.length} of ${guestPolicy.maxPhotos} photos selected` : "Up to 10 photos"}
        </span>
      </div>
      <div className="guest-photo-previews">{photos.map((photo, index) => <figure key={photo.preview}>
        <img src={photo.preview} alt={`Selected photo ${index + 1}`} /><figcaption>{photo.file.name}</figcaption>
        <button type="button" disabled={locked} onClick={() => { URL.revokeObjectURL(photo.preview); setPhotos(previous => previous.filter((_, i) => i !== index)); }}>Remove photo {index + 1}</button>
      </figure>)}</div>
      <p><a href="/guest-terms" target="_blank" rel="noreferrer">Guest Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a></p>
      <label className="guest-consent"><input type="checkbox" checked={consent} disabled={locked} onChange={event => setConsent(event.target.checked)} /><span>{guestPolicy.consentWording}</span></label>
      </> : <>
      <label>Private feedback<textarea value={feedback} maxLength={guestPolicy.maxFeedback} disabled={locked} onChange={event => setFeedback(event.target.value)} aria-describedby="feedback-boundary" /></label>
      <p id="feedback-boundary" className="guest-feedback-note"><small>Only for your host, never shown on the wall. {feedbackBoundary}</small></p>
      <p><a href="/guest-terms" target="_blank" rel="noreferrer">Guest Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a></p>
      </>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : attempt.current ? "Retry this submission" : mode === "memory" ? "Submit memory" : "Send to host"}</button>
      {attempt.current && !busy && <button type="button" className="btn btn-secondary" onClick={async () => {
        try {
          if (attempt.current?.id) await guestCall(slug, "changeGuestContribution", { id: attempt.current.id, revision: 1, action: "delete" });
          attempt.current = null; setNotice("The previous attempt has been cancelled. You can change your draft.");
        } catch (error) { setNotice(explain(error)); }
      }}>Cancel attempt and edit draft</button>}
      {busy && <progress aria-label="Submission progress" value={progress} max={100} />}
    </form>
    {notice && <p role="status">{notice}</p>}
    <details className="guest-own-memories"><summary>Your memories in this browser</summary>
    <p>Manage memories from this browser. <a href="/privacy-safety">Need help removing one?</a></p>
    <button type="button" disabled={busy} onClick={() => void refresh().catch(error => setNotice(explain(error)))}>Refresh my memories</button>
    {own.filter(post => post.status !== "deleted").map(post => <article key={post.id}>
      <p>{post.message || "Photo memory"}</p><p>{post.status === "published" ? "Published" : post.status === "uploading" ? "Upload incomplete" : "Pending safety screening or review"}</p>
      {editing === post.id ? <><label>Edit your message<textarea value={editText} maxLength={1200} onChange={event => setEditText(event.target.value)} /></label>
        <button disabled={busy} onClick={() => void change(post, "edit")}>Save message</button><button disabled={busy} onClick={() => setEditing(null)}>Cancel edit</button></>
        : <button disabled={busy || post.status === "uploading"} onClick={() => { setEditing(post.id); setEditText(post.message); }}>Edit message</button>}
      <button disabled={busy} onClick={() => { if (window.confirm("Hide this memory and schedule its deletion?")) void change(post, "delete"); }}>Delete memory</button>
    </article>)}
    {cursor && <button type="button" disabled={busy} onClick={() => void loadMore()}>Load more memories</button>}
    </details>
  </section>;
}
