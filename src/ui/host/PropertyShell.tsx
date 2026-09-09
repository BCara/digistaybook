import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { canDownloadQrKit, isPubliclyReadable } from "../../domain/property";
import {
  hasDisplayWall,
  profileLimits,
  validatePhotoFile,
  type PropertyPhoto,
  type PropertyProfile
} from "../../domain/propertyProfile";
import { PropertyNav, type PropertySection } from "./PropertyNav";
import { StatePills } from "./PropertyState";
import { uploadPropertyPhoto, type HostProperty } from "./propertyStore";

/**
 * The frame every screen of one property is drawn inside.
 *
 * Each of these screens used to open with its own title and its own
 * breadcrumb, and the property itself — what it is called, where it is, what
 * it looks like, whether a guest can currently reach it — was restated
 * differently on each, or not at all. A Host deep in the moderation queue had
 * nothing on the page telling them whose wall they were policing.
 *
 * So the property is stated once, across the top, and it does not move: the
 * photograph of the property, its name, the place, the two facts the server
 * owns, the way in to changing any of it, and the two things a Host most often
 * leaves this area to do. Underneath, the views stand in a column on the left
 * and the screen itself fills the rest.
 *
 * The band is the page's `h1`, because on every one of these screens the
 * subject is the property; each screen's own title is a heading within it.
 */

