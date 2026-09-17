import { useEffect, useState } from "react";
import { hostCall } from "./GuestReviewPanel";
import { reportReasons, type ReportReason } from "../../domain/postModeration";
type Report = { id: string; postId: string; reason: ReportReason; reviewDueAt: string };
type Page = { reports: Report[]; nextCursor: string | null };
export function HostReportsPanel({ propertyId }: { propertyId: string }) {
  const [page, setPage] = useState<Page | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  async function refresh() { setPage(await hostCall<Page>("listHostReports", { propertyId })); }
  useEffect(() => { let active = true;
    void hostCall<Page>("listHostReports", { propertyId }).then(result => { if (active) setPage(result); }).catch(() => { if (active) setNotice("Reports could not be loaded. Try refreshing."); });
    return () => { active = false; };
  }, [propertyId]);
  async function more() {
    if (!page?.nextCursor || busy) return;
    setBusy(true);
    try { const result = await hostCall<Page>("listHostReports", { propertyId, cursor: page.nextCursor });
      setPage(previous => ({ ...result, reports: [...new Map([...(previous?.reports ?? []), ...result.reports].map(item => [item.id, item])).values()] }));
    } catch { setNotice("More reports could not be loaded. Please try again."); }
    finally { setBusy(false); }
  }
  async function resolve(report: Report, action: "dismiss" | "delete") {
    if (action === "delete" && !window.confirm("Hide this memory and schedule its files for deletion?")) return;
    setBusy(true); setNotice("");
    try { await hostCall("resolveContentReport", { reportId: report.id, action }); await refresh();
      setNotice(action === "delete" ? "The memory is hidden and deletion is scheduled." : "Report resolved. The memory can return only when no other report or safety hold prevents it.");
    } catch { setNotice("This report could not be resolved. Refresh the queue; an internal safety review may be required."); }
    finally { setBusy(false); }
  }
  return <section className="guest-review" aria-label="Guest reports">
    <div className="review-heading">
      <h2>Guest reports</h2>
      {page && <span className="review-status">{page.reports.length === 0 ? "All clear" : `${page.reports.length} to review`}</span>}
      <button className="btn btn-sm btn-secondary" aria-label="Refresh reports" disabled={busy} onClick={() => void refresh().catch(() => setNotice("Reports could not be loaded."))}>Refresh</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    {page?.reports.map(report => <article key={report.id}>
      <p>{reportReasons[report.reason]}</p><p>Memory reference: {report.postId}</p><p>Review by {new Date(report.reviewDueAt).toLocaleDateString()}</p>
      <button disabled={busy} onClick={() => void resolve(report, "delete")}>Confirm removal</button>
      <button disabled={busy} onClick={() => void resolve(report, "dismiss")}>Dismiss report</button>
    </article>)}
    {page?.nextCursor && <button disabled={busy} onClick={() => void more()}>Load more reports</button>}
  </section>;
}
