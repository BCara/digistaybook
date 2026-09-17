import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { emptyProfile, exampleNote } from "../../domain/propertyProfile";
import { AddPropertyDialog } from "./PropertyDialog";
import type { HostProperty } from "./propertyStore";

const createProperty = vi.fn();
const uploadPropertyPhoto = vi.fn();

vi.mock("./propertyStore", () => ({
  createProperty: (...args: unknown[]) => createProperty(...args),
  uploadPropertyPhoto: (...args: unknown[]) => uploadPropertyPhoto(...args)
}));

const created: HostProperty = {
  id: "prop-1",
  ownerUid: "host-a",
  name: "Seabreeze Cottage",
  slug: "seabreeze-cottage-b7kq",
  lifecycle: "draft",
  mode: "sandbox",
  foundationalPostCount: 0,
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T10:00:00.000Z",
  billing: null,
  profile: emptyProfile()
};

const photo = (slot: string) => ({
  path: `properties/prop-1/media/${slot}-1.jpg`,
  url: `https://example.test/${slot}.jpg`,
  alt: "",
  width: 1500,
  height: 660
});

const onCreated = vi.fn();
const onCancel = vi.fn();

function renderDialog(takenSlugs: string[] = []) {
  return render(
    <AddPropertyDialog ownerUid="host-a" takenSlugs={takenSlugs} onCancel={onCancel} onCreated={onCreated} />
  );
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));
const back = () => fireEvent.click(screen.getByRole("button", { name: "Back" }));
const create = () => fireEvent.click(screen.getByRole("button", { name: "Create property" }));

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** A JPEG small enough to pass the size check; its bytes are never read. */
const imageFile = (name = "cottage.jpg", type = "image/jpeg") => new File(["binary"], name, { type });

const choosePhoto = (label: string, file = imageFile()) =>
  fireEvent.change(screen.getByLabelText(`${label}: choose an image file`), { target: { files: [file] } });

/** Put a line the note does not start with on the step, the way a host does. */
const include = (label: string) => fireEvent.click(screen.getByRole("button", { name: `+ ${label}` }));

/** Walk to the end, answering only what a test cares about. */
function walk(name: string, answers: { location?: string; hosts?: string; tip?: string } = {}) {
  type("Property name", name);
  if (answers.location) type(/Where the property is/, answers.location);
  next();
  if (answers.tip) {
    include("a local recommendation");
    type("One local recommendation", answers.tip);
  }
  if (answers.hosts) {
    include("your names");
    type("Your names", answers.hosts);
  }
  next();
}

beforeEach(() => {
  vi.resetAllMocks();
  createProperty.mockResolvedValue({ status: "ok", value: created });
  uploadPropertyPhoto.mockResolvedValue({ status: "ok", value: photo("cover") });
});

