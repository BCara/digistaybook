import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostWallDesignPage } from "./HostWallDesignPage";
import { defaultCover, emptyProfile, exampleNote, normalizeProfile, type HostNote, type PropertyProfile } from "../../domain/propertyProfile";
import type { HostProperty } from "../host/propertyStore";

vi.mock("../../lib/firebaseConfig", () => ({
  firebaseConfig: {},
  firebaseConfigured: true
}));

const loadProperty = vi.fn();
const loadWallCounts = vi.fn();
const savePropertyName = vi.fn();
const savePropertyProfile = vi.fn();
const uploadPropertyPhoto = vi.fn();
const removePropertyPhoto = vi.fn();
const loadPreviewMemories = vi.fn();

vi.mock("../host/wallPreviewStore", () => ({
  loadPreviewMemories: (...args: unknown[]) => loadPreviewMemories(...args)
}));

vi.mock("../host/propertyStore", () => ({
  loadProperty: (...args: unknown[]) => loadProperty(...args),
  loadWallCounts: (...args: unknown[]) => loadWallCounts(...args),
  savePropertyName: (...args: unknown[]) => savePropertyName(...args),
  savePropertyProfile: (...args: unknown[]) => savePropertyProfile(...args),
  uploadPropertyPhoto: (...args: unknown[]) => uploadPropertyPhoto(...args),
  removePropertyPhoto: (...args: unknown[]) => removePropertyPhoto(...args)
}));

const coverPhoto = {
  path: "properties/prop-1/media/cover-1.jpg",
  url: "https://example.test/cover.jpg",
  alt: "The granite front of the cottage",
  width: 1500,
  height: 660
};

function profile(overrides: Partial<PropertyProfile> = {}): PropertyProfile {
  return { ...emptyProfile(), ...overrides };
}

/** One of the hosts' notes, as a property that has written one carries it. */
const hostNote = (overrides: Partial<HostNote> = {}): HostNote => ({
  id: "fire",
  message: "We lay the fire before every arrival.",
  style: "bordered",
  photo: null,
  ...overrides
});

const filledProfile = profile({
  location: "St Anthony Head, Cornwall",
  welcome: "The wall our guests leave behind.",
  hosts: "Ana & Tom",
  hostSince: "2019",
  stayHeading: "Welcome to the cottage",
  stayWelcome: "The kettle is on the side.",
  stayTip: "The bakery behind the lighthouse.",
  facts: [{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "On the fridge magnet" }],
  cover: coverPhoto
});

function hostProperty(overrides: Partial<HostProperty> = {}): HostProperty {
  return {
    id: "prop-1",
    ownerUid: "host-a",
    name: "Seabreeze Cottage",
    slug: "seabreeze-cottage",
    stayToken: "AbCdEfGhIjKlMnOpQrStUv",
    lifecycle: "active",
    mode: "live",
    foundationalPostCount: 3,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
    billing: { trialEndsAt: null, currentPeriodEndsAt: "2026-10-01T00:00:00.000Z", lastPaymentAt: null, renewalAmount: null, renewalCurrency: null, renewalInterval: null },
    profile: profile(),
    ...overrides
  };
}

const hostSession = { status: "host", user: { uid: "host-a", email: "host@example.com" } } as unknown as AuthState;

function renderPage(state: AuthState = hostSession) {
  return render(
    <AuthContext.Provider value={state}>
      <HostWallDesignPage propertyId="prop-1" />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  loadPreviewMemories.mockResolvedValue({ status: "ok", value: { posts: [], nextCursor: null } });
  loadProperty.mockResolvedValue({ status: "ok", value: hostProperty() });
  loadWallCounts.mockResolvedValue({ status: "ok", value: { visible: 12, hidden: 1 } });
  savePropertyName.mockImplementation((_id: string, name: string) =>
    Promise.resolve({ status: "ok", value: { name } })
  );
  savePropertyProfile.mockImplementation((_id: string, saved: PropertyProfile) =>
    Promise.resolve({ status: "ok", value: saved })
  );
  uploadPropertyPhoto.mockResolvedValue({ status: "ok", value: coverPhoto });
  removePropertyPhoto.mockResolvedValue({ status: "ok", value: null });
});

const canvas = (name = "Guest wall") => within(screen.getByRole("form", { name }));
const save = () => canvas().getByRole("button", { name: "Save changes" });

