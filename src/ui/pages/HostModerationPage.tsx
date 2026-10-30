import { useCallback, useEffect, useRef, useState } from "react";
import { reportingLimits } from "../../domain/moderation";
import { hasGuestInbox } from "../../domain/property";
import { privacySlaDays, reportReasons } from "../../domain/postModeration";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { useAuth } from "../auth/AuthProvider";
import { MemoryTable } from "../host/ModerationQueue";
import { recallOwnedProperties, rememberOwnedProperties } from "../host/propertyCache";
import { listOwnedProperties, type HostProperty } from "../host/propertyStore";
import { useGuestInbox, type GuestInbox, type InboxRow } from "../host/useGuestInbox";
import { useInboxFeed } from "../host/useInboxFeed";
import { formatDate } from "../wall/demoWall";
import "./hostModeration.css";

/**
 * The inbox and moderation queue for every property a Host owns, on one page.
 *
 * It sits beside the dashboard rather than inside a property: a Host with five
 * cottages should not open five properties to find out whether any guest is
 * waiting on them. Everything is a table with a row per item and the property
 * as a column, so several properties read as one list rather than one wall
 * after another:
 *
 *  - Inbox: what waits on the Host — memories to approve and guest reports.
 *  - Memories: everything on (or taken off) the walls, newest first.
 *  - Private feedback: what guests said to the Host alone.
 *
 * "Showing" narrows the page to one property, and `?property=` opens it that
 * way for a link that starts from a single property. A draft has had no
 * guests, so it is named with what unlocks it rather than left out.
 *
 * Every action goes to a server endpoint, which checks the property is this
 * Host's: the page asks, and renders the answer it is given.
 */

type Tab = "inbox" | "memories" | "feedback";
type LoadState =
  | { status: "loading" }
  | { status: "ready"; ownerUid: string; properties: HostProperty[] }
  | { status: "error"; message: string };

const UNPUBLISHED = "Inbox and moderation will be available when the property is published.";
const TABS: { key: Tab; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "memories", label: "Memories" },
  { key: "feedback", label: "Private feedback" }
];

function readFilter(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("property");
}

function readTab(): Tab {
  if (typeof window === "undefined") return "inbox";
  const hash = window.location.hash.slice(1);
  return hash === "memories" || hash === "feedback" ? hash : "inbox";
}

function When({ iso }: { iso?: string | null }) {
  return iso ? <time dateTime={iso}>{formatDate(iso)}</time> : <span className="cell-quiet">&mdash;</span>;
}

/** The row's own answer, under its buttons, so it is clear which item it concerns. */
function RowNotice({ inbox, rowKey }: { inbox: GuestInbox; rowKey: string }) {
  const notice = inbox.notice?.key === rowKey && inbox.notice.message ? inbox.notice : null;
  if (!notice) return null;
  return <p className={`queue-result${notice.failed ? " queue-result-failed" : ""}`} role={notice.failed ? "alert" : "status"}>{notice.message}</p>;
}

function InboxTableRow({ row, inbox, showProperty, memoryText }: {
  row: InboxRow;
  inbox: GuestInbox;
  showProperty: boolean;
  memoryText: (propertyId: string, postId: string) => string | undefined;
}) {
  const busy = inbox.busy !== null;
  const property = showProperty && <td className="cell-property" data-label="Property">{row.property.name}</td>;

  if (row.kind === "report") {
    const words = memoryText(row.property.id, row.item.postId);
    return (
      <tr className="inbox-row is-report">
        {property}
        <td className="cell-from" data-label="From"><span className="cell-quiet">Guest report</span></td>
        <td className="cell-message" data-label="Message">
          {words ? <span>&ldquo;{words}&rdquo;</span> : <span className="cell-quiet">Memory reference: {row.item.postId}</span>}
        </td>
        <td className="cell-date" data-label="Received"><span className="cell-quiet">Review by</span> <When iso={row.item.reviewDueAt} /></td>
        <td className="cell-status" data-label="Status"><span className="state-pill is-attention">Reported: {reportReasons[row.item.reason]}</span></td>
        <td className="cell-actions" data-label="Actions">
          <div className="row-actions">
            <button type="button" className="btn btn-sm btn-destructive" disabled={busy} onClick={() => void inbox.resolve(row, "delete")}>Confirm removal</button>
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void inbox.resolve(row, "dismiss")}>Dismiss</button>
          </div>
          <RowNotice inbox={inbox} rowKey={row.key} />
        </td>
      </tr>
    );
  }

  const checking = row.item.status === "pending";
  const photos = inbox.photos[row.item.id];
  return (
    <tr className="inbox-row">
      {property}
      <td className="cell-from" data-label="From">{row.item.displayName?.trim() || <span className="cell-quiet">Guest</span>}</td>
      <td className="cell-message" data-label="Message">
        {checking ? <span className="cell-quiet">Shown here once safety checks finish.</span> : <span>{row.item.message}</span>}
        {!checking && row.item.photoCount > 0 && !photos && (
          <button type="button" className="cell-link" disabled={busy} onClick={() => void inbox.loadPhotos(row)}>
            View {row.item.photoCount} {row.item.photoCount === 1 ? "photo" : "photos"}
          </button>
        )}
        {photos && <span className="cell-photos">{photos.map((src, index) => <img key={index} src={src} alt={`Memory photo ${index + 1} for review`} />)}</span>}
      </td>
      <td className="cell-date" data-label="Received"><When iso={row.item.createdAt} /></td>
      <td className="cell-status" data-label="Status">
        <span className={`state-pill${checking ? "" : " is-attention"}`}>{checking ? "Safety checks running" : "Awaiting approval"}</span>
      </td>
      <td className="cell-actions" data-label="Actions">
        {!checking && (
          <div className="row-actions">
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void inbox.approve(row, "approve")}>Approve</button>
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void inbox.approve(row, "reject")}>Keep off wall</button>
          </div>
        )}
        <RowNotice inbox={inbox} rowKey={row.key} />
      </td>
    </tr>
  );
}

