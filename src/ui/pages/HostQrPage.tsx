import { wallUnavailableReason } from "../../domain/wallAvailability";
import { useEffect, type ReactNode } from "react";
import { canDownloadQrKit, isPubliclyReadable } from "../../domain/property";
import { stayWallUrl } from "../../domain/qrCode";
import { publicWallUrl, stayWallPath } from "../../domain/wallAddress";
import { useAuth } from "../auth/AuthProvider";
import { PropertyShell } from "../host/PropertyShell";
import { QrPlacard } from "../host/QrPlacard";
import { GuestReviewPanel } from "../host/GuestReviewPanel";
import { ensureStayToken, type HostProperty } from "../host/propertyStore";
import { useProperty } from "../host/useProperty";
import { propertyBlock } from "../host/usePropertyDraft";

/**
 * The two walls this property is served on, and the placard that leads to one
 * of them.
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
  title, address, live, href, configureHref, reason, children
}: {
  title: string;
  address: string;
  live: boolean;
  href: string;
  configureHref: string;
  reason: ReturnType<typeof wallUnavailableReason>;
  children: ReactNode;
}) {
  return (
    <div className={live ? "consequence" : "consequence consequence-off"}>
      <div className="qr-wall-head">
        <strong>{title}</strong>
        <a className="qr-wall-configure" href={configureHref} aria-label={`Configure ${title.toLowerCase()}`} title={`Configure ${title.toLowerCase()}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="m9 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.4v2.3l-1.5 1.4 2 3.4 1.9-.6 2 .9.5 2h4l.5-2 2-.9 1.9.6 2-3.4-1.5-1.4v-2.3l1.5-1.4-2-3.4-1.9.6-2-.9-.5-2Z" />
            <circle cx="11" cy="11.5" r="3" />
          </svg>
        </a>
      </div>
      <p>{children}</p>
      <p className="wall-address"><code>{address}</code></p>
      {!live && <p className="field-hint">{reason.title}. {reason.message}</p>}
      {live && (
        <div className="qr-wall-actions">
          <a className="btn btn-secondary btn-sm" href={href}>Open {title.toLowerCase()}</a>
        </div>
      )}
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

  return (
    <PropertyShell property={property} current="qr" className="qr-page">
      <div className="qr-page-layout">
        <div className="qr-page-walls">
          <h2>Walls and QR display</h2>
          <p className="lede">
            {live
              ? "Your guest links and printable QR code."
              : stayReason.title}
          </p>

          {!live && <div className="actions"><a className="btn btn-primary" href={`/host/property/${property.id}/${stayReason.section}`}>{stayReason.action}</a></div>}
          <div className="consequences">
            <div className="qr-in-stay-wall">
              <Wall reason={stayReason} title="The in-stay wall" address={stayUrl} live={live} href={stayWallPath(property.slug, property.stayToken)} configureHref={`/host/property/${property.id}`}>
                The page guests open from your QR code.
              </Wall>
              <GuestReviewPanel key={propertyId} propertyId={propertyId} settingsOnly />
            </div>
            <Wall reason={publicReason} title="The public wall" address={publicWallUrl(window.location.origin, property.slug)} live={live && !property.profile.displayWallOff} href={`/wall/${property.slug}`} configureHref={`/host/property/${property.id}/public`}>
              Share this link in your listing or guest messages.
            </Wall>
          </div>
        </div>

        <div className="qr-page-kit">
          <h3>QR display</h3>

          <QrPlacard name={property.name} url={stayUrl} />

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
