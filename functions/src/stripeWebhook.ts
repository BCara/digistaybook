import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import type Stripe from "stripe";
import {
  countryIsPermitted,
  isHandled,
  paidAtOf,
  renewalOf,
  resolveLifecycle,
  type PropertyLifecycle
} from "./stripeBilling.js";
import { stripe, stripeSecrets, stripeWebhookSecret } from "./stripeConfig.js";

/* ===========================================================================
   stripeWebhook — the only route by which a property becomes entitled.

   BOP §4.2 puts the whole commercial boundary here: "Entitlements change only
   when a signature-verified Stripe webhook is processed. Nothing in the client
   grants access." The Checkout success redirect writes nothing; it lands on the
   billing page and waits for this endpoint to do its work.

   BOP §5.7 adds the second requirement: "Webhook processing is idempotent, so a
   Stripe retry cannot activate a property twice or double-charge." That is the
   `stripeEvents` ledger below, written inside the same transaction as the
   entitlement it authorises, so the two cannot come apart.
   ========================================================================= */

const db = () => getFirestore();

const graceDays = 14; // BOP §5.7

type Outcome = { applied: boolean; reason: string; propertyId?: string };

// `australia-southeast1`, the same region as every other function and the
// callables in `stripeActivation.ts`. Left unset this defaults to us-central1,
// which still works but splits the deployment across two regions for no reason.
export const stripeWebhook = onRequest(
  { region: "australia-southeast1", secrets: stripeSecrets },
  async (request, response) => {
  const signature = request.headers["stripe-signature"];
  if (typeof signature !== "string") {
    response.status(400).send("Missing signature.");
    return;
  }

  let event: Stripe.Event;
  try {
    // `rawBody` and not `body`: signature verification is over the exact bytes
    // Stripe signed. Any body-parsing middleware inserted ahead of this would
    // break verification silently rather than loudly.
    event = stripe().webhooks.constructEvent(request.rawBody, signature, stripeWebhookSecret.value());
  } catch {
    // Deliberately no detail. An unverified caller learns only that it failed.
    response.status(400).send("Signature verification failed.");
    return;
  }

  if (!isHandled(event.type)) {
    // Delivered, understood to change nothing. A retry would not help, so this
    // is a 200 rather than an error.
    response.status(200).json({ received: true, applied: false, reason: "unhandled" });
    return;
  }

  try {
    response.status(200).json({ received: true, ...(await apply(event)) });
  } catch (error) {
    // Only the message, never the error object: it can carry request context.
    // A 500 is a request for Stripe to retry, so it is reserved for conditions
    // a retry could actually fix.
    console.error("stripeWebhook failed", {
      eventId: event.id,
      type: event.type,
      message: error instanceof Error ? error.message : "unknown"
    });
    response.status(500).send("Processing failed.");
  }
});

async function apply(event: Stripe.Event): Promise<Outcome> {
  switch (event.type) {
    // BOP §4.3 puts refund authority with a named owner, so neither of these
    // moves an entitlement. They are recorded for the §5.7 monthly
    // reconciliation and for a person to act on.
    case "charge.dispute.created":
    case "charge.refunded":
      return record(event);

    // §5.6 owns the trial expiry notice. Stripe's own notification is a trigger
    // for our email queue, not a state change.
    case "customer.subscription.trial_will_end":
      return record(event);

    default:
      return applyEntitlement(event);
  }
}

/* ------------------------- Reading the subscription -----------------------
   Every entitlement decision is made from a subscription re-read from the API,
   never from the event payload. Stripe does not guarantee delivery order, so a
   payload is only a snapshot of the moment the event was queued; the object is
   the source of truth for what is true now.                                */

function subscriptionIdFrom(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as Record<string, unknown>;

  if (event.type === "checkout.session.completed") {
    const session = object as unknown as Stripe.Checkout.Session;
    return typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  }

  if (event.type.startsWith("customer.subscription.")) {
    return typeof object.id === "string" ? object.id : null;
  }

  if (event.type.startsWith("invoice.")) {
    // `invoice.subscription` no longer exists: the link moved under
    // `parent.subscription_details` in the current API. Reading the old field
    // would silently yield undefined and orphan every invoice event.
    const invoice = object as unknown as Stripe.Invoice;
    const link = invoice.parent?.subscription_details?.subscription;
    return typeof link === "string" ? link : link?.id ?? null;
  }

  return null;
}

