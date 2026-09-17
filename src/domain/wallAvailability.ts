type Availability = { lifecycle: string; mode: string; publicWallOff?: boolean };

/** Owner-facing explanation. Only use authenticated property data here. */
export function wallUnavailableReason(property: Availability, view: "stay" | "public") {
  if (property.lifecycle === "deleted" || property.lifecycle === "deletion_scheduled") {
    return { title: "Property is being removed", message: "Its walls are closed while deletion is pending.", action: "Review property", section: "settings" };
  }
  if (property.lifecycle === "draft") {
    return { title: "Not published yet", message: "Choose a plan to open its walls to guests.", action: "Choose a plan and publish", section: "billing" };
  }
  if (property.lifecycle === "suspended") {
    return { title: "Subscription suspended", message: "Guest access is paused until billing is sorted.", action: "Review billing", section: "billing" };
  }
  if (property.lifecycle === "dormant" || property.lifecycle === "cancelled_pending_end") {
    return { title: "Guest access has ended", message: "The service period is over. Billing has your options.", action: "Review billing", section: "billing" };
  }
  if (property.mode !== "live") {
    return { title: "Property is in setup mode", message: "Finish activation before sharing the guest links.", action: "Review activation", section: "billing" };
  }
  if (view === "public" && property.publicWallOff) {
    return { title: "Public wall is switched off", message: "Turn it on to let visitors open this link. Your in-stay wall is separate.", action: "Turn on public wall", section: "public" };
  }
  return { title: "Guest access is paused", message: "Check billing to restore access.", action: "Review billing", section: "billing" };
}
