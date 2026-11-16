import { describe, expect, it } from "vitest";
import { emailIsVerified, MAX_DRAFT_PROPERTIES, mintStayToken, neverActivated } from "./propertyCreation";
import { stayTokenMatches, resolveWallView } from "./publicWall";

describe("the guestbook link", () => {
  it("mints a token the wall accepts, and a different one each time", () => {
    const first = mintStayToken(), second = mintStayToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second).not.toBe(first);
    expect(stayTokenMatches({ stayToken: first }, first)).toBe(true);
  });
  it("stops serving the in-stay wall to the old token once a new one is stored", () => {
    const old = mintStayToken(), reissued = mintStayToken();
    const property = { stayToken: reissued, ownerUid: "host-a" };
    expect(stayTokenMatches(property, old)).toBe(false);
    // The old placard lands on the public page: no house information, no posting.
    expect(resolveWallView(property, "stay", old)).toBe("public");
    expect(resolveWallView(property, "stay", reissued)).toBe("stay");
  });
});

describe("who may create a property", () => {
  it("requires a proved email address", () => {
    expect(emailIsVerified({ email: "host@example.test", email_verified: false })).toBe(false);
    expect(emailIsVerified({ email: "host@example.test" })).toBe(false);
    expect(emailIsVerified(undefined)).toBe(false);
    // A truthy string is not the claim.
    expect(emailIsVerified({ email_verified: "true" })).toBe(false);
  });
  it("lets a Google sign-in through, whose token arrives verified", () => {
    expect(emailIsVerified({ email: "host@gmail.com", email_verified: true, firebase: { sign_in_provider: "google.com" } })).toBe(true);
  });
  it("caps unpaid drafts at a small number", () => {
    expect(MAX_DRAFT_PROPERTIES).toBeGreaterThan(0);
    expect(MAX_DRAFT_PROPERTIES).toBeLessThanOrEqual(10);
  });
});

describe("releasing a guestbook address", () => {
  it("frees the address of a draft that was never paid for or served", () => {
    expect(neverActivated({ lifecycle: "draft", mode: "sandbox" })).toBe(true);
  });
  it.each([
    ["an active property", { lifecycle: "active", mode: "live" }],
    ["a cancelled property", { lifecycle: "dormant", mode: "live" }],
    ["a draft that was once live", { lifecycle: "draft", mode: "live" }],
    ["a draft with a subscription behind it", { lifecycle: "draft", mode: "sandbox", billing: { stripeSubscriptionId: "sub_1" } }],
    ["a draft with billing history", { lifecycle: "draft", mode: "sandbox", billing: { status: "canceled" } }],
    ["nothing", undefined]
  ])("keeps the address of %s, because a placard may carry it", (_name, data) => {
    expect(neverActivated(data)).toBe(false);
  });
});
