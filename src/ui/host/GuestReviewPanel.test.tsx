import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const callable = vi.fn();
vi.mock("../../lib/firebase", () => ({ getFirebaseServices: async () => ({ functions: {} }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: (_functions: unknown, name: string) => (data: unknown) => callable(name, data) }));
import { GuestReviewPanel } from "./GuestReviewPanel";

it("shows feedback as plain text and lets the host report a message to the safety team", async () => {
  callable.mockImplementation(async (name: string) => name === "listHostGuestReview"
    ? { data: { posts: [], feedback: [{ id: "f1", message: "Visit https://example.test/claim now" }, { id: "f2", message: "Bins were full" }] } }
    : { data: { status: "reported" } });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<GuestReviewPanel propertyId="cottage" feedbackOnly />);
  expect(await screen.findByText("Visit https://example.test/claim now")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Report message" })[0]);
  await waitFor(() => expect(screen.queryByText("Visit https://example.test/claim now")).not.toBeInTheDocument());
  expect(callable).toHaveBeenCalledWith("reportPrivateFeedback", { propertyId: "cottage", id: "f1" });
  expect(screen.getByText("Bins were full")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Reported");
});

it("persists the property review switch through the server and reflects the saved value", async () => {
  callable.mockImplementation(async (name: string) => name === "listHostGuestReview"
    ? { data: { posts: [], feedback: [], reviewContent: false } }
    : { data: { reviewContent: true } });
  render(<GuestReviewPanel propertyId="cottage" />);
  const toggle = await screen.findByRole("checkbox", { name: "Require approval for new memories" });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() => expect(callable).toHaveBeenCalledWith("setGuestReviewPolicy", { propertyId: "cottage", reviewContent: true }));
  await waitFor(() => expect(toggle).toBeChecked());
});
