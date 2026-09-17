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
  return <div>
    <button type="button" disabled={busy} onClick={() => setOpen(value => !value)}>Report memory</button>
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
