import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostModerationPage } from "./HostModerationPage";
import { emptyProfile } from "../../domain/propertyProfile";
import type { ModeratedPost } from "../../domain/postModeration";
import type { HostProperty } from "../host/propertyStore";

vi.mock("../../lib/firebaseConfig", () => ({
  firebaseConfig: {},
  firebaseConfigured: true
}));

const loadProperty = vi.fn();
const loadWallCounts = vi.fn();
const listWallPosts = vi.fn();
const moderatePost = vi.fn();

vi.mock("../host/propertyStore", () => ({
  loadProperty: (...args: unknown[]) => loadProperty(...args),
  loadWallCounts: (...args: unknown[]) => loadWallCounts(...args)
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
      <HostModerationPage propertyId="prop-1" />
    </AuthContext.Provider>
  );
}

/** The card a memory is rendered in, found by the words the guest wrote. */
function cardFor(message: string): HTMLElement {
  return screen.getByText(message).closest("article") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  loadProperty.mockResolvedValue({ status: "ok", value: hostProperty() });
  listWallPosts.mockResolvedValue({ status: "ok", value: [post(), privacyRequest] });
  moderatePost.mockImplementation(async ({ postId, action }: { postId: string; action: string }) => ({
    status: "ok",
    value: post({ id: postId, visibility: action === "delete" ? "deleted" : "visible", message: "" })
  }));
});

describe("the moderation queue", () => {
  it("loads another page without duplicating existing memories", async () => {
    listWallPosts.mockResolvedValueOnce({ status: "ok", value: [post()], nextCursor: "memory-1" })
      .mockResolvedValueOnce({ status: "ok", value: [post(), privacyRequest], nextCursor: null });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Load more wall memories" }));
    await screen.findByText("Please take the photo of my children down.");
    expect(screen.getAllByText("Four days of sea air and we already want to come back.")).toHaveLength(1);
    expect(listWallPosts).toHaveBeenLastCalledWith("prop-1", "memory-1");
    expect(screen.queryByRole("button", { name: "Load more wall memories" })).not.toBeInTheDocument();
  });
  it("shows every memory on the wall, hidden ones included, in its own pile", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Moderation", level: 2 })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Privacy and takedown requests/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /On the wall/ })).toBeInTheDocument();
    expect(screen.getByText("Please take the photo of my children down.")).toBeInTheDocument();
    expect(screen.getByText("Four days of sea air and we already want to come back.")).toBeInTheDocument();
  });

  it("says why a memory is held back, and how long is left to resolve it", async () => {
    renderPage();

    expect(await screen.findByText(/Reported by a guest/)).toBeInTheDocument();
    const card = within(cardFor("Please take the photo of my children down."));
    expect(card.getByText(/That is my family/)).toBeInTheDocument();
    expect(card.getByText(/left to resolve|past the deadline/)).toBeInTheDocument();
  });

  it("offers curation on a live memory and publication on a held one", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /On the wall/ });
    const live = within(cardFor("Four days of sea air and we already want to come back."));
    expect(live.getByRole("button", { name: "Pin to the top" })).toBeInTheDocument();
    expect(live.getByRole("button", { name: "Take off the wall" })).toBeInTheDocument();

    const held = within(cardFor("Please take the photo of my children down."));
    expect(held.getByRole("button", { name: "Publish to the wall" })).toBeInTheDocument();
    expect(held.getByRole("button", { name: "Confirm permanent deletion" })).toBeInTheDocument();
  });

  it("sends a reversible action straight to the server", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /On the wall/ });
    fireEvent.click(within(cardFor("Four days of sea air and we already want to come back.")).getByRole("button", { name: "Pin to the top" }));

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

    await screen.findByRole("heading", { name: /Privacy and takedown requests/ });
    const card = within(cardFor("Please take the photo of my children down."));
    fireEvent.click(card.getByRole("button", { name: "Confirm permanent deletion" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/Delete this memory permanently\?/);
    expect(moderatePost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep it as it is" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(moderatePost).not.toHaveBeenCalled();
  });

  it("deletes once confirmed, and moves the memory out of the request pile", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /Privacy and takedown requests/ });
    fireEvent.click(within(cardFor("Please take the photo of my children down.")).getByRole("button", { name: "Confirm permanent deletion" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Yes, confirm permanent deletion$/i }));

    await waitFor(() => expect(moderatePost).toHaveBeenCalledWith(expect.objectContaining({ action: "delete" })));
    expect(await screen.findByRole("heading", { name: /Recently deleted/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Privacy and takedown requests/ })).not.toBeInTheDocument();
  });

  it("reports a refused action against the memory it concerns, and changes nothing", async () => {
    moderatePost.mockResolvedValue({ status: "error", message: "The server refused that." });
    renderPage();

    await screen.findByRole("heading", { name: /On the wall/ });
    const card = cardFor("Four days of sea air and we already want to come back.");
    fireEvent.click(within(card).getByRole("button", { name: "Pin to the top" }));

    expect(await within(card).findByRole("alert")).toHaveTextContent("The server refused that.");
    // Still on the wall, and still offering the action that failed.
    expect(within(card).getByRole("button", { name: "Pin to the top" })).toBeInTheDocument();
  });

  it("offers nothing on a memory DigiStayBook has taken out of the Host's hands", async () => {
    listWallPosts.mockResolvedValue({
      status: "ok",
      value: [post({ id: "memory-3", message: "Held by us.", visibility: "restricted" })]
    });
    renderPage();

    await screen.findByText("Held by us.");
    const card = within(cardFor("Held by us."));
    expect(card.queryByRole("button")).not.toBeInTheDocument();
    expect(card.getByText(/Trust & Safety team is reviewing it/)).toBeInTheDocument();
  });

  it("reports a wall it could not read rather than showing an empty one", async () => {
    listWallPosts.mockResolvedValue({ status: "error", message: "We could not reach the database." });
    renderPage();

    expect(await screen.findByText(/could not read this wall/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /On the wall/ })).not.toBeInTheDocument();
  });

  it("says plainly when a wall has nothing on it yet", async () => {
    listWallPosts.mockResolvedValue({ status: "ok", value: [] });
    renderPage();

    expect(await screen.findByText(/Nothing on this wall yet/)).toBeInTheDocument();
  });

  it("asks before escalating, because an escalation cannot be taken back", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /On the wall/ });
    fireEvent.click(
      within(cardFor("Four days of sea air and we already want to come back.")).getByRole("button", {
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

    await screen.findByRole("heading", { name: /On the wall/ });
    fireEvent.click(
      within(cardFor("Four days of sea air and we already want to come back.")).getByRole("button", {
        name: "Take off the wall"
      })
    );

    expect(await screen.findByText("Taken off the wall.")).toBeInTheDocument();
    expect(
      within(cardFor("Four days of sea air and we already want to come back.")).getByText("Off the wall")
    ).toBeInTheDocument();
  });

  it("refuses a property owned by another host account, and never reads its wall", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ ownerUid: "host-b" }) });
    renderPage();

    expect(await screen.findByText(/belongs to another host account/i)).toBeInTheDocument();
    await waitFor(() => expect(listWallPosts).not.toHaveBeenCalled());
  });
});
