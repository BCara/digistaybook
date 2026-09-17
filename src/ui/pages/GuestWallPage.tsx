import { HostNotes } from "../wall/HostNotes";
import { MemoryWall } from "../wall/MemoryWall";
import { LiveWallPage } from "./LiveWallPage";
import { DEMO_SLUG, demoPosts, demoProperty, hostWallNotes, wallPhotos } from "../wall/demoWall";
import { memoriesHeading } from "../wall/memoryHeading";

/**
 * The public wall: the link a host shares or embeds on their own site.
 *
 * It carries the property, the hosts and the memories guests left. It
 * deliberately carries no house guidance: Wi-Fi passwords, bin days and
 * checkout arrangements only appear on the in-stay wall behind the QR display.
 */
export function GuestWallPage({
  propertySlug = "property",
  embedded = false
}: {
  propertySlug?: string;
  /**
   * True on `/embed/wall/{slug}`, the rendering a Host puts in an iframe on
   * their own site. The wall is the same wall; what goes is everything that
   * only makes sense on our site — the demo ribbon here, and the site header
   * and footer, which the embedded route never draws in the first place.
   */
  embedded?: boolean;
}) {
  const isDemo = propertySlug === DEMO_SLUG && !embedded;
  const property = demoProperty;
  if (propertySlug !== DEMO_SLUG) return <LiveWallPage key={propertySlug} slug={propertySlug} view="public" />;

  return (
    <div className={embedded ? "page wall-page wall-embed" : "page wall-page"}>
      {isDemo && (
        <p className="demo-ribbon">
          <span className="demo-ribbon-tag">Demo</span>
          A public wall, ready to share or embed on your own site.
          <a href={`/stay/${DEMO_SLUG}`}>See what guests see &rarr;</a>
        </p>
      )}

      <header className="wall-cover">
        <img
          className="wall-cover-photo"
          src={property.cover.src}
          alt={property.cover.alt}
          width={property.cover.width}
          height={property.cover.height}
          fetchPriority="high"
        />
        <div className="wall-cover-body">
          <div className="wall-monogram" aria-hidden="true">{property.monogram}</div>
          <p className="eyebrow">The wall at</p>
          <h1>{property.name}</h1>
          <p className="wall-location">{property.location}</p>
          <p className="wall-welcome">{property.welcome}</p>
          <div className="host-byline">
            {property.hostPhoto ? (
              <img className="avatar avatar-lg avatar-photo" src={property.hostPhoto.src} alt={property.hostPhoto.alt} />
            ) : property.hostInitials ? (
              <span className="avatar avatar-lg tone-2" aria-hidden="true">{property.hostInitials}</span>
            ) : null}
            <span>
              <b>{property.hosts}</b>
              <small>{property.hostSince}</small>
            </span>
          </div>
        </div>
      </header>

      {/* Whatever else the hosts want said, in their own voice and above the
          memories rather than among them: none of them is one. */}
      <HostNotes
        notes={hostWallNotes.map((note) => ({
          id: note.id,
          message: note.message,
          style: note.style,
          photo: note.photo ? wallPhotos[note.photo] : undefined
        }))}
        author={property.hosts}
      />

      <MemoryWall posts={demoPosts} heading={memoriesHeading(demoPosts.length)} />

      <aside className="wall-invite" aria-label="Staying here soon">
        <h2>Staying here soon?</h2>
        <p>
          Your hosts&rsquo; welcome notes, the Wi-Fi and everything else you need are on the wall you reach by
          scanning the QR display when you arrive. That is also where you add your own memory.
        </p>
      </aside>

      <aside className="guest-wall-powered-by" aria-label="About DigiStayBook">
        <p>Loved your stay? <a href="/">Powered by DigiStayBook &mdash; Create a digital guestbook for your property.</a></p>
      </aside>
    </div>
  );
}
