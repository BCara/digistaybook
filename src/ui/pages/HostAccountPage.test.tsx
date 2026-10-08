import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
const mocks = vi.hoisted(() => ({ name: vi.fn(), confirm: vi.fn(), email: vi.fn(), password: vi.fn(), refresh: vi.fn(), verify: vi.fn(), reset: vi.fn(), complete: vi.fn() }));
vi.mock("../auth/hostAccount", async original => ({
  ...(await original<typeof import("../auth/hostAccount")>()),
  saveHostName: mocks.name, confirmHostPassword: mocks.confirm,
  requestHostEmailChange: mocks.email, changeHostPassword: mocks.password,
  refreshHostAccount: mocks.refresh, verifyHostEmail: mocks.verify
}));
vi.mock("../auth/hostAuth", () => ({ passwordMinimumLength: 8, sendHostPasswordReset: mocks.reset }));
vi.mock("../auth/reviewerMfa", () => ({ completeMfa: mocks.complete, mfaError: () => "Code not accepted." }));
import { HostAccountPage } from "./HostAccountPage";
const host = { uid: "host-a", email: "host@example.test", displayName: "Host", emailVerified: true, providerData: [{ providerId: "password" }] } as AuthState["user"];
const refreshUser = vi.fn();
function show(user = host, status: AuthState["status"] = "host") {
  return render(<AuthContext.Provider value={{ user, status, refreshUser }}><HostAccountPage /></AuthContext.Provider>);
}
function enter(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
function passwordForm(confirm = "new-password") {
  enter("Current password", "current-password"); enter("New password", "new-password"); enter("Confirm new password", confirm);
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}
beforeEach(() => { vi.resetAllMocks(); mocks.confirm.mockResolvedValue(null); mocks.reset.mockResolvedValue({ status: "success" }); });

it("saves the name and refreshes the signed-in header", async () => {
  show(); enter("Your name Optional", "Updated host"); fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  expect(await screen.findByRole("status")).toHaveTextContent("name has been saved");
  expect(mocks.name).toHaveBeenCalledWith(host, "Updated host"); expect(refreshUser).toHaveBeenCalled();
});
it("keeps Google-only users out of password and email mutation flows", () => {
  show({ ...host, providerData: [{ providerId: "google.com" }] } as AuthState["user"]);
  expect(screen.getByRole("link", { name: "Manage your Google account" })).toHaveAttribute("href", "https://myaccount.google.com/");
  expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Verify new email" })).not.toBeInTheDocument();
});
it.each(["signed-out", "guest", "loading"] as const)("shows no account details for %s sessions", status => {
  show(host, status); expect(screen.queryByText("host@example.test")).not.toBeInTheDocument();
});
it("rejects mismatched passwords before confirming identity", async () => {
  show(); passwordForm("different-password"); expect(screen.getByRole("alert")).toHaveTextContent("need to match");
  expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.password).not.toHaveBeenCalled();
});
it("does not change the password when identity confirmation fails", async () => {
  mocks.confirm.mockRejectedValue({ code: "auth/invalid-credential" }); show(); passwordForm();
  expect(await screen.findByRole("alert")).toHaveTextContent("current password was not accepted");
  expect(mocks.password).not.toHaveBeenCalled(); expect(screen.getByLabelText("Current password")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Change password" })).toBeEnabled();
});
it("changes the password after confirming identity and clears the fields", async () => {
  show(); passwordForm(); expect(await screen.findByRole("status")).toHaveTextContent("password has been changed");
  expect(mocks.confirm).toHaveBeenCalledWith(host, "current-password"); expect(mocks.password).toHaveBeenCalledWith(host, "new-password");
  expect(screen.getByLabelText("New password")).toHaveValue("");
});
it("keeps the old email until the new address is verified", async () => {
  show(); enter("New email address", "new@example.test"); enter("Current password to change email", "current-password");
  fireEvent.click(screen.getByRole("button", { name: "Verify new email" }));
  expect(await screen.findByRole("status")).toHaveTextContent("sign-in email stays host@example.test");
  expect(mocks.email).toHaveBeenCalledWith(host, "new@example.test"); expect(screen.getByLabelText("Current password to change email")).toHaveValue("");
});
it("waits for valid MFA before applying the pending password change", async () => {
  mocks.confirm.mockResolvedValue({ kind: "reauthenticate" }); mocks.complete.mockRejectedValueOnce(new Error("wrong code")).mockResolvedValueOnce({});
  show(); passwordForm(); await screen.findByRole("heading", { name: "Enter your authenticator code" });
  expect(mocks.password).not.toHaveBeenCalled(); enter("Authenticator code", "123456");
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Code not accepted"); expect(mocks.password).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await waitFor(() => expect(mocks.password).toHaveBeenCalledWith(host, "new-password"));
});
it("discards a pending mutation when the MFA confirmation is cancelled", async () => {
  mocks.confirm.mockResolvedValue({ kind: "reauthenticate" }); show(); passwordForm();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel sign-in" }));
  expect(screen.getByRole("alert")).toHaveTextContent("No account change was made"); expect(mocks.password).not.toHaveBeenCalled();
});
