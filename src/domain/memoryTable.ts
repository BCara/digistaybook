import type { ModeratedPost } from "./postModeration";

/**
 * How the inbox's memories table is ordered and narrowed.
 *
 * The default answers "what is on my wall": pinned memories lead, as they do
 * for a guest, then the rest of the wall, and memories taken off it sink to
 * the bottom, each group newest first. A Host can sort by any column instead
 * and come back to this order with one control.
 */

export type MemorySortKey = "default" | "property" | "from" | "posted" | "status";
export type SortDirection = "asc" | "desc";
export type MemorySort = { key: MemorySortKey; direction: SortDirection };
export const defaultMemorySort: MemorySort = { key: "default", direction: "asc" };

export type DateRange = "all" | "7" | "30" | "90" | "365";
export type StatusFilter = "all" | "pinned" | "visible" | "off";
export type MemoryFilter = { range: DateRange; status: StatusFilter };
export const defaultMemoryFilter: MemoryFilter = { range: "all", status: "all" };

export const dateRangeLabels: Record<DateRange, string> = {
  all: "Any time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 3 months",
  "365": "Last 12 months"
};

export const statusFilterLabels: Record<StatusFilter, string> = {
  all: "All statuses",
  pinned: "Pinned",
  visible: "On the wall",
  off: "Off the wall"
};

/** Something the table draws as a row: the memory, and the property it is on. */
export type MemoryRowData = { post: ModeratedPost; propertyName: string };

/** Pinned, then on the wall, then everything off it. */
function wallRank(post: ModeratedPost): number {
  if (post.visibility === "visible") return post.pinned ? 0 : 1;
  return 2;
}

/** A finer order for the Status column, so like states sit together. */
function statusRank(post: ModeratedPost): number {
  switch (post.visibility) {
    case "visible": return post.pinned ? 0 : 1;
    case "hidden_pending_review": return 2;
    case "hidden_by_host": return 3;
    case "restricted": return 4;
    default: return 5;
  }
}

const newestFirst = (a: ModeratedPost, b: ModeratedPost) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
const text = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();

export function sortMemories<T extends MemoryRowData>(rows: readonly T[], sort: MemorySort): T[] {
  const flip = sort.direction === "desc" ? -1 : 1;
  const compare = (a: T, b: T): number => {
    switch (sort.key) {
      case "default":
        return wallRank(a.post) - wallRank(b.post) || newestFirst(a.post, b.post);
      case "posted":
        // Ascending is oldest first, as a date column reads.
        return flip * (a.post.createdAt ?? "").localeCompare(b.post.createdAt ?? "") || 0;
      case "property":
        return flip * text(a.propertyName).localeCompare(text(b.propertyName)) || newestFirst(a.post, b.post);
      case "from":
        // A memory left without a name sorts after every named one either way.
        if (!text(a.post.displayName) !== !text(b.post.displayName)) return text(a.post.displayName) ? -1 : 1;
        return flip * text(a.post.displayName).localeCompare(text(b.post.displayName)) || newestFirst(a.post, b.post);
      case "status":
        return flip * (statusRank(a.post) - statusRank(b.post)) || newestFirst(a.post, b.post);
    }
  };
  return [...rows].sort(compare);
}

export function filterMemories<T extends MemoryRowData>(rows: readonly T[], filter: MemoryFilter, now = Date.now()): T[] {
  const since = filter.range === "all" ? null : now - Number(filter.range) * 86_400_000;
  return rows.filter(({ post }) => {
    if (since !== null) {
      const posted = Date.parse(post.createdAt ?? "");
      if (!Number.isFinite(posted) || posted < since) return false;
    }
    switch (filter.status) {
      case "pinned": return post.visibility === "visible" && post.pinned;
      case "visible": return post.visibility === "visible";
      case "off": return post.visibility !== "visible";
      default: return true;
    }
  });
}

/** What a column header does when clicked: sort by it, or turn it round. */
export function nextSort(current: MemorySort, key: Exclude<MemorySortKey, "default">): MemorySort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  // A date is most often wanted newest first; names and states read A to Z.
  return { key, direction: key === "posted" ? "desc" : "asc" };
}
