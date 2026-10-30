import { useCallback, useEffect, useState } from "react";
import type { ReportReason } from "../../domain/postModeration";
import { hostCall } from "./GuestReviewPanel";
import type { HostProperty } from "./propertyStore";

/**
 * What guests have sent that waits on the Host, for every property at once.
 *
 * The inbox is one table rather than a panel per property: a memory waiting
 * for approval, a report against a memory and a private message are each a
 * row, and the property is a column. This hook reads every property's piles
 * and flattens them; each action still goes to the endpoint for the property
 * the row came from, and the server checks ownership on every call.
 */

export type ReviewItem = {
  id: string;
  status: "pending" | "standard" | string;
  message: string;
  displayName?: string;
  revision: number;
  photoCount: number;
  createdAt?: string | null;
};
export type ReportItem = { id: string; postId: string; reason: ReportReason; reviewDueAt: string };
export type FeedbackItem = { id: string; message: string; createdAt?: string | null };

type ReviewPage = {
  posts: ReviewItem[];
  feedback: FeedbackItem[];
  reviewContent?: boolean;
  reviewCursor?: string | null;
  feedbackCursor?: string | null;
};
type ReportPage = { reports: ReportItem[]; nextCursor: string | null; heldBySafety?: number };

type Pile = {
  review: ReviewItem[];
  reviewCursor: string | null;
  feedback: FeedbackItem[];
  feedbackCursor: string | null;
  reports: ReportItem[];
  reportsCursor: string | null;
  reviewContent: boolean;
  /** Memories the safety team is holding: counted by the server, never listed. */
  heldBySafety: number;
};

export type InboxRow =
  | { kind: "approval"; key: string; property: HostProperty; item: ReviewItem }
  | { kind: "report"; key: string; property: HostProperty; item: ReportItem };
export type FeedbackRow = { key: string; property: HostProperty; item: FeedbackItem };

