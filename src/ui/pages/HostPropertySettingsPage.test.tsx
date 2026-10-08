import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostPropertySettingsPage } from "./HostPropertySettingsPage";
import { emptyProfile, type PropertyProfile } from "../../domain/propertyProfile";
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

const avatarPhoto = {
  path: "properties/prop-1/media/avatar-1.jpg",
  url: "https://example.test/avatar.jpg",
  alt: "The blue front door",
  width: 400,
  height: 400
};

function profile(overrides: Partial<PropertyProfile> = {}): PropertyProfile {
  return { ...emptyProfile(), ...overrides };
}

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
    billing: { trialEndsAt: null, currentPeriodEndsAt: "2026-10-01T00:00:00.000Z", lastPaymentAt: null, renewalAmount: null, renewalCurrency: null, renewalInterval: null },
    profile: profile({ location: "St Anthony Head, Cornwall", hosts: "Ana & Tom" }),
    ...overrides
  };
}

const hostSession = { status: "host", user: { uid: "host-a", email: "host@example.com" } } as unknown as AuthState;

function renderPage(state: AuthState = hostSession) {
  return render(
    <AuthContext.Provider value={state}>
      <HostPropertySettingsPage propertyId="prop-1" />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // The window is open because the route says so, and closing it is a
  // navigation back to the wall. Each test starts on the route that opens it.
  window.history.replaceState(null, "", "/host/property/prop-1/settings");
  loadProperty.mockResolvedValue({ status: "ok", value: hostProperty() });
  loadWallCounts.mockResolvedValue({ status: "ok", value: { visible: 12, hidden: 1 } });
  savePropertyName.mockImplementation((_id: string, name: string) =>
    Promise.resolve({ status: "ok", value: { name } })
  );
  savePropertyProfile.mockImplementation((_id: string, saved: PropertyProfile) =>
    Promise.resolve({ status: "ok", value: saved })
  );
  uploadPropertyPhoto.mockResolvedValue({ status: "ok", value: avatarPhoto });
  removePropertyPhoto.mockResolvedValue({ status: "ok", value: null });
});

/**
 * The wall is still on the page behind the window and carries the same lines,
 * so every query here is scoped to the window. The page underneath is inert to
 * a screen reader for the same reason.
 */
const dialog = () => within(screen.getByRole("dialog", { name: "Property settings" }));

const settled = async () => {
  await waitFor(() => expect(dialog().getByLabelText("Property name")).toHaveValue("Seabreeze Cottage"));
};

const next = () => fireEvent.click(dialog().getByRole("button", { name: "Next" }));

/** Walk to the last step, where the one save button is. */
const toEnd = () => {
  next();
  next();
};