describe("switching the phone editor between Edit and Preview", () => {
  let resize: (width: number) => void;
  beforeEach(() => {
    let width = 393;
    const queries = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
    const matches = (query: string) => width <= Number(query.match(/max-width: (\d+)px/)?.[1] ?? 0);
    vi.stubGlobal("matchMedia", (query: string) => {
      let list = queries.get(query);
      if (!list) {
        list = { matches: matches(query), listeners: new Set() };
        queries.set(query, list);
      }
      return {
        get matches() { return list.matches; }, media: query,
        addEventListener: (_event: string, listener: () => void) => list.listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => list.listeners.delete(listener),
      };
    });
    vi.stubGlobal("scrollTo", vi.fn());
    resize = next => {
      width = next;
      queries.forEach((list, query) => {
        const nextMatches = matches(query);
        if (nextMatches !== list.matches) {
          list.matches = nextMatches;
          list.listeners.forEach(listener => listener());
        }
      });
    };
  });
  afterEach(() => vi.unstubAllGlobals());

  async function editWall() {
    fireEvent.click(await screen.findByRole("button", { name: "Edit the wall" }));
  }

  it("lets a host review empty recommended sections, retaining green checks when reopened", async () => {
    const page = renderPage();
    const rows = () => within(screen.getByRole("navigation", { name: "Guest wall sections" }));
    await screen.findByRole("navigation", { name: "Guest wall sections" });
    expect(rows().getAllByRole("button").every(button => button.dataset.state === "todo")).toBe(true);
    for (const section of [/Property details/, /Welcome & hosts/, /Wi-Fi and essentials/, /More notes/, /Stay with us again/, /Look & feel/]) {
      fireEvent.click(rows().getByRole("button", { name: section }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(rows().getByRole("button", { name: section })).toHaveAttribute("data-state", "done");
    }
    const stored = normalizeProfile(savePropertyProfile.mock.calls.at(-1)![1]);
    expect(stored.reviewedSections).toEqual(["property", "welcome", "essentials", "notes", "links", "style"]);
    expect(stored.location).toBe(""); expect(stored.stayWelcome).toBe(exampleNote.welcome); expect(stored.facts).toEqual([]);
    page.unmount();
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: stored }) });
    renderPage();
    await waitFor(() => expect(rows().getAllByRole("button").every(button => button.dataset.state === "done")).toBe(true));
  });

  it("does not mark a section reviewed when it is cancelled or the save fails", async () => {
    renderPage();
    const rows = within(await screen.findByRole("navigation", { name: "Guest wall sections" }));
    fireEvent.click(rows.getByRole("button", { name: /Welcome & hosts/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(rows.getByRole("button", { name: /Welcome & hosts/ })).toHaveAttribute("data-state", "todo");
    expect(savePropertyProfile).not.toHaveBeenCalled();
    savePropertyProfile.mockResolvedValue({ status: "error", message: "Connection lost." });
    fireEvent.click(rows.getByRole("button", { name: /Welcome & hosts/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Connection lost.")).toBeInTheDocument();
    expect(rows.getByRole("button", { name: /Welcome & hosts/ })).toHaveAttribute("data-state", "todo");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens sections on desktop immediately after property creation", async () => {
    window.history.replaceState(null, "", "/host/property/prop-1?setup=1");
    try {
      act(() => resize(1200));
      renderPage();
      expect(await screen.findByRole("navigation", { name: "Guest wall sections" })).toBeInTheDocument();
      expect(screen.queryByRole("form", { name: "Guest wall" })).not.toBeInTheDocument();
    } finally { window.history.replaceState(null, "", "/"); }
  });

  it("opens Manage on the checklist and returns there after section editing or guest preview", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    const sections = within(await screen.findByRole("navigation", { name: "Guest wall sections" }));
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(sections.getByRole("button", { name: /Property details/ })).toHaveAttribute("data-state", "todo");
    expect(sections.queryByRole("button", { name: /Welcome photo/ })).not.toBeInTheDocument();
    expect(sections.queryByRole("button", { name: /^Cover photo/ })).not.toBeInTheDocument();
    expect(sections.getByRole("button", { name: /Stay with us again/ })).toBeInTheDocument();
    fireEvent.click(sections.getByRole("button", { name: /Welcome & hosts/ }));
    expect(screen.getByRole("dialog", { name: "Welcome & hosts" })).toBeVisible();
    expect(within(screen.getByRole("dialog")).getByLabelText("Welcome photo")).toBeInTheDocument();
    expect(screen.getByLabelText("Welcome message")).toHaveValue(filledProfile.stayWelcome);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "See guest view" }));
    expect(screen.getByRole("region", { name: "Guest preview" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to sections" }));
    expect(screen.getByRole("navigation", { name: "Guest wall sections" })).toBeVisible();
    expect(savePropertyProfile).not.toHaveBeenCalled();
  });

  it("saves from the checklist without switching to the wall and updates the section status", async () => {
    renderPage();
    const sections = within(await screen.findByRole("navigation", { name: "Guest wall sections" }));
    expect(sections.getByRole("button", { name: /Welcome & hosts/ })).toHaveAttribute("data-state", "todo");
    fireEvent.click(sections.getByRole("button", { name: /Welcome & hosts/ }));
    fireEvent.change(screen.getByLabelText("Your names"), { target: { value: "Ana & Tom" } });
    fireEvent.change(screen.getByLabelText("Welcome message"), { target: { value: "Welcome to the cottage." } });
    const photo = new File(["photo"], "hosts.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Welcome photo"), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(screen.getByRole("navigation", { name: "Guest wall sections" })).getByRole("button", { name: /Welcome & hosts/ })).toHaveAttribute("data-state", "done");
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(savePropertyProfile).toHaveBeenCalledTimes(1);
    expect(uploadPropertyPhoto).toHaveBeenCalledWith("prop-1", "hostPhoto", photo, expect.any(Function));
    expect(savePropertyProfile).toHaveBeenCalledWith("prop-1", expect.objectContaining({ hosts: "Ana & Tom", stayWelcome: "Welcome to the cottage.", hostPhoto: coverPhoto }));
  });

  it("saves a focused wall section once", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    const form = within(screen.getByRole("dialog", { name: "Property details" }));
    fireEvent.change(form.getByLabelText("Property name"), { target: { value: "Our beach cottage" } });
    fireEvent.change(form.getByLabelText("Address"), { target: { value: "12 Beach Road" } });
    expect(savePropertyName).not.toHaveBeenCalled();
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(savePropertyName).toHaveBeenCalledTimes(1);
    expect(savePropertyName).toHaveBeenCalledWith("prop-1", "Our beach cottage");
    expect(savePropertyProfile).toHaveBeenCalledWith("prop-1", expect.objectContaining({ location: "12 Beach Road", stayWelcome: filledProfile.stayWelcome }));
    expect(screen.getByRole("status")).toHaveTextContent("up to date");
    fireEvent.click(screen.getByRole("button", { name: "View as guest" }));
    const preview = within(screen.getByRole("region", { name: "Guest preview" }));
    expect(preview.getByRole("heading", { name: "Our beach cottage" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to editor" }));
    expect(screen.getByRole("button", { name: "Edit details" })).toBeVisible();
  });

  it("cancels a section without changing the wall or writing anything", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Edit welcome" }));
    const form = within(screen.getByRole("dialog", { name: "Welcome & hosts" }));
    fireEvent.change(form.getByLabelText("Welcome message"), { target: { value: "Discard this change" } });
    fireEvent.click(form.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Discard this change")).not.toBeInTheDocument();
    expect(savePropertyProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit welcome" }));
    expect(screen.getByLabelText("Welcome message")).toHaveValue(filledProfile.stayWelcome);
  });

  it("validates links, saves booking and mailing-list destinations, and previews both", async () => {
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Add links" }));
    const form = within(screen.getByRole("dialog", { name: "Stay with us again" }));
    fireEvent.click(form.getByRole("button", { name: "+ Book direct" }));
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    expect(await form.findAllByText(/Add the web address/)).not.toHaveLength(0);
    expect(savePropertyProfile).not.toHaveBeenCalled();
    fireEvent.change(form.getByLabelText("Web address"), { target: { value: "seaview.example/book" } });
    fireEvent.click(form.getByRole("button", { name: "+ Join our mailing list" }));
    fireEvent.change(form.getAllByLabelText("Web address")[1]!, { target: { value: "https://seaview.example/newsletter" } });
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(savePropertyProfile).toHaveBeenCalledTimes(1);
    expect(savePropertyProfile).toHaveBeenCalledWith("prop-1", expect.objectContaining({ stayAgainLinks: [
      { label: "Book direct", url: "seaview.example/book" },
      { label: "Join our mailing list", url: "https://seaview.example/newsletter" },
    ] }));
    fireEvent.click(screen.getByRole("button", { name: "View as guest" }));
    const preview = within(screen.getByRole("region", { name: "Guest preview" }));
    expect(preview.getByRole("link", { name: /Book direct/ })).toHaveAttribute("href", "https://seaview.example/book");
    expect(preview.getByRole("link", { name: /Join our mailing list/ })).toHaveAttribute("href", "https://seaview.example/newsletter");
  });

  it("keeps general links with the notes, apart from the ways back", async () => {
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Add links" }));
    expect(within(screen.getByRole("dialog", { name: "Stay with us again" })).queryByRole("button", { name: /Custom link/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit notes" }));
    const form = within(screen.getByRole("dialog", { name: "More from your hosts" }));
    fireEvent.click(form.getByRole("button", { name: "Add a link" }));
    fireEvent.change(form.getByLabelText("Button text"), { target: { value: "Our favourite walks" } });
    fireEvent.change(form.getByLabelText("Web address"), { target: { value: "walks.example/coast" } });
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(savePropertyProfile).toHaveBeenCalledWith("prop-1", expect.objectContaining({
      noteLinks: [{ label: "Our favourite walks", url: "walks.example/coast" }],
      stayAgainLinks: [],
    }));
    fireEvent.click(screen.getByRole("button", { name: "View as guest" }));
    const preview = within(screen.getByRole("region", { name: "Guest preview" }));
    expect(preview.getByRole("navigation", { name: "Useful links" })).toBeInTheDocument();
    expect(preview.getByRole("link", { name: /Our favourite walks/ })).toHaveAttribute("href", "https://walks.example/coast");
  });

  it("keeps failed saves open with the entered links ready to retry", async () => {
    savePropertyProfile.mockResolvedValueOnce({ status: "error", message: "Connection lost. Try again." });
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Add links" }));
    const form = within(screen.getByRole("dialog", { name: "Stay with us again" }));
    fireEvent.click(form.getByRole("button", { name: "+ Book direct" }));
    fireEvent.change(form.getByLabelText("Web address"), { target: { value: "https://seaview.example/book" } });
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    expect(await form.findByText("Connection lost. Try again.")).toBeInTheDocument();
    expect(form.getByLabelText("Web address")).toHaveValue("https://seaview.example/book");
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens a focused form from Sections and saves the look without a second save", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Sections" }));
    const sections = within(screen.getByRole("navigation", { name: "Guest wall sections" }));
    expect(sections.getByRole("button", { name: /Stay with us again/ })).toBeInTheDocument();
    fireEvent.click(sections.getByRole("button", { name: /Look & feel/ }));
    const form = within(screen.getByRole("dialog", { name: "Look & feel" }));
    fireEvent.click(form.getByRole("button", { name: /Warm Linen/ }));
    fireEvent.click(form.getByRole("radio", { name: "Playful" }));
    fireEvent.click(form.getByRole("radio", { name: "Berry" }));
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(savePropertyProfile).toHaveBeenCalledWith("prop-1", expect.objectContaining({ theme: "seaside", colour: "ocean" }));
  });
  it("uploads a selected cover only on save and retains it after the form closes", async () => {
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    const file = new File(["photo"], "cottage.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Cover photo", { selector: "input" }), { target: { files: [file] } });
    expect(uploadPropertyPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(uploadPropertyPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    fireEvent.change(screen.getByLabelText("Cover photo", { selector: "input" }), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(uploadPropertyPhoto).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".phone-wall-cover img")).toHaveAttribute("src", coverPhoto.url);
    expect(savePropertyProfile).toHaveBeenCalledWith("prop-1", expect.objectContaining({ reviewedSections: ["property"] }));
  });

  it("can retry a save after an unexpected connection rejection", async () => {
    savePropertyProfile.mockRejectedValueOnce(new Error("network disconnected"));
    renderPage();
    await editWall();
    fireEvent.click(await screen.findByRole("button", { name: "Edit welcome" }));
    fireEvent.change(screen.getByLabelText("Welcome message"), { target: { value: "The beach is a short walk away." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await within(screen.getByRole("dialog")).findByText(/Check your connection and try again/)).toBeInTheDocument();
    expect(screen.getByLabelText("Welcome message")).toHaveValue("The beach is a short walk away.");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(savePropertyProfile).toHaveBeenCalledTimes(2);
  });

  it("returns to the desktop canvas when resized from the phone editor", async () => {
    renderPage();
    await editWall();
    await screen.findByRole("button", { name: "Edit details" });
    fireEvent.click(screen.getByRole("button", { name: "View as guest" }));
    act(() => resize(1440));
    expect(screen.getByRole("form", { name: "Guest wall" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "This wall on a phone" })).toBeVisible();
    expect(document.querySelector(".phone-wall-dock")).not.toBeInTheDocument();
    act(() => resize(393));
    expect(screen.getByRole("navigation", { name: "Guest wall sections" })).toBeVisible();
    expect(screen.queryByRole("form", { name: "Guest wall" })).not.toBeInTheDocument();
  });
});

describe("the guest view of a property", () => {
  it("includes published guest memories in the phone beside the editor", async () => {
    loadPreviewMemories.mockResolvedValue({ status: "ok", value: {
      posts: [{ id: "guest-1", message: "We watched the sunrise from the garden.", displayName: "Sam", photoCount: 0 }],
      nextCursor: null
    } });
    renderPage();
    const phone = within(await screen.findByRole("group", { name: "On a phone" }));
    expect(await phone.findByText("We watched the sunrise from the garden.")).toBeInTheDocument();
    expect(phone.getByText("Sam")).toBeInTheDocument();
    expect(loadPreviewMemories).toHaveBeenCalledWith("seabreeze-cottage", "stay", "AbCdEfGhIjKlMnOpQrStUv", undefined);
  });

  it("opens on the wall the QR display leads to, laid out as a guest meets it", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toHaveValue("Seabreeze Cottage"));
    // The wall a Host asks for is the route they are on, so there is no switch
    // on the page choosing between the two.
    expect(screen.queryByRole("tablist", { name: /which wall/i })).not.toBeInTheDocument();
    // The page opens on the wall's name and one sentence on what it is for.
    expect(screen.getByRole("heading", { name: "Guest wall", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/scan your QR code during their stay/i)).toBeInTheDocument();
    expect(canvas().getByRole("img", { name: coverPhoto.alt })).toHaveAttribute("src", coverPhoto.url);
    expect(canvas().getByLabelText("Where the property is")).toHaveValue("St Anthony Head, Cornwall");
    expect(canvas().getByLabelText("Arrival note")).toHaveValue("The kettle is on the side.");
    expect(canvas().getByLabelText("Line 1: answer")).toHaveValue("SEABREEZE-5G");
  });

  it("asks for the writing prompt once: the box to type in belongs to a Host writing their own", async () => {
    renderPage();
    await screen.findByRole("form", { name: "Guest wall" });

    // An offered prompt is chosen from the list, and the list is the whole of
    // it — the box underneath used to repeat the line word for word.
    const choice = canvas().getByLabelText("Writing prompt for guests");
    fireEvent.change(choice, { target: { value: "What was your favourite memory of this stay?" } });
    expect(canvas().queryByLabelText("Your prompt")).not.toBeInTheDocument();

    fireEvent.change(choice, { target: { value: "custom" } });
    const box = canvas().getByLabelText("Your prompt");
    expect(box).toHaveValue("Share a memory from your stay.");
    // Clearing it to start again does not take the box away.
    fireEvent.change(box, { target: { value: "" } });
    expect(canvas().getByLabelText("Your prompt")).toBeInTheDocument();
  });

  it("opens the box already written in for a prompt a Host wrote before", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: profile({ guestPrompt: "Tell us where you swam." }) })
    });
    renderPage();
    await screen.findByRole("form", { name: "Guest wall" });

    expect(canvas().getByLabelText("Writing prompt for guests")).toHaveValue("custom");
    expect(canvas().getByLabelText("Your prompt")).toHaveValue("Tell us where you swam.");
  });

  it("prints the canvas and the phone on the theme the property chose, and saves it with the words", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    // The paper is chosen from the column on the left, with the views, rather
    // than from a row of swatches above the wall it prints.
    const side = within(screen.getByRole("group", { name: "Wall theme" }));
    // Only the chosen theme shows until the host asks to change it.
    expect(side.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(side.getByRole("button", { name: /Warm Linen/ }));
    // A property that has never chosen is on the default, and the sheet says so.
    expect(side.getByRole("radio", { name: "Warm Linen" })).toBeChecked();
    expect(document.querySelector(".canvas-sheet")).toHaveAttribute("data-wall-theme", "linen");

    fireEvent.click(side.getByRole("radio", { name: "Playful" }));
    // Each theme names its own colourways: Playful's third is Berry.
    fireEvent.click(screen.getByRole("radio", { name: "Berry" }));
    expect(document.querySelector(".canvas-sheet")).toHaveAttribute("data-wall-theme", "seaside");

    // The phone is printed on it too: the choice is read back at the size a
    // guest holds, not only on the canvas.
    expect(document.querySelector(".phone-screen")).toHaveAttribute("data-wall-theme", "seaside");

    // It is part of the draft, so it saves on the same button as the words.
    fireEvent.click(save());
    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    expect(saved.theme).toBe("seaside");
    expect(saved.colour).toBe("ocean");
    expect(document.querySelector(".canvas-sheet")).toHaveAttribute("data-wall-colour", "ocean");
    expect(document.querySelector(".phone-screen")).toHaveAttribute("data-wall-colour", "ocean");
  });

  it("keeps the switch off the in-stay wall, which is not the one being shared", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
    expect(screen.queryByRole("switch", { name: "Public page" })).not.toBeInTheDocument();
  });

  it("prints nothing on the phone but what a Host has written", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: profile({ stayHeading: "Welcome" }) })
    });
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    const phone = within(document.querySelector(".phone-screen") as HTMLElement);
    // The property names itself — a guest who has just scanned needs to know
    // they reached the right wall — and then the one written line. Nothing
    // stands in for the empty ones: the phone is what a guest would read, not
    // a list of what is still missing.
    expect(phone.getByText("Seabreeze Cottage")).toBeInTheDocument();
    expect(document.querySelector(".phone-screen .stay-cover-titles")).toContainElement(phone.getByText("Seabreeze Cottage"));
    // A heading is something on the wall, so the name is not printed at the
    // size it takes when it is the only thing there.
    expect(document.querySelector(".phone-screen .stay-cover-titles")).not.toHaveClass("alone");
    expect(phone.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(phone.queryByText(/cover photograph/i)).not.toBeInTheDocument();
    expect(phone.queryByText("A note from your hosts")).not.toBeInTheDocument();
    expect(phone.queryByText(/What guests read first/i)).not.toBeInTheDocument();
    expect(phone.queryByText("The essentials")).not.toBeInTheDocument();
    expect(phone.queryByText(/Wi-Fi, bins, checkout/i)).not.toBeInTheDocument();
  });

  it("says what a guest would be reading where a field is still empty", async () => {
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
    // No cover yet: the standard one stands in, with the offer to replace it.
    expect(canvas().getByRole("img", { name: "Standard cover photo" })).toHaveAttribute("src", defaultCover.url);
    expect(canvas().getByLabelText("Where the property is")).toHaveAttribute(
      "placeholder",
      "10 Street Name, Town, Postcode"
    );
    // The note is on the wall from the start, with the example written in. A
    // Host with nothing to say takes it off; they are not asked to ask for it.
    expect(canvas().getByLabelText("Arrival heading")).toHaveValue(exampleNote.heading);
    expect(canvas().getByLabelText("Arrival note")).toHaveValue(exampleNote.welcome);
    expect(save()).toBeDisabled();
    expect(canvas().queryByRole("button", { name: "+ a note from your hosts" })).not.toBeInTheDocument();
    expect(canvas().getByRole("button", { name: "Leave the whole note out" })).toBeInTheDocument();
  });

  it("leaves one line off the wall without touching the rest of the note", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("One local recommendation")).toBeInTheDocument());

    fireEvent.click(canvas().getByRole("button", { name: "Leave the recommendation out" }));

    expect(canvas().queryByLabelText("One local recommendation")).not.toBeInTheDocument();
    expect(canvas().getByRole("button", { name: "+ a local recommendation" })).toBeInTheDocument();
    // The rest of the note is untouched.
    expect(canvas().getByLabelText("Arrival note")).toHaveValue("The kettle is on the side.");

    fireEvent.click(save());
    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    expect(saved.stayTip).toBe("");
    expect(saved.stayWelcome).toBe("The kettle is on the side.");
  });

  it("leaves the whole note off the wall, and puts it back", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Arrival note")).toBeInTheDocument());

    fireEvent.click(canvas().getByRole("button", { name: "Leave the whole note out" }));

    expect(canvas().queryByLabelText("Arrival heading")).not.toBeInTheDocument();
    expect(canvas().queryByLabelText("Arrival note")).not.toBeInTheDocument();
    expect(canvas().queryByLabelText("One local recommendation")).not.toBeInTheDocument();
    // The essentials are a different thing and stay where they were.
    expect(canvas().getByLabelText("Line 1: answer")).toHaveValue("SEABREEZE-5G");

    fireEvent.click(save());
    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    // The note is on by default, so an absence no longer says "off": without
    // the stored decision a reload would put the note straight back.
    expect(saved.stayNoteOff).toBe(true);

    fireEvent.click(canvas().getByRole("button", { name: "+ a note from your hosts" }));
    expect(canvas().getByLabelText("Arrival note")).toHaveValue("");
  });

  it("puts the note back on a property that had it taken off", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: { ...filledProfile, stayNoteOff: true } })
    });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    expect(canvas().queryByLabelText("Arrival note")).not.toBeInTheDocument();
    fireEvent.click(canvas().getByRole("button", { name: "+ a note from your hosts" }));

    // The words were kept, so putting it back does not cost a Host the note.
    expect(canvas().getByLabelText("Arrival note")).toHaveValue("The kettle is on the side.");
  });

  it("draws the guests' half of the wall without offering it for editing", async () => {
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
    await waitFor(() => expect(canvas().getByText("12 memories left here")).toBeInTheDocument());
    expect(canvas().getByRole("link", { name: /Moderate what guests leave/ })).toHaveAttribute(
      "href",
      "/host/inbox?property=prop-1"
    );
    expect(canvas().getByText(/written by guests, on the wall itself/i)).toBeInTheDocument();
    expect(canvas().queryByLabelText("Your message")).not.toBeInTheDocument();

    // The guests' composer is not drawn or faked here; the wall itself is one
    // click away, which is the only place it works.
    // With the token on it. The wall only answers with the arrival note and
    // the essentials to the address on the placard, so a tokenless link would
    // show this Host the public wall and none of what they just wrote.
    expect(canvas().getByRole("link", { name: "Open the guest wall as guests see it" })).toHaveAttribute(
      "href",
      "/stay/seabreeze-cottage/AbCdEfGhIjKlMnOpQrStUv"
    );

    // The phone heads the same section with the same line.
    const phone = within(document.querySelector(".phone-screen") as HTMLElement);
    expect(phone.getByText("12 memories left here")).toBeInTheDocument();
  });

  it("gives the hosts a panel of their own above the memories, on the guest wall only", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    // Nothing of theirs is on the wall until they write it, so the place the
    // panel goes carries the offer to start one.
    expect(canvas().queryByLabelText(/anything else you want to say/i)).not.toBeInTheDocument();
    fireEvent.click(canvas().getByRole("button", { name: "+ a note of your own" }));

    const note = canvas().getByLabelText("Note 1: anything else you want to say");
    // It is not a memory and does not stand among them: the guests' half of
    // the wall begins under it.
    expect(canvas().getByLabelText("Memories from guests")).not.toContainElement(note);

    fireEvent.change(note, {
      target: { value: "We lay the fire before every arrival." }
    });
    fireEvent.click(save());

    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalled());
    const saved = savePropertyProfile.mock.calls[0]![1] as PropertyProfile;
    expect(saved.hostNotes.map((entry) => entry.message)).toEqual(["We lay the fire before every arrival."]);
    // A note is fixed to the wall one of two ways, and a Host who has not
    // chosen gets the framed card rather than nothing.
    expect(saved.hostNotes[0]?.style).toBe("bordered");

    // The phone reads it back as the wall will, signed with the same names.
    const phone = within(document.querySelector(".phone-screen") as HTMLElement);
    expect(phone.getByText("We lay the fire before every arrival.")).toBeInTheDocument();
    expect(phone.getAllByText("Ana & Tom").length).toBeGreaterThan(0);
  });

  it("takes one of the hosts' panels off the wall again, words and all", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: { ...filledProfile, hostNotes: [hostNote()] } })
    });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Note 1: anything else you want to say")).toHaveValue(
      "We lay the fire before every arrival."
    ));

    fireEvent.click(canvas().getByText("Note options"));
    fireEvent.click(canvas().getByRole("button", { name: "Take note 1 off the wall" }));
    expect(canvas().queryByLabelText("Note 1: anything else you want to say")).not.toBeInTheDocument();
    expect(canvas().getByRole("button", { name: "+ a note of your own" })).toBeInTheDocument();
  });

  it("writes as many notes as the hosts have things to say, each fixed the way they chose", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: { ...filledProfile, hostNotes: [hostNote()] } })
    });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Note 1: anything else you want to say")).toBeInTheDocument());

    fireEvent.click(canvas().getByRole("button", { name: "+ another note" }));
    fireEvent.change(canvas().getByLabelText("Note 2: anything else you want to say"), {
      target: { value: "The bench gets the last of the sun." }
    });
    // The second one is pinned up rather than framed, which is the whole of
    // the choice: two shapes on the paper the property already chose.
    canvas().getAllByText("Note options").forEach(control => fireEvent.click(control));
    const pinned = canvas().getAllByRole("radio", { name: "Pinned" })[1] as HTMLInputElement;
    fireEvent.click(pinned);
    fireEvent.click(save());

    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalled());
    const saved = savePropertyProfile.mock.calls[0]![1] as PropertyProfile;
    expect(saved.hostNotes.map((entry) => [entry.message, entry.style])).toEqual([
      ["We lay the fire before every arrival.", "bordered"],
      ["The bench gets the last of the sun.", "pinned"]
    ]);
  });

  it("hangs a photograph on one of the hosts' panels without asking for a second form", async () => {
    uploadPropertyPhoto.mockResolvedValue({
      status: "ok",
      value: { ...coverPhoto, path: "properties/prop-1/media/hostNote-fire-1.jpg", alt: "A log fire" }
    });
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: { ...filledProfile, hostNotes: [hostNote()] } })
    });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Note 1: anything else you want to say")).toBeInTheDocument());

    fireEvent.click(canvas().getByRole("button", { name: "Add a photograph to note 1" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const file = new File(["binary"], "fire.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Note photograph: choose an image file"), {
      target: { files: [file] }
    });

    await waitFor(() => expect(uploadPropertyPhoto).toHaveBeenCalled());
    // The note's own slot, so a photograph follows the note it was chosen for
    // and never overwrites the cover or the note beside it.
    expect(uploadPropertyPhoto.mock.calls[0]![1]).toBe("hostNote:fire");
    await waitFor(() =>
      expect(canvas().getByRole("button", { name: "Change the photograph on note 1" })).toBeInTheDocument()
    );
  });

  it("signs the note with the names a Host typed, note written or not", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: profile({ stayHeading: "Welcome to the Cottage", hosts: "Ana & Tom" }) })
    });
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    const phone = within(document.querySelector(".phone-screen") as HTMLElement);
    expect(phone.getByText("Ana & Tom")).toBeInTheDocument();
    // The eyebrow labels a note, and there is still no note to label.
    expect(phone.queryByText("A note from your hosts")).not.toBeInTheDocument();
  });

  it("prints the name at title size on a wall with nothing else on it", async () => {
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
    expect(document.querySelector(".phone-screen .stay-cover-titles h1")).toHaveTextContent("Seabreeze Cottage");

    // The first line written takes the wall back to its ordinary proportions.
    fireEvent.change(canvas().getByLabelText("Arrival heading"), { target: { value: "Welcome" } });
    expect(document.querySelector(".phone-screen .stay-cover-titles")).not.toHaveClass("alone");
  });

  it("says a wall is empty rather than counting to zero", async () => {
    loadWallCounts.mockResolvedValue({ status: "ok", value: { visible: 0, hidden: 0 } });
    renderPage();

    await waitFor(() => expect(canvas().getByText("No memories left yet")).toBeInTheDocument());
    const phone = within(document.querySelector(".phone-screen") as HTMLElement);
    expect(phone.getByText("No memories left yet")).toBeInTheDocument();
  });

  it("carries the essentials by default, and takes them off the wall when asked", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Line 1: answer")).toBeInTheDocument());
    expect(canvas().getByText("Your stay essentials")).toBeInTheDocument();

    fireEvent.click(canvas().getByRole("button", { name: "Leave the essentials out" }));

    expect(canvas().queryByLabelText("Line 1: answer")).not.toBeInTheDocument();
    expect(canvas().queryByRole("button", { name: "Add a line" })).not.toBeInTheDocument();
    expect(canvas().getByRole("button", { name: "+ the essentials" })).toBeInTheDocument();

    fireEvent.click(save());
    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    expect(saved.factsOff).toBe(true);
    // The lines are kept, so putting the section back does not cost them.
    expect(saved.facts).toEqual([{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "On the fridge magnet" }]);
  });

  it("lays the in-stay wall out as the guest's: the essentials as buttons at the top, then the hosts' notes", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: { ...filledProfile, hostNotes: [hostNote()] } }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Line 1: answer")).toBeInTheDocument());

    const before = (first: Element | null, second: Element | null) =>
      Boolean(first && second && first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    const form = document.querySelector("form") as HTMLElement;
    const row = form.querySelector(".stay-links ul") as HTMLElement;
    // The row is the essentials and nothing else, and they are drawn nowhere
    // else: each line's editor waits, closed, until its button is tapped.
    expect(within(row).getAllByRole("button").map(button => button.textContent)).toEqual(["Wi-Fi"]);
    expect(before(row, form.querySelector(".host-notes"))).toBe(true);
    expect(screen.queryByRole("dialog", { name: "Wi-Fi" })).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Wi-Fi" }));
    expect(within(screen.getByRole("dialog", { name: "Wi-Fi" })).getByLabelText("Line 1: answer")).toHaveValue("SEABREEZE-5G");
    fireEvent.click(within(screen.getByRole("dialog", { name: "Wi-Fi" })).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Wi-Fi" })).not.toBeInTheDocument();

    // The phone draws the guest's wall in the same order, with no list of the
    // lines in full underneath.
    const phone = document.querySelector(".phone-screen") as HTMLElement;
    expect(within(phone.querySelector(".stay-links ul") as HTMLElement).getAllByRole("button").map(button => button.textContent)).toEqual(["Wi-Fi"]);
    expect(before(phone.querySelector(".stay-links"), phone.querySelector(".host-notes"))).toBe(true);
    expect(phone.querySelector(".stay-fact")).toBeNull();
  });

  it("opens a line it has just added, so its example answer is corrected where it was picked", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByRole("button", { name: "Add a line" })).toBeInTheDocument());
    fireEvent.click(canvas().getByRole("button", { name: "Add a line" }));
    expect(within(screen.getByRole("dialog", { name: "Line 2" })).getByLabelText("Line 2: label")).toHaveValue("");
  });

  it("puts the essentials back with the lines that were written on them", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: { ...filledProfile, factsOff: true } })
    });
    renderPage();

    const include = await screen.findByRole("button", { name: "+ the essentials" });
    fireEvent.click(include);

    expect(canvas().getByLabelText("Line 1: answer")).toHaveValue("SEABREEZE-5G");
  });

  it("offers the lines nearly every property answers instead of asking a Host to invent them", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByRole("button", { name: "Add a line" })).toBeInTheDocument());

    fireEvent.click(canvas().getByRole("button", { name: "+ Wi-Fi" }));

    expect(canvas().getByLabelText("Line 1: label")).toHaveValue("Wi-Fi");
    // The suggestion brings the whole line, answer included, so the line is on
    // the wall the moment it is picked and the Host corrects an answer rather
    // than filling an empty field that guests would never have seen.
    expect(canvas().getByLabelText("Line 1: answer")).toHaveValue("SEABREEZE-5G / sandcastle42");
    expect(canvas().getByLabelText("Line 1: detail")).toHaveValue(
      "The router is in the hall cupboard"
    );
    // A suggestion already on the wall is not offered twice.
    expect(canvas().queryByRole("button", { name: "+ Wi-Fi" })).not.toBeInTheDocument();
    expect(canvas().getByRole("button", { name: "+ Bins" })).toBeInTheDocument();
  });

  it("takes the property's own photograph from the band, in one step and no form", async () => {
    const avatar = {
      path: "properties/prop-1/media/avatar-1.jpg",
      url: "https://example.test/avatar.jpg",
      alt: "",
      width: 900,
      height: 900
    };
    uploadPropertyPhoto.mockResolvedValue({ status: "ok", value: avatar });
    renderPage();
    const add = await screen.findByRole("button", { name: "Add a main photo of this property" });
    // An empty square says what it wants rather than sitting there blank.
    expect(within(add).getByText("Add a photo")).toBeInTheDocument();

    const chosen = new File(["photograph"], "cottage.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Choose the main photo of this property"), {
      target: { files: [chosen] }
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Change the main photo of this property" })).toBeInTheDocument()
    );
    // The photograph is the property's own, not the cover across the walls.
    expect(uploadPropertyPhoto).toHaveBeenCalledWith("prop-1", "avatar", chosen);
  });

  it("says why a file was refused, and does not upload it", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Add a main photo of this property" });

    fireEvent.change(screen.getByLabelText("Choose the main photo of this property"), {
      target: { files: [new File(["not a photograph"], "handbook.pdf", { type: "application/pdf" })] }
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPEG, PNG or WebP image.");
    expect(uploadPropertyPhoto).not.toHaveBeenCalled();
  });

  it("stands the phone beside the canvas, on the wall being edited, without closing the fields", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Arrival note")).toBeInTheDocument());

    // The phone is on the page from the start: the join between what is typed
    // and what is read is most use to the Host who does not know to ask.
    expect(screen.getByRole("complementary", { name: "This wall on a phone" })).toBeInTheDocument();
    expect(screen.getByText(/the phone follows as you type/i)).toBeInTheDocument();

    // An unsaved change is previewed: it is the draft that is being read.
    fireEvent.change(canvas().getByLabelText("Arrival heading"), { target: { value: "Come on in" } });
    const phone = within(screen.getByRole("complementary", { name: "This wall on a phone" }));
    expect(phone.getByText("Come on in")).toBeInTheDocument();
    // It follows the wall the page is on, and has no second switch of its own.
    expect(phone.getByRole("button", { name: "Wi-Fi" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Preview which wall" })).not.toBeInTheDocument();

    // The canvas is still the canvas: the phone is beside the work, not over it.
    expect(canvas().getByLabelText("Arrival heading")).toHaveValue("Come on in");
    expect(canvas().getByRole("button", { name: "Add a line" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide the phone" }));
    expect(screen.queryByRole("complementary", { name: "This wall on a phone" })).not.toBeInTheDocument();

    // A Host who wanted the canvas to itself can have it back either way.
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("complementary", { name: "This wall on a phone" })).toBeInTheDocument();
  });

  it("takes the phone's width from the page's margin rather than from the canvas", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    // The property screens sit at the measure that suits prose. Splitting that
    // measure three ways to fit the phone is what left the wall too narrow to
    // write on, so opening the phone widens the page instead.
    const page = document.querySelector(".property-shell") as HTMLElement;
    expect(page).toHaveClass("has-phone");

    fireEvent.click(screen.getByRole("button", { name: "Hide the phone" }));
    expect(page).not.toHaveClass("has-phone");

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(page).toHaveClass("has-phone");
  });

  it("always shows the phone, with no button to hide it, once it drops under the canvas", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 1340px)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      renderPage();
      await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
      expect(screen.getByRole("complementary", { name: "This wall on a phone" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Hide the phone" })).not.toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it("writes the wall in place and saves the whole page in one write", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
    expect(save()).toBeDisabled();

    fireEvent.change(canvas().getByLabelText("Where the property is"), { target: { value: "  Cornwall  " } });
    fireEvent.change(canvas().getByLabelText("Arrival heading"), { target: { value: "Welcome to the cottage" } });
    fireEvent.change(canvas().getByLabelText("Arrival note"), { target: { value: "The kettle is on the side." } });
    fireEvent.click(canvas().getByRole("button", { name: "+ your names" }));
    fireEvent.change(canvas().getByLabelText("Your names"), { target: { value: "Ana & Tom" } });

    fireEvent.click(canvas().getByRole("button", { name: "Add a line" }));
    fireEvent.change(canvas().getByLabelText("Line 1: label"), { target: { value: "Wi-Fi" } });
    fireEvent.change(canvas().getByLabelText("Line 1: answer"), { target: { value: "SEABREEZE-5G" } });

    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
    fireEvent.click(save());

    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [propertyId, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    expect(propertyId).toBe("prop-1");
    expect(saved.location.trim()).toBe("Cornwall");
    expect(saved.stayWelcome).toBe("The kettle is on the side.");
    expect(saved.facts).toEqual([{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "" }]);
    expect(await screen.findByText(/Your walls read this immediately/i)).toBeInTheDocument();
  });

  it("renames the property from the title a guest reads", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    fireEvent.change(canvas().getByLabelText("Property name"), { target: { value: "Seabreeze Cottage Annexe" } });
    fireEvent.click(save());

    await waitFor(() => expect(savePropertyName).toHaveBeenCalledWith("prop-1", "Seabreeze Cottage Annexe"));
    expect(savePropertyProfile).not.toHaveBeenCalled();
  });

  it("reports a rejected name against the line it was typed on", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    fireEvent.change(canvas().getByLabelText("Property name"), { target: { value: "A" } });
    fireEvent.click(save());

    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(savePropertyName).not.toHaveBeenCalled();
  });

  it("refuses a guidance line that would reach a guest as a label with no answer", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    fireEvent.click(canvas().getByRole("button", { name: "Add a line" }));
    fireEvent.change(canvas().getByLabelText("Line 1: label"), { target: { value: "Wi-Fi" } });
    fireEvent.click(save());

    expect(await screen.findByText("Add the answer guests need for Wi-Fi.")).toBeInTheDocument();
    expect(savePropertyProfile).not.toHaveBeenCalled();
  });

  it("makes the whole photograph area the control, with stand-ins until photos are added", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    // The pill is painted inside the button rather than sitting beside it, so
    // the copy a Host reads and the area they aim at are one control.
    const cover = canvas().getByRole("button", { name: "Add a cover photo" });
    expect(cover.querySelector("img")).toHaveAttribute("src", defaultCover.url);

    // No names written: the property's initials stand in for the photo.
    const portrait = canvas().getByRole("button", { name: "Add a welcome photo" });
    expect(portrait.querySelector(".canvas-portrait-mark")).toHaveTextContent("SC");

    const openPicker = vi.spyOn(HTMLInputElement.prototype, "click");
    fireEvent.click(portrait);
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(openPicker.mock.instances[0]).toBe(
      screen.getByLabelText("Welcome photo: choose an image file")
    );
    openPicker.mockRestore();
    expect(screen.queryByRole("dialog", { name: "Welcome photo" })).not.toBeInTheDocument();
    const file = new File(["binary"], "portrait.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Welcome photo: choose an image file"), { target: { files: [file] } });
    await waitFor(() => expect(uploadPropertyPhoto).toHaveBeenCalledWith("prop-1", "hostPhoto", file, expect.any(Function)));
    await waitFor(() => expect(canvas().getByRole("button", { name: "Change the welcome photo" })).toBeEnabled());
    expect(screen.queryByRole("dialog", { name: "Welcome photo" })).not.toBeInTheDocument();
  });

  it("shows one compact upload status and makes a failed portrait upload retryable", async () => {
    let finish!: (value: unknown) => void;
    uploadPropertyPhoto.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderPage();
    const input = await screen.findByLabelText("Welcome photo: choose an image file");
    fireEvent.change(input, { target: { files: [new File(["photo"], "portrait.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByText("Uploading…")).toHaveAttribute("role", "status");
    expect(screen.queryByText(/Uploading photograph|0%/)).not.toBeInTheDocument();
    expect(canvas().getByRole("button", { name: "Add a welcome photo" })).toBeDisabled();
    finish({ status: "error", message: "Photo storage is unavailable." });
    expect(await screen.findByRole("alert")).toHaveTextContent("Photo storage is unavailable.");
    expect(canvas().getByRole("button", { name: "Add a welcome photo" })).toBeEnabled();
  });

  it("uploads the cover from the photograph itself", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    fireEvent.click(canvas().getByRole("button", { name: "Add a cover photo" }));
    // Choosing a file uploads immediately, like the host portrait.
    const upload = canvas();
    const file = new File(["binary"], "cottage.jpg", { type: "image/jpeg" });
    fireEvent.change(upload.getByLabelText("Cover photo: choose an image file"), { target: { files: [file] } });
    // Nothing is asked about the photograph: what a screen reader is read
    // comes from the slot it was dropped into.
    expect(upload.queryByLabelText(/Describe/i)).not.toBeInTheDocument();

    await waitFor(() => expect(uploadPropertyPhoto).toHaveBeenCalledTimes(1));
    const [propertyId, slot, uploaded] = uploadPropertyPhoto.mock.calls[0] as [string, string, File];
    expect([propertyId, slot]).toEqual(["prop-1", "cover"]);
    expect(uploaded.name).toBe("cottage.jpg");

    // The photograph appears directly on the wall without a dialog.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The upload writes the property itself, so it is not left as unsaved work.
    await waitFor(() => expect(canvas().getByRole("img", { name: coverPhoto.alt })).toBeInTheDocument());
    expect(save()).toBeDisabled();
  });

  it("leaves the wall unchanged when cover selection is cancelled", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    const cover = canvas().getByRole("button", { name: "Add a cover photo" });
    // A click focuses the frame in a browser; jsdom needs telling.
    cover.focus();
    fireEvent.click(cover);
    expect(screen.queryByRole("dialog", { name: "Cover photo" })).not.toBeInTheDocument();

    // Cancelling the native picker does not upload anything.
    fireEvent.change(screen.getByLabelText("Cover photo: choose an image file"), { target: { files: [] } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(cover);
    expect(uploadPropertyPhoto).not.toHaveBeenCalled();
    expect(save()).toBeDisabled();
  });

  it("reports a failed write instead of implying the change was kept", async () => {
    savePropertyProfile.mockResolvedValue({ status: "error", message: "The database did not respond in time." });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    fireEvent.change(canvas().getByLabelText("Where the property is"), { target: { value: "Cornwall" } });
    fireEvent.click(save());

    expect(await screen.findByText(/did not respond in time/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your walls read this immediately/i)).not.toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it("refuses to render a property owned by another host account", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ ownerUid: "host-b" }) });
    renderPage();

    expect(await screen.findByText(/belongs to another host account/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Property name")).not.toBeInTheDocument();
  });

  it("is the property's own address, so the trail names it rather than offering it", async () => {
    renderPage();
    await screen.findByRole("form", { name: "Guest wall" });

    // The property view is where /host/property/{id} lands, so the crumb for
    // this property is the page you are already on.
    expect(screen.queryByRole("link", { name: "Seabreeze Cottage" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your properties" })).toHaveAttribute("href", "/host");

    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByText("Guest wall", { selector: "span[aria-current]" })).toHaveAttribute("aria-current", "page");
    // The public page has no editor of its own: it is shared from here.
    expect(nav.queryByRole("link", { name: "Public page" })).not.toBeInTheDocument();
    expect(nav.getByRole("link", { name: "QR code and sharing" })).toHaveAttribute(
      "href",
      "/host/property/prop-1/qr"
    );
  });

  it("carries the way to publish a draft, on the band and in the column", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ lifecycle: "draft", mode: "sandbox", billing: null })
    });
    renderPage();
    await screen.findByRole("form", { name: "Guest wall" });

    expect(screen.getByRole("link", { name: "Publish this property" })).toHaveAttribute(
      "href",
      "/host/property/prop-1/billing"
    );
    // The row that leads to the same place says what it is for while there is
    // nothing yet to bill.
    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByRole("link", { name: "Publish" })).toHaveAttribute(
      "href",
      "/host/property/prop-1/billing"
    );
    expect(nav.queryByRole("link", { name: "Billing" })).not.toBeInTheDocument();
  });

  it("keeps the band free of a publish control once the property is live", async () => {
    renderPage();
    await screen.findByRole("form", { name: "Guest wall" });

    expect(screen.queryByRole("link", { name: "Publish this property" })).not.toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByRole("link", { name: "Billing" })).toHaveAttribute("href", "/host/property/prop-1/billing");
  });
});


