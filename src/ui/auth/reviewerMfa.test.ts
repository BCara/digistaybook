import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resolver: { hints: [] as any[], resolveSignIn: vi.fn() }, factors: [] as any[], getSession: vi.fn(), generateSecret: vi.fn(), enroll: vi.fn(), reload: vi.fn(), popup: vi.fn(), credential: vi.fn(), verify: vi.fn() }));
vi.mock("../../lib/firebase", () => ({ getFirebaseAuth: async () => ({ auth: {} }) }));
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: (...args: unknown[]) => args }, GoogleAuthProvider: class {},
  getMultiFactorResolver: () => mocks.resolver,
  multiFactor: () => ({ enrolledFactors: mocks.factors, getSession: mocks.getSession, enroll: mocks.enroll }),
  TotpMultiFactorGenerator: { FACTOR_ID: "totp", generateSecret: mocks.generateSecret, assertionForSignIn: (...args: unknown[]) => args, assertionForEnrollment: (...args: unknown[]) => args },
  reauthenticateWithPopup: mocks.popup, reauthenticateWithCredential: mocks.credential, reload: mocks.reload, sendEmailVerification: mocks.verify
}));
import { beginReviewerEnrollment, completeMfa, enrollReviewer, generateReviewerSecret, mfaChallenge, mfaError, reviewerAccess } from "./reviewerMfa";
const user = (claims: Record<string, unknown> = { admin: true }) => ({ email: "reviewer@example.test", emailVerified: true, providerData: [{ providerId: "google.com" }], getIdTokenResult: vi.fn().mockResolvedValue({ claims }) } as any);
beforeEach(() => { vi.clearAllMocks(); mocks.resolver.hints = [{ factorId: "totp", uid: "factor" }]; mocks.factors.length = 0; mocks.getSession.mockResolvedValue("session"); mocks.generateSecret.mockResolvedValue("secret"); });
describe("reviewer MFA", () => {
  it("keeps role and MFA as separate access conditions", async () => {
    expect(await reviewerAccess(user({ admin: true }))).toEqual({ reviewer: true, mfa: false });
    expect(await reviewerAccess(user({ firebase: { sign_in_second_factor: "totp" } }))).toEqual({ reviewer: false, mfa: true });
    expect(await reviewerAccess(user({ admin: true, firebase: { sign_in_second_factor: "totp" } }))).toEqual({ reviewer: true, mfa: true });
  });
  it("uses the enrolled TOTP factor and does not turn other auth errors into challenges", () => {
    expect(mfaChallenge({} as any, { code: "auth/wrong-password" })).toBeNull();
    expect(mfaChallenge({} as any, { code: "auth/multi-factor-auth-required" })).toMatchObject({ factorUid: "factor", kind: "sign-in" });
    mocks.resolver.hints = [{ factorId: "phone", uid: "sms" }];
    expect(() => mfaChallenge({} as any, { code: "auth/multi-factor-auth-required" })).toThrow(/unsupported/);
  });
  it("validates the code before contacting the provider", async () => {
    const challenge = mfaChallenge({} as any, { code: "auth/multi-factor-auth-required" })!;
    await expect(completeMfa(challenge, "123")).rejects.toThrow(/six-digit/);
    expect(mocks.resolver.resolveSignIn).not.toHaveBeenCalled();
    await completeMfa(challenge, "123456"); expect(mocks.resolver.resolveSignIn).toHaveBeenCalledWith(["factor", "123456"]);
  });
  it("refuses enrolment for ordinary accounts and unverified reviewers", async () => {
    await expect(beginReviewerEnrollment(user({}), "")).rejects.toThrow(/not authorised/);
    await expect(beginReviewerEnrollment({ ...user(), emailVerified: false }, "")).rejects.toThrow(/Verify/);
    expect(mocks.popup).not.toHaveBeenCalled(); expect(mocks.generateSecret).not.toHaveBeenCalled();
  });
  it("reauthenticates before generating a secret and supports password accounts", async () => {
    expect(await beginReviewerEnrollment(user(), "")).toEqual({ secret: "secret" });
    expect(mocks.popup.mock.invocationCallOrder[0]).toBeLessThan(mocks.generateSecret.mock.invocationCallOrder[0]);
    const passwordUser = { ...user(), providerData: [{ providerId: "password" }] };
    await expect(beginReviewerEnrollment(passwordUser, "")).rejects.toThrow(/password/);
    await beginReviewerEnrollment(passwordUser, "local-only-test"); expect(mocks.credential).toHaveBeenCalled();
  });
  it("does not generate a second secret for an already enrolled reviewer", async () => {
    mocks.factors.push({ factorId: "totp" }); await expect(generateReviewerSecret(user())).rejects.toThrow(/already enrolled/);
    expect(mocks.generateSecret).not.toHaveBeenCalled();
  });
  it("requires a valid confirmation code to enrol", async () => {
    await expect(enrollReviewer(user(), {} as any, "")).rejects.toThrow(/six-digit/);
    expect(mocks.enroll).not.toHaveBeenCalled(); await enrollReviewer(user(), "secret" as any, "123456");
    expect(mocks.enroll).toHaveBeenCalledWith(["secret", "123456"], "Safety Review authenticator");
  });
  it("does not expose provider error bodies", () => {
    expect(mfaError({ code: "auth/invalid-verification-code", message: "private secret" })).toMatch(/not accepted/);
    expect(mfaError({ code: "auth/unknown", message: "private secret" })).not.toContain("private secret");
  });
});
