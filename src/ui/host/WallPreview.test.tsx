import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { emptyProfile } from "../../domain/propertyProfile";
import { WallPreview } from "./WallPreview";
import { loadPreviewMemories, type PreviewMemoriesPage } from "./wallPreviewStore";
import type { StoreOutcome } from "./propertyStore";

vi.mock("./wallPreviewStore", () => ({ loadPreviewMemories: vi.fn() }));
vi.mock("../../lib/guestSession", () => ({ guestPhotoUrl: (id: string, index: number) => `/memory/${id}/${index}` }));

const load = vi.mocked(loadPreviewMemories);
const memory = { id: "walk", message: "We loved the harbour walk.", displayName: "Alex & Sam", photoCount: 2 };
const props = { name: "Cottage", profile: emptyProfile(), slug: "cottage", stayToken: "stay-token", counts: { visible: 1, hidden: 2 } };

beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue({ status: "ok", value: { posts: [memory], nextCursor: null } });
});

it.each(["stay", "public"] as const)("shows the published memories and photos in the %s phone preview", async view => {
  const { rerender } = render(<WallPreview {...props} view={view} />);
  const phone = within(screen.getByRole("group", { name: "On a phone" }));
  expect(await phone.findByText(memory.message)).toBeInTheDocument();
  expect(phone.getByText(memory.displayName)).toBeInTheDocument();
  expect(phone.getByRole("img", { name: "Guest memory photo 1" })).toHaveAttribute("src", "/memory/walk/0");
  expect(phone.getByRole("img", { name: "Guest memory photo 2" })).toHaveAttribute("src", "/memory/walk/1");
  expect(load).toHaveBeenCalledWith("cottage", view, "stay-token", undefined);
  rerender(<WallPreview {...props} profile={{ ...props.profile, hosts: "Updated hosts" }} view={view} />);
  expect(phone.getByText(memory.message)).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(1);
});

it("keeps existing cards when loading more and avoids duplicated memories", async () => {
  load.mockResolvedValueOnce({ status: "ok", value: { posts: [memory], nextCursor: "walk" } });
  load.mockResolvedValueOnce({ status: "ok", value: { posts: [memory, { id: "garden", message: "Breakfast in the garden.", displayName: "" }], nextCursor: null } });
  render(<WallPreview {...props} view="stay" />);
  fireEvent.click(await screen.findByRole("button", { name: "Load more memories" }));
  expect(await screen.findByText("Breakfast in the garden.")).toBeInTheDocument();
  expect(screen.getAllByText(memory.message)).toHaveLength(1);
  expect(load).toHaveBeenLastCalledWith("cottage", "stay", "stay-token", "walk");
  expect(screen.queryByRole("button", { name: "Load more memories" })).not.toBeInTheDocument();
});

it("shows an empty state only after a successful empty read", async () => {
  load.mockResolvedValue({ status: "ok", value: { posts: [], nextCursor: null } });
  render(<WallPreview {...props} counts={{ visible: 0, hidden: 2 }} view="stay" />);
  expect(await screen.findByText("No memories yet.")).toBeInTheDocument();
  expect(screen.queryByText(memory.message)).not.toBeInTheDocument();
});

it("offers a retry when loading fails without calling it an empty wall", async () => {
  load.mockResolvedValueOnce({ status: "error", message: "Memories could not load." });
  render(<WallPreview {...props} view="stay" />);
  expect(await screen.findByText("Memories could not load.")).toBeInTheDocument();
  expect(screen.queryByText("No memories yet.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(memory.message)).toBeInTheDocument();
  expect(screen.queryByText("Memories could not load.")).not.toBeInTheDocument();
});

it("does not carry another property's memories or a late response into the preview", async () => {
  let finish!: (result: StoreOutcome<PreviewMemoriesPage>) => void;
  load.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  load.mockResolvedValueOnce({ status: "ok", value: { posts: [{ id: "other", message: "A different cottage.", displayName: "Jo" }], nextCursor: null } });
  const { rerender } = render(<WallPreview {...props} view="stay" />);
  rerender(<WallPreview {...props} slug="other-cottage" view="stay" />);
  expect(await screen.findByText("A different cottage.")).toBeInTheDocument();
  finish({ status: "ok", value: { posts: [memory], nextCursor: null } });
  await waitFor(() => expect(screen.queryByText("Loading memories…")).not.toBeInTheDocument());
  expect(screen.queryByText(memory.message)).not.toBeInTheDocument();
});