/**
 * When the current period ends.
 *
 * `current_period_end` is no longer a field on the subscription — it lives on
 * each subscription item. This catalogue puts exactly one item on a
 * subscription (one property, quantity 1), but the earliest item end is taken
 * rather than the first, so an unexpected second item shortens service instead
 * of silently extending it.
 */
function periodEndOf(subscription: Stripe.Subscription): number | null {
  const ends = subscription.items.data
    .map(item => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  return ends.length ? Math.min(...ends) : null;
}

const at = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? Timestamp.fromMillis(seconds * 1000) : null;

async function applyEntitlement(event: Stripe.Event): Promise<Outcome> {
  const subscriptionId = subscriptionIdFrom(event);
  if (!subscriptionId) return { applied: false, reason: "no-subscription" };

  const subscription = await subscriptionWithPricing(subscriptionId);

  // A subscription this integration did not create. Permanent, not transient,
  // so it is acknowledged rather than retried.
  const propertyId = subscription.metadata?.propertyId;
  if (!propertyId) return { applied: false, reason: "unlinked-subscription" };

  // §3a layer 2 of docs/stripe-integration-plan.md: the country Stripe actually
  // captured, not the one declared on our own form. Checked here because this
  // is the last point before a wall could be served.
  const billingCountry = countryFrom(event, subscription);
  if (billingCountry !== null && !countryIsPermitted(billingCountry)) {
    return { applied: false, reason: "country-not-served", propertyId };
  }

  const lifecycle = resolveLifecycle({
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true
  });

  return commit(event, subscription, propertyId, lifecycle);
}

/**
 * The subscription, with enough of its price expanded to quote the next charge.
 *
 * `currency_options` is not returned unless it is expanded, and without it a
 * multi-currency price reports only its base amount — which is how a US host on
 * a USD subscription would be shown the AUD figure. The expand is wrapped
 * because a rejected expand path would throw inside the handler, and a throw
 * here is a 500 that Stripe retries: the pricing is a nicety, the entitlement
 * is not, so a failure falls back to the plain read and the screen simply omits
 * the amount.
 */
async function subscriptionWithPricing(subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    return await stripe().subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price.currency_options"]
    });
  } catch {
    return await stripe().subscriptions.retrieve(subscriptionId);
  }
}

function countryFrom(event: Stripe.Event, subscription: Stripe.Subscription): string | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as unknown as Stripe.Checkout.Session;
    const country = session.customer_details?.address?.country;
    if (typeof country === "string") return country;
  }
  const customer = subscription.customer;
  if (typeof customer !== "string" && !customer.deleted) {
    const country = customer.address?.country;
    if (typeof country === "string") return country;
  }
  // No address captured. Not an allowlist failure — the declared-country gate
  // ran before the session existed, and refusing here would strand a host whose
  // payment method carries no address.
  return null;
}

