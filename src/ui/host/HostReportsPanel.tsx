import { useEffect, useState } from "react";
import { hostCall } from "./GuestReviewPanel";
import { reportReasons, type ReportReason } from "../../domain/postModeration";
type Report = { id: string; postId: string; reason: ReportReason; reviewDueAt: string };
type Page = { reports: Report[]; nextCursor: string | null };
export function HostReportsPanel({ propertyId, onCount, collapseWhenEmpty = false, refreshSignal = 0, memoryText }: {
  propertyId: string;
  onCount?: (count: number) => void;
  /** Draw nothing while there are no reports. */
  collapseWhenEmpty?: boolean;
  /** Changing it reads the reports again. */
  refreshSignal?: number;
  /** The reported memory's words, when the page has them, in place of its ID. */
  memoryText?: (postId: string) => string | undefined;
}) {
  const [page, setPage] = useState<Page | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  async function refresh() { setPage(await hostCall<Page>("listHostReports", { propertyId })); }
  useEffect(() => { let active = true;
    void hostCall<Page>("listHostReports", { propertyId }).then(result => { if (active) setPage(result); }).catch(() => { if (active) setNotice("Reports could not be loaded. Try refreshing."); });
    return () => { active = false; };
  }, [propertyId, refreshSignal]);
  const open = page?.reports.length;
  useEffect(() => { if (open !== undefined) onCount?.(open); }, [open, onCount]);
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
  if (collapseWhenEmpty && page?.reports.length === 0 && !page.nextCursor && !notice) return null;
  return <section className="guest-review moderation-panel host-reports" aria-label="Guest reports">
    <div className="review-heading">
      <h2>Guest reports</h2>
      {page && <span className="review-status" data-attention={page.reports.length > 0}>{page.reports.length === 0 ? "All clear" : `${page.reports.length}${page.nextCursor ? "+" : ""} to review`}</span>}
      <button className="btn btn-sm btn-secondary" aria-label="Refresh reports" disabled={busy} onClick={() => void refresh().catch(() => setNotice("Reports could not be loaded."))}>Refresh</button>
    </div>
    <p className="review-description">Concerns guests have raised about memories on your wall.</p>
    {notice && <p className="review-notice" role="status">{notice}</p>}
    {!page && !notice && <p role="status">Loading reports…</p>}
    {page?.reports.length === 0 && <p className="review-empty">No guest reports to review.</p>}
    {page?.reports.map(report => <article className="review-report" key={report.id}>
      <p className="review-report-reason">{reportReasons[report.reason]}</p><p className="review-description">{memoryText?.(report.postId) ? `“${memoryText(report.postId)}”` : `Memory reference: ${report.postId}`}</p><p className="review-report-due">Review by {new Date(report.reviewDueAt).toLocaleDateString()}</p>
      <div className="review-memory-actions">
        <button className="btn btn-sm btn-destructive" disabled={busy} onClick={() => void resolve(report, "delete")}>Confirm removal</button>
        <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void resolve(report, "dismiss")}>Dismiss report</button>
      </div>
    </article>)}
    {page?.nextCursor && <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void more()}>Load more reports</button>}
  </section>;
}
