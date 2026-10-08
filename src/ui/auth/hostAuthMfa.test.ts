import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ email: vi.fn(), google: vi.fn(), challenge: vi.fn() }));
vi.mock("../../lib/firebase", () => ({ getFirebaseServices: async () => ({ auth: {} }) }));
vi.mock("./reviewerMfa", () => ({ mfaChallenge: mocks.challenge }));
vi.mock("firebase/auth", () => ({ signInWithEmailAndPassword: mocks.email, signInWithPopup: mocks.google, GoogleAuthProvider: class {} }));
import { signInWithEmail, signInWithGoogle } from "./hostAuth";
beforeEach(() => { vi.clearAllMocks(); });
it.each(["email", "google"])("preserves the Firebase MFA challenge for %s sign-in", async kind => {
  const error = { code: "auth/multi-factor-auth-required" }, challenge = { resolver: {}, factorUid: "totp" };
  mocks.email.mockRejectedValue(error); mocks.google.mockRejectedValue(error); mocks.challenge.mockReturnValue(challenge);
  const outcome = kind === "email" ? await signInWithEmail("reviewer@example.test", "test") : await signInWithGoogle();
  expect(outcome).toEqual({ status: "mfa", challenge });
  expect(mocks.challenge).toHaveBeenCalledWith({}, error);
});