async function commit(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  propertyId: string,
  lifecycle: PropertyLifecycle | null
): Promise<Outcome> {
  const ledgerRef = db().collection("stripeEvents").doc(event.id);
  const propertyRef = db().collection("properties").doc(propertyId);

  return db().runTransaction(async transaction => {
    // Every read before every write, as Firestore requires.
    const [ledger, property] = await Promise.all([
      transaction.get(ledgerRef),
      transaction.get(propertyRef)
    ]);

    // BOP §5.7: a Stripe retry cannot activate a property twice.
    if (ledger.exists) return { applied: false, reason: "duplicate", propertyId };
    if (!property.exists) return { applied: false, reason: "no-property", propertyId };

    const ownerUid = property.get("ownerUid") as string | undefined;
    const billing = (property.get("billing") ?? {}) as Record<string, unknown>;

    // Ordering guard. Stripe may deliver an older event after a newer one, and
    // applying it would roll the property backwards. Equal timestamps still
    // apply: two events can legitimately share a second.
    const seen = typeof billing.lastEventCreated === "number" ? billing.lastEventCreated : 0;
    if (event.created < seen) return { applied: false, reason: "stale", propertyId };

    const periodEnd = periodEndOf(subscription);
    const trialEnd = at(subscription.trial_end);

    const next: Record<string, unknown> = {
      "billing.stripeCustomerId": typeof subscription.customer === "string"
        ? subscription.customer : subscription.customer.id,
      "billing.stripeSubscriptionId": subscription.id,
      "billing.status": subscription.status,
      "billing.cancelAtPeriodEnd": subscription.cancel_at_period_end === true,
      "billing.trialEndsAt": trialEnd,
      "billing.currentPeriodEndsAt": at(periodEnd),
      "billing.lastEventCreated": event.created,
      updatedAt: Timestamp.now()
    };

    const paidSeconds = paidAtOf(event);
    const paidAt = paidSeconds === null ? null : Timestamp.fromMillis(paidSeconds * 1000);
    if (paidAt) next["billing.lastPaymentAt"] = paidAt;

    // What the next charge will be, so the billing screen can say it outright
    // rather than leaving a Host to infer it from a plan name and a date.
    const renewal = renewalOf(subscription);
    if (renewal) {
      next["billing.renewalAmount"] = renewal.amount;
      next["billing.renewalCurrency"] = subscription.currency;
      next["billing.renewalInterval"] = renewal.interval;
    }

    if (lifecycle) {
      next.lifecycle = lifecycle;
      // BOP §4.2: the live routing URL and the QR kit unlock here and nowhere
      // else. `mode` is not reverted on suspension — lifecycle decides whether
      // the wall is served, and a suspended property is still a live one.
      if (lifecycle !== "draft") next.mode = "live";

      // §4.3: cancellation is effective at the end of the paid cycle, and the
      // host is told the exact date. That date is this field.
      next.serviceEndsAt = lifecycle === "cancelled_pending_end" ? at(periodEnd) : null;

      // §5.7: a failed payment opens a 14-day grace period. The deadline is
      // recorded once, when grace opens, so the §5.6 email and the suspension
      // job quote the same date rather than each computing their own.
      if (lifecycle === "grace_period") {
        if (!billing.suspendAt) {
          next["billing.suspendAt"] = Timestamp.fromMillis(Date.now() + graceDays * 86_400_000);
        }
      } else {
        next["billing.suspendAt"] = null;
      }

      // BOP §4.1: the trial is for "the first activated property only". Written
      // in this transaction so two properties activated at once cannot both
      // take it.
      if (lifecycle === "trialing" && trialEnd && ownerUid) {
        const hostRef = db().collection("hosts").doc(ownerUid);
        transaction.set(hostRef, { trialConsumedAt: Timestamp.now() }, { merge: true });
      }
    }

    transaction.update(propertyRef, next);

    // Content-free by design: the event id, what it was, and what it did. No
    // payload, no customer details, nothing that would make this collection
    // worth reading for anything but idempotency.
    transaction.set(ledgerRef, {
      type: event.type,
      created: event.created,
      propertyId,
      lifecycle: lifecycle ?? null,
      processedAt: Timestamp.now()
    });

    return { applied: true, reason: lifecycle ?? "no-entitlement", propertyId };
  });
}

/**
 * Events that are filed rather than acted on: disputes and refunds for the
 * §5.7 monthly reconciliation, and the trial-ending trigger for §5.6's email
 * queue. Still ledgered, so a retry does not file them twice.
 */
async function record(event: Stripe.Event): Promise<Outcome> {
  const ledgerRef = db().collection("stripeEvents").doc(event.id);

  return db().runTransaction(async transaction => {
    if ((await transaction.get(ledgerRef)).exists) return { applied: false, reason: "duplicate" };

    transaction.set(ledgerRef, {
      type: event.type,
      created: event.created,
      needsReview: event.type === "charge.dispute.created",
      processedAt: Timestamp.now()
    });
    return { applied: true, reason: "recorded" };
  });
}
