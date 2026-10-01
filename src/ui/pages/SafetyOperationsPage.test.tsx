import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const call = vi.fn();
vi.mock("../host/GuestReviewPanel", () => ({ hostCall: (...args: unknown[]) => call(...args) }));
import { SafetyOperationsPage } from "./SafetyOperationsPage";

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
