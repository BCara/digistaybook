import { useState, useRef, type FormEvent } from "react";
import { guestContributionSchema } from "../../domain/guestContribution";
import { HostNotes } from "../wall/HostNotes";
import { EssentialMark } from "../wall/EssentialMark";
import { MemoryWall } from "../wall/MemoryWall";
import { LiveWallPage } from "./LiveWallPage";
import { DEMO_SLUG, demoPosts, demoProperty, houseEssentials, hostWallNotes, hostWelcome, wallPhotos } from "../wall/demoWall";
import { memoriesHeading } from "../wall/memoryHeading";

const MESSAGE_LIMIT = 1200;
const NAME_LIMIT = 80;

/**
 * The in-stay wall: what the QR display opens.
 *
 * This is the only wall that carries house guidance, and the only one that
 * accepts a contribution, because reaching it means holding the guestbook
 * link — the slug with the token printed into the placard beside it. The slug
 * on its own is the public wall: it is in the Host's listing and embedded on
 * their own site, and the Wi-Fi password cannot hang on that.
 */
export function StayWallPage({ propertySlug = "property", stayToken = null }: { propertySlug?: string; stayToken?: string | null }) {
  const isDemo = propertySlug === DEMO_SLUG;
  const property = demoProperty;
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  if (propertySlug !== DEMO_SLUG) return <LiveWallPage key={propertySlug} slug={propertySlug} view="stay" stayToken={stayToken} />;

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
        {/* Confirms at a glance that they scanned the right property, so it
            is the largest thing on the wall before the hosts' own words: a
            guest arriving from the placard is asking "is this the place?"
            before they are asking anything else. The hosts hang off the
            bottom edge of the cover beside it, the way the canvas and the
            phone preview draw them — and the way `LiveWallPage` draws the
            served wall, because it is the same wall. */}
        <div className="stay-cover-caption">
          {property.hostPhoto ? (
            <img className="avatar avatar-photo stay-portrait" src={property.hostPhoto.src} alt={property.hostPhoto.alt} />
          ) : property.hostInitials ? (
            <span className="avatar tone-2 stay-portrait" aria-hidden="true">{property.hostInitials}</span>
          ) : null}
          <div className="stay-cover-titles">
            <b>{property.name}</b>
            <span>{property.location}</span>
          </div>
        </div>
      </div>

      <header className="stay-welcome">
        <div className="stay-welcome-head">
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
              <dt><EssentialMark term={item.term} />{item.term}</dt>
              <dd>
                <b>{item.detail}</b>
                <small>{item.note}</small>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Whatever else the hosts want said. It belongs with what they wrote
          above rather than with the memories below: it is not a memory, and a
          guest reading it as one would be reading it wrong. */}
      <HostNotes
        notes={hostWallNotes.map((note) => ({
          id: note.id,
          message: note.message,
          style: note.style,
          photo: note.photo ? wallPhotos[note.photo] : undefined
        }))}
        author={property.hosts}
      />

      <dialog ref={dialogRef} className="contribution-dialog" aria-labelledby="contribution-title">
        <form className="contribution-card" onSubmit={submit} noValidate>
          <h2 id="contribution-title">Add your own</h2>
          <p className="field-hint">
            No account and no app. Write a note and it goes to {property.hosts} for the wall.
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
          <label htmlFor="photo">Add a photo <span className="label-optional">optional</span></label>
          <input id="photo" type="file" accept="image/jpeg, image/png, image/webp" />
          <label className="check-row">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            I consent to this message being displayed on the public wall under the current Guest Content Policy.
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button type="submit" className="btn btn-primary">Continue</button>
          </div>
          {feedback && <p className="form-feedback" role="status">{feedback}</p>}
        </form>
      </dialog>

      <div className="stay-composer">
        <button type="button" className="btn btn-primary btn-block" onClick={() => dialogRef.current?.showModal()}>Add a memory</button>
      </div>

      <MemoryWall posts={demoPosts} heading={memoriesHeading(demoPosts.length)} />

      <aside className="guest-wall-powered-by" aria-label="About DigiStayBook">
        <p>Loved your stay? <a href="/">Powered by DigiStayBook &mdash; Create a digital guestbook for your property.</a></p>
      </aside>
    </div>
  );
}
