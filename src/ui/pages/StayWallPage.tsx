import { useState, useRef, type FormEvent } from "react";
import { guestContributionSchema } from "../../domain/guestContribution";
import { HostNotes } from "../wall/HostNotes";
import { StayWallHeader } from "../wall/WallHeader";
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
    <div className="page wall-page stay-page" data-wall-theme="linen" data-wall-colour="sand">
      {isDemo && (
        <p className="demo-ribbon">
          <span className="demo-ribbon-tag">Demo</span>
          What your guests see after scanning the QR display.
          <a href={`/wall/${DEMO_SLUG}`}>See the public wall &rarr;</a>
        </p>
      )}

      {/* The same header the served wall draws, fed from the demo's data, so
          the demo is what a real guest would see and not a lookalike. */}
      <StayWallHeader
        preview={false}
        property={{
          name: property.name,
          location: property.location,
          welcome: property.welcome,
          hosts: property.hosts,
          cover: { url: property.cover.src, alt: property.cover.alt },
          hostPhoto: property.hostPhoto ? { url: property.hostPhoto.src, alt: property.hostPhoto.alt } : null,
          houseInformation: { heading: hostWelcome.heading, welcome: hostWelcome.body.join("\n"), tip: hostWelcome.tip, facts: houseEssentials }
        }}
        links={[
          { href: "#wall-host-notes", label: "From your hosts", mark: "home" },
          { href: "#memory-wall-heading", label: "Guestbook", mark: "book" }
        ]}
      />

      {/* Whatever else the hosts want said. It belongs with what they wrote
          above rather than with the memories below: it is not a memory, and a
          guest reading it as one would be reading it wrong. */}
      <HostNotes
        id="wall-host-notes"
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

      <MemoryWall posts={demoPosts} heading={memoriesHeading(demoPosts.length)} />

      <div className="wall-contribution-pinned">
        <button type="button" className="btn btn-primary" onClick={() => dialogRef.current?.showModal()}>
          Add to guestbook
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <aside className="guest-wall-powered-by" aria-label="About DigiStayBook">
        <p>Loved your stay? <a href="/">Powered by DigiStayBook &mdash; Create a digital guestbook for your property.</a></p>
      </aside>
    </div>
  );
}
