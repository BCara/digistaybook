import {
  actionsUnavailable,
  applyAction,
  availableActions,
  holdSla,
  holdSummary,
  primaryAction,
  privacySlaDays,
  queueSections,
  queueSummary,
  readPost,
  type ModeratedPost
} from "./postModeration";

function post(overrides: Partial<ModeratedPost> = {}): ModeratedPost {
  return {
    id: "memory-1",
    message: "Four days of sea air and we already want to come back.",
    displayName: "Mia & Sam",
    createdAt: "2026-08-01T09:00:00.000Z",
    stayedOn: "June 2026",
    visibility: "visible",
    pinned: false,
    photo: null,
    hold: null,
    ...overrides
  };
}

const reported = (reason: "privacy" | "harassment", raisedAt: string): ModeratedPost =>
  post({
    id: `report-${reason}`,
    visibility: "hidden_pending_review",
    hold: { source: "guest_report", reason, detail: "", raisedAt }
  });

describe("what a Host may do to a memory", () => {
  it("offers curation on a live memory and pinning that matches its state", () => {
    expect(availableActions(post())).toEqual(["pin", "hide", "delete", "escalate"]);
    expect(availableActions(post({ pinned: true }))).toEqual(["unpin", "hide", "delete", "escalate"]);
  });

  it("offers publication on anything held back, however it got there", () => {
    expect(availableActions(post({ visibility: "hidden_pending_review" }))).toContain("publish");
    expect(availableActions(post({ visibility: "hidden_by_host" }))).toContain("publish");
  });

  it("offers nothing on a memory the platform has taken out of the Host's hands", () => {
    const restricted = post({ visibility: "restricted" });
    expect(availableActions(restricted)).toEqual([]);
    expect(actionsUnavailable(restricted)).toMatch(/Trust & Safety/);
  });

  it("offers nothing on a deleted memory, and says why", () => {
    expect(availableActions(post({ visibility: "deleted" }))).toEqual([]);
    expect(actionsUnavailable(post({ visibility: "deleted" }))).toMatch(/Deleted/);
  });

  it("leads a privacy request with deletion rather than burying it", () => {
    expect(primaryAction(reported("privacy", "2026-08-02T09:00:00.000Z"))).toBe("delete");
    expect(primaryAction(reported("harassment", "2026-08-02T09:00:00.000Z"))).toBe("publish");
  });
});

describe("projecting an action before the server answers", () => {
  it("clears the hold when a held memory is published, so it leaves the review pile", () => {
    const published = applyAction(reported("harassment", "2026-08-02T09:00:00.000Z"), "publish");
    expect(published).toMatchObject({ visibility: "visible", hold: null });
  });

  it("unpins a memory taken off the wall, and records that the Host did it", () => {
    const hidden = applyAction(post({ pinned: true }), "hide");
    expect(hidden).toMatchObject({ visibility: "hidden_by_host", pinned: false });
    expect(hidden.hold?.source).toBe("host_decision");
  });

  it("leaves the wall alone when a memory is escalated to Trust & Safety", () => {
    const original = post();
    expect(applyAction(original, "escalate")).toEqual(original);
  });
});

describe("the 14-day privacy clock", () => {
  const raisedAt = "2026-08-01T00:00:00.000Z";

  it("counts down from the day the report was raised", () => {
    expect(holdSla(reported("privacy", raisedAt), new Date("2026-08-05T00:00:00.000Z"))).toEqual({
      daysLeft: privacySlaDays - 4,
      overdue: false
    });
  });

  it("keeps counting once the deadline has passed rather than hiding it", () => {
    const sla = holdSla(reported("privacy", raisedAt), new Date("2026-08-18T00:00:00.000Z"));
    expect(sla).toEqual({ daysLeft: -3, overdue: true });
  });

  it("puts no deadline on a screening flag or on a Host's own decision", () => {
    const flagged = post({
      visibility: "hidden_pending_review",
      hold: { source: "automated_screening", reason: null, detail: "Racy image", raisedAt }
    });
    expect(holdSla(flagged)).toBeNull();
    expect(holdSla(post({ visibility: "hidden_by_host" }))).toBeNull();
  });
});

