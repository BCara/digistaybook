import { useEffect, useState } from "react";
import { hostCall } from "../host/GuestReviewPanel";
type Item = { id: string; propertyId: string | null; status: string; kind: string | null; reviewDueAt: string | null };
type Page = { items: Item[]; nextCursor: string | null };
type HeldFeedback = { id: string; source: string; categories: string[]; status: string; message: string | null };
export function SafetyOperationsPage() {
  const [queue, setQueue] = useState("contentReports"), [page, setPage] = useState<Page | null>(null), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<HeldFeedback | null>(null), [note, setNote] = useState("");
  useEffect(() => { let active = true; setPage(null); setNotice("");
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
    try { setOpened(await hostCall<HeldFeedback>("readSafetyCase", { id })); setNote(""); }
    catch { setNotice("This case could not be opened. Check your access and try again."); }
    finally { setBusy(false); }
  }
  async function resolve(action: "release" | "delete") {
    if (!opened) return;
    setBusy(true); setNotice("");
    try {
      await hostCall("resolveSafetyCase", { id: opened.id, action, ...(note.trim() ? { note } : {}) });
      setOpened(null); await load();
      setNotice(action === "release" ? "Released to the host’s private feedback inbox." : "The message has been deleted.");
    } catch { setNotice("The case could not be resolved. It may already have been handled; refresh the queue."); }
    finally { setBusy(false); }
  }
  return <main className="page narrow-page"><h1>Privacy &amp; Safety operations</h1>
    <p>Restricted staff overview. Access is checked by the server on every request. This overview does not expose reported images or guest messages; opening a held feedback case shows its text and is recorded.</p>
    <label>Queue<select disabled={busy} value={queue} onChange={event => setQueue(event.target.value)}>
      <option value="contentReports">Content reports</option><option value="privacyRequests">Privacy requests</option><option value="trustSafetyCases">Safety cases</option><option value="operationsAlerts">Alerts</option><option value="deletionJobs">Deletion jobs</option>
    </select></label>
    <button disabled={busy} onClick={() => void load()}>Refresh queue</button>
    {notice && <p role="alert">{notice}</p>}
    {page?.items.map(item => <article key={item.id}><h2>{item.kind === "private_feedback" ? "Held private feedback" : item.kind || "Case"}</h2><p>Reference: {item.id}</p><p>Status: {item.status}</p>{item.reviewDueAt && <p>Review by {new Date(item.reviewDueAt).toLocaleDateString()}</p>}
      {item.kind === "private_feedback" && ["open", "escalated"].includes(item.status) && <button disabled={busy} onClick={() => void open(item.id)}>Open case</button>}
      {opened?.id === item.id && <section aria-label="Held message">
        <p>{opened.source === "host_report" ? "Reported by the host." : `Held by automated screening: ${opened.categories.join(", ")}.`} Opening this case has been recorded.</p>
        <blockquote>{opened.message}</blockquote>
        <label>Decision note (optional)<textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label>
        <button disabled={busy} onClick={() => void resolve("release")}>Release to host</button>
        <button disabled={busy} onClick={() => { if (window.confirm("Delete this message? The host will never see it.")) void resolve("delete"); }}>Delete message</button>
      </section>}
    </article>)}
    {page?.items.length === 0 && <p>No items in this queue.</p>}
    {page?.nextCursor && <button disabled={busy} onClick={() => void load(page.nextCursor!)}>Load more cases</button>}
  </main>;
}