describe("the settings of one property", () => {
  it("opens as a window over the property view, on the same steps it was added through", async () => {
    renderPage();
    await settled();

    expect(screen.getByRole("dialog", { name: "Property settings" })).toHaveAttribute("aria-modal", "true");
    expect(dialog().getByText("Step 1 of 3")).toBeInTheDocument();
    expect(dialog().getByLabelText(/Where the property is/)).toHaveValue("St Anthony Head, Cornwall");
    // The wall it is standing over is still there, and still the property view.
    expect(screen.getByRole("form", { name: "Property view" })).toBeInTheDocument();
  });

  it("carries everything the wall carries, not just what the property is", async () => {
    renderPage();
    await settled();

    next();
    // The arrival note, in the order and under the names the property view uses.
    expect(dialog().getByLabelText("Arrival heading")).toBeInTheDocument();
    expect(dialog().getByLabelText("Arrival note")).toBeInTheDocument();
    expect(dialog().getByLabelText("Your names")).toHaveValue("Ana & Tom");

    next();
    expect(dialog().getByRole("heading", { name: "House guidance", level: 4 })).toBeInTheDocument();
    expect(dialog().getByLabelText(/^Your note/)).toBeInTheDocument();
  });

  it("saves the name and the place together, from the last step", async () => {
    renderPage();
    await settled();

    fireEvent.change(dialog().getByLabelText("Property name"), { target: { value: "Seabreeze Cottage & Barn" } });
    fireEvent.change(dialog().getByLabelText(/Where the property is/), {
      target: { value: "Portscatho, Cornwall" }
    });
    toEnd();
    fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(savePropertyName).toHaveBeenCalledWith("prop-1", "Seabreeze Cottage & Barn"));
    const [, saved] = savePropertyProfile.mock.calls[0] as [string, PropertyProfile];
    expect(saved.location).toBe("Portscatho, Cornwall");
    // A save that landed puts the host back on the wall it was standing over.
    await waitFor(() => expect(window.location.pathname).toBe("/host/property/prop-1"));
  });

  it("says what is wrong with a name rather than writing it, on the step that asked", async () => {
    renderPage();
    await settled();

    fireEvent.change(dialog().getByLabelText("Property name"), { target: { value: " " } });
    next();

    // The step is checked as it is left, so a host is told about the name
    // while they are still looking at it rather than two steps later.
    expect(dialog().getByText("Step 1 of 3")).toBeInTheDocument();
    expect(dialog().getByLabelText("Property name")).toHaveAttribute("aria-invalid", "true");
    expect(savePropertyName).not.toHaveBeenCalled();
  });

  it("renames the band overhead as the name is typed, before anything is saved", async () => {
    renderPage();
    await settled();

    fireEvent.change(dialog().getByLabelText("Property name"), { target: { value: "The Barn" } });
    expect(screen.getByRole("heading", { name: "The Barn", level: 1 })).toBeInTheDocument();
  });

  it("is reached from the band, and marks itself there rather than linking back", async () => {
    renderPage();
    await settled();

    expect(screen.getByLabelText("Settings", { selector: ".banner-settings" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: /Settings/ })).not.toBeInTheDocument();
    // It is not one of the ways of looking at the wall, so no row in the
    // column claims to be where you are standing.
    const nav = within(screen.getByRole("navigation", { name: "This property" }));
    expect(nav.getByRole("link", { name: "Property view" })).toHaveAttribute("href", "/host/property/prop-1");
    expect(nav.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("states the wall address and does not offer to change it", async () => {
    renderPage();
    await settled();

    expect(dialog().getByText("/wall/seabreeze-cottage")).toBeInTheDocument();
    expect(dialog().queryByRole("textbox", { name: /wall address/i })).not.toBeInTheDocument();
  });

  it("writes a chosen photograph straight to the property, with nothing else asked", async () => {
    renderPage();
    await settled();

    const file = new File(["x"], "door.jpg", { type: "image/jpeg" });
    fireEvent.change(dialog().getByLabelText("Main photo: choose an image file"), { target: { files: [file] } });
    // The description a screen reader is read comes from the slot, so choosing
    // the file is the whole of what is asked.
    expect(dialog().queryByLabelText(/Describe/i)).not.toBeInTheDocument();
    fireEvent.click(dialog().getByRole("button", { name: "Save photograph" }));

    await waitFor(() => expect(uploadPropertyPhoto).toHaveBeenCalledWith("prop-1", "avatar", file, expect.any(Function)));
    // A photograph is stored as it uploads, so once it has landed the file
    // waiting on the device is let go of and the stored one is what is shown.
    await waitFor(() => expect(dialog().queryByText("door.jpg")).not.toBeInTheDocument());
    expect(savePropertyProfile).not.toHaveBeenCalled();
  });

  it("closes on Escape without writing anything", async () => {
    renderPage();
    await settled();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(window.location.pathname).toBe("/host/property/prop-1"));
    expect(savePropertyName).not.toHaveBeenCalled();
    expect(savePropertyProfile).not.toHaveBeenCalled();
  });
});
