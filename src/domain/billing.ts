import type { PropertyLifecycle } from "./property";

export type BillingEvent =
  | "trial_started"
  | "invoice_paid"
  | "payment_failed"
  | "grace_expired"
  | "cancel_requested"
  | "period_ended"
  | "reactivated"
  | "dormancy_expired"
  | "deletion_completed";

const transitions: Partial<Record<PropertyLifecycle, Partial<Record<BillingEvent, PropertyLifecycle>>>> = {
  draft: { trial_started: "trialing" },
  trialing: {
    invoice_paid: "active",
    payment_failed: "grace_period",
    cancel_requested: "cancelled_pending_end"
  },
  active: {
    invoice_paid: "active",
    payment_failed: "grace_period",
    cancel_requested: "cancelled_pending_end"
  },
  grace_period: {
    invoice_paid: "active",
    grace_expired: "suspended",
    cancel_requested: "cancelled_pending_end"
  },
  suspended: { invoice_paid: "active", cancel_requested: "cancelled_pending_end" },
  cancelled_pending_end: { period_ended: "dormant", reactivated: "active" },
  dormant: { reactivated: "active", dormancy_expired: "deletion_scheduled" },
  deletion_scheduled: { deletion_completed: "deleted" }
};

export function transitionBillingState(current: PropertyLifecycle, event: BillingEvent): PropertyLifecycle {
  const next = transitions[current]?.[event];
  if (!next) throw new Error(`Invalid billing transition: ${current} -> ${event}`);
  return next;
}
