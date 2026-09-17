/* ===========================================================================
   Moderation as a Host performs it: one wall's memories, and what may be done
   to each of them.

   `moderation.ts` is the other half of this subject — the server's decision
   when a *guest* reports a post. This module is the decision after that one:
   a post is now sitting in front of the Host who owns the wall, and the
   question is which of the platform's actions are legitimately open on it.

   Nothing here writes. The authoritative reporting state model (BOP 3.6) puts
   every visibility change behind one transactional server endpoint, so this
   module decides only what to *offer*; `ui/host/moderationStore` asks the
   server to do it, and the server re-checks all of it. The duplication across
   that boundary is deliberate: a client guard is an affordance, not a control.
   ========================================================================= */

import type { GuestPost } from "./guestContribution";

export type PostVisibility = GuestPost["visibility"];

/** Why a guest asked for a post to come down. `privacy` starts the 14-day SLA. */
export const reportReasons = {
  privacy: "Privacy — I want my content removed",
  inappropriate: "Inappropriate or explicit content",
  harassment: "Harassment or abuse",
  spam: "Spam or advertising",
  other: "Something else"
} as const;

export type ReportReason = keyof typeof reportReasons;

/**
 * Why a post is off the wall, written by the server when it took it down.
 *
 * `source` matters more than the words: it is what separates a guest exercising
 * a privacy right (a legal deadline for the Host) from an automated screening
 * flag (ordinary curation) from a Host's own earlier decision (nothing owed).
 */
export type HoldSource =
  | "guest_report"
  | "automated_screening"
  | "guest_self_delete"
  | "host_decision"
  | "internal_review";

export type PostHold = {
  source: HoldSource;
  /** Guest reports carry one; an automated flag does not. */
  reason: ReportReason | null;
  /** The screening label, or the reporter's own words. May be empty. */
  detail: string;
  raisedAt: string | null;
};

/** An uploaded memory photograph, in the shape the Host queue renders it. */
export type PostPhoto = { url: string; alt: string; width: number; height: number };

/** One memory as the Host who owns the wall sees it, hidden ones included. */
export type ModeratedPost = {
  requiresScreenedReview?: boolean;
  id: string;
  message: string;
  displayName: string;
  createdAt: string | null;
  /** When they stayed, in the guest's own words. Blank on older posts. */
  stayedOn: string;
  visibility: PostVisibility;
  pinned: boolean;
  photo: PostPhoto | null;
  hold: PostHold | null;
};

/* ------------------------------- Reading -------------------------------- */

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

const size = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

/** Firestore returns Timestamps; the queue only ever formats them. */
function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

const VISIBILITIES: readonly PostVisibility[] = [
  "visible",
  "hidden_pending_review",
  "hidden_by_host",
  "restricted",
  "deleted"
];

const SOURCES: readonly HoldSource[] = [
  "guest_report",
  "automated_screening",
  "guest_self_delete",
  "host_decision",
  "internal_review"
];

function readPhoto(value: unknown): PostPhoto | null {
  if (typeof value !== "object" || value === null) return null;
  const photo = value as Record<string, unknown>;
  if (typeof photo.url !== "string" || !photo.url) return null;
  return { url: photo.url, alt: text(photo.alt, 200), width: size(photo.width), height: size(photo.height) };
}

function readHold(value: unknown): PostHold | null {
  if (typeof value !== "object" || value === null) return null;
  const hold = value as Record<string, unknown>;
  const source = SOURCES.find((candidate) => candidate === hold.source);
  if (!source) return null;
  const reason = (Object.keys(reportReasons) as ReportReason[]).find((candidate) => candidate === hold.reason);
  return {
    source,
    reason: reason ?? null,
    detail: text(hold.detail, 500),
    raisedAt: isoOrNull(hold.raisedAt)
  };
}

/**
 * A post is validated on read rather than trusted. An unrecognised visibility
 * is the one field that cannot fall back to something permissive: a document
 * this build does not understand must not appear in the "on the wall" column
 * and be actioned as though the Host had seen what a guest sees, so it reads
 * as held for review instead.
 */
export function readPost(id: string, value: unknown): ModeratedPost {
  const data = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const visibility = VISIBILITIES.find((candidate) => candidate === data.visibility);
  return {
    id,
    ...(data.guestSubmissionId ? { requiresScreenedReview: data.guestMediaPublished !== true } : {}),
    message: text(data.message, 1200),
    displayName: text(data.displayName, 80),
    createdAt: isoOrNull(data.createdAt),
    stayedOn: text(data.stayedOn, 60),
    visibility: visibility ?? "hidden_pending_review",
    pinned: data.pinned === true,
    photo: readPhoto(data.photo),
    hold: readHold(data.hold)
  };
}

/* ------------------------------- Actions -------------------------------- */

/**
 * Everything a Host may ask the platform to do to one memory. These are the
 * dashboard's content controls (BOP 5.6) and the two review outcomes the
 * reporting state model names, `rejected_restored` and `confirmed_delete`.
 */
