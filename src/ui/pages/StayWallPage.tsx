import { useState, type FormEvent } from "react";
import { guestContributionSchema } from "../../domain/guestContribution";
import { MemoryWall } from "../wall/MemoryWall";
import { DEMO_SLUG, demoPosts, demoProperty, houseEssentials, hostWelcome } from "../wall/demoWall";

const MESSAGE_LIMIT = 1200;
const NAME_LIMIT = 80;

/**
 * The in-stay wall — what the QR display opens.
 *
 * This is the only wall that carries house guidance, and the only one that
 * accepts a contribution, because reaching it means holding the QR display.
 */
export function StayWallPage({ propertySlug = "property" }: { propertySlug?: string }) {
  const isDemo = propertySlug === DEMO_SLUG;
  const property = demoProperty;
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = guestContributionSchema.safeParse({
      propertyId: propertySlug,
      sessionId: "demo-session-0000000001",
      message,
      displayName: displayName.trim() || undefined,
      consent: { accepted: consent, wordingVersion: "guest-content-v1", acceptedAt: new Date().toISOString() }
    });
    if (!result.success) {
      setFeedback("Add a message and accept the content consent before continuing.");
      return;
    }
    setFeedback("Your message is validated locally. This is a demo wall, so nothing is sent to a host yet.");
  }

  return (
    <div className="page wall-page stay-page">
      {isDemo && (
        <p className="demo-ribbon">
          <span className="demo-ribbon-tag">Demo</span>
          What your guests see after scanning the QR display.
          <a href={`/wall/${DEMO_SLUG}`}>See the public wall &rarr;</a>
        </p>
      )}

      <div className="stay-cover">
        <img
          className="wall-cover-photo"
          src={property.cover.src}
          alt={property.cover.alt}
          width={property.cover.width}
          height={property.cover.height}
          fetchPriority="high"
        />
        {/* Confirms at a glance that they scanned the right property. */}
        <p className="stay-cover-caption">
          <b>{property.name}</b>
          {property.location}
        </p>
      </div>

      <header className="stay-welcome">
        <div className="stay-welcome-head">
          <span className="avatar avatar-lg tone-2" aria-hidden="true">{property.hostInitials}</span>
          <div>
            <p className="eyebrow">A note from your hosts</p>
            <h1>{hostWelcome.heading}</h1>
          </div>
        </div>
        {hostWelcome.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <p className="stay-tip">{hostWelcome.tip}</p>
        <p className="stay-signature">{property.hosts}</p>
      </header>

      <section className="essentials" aria-labelledby="essentials-heading">
        <h2 className="wall-heading" id="essentials-heading">The essentials</h2>
        <dl className="essentials-grid">
          {houseEssentials.map((item) => (
            <div className="essential" key={item.term}>
              <dt>{item.term}</dt>
              <dd>
                <b>{item.detail}</b>
                <small>{item.note}</small>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <MemoryWall posts={demoPosts} heading="Memories from people who stayed here" />

      <form className="contribution-card" onSubmit={submit} noValidate>
        <h2>Add your own</h2>
        <p className="field-hint">
          No account and no app &mdash; write a note and it goes to {property.hosts} for the wall.
        </p>
        <label htmlFor="display-name">Your name <span className="label-optional">optional</span></label>
        <input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={NAME_LIMIT}
          placeholder="Mia &amp; Sam"
          autoComplete="off"
        />
        <label htmlFor="message">Your message</label>
        <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={MESSAGE_LIMIT} />
        <p className="field-hint">{MESSAGE_LIMIT - message.length} characters remaining</p>
        <label className="check-row">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          I consent to this message being displayed on the public Guest Wall under the current Guest Content Policy.
        </label>
        <button type="submit">Continue</button>
        {feedback && <p className="form-feedback" role="status">{feedback}</p>}
      </form>

      <aside className="guest-wall-powered-by" aria-label="About DigiStayBook">
        <p>Loved your stay? <a href="/">Powered by DigiStayBook &mdash; Create a digital guestbook for your property.</a></p>
      </aside>
    </div>
  );
}