/** A quiet mark on the two banner actions. Named in words beside it. */
function ActionMark({ children }: { children: ReactNode }) {
  return (
    <svg className="banner-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Sliders rather than a cog: the same shape the word beside it means. */
const settingsMark = (
  <ActionMark>
    <path d="M3 6.2h9.2m3.6 0h1.2M3 13.8h1.2m3.6 0h9.2" />
    <path d="M14 4.4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm-8 7.6a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />
  </ActionMark>
);

/**
 * A banner action, which is a link while the thing it leads to exists and a
 * plain statement while it does not. A locked QR kit and an unpublished wall
 * are the ordinary state of a property still being written, so the control
 * stays in place and says why rather than disappearing and leaving a Host to
 * wonder where it went.
 */
function BannerAction({
  href,
  available,
  unavailable,
  mark,
  children
}: {
  href: string;
  available: boolean;
  unavailable: string;
  mark: ReactNode;
  children: ReactNode;
}) {
  if (!available) {
    return (
      <span className="btn btn-secondary btn-sm banner-action is-unavailable" aria-disabled="true" title={unavailable}>
        <ActionMark>{mark}</ActionMark>
        {children}
      </span>
    );
  }
  return (
    <a className="btn btn-secondary btn-sm banner-action" href={href}>
      <ActionMark>{mark}</ActionMark>
      {children}
    </a>
  );
}

export function PropertyShell({
  property,
  current,
  name,
  profile,
  className,
  aside,
  children
}: {
  property: HostProperty;
  current: PropertySection;
  /** The draft name, on a screen that is editing it, so the band never lags the page. */
  name?: string;
  /** Likewise the draft profile: the cover and the place are typed on the property view. */
  profile?: PropertyProfile;
  className?: string;
  /**
   * Anything the screen wants standing in the column under the views. It is
   * for settings about the screen rather than content on it — the paper a wall
   * is printed on, say — which would otherwise sit across the top pushing the
   * thing being edited down the page.
   */
  aside?: ReactNode;
  onChangeAvatar?: (photo: PropertyPhoto | null) => void;
  children: ReactNode;
}) {
  // A photograph chosen here is written to the property on its own, so the
  // one just uploaded is held locally: the pages that hand this band a draft
  // hand it the words they are editing, and their draft knows nothing of a
  // file that went up a second ago.
  const [uploaded, setUploaded] = useState<PropertyPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const shown = profile ?? property.profile;
  const title = (name ?? property.name).trim() || property.name;
  const avatar = uploaded ?? shown.avatar;
  const location = shown.location.trim();
  // Two different reasons a guest cannot reach the public wall, and the
  // banner has to name the right one: the subscription decides whether walls
  // are served at all, and the Host decides whether this property has a
  // public one.
  const served = isPubliclyReadable(property);
  const wallOn = hasDisplayWall(shown);
  const live = served && wallOn;
  const qrReady = canDownloadQrKit(property);
  // A property that has never been activated is the one case where the two
  // banner actions below are *both* locked and neither of their explanations
  // is anything a Host can act on. It is also the case where the thing to do
  // next is the same on every screen, so the band carries it.
  const draft = property.lifecycle === "draft";

  /**
   * The photograph goes up the moment it is chosen. Nothing is asked about it
   * first: it is decorative here — the name is beside it saying the same
   * thing — and a Host changing the picture on their own dashboard should not
   * have to fill in a form to do it.
   */
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    // Reset the control so choosing the same file twice still fires a change.
    event.target.value = "";
    if (!chosen || busy) return;
    const rejected = validatePhotoFile(chosen);
    setProblem(rejected);
    if (rejected) return;
    setBusy(true);
    const outcome = await uploadPropertyPhoto(property.id, "avatar", chosen);
    setBusy(false);
    if (outcome.status === "error") {
      setProblem(outcome.message);
      return;
    }
    setUploaded(outcome.value);
  }
  // The property view is the property's own address, so it is the one screen
  // the trail cannot offer as somewhere to go.
  const onProperty = current === "design";
  const onSettings = current === "settings";

  return (
    <div className={className ? `page property-shell ${className}` : "page property-shell"}>
      <header className="property-banner">
        {/* The trail names where you are, so the property is a link back to
            its own screen from everywhere except that screen. The half that
            names the property is marked, because a phone drops it: the
            heading two lines below says the same thing, and at that width the
            restatement wrapped across two lines of letter-spaced capitals. */}
        <p className="eyebrow">
          <a className="text-link" href="/host">Your properties</a>
          <span className="trail-here">
            {" / "}
            {onProperty ? (
              title
            ) : (
              <a className="text-link" href={`/host/property/${property.id}`}>{title}</a>
            )}
          </span>
        </p>

        <div className="banner-row">
          <div className="banner-identity">
            {/* The photograph is the control that sets it. A property with none
                yet is the ordinary case, and an empty square says nothing, so
                the square carries the mark and the words for what it wants. */}
            <button
              type="button"
              className={avatar ? "banner-thumb" : "banner-thumb is-empty"}
              onClick={() => file.current?.click()}
              disabled={busy}
              aria-label={avatar ? "Change the main photo of this property" : "Add a main photo of this property"}
            >
              {/* Decorative: the name sits beside it and says the same thing. */}
              {avatar && <img src={avatar.url} alt="" width={avatar.width} height={avatar.height} />}
              <span className="banner-thumb-say">
                <svg className="banner-thumb-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 16.5V5m0 0L7.5 9.5M12 5l4.5 4.5" />
                  <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
                </svg>
                <span>{busy ? "Uploading…" : avatar ? "Change" : "Add a photo"}</span>
              </span>
            </button>
            <input
              ref={file}
              className="visually-hidden"
              type="file"
              accept={profileLimits.photoTypes.join(",")}
              aria-label="Choose the main photo of this property"
              onChange={(event) => void choose(event)}
            />
            <div className="banner-titles">
              <h1>{title}</h1>
              {location ? <p className="banner-location">{location}</p> : null}
              <StatePills lifecycle={property.lifecycle} mode={property.mode} />
              {problem && <p className="form-feedback banner-photo-problem" role="alert">{problem}</p>}
            </div>
          </div>

          <div className="banner-actions">
            {/* What the property *is* — its name, where it is, its
                photographs — is changed from the band that states them. The
                fields were only ever typeable in place on the wall canvas,
                which is where they are read, not where a Host thinks to go
                and change them. This is the way in, and on that screen it
                stays put and says so rather than offering itself as a link
                back to where you already are. */}
            {/* Settings is not an errand like the two below it: it changes what
                the property *is*, so it reads as a quiet utility and a hairline
                keeps it out of their set rather than sitting in it as a third
                matching button. */}
            {onSettings ? (
              <span className="banner-settings is-current" aria-current="page">
                {settingsMark}
                Settings
              </span>
            ) : (
              <a className="banner-settings" href={`/host/property/${property.id}/settings`}>
                {settingsMark}
                Settings
              </a>
            )}
            <span className="banner-actions-split" aria-hidden="true" />
            <a
              className={`btn btn-secondary btn-sm banner-action ${live ? "" : "is-unavailable"}`}
              href={`/wall/${property.slug}`}
              title={
                live
                  ? undefined
                  : !wallOn
                    ? "The public wall is switched off for this property. Turn it back on from Public wall in the column on the left."
                    : draft
                      ? "This property is still a private draft. You are viewing a preview. Publish it to serve its wall to guests."
                      : "This property has no public wall yet. Walls are served only while a property is live and its subscription is running."
              }
            >
              <ActionMark>
                <path d="M7.4 8.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Zm0 1.6c-2.4 0-4.4 1.4-4.4 3.2v2.4h8.8v-2.4c0-1.8-2-3.2-4.4-3.2Zm6.4-1.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 1.6c-.5 0-1 .1-1.4.2 1 .8 1.6 1.9 1.6 3v2.4H18v-2.4c0-1.8-1.9-3.2-4.2-3.2Z" />
              </ActionMark>
              View guest wall
            </a>
            <BannerAction
              href={`/host/property/${property.id}/qr`}
              available={qrReady}
              unavailable={
                draft
                  ? "The QR display kit unlocks once this property is published and its trial is running."
                  : "The QR display kit unlocks once this property is on a running trial or a paid subscription."
              }
              mark={<path d="M3.2 3.2h4.6v4.6H3.2Zm9 0h4.6v4.6h-4.6Zm-9 9h4.6v4.6H3.2Zm9 0h1.8m3 0h-1.2m-3.6 3.4h1.8m1.8 0h1.8" />}
            >
              QR display kit
            </BannerAction>
            {/* The one thing a draft property is waiting for. It is a primary
                control rather than another quiet one because until it is done
                nothing on this screen reaches a guest, and it is here rather
                than only on the billing screen because that is the screen a
                Host has to already know to look for. */}
            {draft && (
              <a
                className="btn btn-primary btn-sm banner-action"
                href={`/host/property/${property.id}/billing`}
              >
                <ActionMark>
                  <path d="M10 15.5V4.5m0 0L5.8 8.7M10 4.5l4.2 4.2" />
                  <path d="M3.5 13v3.5h13V13" />
                </ActionMark>
                Publish this property
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="property-shell-body">
        <div className="property-side">
          <PropertyNav propertyId={property.id} current={current} publicWallOff={!wallOn} draft={draft} />
          {aside && <div className="property-side-tools">{aside}</div>}
        </div>
        <div className="property-shell-main">{children}</div>
      </div>
    </div>
  );
}
