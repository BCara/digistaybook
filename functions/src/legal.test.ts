import { afterEach, describe, expect, it, vi } from "vitest";
import { legalApproval, legalApproved, legalVersions } from "./legal";
import { guestIntakeEnabled } from "./guestContributions";
import { guestPolicy } from "./guestPolicy";

const approval = { reviewedOn: "2026-11-01", reviewedBy: "Counsel", versions: { ...legalVersions } };
afterEach(() => vi.unstubAllEnvs());

describe("legal approval gate (GC-03)", () => {
  it("is not approved while the texts are drafts", () => {
    expect(legalApproval).toBeNull();
    expect(legalApproved()).toBe(false);
  });

  it("approves only the exact versions counsel reviewed, with a date and reviewer", () => {
    expect(legalApproved(approval)).toBe(true);
    expect(legalApproved({ ...approval, versions: { ...legalVersions, privacy: "draft-older" } })).toBe(false);
    expect(legalApproved({ ...approval, reviewedOn: "soon" })).toBe(false);
    expect(legalApproved({ ...approval, reviewedBy: " " })).toBe(false);
  });

  it("keeps guest intake shut in production without approval, even with the switch on", () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "false");
    vi.stubEnv("GUEST_CONTRIBUTIONS_ENABLED", "true");
    expect(guestIntakeEnabled()).toBe(false);
  });

  it("asks consent for the message and photos, not an image, and records its version", () => {
    expect(guestPolicy.consentWording).toMatch(/my message and any photos/);
    expect(guestPolicy.consentWording).not.toMatch(/this image/);
    expect(guestPolicy.consentVersion).toBe(legalVersions.consent);
  });
});
