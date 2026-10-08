import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostQrPage } from "./HostQrPage";
import { emptyProfile } from "../../domain/propertyProfile";
import type { HostProperty } from "../host/propertyStore";

vi.mock("../../lib/firebaseConfig", () => ({
  firebaseConfig: {},
  firebaseConfigured: true
}));

const loadProperty = vi.fn();
const ensureStayToken = vi.fn();
const callable = vi.fn();

vi.mock("../../lib/firebase", () => ({ getFirebaseServices: async () => ({ functions: {} }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: (_functions: unknown, name: string) => (data: unknown) => callable(name, data) }));

vi.mock("../host/propertyStore", () => ({
  loadProperty: (...args: unknown[]) => loadProperty(...args),
  ensureStayToken: (...args: unknown[]) => ensureStayToken(...args)
}));

/** A guestbook token as the server mints them: 16 random bytes, base64url. */
const TOKEN = "Kx7tQ2mN4pR8sV1wY3zB5c";

function hostProperty(overrides: Partial<HostProperty> = {}): HostProperty {
  return {
    id: "prop-1",
    ownerUid: "host-a",
    name: "Seabreeze Cottage",
    slug: "seabreeze-cottage",
    lifecycle: "active",
    mode: "live",
    foundationalPostCount: 3,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
    stayToken: TOKEN,
    billing: { trialEndsAt: null, currentPeriodEndsAt: "2026-10-01T00:00:00.000Z", lastPaymentAt: null, renewalAmount: null, renewalCurrency: null, renewalInterval: null },
    profile: emptyProfile(),
    ...overrides
  };
}

const hostSession = { status: "host", user: { uid: "host-a", email: "host@example.com" } } as unknown as AuthState;

function renderPage(state: AuthState = hostSession) {
  return render(
    <AuthContext.Provider value={state}>
      <HostQrPage propertyId="prop-1" />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  loadProperty.mockResolvedValue({ status: "ok", value: hostProperty() });
  ensureStayToken.mockResolvedValue({ status: "ok", value: TOKEN });
  callable.mockImplementation(async (name: string) => name === "listHostGuestReview"
    ? { data: { posts: [], feedback: [], reviewContent: false } }
    : { data: { reviewContent: true } });
});

const main = () => within(document.querySelector(".property-shell-main") as HTMLElement);
const nav = () => within(screen.getByRole("navigation", { name: "This property" }));

describe("walls and QR display", () => {
  it("names both walls, their addresses, and the way into each", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });

    expect(main().getByText(`${window.location.origin}/wall/seabreeze-cottage`)).toBeInTheDocument();
    expect(main().getAllByText(`${window.location.origin}/stay/seabreeze-cottage/${TOKEN}`)[0]).toBeInTheDocument();
    expect(main().getByRole("link", { name: "Open the public wall" })).toHaveAttribute(
      "href",
      "/wall/seabreeze-cottage"
    );
    expect(main().getByRole("link", { name: "Open the in-stay wall" })).toHaveAttribute(
      "href",
      `/stay/seabreeze-cottage/${TOKEN}`
    );
    expect(main().getByRole("link", { name: "Configure the in-stay wall" })).toHaveAttribute("href", "/host/property/prop-1");
    expect(main().getByRole("link", { name: "Configure the public wall" })).toHaveAttribute("href", "/host/property/prop-1/public");
    const guestLink = document.querySelector(".qr-page-kit .qr-guest-link a");
    expect(guestLink).toHaveAttribute("href", `${window.location.origin}/stay/seabreeze-cottage/${TOKEN}`);
    // The link a Host already has is the link they keep: nothing is minted
    // over a property that carries a token, because a placard is printed from
    // it and an address that moves is a card that scans to nothing.
    expect(ensureStayToken).not.toHaveBeenCalled();
    const approval = await main().findByRole("checkbox", { name: "Require approval for new memories" });
    expect(approval).not.toBeChecked();
    fireEvent.click(approval);
    await waitFor(() => expect(approval).toBeChecked());
    expect(callable).toHaveBeenCalledWith("setGuestReviewPolicy", { propertyId: "prop-1", reviewContent: true });
    expect(main().getByRole("link", { name: "Review waiting memories" })).toHaveAttribute("href", "/host/property/prop-1/moderation#new-memories");
    expect(main().queryByRole("heading", { name: "New memories" })).not.toBeInTheDocument();
  });

  // The guestbook link is the slug and a secret the server mints. A property
  // made before there were any carries no secret, and its placard would scan
  // to the public wall — so the one screen that shows the link is the one that
  // asks for a token, and the address on the card carries it from that moment.
  it("mints a guestbook token for a property that has none", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ stayToken: null }) });
    renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });

    expect(ensureStayToken).toHaveBeenCalledWith("prop-1");
    expect(await main().findByRole("link", { name: "Open the in-stay wall" })).toHaveAttribute(
      "href",
      `/stay/seabreeze-cottage/${TOKEN}`
    );
  });

  it("keeps an unpublished property's addresses in view without offering a way in", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ lifecycle: "draft", mode: "sandbox" })
    });
    renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });

    // The address is still stated: it is fixed at creation, and a Host writing
    // towards publication should be able to see where the wall will be.
    expect(main().getByText(`${window.location.origin}/wall/seabreeze-cottage`)).toBeInTheDocument();
    expect(main().queryByRole("link", { name: "Open the public wall" })).not.toBeInTheDocument();
    expect(main().queryByRole("link", { name: "Open the in-stay wall" })).not.toBeInTheDocument();
    expect(main().getByText("Not published yet")).toBeInTheDocument();
    expect(main().getByRole("link", { name: "Configure the in-stay wall" })).toBeInTheDocument();
    expect(main().getByRole("link", { name: "Configure the public wall" })).toBeInTheDocument();
  });

  it("locks printing until the subscription is running, and says so either way", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ lifecycle: "draft", mode: "sandbox" })
    });
    const { unmount } = renderPage();
    expect(await screen.findByText(/Printing unlocks with an active trial or subscription/i)).toBeInTheDocument();
    unmount();

    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty() });
    renderPage();
    expect(await screen.findByRole("button", { name: "Print placard" })).toBeInTheDocument();
  });

  // A Host deciding whether to pay for a property is deciding whether to hang
  // this card in their hallway, so the card is on the screen before the
  // subscription is, and it carries the real code rather than a stand-in.
  it("draws the placard, and its real code, before the kit is printable", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ lifecycle: "draft", mode: "sandbox" })
    });
    renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });

    const address = `${window.location.host}/stay/seabreeze-cottage/${TOKEN}`;
    expect(main().getByRole("img", { name: `QR code for ${address}` })).toBeInTheDocument();
    // Printed under the code for a guest whose camera will not focus.
    expect(main().getByText(address)).toBeInTheDocument();
    expect(main().getByText("Seabreeze Cottage", { selector: ".placard-name" })).toBeInTheDocument();
    // ...and it is honest about where a scan lands while nothing is served.
    expect(main().getByText(/This QR code leads to an offline wall/i)).toBeInTheDocument();
  });

  it("stops saying a scan reaches nobody once the wall is served", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });

    expect(main().getByRole("img", { name: /^QR code for/ })).toBeInTheDocument();
    expect(main().queryByText(/This QR code leads to an offline wall/i)).not.toBeInTheDocument();
  });

  it("stands in the property's nav as the screen you are on", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });

    expect(nav().getByText("Walls and QR display", { selector: "[aria-current]" })).toHaveAttribute("aria-current", "page");
    expect(nav().getByRole("link", { name: "Property view" })).toHaveAttribute("href", "/host/property/prop-1");
    expect(nav().getByRole("link", { name: "Moderation" })).toHaveAttribute(
      "href",
      "/host/property/prop-1/moderation"
    );
    expect(nav().getByRole("link", { name: "Billing" })).toHaveAttribute("href", "/host/property/prop-1/billing");
  });

  // Moving between a property's screens is a click, not a reload, and the four
  // of them are one property: reading it again in front of the Host blanked the
  // banner and the nav they had just clicked in.
  it("opens a property it has already read without blanking the screen", async () => {
    const { unmount } = renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });
    unmount();

    renderPage();
    // Deliberately not awaited: the property is on the screen in the first
    // render, and the second read runs behind it.
    expect(screen.getByRole("heading", { name: "Walls and QR display", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText("Fetching this property.")).not.toBeInTheDocument();

    await act(async () => {});
    expect(loadProperty).toHaveBeenCalledTimes(2);
  });

  it("keeps a property on the screen when a later read of it fails", async () => {
    const { unmount } = renderPage();
    await screen.findByRole("heading", { name: "Walls and QR display", level: 2 });
    unmount();

    loadProperty.mockResolvedValue({ status: "error", message: "You do not have access to that property." });
    renderPage();
    await act(async () => {});

    expect(screen.getByRole("heading", { name: "Walls and QR display", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText("You do not have access to that property.")).not.toBeInTheDocument();
  });

  it("refuses to render a property owned by another host account", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ ownerUid: "host-b" }) });
    renderPage();

    expect(await screen.findByText(/belongs to another host account/i)).toBeInTheDocument();
    expect(screen.queryByText("/wall/seabreeze-cottage")).not.toBeInTheDocument();
  });

  it("distinguishes a missing property from a failed read", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: null });
    const { unmount } = renderPage();
    expect(await screen.findByRole("heading", { name: "Property not found" })).toBeInTheDocument();
    unmount();

    loadProperty.mockResolvedValue({ status: "error", message: "You do not have access to that property." });
    renderPage();
    expect(await screen.findByText("You do not have access to that property.")).toBeInTheDocument();
  });
});