export type PostAction = "publish" | "hide" | "delete" | "pin" | "unpin" | "escalate";

export type ActionCopy = {
  /** On the button. */
  label: string;
  /** What it does, under the button or in the confirmation. */
  hint: string;
  /** Set when the action cannot be undone, and must be confirmed first. */
  confirm: string | null;
  /** Said back to the Host once the server has applied it. */
  done: string;
  /** Destructive actions are styled apart from the rest. */
  destructive: boolean;
};

export const actionCopy: Record<PostAction, ActionCopy> = {
  publish: {
    label: "Publish to the wall",
    hint: "Puts this memory in front of guests. Use it when a report or a screening flag was wrong.",
    confirm: null,
    done: "Published to the wall.",
    destructive: false
  },
  hide: {
    label: "Take off the wall",
    hint: "Removes it from public view and keeps it here. Nothing is deleted, and you can publish it again.",
    confirm: null,
    done: "Taken off the wall.",
    destructive: false
  },
  delete: {
    label: "Confirm permanent deletion",
    hint: "Hides the memory immediately and schedules deletion of its stored copies.",
    confirm:
      "Delete this memory permanently? It will be hidden now and its stored copies scheduled for deletion.",
    done: "Hidden from public view. Permanent deletion is scheduled.",
    destructive: true
  },
  pin: {
    label: "Pin to the top",
    hint: "Holds it above the other memories, where arriving guests read first.",
    confirm: null,
    done: "Pinned to the top of the wall.",
    destructive: false
  },
  unpin: {
    label: "Unpin",
    hint: "Returns it to the wall in date order.",
    confirm: null,
    done: "Unpinned.",
    destructive: false
  },
  escalate: {
    label: "Report to DigiStayBook",
    hint: "For severe abuse aimed at you or your property. It goes to our Trust & Safety team, not back to the guest.",
    confirm:
      "Send this to DigiStayBook Trust & Safety? It is for severe abuse, not for memories you simply do not want on your wall — take those off the wall instead.",
    done: "Sent to Trust & Safety. We will follow it up with you.",
    destructive: false
  }
};

/**
 * What this Host may do to this post, right now.
 *
 * Two states are deliberately empty. `restricted` is a Tier-2 case the platform
 * took off the wall and out of the Host's hands (BOP 1.4), and a Host who could
 * publish it would be overriding an internal safety decision. `deleted` has
 * nothing left to act on.
 */
export function availableActions(post: ModeratedPost): PostAction[] {
  switch (post.visibility) {
    case "visible":
      return [post.pinned ? "unpin" : "pin", "hide", "delete", "escalate"];
    case "hidden_pending_review":
    case "hidden_by_host":
      return post.requiresScreenedReview ? ["delete", "escalate"] : ["publish", "delete", "escalate"];
    default:
      return [];
  }
}

/** The action a card leads with, drawn ahead of the rest. */
export function primaryAction(post: ModeratedPost): PostAction | null {
  // A privacy request is the exception: the Host's obligation is to delete it,
  // so that is offered first rather than buried at the end of the row.
  if (post.hold?.reason === "privacy" && post.visibility !== "visible") return "delete";
  return availableActions(post)[0] ?? null;
}

/**
 * Why a post cannot be actioned, for the two states that offer nothing. Said
 * plainly, because silence in front of a hidden memory reads as a broken page.
 */
export function actionsUnavailable(post: ModeratedPost): string | null {
  if (post.visibility === "restricted") {
    return "DigiStayBook has taken this one out of your hands. Our Trust & Safety team is reviewing it and will write to you.";
  }
  if (post.visibility === "deleted") {
    return "Deleted. It is off the wall and scheduled for removal from our systems.";
  }
  return null;
}

/**
 * The post as it will be once the server confirms the action, so the queue can
 * re-sort itself without re-reading the wall. The server remains the authority
 * on what actually happened; this only spares a round trip before the next one.
 */
export function applyAction(post: ModeratedPost, action: PostAction): ModeratedPost {
  switch (action) {
    case "publish":
      return { ...post, visibility: "visible", hold: null };
    case "hide":
      return {
        ...post,
        visibility: "hidden_by_host",
        pinned: false,
        hold: { source: "host_decision", reason: null, detail: "", raisedAt: new Date().toISOString() }
      };
    case "delete":
      return { ...post, visibility: "deleted", pinned: false };
    case "pin":
      return { ...post, pinned: true };
    case "unpin":
      return { ...post, pinned: false };
    case "escalate":
      // An escalation opens an internal case. It does not move the post, and
      // saying otherwise would tell a Host their wall had changed when it had not.
      return post;
  }
}

/* -------------------------------- Queue --------------------------------- */

/**
 * The 14-day clock. A privacy request a Host does not resolve escalates to
 * Privacy & Safety Operations, so the days left is the most useful thing on
 * the card and is shown whether or not it is comfortable.
 */
