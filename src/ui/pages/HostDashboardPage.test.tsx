import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostDashboardPage } from "./HostDashboardPage";
import { emptyProfile } from "../../domain/propertyProfile";
import type { HostProperty } from "../host/propertyStore";

vi.mock("../../lib/firebaseConfig", () => ({
  firebaseConfig: {},
  firebaseConfigured: true
}));

const listOwnedProperties = vi.fn();
const createProperty = vi.fn();
const uploadPropertyPhoto = vi.fn();

vi.mock("../host/propertyStore", () => ({
  listOwnedProperties: (...args: unknown[]) => listOwnedProperties(...args),
  createProperty: (...args: unknown[]) => createProperty(...args),
  uploadPropertyPhoto: (...args: unknown[]) => uploadPropertyPhoto(...args)
}));

vi.mock("../auth/hostAuth", () => ({ signOutHost: vi.fn() }));

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
    billing: null,
    profile: emptyProfile(),
    ...overrides
  };
}

const hostSession = {
  status: "host",
  user: { uid: "host-a", email: "host@example.com" }
} as unknown as AuthState;

function renderDashboard(state: AuthState = hostSession) {
  return render(
    <AuthContext.Provider value={state}>
      <HostDashboardPage />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listOwnedProperties.mockResolvedValue({ status: "ok", value: [] });
  createProperty.mockResolvedValue({ status: "ok", value: hostProperty() });
  uploadPropertyPhoto.mockResolvedValue({ status: "error", message: "No photograph was chosen." });
});

const openWizard = () => fireEvent.click(screen.getByRole("button", { name: "Add property" }));
const nameField = () => screen.getByLabelText("Property name");
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));

/** Walk the wizard end to end, answering only what a test cares about. */
function addProperty(name: string, answers: { location?: string; hosts?: string } = {}) {
  openWizard();
  fireEvent.change(nameField(), { target: { value: name } });
  if (answers.location) {
    fireEvent.change(screen.getByLabelText(/Where the property is/), { target: { value: answers.location } });
  }
  next();
  if (answers.hosts) {
    // The names are offered on the note rather than laid out empty, the same
    // way the property view offers them.
    fireEvent.click(screen.getByRole("button", { name: "+ your names" }));
    fireEvent.change(screen.getByLabelText("Your names"), { target: { value: answers.hosts } });
  }
  next();
  fireEvent.click(screen.getByRole("button", { name: "Create property" }));
}

