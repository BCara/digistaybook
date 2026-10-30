import { useCallback, useEffect, useState } from "react";
import { actionCopy, applyAction, availableActions, type ModeratedPost, type PostAction } from "../../domain/postModeration";
import { listWallPosts, moderatePost, newRequestId } from "./moderationStore";
import type { HostProperty } from "./propertyStore";
import type { QueueState } from "./useModerationQueue";

/**
 * Every wall a Host is looking at, read into one feed.
 *
 * The inbox draws memories newest first whichever property they were left on,
 * so a Host with several properties reads one list rather than scrolling past
 * one wall to find the next. Each memory still acts against its own property:
 * `stateFor` hands each card the same QueueState a single wall's queue gives
 * it, scoped to that property.
 */

type Pile = { posts: ModeratedPost[] | { error: string } | null; cursor: string | null };
type Keyed = { propertyId: string; postId: string; action: PostAction };

export type FeedEntry = { post: ModeratedPost; property: HostProperty };

export type InboxFeed = {
  /** False until every wall in view has answered, well or badly. */
  ready: boolean;
  /** Memories still on or off the wall, newest first. */
  entries: FeedEntry[];
  /** Deleted memories, newest first, kept apart because nothing more can be done with them. */
  deleted: FeedEntry[];
  /** Walls that could not be read, with why. */
  failures: { property: HostProperty; message: string }[];
  stateFor: (property: HostProperty) => QueueState;
  hasMore: boolean;
  loadingMore: boolean;
  pageError: string | null;
  loadMore: () => Promise<void>;
};

const newestFirst = (a: FeedEntry, b: FeedEntry) => (b.post.createdAt ?? "").localeCompare(a.post.createdAt ?? "");

export function useInboxFeed(properties: HostProperty[]): InboxFeed {
  const [piles, setPiles] = useState<Record<string, Pile>>({});
  const [working, setWorking] = useState<Keyed | null>(null);
  const [confirming, setConfirming] = useState<Keyed | null>(null);
  const [result, setResult] = useState<{ propertyId: string; postId: string; message: string; failed: boolean } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const ids = properties.map((property) => property.id).join(",");

  useEffect(() => {
    let cancelled = false;
    setPiles({});
    setPageError(null);
    for (const id of ids ? ids.split(",") : []) {
      void listWallPosts(id).then((outcome) => {
        if (cancelled) return;
        setPiles((current) => ({
          ...current,
          [id]: outcome.status === "ok"
            ? { posts: outcome.value, cursor: outcome.nextCursor ?? null }
            : { posts: { error: outcome.message }, cursor: null }
        }));
      });
    }
    return () => { cancelled = true; };
  }, [ids]);

  const settle = useCallback((propertyId: string, settled: ModeratedPost) => {
    setPiles((current) => {
      const pile = current[propertyId];
      if (!pile || !Array.isArray(pile.posts)) return current;
      return { ...current, [propertyId]: { ...pile, posts: pile.posts.map((entry) => (entry.id === settled.id ? settled : entry)) } };
    });
  }, []);

  const act = useCallback(async (property: HostProperty, post: ModeratedPost, action: PostAction) => {
    if (working) return;
    // Checked again here rather than trusting the button that was clicked;
    // the server checks it a third time, and its answer is the one that counts.
    if (!availableActions(post).includes(action)) return;
    setConfirming(null);
    setResult(null);
    setWorking({ propertyId: property.id, postId: post.id, action });
    const outcome = await moderatePost({ propertyId: property.id, postId: post.id, action, requestId: newRequestId() });
    setWorking(null);
    if (outcome.status === "error") {
      setResult({ propertyId: property.id, postId: post.id, message: outcome.message, failed: true });
      return;
    }
    settle(property.id, outcome.value ?? applyAction(post, action));
    setResult({ propertyId: property.id, postId: post.id, message: actionCopy[action].done, failed: false });
  }, [working, settle]);

  async function loadMore() {
    if (loadingMore) return;
    const waiting = Object.entries(piles).filter(([, pile]) => pile.cursor);
    if (waiting.length === 0) return;
    setLoadingMore(true);
    setPageError(null);
    try {
      for (const [id, pile] of waiting) {
        const outcome = await listWallPosts(id, pile.cursor!);
        if (outcome.status === "error") { setPageError(outcome.message); continue; }
        setPiles((current) => {
          const previous = current[id]?.posts;
          const posts = Array.isArray(previous)
            ? [...new Map([...previous, ...outcome.value].map((post) => [post.id, post])).values()]
            : outcome.value;
          return { ...current, [id]: { posts, cursor: outcome.nextCursor ?? null } };
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const stateFor = (property: HostProperty): QueueState => {
    const mine = <T extends { propertyId: string }>(value: T | null) => (value?.propertyId === property.id ? value : null);
    return {
      load: { status: "ready", property },
      posts: piles[property.id]?.posts ?? null,
      working: mine(working),
      confirming: mine(confirming),
      result: mine(result),
      ask: (post, action) => { setResult(null); setConfirming({ propertyId: property.id, postId: post.id, action }); },
      cancel: () => setConfirming(null),
      act: (post, action) => act(property, post, action),
      hasMore: Boolean(piles[property.id]?.cursor),
      loadingMore,
      pageError,
      loadMore
    };
  };

  const entries: FeedEntry[] = [];
  const deleted: FeedEntry[] = [];
  const failures: InboxFeed["failures"] = [];
  for (const property of properties) {
    const posts = piles[property.id]?.posts;
    if (posts && !Array.isArray(posts)) failures.push({ property, message: posts.error });
    if (!Array.isArray(posts)) continue;
    for (const post of posts) (post.visibility === "deleted" ? deleted : entries).push({ post, property });
  }
  entries.sort(newestFirst);
  deleted.sort(newestFirst);

  return {
    ready: properties.every((property) => piles[property.id]?.posts),
    entries,
    deleted,
    failures,
    stateFor,
    hasMore: Object.values(piles).some((pile) => pile.cursor),
    loadingMore,
    pageError,
    loadMore
  };
}
