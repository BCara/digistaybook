export type EmailClassification = "transactional" | "marketing";

export type MarketingConsent = {
  hostUid: string;
  address: string;
  status: "granted" | "withdrawn";
  timestamp: string;
  source: string;
  wordingVersion: string;
};

export type SuppressionState = "clear" | "suppressed" | "unavailable";

export const emailCatalogue = {
  accountConfirmation: "transactional",
  propertyActivation: "transactional",
  moderationAlert: "transactional",
  billingNotice: "transactional",
  securityAlert: "transactional",
  cartAbandonment: "marketing",
  activationNudge: "marketing",
  roiMilestone: "marketing",
  winBack: "marketing",
  affiliatePromotion: "marketing"
} satisfies Record<string, EmailClassification>;

export function canSendMarketing(consent: MarketingConsent | null, suppression: SuppressionState): boolean {
  return Boolean(consent && consent.status === "granted" && suppression === "clear");
}

export function assertTransactionalContent(hasPromotionalBlock: boolean): void {
  if (hasPromotionalBlock) throw new Error("Transactional email cannot contain promotional content");
}
