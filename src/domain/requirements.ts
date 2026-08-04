export const bopRequirements = {
  guestContribution: "DSB-BOP-P2-004",
  reporting: "DSB-BOP-P2-005",
  hostDashboard: "DSB-BOP-P6-004",
  propertyManagement: "DSB-BOP-P6-005",
  privacySafety: "DSB-BOP-P6-008",
  guestWall: "DSB-BOP-P6-009",
  commercialMessaging: "DSB-BOP-P4-001",
  billing: "DSB-BOP-P3-004",
  retention: "DSB-BOP-P8-005",
  legalReview: "DSB-BOP-P8-010"
} as const;

export type BopRequirement = (typeof bopRequirements)[keyof typeof bopRequirements];
