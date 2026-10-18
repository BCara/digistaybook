import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mock = vi.hoisted(() => ({ verifyReset: vi.fn(), confirmReset: vi.fn(), check: vi.fn(), apply: vi.fn(), services: vi.fn(), resend: vi.fn() }));
vi.mock("firebase/auth", () => ({ verifyPasswordResetCode: mock.verifyReset, confirmPasswordReset: mock.confirmReset, checkActionCode: mock.check, applyActionCode: mock.apply }));
vi.mock("../../lib/firebase", () => ({ getFirebaseAuth: mock.services }));
vi.mock("../auth/hostAuth", () => ({ passwordMinimumLength: 8, sendHostPasswordReset: mock.resend }));
vi.mock("../auth/hostAccount", () => ({ accountError: () => "Please try again." }));
import { AccountActionPage } from "./AccountActionPage";
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState(null, "", "/reset-password?oobCode=private-code");
  mock.services.mockResolvedValue({ auth: "auth" }); mock.verifyReset.mockResolvedValue("host@example.test");
  mock.check.mockResolvedValue({ operation: "VERIFY_EMAIL" }); mock.resend.mockResolvedValue({ status: "success" });
});
it("checks the reset code, requires matching passwords and removes the code after success", async () => {
  render(<AccountActionPage kind="resetPassword" />);
  await screen.findByLabelText("New password");
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(mock.confirmReset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  await screen.findByRole("heading", { name: "Password updated" });
  expect(mock.confirmReset).toHaveBeenCalledWith("auth", "private-code", "new-password");
  expect(window.location.search).toBe("");
});
it("offers a new reset link when a code is invalid", async () => {
  mock.verifyReset.mockRejectedValue({ code: "auth/invalid-action-code" });
  render(<AccountActionPage kind="resetPassword" />);
  await screen.findByRole("heading", { name: "This link is no longer valid" });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "host@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Request a new reset link" }));
  await waitFor(() => expect(mock.resend).toHaveBeenCalledWith("host@example.test"));
});
it("requires a deliberate click to verify and refuses codes for another action", async () => {
  const view = render(<AccountActionPage kind="verifyEmail" />);
  await screen.findByRole("button", { name: "Verify email" }); expect(mock.apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  await screen.findByRole("heading", { name: "Email verified" }); expect(mock.apply).toHaveBeenCalledWith("auth", "private-code");
  view.unmount(); window.history.replaceState(null, "", "/verify-email?oobCode=wrong-code"); mock.apply.mockClear();
  mock.check.mockResolvedValue({ operation: "PASSWORD_RESET" });
  render(<AccountActionPage kind="verifyEmail" />);
  await screen.findByRole("heading", { name: "This link is no longer valid" }); expect(mock.apply).not.toHaveBeenCalled();
});
