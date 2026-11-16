import { describe, expect, it } from "vitest";
import { RECENT_SIGN_IN_SECONDS, signedInRecently } from "./hostAccount";

describe("deleting an account needs a fresh sign-in", () => {
  const now = 1_800_000_000_000, seconds = now / 1000;
  it("accepts a sign-in inside the window", () => {
    expect(signedInRecently(seconds - 30, now)).toBe(true);
    expect(signedInRecently(seconds - RECENT_SIGN_IN_SECONDS, now)).toBe(true);
  });
  it("refuses an old session, a missing claim and a claim from the future", () => {
    expect(signedInRecently(seconds - RECENT_SIGN_IN_SECONDS - 1, now)).toBe(false);
    expect(signedInRecently(undefined, now)).toBe(false);
    expect(signedInRecently(String(seconds), now)).toBe(false);
    expect(signedInRecently(seconds + 3600, now)).toBe(false);
  });
});
