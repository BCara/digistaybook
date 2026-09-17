import { useCallback, useEffect, useState } from "react";
import {
  actionCopy,
  applyAction,
  availableActions,
  type ModeratedPost,
  type PostAction
} from "../../domain/postModeration";
import { listWallPosts, moderatePost, newRequestId } from "./moderationStore";
import { useProperty, type PropertyLoad } from "./useProperty";

/**
 * One wall's memories, and one action at a time against them.
 *
 * Moderation is not a form: there is no draft, nothing to save, and every
 * action is a separate request the server may refuse on its own terms. So this
 * hook holds a list rather than a draft, and its whole job is making sure a
 * Host always knows which memory an answer belongs to — the failure and the
 * confirmation are both keyed by post, because a message floating at the top
 * of a page of twenty memories tells them nothing.
 */

export type QueueState = {
  load: PropertyLoad;
  /** Null until the wall has been read; `error` when it could not be. */
  posts: ModeratedPost[] | { error: string } | null;
  /** The post and action currently in flight, so only its buttons go quiet. */
  working: { postId: string; action: PostAction } | null;
  /** A destructive action waiting on the Host to confirm it. */
  confirming: { postId: string; action: PostAction } | null;
  /** The last answer, good or bad, against the memory it concerns. */
  result: { postId: string; message: string; failed: boolean } | null;
  ask: (post: ModeratedPost, action: PostAction) => void;
  cancel: () => void;
  act: (post: ModeratedPost, action: PostAction) => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  pageError: string | null;
  loadMore: () => Promise<void>;
};

export function useModerationQueue(propertyId: string, hostUid: string | undefined): QueueState {
  // The read itself is shared with every other host screen for a property.
  const [load] = useProperty(propertyId);
  const [posts, setPosts] = useState<ModeratedPost[] | { error: string } | null>(null);
  const [working, setWorking] = useState<{ postId: string; action: PostAction } | null>(null);
  const [confirming, setConfirming] = useState<{ postId: string; action: PostAction } | null>(null);
  const [result, setResult] = useState<{ postId: string; message: string; failed: boolean } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // The wall is read only once the property has been confirmed as this Host's,
  // so a property belonging to someone else never triggers a second query that
  // Firestore would refuse anyway. This repeats the ownership test in
  // `propertyBlock` deliberately: that one decides what to render, this one
  // decides what to ask for, and they must not be able to disagree.
  const owned = load.status === "ready" && (!hostUid || !load.property.ownerUid || load.property.ownerUid === hostUid);

  useEffect(() => {
    if (load.status !== "ready" || !owned) return;
    let cancelled = false;
    setPosts(null); setCursor(null); setPageError(null);
    void (async () => {
      const outcome = await listWallPosts(load.property.id);
      if (cancelled) return;
      setPosts(outcome.status === "ok" ? outcome.value : { error: outcome.message });
      setCursor(outcome.status === "ok" ? outcome.nextCursor ?? null : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [load.status, owned, load.status === "ready" ? load.property.id : null]);

  const ask = useCallback((post: ModeratedPost, action: PostAction) => {
    setResult(null);
    setConfirming({ postId: post.id, action });
  }, []);

  const cancel = useCallback(() => setConfirming(null), []);

  const act = useCallback(
    async (post: ModeratedPost, action: PostAction) => {
      if (working || load.status !== "ready") return;
      // Checked again here rather than trusting the button that was clicked:
      // the queue may have been re-sorted under a slow tap. The server checks
      // it a third time, and its answer is the one that counts.
      if (!availableActions(post).includes(action)) return;

      setConfirming(null);
      setResult(null);
      setWorking({ postId: post.id, action });

      const outcome = await moderatePost({
        propertyId: load.property.id,
        postId: post.id,
        action,
        requestId: newRequestId()
      });

      setWorking(null);
      if (outcome.status === "error") {
        setResult({ postId: post.id, message: outcome.message, failed: true });
        return;
      }

      // What the server returned replaces the post, so a change it made that
      // this build did not predict still shows up in the right pile. Projecting
      // the action locally is the fallback for an answer that carried no post,
      // not the source of truth.
      const settled = outcome.value ?? applyAction(post, action);
      setPosts((current) =>
        Array.isArray(current) ? current.map((entry) => (entry.id === post.id ? settled : entry)) : current
      );
      setResult({ postId: post.id, message: actionCopy[action].done, failed: false });
    },
    [load, working]
  );

  async function loadMore() {
    if (!cursor || loadingMore || !owned || load.status !== "ready") return;
    setLoadingMore(true); setPageError(null);
    try {
      const outcome = await listWallPosts(load.property.id, cursor);
      if (outcome.status === "error") { setPageError(outcome.message); return; }
      setPosts(previous => Array.isArray(previous) ? [...new Map([...previous, ...outcome.value].map(post => [post.id, post])).values()] : outcome.value);
      setCursor(outcome.nextCursor ?? null);
    } finally { setLoadingMore(false); }
  }
  return { load, posts, working, confirming, result, ask, cancel, act, hasMore: Boolean(cursor), loadingMore, pageError, loadMore };
}
