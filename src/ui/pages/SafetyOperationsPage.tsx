import { useCallback, useEffect, useState } from "react";
import { hostCall } from "../host/GuestReviewPanel";
type ScreeningIssue = { screeningStatus?: string | null; screeningIncompleteReason?: string | null };
type Item = ScreeningIssue & { id: string; queue?: string; propertyId: string | null; status: string; kind: string | null; receivedAt?: string | null; outstanding?: boolean; reviewDueAt: string | null };
type QueueSummary = { queue: string; total: number; outstanding: number; overdue: number; oldestOutstandingAt: string | null };
type Page = { items: Item[]; summary?: QueueSummary[]; matching?: number; partial?: boolean };
type SafetyCase = ScreeningIssue & { id: string; kind?: "private_feedback" | "guest_memory"; source: string; categories: string[]; status: string; message: string | null; photoCount?: number };
const incompleteExplanation = (reason?: string | null) => reason === "daily_allowance_reached"
  ? "The daily screening allowance was reached before checks completed." : reason === "provider_error"
  ? "The screening service failed or did not return a complete valid response." : "The automated screening checks did not complete.";
type ConsentReview = { id: string; status: string; consentPath: string; reason: string; manualAction: string; dueAt: string | null; completionEvidence: string | null; recordUrl: string };
const QUEUES: Record<string, string> = { contentReports: "Content reports", privacyRequests: "Privacy requests", trustSafetyCases: "Safety cases",
  operationsAlerts: "Alerts", deletionJobs: "Deletion jobs", consentDeletionReview: "Consent deletion reviews" };
const KINDS: Record<string, string> = { private_feedback: "Held private feedback", guest_memory: "Held guest memory", consent_deletion_review: "Consent record review",
  report_circuit_breaker: "Report surge on a wall", privacy_request: "New privacy request", privacy_deadline: "Privacy request overdue", safety_case_overdue: "Safety case overdue",
  screening_failed: "Screening failed", privacy: "Privacy report", inappropriate: "Inappropriate content report", harassment: "Harassment report", spam: "Spam report",
  other: "Other report", takedown: "Takedown request", urgent_safety: "Urgent safety request" };
