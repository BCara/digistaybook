import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostModerationPage } from "./HostModerationPage";
import { emptyProfile } from "../../domain/propertyProfile";
import type { ModeratedPost } from "../../domain/postModeration";
import type { HostProperty } from "../host/propertyStore";
import { forgetProperties } from "../host/propertyCache";

vi.mock("../../lib/firebaseConfig", () => ({
  firebaseConfig: {},
  firebaseConfigured: true
}));

const loadProperty = vi.fn();
const loadWallCounts = vi.fn();
const listOwnedProperties = vi.fn();
const listWallPosts = vi.fn();
const moderatePost = vi.fn();
const hostCall = vi.fn();

vi.mock("../host/propertyStore", () => ({
  loadProperty: (...args: unknown[]) => loadProperty(...args),
  loadWallCounts: (...args: unknown[]) => loadWallCounts(...args),
  listOwnedProperties: (...args: unknown[]) => listOwnedProperties(...args)
}));

vi.mock("../host/GuestReviewPanel", () => ({
  hostCall: (...args: unknown[]) => hostCall(...args)
}));

vi.mock("../host/moderationStore", () => ({
  listWallPosts: (...args: unknown[]) => listWallPosts(...args),
  moderatePost: (...args: unknown[]) => moderatePost(...args),
  newRequestId: () => "request-1"
}));

function hostProperty(overrides: Partial<HostProperty> = {}): HostProperty {
  return {
    id: "prop-1",
    ownerUid: "host-a",
    name: "Seabreeze Cottage",
    slug: "seabreeze-cottage",
    lifecycle: "active",
    mode: "live",
    foundationalPostCount: 3,
    createdAt: null,
    updatedAt: null,
    billing: null,
    profile: emptyProfile(),
    ...overrides
  };
}

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

const privacyRequest = post({
  id: "memory-2",
  message: "Please take the photo of my children down.",
  displayName: "Priya",
  visibility: "hidden_pending_review",
  hold: { source: "guest_report", reason: "privacy", detail: "That is my family", raisedAt: "2026-08-20T09:00:00.000Z" }
});

const hostSession = { status: "host", user: { uid: "host-a", email: "host@example.com" } } as unknown as AuthState;

function renderPage(state: AuthState = hostSession) {
  return render(
    <AuthContext.Provider value={state}>
      <HostModerationPage />
    </AuthContext.Provider>
  );
}

/** The table row an item is drawn in, found by the words the guest wrote. */
function rowFor(message: string | RegExp): HTMLElement {
  return screen.getByText(message).closest("tr") as HTMLElement;
}

/** The text of one column down a table, top to bottom. */
function column(table: HTMLElement, label: string): string[] {
  return [...table.querySelectorAll(`tbody td[data-label="${label}"]`)].map((cell) => cell.textContent ?? "");
}

type Inbox = { posts?: unknown[]; feedback?: unknown[]; reports?: unknown[]; reviewContent?: boolean; heldBySafety?: number };
let inboxes: Record<string, Inbox> = {};

function routeHostCall(name: string, data: { propertyId?: string }) {
  const inbox = inboxes[data.propertyId ?? ""] ?? {};
  if (name === "listHostGuestReview") return { posts: inbox.posts ?? [], feedback: inbox.feedback ?? [], reviewContent: inbox.reviewContent ?? false, reviewCursor: null, feedbackCursor: null };
  if (name === "listHostReports") return { reports: inbox.reports ?? [], nextCursor: null, ...(inbox.heldBySafety === undefined ? {} : { heldBySafety: inbox.heldBySafety }) };
  if (name === "setGuestReviewPolicy") return { reviewContent: (data as { reviewContent: boolean }).reviewContent };
  return {};
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/host/inbox");
  forgetProperties();
  loadProperty.mockImplementation(async (id: string) => ({ status: "ok", value: hostProperty({ id }) }));
  listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty()] });
  listWallPosts.mockResolvedValue({ status: "ok", value: [post(), privacyRequest] });
  inboxes = {};
  hostCall.mockImplementation(async (name: string, data: { propertyId?: string }) => routeHostCall(name, data));
  moderatePost.mockImplementation(async ({ postId, action }: { postId: string; action: string }) => ({
    status: "ok",
    value: post({ id: postId, visibility: action === "delete" ? "deleted" : "visible", message: "" })
  }));
});

