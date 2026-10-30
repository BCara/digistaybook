import { wallUnavailableReason } from "../../domain/wallAvailability";
import { useEffect, useState, type ReactNode } from "react";
import { canDownloadQrKit, isPubliclyReadable } from "../../domain/property";
import { stayWallUrl } from "../../domain/qrCode";
import { readWifiLine } from "../../domain/wifi";
import { essentialMarkName } from "../wall/EssentialMark";
import { publicWallPath, publicWallUrl, stayWallPath, wallEmbedCode } from "../../domain/wallAddress";
import { useAuth } from "../auth/AuthProvider";
import { PropertyShell } from "../host/PropertyShell";
import { QrPlacard } from "../host/QrPlacard";
import { Copyable } from "../host/Copyable";
import { GuestReviewPanel } from "../host/GuestReviewPanel";
import { ensureStayToken, saveDisplayWallOff, type HostProperty } from "../host/propertyStore";
import { useProperty } from "../host/useProperty";
import { propertyBlock } from "../host/usePropertyDraft";
import "./hostQr.css";

/**
 * The two walls this property is served on, the placard that leads to one of
 * them, and the ways of sharing the other.
 *
 * The public page has no editor of its own. It is built from the guest wall —
 * the cover, the name, the place, the hosts and the approved memories — so a
 * Host writes one wall, and everything they do with the public page (switch
 * it on, copy the link, put the memories on their own site) is sharing, which
 * is what this page is for.
 *
 * This was a disclosure on the property's setup list, addressed by fragment
 * because it had nowhere else to be. The setup list is gone — the property
 * view edits every field it used to hold — and the walls outlived it, because
 * they are the one thing about a property that is neither written by a Host
 * nor decided by billing: they are where the writing ends up.
 *
 * The wall address is here rather than beside the property name, because a
 * Host looks it up when they are thinking about the QR display and never while
 * they are writing a welcome note. The address is fixed at creation and the
 * kit is unlocked by the subscription. Hosts can also choose here whether
 * new memories require approval before publication.
 */

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Host control centre</p>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

/**
 * One wall: what it is for, where it lives, and a way in while it is being
 * served. An unpublished wall keeps its row and says it is unpublished, rather
 * than vanishing and leaving a Host to wonder whether they lost it.
 */