const title = (item: Item) => (item.kind && KINDS[item.kind]) || item.kind || (item.queue === "deletionJobs" ? "Photo deletion" : "Case");
const words = (value: string) => value.replace(/_/g, " ");
const DAY = 86400000;
function age(at: string | null | undefined, now: number) {
  if (!at) return null;
  const days = Math.floor((now - Date.parse(at)) / DAY);
  return days < 0 ? `in ${-days} day${days === -1 ? "" : "s"}` : days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
}
const date = (at: string) => new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function SafetyOperationsPage() {
  const [queue, setQueue] = useState("all"), [scope, setScope] = useState("outstanding");
  const [page, setPage] = useState<Page | null>(null), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [loadedAt, setLoadedAt] = useState(Date.now());
  const [opened, setOpened] = useState<SafetyCase | null>(null), [note, setNote] = useState(""), [photos, setPhotos] = useState<string[]>([]);
  const [consentReview, setConsentReview] = useState<ConsentReview | null>(null);
  const fetchPage = useCallback(() => hostCall<Page>("listSafetyOperations", { queue, scope }), [queue, scope]);
  useEffect(() => { let active = true; setPage(null); setNotice(""); setOpened(null); setConsentReview(null);
    void fetchPage().then(result => { if (active) { setPage(result); setLoadedAt(Date.now()); } })
      .catch(() => { if (active) setNotice("Access requires an authorised operations account signed in with multi-factor authentication. If you already have access, try refreshing."); });
    return () => { active = false; };
  }, [fetchPage]);
  async function load() {
    setBusy(true); setNotice("");
    try { setPage(await fetchPage()); setLoadedAt(Date.now()); }
    catch { setNotice("The queue could not be loaded. Check your access and try again."); }
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
  const summary = page?.summary ?? [], items = page?.items ?? [];
  const totals = summary.reduce((sum, item) => ({ outstanding: sum.outstanding + item.outstanding, overdue: sum.overdue + item.overdue }), { outstanding: 0, overdue: 0 });
  return <main className="page ops-page"><h1>Privacy &amp; Safety operations</h1>
    <p>Restricted staff overview. Access is checked by the server on every request. Opening a safety case or its photos is recorded. Releasing a memory sends it for host review or renewed screening before publication.</p>
    {summary.length > 0 && <section aria-label="Queue summary" className="ops-summary">
      <p className="ops-summary-total"><strong>{totals.outstanding}</strong> outstanding across all queues{totals.overdue > 0 && <> · <span className="ops-overdue">{totals.overdue} past review date</span></>}</p>
      <ul className="ops-tiles">{summary.map(item => <li key={item.queue}>
        <button type="button" className="ops-tile" aria-pressed={queue === item.queue} disabled={busy} onClick={() => setQueue(queue === item.queue ? "all" : item.queue)}>
          <span className="ops-tile-label">{QUEUES[item.queue] ?? item.queue}</span>
          <span className="ops-tile-count">{item.outstanding}</span>
          <span className="ops-tile-meta">outstanding of {item.total}</span>
          {item.overdue > 0 && <span className="ops-tile-meta ops-overdue">{item.overdue} past review date</span>}
          {item.oldestOutstandingAt && <span className="ops-tile-meta">oldest {age(item.oldestOutstandingAt, loadedAt)}</span>}
        </button></li>)}</ul>
    </section>}
    <div className="ops-controls">
      <label>Queue<select disabled={busy} value={queue} onChange={event => setQueue(event.target.value)}>
        <option value="all">All queues</option>
        {Object.entries(QUEUES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Show<select disabled={busy} value={scope} onChange={event => setScope(event.target.value)}>
        <option value="outstanding">Outstanding only</option><option value="everything">Everything, including resolved</option>
      </select></label>
      <button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Refresh queue</button>
    </div>
    {page && <p className="muted small">Oldest first. Showing {items.length} of {page.matching ?? items.length}{page.partial ? " — resolve older items to see the rest" : ""}. Updated {new Date(loadedAt).toLocaleTimeString()}.</p>}
    {notice && <p role="alert">{notice}</p>}
    <ol className="ops-list">{items.map(item => {
      const overdue = item.outstanding !== false && item.reviewDueAt && Date.parse(item.reviewDueAt) <= loadedAt;
      return <li key={`${item.queue}/${item.id}`}><article className={`ops-item${overdue ? " ops-item-overdue" : ""}${item.outstanding === false ? " ops-item-closed" : ""}`}>
        <div className="ops-item-head">
          {item.queue && <span className="ops-queue-tag">{QUEUES[item.queue] ?? item.queue}</span>}
          <span className="status-pill">{words(item.status ?? "unknown")}</span>
        </div>
        <h2>{title(item)}</h2>
        <p className="ops-item-facts">
          {item.receivedAt && <span>{item.queue === "consentDeletionReview" ? "Retention deadline" : "Received"} {date(item.receivedAt)} ({age(item.receivedAt, loadedAt)})</span>}
          {item.reviewDueAt && item.queue !== "consentDeletionReview" && <span className={overdue ? "ops-overdue" : undefined}>{overdue ? "Overdue since" : "Review by"} {date(item.reviewDueAt)}</span>}
          {item.propertyId && <span>Property: {item.propertyId}</span>}
          <span>Reference: <code>{item.id}</code></span>
        </p>
        {item.screeningStatus === "incomplete" && <p><strong>Screening incomplete</strong> — {incompleteExplanation(item.screeningIncompleteReason)}</p>}
        {["private_feedback", "guest_memory"].includes(item.kind ?? "") && ["open", "escalated"].includes(item.status) && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void open(item.id)}>Open case</button>}
        {item.kind === "consent_deletion_review" && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void checkConsent(item.id)}>Check consent retention</button>}
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
      </article></li>;
    })}</ol>
    {page?.items.length === 0 && <p className="empty-state">{scope === "outstanding" ? "Nothing outstanding here." : "No items in this queue."}</p>}
  </main>;
}