export type GuestInbox = {
  /** False until every property has answered, well or badly. */
  ready: boolean;
  /** Reports first, soonest deadline first; then memories waiting, newest first. */
  rows: InboxRow[];
  feedback: FeedbackRow[];
  /**
   * Memories on these properties that the safety team is holding. A number
   * only: the Host never reads them, but should know they are not lost.
   */
  heldBySafety: number;
  /** Properties whose inbox could not be read. */
  failures: HostProperty[];
  reviewContent: (propertyId: string) => boolean | undefined;
  setReviewContent: (property: HostProperty, reviewContent: boolean) => Promise<void>;
  approve: (row: InboxRow & { kind: "approval" }, action: "approve" | "reject") => Promise<void>;
  resolve: (row: InboxRow & { kind: "report" }, action: "dismiss" | "delete") => Promise<void>;
  reportFeedback: (row: FeedbackRow) => Promise<void>;
  loadPhotos: (row: InboxRow & { kind: "approval" }) => Promise<void>;
  photos: Record<string, string[]>;
  /** The last answer, against the row it concerns. */
  notice: { key: string; message: string; failed: boolean } | null;
  /** A notice for the page as a whole, such as a setting saved. */
  pageNotice: string;
  busy: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

const newest = (a?: string | null, b?: string | null) => (b ?? "").localeCompare(a ?? "");

async function readPile(propertyId: string): Promise<Pile> {
  const [review, reports] = await Promise.all([
    hostCall<ReviewPage>("listHostGuestReview", { propertyId, kind: "both" }),
    hostCall<ReportPage>("listHostReports", { propertyId })
  ]);
  return {
    review: review.posts,
    reviewCursor: review.reviewCursor ?? null,
    feedback: review.feedback,
    feedbackCursor: review.feedbackCursor ?? null,
    reports: reports.reports,
    reportsCursor: reports.nextCursor,
    reviewContent: review.reviewContent === true,
    heldBySafety: reports.heldBySafety ?? 0
  };
}

export function useGuestInbox(properties: HostProperty[], refreshSignal = 0): GuestInbox {
  const [piles, setPiles] = useState<Record<string, Pile | "failed">>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<GuestInbox["notice"]>(null);
  const [pageNotice, setPageNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const ids = properties.map((property) => property.id).join(",");

  useEffect(() => {
    let cancelled = false;
    setPiles({});
    setPhotos({});
    setNotice(null);
    for (const id of ids ? ids.split(",") : []) {
      void readPile(id).then(
        (pile) => { if (!cancelled) setPiles((current) => ({ ...current, [id]: pile })); },
        () => { if (!cancelled) setPiles((current) => ({ ...current, [id]: "failed" })); }
      );
    }
    return () => { cancelled = true; };
  }, [ids, refreshSignal]);

  /** One property read again after an action changed it. */
  const reread = useCallback(async (propertyId: string) => {
    const pile = await readPile(propertyId);
    setPiles((current) => ({ ...current, [propertyId]: pile }));
  }, []);

  async function run(key: string, work: () => Promise<void>, done: string, failed: string) {
    if (busy) return;
    setBusy(key);
    setNotice(null);
    try {
      await work();
      setNotice({ key, message: done, failed: false });
    } catch {
      setNotice({ key, message: failed, failed: true });
    } finally {
      setBusy(null);
    }
  }

  const approve: GuestInbox["approve"] = (row, action) =>
    run(row.key, async () => {
      await hostCall("reviewGuestContribution", { id: row.item.id, revision: row.item.revision, action });
      await reread(row.property.id);
    }, action === "approve" ? "The memory is now on the wall." : "The memory stays off the wall.",
    "The memory could not be changed. Refresh and try again.");

  const resolve: GuestInbox["resolve"] = async (row, action) => {
    if (action === "delete" && !window.confirm("Hide this memory and schedule its files for deletion?")) return;
    await run(row.key, async () => {
      await hostCall("resolveContentReport", { reportId: row.item.id, action });
      await reread(row.property.id);
    }, action === "delete"
      ? "The memory is hidden and deletion is scheduled."
      : "Report resolved. The memory can return only when no other report or safety hold prevents it.",
    "This report could not be resolved. Refresh; an internal safety review may be required.");
  };

  const reportFeedback: GuestInbox["reportFeedback"] = async (row) => {
    if (!window.confirm("Send this message to the DigiStayBook safety team? It will leave your inbox and only come back if they find it acceptable.")) return;
    await run(row.key, async () => {
      await hostCall("reportPrivateFeedback", { propertyId: row.property.id, id: row.item.id });
      setPiles((current) => {
        const pile = current[row.property.id];
        if (!pile || pile === "failed") return current;
        return { ...current, [row.property.id]: { ...pile, feedback: pile.feedback.filter((item) => item.id !== row.item.id) } };
      });
    }, "Reported. The safety team will review this message.", "The message could not be reported. Refresh and try again.");
  };

  const loadPhotos: GuestInbox["loadPhotos"] = (row) =>
    run(row.key, async () => {
      const loaded: string[] = [];
      for (let index = 0; index < row.item.photoCount; index++) {
        const result = await hostCall<{ base64: string }>("readGuestReviewPhoto", { id: row.item.id, index });
        loaded.push(`data:image/webp;base64,${result.base64}`);
      }
      setPhotos((current) => ({ ...current, [row.item.id]: loaded }));
    }, "", "These photos are no longer available for review. Refresh.");

  async function setReviewContent(property: HostProperty, reviewContent: boolean) {
    setPageNotice("");
    try {
      const saved = await hostCall<{ reviewContent: boolean }>("setGuestReviewPolicy", { propertyId: property.id, reviewContent });
      setPiles((current) => {
        const pile = current[property.id];
        return !pile || pile === "failed" ? current : { ...current, [property.id]: { ...pile, reviewContent: saved.reviewContent } };
      });
      setPageNotice(saved.reviewContent
        ? "New memories will wait for your approval after screening."
        : "Clear new memories can publish automatically after screening. Memories already waiting still need review.");
    } catch {
      setPageNotice("The approval setting could not be saved. Try again.");
    }
  }

  async function loadMore() {
    if (busy) return;
    setBusy("more");
    try {
      for (const property of properties) {
        const pile = piles[property.id];
        if (!pile || pile === "failed") continue;
        const next = { ...pile };
        if (pile.reviewCursor || pile.feedbackCursor) {
          const page = await hostCall<ReviewPage>("listHostGuestReview", {
            propertyId: property.id, kind: "both",
            ...(pile.reviewCursor ? { reviewCursor: pile.reviewCursor } : {}),
            ...(pile.feedbackCursor ? { feedbackCursor: pile.feedbackCursor } : {})
          });
          if (pile.reviewCursor) {
            next.review = [...new Map([...pile.review, ...page.posts].map((item) => [item.id, item])).values()];
            next.reviewCursor = page.reviewCursor ?? null;
          }
          if (pile.feedbackCursor) {
            next.feedback = [...new Map([...pile.feedback, ...page.feedback].map((item) => [item.id, item])).values()];
            next.feedbackCursor = page.feedbackCursor ?? null;
          }
        }
        if (pile.reportsCursor) {
          const page = await hostCall<ReportPage>("listHostReports", { propertyId: property.id, cursor: pile.reportsCursor });
          next.reports = [...new Map([...pile.reports, ...page.reports].map((item) => [item.id, item])).values()];
          next.reportsCursor = page.nextCursor;
        }
        setPiles((current) => ({ ...current, [property.id]: next }));
      }
    } catch {
      setPageNotice("More items could not be loaded. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const reports: InboxRow[] = [];
  const approvals: InboxRow[] = [];
  const feedback: FeedbackRow[] = [];
  const failures: HostProperty[] = [];
  let heldBySafety = 0;
  for (const property of properties) {
    const pile = piles[property.id];
    if (pile === "failed") failures.push(property);
    if (!pile || pile === "failed") continue;
    heldBySafety += pile.heldBySafety;
    for (const item of pile.reports) reports.push({ kind: "report", key: `report/${property.id}/${item.id}`, property, item });
    for (const item of pile.review) approvals.push({ kind: "approval", key: `approval/${property.id}/${item.id}`, property, item });
    for (const item of pile.feedback) feedback.push({ key: `feedback/${property.id}/${item.id}`, property, item });
  }
  // A report already has a memory off the wall and a deadline on it, so the
  // soonest deadline leads; memories waiting for approval follow, newest first.
  reports.sort((a, b) => (a.item as ReportItem).reviewDueAt.localeCompare((b.item as ReportItem).reviewDueAt));
  approvals.sort((a, b) => newest((a.item as ReviewItem).createdAt, (b.item as ReviewItem).createdAt));
  feedback.sort((a, b) => newest(a.item.createdAt, b.item.createdAt));

  const loaded = Object.values(piles).filter((pile): pile is Pile => pile !== "failed");
  return {
    ready: properties.every((property) => piles[property.id]),
    rows: [...reports, ...approvals],
    feedback,
    heldBySafety,
    failures,
    reviewContent: (propertyId) => {
      const pile = piles[propertyId];
      return pile && pile !== "failed" ? pile.reviewContent : undefined;
    },
    setReviewContent,
    approve,
    resolve,
    reportFeedback,
    loadPhotos,
    photos,
    notice,
    pageNotice,
    busy,
    hasMore: loaded.some((pile) => pile.reviewCursor || pile.feedbackCursor || pile.reportsCursor),
    loadMore
  };
}
