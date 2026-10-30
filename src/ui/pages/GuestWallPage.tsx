import { MemoryWall } from "../wall/MemoryWall";
import { LiveWallPage } from "./LiveWallPage";
import { DEMO_SLUG, demoPosts, demoProperty } from "../wall/demoWall";
import { memoriesHeading } from "../wall/memoryHeading";
import { WallHeader } from "../wall/WallHeader";
import { WallFooter } from "../wall/MemoryNote";
import { readWallColour, readWallTheme } from "../../domain/wallTheme";

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
   * only makes sense on our site — the demo ribbon, the property's own header
   * (the Host's site already says whose house it is), and the site header and
   * footer, which the embedded route never draws in the first place.
   */
  embedded?: boolean;
}) {
  const isDemo = propertySlug === DEMO_SLUG && !embedded;
  const property = demoProperty;
  if (propertySlug !== DEMO_SLUG) return <LiveWallPage key={propertySlug} slug={propertySlug} view="public" embedded={embedded} />;

  // The demo can be printed on any theme (`?theme=journal&colour=sage`), so
  // the four can be compared on the same words and photographs.
  const search = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);

  return (
    <div className={embedded ? "page wall-page wall-embed" : "page wall-page"} data-wall-view="public"
      data-wall-theme={readWallTheme(search?.get("theme"))} data-wall-colour={readWallColour(search?.get("colour"))}>
      {isDemo && (
        <p className="demo-ribbon">
          <span className="demo-ribbon-tag">Demo</span>
          The public page: memories only, ready to share or embed on your own site.
          <a href={`/stay/${DEMO_SLUG}`}>See what guests see &rarr;</a>
        </p>
      )}

      {/* The served public page's own header, notes and footer, fed from the
          demo's data, so the demo is the page and not a lookalike of it. */}
      {!embedded && <WallHeader view="public" property={{
        name: property.name,
        location: property.location,
        welcome: property.welcome,
        hosts: property.hosts,
        cover: { url: property.cover.src, alt: property.cover.alt },
        hostPhoto: property.hostPhoto ? { url: property.hostPhoto.src, alt: property.hostPhoto.alt } : null
      }} />}

      <div className="wall-memories">
        <MemoryWall posts={demoPosts} heading={memoriesHeading(demoPosts.length)} />
      </div>

      <WallFooter />
    </div>
  );
}
