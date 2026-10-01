import { fireEvent, render, screen, within } from "@testing-library/react";
import { LiveWallPage } from "./LiveWallPage";
import { GuestWallPage } from "./GuestWallPage";
import { StayWallPage } from "./StayWallPage";
const call = vi.fn();
const auth = vi.hoisted(() => ({ status: "signed-out", user: null as null | { uid: string } }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("../guest/GuestContribution", () => ({ GuestContribution: ({ mode }: { mode?: string }) => <div>Guest contribution form{mode === "feedback" ? " (feedback)" : ""}</div> }));
// Which Firebase app asked is the point of the split below, so the mocks are
// told apart rather than both answering `{}`.
const asked = vi.hoisted(() => ({ app: "" }));
vi.mock("../../lib/firebase", () => ({
  getFirebaseServices: async () => ({ functions: { app: "default" } }),
  wallReaderFunctions: async () => ({ app: "wall-reader" })
}));
vi.mock("firebase/functions", () => ({ httpsCallable: (functions: { app: string }) => { asked.app = functions.app; return call; } }));

beforeEach(() => { call.mockReset(); asked.app = ""; auth.status = "signed-out"; auth.user = null; });

it("reads a guest's wall through the app that carries no attestation", async () => {
  call.mockResolvedValue({ data: { status: "open", property: { name: "Real cottage", welcome: "", hosts: "", location: "" }, posts: [], nextCursor: null } });
  render(<LiveWallPage slug="real-cottage" />);
  await screen.findByRole("heading", { name: "Real cottage" });
  // `getPublicWall` is the one callable without `enforceAppCheck`, and a guest
  // who waits for a reCAPTCHA token the server ignores waits for nothing.
  expect(asked.app).toBe("wall-reader");
});

it("reads a signed-in host's wall through their own app, so a closed wall still previews", async () => {
  auth.status = "host";
  auth.user = { uid: "owner" };
  call.mockResolvedValue({ data: { status: "preview", property: { name: "Real cottage", welcome: "", hosts: "", location: "" }, posts: [], nextCursor: null } });
  render(<LiveWallPage slug="real-cottage" />);
  await screen.findByRole("heading", { name: "Real cottage" });
  // The owner preview is resolved from the uid on the request; an
  // unauthenticated app has none to send.
  expect(asked.app).toBe("default");
});
it.each(["public", "stay"] as const)("opens the %s route with its own content and API view", async view => {
  call.mockResolvedValue({ data: { status: "open", contributionsEnabled: true, property: {
    name: "Real cottage", welcome: "Welcome", hosts: "Host", location: "Coast",
    guestPrompt: "Leave a memory", houseInformation: { heading: "Arrival instructions", welcome: "Welcome inside", tip: "", facts: [] }
  }, posts: [], nextCursor: null } });
  render(view === "stay" ? <StayWallPage propertySlug="real-cottage" /> : <GuestWallPage propertySlug="real-cottage" />);
  await screen.findByRole("heading", { name: "Real cottage" });
  expect(call).toHaveBeenCalledWith({ slug: "real-cottage", view });
  if (view === "stay") {
    expect(screen.getByRole("region", { name: "A note from your hosts" })).toBeInTheDocument();
    // The public welcome belongs to the shared wall; a guest holding the
    // placard reads the arrival note instead.
    expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
    expect(screen.getByText("Welcome inside")).toBeInTheDocument();
    expect(screen.queryByText("Guest contribution form")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a memory" }));
    expect(screen.getByText("Guest contribution form")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to wall" }));
    expect(screen.getByText("Guest contribution form")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add a memory" }));
    expect(screen.getByText("Guest contribution form")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to wall" }));
    // Private feedback is offered by name and opens the form on that choice.
    fireEvent.click(screen.getByRole("button", { name: "Private feedback" }));
    expect(screen.getByText("Guest contribution form (feedback)")).toBeVisible();
  } else {
    expect(screen.queryByRole("region", { name: "A note from your hosts" })).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome inside")).not.toBeInTheDocument();
    expect(screen.queryByText("Guest contribution form")).not.toBeInTheDocument();
    expect(screen.queryByText("Leave a memory")).not.toBeInTheDocument();
  }
});
it.each([null, { url: "https://x.test/host.jpg", alt: "Ana and Tom" }])("shows the uploaded host portrait when present: %j", async (hostPhoto) => {
  call.mockResolvedValue({ data: { status: "open", property: {
    name: "Real cottage", welcome: "Welcome", hosts: "Ana & Tom", location: "Coast", hostPhoto
  }, posts: [], nextCursor: null } });
  render(<LiveWallPage slug="real-cottage" />);
  await screen.findByRole("heading", { name: "Real cottage" });
  const portrait = screen.queryByRole("img", { name: "Ana and Tom" });
  if (hostPhoto) {
    expect(portrait).toHaveAttribute("src", hostPhoto.url);
    expect(portrait?.closest("header")).toHaveTextContent("Ana & Tom");
  } else {
    expect(portrait).not.toBeInTheDocument();
    // Names without a photograph still sign the wall: initials stand in.
    expect(document.querySelector(".host-byline")).toHaveTextContent("Ana & Tom");
  }
});
it("shows unavailable addresses without substituting a demo", async () => {
  call.mockResolvedValue({ data: { status: "unavailable" } });
  render(<LiveWallPage slug="missing-property" />);
  expect(await screen.findByRole("heading", { name: "This guestbook isn’t open to visitors" })).toBeInTheDocument();
  expect(screen.queryByText("Seabreeze Cottage")).not.toBeInTheDocument();
});
it("draws the hosts' own notes as the wall draws them, each fixed the way they chose", async () => {
  const property = {
    name: "Real cottage", welcome: "Welcome", hosts: "Ana & Tom", location: "Coast",
    hostNotes: [
      { id: "fire", message: "We lay the fire.", style: "bordered", photo: { url: "https://x.test/f.jpg", alt: "A log fire" } },
      { id: "bench", message: "The bench gets the sun.", style: "pinned", photo: null }
    ]
  };
  call.mockResolvedValue({ data: { status: "open", property, posts: [], nextCursor: null } });
  render(<LiveWallPage slug="real-cottage" />);
  const notes = await screen.findByRole("complementary", { name: /More from Ana & Tom/i });
  expect(notes).toHaveTextContent("We lay the fire.");
  expect(notes).toHaveTextContent("The bench gets the sun.");
  // The wall says how each is fixed, so the stylesheet can draw the two.
  expect([...notes.querySelectorAll(".host-note")].map(note => note.getAttribute("data-note-style")))
    .toEqual(["bordered", "pinned"]);
  expect(screen.getByRole("img", { name: "A log fire" })).toHaveAttribute("src", "https://x.test/f.jpg");
});
it("renders server content and loads the next page without duplicating memories", async () => {
  const property = { name: "Real cottage", welcome: "Welcome", hosts: "Host", location: "Coast", hostNotes: [] };
  call.mockResolvedValueOnce({ data: { status: "open", property, posts: [{ id: "1", message: "First memory" }], nextCursor: "1" } });
  call.mockResolvedValueOnce({ data: { status: "open", property, posts: [{ id: "1", message: "First memory" }, { id: "2", message: "Second memory" }], nextCursor: null } });
  render(<LiveWallPage slug="real-cottage" />);
  expect(await screen.findByRole("heading", { name: "Real cottage" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load more memories" }));
  expect(await screen.findByText("Second memory")).toBeInTheDocument();
  expect(screen.getAllByText("First memory")).toHaveLength(1);
  expect(call).toHaveBeenLastCalledWith({ slug: "real-cottage", view: "public", cursor: "1" });
});

/* The token is the half of the guestbook link that reaches the in-stay wall.
   The page carries it rather than checking it: what a caller without one gets
   is the public wall, and that is the server's decision, not this page's. */
it("sends the guestbook token with the wall it asks for", async () => {
  const token = "Kx7tQ2mN4pR8sV1wY3zB5c";
  call.mockResolvedValue({ data: { status: "open", property: {
    name: "Cottage", welcome: "Welcome", hosts: "Host", location: "Coast", guestPrompt: "", hostNotes: [],
    houseInformation: { heading: "Arrival", welcome: "Welcome inside", tip: "", facts: [] }
  }, posts: [], nextCursor: null } });
  render(<StayWallPage propertySlug="cottage" stayToken={token} />);
  await screen.findByRole("heading", { name: "Cottage" });
  expect(call).toHaveBeenCalledWith({ slug: "cottage", view: "stay", token });
});

it("asks without a token when the link carries none, rather than sending an empty one", async () => {
  call.mockResolvedValue({ data: { status: "open", property: {
    name: "Cottage", welcome: "Welcome", hosts: "Host", location: "Coast", guestPrompt: "", hostNotes: [],
    houseInformation: { heading: "Arrival", welcome: "Welcome inside", tip: "", facts: [] }
  }, posts: [], nextCursor: null } });
  render(<StayWallPage propertySlug="cottage" />);
  await screen.findByRole("heading", { name: "Cottage" });
  expect(call).toHaveBeenCalledWith({ slug: "cottage", view: "stay" });
});

/* A guestbook link forwarded without its token, or typed from the listing
   address, reaches the in-stay route and is served the public wall: the server
   returns no house information at all. The page used to draw the in-stay
   arrangement over that answer, so the arrival note and the essentials were
   simply missing and a Host checking their own wall saw their words gone. */
it("draws the public wall when the server served one, whatever route asked", async () => {
  call.mockResolvedValue({ data: { status: "open", contributionsEnabled: false, property: {
    name: "Cottage", welcome: "Welcome", hosts: "Ana & Mike", location: "Coast", guestPrompt: "", hostNotes: [],
    houseInformation: null
  }, posts: [], nextCursor: null } });
  render(<StayWallPage propertySlug="cottage" />);
  await screen.findByRole("heading", { name: "Cottage" });
  // The public welcome, which the in-stay wall never shows, and no half-drawn
  // note left standing with nothing in it but the hosts' signature.
  expect(screen.getByText("Welcome")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "A note from your hosts" })).not.toBeInTheDocument();
  expect(document.querySelector(".stay-welcome")).not.toBeInTheDocument();
  expect(document.querySelector(".essentials")).not.toBeInTheDocument();
  // And no in-stay furniture around the memories either.
  expect(screen.queryByText(/New contributions are not available yet/)).not.toBeInTheDocument();
  expect(document.querySelector("[data-wall-view]")).toHaveAttribute("data-wall-view", "public");
});

it("does not offer a retry while the initial wall request is still loading", () => {
  call.mockReturnValue(new Promise(() => {}));
  render(<LiveWallPage slug="cottage" />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading this guestbook");
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
});

it("shows verified owners the cause and property-specific recovery links", async () => {
  auth.status = "host"; auth.user = { uid: "owner" };
  call.mockResolvedValue({ data: { status: "unavailable", owner: { propertyId: "p-1", lifecycle: "draft", mode: "sandbox", publicWallOff: false } } });
  render(<LiveWallPage slug="cottage" view="stay" />);
  await screen.findByRole("heading", { name: "Not published yet" });
  expect(screen.getByRole("link", { name: "Choose a plan and publish" })).toHaveAttribute("href", "/host/property/p-1/billing");
  expect(screen.getByRole("link", { name: "Edit this wall" })).toHaveAttribute("href", "/host/property/p-1");
});
it("does not show management links to another signed-in host", async () => {
  auth.status = "host"; auth.user = { uid: "other" };
  call.mockResolvedValue({ data: { status: "unavailable" } });
  render(<LiveWallPage slug="cottage" />);
  await screen.findByRole("heading", { name: "This guestbook isn’t open to visitors" });
  expect(screen.queryByRole("link", { name: "Edit this wall" })).not.toBeInTheDocument();
});
it("removes owner details when the signed-in account changes", async () => {
  auth.status = "host"; auth.user = { uid: "owner" };
  call.mockResolvedValueOnce({ data: { status: "unavailable", owner: { propertyId: "p-1", lifecycle: "suspended", mode: "live", publicWallOff: false } } });
  const page = render(<LiveWallPage slug="cottage" />);
  await screen.findByRole("heading", { name: "Subscription suspended" });
  auth.user = { uid: "other" }; call.mockResolvedValue({ data: { status: "unavailable" } });
  page.rerender(<LiveWallPage slug="cottage" />);
  expect(screen.queryByRole("link", { name: "Review billing" })).not.toBeInTheDocument();
  await screen.findByRole("heading", { name: "This guestbook isn’t open to visitors" });
});

describe("an owner previewing their own closed wall", () => {
  const property = { name: "Real cottage", welcome: "Welcome", hosts: "Ana & Tom", location: "Coast", hostNotes: [] };
  const preview = { status: "preview", contributionsEnabled: false,
    owner: { propertyId: "p-1", lifecycle: "draft", mode: "sandbox", publicWallOff: false },
    property, posts: [{ id: "1", message: "First memory", displayName: "A guest" }], nextCursor: null };
  beforeEach(() => { auth.status = "host"; auth.user = { uid: "owner" }; });

  it("shows the wall itself, said plainly to be closed to everyone else", async () => {
    call.mockResolvedValue({ data: preview });
    render(<LiveWallPage slug="cottage" view="stay" />);
    await screen.findByRole("heading", { name: "Real cottage" });
    expect(screen.getByText("First memory")).toBeInTheDocument();
    const banner = screen.getByRole("complementary", { name: "Preview of a closed wall" });
    expect(banner).toHaveTextContent("Not published yet");
    expect(banner).toHaveTextContent(/Only you can see this. Guests get a closed notice./);
    expect(screen.getByRole("link", { name: "Choose a plan and publish" })).toHaveAttribute("href", "/host/property/p-1/billing");
    expect(screen.getByRole("link", { name: "Edit this wall" })).toHaveAttribute("href", "/host/property/p-1");
  });

  it("offers no way for a guest to contribute to a closed in-stay wall", async () => {
    call.mockResolvedValue({ data: preview });
    render(<LiveWallPage slug="cottage" view="stay" />);
    await screen.findByRole("heading", { name: "Real cottage" });
    expect(screen.queryByRole("button", { name: "Add a memory" })).not.toBeInTheDocument();
    expect(screen.getByText(/The add-a-memory button appears here once this wall is open/)).toBeInTheDocument();
  });

  it("swaps the wall for the notice a guest would get, and back again", async () => {
    call.mockResolvedValue({ data: preview });
    render(<LiveWallPage slug="cottage" view="stay" />);
    await screen.findByRole("heading", { name: "Real cottage" });
    fireEvent.click(screen.getByRole("button", { name: "Guest's view" }));
    const notice = screen.getByRole("region", { name: "This guestbook isn’t open to visitors" });
    expect(screen.queryByRole("heading", { name: "Real cottage" })).not.toBeInTheDocument();
    expect(screen.queryByText("First memory")).not.toBeInTheDocument();
    // What the guest reads is what a guest would be served: no lifecycle, no
    // management ID, no recovery links. Only the owner's own bar keeps those.
    expect(notice).toHaveTextContent(/The QR code you scanned points at a guestbook the host has not opened yet/);
    expect(within(notice).queryByRole("link", { name: "Choose a plan and publish" })).not.toBeInTheDocument();
    expect(within(notice).queryByRole("link", { name: "Edit this wall" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to your preview" }));
    expect(await screen.findByRole("heading", { name: "Real cottage" })).toBeInTheDocument();
  });
});

it("tells a guest that a wall it could not reach is a connection problem, not a closed wall", async () => {
  call.mockRejectedValue(new Error("offline"));
  render(<LiveWallPage slug="cottage" view="stay" />);
  await screen.findByRole("heading", { name: "This guestbook didn’t load" });
  expect(screen.getByRole("status")).toHaveTextContent("Check your connection and try again");
  // Not the closed notice: a wall that failed to answer has not said it is shut.
  expect(screen.queryByRole("heading", { name: "This guestbook isn’t open to visitors" })).not.toBeInTheDocument();
  call.mockResolvedValue({ data: { status: "open", property: { name: "Real cottage", welcome: "", hosts: "", location: "" }, posts: [], nextCursor: null } });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Real cottage" })).toBeInTheDocument();
});

describe("what a preview says about a wall that is mostly empty", () => {
  const bare = {
    status: "preview", contributionsEnabled: false,
    owner: { propertyId: "p-1", lifecycle: "draft", mode: "sandbox", publicWallOff: false },
    property: { name: "sdssds", welcome: "", hosts: "", location: "", hostNotes: [] },
    posts: [], nextCursor: null
  };
  beforeEach(() => { auth.status = "host"; auth.user = { uid: "owner" }; });

  it("names each gap once, and marks where on the page it would sit", async () => {
    call.mockResolvedValue({ data: bare });
    render(<LiveWallPage slug="cottage" view="stay" />);
    await screen.findByRole("heading", { name: "sdssds" });
    const gaps = screen.getByRole("region", { name: /things left before this reads like a wall/ });
    expect(within(gaps).getAllByRole("link").map(link => link.textContent))
      .toEqual(["Add a cover photo", "Write an arrival note", "Add the essentials"]);
    expect(screen.getByText(/No cover photo/)).toBeInTheDocument();
    expect(screen.getByText(/No arrival note/)).toBeInTheDocument();
    expect(screen.getByText(/No house essentials/)).toBeInTheDocument();
  });

  it("counts only what the chosen wall would actually show", async () => {
    call.mockResolvedValue({ data: bare });
    render(<LiveWallPage slug="cottage" view="public" />);
    await screen.findByRole("heading", { name: "sdssds" });
    // The public wall carries no house guidance, so it is never missing any.
    expect(screen.getByRole("region", { name: "2 things left before this reads like a wall" })).toBeInTheDocument();
    expect(screen.queryByText(/No house essentials/)).not.toBeInTheDocument();
  });

  it("says nothing about gaps on a wall that is open, even a bare one", async () => {
    call.mockResolvedValue({ data: { ...bare, status: "open", owner: undefined } });
    render(<LiveWallPage slug="cottage" view="stay" />);
    await screen.findByRole("heading", { name: "sdssds" });
    expect(screen.queryByRole("region", { name: /things left/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/No cover photo/)).not.toBeInTheDocument();
    // An absent field leaves nothing behind on a guest's wall, not an empty line.
    expect(document.querySelector(".stay-cover")?.querySelectorAll("p")).toHaveLength(0);
    expect(document.querySelector(".stay-welcome")).not.toBeInTheDocument();
  });

  it("leaves the checklist out once the wall is furnished", async () => {
    call.mockResolvedValue({ data: { ...bare, property: {
      ...bare.property, welcome: "The kettle is on.", cover: { url: "https://x.test/c.jpg", alt: "The cottage" },
      houseInformation: { heading: "", welcome: "", tip: "", facts: [{ term: "Wi-Fi", detail: "Guest", note: "" }] }
    } } });
    render(<LiveWallPage slug="cottage" view="stay" />);
    await screen.findByRole("heading", { name: "sdssds" });
    expect(screen.queryByRole("region", { name: /things left/ })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "The cottage" })).toBeInTheDocument();
  });
});
