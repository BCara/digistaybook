import { describe, expect, it } from "vitest";
import { describeNewItems } from "./operationsNotify";
describe("new operations item email summary", () => {
  it("counts by queue and lists kinds without any item content", () => {
    const summary = describeNewItems([{ queue: "trustSafetyCases", kind: "guest_memory" }, { queue: "trustSafetyCases", kind: "private_feedback" },
      { queue: "operationsAlerts", kind: "screening_failed" }, { queue: "contentReports", kind: "harassment" },
      { queue: "deletionJobs", kind: "deletion needs_attention: attempt_limit" }]);
    expect(summary).toEqual({ newCount: 5, queues: "2 safety cases, 1 content reports, 1 alerts, 1 stuck photo deletions",
      kinds: "guest memory, private feedback, screening failed, harassment, deletion needs attention: attempt limit" });
  });
});
