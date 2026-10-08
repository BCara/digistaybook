import { useId } from "react";
import { hostInitials } from "../../domain/propertyProfile";
import { EssentialMark } from "./EssentialMark";

export type WallHeaderProperty = {
  name: string; location: string; welcome: string; hosts: string;
  cover?: { url: string; alt: string } | null;
  hostPhoto?: { url: string; alt: string } | null;
  houseInformation?: { heading: string; welcome: string; tip: string; facts: { term: string; detail: string; note: string }[] } | null;
};
type WallProperty = WallHeaderProperty;

/** The saved wall and draft phone preview render these same components. */
export function WallHeader({ property, view, preview = false, headingLevel = 1 }: { property: WallHeaderProperty; view: "public" | "stay"; preview?: boolean; headingLevel?: number }) {
  if (view === "stay") return <StayWallHeader property={property} preview={preview} headingLevel={headingLevel} />;
  return <header className="live-property-header" data-no-header-photos={!property.cover && !property.hostPhoto ? "true" : undefined}>
            {property.cover
              ? <img className="live-property-cover" src={property.cover.url} alt={property.cover.alt} />
              : preview && <p className="wall-ghost">No cover photo. Guests open straight onto your name.</p>}
            {property.location && <p>{property.location}</p>}
            <h1 aria-level={headingLevel}>{property.name}</h1>
            {property.welcome
              ? <p>{property.welcome}</p>
              : preview && <p className="wall-ghost">No welcome note. This is the first thing a guest reads.</p>}
            {/* Initials stand in for a portrait that was never uploaded: the
                hosts' names are the byline, and a property with names and no
                photograph was losing the byline along with the picture. */}
            {(property.hostPhoto || property.hosts) && <div className="host-byline">
              {property.hostPhoto
                ? <img className="avatar avatar-lg avatar-photo" src={property.hostPhoto.url} alt={property.hostPhoto.alt || "Your hosts"} />
                : <span className="avatar avatar-lg tone-2" aria-hidden="true">{hostInitials(property.hosts)}</span>}
              {property.hosts && <b>{property.hosts}</b>}
            </div>}
          </header>;
}

export function StayWallHeader({ property, preview, headingLevel = 1 }: { property: WallProperty; preview: boolean; headingLevel?: number }) {
  const essentialsId = useId();
  const house = property.houseInformation;
  const paragraphs = (house?.welcome ?? "").split("\n").map(line => line.trim()).filter(Boolean);
  const facts = house?.facts.filter(fact => fact.term.trim() && fact.detail.trim()) ?? [];
  const heading = house?.heading.trim() ?? "";
  const tip = house?.tip.trim() ?? "";
  const hosts = property.hosts.trim();
  /* The eyebrow labels a note, so it waits for a note to label; a heading on
     its own is shown as the one line it is. Same rule as the phone preview. */
  const noteBody = paragraphs.length > 0 || tip !== "";
  const note = Boolean(house) && (noteBody || heading !== "" || hosts !== "");
  /* The hosts beside the property's name, hanging off the bottom edge of the
     cover — the arrangement the canvas draws and the phone preview draws, and
     until now the one thing the served wall did not. A Host who had just been
     shown their portrait over the photograph opened the wall and found it
     shrunk to a thumbnail beside a heading further down the page. */
  const mark = property.hostPhoto
    ? <img className="avatar avatar-photo stay-portrait" src={property.hostPhoto.url} alt={property.hostPhoto.alt || "Your hosts"} />
    : hosts ? <span className="avatar tone-2 stay-portrait" aria-hidden="true">{hostInitials(hosts)}</span> : null;

  return <>
    <header className="stay-cover" data-no-header-photos={!property.cover && !property.hostPhoto ? "true" : undefined}>
      {property.cover
        ? <img className="wall-cover-photo" src={property.cover.url} alt={property.cover.alt} />
        : preview && <p className="wall-ghost">No cover photo. Guests open straight onto your name.</p>}
      <div className="stay-cover-caption">
        {mark}
        <div className="stay-cover-titles">
          <h1 aria-level={headingLevel}>{property.name}</h1>
          {property.location.trim() && <span>{property.location}</span>}
        </div>
      </div>
    </header>

    {note && <section className="stay-welcome" aria-label="A note from your hosts">
      <div className="stay-welcome-head">
        <div>
          {noteBody && <p className="eyebrow">A note from your hosts</p>}
          {heading && <h2 aria-level={headingLevel + 1}>{heading}</h2>}
        </div>
      </div>
      {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {tip && <p className="stay-tip">{tip}</p>}
      {hosts && <p className="stay-signature">{hosts}</p>}
    </section>}
    {!note && preview && <p className="wall-ghost">No arrival note. This is the first thing a guest reads.</p>}

    {facts.length > 0 && <section className="essentials" aria-labelledby={essentialsId}>
      <h2 className="wall-heading" id={essentialsId}>The essentials</h2>
      <dl className="essentials-grid">
        {facts.map((fact, index) => <div className="essential" key={index}>
          <dt><EssentialMark term={fact.term} />{fact.term}</dt>
          <dd><b>{fact.detail}</b>{fact.note && <small>{fact.note}</small>}</dd>
        </div>)}
      </dl>
    </section>}
    {facts.length === 0 && preview && <p className="wall-ghost">No house essentials. Wi-Fi, checkout and the bins go here.</p>}
  </>;
}