export const privacySlaDays = 14;

export type HoldSla = { daysLeft: number; overdue: boolean };

const DAY_MS = 86_400_000;

/** Null unless a deadline actually applies: only guest reports carry the SLA. */
export function holdSla(post: ModeratedPost, now: Date = new Date()): HoldSla | null {
  const hold = post.hold;
  if (!hold || hold.source !== "guest_report" || !hold.raisedAt) return null;
  const raised = new Date(hold.raisedAt);
  if (Number.isNaN(raised.getTime())) return null;
  const elapsed = (now.getTime() - raised.getTime()) / DAY_MS;
  const daysLeft = Math.ceil(privacySlaDays - elapsed);
  return { daysLeft, overdue: daysLeft <= 0 };
}

export type QueueSectionId = "privacy" | "review" | "wall" | "restricted" | "removed";

export type QueueSection = {
  id: QueueSectionId;
  title: string;
  /** What this pile is, in one line, above the memories in it. */
  blurb: string;
  posts: ModeratedPost[];
};

const SECTION_COPY: Record<QueueSectionId, { title: string; blurb: string }> = {
  privacy: {
    title: "Privacy and takedown requests",
    blurb: `A guest has asked for their own content to come down. You are the data controller for your guestbook: resolve each one within ${privacySlaDays} days, or it escalates to our Privacy & Safety team.`
  },
  review: {
    title: "Waiting for you",
    blurb:
      "Reported by a guest, or held back by automated screening. Nobody but you can see these until you publish them."
  },
  wall: {
    title: "On the wall",
    blurb: "Live for anyone with your wall link. Pin the ones you want arriving guests to read first."
  },
  restricted: {
    title: "Held by DigiStayBook",
    blurb: "Taken off the wall by our Trust & Safety team. Shown here so you know it happened."
  },
  removed: {
    title: "Recently deleted",
    blurb: "Off the wall and scheduled for deletion from our systems. Kept here briefly as a record."
  }
};

/** Newest first, but a pinned memory leads its section, as it does on the wall. */
function inWallOrder(a: ModeratedPost, b: ModeratedPost): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

/** Oldest hold first, so the request closest to its deadline is never buried. */
function byUrgency(a: ModeratedPost, b: ModeratedPost): number {
  return (a.hold?.raisedAt ?? "").localeCompare(b.hold?.raisedAt ?? "");
}

/**
 * One wall, split into the piles a Host actually works through: what carries a
 * deadline, what is waiting on a decision, what is live, and what has been
 * taken out of their hands. Empty piles are dropped.
 */
export function queueSections(posts: ModeratedPost[]): QueueSection[] {
  const buckets: Record<QueueSectionId, ModeratedPost[]> = {
    privacy: [],
    review: [],
    wall: [],
    restricted: [],
    removed: []
  };

  for (const post of posts) {
    if (post.visibility === "deleted") buckets.removed.push(post);
    else if (post.visibility === "restricted") buckets.restricted.push(post);
    else if (post.visibility === "visible") buckets.wall.push(post);
    else if (post.hold?.reason === "privacy") buckets.privacy.push(post);
    else buckets.review.push(post);
  }

  buckets.privacy.sort(byUrgency);
  buckets.review.sort(byUrgency);
  buckets.wall.sort(inWallOrder);
  buckets.restricted.sort(byUrgency);
  buckets.removed.sort(inWallOrder);

  return (Object.keys(buckets) as QueueSectionId[])
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({ id, ...SECTION_COPY[id], posts: buckets[id] }));
}

/** The line under a held memory saying who put it there, and why. */
export function holdSummary(post: ModeratedPost): string | null {
  const hold = post.hold;
  if (!hold) return null;
  const detail = hold.detail.trim();
  switch (hold.source) {
    case "guest_report":
      return `Reported by a guest: ${hold.reason ? reportReasons[hold.reason].toLowerCase() : "no reason given"}.${
        detail ? ` They wrote: “${detail}”` : ""
      }`;
    case "automated_screening":
      return `Held back by automated screening${
        detail ? `: ${detail}` : ""
      }. Screening is cautious by design, so this is often a false alarm.`;
    case "guest_self_delete":
      return "The guest who posted this deleted it themselves. It is scheduled for deletion.";
    case "host_decision":
      return "You took this off the wall.";
    case "internal_review":
      return "Under review by DigiStayBook Trust & Safety.";
  }
}

/** What a Host is looking at, in one line, before they read a single card. */
export function queueSummary(posts: ModeratedPost[]): string {
  const wall = posts.filter((post) => post.visibility === "visible").length;
  const waiting = posts.filter(
    (post) => post.visibility === "hidden_pending_review" || post.visibility === "hidden_by_host"
  ).length;
  const memories = `${wall} ${wall === 1 ? "memory" : "memories"} on the wall`;
  if (waiting === 0) return `${memories}. Nothing is waiting on you.`;
  return `${memories}, ${waiting} waiting on you.`;
}
