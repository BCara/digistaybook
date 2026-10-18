import { useCallback, useState, type ReactNode } from "react";
import { GuestReviewPanel } from "../host/GuestReviewPanel";
import { HostReportsPanel } from "../host/HostReportsPanel";
import { reportingLimits } from "../../domain/moderation";
import { privacySlaDays } from "../../domain/postModeration";
import { useAuth } from "../auth/AuthProvider";
import { ModerationQueue } from "../host/ModerationQueue";
import { PropertyShell } from "../host/PropertyShell";
import { useModerationQueue } from "../host/useModerationQueue";
import { propertyBlock } from "../host/usePropertyDraft";
import type { HostProperty } from "../host/propertyStore";
import "./hostModeration.css";

/**
 * Moderation for one property, on its own route.
 *
 * It is off the property dashboard deliberately: setting a wall up and
 * policing what guests leave on it are different jobs, done on different days.
 * This is the second one, in full — every memory the wall holds, hidden and
 * deleted included, each with the actions the platform allows on it.
 *
 * Every action goes to a server endpoint. The reporting state model puts
 * visibility behind one transaction so that no client can hide, restore or
 * delete a guest's memory by writing to the database directly, and this page
 * is a client like any other: it asks, and renders the answer it is given.
 *
 * The property nav rides along at the top: a Host who has finished with the
 * queue is usually going somewhere else in the same property, not back to a
 * list of all of them.
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

export function HostModerationPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const state = useModerationQueue(propertyId, user?.uid);
  const block = propertyBlock(state.load, user?.uid);
  // Both inboxes report how much is in them, so that when neither holds
  // anything the page says so once instead of drawing two empty cards.
  const [waiting, setWaiting] = useState<number | null>(null);
  const [reports, setReports] = useState<number | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const onWaiting = useCallback((count: number) => setWaiting(count), []);
  const onReports = useCallback((count: number) => setReports(count), []);
  // The wall's memories and the private feedback inbox share this screen as
  // two tabs. The choice rides in the hash so a link can open either one.
  const [tab, setTab] = useState<"memories" | "feedback">(() =>
    typeof window !== "undefined" && window.location.hash === "#feedback" ? "feedback" : "memories"
  );
  const chooseTab = (next: "memories" | "feedback") => {
    setTab(next);
    if (typeof window !== "undefined") window.history.replaceState(null, "", next === "feedback" ? "#feedback" : window.location.pathname + window.location.search);
  };

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
  const property = (state.load as { status: "ready"; property: HostProperty }).property;
  const posts = state.posts;
  // The tab counts what a Host can still act on; the deleted pile is counted
  // on its own row at the foot of the list.
  const memoryCount = Array.isArray(posts) ? posts.filter((post) => post.visibility !== "deleted").length : null;

  return (
    <PropertyShell property={property} current="moderation" className="moderation-page">
      <header className="moderation-intro">
        <div>
          <h2>Inbox &amp; moderation</h2>
          <p>Manage guest memories and private feedback.</p>
        </div>
        <a className="moderation-back" href={`/host/property/${property.id}`}>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M16 10H4m0 0 5-5m-5 5 5 5" /></svg>
          Back to property
        </a>
      </header>
      <GuestReviewPanel key={propertyId} propertyId={propertyId} collapseWhenEmpty onCount={onWaiting} refreshSignal={refreshSignal} />
      {waiting === 0 && reports === 0 && (
        <div className="moderation-clear" role="status">
          <span className="moderation-clear-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false"><path d="m5 10.5 3.2 3.2L15 7" /></svg>
          </span>
          <p><strong>All caught up</strong> <span>No memories or reports need your attention.</span></p>
          <button type="button" className="moderation-refresh" onClick={() => setRefreshSignal((value) => value + 1)}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M16.2 8.5A6.3 6.3 0 0 0 4.6 6.6M3.8 11.5a6.3 6.3 0 0 0 11.6 1.9" />
              <path d="M4.3 3.4v3.4h3.4M15.7 16.6v-3.4h-3.4" />
            </svg>
            Refresh
          </button>
        </div>
      )}
      <HostReportsPanel
        key={`reports-${propertyId}`}
        propertyId={propertyId}
        collapseWhenEmpty
        onCount={onReports}
        refreshSignal={refreshSignal}
        memoryText={(postId) => (Array.isArray(posts) ? posts.find((post) => post.id === postId)?.message || undefined : undefined)}
      />
      <div className="moderation-tabs" role="tablist" aria-label="Memories or private feedback">
        {(["memories", "feedback"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            id={`moderation-tab-${option}`}
            aria-selected={tab === option}
            aria-controls={`moderation-panel-${option}`}
            className={tab === option ? "active" : undefined}
            onClick={() => chooseTab(option)}
          >
            {option === "memories" ? "Memories" : "Private feedback"}
            {option === "memories" && memoryCount !== null && <span className="queue-count">{memoryCount}</span>}
          </button>
        ))}
      </div>

      {tab === "feedback" && (
        <div id="moderation-panel-feedback" role="tabpanel" aria-labelledby="moderation-tab-feedback" className="moderation-feedback">
          <GuestReviewPanel key={`feedback-${propertyId}`} propertyId={propertyId} feedbackOnly />
        </div>
      )}

      {tab === "memories" && <section id="moderation-panel-memories" role="tabpanel" className="moderation-wall" aria-labelledby="moderation-tab-memories">
        {posts === null && <p className="lede" role="status">Reading this wall&rsquo;s memories…</p>}

        {posts !== null && !Array.isArray(posts) && (
          <div className="notice" role="alert">
            <strong>We could not read this wall&rsquo;s memories.</strong>
            <p>{posts.error}</p>
          </div>
        )}

        {Array.isArray(posts) && <ModerationQueue posts={posts} state={state} />}
        {state.pageError && <p role="alert">{state.pageError}</p>}
        {state.hasMore && <button className="btn btn-secondary" disabled={state.loadingMore} onClick={() => void state.loadMore()}>Load more wall memories</button>}
      </section>}

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
    </PropertyShell>
  );
}
