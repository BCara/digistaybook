export const reportingLimits = {
  reporterDistinctPostsTenMinutes: 3,
  reporterDistinctPostsTwentyFourHours: 5,
  wallDistinctPostsTenMinutes: 5,
  cooldownHours: 24
} as const;

export type ReportContext = {
  duplicateForReporterAndPost: boolean;
  reporterCooldownActive: boolean;
  wallCircuitBreakerActive: boolean;
  reporterDistinctPostsLastTenMinutes: number;
  reporterDistinctPostsLastTwentyFourHours: number;
  wallDistinctPostsLastTenMinutes: number;
};

export type ReportDecision = {
  outcome: "hidden_pending_review" | "suspected_abuse_no_visibility_change" | "duplicate_no_visibility_change";
  visibilityChanges: boolean;
  notifyHost: boolean;
  escalateInternally: boolean;
  startReporterCooldown: boolean;
  tripWallCircuitBreaker: boolean;
  acknowledgement: "Report received. It will be reviewed.";
};

export function decideReport(context: ReportContext): ReportDecision {
  const acknowledgement = "Report received. It will be reviewed." as const;
  if (context.duplicateForReporterAndPost) {
    return {
      outcome: "duplicate_no_visibility_change",
      visibilityChanges: false,
      notifyHost: false,
      escalateInternally: false,
      startReporterCooldown: false,
      tripWallCircuitBreaker: false,
      acknowledgement
    };
  }

  if (context.reporterCooldownActive || context.wallCircuitBreakerActive) {
    return {
      outcome: "suspected_abuse_no_visibility_change",
      visibilityChanges: false,
      notifyHost: false,
      escalateInternally: true,
      startReporterCooldown: context.reporterCooldownActive,
      tripWallCircuitBreaker: context.wallCircuitBreakerActive,
      acknowledgement
    };
  }

  return {
    outcome: "hidden_pending_review",
    visibilityChanges: true,
    notifyHost: true,
    escalateInternally: false,
    startReporterCooldown:
      context.reporterDistinctPostsLastTenMinutes + 1 >= reportingLimits.reporterDistinctPostsTenMinutes ||
      context.reporterDistinctPostsLastTwentyFourHours + 1 >= reportingLimits.reporterDistinctPostsTwentyFourHours,
    tripWallCircuitBreaker:
      context.wallDistinctPostsLastTenMinutes + 1 >= reportingLimits.wallDistinctPostsTenMinutes,
    acknowledgement
  };
}
