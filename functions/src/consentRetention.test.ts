import { describe, expect, it } from "vitest";
import { assessConsent, consentDeadline } from "./consentRetention";
const deletedAt = Date.parse("2024-10-05T00:00:00Z");
const baseline = { deleted: true, deletionAt: deletedAt, mediaRemoved: true, hold: false, cases: [], incomplete: false };
describe("manual consent deletion eligibility", () => {
  it("keeps live memories and keeps deleted memories until the exact two-year deadline", () => {
    expect(assessConsent({ ...baseline, deleted: false }, deletedAt + 10 * 365 * 86400000).status).toBe("retained");
    expect(assessConsent(baseline, Date.parse("2026-10-04T23:59:59Z")).status).toBe("retained");
    expect(assessConsent(baseline, Date.parse("2026-10-05T00:00:00Z")).status).toBe("due");
  });
  it("uses final dispute closure when later, and clamps leap days without adding a day", () => {
    const result = assessConsent({ ...baseline, cases: [{ status: "dismissed", resolvedAt: Date.parse("2025-04-01T12:00:00Z") }] }, Date.parse("2026-10-05T00:00:00Z"));
    expect(result.status).toBe("retained");
    expect(result.dueAt?.toDate().toISOString()).toBe("2027-04-01T12:00:00.000Z");
    expect(new Date(consentDeadline(Date.parse("2024-02-29T12:34:56Z"))).toISOString()).toBe("2026-02-28T12:34:56.000Z");
  });
  it("blocks open, escalated and withdrawn cases, recorded holds and unfinished photo deletion", () => {
    const now = Date.parse("2030-01-01T00:00:00Z");
    for (const status of ["open", "internal", "escalated", "withdrawn", "awaiting_verification"]) {
      expect(assessConsent({ ...baseline, cases: [{ status, resolvedAt: 0 }] }, now).status).toBe("blocked");
    }
    expect(assessConsent({ ...baseline, hold: true }, now).status).toBe("blocked");
    expect(assessConsent({ ...baseline, mediaRemoved: false }, now).status).toBe("blocked");
  });
  it("requires reliable deletion and closure dates and complete linked records", () => {
    expect(assessConsent({ ...baseline, deletionAt: 0 }, Date.now()).status).toBe("needs_attention");
    expect(assessConsent({ ...baseline, incomplete: true }, Date.now()).status).toBe("needs_attention");
    expect(assessConsent({ ...baseline, cases: [{ status: "closed", resolvedAt: 0 }] }, Date.now()).status).toBe("needs_attention");
  });
});