describe("memories the safety team is holding", () => {
  it("counts them in the inbox without listing them, and says nothing when there are none", async () => {
    inboxes = { "prop-1": { heldBySafety: 1 } };
    const { unmount } = renderPage();
    expect(await screen.findByText(/1 memory is being checked by the DigiStayBook safety team/)).toBeInTheDocument();
    // Nothing waits on the Host, so the inbox is still clear.
    expect(screen.getByText("All caught up")).toBeInTheDocument();
    unmount();

    inboxes = { "prop-1": { heldBySafety: 0 } };
    renderPage();
    await screen.findByText("All caught up");
    expect(screen.queryByText(/safety team\./)).not.toBeInTheDocument();
  });
});

describe("the memories table", () => {
  beforeEach(() => window.history.replaceState(null, "", "/host/inbox#memories"));

  it("loads another page without duplicating existing memories", async () => {
    listWallPosts.mockResolvedValueOnce({ status: "ok", value: [post()], nextCursor: "memory-1" })
      .mockResolvedValueOnce({ status: "ok", value: [post(), privacyRequest], nextCursor: null });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Load more memories" }));
    await screen.findByText("Please take the photo of my children down.");
    expect(screen.getAllByText("Four days of sea air and we already want to come back.")).toHaveLength(1);
    expect(listWallPosts).toHaveBeenLastCalledWith("prop-1", "memory-1");
    expect(screen.queryByRole("button", { name: "Load more memories" })).not.toBeInTheDocument();
  });
  it("shows every memory, one row each, with what is off the wall at the bottom", async () => {
    listWallPosts.mockResolvedValue({ status: "ok", value: [post(), { ...privacyRequest, createdAt: "2026-08-20T09:00:00.000Z" }] });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Inbox & moderation", level: 1 })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Memories" });
    // Newer, but off the wall, so it sits below the wall's own memories.
    expect(column(table, "Memory")).toEqual([
      "Four days of sea air and we already want to come back.",
      "Please take the photo of my children down."
    ]);
    expect(column(table, "From")).toEqual(["Mia & Sam", "Priya"]);
    // One property, so no column says whose it is.
    expect(within(table).queryByRole("columnheader", { name: "Property" })).not.toBeInTheDocument();
  });

  it("leads with pinned memories, sorts by a clicked column, and goes back to pinned first", async () => {
    listWallPosts.mockResolvedValue({ status: "ok", value: [
      post({ id: "m-old", message: "Old and pinned.", pinned: true, createdAt: "2026-06-01T09:00:00.000Z" }),
      post({ id: "m-new", message: "Newest on the wall.", createdAt: "2026-09-01T09:00:00.000Z" }),
      post({ id: "m-off", message: "Taken off.", visibility: "hidden_by_host", createdAt: "2026-09-05T09:00:00.000Z" })
    ] });
    renderPage();

    const table = await screen.findByRole("table", { name: "Memories" });
    expect(column(table, "Memory")).toEqual(["Old and pinned.", "Newest on the wall.", "Taken off."]);

    fireEvent.click(within(table).getByRole("button", { name: /Posted/ }));
    expect(within(table).getByRole("columnheader", { name: /Posted/ })).toHaveAttribute("aria-sort", "descending");
    expect(column(table, "Memory")).toEqual(["Taken off.", "Newest on the wall.", "Old and pinned."]);

    fireEvent.click(within(table).getByRole("button", { name: /Posted/ }));
    // Oldest first now, which here happens to match the default order.
    expect(within(table).getByRole("columnheader", { name: /Posted/ })).toHaveAttribute("aria-sort", "ascending");
    expect(column(table, "Memory")).toEqual(["Old and pinned.", "Newest on the wall.", "Taken off."]);

    fireEvent.click(screen.getByRole("button", { name: "Pinned first" }));
    expect(column(table, "Memory")).toEqual(["Old and pinned.", "Newest on the wall.", "Taken off."]);
    expect(screen.queryByRole("button", { name: "Pinned first" })).not.toBeInTheDocument();
  });

  it("narrows the memories by status, and clears the filter", async () => {
    listWallPosts.mockResolvedValue({ status: "ok", value: [
      post({ id: "m-1", message: "On the wall." }),
      post({ id: "m-2", message: "Taken off.", visibility: "hidden_by_host" })
    ] });
    renderPage();

    await screen.findByRole("table", { name: "Memories" });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "off" } });
    expect(column(screen.getByRole("table", { name: "Memories" }), "Memory")).toEqual(["Taken off."]);
    expect(screen.getByText("1 of 2 memories")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(column(screen.getByRole("table", { name: "Memories" }), "Memory")).toHaveLength(2);
  });

  it("opens on the inbox and moves between the three tabs", async () => {
    window.history.replaceState(null, "", "/host/inbox");
    inboxes["prop-1"] = { feedback: [{ id: "fb-1", message: "The shower was cold.", createdAt: "2026-08-02T09:00:00.000Z" }] };
    renderPage();

    expect(await screen.findByRole("tab", { name: /^Inbox/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /^Private feedback/ }));
    expect(await screen.findByText("The shower was cold.")).toBeInTheDocument();
    expect(window.location.hash).toBe("#feedback");

    fireEvent.click(screen.getByRole("tab", { name: /^Memories/ }));
    expect(await screen.findByText("Four days of sea air and we already want to come back.")).toBeInTheDocument();
    expect(screen.queryByText("The shower was cold.")).not.toBeInTheDocument();
  });

  it("says why a memory is held back, and how long is left to resolve it", async () => {
    renderPage();

    expect(await screen.findByText(/Reported by a guest/)).toBeInTheDocument();
    const card = within(rowFor("Please take the photo of my children down."));
    expect(card.getByText(/That is my family/)).toBeInTheDocument();
    expect(card.getByText(/left to resolve|past the deadline/)).toBeInTheDocument();
  });

  it("offers curation on a live memory and publication on a held one", async () => {
    renderPage();

    await screen.findByText("Four days of sea air and we already want to come back.");
    const live = within(rowFor("Four days of sea air and we already want to come back."));
    expect(live.getByRole("button", { name: "Pin" })).toBeInTheDocument();
    expect(live.getByRole("button", { name: "Take off the wall" })).toBeInTheDocument();

    const held = within(rowFor("Please take the photo of my children down."));
    expect(held.getByRole("button", { name: "Publish to the wall" })).toBeInTheDocument();
    expect(held.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("leads each memory with one action, marks a pinned one, and folds the rest under More", async () => {
    listWallPosts.mockResolvedValue({ status: "ok", value: [post({ pinned: true }), post({ id: "memory-4", message: "Lovely week." })] });
    renderPage();

    await screen.findByText("Four days of sea air and we already want to come back.");
    const pinned = rowFor("Four days of sea air and we already want to come back.");
    expect(pinned).toHaveClass("is-pinned");
    expect(within(pinned).getByText("Pinned")).toBeInTheDocument();
    expect(within(pinned).getByRole("button", { name: "Unpin" })).toBeInTheDocument();

    const plain = rowFor("Lovely week.");
    expect(plain).not.toHaveClass("is-pinned");
    expect(within(plain).getByLabelText("More actions").closest("details")).toContainElement(
      within(plain).getByRole("button", { name: "Delete" })
    );
  });

  it("sends a reversible action straight to the server", async () => {
    renderPage();

    await screen.findByText("Four days of sea air and we already want to come back.");
    fireEvent.click(within(rowFor("Four days of sea air and we already want to come back.")).getByRole("button", { name: "Pin" }));

    await waitFor(() =>
      expect(moderatePost).toHaveBeenCalledWith({
        propertyId: "prop-1",
        postId: "memory-1",
        action: "pin",
        requestId: "request-1"
      })
    );
  });

  it("asks before a permanent deletion, and does nothing if the Host backs out", async () => {
    renderPage();

    await screen.findByText("Please take the photo of my children down.");
    const card = within(rowFor("Please take the photo of my children down."));
    fireEvent.click(card.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/Delete this memory\? .*This cannot be undone/);
    expect(moderatePost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep it as it is" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(moderatePost).not.toHaveBeenCalled();
  });

  it("deletes once confirmed, and moves the memory out of the request pile", async () => {
    renderPage();

    await screen.findByText("Please take the photo of my children down.");
    fireEvent.click(within(rowFor("Please take the photo of my children down.")).getByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Yes, delete$/i }));

    await waitFor(() => expect(moderatePost).toHaveBeenCalledWith(expect.objectContaining({ action: "delete" })));
    expect(await screen.findByRole("heading", { name: /Recently deleted/ })).toBeInTheDocument();
  });

  it("reports a refused action against the memory it concerns, and changes nothing", async () => {
    moderatePost.mockResolvedValue({ status: "error", message: "The server refused that." });
    renderPage();

    await screen.findByText("Four days of sea air and we already want to come back.");
    const card = rowFor("Four days of sea air and we already want to come back.");
    fireEvent.click(within(card).getByRole("button", { name: "Pin" }));

    expect(await within(card).findByRole("alert")).toHaveTextContent("The server refused that.");
    // Still on the wall, and still offering the action that failed.
    expect(within(card).getByRole("button", { name: "Pin" })).toBeInTheDocument();
  });

  it("offers nothing on a memory DigiStayBook has taken out of the Host's hands", async () => {
    listWallPosts.mockResolvedValue({
      status: "ok",
      value: [post({ id: "memory-3", message: "Held by us.", visibility: "restricted" })]
    });
    renderPage();

    await screen.findByText("Held by us.");
    const card = within(rowFor("Held by us."));
    expect(card.queryByRole("button")).not.toBeInTheDocument();
    expect(card.getByText(/Trust & Safety team is reviewing it/)).toBeInTheDocument();
  });

  it("reports a wall it could not read rather than showing an empty one", async () => {
    listWallPosts.mockResolvedValue({ status: "error", message: "We could not reach the database." });
    renderPage();

    expect(await screen.findByText(/could not read this wall/i)).toBeInTheDocument();
    expect(screen.queryByText(/No memories yet/)).not.toBeInTheDocument();
  });

  it("says plainly when a wall has nothing on it yet", async () => {
    listWallPosts.mockResolvedValue({ status: "ok", value: [] });
    renderPage();

    expect(await screen.findByText(/No memories yet/)).toBeInTheDocument();
  });

  it("asks before escalating, because an escalation cannot be taken back", async () => {
    renderPage();

    await screen.findByText("Four days of sea air and we already want to come back.");
    fireEvent.click(
      within(rowFor("Four days of sea air and we already want to come back.")).getByRole("button", {
        name: "Report to DigiStayBook"
      })
    );

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/severe abuse, not for memories you simply do not want/);
    expect(moderatePost).not.toHaveBeenCalled();
  });

  it("projects the action itself when the server answers without a post", async () => {
    // An older deployment, or an answer trimmed in transit. The memory must
    // still leave the wall rather than sit there looking unchanged.
    moderatePost.mockResolvedValue({ status: "ok", value: null });
    renderPage();

    await screen.findByText("Four days of sea air and we already want to come back.");
    fireEvent.click(
      within(rowFor("Four days of sea air and we already want to come back.")).getByRole("button", {
        name: "Take off the wall"
      })
    );

    expect(await screen.findByText("Taken off the wall.")).toBeInTheDocument();
    expect(
      within(rowFor("Four days of sea air and we already want to come back.")).getByText("Off the wall")
    ).toBeInTheDocument();
  });
});