export function HostModerationPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [storedLoad, setLoad] = useState<LoadState>(() => {
    const known = uid ? recallOwnedProperties(uid) : null;
    return known && uid ? { status: "ready", ownerUid: uid, properties: known } : { status: "loading" };
  });
  const load: LoadState = storedLoad.status === "ready" && storedLoad.ownerUid !== uid ? { status: "loading" } : storedLoad;
  const request = useRef(0);
  const [filter, setFilter] = useState<string | null>(readFilter);
  const [refreshSignal, setRefreshSignal] = useState(0);
  // The tab rides in the hash so a link can open any one of them.
  const [tab, setTab] = useState<Tab>(readTab);

  const refresh = useCallback(async (ownerUid: string) => {
    const version = ++request.current;
    const outcome = await listOwnedProperties(ownerUid);
    if (version !== request.current) return;
    if (outcome.status === "ok") rememberOwnedProperties(ownerUid, outcome.value);
    setLoad(current =>
      outcome.status === "ok"
        ? { status: "ready", ownerUid, properties: outcome.value }
        : current.status === "ready" && current.ownerUid === ownerUid
          ? current
          : { status: "error", message: outcome.message }
    );
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !uid) return;
    void refresh(uid);
    return () => { request.current++; };
  }, [uid, refresh]);

  function chooseTab(next: Tab) {
    setTab(next);
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname + window.location.search + (next === "inbox" ? "" : `#${next}`));
  }

  function chooseProperty(next: string) {
    const id = next || null;
    setFilter(id);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `${window.location.pathname}${id ? `?property=${encodeURIComponent(id)}` : ""}${window.location.hash}`);
  }

  const properties = load.status === "ready" ? load.properties.filter((property) => property.lifecycle !== "deleted") : [];
  const chosen = filter ? properties.find((property) => property.id === filter) : undefined;
  const inScope = chosen ? [chosen] : properties;
  const open = inScope.filter(hasGuestInbox);
  const unpublished = inScope.filter((property) => !hasGuestInbox(property));
  const anyPublished = properties.some(hasGuestInbox);
  // The property is a column only while the table mixes properties.
  const mixed = open.length > 1;
  const inbox = useGuestInbox(open, refreshSignal);
  const feed = useInboxFeed(open);
  const memoryText = (propertyId: string, postId: string) =>
    feed.entries.find((entry) => entry.property.id === propertyId && entry.post.id === postId)?.post.message || undefined;
  const only = open.length === 1 ? open[0] : null;
  const approval = only ? inbox.reviewContent(only.id) : undefined;
  const counts: Record<Tab, number | null> = {
    inbox: inbox.ready ? inbox.rows.length : null,
    memories: feed.ready ? feed.entries.length : null,
    feedback: inbox.ready ? inbox.feedback.length : null
  };

  return (
    <div className="page moderation-page inbox-page">
      <p className="eyebrow">Host control centre</p>
      <header className="moderation-intro">
        <div>
          <h1>Inbox &amp; moderation</h1>
          <p>Guest memories, reports and private feedback for all your properties.</p>
        </div>
        <a className="moderation-back" href="/host">
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M16 10H4m0 0 5-5m-5 5 5 5" /></svg>
          Back to dashboard
        </a>
      </header>

      {!firebaseConfigured && (
        <div className="notice">
          <strong>No Firebase environment is configured.</strong>
          <p>The inbox cannot be read without one.</p>
        </div>
      )}

      {firebaseConfigured && load.status === "loading" && <p className="lede" role="status">Loading your properties…</p>}

      {load.status === "error" && (
        <div className="notice" role="alert">
          <strong>We could not load your properties.</strong>
          <p>{load.message}</p>
          <button type="button" className="btn btn-secondary" onClick={() => {
            if (!uid) return;
            setLoad({ status: "loading" });
            void refresh(uid);
          }}>Try again</button>
        </div>
      )}

      {load.status === "ready" && properties.length === 0 && (
        <div className="empty-state">
          <p><b>No properties yet.</b></p>
          <p>Your inbox will fill once a property is published and guests start leaving memories.</p>
          <div className="actions"><a className="btn btn-primary" href="/host#add-property">Add a property</a></div>
        </div>
      )}

      {load.status === "ready" && properties.length > 0 && <>
        {filter && !chosen && (
          <p className="notice" role="status">That property is not on this account, so every property is shown.</p>
        )}

        <div className="inbox-toolbar">
          {properties.length > 1 && (
            <label className="inbox-filter">
              <span>Showing</span>
              <select value={chosen?.id ?? ""} onChange={(event) => chooseProperty(event.target.value)}>
                <option value="">All properties</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}{hasGuestInbox(property) ? "" : " (not published)"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Approval is one property's setting, so it is offered only while
              the page is showing one property. */}
          {only && approval !== undefined && (
            <label className="switch approval-switch inbox-approval">
              <input type="checkbox" checked={approval} onChange={(event) => void inbox.setReviewContent(only, event.target.checked)} />
              <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
              <span className="switch-label">Approve new memories before they go on the wall</span>
            </label>
          )}
        </div>
        {inbox.pageNotice && <p className="review-notice" role="status">{inbox.pageNotice}</p>}

        {!anyPublished && (
          <div className="notice inbox-unpublished" role="status">
            <strong>Nothing to moderate yet</strong>
            <p>Your inbox and moderation queue will be available when a property is published.</p>
          </div>
        )}

        {/* A draft picked on its own is the whole answer; among published
            properties it is one quiet line rather than a card per draft. */}
        {(chosen || !anyPublished) && unpublished.map((property) => (
          <div className="inbox-draft" key={property.id}>
            <div>
              <strong>{property.name}</strong>
              {anyPublished && <p>{UNPUBLISHED}</p>}
            </div>
            <a className="btn btn-secondary btn-sm" href={`/host/property/${property.id}/billing`}>Publish</a>
          </div>
        ))}
        {!chosen && anyPublished && unpublished.length > 0 && (
          <p className="inbox-drafts-note">
            {unpublished.length === 1 ? `${unpublished[0].name} is` : `${unpublished.length} properties are`} not published yet.
            {" "}{UNPUBLISHED.replace("the property is", unpublished.length === 1 ? "it is" : "they are")}
          </p>
        )}

        {open.length > 0 && <>
          <div className="moderation-tabs" role="tablist" aria-label="Inbox, memories or private feedback">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? "active" : undefined}
                onClick={() => chooseTab(key)}
              >
                {label}
                {counts[key] !== null && <span className="queue-count" data-attention={key === "inbox" && counts[key]! > 0}>{counts[key]}</span>}
              </button>
            ))}
          </div>

          {tab !== "memories" && inbox.failures.map((property) => (
            <div className="notice" role="alert" key={property.id}>
              <strong>We could not read {mixed ? `${property.name}’s` : "this property’s"} inbox.</strong>
              <p>Try refreshing.</p>
            </div>
          ))}

          {tab === "inbox" && <section className="moderation-wall" aria-label="Inbox">
            {!inbox.ready && <p className="lede" role="status">Reading your inbox…</p>}
            {/* Never listed, only counted: a guest whose memory was held was
                told it is waiting, and the Host should know it is not lost. */}
            {inbox.ready && inbox.heldBySafety > 0 && <p className="inbox-safety-held">
              {inbox.heldBySafety === 1 ? "1 memory is" : `${inbox.heldBySafety} memories are`} being checked by the DigiStayBook safety team.
              {" "}There is nothing you need to do. If the team clears {inbox.heldBySafety === 1 ? "it, it comes" : "one, it comes"} back here for your approval.
            </p>}
            {inbox.ready && inbox.rows.length === 0 && (
              <div className="moderation-clear" role="status">
                <span className="moderation-clear-mark" aria-hidden="true">
                  <svg viewBox="0 0 20 20" focusable="false"><path d="m5 10.5 3.2 3.2L15 7" /></svg>
                </span>
                <p><strong>All caught up</strong> <span>Nothing is waiting for your approval and no memories have been reported.</span></p>
                <button type="button" className="moderation-refresh" onClick={() => setRefreshSignal((value) => value + 1)}>
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="M16.2 8.5A6.3 6.3 0 0 0 4.6 6.6M3.8 11.5a6.3 6.3 0 0 0 11.6 1.9" />
                    <path d="M4.3 3.4v3.4h3.4M15.7 16.6v-3.4h-3.4" />
                  </svg>
                  Refresh
                </button>
              </div>
            )}
            {inbox.ready && inbox.rows.length > 0 && (
              <table className="inbox-table" aria-label="Waiting for you">
                <thead>
                  <tr>
                    {mixed && <th scope="col">Property</th>}
                    <th scope="col">From</th>
                    <th scope="col">Message</th>
                    <th scope="col">Received</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {inbox.rows.map((row) => (
                    <InboxTableRow key={row.key} row={row} inbox={inbox} showProperty={mixed} memoryText={memoryText} />
                  ))}
                </tbody>
              </table>
            )}
          </section>}

          {tab === "memories" && <section className="moderation-wall" aria-label="Memories">
            {feed.failures.map(({ property, message }) => (
              <div className="notice" role="alert" key={property.id}>
                <strong>We could not read {mixed ? `${property.name}’s` : "this wall’s"} memories.</strong>
                <p>{message}</p>
              </div>
            ))}
            {!feed.ready && <p className="lede" role="status">Reading your memories…</p>}
            {feed.ready && feed.failures.length < open.length && (
              <MemoryTable entries={feed.entries} deleted={feed.deleted} stateFor={feed.stateFor} showProperty={mixed} />
            )}
            {feed.pageError && <p role="alert">{feed.pageError}</p>}
            {feed.hasMore && <button className="btn btn-secondary" disabled={feed.loadingMore} onClick={() => void feed.loadMore()}>Load more memories</button>}
          </section>}

          {tab === "feedback" && <section className="moderation-wall" aria-label="Private feedback">
            <p className="queue-blurb">Messages guests sent to you alone. Replies aren&rsquo;t supported. If a message is threatening or abusive, report it to our safety team.</p>
            {!inbox.ready && <p className="lede" role="status">Reading your feedback…</p>}
            {inbox.ready && inbox.feedback.length === 0 && <div className="queue-empty"><strong>No feedback yet.</strong></div>}
            {inbox.ready && inbox.feedback.length > 0 && (
              <table className="inbox-table" aria-label="Private feedback, newest first">
                <thead>
                  <tr>
                    {mixed && <th scope="col">Property</th>}
                    <th scope="col">Message</th>
                    <th scope="col">Received</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {inbox.feedback.map((row) => (
                    <tr key={row.key} className="inbox-row">
                      {mixed && <td className="cell-property" data-label="Property">{row.property.name}</td>}
                      <td className="cell-message" data-label="Message">{row.item.message}</td>
                      <td className="cell-date" data-label="Received"><When iso={row.item.createdAt} /></td>
                      <td className="cell-actions" data-label="Actions">
                        <button type="button" className="btn btn-sm btn-secondary" disabled={inbox.busy !== null} onClick={() => void inbox.reportFeedback(row)}>Report</button>
                        <RowNotice inbox={inbox} rowKey={row.key} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>}

          {tab !== "memories" && inbox.hasMore && (
            <button className="btn btn-secondary" disabled={inbox.busy !== null} onClick={() => void inbox.loadMore()}>Load more</button>
          )}
        </>}
      </>}

      <details className="fine-print">
        <summary>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="7.5" /><path d="M7.9 7.9a2.2 2.2 0 1 1 3 2c-.6.3-.9.7-.9 1.3v.4" /><circle cx="10" cy="14.2" r=".4" />
          </svg>
          How moderation works
        </summary>
        <p>
          A reported memory is hidden pending review straight away. A reporter is placed on a{" "}
          {reportingLimits.cooldownHours}-hour cooldown after {reportingLimits.reporterDistinctPostsTenMinutes}{" "}
          reports in ten minutes, and the wall stops accepting reports after{" "}
          {reportingLimits.wallDistinctPostsTenMinutes}.
        </p>
        <p>
          A privacy request left unresolved for{" "}
          {privacySlaDays} days escalates to our Privacy &amp; Safety team, who will act on it for you.
        </p>
      </details>
    </div>
  );
}