describe("host dashboard", () => {
  it("lists the properties this host owns, with their server-owned state", async () => {
    listOwnedProperties.mockResolvedValue({
      status: "ok",
      value: [hostProperty(), hostProperty({ id: "prop-2", name: "The Old Bakery", slug: "the-old-bakery", lifecycle: "draft", mode: "sandbox" })]
    });
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "2 properties" })).toBeInTheDocument();
    expect(listOwnedProperties).toHaveBeenCalledWith("host-a");

    const cottage = screen.getByRole("link", { name: "Seabreeze Cottage" });
    expect(cottage).toHaveAttribute("href", "/host/property/prop-1");
    expect(screen.getByText("/wall/seabreeze-cottage")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("invites a first property instead of showing an empty grid", async () => {
    renderDashboard();
    expect(await screen.findByText(/No properties yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Manage/ })).not.toBeInTheDocument();

    // The empty state offers the same wizard the header does.
    fireEvent.click(screen.getByRole("button", { name: "Add your first property" }));
    expect(nameField()).toBeInTheDocument();
  });

  it("keeps the wizard off the page until a property is being added", async () => {
    renderDashboard();
    await screen.findByText(/No properties yet/i);

    expect(screen.queryByLabelText("Property name")).not.toBeInTheDocument();
    openWizard();
    // It opens as a window over the dashboard rather than a panel within it.
    expect(screen.getByRole("dialog", { name: "Add a property" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("opens the wizard for the header link, which is a fragment on this page", async () => {
    renderDashboard();
    await screen.findByText(/No properties yet/i);

    window.location.hash = "#add-property";
    fireEvent(window, new HashChangeEvent("hashchange"));

    expect(await screen.findByLabelText("Property name")).toBeInTheDocument();

    // Cancelling takes the fragment back off, or the link would fire no
    // `hashchange` the next time it is clicked and nothing would open.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.location.hash).toBe("");
  });

  it("says nothing about the wall address while adding a property", async () => {
    renderDashboard();
    await screen.findByText(/No properties yet/i);
    openWizard();

    expect(screen.queryByRole("textbox", { name: /wall address/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/wall address/i)).not.toBeInTheDocument();
  });

  it("creates an owned sandbox draft from the answers and reloads the list", async () => {
    renderDashboard();
    await screen.findByText(/No properties yet/i);

    addProperty("Seabreeze Cottage", { location: "Porthleven, Cornwall", hosts: "Ana & Tom" });

    await waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    // The address is generated, so the test pins its shape rather than its tail.
    expect(createProperty).toHaveBeenCalledWith("host-a", {
      name: "Seabreeze Cottage",
      slug: expect.stringMatching(/^seabreeze-cottage-[a-z0-9]{4}$/),
      profile: expect.objectContaining({ location: "Porthleven, Cornwall", hosts: "Ana & Tom" })
    });
    expect(await screen.findByText(/Seabreeze Cottage was added/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Seabreeze Cottage/ })).toHaveAttribute(
      "href",
      "/host/property/prop-1"
    );
    expect(listOwnedProperties).toHaveBeenCalledTimes(2);
    // The wizard closes behind the property it made.
    expect(screen.queryByLabelText("Property name")).not.toBeInTheDocument();
  });

  it("validates the property name before writing anything", async () => {
    renderDashboard();
    await screen.findByText(/No properties yet/i);

    openWizard();
    fireEvent.change(nameField(), { target: { value: "A" } });
    next();

    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(createProperty).not.toHaveBeenCalled();
  });

  it("gives two properties with the same name distinct wall addresses", async () => {
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty()] });
    renderDashboard();
    await screen.findByRole("heading", { name: "1 property" });

    addProperty("Seabreeze Cottage");

    await waitFor(() => expect(createProperty).toHaveBeenCalledTimes(1));
    const written = createProperty.mock.calls[0][1] as { slug: string };
    expect(written.slug).not.toBe("seabreeze-cottage");
    expect(written.slug).toMatch(/^seabreeze-cottage-[a-z0-9]{4}$/);
  });

  it("surfaces a rejected write rather than pretending the property exists", async () => {
    createProperty.mockResolvedValue({ status: "error", message: "You do not have access to that property." });
    renderDashboard();
    await screen.findByText(/No properties yet/i);

    addProperty("Seabreeze Cottage");

    expect(await screen.findByText("You do not have access to that property.")).toBeInTheDocument();
    // The wizard stays open on the answers, so nothing typed is lost.
    expect(screen.getByRole("button", { name: "Create property" })).toBeInTheDocument();
    expect(listOwnedProperties).toHaveBeenCalledTimes(1);
  });

  it("gives a draft property the way to publish it, from the list", async () => {
    listOwnedProperties.mockResolvedValue({
      status: "ok",
      value: [hostProperty({ lifecycle: "draft", mode: "sandbox" })]
    });
    renderDashboard();

    const card = within(await screen.findByRole("article", { name: "Seabreeze Cottage" }));
    const publish = card.getByRole("link", { name: "Publish" });
    expect(publish).toHaveAttribute("href", "/host/property/prop-1/billing");
    // The pill says "Draft"; the card says what that means rather than
    // leaving a Host to work out that it is why nobody can see the wall.
    expect(card.getByText(/Not published yet/i)).toBeInTheDocument();
  });

  it("offers no publish control once a property is already live", async () => {
    listOwnedProperties.mockResolvedValue({ status: "ok", value: [hostProperty()] });
    renderDashboard();

    const card = within(await screen.findByRole("article", { name: "Seabreeze Cottage" }));
    expect(card.queryByRole("link", { name: "Publish" })).not.toBeInTheDocument();
    expect(card.getByRole("link", { name: "Manage" })).toBeInTheDocument();
  });

  it("reports a failed load instead of an empty property list", async () => {
    listOwnedProperties.mockResolvedValue({ status: "error", message: "We could not reach the database." });
    renderDashboard();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("We could not reach the database.")).toBeInTheDocument();
    expect(screen.queryByText(/No properties yet/i)).not.toBeInTheDocument();
  });
});