describe("the inbox across every property", () => {
  const harbour = hostProperty({ id: "prop-2", name: "Harbour Loft", slug: "harbour-loft" });
  const draft = hostProperty({ id: "prop-3", name: "Hilltop Cabin", slug: "hilltop-cabin", lifecycle: "draft", mode: "sandbox" });

  it("mixes every published wall into one memories table, newest first, with the property as a column", async () => {
    window.history.replaceState(null, "", "/host/inbox#memories");
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty(), harbour] });
    listWallPosts.mockImplementation(async (id: string) => ({
      status: "ok",
      value: id === "prop-2"
        ? [post({ id: "loft-1", message: "Sunset from the loft.", createdAt: "2026-08-15T09:00:00.000Z" })]
        : [post({ createdAt: "2026-08-01T09:00:00.000Z" }), post({ id: "memory-5", message: "Newest of all.", createdAt: "2026-09-01T09:00:00.000Z" })]
    }));
    renderPage();

    const table = await screen.findByRole("table", { name: "Memories" });
    await within(table).findByText("Sunset from the loft.");
    expect(column(table, "Memory")).toEqual([
      "Newest of all.",
      "Sunset from the loft.",
      "Four days of sea air and we already want to come back."
    ]);
    expect(column(table, "Property")).toEqual(["Seabreeze Cottage", "Harbour Loft", "Seabreeze Cottage"]);
  });

  it("acts on a memory against the property it was left on", async () => {
    window.history.replaceState(null, "", "/host/inbox#memories");
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty(), harbour] });
    listWallPosts.mockImplementation(async (id: string) => ({
      status: "ok",
      value: id === "prop-2" ? [post({ id: "loft-1", message: "Sunset from the loft." })] : []
    }));
    renderPage();

    fireEvent.click(within(await screen.findByText("Sunset from the loft.").then((node) => node.closest("tr") as HTMLElement)).getByRole("button", { name: "Pin" }));
    await waitFor(() => expect(moderatePost).toHaveBeenCalledWith(expect.objectContaining({ propertyId: "prop-2", postId: "loft-1", action: "pin" })));
  });

  it("narrows to one property from the link or the picker", async () => {
    window.history.replaceState(null, "", "/host/inbox?property=prop-2");
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty(), harbour] });
    renderPage();

    await waitFor(() => expect(listWallPosts).toHaveBeenCalledWith("prop-2"));
    expect(listWallPosts).not.toHaveBeenCalledWith("prop-1");
    expect(screen.getByRole("combobox", { name: "Showing" })).toHaveValue("prop-2");

    fireEvent.change(screen.getByRole("combobox", { name: "Showing" }), { target: { value: "" } });
    await waitFor(() => expect(listWallPosts).toHaveBeenCalledWith("prop-1"));
    expect(window.location.search).toBe("");
  });

  it("says a draft's inbox opens once it is published, and never reads its wall", async () => {
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty(), draft] });
    renderPage();

    expect(await screen.findByText(/Hilltop Cabin is not published yet\. Inbox and moderation will be available when it is published\./)).toBeInTheDocument();
    await waitFor(() => expect(listWallPosts).toHaveBeenCalledWith("prop-1"));
    expect(listWallPosts).not.toHaveBeenCalledWith("prop-3");

    fireEvent.change(screen.getByRole("combobox", { name: "Showing" }), { target: { value: "prop-3" } });
    const row = screen.getByText("Hilltop Cabin", { selector: "strong" }).closest(".inbox-draft") as HTMLElement;
    expect(within(row).getByText("Inbox and moderation will be available when the property is published.")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Publish" })).toHaveAttribute("href", "/host/property/prop-3/billing");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("says the inbox is waiting on publication when nothing is published yet", async () => {
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [draft] });
    renderPage();

    expect(await screen.findByText("Your inbox and moderation queue will be available when a property is published.")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(listWallPosts).not.toHaveBeenCalled();
  });
});