describe("splitting one wall into the piles a Host works through", () => {
  const privacy = reported("privacy", "2026-08-10T00:00:00.000Z");
  const olderPrivacy = { ...reported("privacy", "2026-08-01T00:00:00.000Z"), id: "report-privacy-old" };
  const flagged = post({
    id: "flagged",
    visibility: "hidden_pending_review",
    hold: { source: "automated_screening", reason: null, detail: "Racy image", raisedAt: "2026-08-09T00:00:00.000Z" }
  });
  const live = post({ id: "live", createdAt: "2026-07-01T00:00:00.000Z" });
  const pinned = post({ id: "pinned", pinned: true, createdAt: "2026-01-01T00:00:00.000Z" });
  const gone = post({ id: "gone", visibility: "deleted" });

  const sections = queueSections([live, privacy, gone, flagged, pinned, olderPrivacy]);

  it("puts privacy requests first, deadline soonest at the top", () => {
    expect(sections[0]?.id).toBe("privacy");
    expect(sections[0]?.posts.map((entry) => entry.id)).toEqual(["report-privacy-old", "report-privacy"]);
  });

  it("keeps a screening flag out of the privacy pile", () => {
    expect(sections.find((section) => section.id === "review")?.posts.map((entry) => entry.id)).toEqual(["flagged"]);
  });

  it("shows the live wall in the order guests read it, pinned first", () => {
    expect(sections.find((section) => section.id === "wall")?.posts.map((entry) => entry.id)).toEqual([
      "pinned",
      "live"
    ]);
  });

  it("drops empty piles rather than showing a Host five empty headings", () => {
    expect(sections.map((section) => section.id)).toEqual(["privacy", "review", "wall", "removed"]);
    expect(queueSections([])).toEqual([]);
  });
});

describe("saying why a memory is off the wall", () => {
  it("quotes a reporter without pretending the platform agreed with them", () => {
    const summary = holdSummary(
      post({
        visibility: "hidden_pending_review",
        hold: { source: "guest_report", reason: "harassment", detail: "This is about me", raisedAt: null }
      })
    );
    expect(summary).toContain("Reported by a guest");
    expect(summary).toContain("This is about me");
  });

  it("tells a Host that automated screening is often wrong", () => {
    const summary = holdSummary(
      post({ hold: { source: "automated_screening", reason: null, detail: "Racy image", raisedAt: null } })
    );
    expect(summary).toMatch(/false alarm/);
  });

  it("says nothing about a memory that is simply on the wall", () => {
    expect(holdSummary(post())).toBeNull();
  });
});

describe("reading a post document", () => {
  it("holds back a post whose visibility this build does not recognise", () => {
    // A permissive fallback would put an unknown document on the public wall
    // side of the queue and let a Host act on it as though they had seen it.
    expect(readPost("x", { visibility: "something_new", message: "Hi" }).visibility).toBe("hidden_pending_review");
  });

  it("drops a hold whose source is not one of ours rather than inventing one", () => {
    expect(readPost("x", { visibility: "visible", hold: { source: "spoofed" } }).hold).toBeNull();
  });

  it("survives a document with nothing in it", () => {
    expect(readPost("x", undefined)).toMatchObject({ id: "x", message: "", pinned: false, hold: null });
  });

  it("converts a Firestore timestamp to an ISO string", () => {
    const createdAt = readPost("x", {
      visibility: "visible",
      createdAt: { toDate: () => new Date("2026-08-01T09:00:00.000Z") }
    }).createdAt;
    expect(createdAt).toBe("2026-08-01T09:00:00.000Z");
  });
});

describe("the one-line summary above the queue", () => {
  it("says plainly when nothing needs the Host", () => {
    expect(queueSummary([post(), post({ id: "b" })])).toBe("2 memories on the wall. Nothing is waiting on you.");
  });

  it("counts everything off the wall as waiting, however it got there", () => {
    const summary = queueSummary([
      post(),
      post({ id: "b", visibility: "hidden_pending_review" }),
      post({ id: "c", visibility: "hidden_by_host" }),
      post({ id: "d", visibility: "deleted" })
    ]);
    expect(summary).toBe("1 memory on the wall, 2 waiting on you.");
  });
});
