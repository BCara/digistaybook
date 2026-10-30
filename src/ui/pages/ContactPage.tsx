import { useRef, useState, type FormEvent } from "react";
import { callHelp } from "../help/helpApi";

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");

/** What a message is about. A custom enquiry reaches the inbox under its own subject. */
export type ContactTopic = "general" | "custom";

/** The address the pricing page and help answers use to open the form on custom options. */
export const customOptionsHref = "/contact?topic=custom#custom-options";

const topicFromUrl = (): ContactTopic =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("topic") === "custom" ? "custom" : "general";

/**
 * A custom enquiry's two optional details travel inside the message rather
 * than as fields of their own, so the support record holds exactly what the
 * Privacy Policy says it holds: a name, an email and a message.
 */
export function customEnquiryMessage(organization: string, size: string, message: string): string {
  const lines = [
    organization.trim() && `Business or organization: ${organization.trim()}`,
    size.trim() && `Properties or rooms: ${size.trim()}`
  ].filter(Boolean);
  return lines.length ? `${lines.join("\n")}\n\n${message.trim()}` : message.trim();
}

/**
 * The Host Contact form the Terms point to. It sends through the same
 * `helpContact` function as the help widget's "Message us", so a message from
 * either lands in one inbox; this page adds the routing a widget has no room
 * for, because most people who look for "contact" want their host instead.
 */
export function ContactPage() {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  const [topic, setTopic] = useState<ContactTopic>(topicFromUrl);
  const attempt = useRef("");
  const custom = topic === "custom";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, fields = new FormData(form);
    const text = (name: string) => String(fields.get(name) ?? "");
    attempt.current ||= newId();
    setBusy(true); setError("");
    try {
      await callHelp("helpContact", {
        requestId: attempt.current, name: fields.get("name"), email: fields.get("email"), topic,
        message: custom ? customEnquiryMessage(text("organization"), text("size"), text("message")) : text("message"),
        transcript: []
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

      <section id="custom-options" className="contact-custom" aria-labelledby="custom-options-heading">
        <h2 id="custom-options-heading">Running something bigger?</h2>
        <p>
          Hotels, resorts, vacation rental companies and property managers sometimes need more than a wall per
          rental: this week’s kids’ club schedule, meal plans or dining menus, activity times, or many rooms set up
          and managed together. Tell us what you have in mind and we’ll reply by email about what we can set up
          for you.
        </p>
        {!custom && !sent && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setTopic("custom"); attempt.current = ""; }}>
            Ask about custom options
          </button>
        )}
      </section>

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
          <fieldset className="contact-topic" disabled={busy}>
            <legend>What is it about?</legend>
            <label className="check-row">
              <input type="radio" name="topic" value="general" checked={!custom} onChange={() => setTopic("general")} />
              A question, or help with my account
            </label>
            <label className="check-row">
              <input type="radio" name="topic" value="custom" checked={custom} onChange={() => setTopic("custom")} />
              Custom options for a hotel, resort or larger portfolio
            </label>
          </fieldset>
          <label htmlFor="contact-name">Your name (optional)</label>
          <input id="contact-name" name="name" autoComplete="name" maxLength={100} disabled={busy} />
          <label htmlFor="contact-email">Email</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={200} disabled={busy} />
          {custom && <>
            <label htmlFor="contact-organization">Business or organization (optional)</label>
            <input id="contact-organization" name="organization" autoComplete="organization" maxLength={120} disabled={busy} />
            <label htmlFor="contact-size">How many properties or rooms? (optional)</label>
            <input id="contact-size" name="size" maxLength={60} disabled={busy} />
          </>}
          <label htmlFor="contact-message">{custom ? "What would you like guests to see?" : "How can we help?"}</label>
          <textarea
            id="contact-message" name="message" rows={6} required maxLength={custom ? 3600 : 4000} disabled={busy}
            placeholder={custom ? "For example: weekly kids’ club times and dining menus on every room’s wall, updated by our front desk." : undefined}
          />
          <p className="field-hint">Don’t include passwords, door codes or card details. To cancel a subscription, use your Host Dashboard.</p>
          {error && <p className="form-feedback" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Sending…" : custom ? "Send enquiry" : "Send message"}</button>
        </form>
      )}

      <p className="field-hint" style={{ marginTop: "20px" }}>
        Messages are stored for up to 180 days and emailed to our support team. See our <a href="/privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
