import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostWallDesignPage } from "./HostWallDesignPage";
import { emptyProfile, type HostNote, type PropertyProfile } from "../../domain/propertyProfile";
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

/** The same page at the public wall's own route. */
function renderPublic(state: AuthState = hostSession) {
  return render(
    <AuthContext.Provider value={state}>
      <HostWallDesignPage propertyId="prop-1" view="public" />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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

const canvas = (name = "Property view") => within(screen.getByRole("form", { name }));
const publicCanvas = () => canvas("Public wall");
const save = () => canvas().getByRole("button", { name: "Save changes" });
const publicSave = () => publicCanvas().getByRole("button", { name: "Save changes" });

describe("the guest view of a property", () => {
  it("opens on the wall the QR display leads to, laid out as a guest meets it", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toHaveValue("Seabreeze Cottage"));
    // The wall a Host asks for is the route they are on, so there is no switch
    // on the page choosing between the two.
    expect(screen.queryByRole("tablist", { name: /which wall/i })).not.toBeInTheDocument();
    // And nothing stands between the top of the screen and the wall: the page
    // used to open on a title, a lede and a line about who reaches this wall,
    // all of which the banner and the nav already said.
    expect(screen.queryByRole("heading", { name: "Property view" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Type straight into it/i)).not.toBeInTheDocument();
    expect(canvas().getByRole("img", { name: coverPhoto.alt })).toHaveAttribute("src", coverPhoto.url);
    expect(canvas().getByLabelText("Where the property is")).toHaveValue("St Anthony Head, Cornwall");
    expect(canvas().getByLabelText("Arrival note")).toHaveValue("The kettle is on the side.");
    expect(canvas().getByLabelText("Line 1: answer")).toHaveValue("SEABREEZE-5G");
  });

  it("asks for the writing prompt once: the box to type in belongs to a Host writing their own", async () => {
    renderPage();
    await screen.findByRole("form", { name: "Property view" });

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
    await screen.findByRole("form", { name: "Property view" });

    expect(canvas().getByLabelText("Writing prompt for guests")).toHaveValue("custom");
    expect(canvas().getByLabelText("Your prompt")).toHaveValue("Tell us where you swam.");
  });

  it("keeps the house guidance off the public wall, at the public wall's own route", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPublic();

    await waitFor(() =>
      expect(publicCanvas().getByLabelText("A short welcome for the public wall")).toHaveValue(
        "The wall our guests leave behind."
      )
    );
    expect(publicCanvas().queryByDisplayValue("SEABREEZE-5G")).not.toBeInTheDocument();
    expect(publicCanvas().queryByLabelText("Arrival note")).not.toBeInTheDocument();
    // The name, the location and the hosts are the same fields on both walls.
    expect(publicCanvas().getByLabelText("Property name")).toHaveValue("Seabreeze Cottage");
    expect(publicCanvas().getByLabelText("Your names")).toHaveValue("Ana & Tom");

    // And the nav says which wall this is, since the page no longer asks.
    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByText("Public wall", { selector: "span[aria-current]" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Property view" })).toHaveAttribute("href", "/host/property/prop-1");
  });

  it("prints the canvas and the phone on the theme the property chose, and saves it with the words", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    // The paper is chosen from the column on the left, with the views, rather
    // than from a row of swatches above the wall it prints.
    const side = within(screen.getByRole("group", { name: "Wall theme" }));
    // A property that has never chosen is on the default, and the sheet says so.
    expect(side.getByRole("button")).toHaveTextContent("Linen");
    expect(document.querySelector(".canvas-sheet")).toHaveAttribute("data-wall-theme", "linen");

    fireEvent.click(side.getByRole("button"));
    fireEvent.click(screen.getByRole("radio", { name: "Harbour" }));
    expect(document.querySelector(".canvas-sheet")).toHaveAttribute("data-wall-theme", "harbour");

    // The phone is printed on it too: the choice is read back at the size a
    // guest holds, not only on the canvas.
    expect(document.querySelector(".phone-screen")).toHaveAttribute("data-wall-theme", "harbour");

    // It is part of the draft, so it saves on the same button as the words.
    fireEvent.click(save());
    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    expect(saved.theme).toBe("harbour");
  });

  it("offers the same theme on the public wall, since one property has one paper", async () => {
    loadProperty.mockResolvedValue({
      status: "ok",
      value: hostProperty({ profile: { ...filledProfile, theme: "sage" } })
    });
    renderPublic();

    await waitFor(() => expect(publicCanvas().getByLabelText("Property name")).toBeInTheDocument());
    const side = within(screen.getByRole("group", { name: "Wall theme" }));
    expect(side.getByRole("button")).toHaveTextContent("Sage");
    expect(document.querySelector(".canvas-sheet")).toHaveAttribute("data-wall-theme", "sage");
  });

  it("says what the public wall is for, and hands over both ways of using it", async () => {
    const clipboard = vi.fn((_text: string) => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText: clipboard } });
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPublic();
    await waitFor(() => expect(publicCanvas().getByLabelText("Property name")).toBeInTheDocument());

    const panel = within(screen.getByRole("region", { name: "This wall" }));
    expect(panel.getByRole("switch", { name: "Public wall" })).toBeChecked();
    expect(panel.getByText(/embed it on your own site/i)).toBeInTheDocument();

    fireEvent.click(panel.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith("http://localhost:3000/wall/seabreeze-cottage"));

    fireEvent.click(panel.getByText("Put it on your own website"));
    fireEvent.click(panel.getByRole("button", { name: "Copy embed code" }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(2));
    const snippet = clipboard.mock.calls[1]![0];
    expect(snippet).toContain('src="http://localhost:3000/embed/wall/seabreeze-cottage"');
    expect(snippet).toContain('title="Memories left at Seabreeze Cottage"');
    // Both rows say so, each about its own click.
    expect(await panel.findAllByText("Copied.")).toHaveLength(2);
  });

  it("switches the public wall off without losing a word of it", async () => {
    loadProperty.mockResolvedValue({ status: "ok", value: hostProperty({ profile: filledProfile }) });
    renderPublic();
    await waitFor(() => expect(publicCanvas().getByLabelText("Property name")).toBeInTheDocument());

    const panel = () => within(screen.getByRole("region", { name: "This wall" }));
    fireEvent.click(panel().getByRole("switch", { name: "Public wall" }));

    expect(panel().getByRole("switch", { name: "Public wall" })).not.toBeChecked();
    // Nothing is offered that would currently reach anybody.
    expect(panel().queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(panel().queryByRole("button", { name: "Copy embed code" })).not.toBeInTheDocument();
    expect(panel().getByText(/every word is kept/i)).toBeInTheDocument();
    // And the words really are still there, on the wall below.
    expect(publicCanvas().getByLabelText("A short welcome for the public wall")).toHaveValue(
      "The wall our guests leave behind."
    );

    // The row stays in the nav, marked, because the switch back on is on it.
    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByText("Public wall", { selector: "span[aria-current]" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByText("Off")).toBeInTheDocument();
    // The banner stops offering a way into a wall nobody can reach.
    expect(screen.queryByRole("link", { name: "View guest wall" })).not.toBeInTheDocument();

    fireEvent.click(publicSave());
    await waitFor(() => expect(savePropertyProfile).toHaveBeenCalledTimes(1));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    expect(saved.displayWallOff).toBe(true);
    expect(saved.welcome).toBe("The wall our guests leave behind.");
  });

  it("keeps the switch off the in-stay wall, which is not the one being shared", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
    expect(screen.queryByRole("switch", { name: "Public wall" })).not.toBeInTheDocument();
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
    expect(document.querySelector(".phone-stay-name")).toContainElement(phone.getByText("Seabreeze Cottage"));
    // A heading is something on the wall, so the name is not printed at the
    // size it takes when it is the only thing there.
    expect(document.querySelector(".phone-stay-name")).not.toHaveClass("alone");
    expect(phone.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(phone.queryByText(/cover photograph/i)).not.toBeInTheDocument();
    expect(phone.queryByText("A note from your hosts")).not.toBeInTheDocument();
    expect(phone.queryByText(/What guests read first/i)).not.toBeInTheDocument();
    expect(phone.queryByText("The essentials")).not.toBeInTheDocument();
    expect(phone.queryByText(/Wi-Fi, bins, checkout/i)).not.toBeInTheDocument();
  });

  it("keeps the public wall to the same rule, down to the byline", async () => {
    renderPublic();

    await waitFor(() => expect(publicCanvas().getByLabelText("Property name")).toBeInTheDocument());

    const phone = within(document.querySelector(".phone-screen") as HTMLElement);
    expect(phone.getByRole("heading", { name: "Seabreeze Cottage" })).toBeInTheDocument();
    expect(phone.queryByText("Your names")).not.toBeInTheDocument();
    expect(phone.queryByText(/Hosting here since/i)).not.toBeInTheDocument();
    expect(phone.queryByText(/Where the property is/i)).not.toBeInTheDocument();
  });

  it("says what a guest would be reading where a field is still empty", async () => {
    renderPage();

    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());
    expect(canvas().getByText(/The photograph across the top of both walls/i)).toBeInTheDocument();
    expect(canvas().getByLabelText("Where the property is")).toHaveAttribute(
      "placeholder",
      "10 Street Name, Town, Postcode"
    );
    // The note is on the wall from the start, empty, saying what a guest would
    // be reading there. A Host with nothing to say takes it off; they are not
    // asked to ask for it.
    expect(canvas().getByLabelText("Arrival note")).toHaveValue("");
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
      "/host/property/prop-1/moderation"
    );
    expect(canvas().getByText(/written by guests, on the wall itself/i)).toBeInTheDocument();
    expect(canvas().queryByLabelText("Your message")).not.toBeInTheDocument();

    // The guests' composer is not drawn or faked here; the wall itself is one
    // click away, which is the only place it works.
    // With the token on it. The wall only answers with the arrival note and
    // the essentials to the address on the placard, so a tokenless link would
    // show this Host the public wall and none of what they just wrote.
    expect(canvas().getByRole("link", { name: "Open the in-stay wall as guests see it" })).toHaveAttribute(
      "href",
      "/stay/seabreeze-cottage/AbCdEfGhIjKlMnOpQrStUv"
    );

    // The phone heads the same section with the same line.
    const phone = within(document.querySelector(".phone-screen") as HTMLElement);
    expect(phone.getByText("12 memories left here")).toBeInTheDocument();
  });

  it("gives the hosts a panel of their own above the memories, on both walls", async () => {
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

    // And it is the same card on the public wall, which is the other door on
    // the same property.
    renderPublic();
    await waitFor(() => expect(publicCanvas().getByLabelText("Property name")).toBeInTheDocument());
    expect(publicCanvas().getByRole("button", { name: "+ a note of your own" })).toBeInTheDocument();
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
    expect(document.querySelector(".phone-stay-name")).toHaveClass("alone");

    // The first line written takes the wall back to its ordinary proportions.
    fireEvent.change(canvas().getByLabelText("Arrival heading"), { target: { value: "Welcome" } });
    expect(document.querySelector(".phone-stay-name")).not.toHaveClass("alone");
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
    expect(canvas().getByText("The essentials")).toBeInTheDocument();

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
    expect(canvas().getByLabelText("Line 1: answer")).toHaveValue("SEABREEZE-5G");
    expect(canvas().getByLabelText("Line 1: detail")).toHaveValue(
      "Password is on the fridge magnet"
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
    expect(phone.getByText("SEABREEZE-5G")).toBeInTheDocument();
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

  it("makes the whole photograph area the control, and marks an empty one with a camera", async () => {
    renderPage();
    await waitFor(() => expect(canvas().getByLabelText("Property name")).toBeInTheDocument());

    // The pill is painted inside the button rather than sitting beside it, so
    // the copy a Host reads and the area they aim at are one control.
    const cover = canvas().getByRole("button", { name: "Add a cover photo" });
    expect(cover.querySelector(".canvas-cover-empty")).toBeTruthy();

    const portrait = canvas().getByRole("button", { name: "Add your photograph" });
    expect(portrait.querySelector(".canvas-portrait-mark")).toBeTruthy();
    // An empty frame asks for a photograph rather than asking a question.
    expect(portrait.textContent).not.toContain("?");
    expect(portrait.querySelector(".canvas-portrait-mark .camera-mark")).toBeTruthy();

    const openPicker = vi.spyOn(HTMLInputElement.prototype, "click");
    fireEvent.click(portrait);
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(openPicker.mock.instances[0]).toBe(
      screen.getByLabelText("Your photograph: choose an image file")
    );
    openPicker.mockRestore();
    expect(screen.queryByRole("dialog", { name: "Your photograph" })).not.toBeInTheDocument();
    const file = new File(["binary"], "portrait.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Your photograph: choose an image file"), { target: { files: [file] } });
    await waitFor(() => expect(uploadPropertyPhoto).toHaveBeenCalledWith("prop-1", "hostPhoto", file, expect.any(Function)));
    await waitFor(() => expect(canvas().getByRole("button", { name: "Change your photograph" })).toBeEnabled());
    expect(screen.queryByRole("dialog", { name: "Your photograph" })).not.toBeInTheDocument();
  });

  it("shows one compact upload status and makes a failed portrait upload retryable", async () => {
    let finish!: (value: unknown) => void;
    uploadPropertyPhoto.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderPage();
    const input = await screen.findByLabelText("Your photograph: choose an image file");
    fireEvent.change(input, { target: { files: [new File(["photo"], "portrait.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByText("Uploading…")).toHaveAttribute("role", "status");
    expect(screen.queryByText(/Uploading photograph|0%/)).not.toBeInTheDocument();
    expect(canvas().getByRole("button", { name: "Add your photograph" })).toBeDisabled();
    finish({ status: "error", message: "Photo storage is unavailable." });
    expect(await screen.findByRole("alert")).toHaveTextContent("Photo storage is unavailable.");
    expect(canvas().getByRole("button", { name: "Add your photograph" })).toBeEnabled();
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
    await screen.findByRole("form", { name: "Property view" });

    // The property view is where /host/property/{id} lands, so the crumb for
    // this property is the page you are already on.
    expect(screen.queryByRole("link", { name: "Seabreeze Cottage" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your properties" })).toHaveAttribute("href", "/host");

    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByText("Property view", { selector: "span[aria-current]" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Public wall" })).toHaveAttribute(
      "href",
      "/host/property/prop-1/public"
    );
    expect(nav.getByRole("link", { name: "Walls and QR display" })).toHaveAttribute(
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
    await screen.findByRole("form", { name: "Property view" });

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
    await screen.findByRole("form", { name: "Property view" });

    expect(screen.queryByRole("link", { name: "Publish this property" })).not.toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByRole("link", { name: "Billing" })).toHaveAttribute("href", "/host/property/prop-1/billing");
  });
});


it('lets long property headings and addresses wrap while keeping stored values single-line', async () => {
  renderPage();
  await screen.findByRole('form', { name: 'Property view' });
  const name = canvas().getByLabelText('Property name');
  const address = canvas().getByLabelText('Where the property is');
  const heading = canvas().getByLabelText('Arrival heading');
  for (const field of [name, address, heading]) {
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: 'A long first line\ncontinued here' } });
    expect(field).toHaveValue('A long first line continued here');
  }
});

