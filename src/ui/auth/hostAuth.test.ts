import { describeAuthError, passwordMinimumLength, validateNewHostCredentials } from "./hostAuth";

describe("host auth error mapping", () => {
  it("treats a dismissed Google popup as a cancellation, not a failure", () => {
    expect(describeAuthError({ code: "auth/popup-closed-by-user" })).toEqual({ status: "cancelled" });
    expect(describeAuthError({ code: "auth/cancelled-popup-request" })).toEqual({ status: "cancelled" });
  });

  it("does not reveal whether an email address has a host account", () => {
    const unknownUser = describeAuthError({ code: "auth/user-not-found" });
    const wrongPassword = describeAuthError({ code: "auth/wrong-password" });
    const invalid = describeAuthError({ code: "auth/invalid-credential" });
    expect(unknownUser).toEqual(wrongPassword);
    expect(invalid).toEqual(wrongPassword);
    expect(unknownUser).toEqual({
      status: "error",
      message: "That email address and password do not match a host account."
    });
  });

  it("explains rate limiting and connectivity distinctly", () => {
    expect(describeAuthError({ code: "auth/too-many-requests" })).toMatchObject({
      status: "error",
      message: expect.stringMatching(/wait a few minutes/i)
    });
    expect(describeAuthError({ code: "auth/network-request-failed" })).toMatchObject({
      status: "error",
      message: expect.stringMatching(/could not reach/i)
    });
  });

  it("falls back to a safe message for an unrecognised or absent code", () => {
    for (const value of [{ code: "auth/something-new" }, new Error("boom"), undefined, null]) {
      expect(describeAuthError(value)).toEqual({
        status: "error",
        message: "Sign-in failed. Please try again, and contact support if the problem continues."
      });
    }
  });
});

describe("host account creation rules", () => {
  const good = { email: "host@example.com", password: "correct horse", confirmPassword: "correct horse" };

  it("accepts a well-formed new credential set", () => {
    expect(validateNewHostCredentials(good)).toEqual([]);
  });

  it("requires a password long enough to be worth having", () => {
    expect(validateNewHostCredentials({ ...good, password: "short", confirmPassword: "short" })).toEqual([
      { field: "password", message: `Choose a password of at least ${passwordMinimumLength} characters.` }
    ]);
  });

  it("catches a mistyped confirmation before Firebase is called", () => {
    expect(validateNewHostCredentials({ ...good, confirmPassword: "correct hors" })).toEqual([
      { field: "confirm", message: "Both passwords need to match." }
    ]);
  });

  it("rejects an address that is not an address", () => {
    for (const email of ["", "host", "@example.com", "host@"]) {
      expect(validateNewHostCredentials({ ...good, email }).map((problem) => problem.field)).toEqual(["email"]);
    }
  });

  it("names an already-registered address so the form is not a dead end", () => {
    expect(describeAuthError({ code: "auth/email-already-in-use" }, "sign-up")).toEqual({
      status: "error",
      message: "An account already exists for that email address. Sign in instead, or reset your password."
    });
  });

  it("keeps the fallback wording specific to what the host was doing", () => {
    expect(describeAuthError({ code: "auth/something-new" }, "sign-up")).toMatchObject({
      message: expect.stringMatching(/could not create your account/i)
    });
    expect(describeAuthError({ code: "auth/something-new" })).toMatchObject({
      message: expect.stringMatching(/sign-in failed/i)
    });
  });
});
