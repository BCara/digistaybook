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
  it("permits only an explicitly named property during its controlled testing window", () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "false");
    vi.stubEnv("GUEST_CONTRIBUTIONS_ENABLED", "false");
    vi.stubEnv("GUEST_TEST_PROPERTY_IDS", " test-property ");
    vi.stubEnv("GUEST_TEST_UNTIL", "2026-10-09T13:00:00Z");
    const now = Date.parse("2026-10-02T12:00:00Z");
    expect(guestIntakeEnabled("test-property", now)).toBe(true);
    expect(guestIntakeEnabled("other-property", now)).toBe(false);
    expect(guestIntakeEnabled(undefined, now)).toBe(false);
    expect(guestIntakeEnabled("test-property", Date.parse("2026-10-09T13:00:00Z"))).toBe(false);
    vi.stubEnv("GUEST_TEST_UNTIL", "invalid");
    expect(guestIntakeEnabled("test-property", now)).toBe(false);
    expect(legalApproval).toBeNull();
  });
});