it('lets long property headings and addresses wrap while keeping stored values single-line', async () => {
  renderPage();
  await screen.findByRole('form', { name: 'Guest wall' });
  const name = canvas().getByLabelText('Property name');
  const address = canvas().getByLabelText('Where the property is');
  const heading = canvas().getByLabelText('Arrival heading');
  for (const field of [name, address, heading]) {
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: 'A long first line\ncontinued here' } });
    expect(field).toHaveValue('A long first line continued here');
  }
});


describe("the hosts' stay-again links", () => {
  it("adds a booking link from the suggestions and saves its full address", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByRole("heading", { name: "Stay with us again" })).toBeInTheDocument());
    // The platforms' rules are said beside the fields.
    expect(canvas().getByText(/does not allow offering a discount for booking outside Airbnb/)).toBeInTheDocument();

    fireEvent.click(canvas().getByRole("button", { name: "+ Book your next stay with us" }));
    expect(canvas().getByLabelText("Link 1: what it says")).toHaveValue("Book your next stay with us");
    fireEvent.change(canvas().getByLabelText("Link 1: web address"), { target: { value: "seabreezecottage.com.au/book" } });

    fireEvent.click(save());
    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    // The store writes the profile through normalizeProfile, which stores the address in full.
    expect(normalizeProfile(saved).stayAgainLinks).toEqual([{ label: "Book your next stay with us", url: "https://seabreezecottage.com.au/book" }]);
  });

  it("will not save a link a guest would tap and land nowhere", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByRole("heading", { name: "Stay with us again" })).toBeInTheDocument());
    fireEvent.click(canvas().getByRole("button", { name: "+ Join our guest list" }));
    fireEvent.change(canvas().getByLabelText("Link 1: web address"), { target: { value: "http://seabreeze.com.au/list" } });

    fireEvent.click(save());
    expect(await canvas().findByText("Use your page's secure address, starting https://.")).toBeInTheDocument();
    expect(savePropertyProfile).not.toHaveBeenCalled();
  });
});
