import { useState, type FormEvent } from "react";
import { guestContributionSchema, type GuestPost } from "../../domain/guestContribution";

const demoPosts: GuestPost[] = [
  { id: "welcome", message: "Welcome to the cottage. The sunset from the back deck is worth waiting for.", displayName: "Your hosts", createdAt: "2026-08-01T08:00:00.000Z", visibility: "visible", pinned: true },
  { id: "memory-1", message: "We loved the coastal walk and the tiny bakery near the lighthouse.", displayName: "Mia & Sam", createdAt: "2026-08-03T10:30:00.000Z", visibility: "visible", pinned: false }
];

export function GuestWallPage({ propertySlug = "property" }: { propertySlug?: string }) {
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = guestContributionSchema.safeParse({
      propertyId: propertySlug,
      sessionId: "demo-session-0000000001",
      message,
      consent: { accepted: consent, wordingVersion: "guest-content-v1", acceptedAt: new Date().toISOString() }
    });
    if (!result.success) {
      setFeedback("Add a message and accept the content consent before continuing.");
      return;
    }
    setFeedback("Draft validated locally. Server submission will be enabled after emulator security tests pass.");
  }

  return (
    <div className="page wall-page">
      <section className="wall-intro"><p className="eyebrow">Demo property</p><h1>Seabreeze Cottage</h1><p>Useful notes and shared memories from this stay.</p></section>
      <section className="post-list" aria-label="Guest wall posts">
        {demoPosts.map((post) => <article className={post.pinned ? "post pinned" : "post"} key={post.id}>{post.pinned && <span className="status-pill">Pinned by host</span>}<p>{post.message}</p><small>{post.displayName}</small></article>)}
      </section>
      <form className="contribution-card" onSubmit={submit} noValidate>
        <h2>Add a memory</h2>
        <label htmlFor="message">Your message</label>
        <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} />
        <label className="check-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I consent to this message being displayed on the public Guest Wall under the current Guest Content Policy.</label>
        <button type="submit">Continue</button>
        {feedback && <p className="form-feedback" role="status">{feedback}</p>}
      </form>
      <aside className="guest-wall-powered-by" aria-label="About DigiStayBook">
        <p>Loved your stay? <a href="/">Powered by DigiStayBook &mdash; Create a digital guestbook for your property.</a></p>
      </aside>
    </div>
  );
}
