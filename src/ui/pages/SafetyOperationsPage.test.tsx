import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const call = vi.fn();
vi.mock("../host/GuestReviewPanel", () => ({ hostCall: (...args: unknown[]) => call(...args) }));
import { SafetyOperationsPage } from "./SafetyOperationsPage";

it("shows incomplete screening and its reason without labelling content harmful", async () => {
  call.mockImplementation(async (name: string) => name === "listSafetyOperations"
    ? { items: [{ id: "g1:1", propertyId: "cottage", status: "open", kind: "guest_memory", reviewDueAt: null, screeningStatus: "incomplete", screeningIncompleteReason: "daily_allowance_reached" }], nextCursor: null }
    : { id: "g1:1", kind: "guest_memory", source: "incomplete_screening", categories: ["Screening incomplete"], status: "open", message: "An ordinary memory", screeningStatus: "incomplete", screeningIncompleteReason: "daily_allowance_reached" });
  render(<SafetyOperationsPage />);
  fireEvent.change(screen.getByLabelText("Queue"), { target: { value: "trustSafetyCases" } });
  expect(await screen.findByText("Screening incomplete")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "Open case" }));
  expect(await screen.findByText(/manual review request, not a harmful-content classification/)).toBeInTheDocument();
  expect(screen.getByText("An ordinary memory")).toBeInTheDocument();
});

it("rechecks manual consent deletion and shows the exact record only when due", async () => {
  let completed = false;
  call.mockImplementation(async (name: string) => {
    if (name === "listSafetyOperations") return { items: [{ id: "consent-1", propertyId: "cottage", status: completed ? "completed" : "due", kind: "consent_deletion_review", reviewDueAt: null }], nextCursor: null };
    if (name === "readConsentDeletionReview") return { id: "consent-1", status: completed ? "completed" : "due", consentPath: "guestConsent/consent-1", reason: "Retention period ended", manualAction: "Delete this consent record manually", dueAt: "2026-10-05T00:00:00Z", recordUrl: "https://console.firebase.google.com/consent-1", completionEvidence: completed ? "Consent record absence observed" : null };
  });
  render(<SafetyOperationsPage />);
  fireEvent.change(screen.getByLabelText("Queue"), { target: { value: "consentDeletionReview" } });
  fireEvent.click(await screen.findByRole("button", { name: "Check consent retention" }));
  expect(await screen.findByRole("link", { name: "Open exact consent record in Firebase console" })).toHaveAttribute("href", "https://console.firebase.google.com/consent-1");
  completed = true;
  fireEvent.click(screen.getByRole("button", { name: "Recheck record after manual deletion" }));
  expect(await screen.findByText("Consent record absence observed")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Open exact consent record in Firebase console" })).not.toBeInTheDocument();
});

it("opens held private feedback and releases it to the host with a note", async () => {
  call.mockImplementation(async (name: string) => {
    if (name === "listSafetyOperations") return { items: [{ id: "feedback-g1", propertyId: "cottage", status: "open", kind: "private_feedback", reviewDueAt: null }], nextCursor: null };
    if (name === "readSafetyCase") return { id: "feedback-g1", source: "automated_screening", categories: ["Violent"], status: "open", message: "I'll kill the next spider I see" };
    return { status: "released" };
  });
  render(<SafetyOperationsPage />);
  fireEvent.change(screen.getByLabelText("Queue"), { target: { value: "trustSafetyCases" } });
  fireEvent.click(await screen.findByRole("button", { name: "Open case" }));
  expect(await screen.findByText("I'll kill the next spider I see")).toBeInTheDocument();
  expect(screen.getByText(/Held by automated screening: Violent/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Decision note (optional)"), { target: { value: "About a spider" } });
  fireEvent.click(screen.getByRole("button", { name: "Release to host" }));
  await waitFor(() => expect(call).toHaveBeenCalledWith("resolveSafetyCase", { id: "feedback-g1", action: "release", note: "About a spider" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Released");
});

it("opens memory photos and releases a memory without promising publication", async () => {
  call.mockImplementation(async (name: string) => {
    if (name === "listSafetyOperations") return { items: [{ id: "g1:1", propertyId: "cottage", status: "open", kind: "guest_memory", reviewDueAt: null }], nextCursor: null };
    if (name === "readSafetyCase") return { id: "g1:1", kind: "guest_memory", source: "automated_screening", categories: ["Photo violence"], status: "open", message: "Museum display", photoCount: 1 };
    if (name === "readSafetyCasePhoto") return { base64: "cGhvdG8=" };
    return { status: "released" };
  });
  render(<SafetyOperationsPage />);
  fireEvent.change(screen.getByLabelText("Queue"), { target: { value: "trustSafetyCases" } });
  fireEvent.click(await screen.findByRole("button", { name: "Open case" }));
  fireEvent.click(await screen.findByRole("button", { name: "View 1 case photos" }));
  expect(await screen.findByAltText("Safety case photo 1")).toHaveAttribute("src", "data:image/webp;base64,cGhvdG8=");
  expect(call).toHaveBeenCalledWith("readSafetyCasePhoto", { id: "g1:1", index: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Release to host" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("It has not been published.");
});

it("summarises every queue and lists outstanding items oldest first with their queue", async () => {
  call.mockReset();
  call.mockImplementation(async () => ({
    items: [
      { id: "old", queue: "privacyRequests", propertyId: null, status: "escalated", kind: "takedown", receivedAt: "2026-01-02T00:00:00Z", outstanding: true, reviewDueAt: "2026-01-16T00:00:00Z" },
      { id: "new", queue: "trustSafetyCases", propertyId: "cottage", status: "open", kind: "guest_memory", receivedAt: "2026-10-01T00:00:00Z", outstanding: true, reviewDueAt: null }
    ],
    summary: [{ queue: "privacyRequests", total: 4, outstanding: 1, overdue: 1, oldestOutstandingAt: "2026-01-02T00:00:00Z" },
      { queue: "trustSafetyCases", total: 9, outstanding: 2, overdue: 0, oldestOutstandingAt: "2026-10-01T00:00:00Z" }],
    matching: 3, partial: false
  }));
  render(<SafetyOperationsPage />);
  expect(await screen.findByText(/outstanding across all queues/)).toBeInTheDocument();
  expect(call).toHaveBeenCalledWith("listSafetyOperations", { queue: "all", scope: "outstanding" });
  const headings = screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent);
  expect(headings).toEqual(["Takedown request", "Held guest memory"]);
  expect(screen.getByText(/Overdue since/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Safety cases/ }));
  await waitFor(() => expect(call).toHaveBeenCalledWith("listSafetyOperations", { queue: "trustSafetyCases", scope: "outstanding" }));
});
