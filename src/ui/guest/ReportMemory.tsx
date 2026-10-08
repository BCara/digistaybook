import { useState } from "react";
import { guestCall } from "../../lib/guestSession";
import { reportReasons } from "../../domain/postModeration";

export function ReportMemory({ slug, postId }: { slug: string; postId: string }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState("privacy"), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function submit() {
    setBusy(true); setNotice("");
    try {
      const result = await guestCall<{ message: string }>(slug, "reportGuestMemory", { postId, reason, requestId });
      setNotice(result.message); setOpen(false); setRequestId(crypto.randomUUID());
    } catch { setNotice("Your report could not be confirmed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="memory-report">
    <button className="memory-report-trigger" type="button" aria-label="Report memory" title="Report memory" aria-expanded={open} disabled={busy} onClick={() => setOpen(value => !value)}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17V3m0 1c4-3 7 3 12 0v8c-5 3-8-3-12 0" />
      </svg>
    </button>
    {open && <div>
      <label>Reason for reporting<select value={reason} disabled={busy} onChange={event => { setReason(event.target.value); setRequestId(crypto.randomUUID()); }}>
        {Object.entries(reportReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button type="button" disabled={busy} onClick={() => void submit()}>Send report</button>
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel report</button>
    </div>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