function Wall({
  title, name = title.toLowerCase(), address, live, href, configureHref, reason, showReason = false, control, after, children
}: {
  title: string;
  /** The wall as its buttons name it, where the heading is not a name: "Copy link to the public page". */
  name?: string;
  address: string;
  live: boolean;
  href: string;
  /** Where the wall is written. The public page has nowhere: it is built from the guest wall. */
  configureHref?: string;
  /** Drawn at the foot of the card, after the link and its buttons. */
  after?: ReactNode;
  reason: ReturnType<typeof wallUnavailableReason>;
  showReason?: boolean;
  /** A switch drawn under the description, for a wall a Host can turn off. */
  control?: ReactNode;
  children: ReactNode;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => {
    setCopyState("idle");
  }, [address]);
  useEffect(() => {
    if (copyState !== "copied") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(address);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }
  return (
    <section className="qr-wall-card" aria-label={title}>
      <div className="qr-wall-head">
        <h3>{title}</h3>
        <span className="qr-wall-status" data-live={live}>{live ? "Live" : "Offline"}</span>
        {configureHref && <a className="qr-wall-configure" href={configureHref} aria-label={`Configure ${name}`} title={`Configure ${name}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="m9 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.4v2.3l-1.5 1.4 2 3.4 1.9-.6 2 .9.5 2h4l.5-2 2-.9 1.9.6 2-3.4-1.5-1.4v-2.3l1.5-1.4-2-3.4-1.9.6-2-.9-.5-2Z" />
            <circle cx="11" cy="11.5" r="3" />
          </svg>
        </a>}
      </div>
      <p className="qr-wall-description">{children}</p>
      {control}
      <p className="wall-address"><code>{address}</code></p>
      {showReason && <p className="field-hint">{reason.title}. {reason.message}</p>}
      <div className="qr-wall-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyLink()} aria-label={`Copy link to ${name}`}>
          {copyState === "copied" ? "Copied" : "Copy link"}
        </button>
        <span className="visually-hidden" role="status">{copyState === "copied" ? `Link to ${name} copied.` : ""}</span>
        <a className="btn btn-secondary btn-sm" href={href} aria-label={`View ${name}`}>View wall</a>
      </div>
      {copyState === "error" && <p className="field-hint" role="status">Could not copy. Select and copy the link above.</p>}
      {after}
    </section>
  );
}

/**
 * The public wall's on/off decision, without a trip to the wall editor. Only
 * this one field is written, so nothing else on the profile is touched.
 */
function PublicWallSwitch({ property, onSaved }: { property: HostProperty; onSaved: (off: boolean) => void }) {
  const off = property.profile.displayWallOff === true;
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  async function change(nextOff: boolean) {
    setSaving(true);
    setFailed(false);
    const result = await saveDisplayWallOff(property.id, nextOff);
    setSaving(false);
    if (result.status === "ok") onSaved(result.value);
    else setFailed(true);
  }
  return (
    <div className="qr-wall-switch">
      <label className="switch">
        <input type="checkbox" role="switch" checked={!off} disabled={saving} onChange={event => void change(!event.target.checked)} />
        <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
        <span className="switch-label">Public page</span>
        <span className="qr-wall-switch-state" aria-hidden="true">{off ? "Off" : "On"}</span>
      </label>
      {failed && <p className="field-hint" role="status">The public page could not be switched. Try again.</p>}
    </div>
  );
}

export function HostQrPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [load, setLoad] = useProperty(propertyId);
  const block = propertyBlock(load, user?.uid);
  // A property made before guestbook links carried a token has none to print.
  // This is the only screen that needs the link, so it is the one that asks
  // for it; the server mints once and hands back the same token thereafter.
  // A failure is left as it is — the page then shows the address without its
  // token, which is honestly the public wall, and opening it again asks again.
  const untokened = load.status === "ready" && !load.property.stayToken;
  useEffect(() => {
    if (!untokened) return;
    let live = true;
    void ensureStayToken(propertyId).then(result => {
      if (!live || result.status !== "ok") return;
      setLoad(current => current.status === "ready"
        ? { status: "ready", property: { ...current.property, stayToken: result.value } }
        : current);
    });
    return () => { live = false; };
  }, [untokened, propertyId, setLoad]);

  if (block) {
    return (
      <Shell title={block.title}>
        {block.kind === "loading" ? (
          <p className="lede" role="status">{block.message}</p>
        ) : (
          <>
            <div className="notice" role={block.alert ? "alert" : undefined}>
              <strong>{block.strong}</strong>
              <p>{block.message}</p>
            </div>
            <div className="actions">
              <a className="btn btn-secondary" href={block.backHref}>{block.backLabel}</a>
            </div>
          </>
        )}
      </Shell>
    );
  }

  // propertyBlock returns null only once the read has landed on a property
  // this account owns.
  const property = (load as { status: "ready"; property: HostProperty }).property;
  const live = isPubliclyReadable(property);
  const availability = { ...property, publicWallOff: property.profile.displayWallOff };
  const stayReason = wallUnavailableReason(availability, "stay");
  const publicReason = wallUnavailableReason(availability, "public");
  const qrReady = canDownloadQrKit(property);
  // The placard carries an absolute address, and the honest one is the site
  // the Host is standing on: a preview showing a production URL from a local
  // build would be a code that scans to the wrong place.
  const stayUrl = stayWallUrl(window.location.origin, property.slug, property.stayToken);
  // The house Wi-Fi joins the card when its line names a network and a
  // password; a line that does not is pointed out, since the fix is a few
  // keystrokes in the essentials.
  const wifiLine = property.profile.factsOff ? undefined
    : property.profile.facts.find(fact => essentialMarkName(fact.term) === "wifi" && fact.detail.trim());
  const wifiLogin = wifiLine ? readWifiLine(wifiLine.detail) : null;
  const wifi = wifiLogin?.network ? { network: wifiLogin.network, password: wifiLogin.password } : null;

  return (
    <PropertyShell property={property} current="qr" className="qr-page">
      <div className="qr-page-layout">
        <div className="qr-page-walls">
          <h2>QR code and sharing</h2>
          <p className="lede">Your printable QR code, your guest link, and ways to share your memories.</p>
          {!live && (
            <div className="qr-access-notice">
              <div><strong>{stayReason.title}</strong><p>{stayReason.message}</p></div>
              <a className="btn btn-secondary btn-sm" href={`/host/property/${property.id}/${stayReason.section}`}>{stayReason.action}</a>
            </div>
          )}
          <div className="qr-wall-list">
            <div className="qr-in-stay-wall">
              <Wall reason={stayReason} title="The guest wall" address={stayUrl} live={live} href={stayWallPath(property.slug, property.stayToken)} configureHref={`/host/property/${property.id}`}>
                The page guests open from your QR code.
              </Wall>
              <GuestReviewPanel key={propertyId} propertyId={propertyId} settingsOnly reviewContent={property.reviewContent === true}
                onReviewContentSaved={reviewContent => setLoad(current => current.status === "ready" && current.property.id === propertyId
                  ? { status: "ready", property: { ...current.property, reviewContent } }
                  : current)} />
            </div>
            <Wall reason={publicReason} showReason={live && property.profile.displayWallOff === true} title="Share your memories" name="the public page" address={publicWallUrl(window.location.origin, property.slug)} live={live && !property.profile.displayWallOff} href={publicWallPath(property.slug)}
              control={<PublicWallSwitch property={property} onSaved={displayWallOff => setLoad(current => current.status === "ready" && current.property.id === property.id
                ? { status: "ready", property: { ...current.property, profile: { ...current.property.profile, displayWallOff } } }
                : current)} />}
              after={!property.profile.displayWallOff && (
                <details className="wall-embed-details">
                  <summary>Put your memories on your own website</summary>
                  <div className="wall-embed-content">
                    <Copyable
                      label="Embed code"
                      value={wallEmbedCode(window.location.origin, property.slug, property.name)}
                      action="Copy embed code"
                      multiline
                    />
                    <p className="field-hint">
                      Paste this where the memories should appear: a page on Wix, Squarespace, WordPress or your own HTML.
                      It shows the memories only, without our cover and name, because your site already has its own
                      header. It fits the width you give it and updates as guests leave memories. Change <code>height</code> to
                      suit the space.
                    </p>
                  </div>
                </details>
              )}>
              A page of your guests’ memories under your cover photo and name, made from your guest wall. No house rules, Wi-Fi or check-out details. Post the link on your social pages or send it to past guests. Booking platforms limit outside links in listings and messages, so check their rules first.
            </Wall>
          </div>
        </div>

        <div className="qr-page-kit">
          <h3>QR display</h3>

          <QrPlacard name={property.name} url={stayUrl} wifi={wifi} />
          {wifiLine && !wifi && (
            <p className="field-hint qr-wifi-hint">
              To add a code that joins your Wi-Fi, write your {wifiLine.term} line as network / password, such as <code>Seabreeze / sandcastle42</code>.
            </p>
          )}
          {wifi && (
            <p className="field-hint qr-wifi-hint">
              Keep the Wi-Fi password written somewhere guests can read it too, such as a card by the router. Not every
              phone can scan a Wi-Fi code, and a guest with no signal can’t open your guest wall to look it up.
            </p>
          )}

          <div className="qr-guest-link">
            <strong>Guest link</strong>
            <a className="wall-address" href={stayUrl}>{stayUrl}</a>
          </div>

          <div className="consequences">
            {qrReady ? (
              <div className="consequence">
                <p>Print and display where guests can scan it.</p>
                <button className="btn btn-primary" onClick={() => window.print()}>Print placard</button>
              </div>
            ) : (
              <div className="consequence consequence-off">
                <strong>Printing is locked</strong>
                <p>
                  Printing unlocks with an active trial or subscription.
                </p>
                {live ? null : (
                  <p className="field-hint">
                    This QR code leads to an offline wall.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="fine-print">
            <p>
              Your QR code stays the same if you rename the property.
            </p>
          </div>
        </div>
      </div>

      <div className="actions">
        <a className="btn btn-secondary" href={`/host/property/${property.id}`}>Back to the property</a>
      </div>
    </PropertyShell>
  );
}
