import { useRef, useState, type FormEvent } from "react";
import { guestCall } from "../../lib/guestSession";

export function PrivacySafetyPage() {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const attempt = useRef<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, fields = new FormData(form);
    attempt.current ??= crypto.randomUUID();
    setBusy(true); setNotice("");
    try {
      const result = await guestCall<{ message: string; reference: string }>("privacy-safety", "submitPrivacyRequest", {
        requestId: attempt.current, kind: fields.get("kind"), details: fields.get("details"), contact: fields.get("contact")
      });
      setNotice(`${result.message} Reference: ${result.reference}. We have not yet verified or approved this request.`);
      form.reset(); attempt.current = null;
    } catch { setNotice("Your request could not be confirmed. Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Public support route</p>
      <h1>Privacy &amp; Safety</h1>
      <p className="lede">
        Use this route for a personal-data request, content takedown request or urgent platform safety concern.
        Booking, property and in-stay support remain with the Host or booking provider.
      </p>

      <div className="notice">
        <strong>DigiStayBook cannot help with bookings, property access, maintenance or in-stay issues.</strong>
        <p>Contact your host through your booking platform for stay support. Use this form only for privacy, personal-data or DigiStayBook content-safety concerns.</p>
      </div>

      <form className="stacked-form" onSubmit={event => void submit(event)} onChange={() => { if (!busy) attempt.current = null; }}>
        <label htmlFor="request-kind">Request type</label>
        <select id="request-kind" name="kind" defaultValue="privacy" disabled={busy}>
          <option value="privacy">Privacy request</option>
          <option value="takedown">Content takedown</option>
          <option value="urgent_safety">Urgent safety concern</option>
        </select>
        <label htmlFor="request-details">Details</label>
        <textarea id="request-details" name="details" maxLength={2000} required disabled={busy} />
        <p className="field-hint">Include the property or wall reference, and the post reference if you have one.</p>
        <label htmlFor="contact">Contact email</label>
        <input id="contact" name="contact" type="email" required disabled={busy} />
        <p className="field-hint">Used only to verify and respond to this request.</p>
        <button type="submit" disabled={busy}>{busy ? "Sending…" : "Submit request"}</button>
      </form>

      <p className="form-feedback" style={{ marginTop: "20px" }}>
        {notice || "Submitting a request does not automatically approve deletion. Your contact details are used to verify and respond to your request."}
      </p>
    </div>
  );
}
