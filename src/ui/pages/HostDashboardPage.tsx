import { useCallback, useEffect, useState } from "react";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { lifecycleSummaries } from "../../domain/property";
import { attentionItems } from "../../domain/billingSchedule";
import { useAuth } from "../auth/AuthProvider";
import { rememberProperties, rememberProperty } from "../host/propertyCache";
import { listOwnedProperties, type HostProperty } from "../host/propertyStore";
import { AddPropertyDialog, type PropertyWizardResult } from "../host/PropertyDialog";
import { formatDate, StatePills } from "../host/PropertyState";
import { navigate } from "../routing";
import { DashboardOverview } from "../host/DashboardOverview";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; properties: HostProperty[] }
  | { status: "error"; message: string };

/** What was just added, kept so the list can be introduced by its newest entry. */
type Added = { id: string; name: string; photoWarning: string | null };

function PropertyCard({ property, now, onDelete }: {
  property: HostProperty;
  now: number;
  onDelete: (id: string) => void;
}) {
  // A draft is the state every property starts in and the only one whose next
  // step is not on the property's own screens. The card says what the pill
  // beside the name means and carries the way out of it, so a Host reading
  // their list is never left holding a word — "Draft", "Private" — with no
  // control anywhere near it.
  const draft = property.lifecycle === "draft";
  // The same list the strip above counts, asked one property at a time, so
  // the number up there and the marks down here can never disagree. A card
  // that needs something takes an accent rule along its top edge: the mark
  // sits on the thing that needs the work rather than in a panel elsewhere.
  const needsAttention = attentionItems([property], now).length > 0;
  // The avatar is the property's own small photograph, the one the Host area
  // identifies it by. A property whose Host has only set a cover is still
  // recognisable by it, so the cover stands in rather than the card showing
  // nothing at all.
  const photo = property.profile.avatar ?? property.profile.cover;

  async function remove() {
    if (!window.confirm(`Delete ${property.name}? This cannot be undone.`)) return;
    const { deleteProperty } = await import("../host/propertyStore");
    const result = await deleteProperty(property.id);
    if (result.status === "ok") onDelete(property.id);
    else alert("Failed to delete property: " + result.message);
  }

  return (
    // Named by its own heading so a screen reader announces which property a
    // card belongs to before reading its facts.
    <article
      className={needsAttention ? "property-card needs-attention" : "property-card"}
      aria-labelledby={`property-${property.id}`}
    >
      <div className="property-card-head">
        {/* The property's own small photograph, which is what a Host reading a
            grid of these recognises before they have read a word of it. A
            property without one yet keeps the plain head rather than holding
            an empty square: the picture is added on the property's own page. */}
        {photo && (
          <img
            className="property-card-thumb"
            src={photo.url}
            alt=""
            width={photo.width}
            height={photo.height}
          />
        )}
        <div className="property-card-titles">
          <h2 id={`property-${property.id}`}>
            <a className="text-link" href={`/host/property/${property.id}`}>{property.name}</a>
          </h2>
          <StatePills lifecycle={property.lifecycle} mode={property.mode} />
        </div>
        {/* Deletion is permanent, so it is a quiet mark in the corner rather
            than a red one: it takes no room from the card's own facts, and it
            still asks a direct question before anything goes. */}
        <button
          type="button"
          className="property-card-delete"
          title="Delete this property"
          aria-label={`Delete ${property.name}`}
          onClick={remove}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h16" />
            <path d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1Z" />
            <path d="M6 7l1 12.1A1.9 1.9 0 0 0 8.9 21h6.2a1.9 1.9 0 0 0 1.9-1.9L18 7" />
            <path d="M10.5 11v6M13.5 11v6" />
          </svg>
        </button>
      </div>
      <dl className="property-facts">
        <div>
          <dt>Wall address</dt>
          {/* An address, so it is set as one: the serif-weight bold it used to
              carry made it compete with the property's own name. */}
          <dd className="property-address">/wall/{property.slug}</dd>
        </div>
        <div>
          <dt>House guidance posts</dt>
          <dd>{property.foundationalPostCount}</dd>
        </div>
        <div>
          <dt>Added</dt>
          <dd>{formatDate(property.createdAt)}</dd>
        </div>
      </dl>
      {/* Held at the foot of the card, because a draft carries a line the other
          cards do not and the row of cards is as tall as its tallest member:
          without this the one control every card has would sit at a different
          height on each of them. */}
      <div className="property-card-foot">
        {draft && <p className="property-card-state">{lifecycleSummaries.draft}</p>}
        <div className="actions">
          <a className="btn btn-secondary btn-sm" href={`/host/property/${property.id}`}>
            Manage
          </a>
          {draft && (
            <a className="btn btn-primary btn-sm" href={`/host/property/${property.id}/billing`}>
              Publish
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function HostDashboardPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<Added | null>(null);

  const refresh = useCallback(async (ownerUid: string) => {
    const outcome = await listOwnedProperties(ownerUid);
    // This list is the whole property, not a summary of it, so a property
    // opened from here opens on what the card was already showing rather than
    // blanking while it is read a second time.
    if (outcome.status === "ok") rememberProperties(outcome.value);
    setLoad(
      outcome.status === "ok"
        ? { status: "ready", properties: outcome.value }
        : { status: "error", message: outcome.message }
    );
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !uid) return;
    void refresh(uid);
  }, [uid, refresh]);

  /**
   * The header's "Add property" action is a link to #add-property, from any
   * page in the host area. It is a fragment rather than a route because the
   * wizard belongs to this page, so arriving on it — or already being on it —
   * is what opens the wizard.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    function openFromHash() {
      if (window.location.hash !== "#add-property") return;
      setAdded(null);
      setAdding(true);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function closeWizard() {
    setAdding(false);
    // The fragment has to come off the URL: leaving it there means the header's
    // link fires no `hashchange` the next time it is clicked, and nothing opens.
    if (typeof window !== "undefined" && window.location.hash === "#add-property") {
      navigate(window.location.pathname, { replace: true });
    }
  }

  function onCreated({ property, photoWarning }: PropertyWizardResult) {
    // The property is already known in full, so the card the list is about to
    // draw opens without a second read behind it.
    rememberProperty(property);
    setAdded({ id: property.id, name: property.name, photoWarning });
    closeWizard();
    if (uid) void refresh(uid);
  }

  if (!firebaseConfigured) {
    return (
      <div className="page narrow-page">
        <p className="eyebrow">Protected host area</p>
        <h1>Dashboard unavailable</h1>
        <div className="notice">
          <strong>No Firebase environment is configured.</strong>
          <p>The implementation deliberately fails closed instead of providing a local authentication bypass.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/">Back to home</a>
        </div>
      </div>
    );
  }

  const properties = load.status === "ready" ? load.properties : [];
  // Read once per render so the strip's counts and every card's own mark are
  // answering the same moment.
  const now = Date.now();

  return (
    <div className="page">
      <p className="eyebrow">Host control centre</p>
      <div className="page-head">
        <div>
          <h1>Your host overview</h1>
          <p className="lede">See your properties, upcoming payments and what needs attention.</p>
        </div>
        {/* The one thing this page is for, other than opening a property, so
            it is a control at the top rather than a form at the bottom. */}
        <button
          type="button"
          className="btn btn-primary"
          disabled={adding}
          onClick={() => {
            setAdded(null);
            setAdding(true);
          }}
        >
          Add property
        </button>
      </div>

      {/* The wizard opens over the dashboard rather than unfolding down it:
          a Host adding a property is answering about a property, and the list
          they are adding to should still be behind them when they are done. */}
      {adding && (
        <AddPropertyDialog
          ownerUid={uid}
          takenSlugs={properties.map((property) => property.slug)}
          onCancel={closeWizard}
          onCreated={onCreated}
        />
      )}

      {load.status === "ready" && properties.length > 0 && <DashboardOverview properties={properties} now={now} />}

      <section className="host-section" aria-labelledby="properties-heading">
        <h2 id="properties-heading">
          {load.status === "ready" && properties.length > 0
            ? `${properties.length} ${properties.length === 1 ? "property" : "properties"}`
            : "Properties"}
        </h2>

        {added && (
          <div className="notice" role="status">
            <strong>{added.name} was added.</strong>
            {added.photoWarning ? (
              // The property exists either way, so this reports what did not
              // happen rather than casting doubt on what did.
              <p>{added.photoWarning} You can add it again from the property settings.</p>
            ) : (
              <p>Open it to write your welcome and your house guidance before any guest reaches the wall.</p>
            )}
            <p>
              <a className="text-link" href={`/host/property/${added.id}`}>Open {added.name} &rarr;</a>
            </p>
          </div>
        )}

        {load.status === "loading" && <p className="lede" role="status">Loading your properties…</p>}

        {load.status === "error" && (
          <div className="notice" role="alert">
            <strong>We could not load your properties.</strong>
            <p>{load.message}</p>
          </div>
        )}

        {load.status === "ready" && properties.length === 0 && (
          <div className="empty-state">
            <p><b>No properties yet.</b></p>
            <p>
              Three short steps: what the property is, what it says to a guest, and the lines you answer every
              week. It starts private, so you can see the whole wall before any guest reaches it.
            </p>
            {!adding && (
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setAdded(null);
                    setAdding(true);
                  }}
                >
                  Add your first property
                </button>
              </div>
            )}
          </div>
        )}

        {properties.length > 0 && (
          <div className="property-grid">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                now={now}
                onDelete={(deletedId) => setLoad(prev => prev.status === "ready" ? { ...prev, properties: prev.properties.filter(p => p.id !== deletedId) } : prev)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
