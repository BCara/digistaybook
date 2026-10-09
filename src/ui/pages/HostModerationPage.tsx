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

  return (
    <PropertyShell property={property} current="moderation" className="moderation-page">
      <header className="moderation-intro">
        <h2>Moderation</h2>
        <p>Decide what appears on your wall, and pin the memories you want guests to see first.</p>
      </header>
      <GuestReviewPanel key={propertyId} propertyId={propertyId} collapseWhenEmpty onCount={onWaiting} refreshSignal={refreshSignal} />
      {waiting === 0 && reports === 0 && (
        <div className="moderation-clear" role="status">
          <span className="moderation-clear-mark" aria-hidden="true">✓</span>
          <p><strong>You&rsquo;re all caught up.</strong> New memories and guest reports will appear here when they need you.</p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRefreshSignal((value) => value + 1)}>Check again</button>
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
      <section className="moderation-wall" aria-labelledby="wall-memories-heading">
        <h2 id="wall-memories-heading" className="moderation-wall-heading">Your memories</h2>

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
      </section>

      <details className="fine-print">
        <summary>How moderation works</summary>
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

      <div className="actions">
        <a className="btn btn-secondary" href={`/host/property/${property.id}`}>Back to the property</a>
      </div>
    </PropertyShell>
  );
}
