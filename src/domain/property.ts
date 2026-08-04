export type PropertyLifecycle =
  | "draft"
  | "trialing"
  | "active"
  | "grace_period"
  | "suspended"
  | "cancelled_pending_end"
  | "dormant"
  | "deletion_scheduled"
  | "deleted";

export type PropertyMode = "sandbox" | "live";

export type PropertySummary = {
  id: string;
  ownerUid: string;
  name: string;
  slug: string;
  lifecycle: PropertyLifecycle;
  mode: PropertyMode;
  foundationalPostCount: number;
};

export const isPubliclyReadable = (property: PropertySummary) =>
  property.mode === "live" && ["trialing", "active", "grace_period"].includes(property.lifecycle);

export const canDownloadQrKit = (property: PropertySummary) =>
  property.mode === "live" && ["trialing", "active"].includes(property.lifecycle);
