import type { User } from "firebase/auth";
const mocks = vi.hoisted(() => ({
  services: vi.fn(), reauthenticate: vi.fn(), profile: vi.fn(), password: vi.fn(),
  email: vi.fn(), reload: vi.fn(), verify: vi.fn(), challenge: vi.fn()
}));
vi.mock("../../lib/firebase", () => ({ getFirebaseAuth: mocks.services }));
vi.mock("./reviewerMfa", () => ({ mfaChallenge: mocks.challenge }));
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: mocks.reauthenticate, updateProfile: mocks.profile,
  updatePassword: mocks.password, verifyBeforeUpdateEmail: mocks.email,
  reload: mocks.reload, sendEmailVerification: mocks.verify
}));
import { changeHostPassword, confirmHostPassword, requestHostEmailChange, saveHostName, accountError } from "./hostAccount";
const host = { uid: "host-a", email: "host@example.test", isAnonymous: false, providerData: [{ providerId: "password" }] } as User;
beforeEach(() => {
  vi.resetAllMocks(); mocks.services.mockResolvedValue({ auth: { currentUser: host } });
  mocks.challenge.mockReturnValue(null);
});

it.each([null, { ...host, isAnonymous: true }, { ...host, uid: "host-b" }])("refuses mutations after the host session changes", async currentUser => {
  mocks.services.mockResolvedValue({ auth: { currentUser } });
  await expect(saveHostName(host, "Name")).rejects.toThrow(/Sign in/);
  await expect(changeHostPassword(host, "replacement-password")).rejects.toThrow(/Sign in/);
  await expect(requestHostEmailChange(host, "new@example.test")).rejects.toThrow(/Sign in/);
  expect(mocks.profile).not.toHaveBeenCalled(); expect(mocks.password).not.toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled();
});
it("requires the current password and propagates a rejected identity check", async () => {
  await expect(confirmHostPassword(host, "")).rejects.toThrow(/current password/);
  expect(mocks.reauthenticate).not.toHaveBeenCalled();
  mocks.reauthenticate.mockRejectedValue({ code: "auth/invalid-credential" });
  await expect(confirmHostPassword(host, "wrong")).rejects.toMatchObject({ code: "auth/invalid-credential" });
  expect(mocks.password).not.toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled();
});
it("returns the MFA confirmation without changing email or password", async () => {
  const challenge = { kind: "reauthenticate" };
  mocks.reauthenticate.mockRejectedValue({ code: "auth/multi-factor-auth-required" });
  mocks.challenge.mockReturnValue(challenge);
  expect(await confirmHostPassword(host, "current-password")).toBe(challenge);
  expect(mocks.password).not.toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled();
});
it("blocks a session replaced while identity confirmation was in progress", async () => {
  mocks.reauthenticate.mockImplementation(async () => { mocks.services.mockResolvedValue({ auth: { currentUser: { ...host, uid: "other" } } }); });
  await expect(confirmHostPassword(host, "current-password")).rejects.toThrow(/Sign in/);
});
it("requests email verification rather than immediately changing the email", async () => {
  await requestHostEmailChange(host, " new@example.test ");
  expect(mocks.email).toHaveBeenCalledWith(host, "new@example.test");
  expect(host.email).toBe("host@example.test");
});
it("keeps provider error details out of account messages", () => {
  expect(accountError({ code: "auth/internal-error", message: "raw credential payload" })).not.toContain("payload");
});
