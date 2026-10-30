import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { emptyProfile } from "../../domain/propertyProfile";
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

const onCreated = vi.fn(), onCancel = vi.fn();
function renderDialog(ownerUid: string | null = "host-a") {
  return render(<AddPropertyDialog ownerUid={ownerUid} takenSlugs={[]} onCancel={onCancel} onCreated={onCreated} />);
}
const enterName = (value: string) => fireEvent.change(screen.getByLabelText("Property name"), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));
beforeEach(() => {
  vi.clearAllMocks();
  createProperty.mockResolvedValue({ status: "ok", value: created });
});

describe("name-first property creation", () => {
  it("asks for just a name, with no wizard, photos or address", () => {
    renderDialog();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByText(/Step 1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cover photo/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Add a property" })).toHaveAttribute("aria-modal", "true");
  });
  it("creates one private property with only its name and empty sections", async () => {
    renderDialog(); enterName("  Seabreeze Cottage  "); submit();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ property: created, photoWarning: null }));
    expect(createProperty).toHaveBeenCalledWith("host-a", { name: "Seabreeze Cottage", slug: expect.stringMatching(/^seabreeze-cottage-[a-z0-9]{4}$/), profile: emptyProfile() });
    expect(uploadPropertyPhoto).not.toHaveBeenCalled();
  });
  it.each(["", "A"])("refuses the required name %s", value => {
    renderDialog(); enterName(value); submit();
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 2 characters/);
    expect(createProperty).not.toHaveBeenCalled();
  });
  it("keeps the entered name and reuses the same reservation when retrying", async () => {
    createProperty.mockResolvedValueOnce({ status: "error", message: "Connection lost." });
    renderDialog(); enterName("Seabreeze Cottage"); submit();
    expect(await screen.findByText("Connection lost.")).toBeInTheDocument();
    expect(screen.getByLabelText("Property name")).toHaveValue("Seabreeze Cottage");
    submit(); await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createProperty.mock.calls[0][1].slug).toBe(createProperty.mock.calls[1][1].slug);
  });
  it("prevents duplicate creation and cancellation while the request is pending", async () => {
    let finish!: (value: unknown) => void;
    createProperty.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    renderDialog(); enterName("Seabreeze Cottage"); submit();
    fireEvent.submit(screen.getByLabelText("Property name").closest("form")!);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(createProperty).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    finish({ status: "ok", value: created });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });
  it("allows cancelling before a property is created", () => {
    renderDialog(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1); expect(createProperty).not.toHaveBeenCalled();
  });
  it("does not create without a host session", () => {
    renderDialog(null); enterName("Seabreeze Cottage");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(createProperty).not.toHaveBeenCalled();
  });
});