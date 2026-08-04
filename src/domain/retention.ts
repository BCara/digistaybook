export const retentionPolicy = {
  unpaidDraftDays: 30,
  dormantPropertyMonths: 12,
  privacyRequestEscalationDays: 14,
  routineSecurityLogDays: 90,
  activeDeletionDeadlineHours: 72,
  backupExpiryDaysAfterPrimaryDeletion: 30,
  accountingRecordYears: 5,
  consentEvidenceMonthsAfterLastMessage: 24
} as const;

export type DeletionManifest = {
  id: string;
  dataClass: string;
  targetReference: string;
  triggeredAt: string;
  primaryDeleteBy: string;
  backupExpireBy: string;
  legalHoldReference?: string;
  status: "scheduled" | "running" | "completed" | "failed" | "held";
};

export type PrivacySafetyRequest = {
  id: string;
  kind: "privacy" | "takedown" | "urgent_safety";
  status: "pending_verification" | "verified" | "resolved" | "escalated";
  createdAt: string;
  escalateAt: string;
};
