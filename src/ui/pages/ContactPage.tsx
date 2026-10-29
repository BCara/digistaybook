import { useRef, useState, type FormEvent } from "react";
import { callHelp } from "../help/helpApi";

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");

/**
 * The Host Contact form the Terms point to. It sends through the same
 * `helpContact` function as the help widget's "Message us", so a message from
 * either lands in one inbox; this page adds the routing a widget has no room
 * for, because most people who look for "contact" want their host instead.
 */
export function ContactPage() {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  const attempt = useRef("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, fields = new FormData(form);
    attempt.current ||= newId();
    setBusy(true); setError("");
    try {
      await callHelp("helpContact", {
        requestId: attempt.current, name: fields.get("name"), email: fields.get("email"), message: fields.get("message"), transcript: []
      });
      form.reset(); attempt.current = ""; setSent(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page narrow-page">
      <p className="eyebrow">Contact us</p>
      <h1>Get in touch</h1>
      <p className="lede">
        Questions about DigiStayBook, your host account, billing or setting up your guestbook? Send us a message and
        we’ll reply by email.
      </p>

      <div className="notice">
        <strong>Staying at a property?</strong>
        <p>
          We can’t help with bookings, check-in, property access or anything during your stay. Contact your host
          through your booking app. If anyone is in danger, call local emergency services.
        </p>
      </div>

      <div className="notice" style={{ marginTop: "14px" }}>
        <strong>Privacy, personal data or content on a wall?</strong>
        <p>
          Use the <a href="/privacy-safety">Privacy &amp; Safety page</a> for data requests, takedowns and urgent
          safety concerns, so they reach the right team with a reference number.
        </p>
      </div>

      {sent ? (
        <div className="form-feedback" role="status" style={{ marginTop: "26px" }}>
          <strong>Thanks for your message.</strong>{" "}
          {import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
            ? "Local preview: your message was saved locally. No email was sent."
            : "We’ll reply to the email address you supplied."}{" "}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSent(false)}>Send another</button>
        </div>
      ) : (
        <form className="stacked-form" onSubmit={event => void submit(event)} onChange={() => { if (!busy) attempt.current = ""; }}>
          <label htmlFor="contact-name">Your name (optional)</label>
          <input id="contact-name" name="name" autoComplete="name" maxLength={100} disabled={busy} />
          <label htmlFor="contact-email">Email</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={200} disabled={busy} />
          <label htmlFor="contact-message">How can we help?</label>
          <textarea id="contact-message" name="message" rows={6} required maxLength={4000} disabled={busy} />
          <p className="field-hint">Don’t include passwords, door codes or card details. To cancel a subscription, use your Host Dashboard.</p>
          {error && <p className="form-feedback" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
        </form>
      )}

      <p className="field-hint" style={{ marginTop: "20px" }}>
        Messages are stored for up to 180 days and emailed to our support team. See our <a href="/privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
