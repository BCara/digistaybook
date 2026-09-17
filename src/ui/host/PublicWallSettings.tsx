import { useState } from "react";
import { isPubliclyReadable } from "../../domain/property";
import { publicWallPath, publicWallUrl, wallEmbedCode } from "../../domain/wallAddress";
import type { HostProperty } from "./propertyStore";

/**
 * What the public wall is for, whether it is on, and how a Host puts it on
 * their own website.
 *
 * The public wall is the one part of a property a Host does something with
 * outside DigiStayBook: they paste it into a listing, mail it to a guest, or
 * drop it into their own site beside the booking form. Until now the page
 * showed them how to write the wall and never told them what to do with it,
 * and there was no way to decide against having one at all — a Host who
 * takes bookings only through an agency has nothing to share and was given a
 * public wall regardless.
 *
 * So the switch and the addresses stand together, above the wall itself: the
 * decision, then the two ways of using what the decision keeps.
 */

/** A copyable string with the button that copies it. */
function Copyable({
  label,
  value,
  action,
  multiline,
  href
}: {
  label: string;
  value: string;
  action: string;
  multiline?: boolean;
  /** Given for an address a Host can also just open: the value becomes the link. */
  href?: string;
}) {
  // "Copied" rather than a permanently green button: the message is about the
  // click that just happened, and it goes when another one is made.
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      // A browser that refuses the clipboard — an insecure origin, a denied
      // permission — must not be told it worked. The text is on the page and
      // selectable, so say that instead.
      setState("failed");
    }
  }

  return (
    <div className="wall-copy">
      <p className="wall-copy-label">{label}</p>
      <div className="wall-copy-row">
        {multiline ? (
          <pre className="wall-copy-value"><code>{value}</code></pre>
        ) : href ? (
          // An address a Host is about to hand out is one they will want to
          // look at first, and copying it into a new tab to do that is a
          // errand the page can spare them. It opens in its own tab so the
          // wall they were writing is still here when they come back.
          <code className="wall-copy-value">
            <a href={href} target="_blank" rel="noreferrer">{value}</a>
          </code>
        ) : (
          <code className="wall-copy-value">{value}</code>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
          {action}
        </button>
        {/* Copying an address and pasting it into a new tab to see what a
            guest sees is three steps for one look. This is the look. */}
        {href && (
          <a className="btn btn-secondary btn-sm" href={href} target="_blank" rel="noreferrer">
            Open wall
          </a>
        )}
      </div>
      {state !== "idle" && (
        <p className={state === "copied" ? "wall-copy-said" : "wall-copy-said failed"} role="status">
          {state === "copied" ? "Copied." : "Your browser would not let us copy it. Select the text above instead."}
        </p>
      )}
    </div>
  );
}

export function PublicWallSettings({
  property,
  off,
  disabled,
  onChange
}: {
  property: HostProperty;
  /** The stored decision. Negative, because a property has a public wall unless a Host says otherwise. */
  off: boolean;
  disabled?: boolean;
  onChange: (off: boolean) => void;
}) {
  // Being on is a Host's decision; being served is the subscription's. Both
  // have to be true for the address to reach anybody, and a Host who has
  // turned the wall on and cannot see it needs to be told which of the two is
  // missing rather than left to guess.
  const served = isPubliclyReadable(property);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <section className={off ? "wall-share is-off" : "wall-share"} aria-label="This wall">
      <div className="wall-share-decision">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={!off}
            disabled={disabled}
            onChange={(event) => onChange(!event.target.checked)}
          />
          <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
          <span className="switch-label">Public wall</span>
        </label>
        <p className="wall-share-say">
          {off
            ? "This wall is off. Its address reaches nobody and nothing here is shared, but every word is kept for whenever you turn it back on. Your in-stay wall and the QR display are unaffected."
            : "Share your memories anywhere with a single link. Drop it in your listing, email it to a guest who just checked out, or embed it on your own site. No house rules or checkout instructions here, just pure nostalgia."}
        </p>
      </div>

      {!off && (
        <div className="wall-share-uses">
          {served ? (
            <Copyable
              label="Share the link"
              value={publicWallUrl(origin, property.slug)}
              href={publicWallPath(property.slug)}
              action="Copy link"
            />
          ) : (
            <div className="wall-copy">
              <p className="wall-copy-label">Share the link</p>
              <p className="wall-copy-value"><code>{publicWallPath(property.slug)}</code></p>
              <p className="field-hint">
                This address is fixed to the property and will not change, but it is not being served yet: walls go
                live once this property is on a running trial or a paid subscription.
              </p>
            </div>
          )}

          <details className="wall-embed-details">
            <summary>Put it on your own website</summary>
            <div className="wall-embed-content">
              <Copyable
                label="Embed code"
                value={wallEmbedCode(origin, property.slug, property.name)}
                action="Copy embed code"
                multiline
              />
              <p className="field-hint">
                Paste that where the wall should appear — a page on Wix, Squarespace, WordPress or your own HTML. It
                loads the same wall without our header and footer, sizes itself to the width you give it, and updates
                on its own as guests leave memories. Change <code>height</code> to suit the space.
              </p>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
