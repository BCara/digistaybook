import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GuestContribution } from "./GuestContribution";
import { guestPolicy } from "../../../functions/src/guestPolicy";
const call = vi.fn();
vi.mock("../../lib/guestSession", () => ({ guestCall: (...args: unknown[]) => call(...args) }));
beforeEach(() => { call.mockReset(); call.mockImplementation(async (_slug, name) => name === "listGuestContributions" ? { posts: [] } : {}); });

it("loads later memories without duplicating existing ones and keeps the cursor on failure", async () => {
  let pages = 0;
  call.mockImplementation(async (_slug, name, data) => {
    if (name !== "listGuestContributions") return {};
    if (!data.cursor) return { posts: [{ id: "first", message: "First memory", revision: 1, status: "pending" }], nextCursor: "first" };
    if (++pages === 1) throw new Error("offline");
    return { posts: [{ id: "first", message: "First memory", revision: 1, status: "pending" }, { id: "later", message: "Older memory", revision: 1, status: "pending" }], nextCursor: null };
  });
  render(<GuestContribution slug="cottage" onChanged={() => {}} />);
  fireEvent.click(screen.getByText("Your memories in this browser"));
  fireEvent.click(await screen.findByRole("button", { name: "Load more memories" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Load more memories" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Load more memories" }));
  await screen.findByText("Older memory");
  expect(screen.getAllByText("First memory")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Load more memories" })).not.toBeInTheDocument();
});

it("requires consent and does not collect a guest name or email", async () => {
  render(<GuestContribution slug="cottage" onChanged={() => {}} />);
  await screen.findByText("Your memories in this browser");
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "A lovely stay" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit memory" }));
  expect(screen.getByRole("status")).toHaveTextContent(/accept the consent/);
  expect(call.mock.calls.some(([, name]) => name === "beginGuestContribution")).toBe(false);
  expect(screen.queryByLabelText(/email|your name/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Guest Terms" })).toHaveAttribute("href", "/guest-terms");
});

it("retains one request ID after a lost response and sends no feedback with a memory", async () => {
  let attempts = 0;
  call.mockImplementation(async (_slug, name) => {
    if (name === "listGuestContributions") return { posts: [] };
    if (name === "beginGuestContribution") { if (++attempts === 1) throw new Error("Connection lost"); return { id: "submission" }; }
    if (name === "finishGuestContribution") return { status: "pending", message: "Saved and waiting for safety screening." };
    return {};
  });
  const changed = vi.fn();
  render(<GuestContribution slug="cottage" onChanged={changed} />);
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "A lovely stay" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Submit memory" }));
  await screen.findByRole("button", { name: "Retry this submission" });
  expect(screen.getByLabelText("Your message")).toHaveValue("A lovely stay");
  fireEvent.click(screen.getByRole("button", { name: "Retry this submission" }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  const starts = call.mock.calls.filter(([, name]) => name === "beginGuestContribution");
  expect(starts[0][2].requestId).toBe(starts[1][2].requestId);
  expect(starts[1][2]).toMatchObject({ message: "A lovely stay", feedback: "", consentVersion: guestPolicy.consentVersion });
  expect(screen.getByRole("status")).toHaveTextContent("Saved and waiting");
});

it("rejects more than ten photos and lets guests remove a selection", async () => {
  render(<GuestContribution slug="cottage" onChanged={() => {}} />);
  const file = () => new File(["test"], "photo.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Choose photos"), { target: { files: Array.from({ length: 11 }, file) } });
  expect(screen.getByRole("status")).toHaveTextContent(/no more than ten/);
  fireEvent.change(screen.getByLabelText("Choose photos"), { target: { files: [file()] } });
  expect(screen.getByRole("img", { name: "Selected photo 1" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("uses the server revision for self-edit and self-delete", async () => {
  call.mockImplementation(async (_slug, name) => name === "listGuestContributions" ? { posts: [{ id: "own", message: "Original", revision: 3, status: "pending" }] } : { status: "pending" });
  render(<GuestContribution slug="cottage" onChanged={() => {}} />);
  fireEvent.click(screen.getByText("Your memories in this browser"));
  fireEvent.click(await screen.findByRole("button", { name: "Edit message" }));
  fireEvent.change(screen.getByLabelText("Edit your message"), { target: { value: "Updated" } });
  fireEvent.click(screen.getByRole("button", { name: "Save message" }));
  await waitFor(() => expect(call).toHaveBeenCalledWith("cottage", "changeGuestContribution", { id: "own", revision: 3, action: "edit", message: "Updated" }));
});

it("sends private feedback as its own submission, without the memory fields or consent", async () => {
  call.mockImplementation(async (_slug, name) => {
    if (name === "listGuestContributions") return { posts: [] };
    if (name === "beginGuestContribution") return { id: "feedback-only" };
    if (name === "finishGuestContribution") return { status: "feedback", message: "Thanks — your feedback has been sent to your host." };
    return {};
  });
  render(<GuestContribution slug="cottage" onChanged={() => {}} />);
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Draft memory" } });
  fireEvent.click(screen.getByRole("radio", { name: "Private feedback for your host" }));
  expect(screen.getByRole("heading", { name: "Private feedback for your host" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Your message")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Choose photos")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByText(/threats, sexual content or hate may be held/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Send to host" }));
  expect(screen.getByRole("status")).toHaveTextContent("Write your feedback before sending it.");
  fireEvent.change(screen.getByLabelText("Private feedback"), { target: { value: "The smoke alarm beeps all night" } });
  fireEvent.click(screen.getByRole("button", { name: "Send to host" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("your feedback has been sent"));
  const start = call.mock.calls.find(([, name]) => name === "beginGuestContribution")![2];
  expect(start).toMatchObject({ message: "", photoCount: 0, feedback: "The smoke alarm beeps all night" });
  expect(start).not.toHaveProperty("consentAccepted");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "A memory for the wall" }));
  expect(screen.getByLabelText("Your message")).toHaveValue("Draft memory");
});

it("asks for a message or a photo before submitting a memory", async () => {
  render(<GuestContribution slug="cottage" onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Submit memory" }));
  expect(screen.getByRole("status")).toHaveTextContent("Add a message or at least one photo.");
  expect(call.mock.calls.some(([, name]) => name === "beginGuestContribution")).toBe(false);
});