describe("adding a property", () => {
  it("opens over the page as a window, on the property's own questions", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Add a property" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("Step 1 of 3")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "The property", level: 3 })).toBeInTheDocument();

    // Everything the first step asks, and nothing from the steps after it.
    expect(screen.getByLabelText("Property name")).toBeInTheDocument();
    expect(screen.getByLabelText(/Where the property is/)).toBeInTheDocument();
    expect(screen.getByLabelText("Main photo: choose an image file")).toBeInTheDocument();
    expect(screen.getByLabelText("Cover photo: choose an image file")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your names")).not.toBeInTheDocument();
  });

  it("says nothing about the wall address while adding a property", () => {
    renderDialog();

    expect(screen.queryByRole("textbox", { name: /wall address/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/wall address/i)).not.toBeInTheDocument();
  });

  it("asks what a guest reads on the second step, and the weekly questions on the third", () => {
    renderDialog();

    type("Property name", "Seabreeze Cottage");
    next();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    // The note's own lines, under the names the property view gives them.
    expect(screen.getByLabelText("Arrival heading")).toBeInTheDocument();
    // The note arrives empty with an example shown in it, so a host is spared a
    // blank sheet without being given words they never wrote.
    expect(screen.getByLabelText("Arrival note")).toHaveValue("");
    expect(screen.getByLabelText("Arrival note")).toHaveAttribute("placeholder", exampleNote.welcome);
    expect(screen.getByLabelText("Arrival heading")).toHaveValue("");
    // The rest are offered where they would stand, not laid out empty.
    expect(screen.queryByLabelText("One local recommendation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Your names")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ a local recommendation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ your names" })).toBeInTheDocument();

    // Nothing the property view does not carry on this wall.
    expect(screen.queryByLabelText(/A welcome for the wall/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Hosting here since/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Your photograph/)).not.toBeInTheDocument();

    next();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "House guidance", level: 4 })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Your note/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create property" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("writes one property carrying every answer, and the address derived from the name", async () => {
    renderDialog();

    walk("Seabreeze Cottage", {
      location: "Porthleven, Cornwall",
      hosts: "Ana & Tom",
      tip: "The bakery behind the lighthouse."
    });
    create();

    await waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    expect(createProperty).toHaveBeenCalledWith("host-a", {
      name: "Seabreeze Cottage",
      // The address is generated, so this pins its shape rather than its tail.
      slug: expect.stringMatching(/^seabreeze-cottage-[a-z0-9]{4}$/),
      profile: expect.objectContaining({
        location: "Porthleven, Cornwall",
        hosts: "Ana & Tom",
        stayTip: "The bakery behind the lighthouse.",
        // The example is never stored: a host who typed no note has none.
        stayWelcome: ""
      })
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ property: created, photoWarning: null }));
  });

  it("holds the host on the first step until the property has a name", () => {
    renderDialog();

    type("Property name", "A");
    next();

    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(createProperty).not.toHaveBeenCalled();
  });

  it("keeps what was typed when a host steps back to change it", () => {
    renderDialog();

    walk("Seabreeze Cottage", { hosts: "Ana & Tom" });
    back();
    expect(screen.getByLabelText("Your names")).toHaveValue("Ana & Tom");
    back();
    expect(screen.getByLabelText("Property name")).toHaveValue("Seabreeze Cottage");
  });

  it("creates a property from the name alone, leaving the rest for later", async () => {
    renderDialog();

    walk("Seabreeze Cottage");
    create();

    await waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    expect(uploadPropertyPhoto).not.toHaveBeenCalled();
  });

  it("refuses a guidance line that would reach a guest as a dangling label", async () => {
    renderDialog();

    walk("Seabreeze Cottage");
    fireEvent.click(screen.getByRole("button", { name: "+ Wi-Fi" }));
    create();

    expect(screen.getByRole("alert")).toHaveTextContent(/Wi-Fi/);
    expect(createProperty).not.toHaveBeenCalled();

    // Answering it is enough; the blank rows a form always carries are dropped.
    fireEvent.change(screen.getByLabelText("Line 1: answer"), { target: { value: "SEABREEZE-5G" } });
    create();

    await waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    expect(createProperty.mock.calls[0][1].profile.facts).toEqual([
      { term: "Wi-Fi", detail: "SEABREEZE-5G", note: "" }
    ]);
  });

  it("uploads every staged photograph only once the property they belong to exists", async () => {
    uploadPropertyPhoto
      .mockResolvedValueOnce({ status: "ok", value: photo("avatar") })
      .mockResolvedValueOnce({ status: "ok", value: photo("cover") })
      .mockResolvedValueOnce({ status: "ok", value: photo("hostNote") });
    renderDialog();
    const main = imageFile("door.jpg");
    const cover = imageFile("front.jpg");
    const note = imageFile("us.jpg");

    type("Property name", "Seabreeze Cottage");
    choosePhoto("Main photo", main);
    choosePhoto("Cover photo", cover);
    next();
    next();
    choosePhoto("Photograph", note);
    // Nothing has left the device yet: the property has no id to store it under.
    expect(uploadPropertyPhoto).not.toHaveBeenCalled();

    create();

    await waitFor(() => expect(uploadPropertyPhoto).toHaveBeenCalledTimes(3));
    // The main photo is the property's own small one: the avatar slot.
    expect(uploadPropertyPhoto).toHaveBeenNthCalledWith(1, "prop-1", "avatar", main);
    expect(uploadPropertyPhoto).toHaveBeenNthCalledWith(2, "prop-1", "cover", cover);
    // A note's picture goes to the note's own slot, named for the note rather
    // than for a position in a list that moves when one above it is removed.
    expect(uploadPropertyPhoto).toHaveBeenNthCalledWith(
      3,
      "prop-1",
      expect.stringMatching(/^hostNote:[a-zA-Z0-9]+$/),
      note
    );
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({
        property: {
          ...created,
          profile: {
            ...created.profile,
            avatar: photo("avatar"),
            hostPhoto: photo("avatar"),
            cover: photo("cover"),
            // The note was never written into, so it is stored as the picture
            // and nothing else — which is what the upload wrote.
            hostNotes: [
              { id: expect.any(String), message: "", style: "bordered", photo: photo("hostNote") }
            ]
          }
        },
        photoWarning: null
      })
    );
  });

  it("never asks a host to describe the photograph they chose", () => {
    renderDialog();

    choosePhoto("Cover photo");

    // The description a screen reader is read comes from the slot, so there is
    // nothing between choosing a file and moving on.
    expect(screen.queryByLabelText(/Describe/i)).not.toBeInTheDocument();
    // The file it is holding is named, so a host can see which one they chose.
    expect(screen.getByText("cottage.jpg")).toBeInTheDocument();
  });

  it("refuses a file that is not an image a phone can load", () => {
    renderDialog();

    choosePhoto("Cover photo", imageFile("floorplan.pdf", "application/pdf"));

    expect(screen.getByRole("alert")).toHaveTextContent(/JPEG, PNG or WebP/i);
    expect(screen.getAllByText("No photograph yet.")).toHaveLength(2);
  });

  it("reports a failed write instead of pretending the property exists", async () => {
    createProperty.mockResolvedValue({ status: "error", message: "You do not have access to that property." });
    renderDialog();

    walk("Seabreeze Cottage");
    create();

    expect(await screen.findByText("You do not have access to that property.")).toBeInTheDocument();
    // The window stays open on the answers, so nothing typed is lost.
    expect(screen.getByRole("button", { name: "Create property" })).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("keeps a property whose photograph failed, and says which one did not upload", async () => {
    uploadPropertyPhoto.mockResolvedValue({ status: "error", message: "The database did not respond in time." });
    renderDialog();

    type("Property name", "Seabreeze Cottage");
    choosePhoto("Cover photo");
    next();
    next();
    create();

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({
        property: created,
        photoWarning: "The cover photo did not upload: The database did not respond in time."
      })
    );
  });

  it("never reuses an address this host already holds", async () => {
    renderDialog(["seabreeze-cottage"]);

    walk("Seabreeze Cottage");
    create();

    await waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    expect(createProperty.mock.calls[0][1].slug).not.toBe("seabreeze-cottage");
  });

  it("writes nothing when it is closed", () => {
    renderDialog();

    type("Property name", "Seabreeze Cottage");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(createProperty).not.toHaveBeenCalled();
  });

  it("closes on Escape, the way a window over the page is expected to", () => {
    renderDialog();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(createProperty).not.toHaveBeenCalled();
  });
});