describe("the inbox table", () => {
  const harbour = hostProperty({ id: "prop-2", name: "Harbour Loft", slug: "harbour-loft" });
  const waiting = (id: string, message: string, createdAt: string, extra: object = {}) =>
    ({ id, status: "standard", message, displayName: "Guest " + id, revision: 2, photoCount: 0, createdAt, ...extra });

  it("puts every property's waiting memories and reports in one table, with the property as a column", async () => {
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty(), harbour] });
    inboxes["prop-1"] = {
      posts: [waiting("a", "Older one.", "2026-08-01T09:00:00.000Z")],
      reports: [{ id: "r-1", postId: "memory-2", reason: "privacy", reviewDueAt: "2026-08-25T09:00:00.000Z" }]
    };
    inboxes["prop-2"] = { posts: [waiting("b", "Newer one.", "2026-08-10T09:00:00.000Z")] };
    renderPage();

    const table = await screen.findByRole("table", { name: "Waiting for you" });
    await waitFor(() => expect(column(table, "Message")[0]).toBe("\u201cPlease take the photo of my children down.\u201d"));
    // The report leads, because a memory is already off the wall waiting on it;
    // memories to approve follow, newest first.
    expect(column(table, "Property")).toEqual(["Seabreeze Cottage", "Harbour Loft", "Seabreeze Cottage"]);
    expect(column(table, "Message").slice(1)).toEqual(["Newer one.", "Older one."]);
    expect(column(table, "Status")[0]).toMatch(/^Reported:/);
    expect(screen.getByRole("tab", { name: /^Inbox/ })).toHaveTextContent("3");
  });

  it("approves a memory against its own property", async () => {
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty(), harbour] });
    inboxes["prop-2"] = { posts: [waiting("b", "Newer one.", "2026-08-10T09:00:00.000Z")] };
    renderPage();

    await screen.findByRole("table", { name: "Waiting for you" });
    fireEvent.click(within(rowFor("Newer one.")).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(hostCall).toHaveBeenCalledWith("reviewGuestContribution", { id: "b", revision: 2, action: "approve" }));
    expect(await screen.findByText("The memory is now on the wall.")).toBeInTheDocument();
  });

  it("holds back a memory still in safety checks, with nothing to press", async () => {
    inboxes["prop-1"] = { posts: [waiting("c", "Awaiting safety screening", "2026-08-10T09:00:00.000Z", { status: "pending", displayName: "" })] };
    renderPage();

    const row = (await screen.findByText("Shown here once safety checks finish.")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Safety checks running")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers the approval switch only while one property is shown", async () => {
    inboxes["prop-1"] = { reviewContent: false };
    renderPage();

    const toggle = await screen.findByRole("checkbox", { name: /Approve new memories/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(hostCall).toHaveBeenCalledWith("setGuestReviewPolicy", { propertyId: "prop-1", reviewContent: true }));
  });

  it("hides the approval switch when the table mixes properties", async () => {
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty(), harbour] });
    renderPage();

    await screen.findByText(/All caught up/);
    expect(screen.queryByRole("checkbox", { name: /Approve new memories/ })).not.toBeInTheDocument();
  });

  it("says all caught up when nothing is waiting", async () => {
    renderPage();
    expect(await screen.findByText(/All caught up/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Waiting for you" })).not.toBeInTheDocument();
  });
});
