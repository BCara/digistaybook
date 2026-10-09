import { useEffect, useId, useState } from "react";
import { hostInitials } from "../../domain/propertyProfile";
import { EssentialMark, essentialMarkName, type EssentialMarkName } from "./EssentialMark";
import "./stayWall.css";

export type WallHeaderProperty = {
  name: string; location: string; welcome: string; hosts: string;
  cover?: { url: string; alt: string } | null;
  hostPhoto?: { url: string; alt: string } | null;
  houseInformation?: { heading: string; welcome: string; tip: string; facts: { term: string; detail: string; note: string }[] } | null;
};
type WallProperty = WallHeaderProperty;

/** The saved wall and draft phone preview render these same components. */
export function WallHeader({ property, view, preview = false, headingLevel = 1, links }: { property: WallHeaderProperty; view: "public" | "stay"; preview?: boolean; headingLevel?: number; links?: readonly StayQuickLink[] }) {
  if (view === "stay") return <StayWallHeader property={property} preview={preview} headingLevel={headingLevel} links={links} />;
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

/**
 * A link the page around the header adds to the quick links. The hosts'
 * notes and the memories are drawn outside this component, but a guest
 * scanning the quick links should be able to jump to them too.
 */
export type StayQuickLink = { href: string; label: string; mark: EssentialMarkName };

/** Lines worth copying onto a phone keyboard: passwords and door codes. */
const copyable = new Set<EssentialMarkName>(["wifi", "keys"]);

/** `useId` output is not guaranteed to be safe in a URL fragment. */
const anchorSafe = (id: string): string => id.replace(/[^a-zA-Z0-9_-]/g, "");

/**
 * The in-stay wall, laid out for a phone held in a hallway: the property and
 * the hosts first, then one tap to each line a guest came for, then those
 * lines in full further down. The guestbook button is pinned by the page.
 */
export function StayWallHeader({ property, preview, headingLevel = 1, links = [] }: {
  property: WallProperty; preview: boolean; headingLevel?: number; links?: readonly StayQuickLink[];
}) {
  const baseId = `stay${anchorSafe(useId())}`;
  const essentialsId = `${baseId}-essentials`;
  const house = property.houseInformation;
  const paragraphs = (house?.welcome ?? "").split("\n").map(line => line.trim()).filter(Boolean);
  const facts = house?.facts.filter(fact => fact.term.trim() && fact.detail.trim()) ?? [];
  const heading = house?.heading.trim() ?? "";
  const tip = house?.tip.trim() ?? "";
  const hosts = property.hosts.trim();
  const location = property.location.trim();
  /* The card is a note only once there is something in it: a heading, words,
     or the hosts signing it. Same rule as the phone preview. */
  const note = Boolean(house) && (paragraphs.length > 0 || tip !== "" || heading !== "" || hosts !== "");
  const mark = property.hostPhoto
    ? <img className="avatar avatar-photo stay-portrait" src={property.hostPhoto.url} alt={property.hostPhoto.alt || "Your hosts"} />
    : hosts ? <span className="avatar tone-2 stay-portrait" aria-hidden="true">{hostInitials(hosts)}</span> : null;
  /* Each fact is linked by position, because two lines can share a label. */
  const factId = (index: number) => `${baseId}-fact-${index}`;
  const quickLinks: StayQuickLink[] = [
    ...facts.map((fact, index) => ({ href: `#${factId(index)}`, label: fact.term, mark: essentialMarkName(fact.term) })),
    ...links
  ];

  return <div className="stay-wall">
    <header className="stay-cover" data-no-header-photos={!property.cover && !property.hostPhoto ? "true" : undefined}>
      {property.cover
        ? <img className="wall-cover-photo" src={property.cover.url} alt={property.cover.alt} />
        : preview && <p className="wall-ghost">No cover photo. Guests open straight onto your name.</p>}
      <div className="stay-cover-titles">
        <h1 aria-level={headingLevel}>{property.name}</h1>
        {location && <span className="stay-location">
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 18s5.6-5.4 5.6-9.6a5.6 5.6 0 0 0-11.2 0C4.4 12.6 10 18 10 18Z" /><circle cx="10" cy="8.4" r="2" /></svg>
          {location}
        </span>}
      </div>
    </header>

    {note && <section className="stay-welcome stay-card" aria-label="A note from your hosts">
      {mark}
      <div className="stay-welcome-words">
        {heading && <h2 aria-level={headingLevel + 1}>{heading}</h2>}
        {hosts && <p className="stay-hosts"><span className="stay-eyebrow">Your hosts,</span> <b>{hosts}</b></p>}
      </div>
      {paragraphs.length > 0 && <div className="stay-welcome-body">
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>}
    </section>}
    {/* No note, but someone still hosts here: a guest should know whose house
        this is before the Host has written a word for it. */}
    {!note && mark && <section className="stay-welcome-plain stay-card" aria-label="Your hosts">
      {mark}
      {hosts && <p className="stay-hosts"><span className="stay-eyebrow">Your hosts,</span> <b>{hosts}</b></p>}
    </section>}
    {!note && preview && <p className="wall-ghost">No arrival note. This is the first thing a guest reads.</p>}

    {/* Part of the hosts' welcome, so it sits with it, ahead of the essentials. */}
    {tip && <aside className="stay-tip-card stay-card" aria-label="A tip from your hosts">
      <span className="stay-icon stay-icon-quiet">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7.6 14.4h4.8M8.2 17h3.6M10 2.6a5 5 0 0 0-2.9 9.1c.4.3.5.7.5 1.2v.5h4.8v-.5c0-.5.2-.9.5-1.2A5 5 0 0 0 10 2.6Z" /></svg>
      </span>
      <div>
        <p className="stay-eyebrow">A little tip from your hosts</p>
        <p className="stay-tip-text">{tip}</p>
      </div>
    </aside>}

    {quickLinks.length > 0 && <nav className="stay-links" aria-labelledby={essentialsId}>
      <h2 className="stay-section-title" id={essentialsId} aria-level={headingLevel + 1}>Your stay essentials</h2>
      <p className="stay-section-lede">Quick links to the key information for your stay.</p>
      <ul>
        {quickLinks.map(link => <li key={link.href}>
          <a href={link.href}>
            <span className="stay-icon"><EssentialMark term={link.label} name={link.mark} /></span>
            <span className="stay-link-label">{link.label}</span>
            <svg className="stay-chevron" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m8 5 5 5-5 5" /></svg>
          </a>
        </li>)}
      </ul>
    </nav>}

    {facts.length > 0 && <section className="stay-facts" aria-label="House information">
      {facts.map((fact, index) => <StayFact key={index} id={factId(index)} fact={fact} headingLevel={headingLevel + 2} />)}
    </section>}
    {facts.length === 0 && preview && <p className="wall-ghost">No house essentials. Wi-Fi, checkout and the bins go here.</p>}
  </div>;
}

function StayFact({ id, fact, headingLevel }: { id: string; fact: { term: string; detail: string; note: string }; headingLevel: number }) {
  const kind = essentialMarkName(fact.term);
  return <article className="stay-fact stay-card" id={id} data-fact={kind}>
    <div className="stay-fact-head">
      <span className="stay-icon"><EssentialMark term={fact.term} /></span>
      <h3 aria-level={headingLevel}>{fact.term}</h3>
    </div>
    <div className="stay-fact-body">
      <p className="stay-fact-detail">{fact.detail}</p>
      {copyable.has(kind) && <CopyButton text={fact.detail} label={fact.term} />}
    </div>
    {fact.note.trim() && <p className="stay-fact-note">{fact.note}</p>}
  </article>;
}

/**
 * Copies a password or a code, so a guest is not reading twelve characters
 * off one screen and typing them into another.
 */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  if (typeof navigator === "undefined" || !navigator.clipboard) return null;
  return <button type="button" className="stay-copy" aria-label={copied ? `${label} copied` : `Copy ${label}`}
    onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(true), () => undefined); }}>
    {copied
      ? <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m4.6 10.4 3.6 3.6 7.2-8" /></svg>
      : <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="7" y="7" width="9.6" height="9.6" rx="1.8" /><path d="M13 7V5.2c0-1-.8-1.8-1.8-1.8H5.2c-1 0-1.8.8-1.8 1.8v6c0 1 .8 1.8 1.8 1.8H7" /></svg>}
  </button>;
}
