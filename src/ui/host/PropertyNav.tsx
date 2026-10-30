import type { ReactElement } from "react";
import { ActionDisclosure } from "../ActionDisclosure";

/**
 * The one property, and the ways of looking at it.
 *
 * A property is spread over several routes, and until now each of those was a
 * dead end: moderation offered a way back to the property and nothing else,
 * and billing could only be reached by returning to the property and scrolling
 * for it. This is the column that joins them, and it is the same column on
 * every screen, so wherever a Host is standing the other places are one
 * click away.
 *
 * It runs down the side rather than across the top because a property screen
 * is a workspace a Host stays inside: the views are the furniture of the room,
 * not a step in a sequence, and a standing column says that where a strip
 * under the title read as a set of tabs on the page below it.
 *
 * There is one wall to write. The public page used to be a row of its own
 * with its own editor, and a Host changing the cover or the name on either
 * was changing both without being told. It is built from the guest wall now,
 * and what a Host does with it — switch it on, copy the link, embed the
 * memories — is sharing, so it lives with the QR code and the guest link.
 *
 * There used to be a further entry — a list of collapsed forms at the property's
 * own address — which edited exactly the fields the property view already
 * edits in place, and carried rows pointing at moderation and billing that the
 * nav was already pointing at. The property view is the property's home now,
 * and walls and QR display, the one thing that list held on its own, is a
 * route rather than a disclosure inside it.
 *
 * Inbox and moderation is not a row: it covers every property at once, so it
 * lives beside the dashboard (`/host/inbox`) and is reached from the header.
 */

/** A row in this column: one of the ways of looking at the property. */
export type NavSection = "design" | "qr" | "billing" | "export";

/**
 * Where in the property a screen is standing. Settings is one of these and is
 * deliberately not a row here: it changes what the property *is* — its name,
 * where it is, its photographs — rather than offering another view of the
 * wall, so it is reached from the band overhead, beside the property it
 * describes. The column still needs the word, so that on that screen no row
 * claims to be the one you are on.
 */
export type PropertySection = NavSection | "settings";

/**
 * One mark per section, drawn rather than lettered.
 *
 * The icons are decoration: every row is already named in words beside them,
 * so each is hidden from assistive technology and contributes nothing to the
 * link's accessible name. They are here because a column of identical text
 * rows is harder to aim at than a column of distinct shapes.
 */
const marks: Record<NavSection, ReactElement> = {
  export: <path d="M10 2v11m-4-4 4 4 4-4M3 14v4h14v-4" />,
  design: <path d="m12.6 3.4 4 4L7.2 16.8H3.2v-4Zm-1.5 1.5 4 4" />,
  qr: <path d="M3.2 3.2h4.6v4.6H3.2Zm9 0h4.6v4.6h-4.6Zm-9 9h4.6v4.6H3.2Zm9 0h1.8m3 0h-1.2m-3.6 3.4h1.8m1.8 0h1.8" />,
  billing: <path d="M5 2.8h5.8L15 6.9v10.3H5Zm5.8 0v4.1H15M7.6 10.6h4.8m-4.8 3h4.8" />
};

function Mark({ section }: { section: NavSection }) {
  return (
    <svg className="nav-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {marks[section]}
    </svg>
  );
}

export function PropertyNav({
  propertyId,
  current,
  draft,
  mobile = false
}: {
  propertyId: string;
  mobile?: boolean;
  current: PropertySection;
  /**
   * Whether this property has never been taken live. The billing row is the
   * door to activation, and on a draft it is the *only* door, so while there
   * is nothing yet to bill it says what it is actually for. A Host looking
   * for the way to publish should not have to guess that it is behind a word
   * about money.
   */
  draft?: boolean;
}) {
  const base = `/host/property/${propertyId}`;
  const sections: { key: NavSection; label: string; href: string }[] = [
    { key: "design", label: "Guest wall", href: base },
    { key: "qr", label: "QR code and sharing", href: `${base}/qr` },
    { key: "export", label: "Export guestbook", href: `${base}/export` },
    { key: "billing", label: draft ? "Publish" : "Billing", href: `${base}/billing` }
  ];

  if (mobile) return (
    <nav className="property-mobile-nav" aria-label="Property pages">
      <ActionDisclosure key={current} className="property-page-menu" title="Property menu" label={
        <>
          <svg className="property-menu-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="visually-hidden">Property menu</span>
        </>
      }>
        <ul>{sections.map(section => (
          <li key={section.key}>
            <a className="nav-item" href={section.href} aria-current={section.key === current ? "page" : undefined}>
              <Mark section={section.key} />{section.label}
            </a>
          </li>
        ))}</ul>
      </ActionDisclosure>
    </nav>
  );

  return (
    <nav className="property-nav" aria-label="This property">
      <p className="nav-eyebrow" aria-hidden="true">Property</p>
      <ul>
        {sections.map((section) => (
          <li key={section.key}>
            {/* The label is the element's only text, so the section a Host is
                standing on is the element that carries `aria-current`. */}
            {section.key === current ? (
              <span className="nav-item view-current" aria-current="page">
                <Mark section={section.key} />
                {section.label}
              </span>
            ) : (
              <a className="nav-item" href={section.href}>
                <Mark section={section.key} />
                {section.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
