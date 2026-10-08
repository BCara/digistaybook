import { useEffect, useState } from "react";
import { hostCall } from "../host/GuestReviewPanel";
type ScreeningIssue = { screeningStatus?: string | null; screeningIncompleteReason?: string | null };
type Item = ScreeningIssue & { id: string; propertyId: string | null; status: string; kind: string | null; reviewDueAt: string | null };
type Page = { items: Item[]; nextCursor: string | null };
type SafetyCase = ScreeningIssue & { id: string; kind?: "private_feedback" | "guest_memory"; source: string; categories: string[]; status: string; message: string | null; photoCount?: number };
const incompleteExplanation = (reason?: string | null) => reason === "daily_allowance_reached"
  ? "The daily screening allowance was reached before checks completed." : reason === "provider_error"
  ? "The screening service failed or did not return a complete valid response." : "The automated screening checks did not complete.";
type ConsentReview = { id: string; status: string; consentPath: string; reason: string; manualAction: string; dueAt: string | null; completionEvidence: string | null; recordUrl: string };
export function SafetyOperationsPage() {
  const [queue, setQueue] = useState("contentReports"), [page, setPage] = useState<Page | null>(null), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<SafetyCase | null>(null), [note, setNote] = useState(""), [photos, setPhotos] = useState<string[]>([]);
  const [consentReview, setConsentReview] = useState<ConsentReview | null>(null);
  useEffect(() => { let active = true; setPage(null); setNotice(""); setOpened(null); setConsentReview(null);
    void hostCall<Page>("listSafetyOperations", { queue }).then(result => { if (active) setPage(result); })
      .catch(() => { if (active) setNotice("Access requires an authorised operations account signed in with multi-factor authentication. If you already have access, try refreshing."); });
    return () => { active = false; };
  }, [queue]);
  async function load(cursor?: string) {
    setBusy(true); setNotice("");
    try { const result = await hostCall<Page>("listSafetyOperations", { queue, ...(cursor ? { cursor } : {}) });
      setPage(previous => cursor && previous ? { ...result, items: [...new Map([...previous.items, ...result.items].map(item => [item.id, item])).values()] } : result);
    } catch { setNotice("The queue could not be loaded. Check your access and try again."); }
    finally { setBusy(false); }
  }
  async function open(id: string) {
    setBusy(true); setNotice("");
    try { setOpened(await hostCall<SafetyCase>("readSafetyCase", { id })); setNote(""); setPhotos([]); }
    catch { setNotice("This case could not be opened. Check your access and try again."); }
    finally { setBusy(false); }
  }
  async function checkConsent(id: string) {
    setBusy(true); setNotice("");
    try { setConsentReview(await hostCall<ConsentReview>("readConsentDeletionReview", { id })); await load(); }
    catch { setNotice("This consent review could not be checked. Refresh and try again."); }
    finally { setBusy(false); }
  }
  async function loadPhotos() {
    if (!opened) return;
    setBusy(true); setNotice("");
    try {
      const images: string[] = [];
      for (let index = 0; index < (opened.photoCount ?? 0); index++) {
        const result = await hostCall<{ base64: string }>("readSafetyCasePhoto", { id: opened.id, index });
        images.push(`data:image/webp;base64,${result.base64}`);
      }
      setPhotos(images);
    } catch { setNotice("The case photos could not be opened. Refresh the case and try again."); }
    finally { setBusy(false); }
  }
  async function resolve(action: "release" | "delete") {
    if (!opened) return;
    setBusy(true); setNotice("");
    try {
      await hostCall("resolveSafetyCase", { id: opened.id, action, ...(note.trim() ? { note } : {}) });
      setOpened(null); setPhotos([]); await load();
      setNotice(action === "release" ? opened.kind === "guest_memory" ? "Memory released for host review or renewed screening. It has not been published." : "Released to the host’s private feedback inbox."
        : opened.kind === "guest_memory" ? "The memory is hidden and photo deletion is scheduled." : "The message has been deleted.");
    } catch { setNotice("The case could not be resolved. It may already have been handled; refresh the queue."); }
    finally { setBusy(false); }
  }
  return <main className="page narrow-page"><h1>Privacy &amp; Safety operations</h1>
    <p>Restricted staff overview. Access is checked by the server on every request. Opening a safety case or its photos is recorded. Releasing a memory sends it for host review or renewed screening before publication.</p>
    <label>Queue<select disabled={busy} value={queue} onChange={event => setQueue(event.target.value)}>
      <option value="contentReports">Content reports</option><option value="privacyRequests">Privacy requests</option><option value="trustSafetyCases">Safety cases</option><option value="operationsAlerts">Alerts</option><option value="deletionJobs">Deletion jobs</option>
      <option value="consentDeletionReview">Consent deletion reviews</option>
    </select></label>
    <button disabled={busy} onClick={() => void load()}>Refresh queue</button>
    {notice && <p role="alert">{notice}</p>}
    {page?.items.map(item => <article key={item.id}><h2>{item.kind === "private_feedback" ? "Held private feedback" : item.kind === "guest_memory" ? "Held guest memory" : item.kind || "Case"}</h2><p>Reference: {item.id}</p><p>Status: {item.status}</p>{item.screeningStatus === "incomplete" && <p><strong>Screening incomplete</strong> — {incompleteExplanation(item.screeningIncompleteReason)}</p>}{item.reviewDueAt && <p>Review by {new Date(item.reviewDueAt).toLocaleDateString()}</p>}
      {["private_feedback", "guest_memory"].includes(item.kind ?? "") && ["open", "escalated"].includes(item.status) && <button disabled={busy} onClick={() => void open(item.id)}>Open case</button>}
      {item.kind === "consent_deletion_review" && <button disabled={busy} onClick={() => void checkConsent(item.id)}>Check consent retention</button>}
      {consentReview?.id === item.id && <section aria-label="Consent deletion review">
        <p>Consent record: <code>{consentReview.consentPath}</code></p><p>Current status: {consentReview.status}</p>
        <p>{consentReview.reason}</p>{consentReview.dueAt && <p>Retention deadline: {new Date(consentReview.dueAt).toLocaleString()}</p>}
        {consentReview.status === "due" && <><p>{consentReview.manualAction}</p><a href={consentReview.recordUrl} target="_blank" rel="noreferrer">Open exact consent record in Firebase console</a></>}
        {consentReview.completionEvidence && <p>{consentReview.completionEvidence}</p>}
        <button disabled={busy} onClick={() => void checkConsent(item.id)}>Recheck record after manual deletion</button>
      </section>}
      {opened?.id === item.id && <section aria-label="Held message">
        <p>{opened.source === "incomplete_screening" ? `Screening incomplete: ${incompleteExplanation(opened.screeningIncompleteReason)} This is a manual review request, not a harmful-content classification.` : opened.source === "host_report" ? "Reported by the host." : `Held by automated screening: ${opened.categories.join(", ")}.`} Opening this case has been recorded.</p>
        <blockquote>{opened.message}</blockquote>
        {opened.kind === "guest_memory" && (opened.photoCount ?? 0) > 0 && <button disabled={busy} onClick={() => void loadPhotos()}>View {opened.photoCount} case photos</button>}
        {photos.map((src, index) => <img key={index} src={src} alt={`Safety case photo ${index + 1}`} style={{ maxWidth: "100%" }} />)}
        <label>Decision note (optional)<textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label>
        <button disabled={busy} onClick={() => void resolve("release")}>Release to host</button>
        <button disabled={busy} onClick={() => { if (window.confirm(opened.kind === "guest_memory" ? "Delete this memory and schedule its photos for deletion?" : "Delete this message? The host will never see it.")) void resolve("delete"); }}>{opened.kind === "guest_memory" ? "Delete memory" : "Delete message"}</button>
      </section>}
    </article>)}
    {page?.items.length === 0 && <p>No items in this queue.</p>}
    {page?.nextCursor && <button disabled={busy} onClick={() => void load(page.nextCursor!)}>Load more cases</button>}
  </main>;
}
