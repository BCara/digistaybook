import { getFirebaseServices } from "../../lib/firebase";
import { readPost, type ModeratedPost, type PostAction } from "../../domain/postModeration";
import { describeStoreError, type StoreOutcome } from "./propertyStore";

/**
 * The moderation queue's data access: read the wall, ask the server to change it.
 *
 * The asymmetry is the point. Firestore rules let the owning Host *read* every
 * post on their own property, so the queue is an ordinary query. They refuse
 * every client write to a post, because the reporting state model (BOP 3.6)
 * puts visibility, pinning and deletion behind one transactional server
 * endpoint — that is what stops a crafted request hiding or restoring somebody
 * else's memory. So every action here is a callable, and its answer is the
 * server's, not this file's optimism.
 */

const UNCONFIGURED =
  "Your memories are temporarily unavailable. Please try again later. If this continues, contact support.";

/**
 * Long enough for a cold callable to answer, and short enough that a Host is
 * not left watching a spinner. Reads use the deadline in propertyStore.
 */
const ACTION_TIMEOUT_MS = 20_000;

class RequestTimeout extends Error {}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeout()), ms);
    void work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Every memory on one wall, hidden and deleted ones included. */
export async function listWallPosts(propertyId: string, cursor?: string): Promise<StoreOutcome<ModeratedPost[]> & { nextCursor?: string | null }> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { collection, documentId, getDocs, limit, orderBy, query, startAfter, where } = await import("firebase/firestore");
    const snapshot = await withDeadline(
      getDocs(
        query(
          collection(services.firestore, "properties", propertyId, "posts"),
          where("visibility", "in", ["visible", "hidden_pending_review", "hidden_by_host", "deleted"]),
          orderBy(documentId()),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(51)
        )
      ),
      15_000
    );
    return {
      status: "ok",
      nextCursor: snapshot.size > 50 ? snapshot.docs[49].id : null,
      value: snapshot.docs.slice(0, 50).map((entry) => readPost(entry.id, entry.data()))
    };
  } catch (error) {
    return error instanceof RequestTimeout
      ? {
          status: "error",
          message:
            "We couldn’t load your memories right now. Please try again in a moment."
        }
      : describeStoreError(error);
  }
}

/**
 * The messages a callable can fail with, in the Host's terms. `permission-denied`
 * is deliberately not softened: it means the server refused the action on this
 * post, and a Host is better served by knowing that than by a retry prompt.
 */
const ACTION_MESSAGES: Record<string, string> = {
  "permission-denied": "The server refused that. This property is not yours, or the memory has already moved on.",
  "failed-precondition": "That memory has already changed. Reload the queue to see where it stands now.",
  "not-found": "That memory is no longer here. Reload the queue.",
  unauthenticated: "Your session has expired. Sign in again to carry on moderating.",
  "resource-exhausted": "Too many changes at once. Wait a moment and try again.",
  unavailable: "We could not reach the server. Check your connection and try again.",
  internal: "The server could not complete that change. Nothing was applied."
};

function describeActionError(error: unknown): StoreOutcome<never> {
  if (error instanceof RequestTimeout) {
    return {
      status: "error",
      message:
        "We couldn’t confirm your change was saved. Refresh the page to check the memory before trying again."
    };
  }
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code).replace(/^functions\//, "")
      : "";
  return { status: "error", message: ACTION_MESSAGES[code] ?? "Something went wrong applying that change. Please try again." };
}

export type ModerationRequest = {
  propertyId: string;
  postId: string;
  action: PostAction;
  /**
   * Makes a retry safe. The server records it against the audit event and
   * ignores a repeat, so a Host who taps twice on a slow connection does not
   * open two Trust & Safety cases for one memory.
   */
  requestId: string;
};

/**
 * Ask the server to apply one moderation action.
 *
 * What comes back is the post as the server left it, read through the same
 * validator as a Firestore document: the endpoint is authoritative about what
 * happened, so the queue renders its answer rather than its own guess.
 *
 * `null` means the action succeeded but the answer carried no post — an older
 * deployment, or a response trimmed in transit. It is distinguished from a
 * post because `readPost` fills in a safe default for a field it cannot find,
 * and a defaulted visibility applied to a real memory would move it into the
 * wrong pile in front of the Host. The caller projects the action instead.
 */
export async function moderatePost(request: ModerationRequest): Promise<StoreOutcome<ModeratedPost | null>> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { httpsCallable } = await import("firebase/functions");
    const call = httpsCallable<ModerationRequest, { post?: unknown }>(services.functions, "moderatePost");
    const answer = await withDeadline(call(request), ACTION_TIMEOUT_MS);
    const post = answer.data?.post;
    return { status: "ok", value: post ? readPost(request.postId, post) : null };
  } catch (error) {
    return describeActionError(error);
  }
}

/** A per-attempt id. `randomUUID` is absent on older Safari and http origins. */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
