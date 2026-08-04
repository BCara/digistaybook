import { decideReport } from "./moderation";

const baseline = {
  duplicateForReporterAndPost: false,
  reporterCooldownActive: false,
  wallCircuitBreakerActive: false,
  reporterDistinctPostsLastTenMinutes: 0,
  reporterDistinctPostsLastTwentyFourHours: 0,
  wallDistinctPostsLastTenMinutes: 0
};

describe("decideReport", () => {
  it("hides an ordinarily reported post immediately", () => {
    expect(decideReport(baseline)).toMatchObject({ outcome: "hidden_pending_review", visibilityChanges: true, notifyHost: true });
  });
  it("does not change visibility for a reporter already in cooldown", () => {
    expect(decideReport({ ...baseline, reporterCooldownActive: true })).toMatchObject({ outcome: "suspected_abuse_no_visibility_change", visibilityChanges: false, escalateInternally: true });
  });
  it("hides the threshold-reaching report and starts cooldown for subsequent reports", () => {
    expect(decideReport({ ...baseline, reporterDistinctPostsLastTenMinutes: 2 })).toMatchObject({ outcome: "hidden_pending_review", startReporterCooldown: true });
  });
  it("deduplicates the same reporter and post", () => {
    expect(decideReport({ ...baseline, duplicateForReporterAndPost: true }).outcome).toBe("duplicate_no_visibility_change");
  });
});
