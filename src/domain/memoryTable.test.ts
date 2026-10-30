import { defaultMemorySort, filterMemories, nextSort, sortMemories, type MemoryRowData } from "./memoryTable";
import type { ModeratedPost } from "./postModeration";

function row(id: string, overrides: Partial<ModeratedPost> = {}, propertyName = "Seabreeze Cottage"): MemoryRowData & { id: string } {
  return {
    id,
    propertyName,
    post: {
      id,
      message: id,
      displayName: "",
      createdAt: "2026-08-01T09:00:00.000Z",
      stayedOn: null,
      visibility: "visible",
      pinned: false,
      photo: null,
      hold: null,
      ...overrides
    } as ModeratedPost
  };
}

const ids = (rows: { id: string }[]) => rows.map((entry) => entry.id);

describe("ordering the memories table", () => {
  const rows = [
    row("hidden-new", { visibility: "hidden_by_host", createdAt: "2026-09-10T00:00:00.000Z" }),
    row("wall-old", { createdAt: "2026-08-01T00:00:00.000Z" }),
    row("pinned-old", { pinned: true, createdAt: "2026-07-01T00:00:00.000Z" }),
    row("wall-new", { createdAt: "2026-09-01T00:00:00.000Z" }),
    row("pinned-new", { pinned: true, createdAt: "2026-08-15T00:00:00.000Z" }),
    row("held", { visibility: "hidden_pending_review", createdAt: "2026-09-12T00:00:00.000Z" })
  ];

  it("puts pinned first, off-the-wall last, and each group newest first by default", () => {
    expect(ids(sortMemories(rows, defaultMemorySort))).toEqual([
      "pinned-new", "pinned-old", "wall-new", "wall-old", "held", "hidden-new"
    ]);
  });

  it("sorts by date either way", () => {
    expect(ids(sortMemories(rows, { key: "posted", direction: "desc" }))[0]).toBe("held");
    expect(ids(sortMemories(rows, { key: "posted", direction: "asc" }))[0]).toBe("pinned-old");
  });

  it("sorts by property name, then newest first within a property", () => {
    const mixed = [row("b-old", {}, "Beach House"), row("a", {}, "Alpine Lodge"), row("b-new", { createdAt: "2026-09-01T00:00:00.000Z" }, "Beach House")];
    expect(ids(sortMemories(mixed, { key: "property", direction: "asc" }))).toEqual(["a", "b-new", "b-old"]);
    expect(ids(sortMemories(mixed, { key: "property", direction: "desc" }))).toEqual(["b-new", "b-old", "a"]);
  });

  it("keeps unnamed guests after named ones whichever way From is sorted", () => {
    const named = [row("none"), row("zoe", { displayName: "Zoe" }), row("ada", { displayName: "Ada" })];
    expect(ids(sortMemories(named, { key: "from", direction: "asc" }))).toEqual(["ada", "zoe", "none"]);
    expect(ids(sortMemories(named, { key: "from", direction: "desc" }))).toEqual(["zoe", "ada", "none"]);
  });

  it("turns a column round on a second click, and starts dates newest first", () => {
    expect(nextSort(defaultMemorySort, "posted")).toEqual({ key: "posted", direction: "desc" });
    expect(nextSort({ key: "posted", direction: "desc" }, "posted")).toEqual({ key: "posted", direction: "asc" });
    expect(nextSort({ key: "posted", direction: "desc" }, "from")).toEqual({ key: "from", direction: "asc" });
  });
});

describe("narrowing the memories table", () => {
  const now = Date.parse("2026-09-15T00:00:00.000Z");
  const rows = [
    row("recent", { createdAt: "2026-09-12T00:00:00.000Z" }),
    row("month", { createdAt: "2026-08-25T00:00:00.000Z", pinned: true }),
    row("old", { createdAt: "2026-03-01T00:00:00.000Z", visibility: "hidden_by_host" }),
    row("undated", { createdAt: null })
  ];

  it("keeps only memories posted within the range", () => {
    expect(ids(filterMemories(rows, { range: "7", status: "all" }, now))).toEqual(["recent"]);
    expect(ids(filterMemories(rows, { range: "30", status: "all" }, now))).toEqual(["recent", "month"]);
    expect(ids(filterMemories(rows, { range: "all", status: "all" }, now))).toHaveLength(4);
  });

  it("narrows by where a memory stands", () => {
    expect(ids(filterMemories(rows, { range: "all", status: "pinned" }, now))).toEqual(["month"]);
    expect(ids(filterMemories(rows, { range: "all", status: "off" }, now))).toEqual(["old"]);
    expect(ids(filterMemories(rows, { range: "all", status: "visible" }, now))).toEqual(["recent", "month", "undated"]);
  });
});
