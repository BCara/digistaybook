import type Stripe from "stripe";

/* ===========================================================================
   stripeBilling — what a Stripe subscription means for a property.

   BOP §4.2: "Entitlements change only when a signature-verified Stripe webhook
   is processed. Nothing in the client grants access." So this module is the
   only place that decides whether a wall is served, and it decides it from the
   subscription object Stripe returns — never from anything a browser sent.

   The lifecycle union and the transition table below are a deliberate second
   copy of the ones in `src/domain/property.ts` and `src/domain/billing.ts`,
   following the same rule as `moderatePost`: the client copy decides what to
   draw, this one decides what may actually happen, and it does not trust the
   first. `functions/` has `rootDir: src` and imports nothing from the app, so
   the duplication is enforced by the build rather than left to discipline.
   ========================================================================= */

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

/** Every status Stripe can put on a subscription, including ones we never ask for. */
export type StripeSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

/**
 * The only fields of a Stripe subscription this decision is allowed to read.
 *
 * `status` is widened past the union above on purpose. Stripe's own types carry
 * an `OtherString` member so that a status added after an SDK release still
 * type-checks, and narrowing it here would turn a forward-compatible API change
 * into a build failure — or worse, invite a cast that skips the `default` arm
 * where an unknown status is refused.
 */
export type SubscriptionFacts = {
  status: StripeSubscriptionStatus | (string & {});
  cancelAtPeriodEnd: boolean;
};

/**
 * The lifecycle a subscription entitles a property to, or `null` when it
 * entitles it to nothing and the property stays in `draft`.
 *
 * `null` is not "unknown" — it is "no entitlement". An unrecognised status also
 * returns `null`, so a status Stripe adds after this was written closes the
 * wall rather than opening it. BOP §5.2 requires the wall to fail closed.
 */
export function resolveLifecycle(facts: SubscriptionFacts): PropertyLifecycle | null {
  switch (facts.status) {
    // Checkout was started but never completed. Nothing was paid and no trial
    // began, so the property has not left draft.
    case "incomplete":
    case "incomplete_expired":
      return null;

    // BOP §4.3: cancellation is "effective at the end of the paid cycle", so a
    // cancelled subscription keeps serving until Stripe ends it. Stripe reports
    // that as `active`/`trialing` with the flag set, never as a status change —
    // reading only `status` here would leave a cancelled property showing
    // "Active" in the dashboard for the rest of its period.
    case "trialing":
      return facts.cancelAtPeriodEnd ? "cancelled_pending_end" : "trialing";
    case "active":
      return facts.cancelAtPeriodEnd ? "cancelled_pending_end" : "active";

    // BOP §5.7: a failed payment opens a grace period during which "the wall
    // stays fully live for guests checking in".
    //
    // The cancellation flag is deliberately ignored here. Grace has a hard
    // 14-day deadline; honouring `cancel_at_period_end` in this state would
    // move the property to `cancelled_pending_end`, whose end date is the end
    // of a billing period that has not been paid for — extending free service
    // on the strength of a failed payment.
    case "past_due":
      return "grace_period";

    // The configured end of dunning (§7 of docs/stripe-integration-plan.md).
    // Reactivatable, which is why the after-retries behaviour is `unpaid`
    // rather than `canceled`.
    case "unpaid":
      return "suspended";

    // Stripe has ended the subscription: either the period after a cancellation
    // has run out, or dunning terminated it. Either way service is over and the
    // property holds its content for the reactivation window in §5.10.
    case "canceled":
      return "dormant";

    // Not a state this integration creates. Treated as no service rather than
    // guessed at, because a paused subscription is not being paid for.
    case "paused":
      return "suspended";

    default:
      return null;
  }
}

/** Whether a lifecycle serves the public wall. Mirrors `isPubliclyReadable`. */
export function wallIsServed(lifecycle: PropertyLifecycle | null): boolean {
  return lifecycle === "trialing" || lifecycle === "active" || lifecycle === "grace_period"
    || lifecycle === "cancelled_pending_end";
}

/* ------------------------------- Sales gate -------------------------------
   BOP §2 and ST-D4: Australia and the United States only at launch. Dropping
   GBP and EUR from the catalogue is a display choice and stops nobody — a UK
   host pays in USD like anyone else — and Stripe Checkout has no billing
   country restriction to lean on. So the gate is ours, and it is checked twice:
   once before a Checkout Session is created, and again against the billing
   country Stripe captured, before any entitlement is granted.             */

export const salesAllowlist = ["AU", "US"] as const;

export type PermittedCountry = (typeof salesAllowlist)[number];

/**
 * Case-insensitive because the declared country comes from our own form while
 * the verified one comes from Stripe, and only one of those is under our
 * control. Anything unparseable is refused rather than normalised.
 */
export function countryIsPermitted(country: unknown): country is PermittedCountry {
  return typeof country === "string"
    && (salesAllowlist as readonly string[]).includes(country.trim().toUpperCase());
}

/* ---------------------------- Handled webhooks ----------------------------
   Listed explicitly so that an endpoint subscribed to more events than this
   integration understands acknowledges them rather than failing. An unhandled
   event is a 200 with no write: Stripe has delivered it, we have decided it
   changes nothing, and a retry would not help.                            */

export const handledEvents = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.trial_will_end",
  "charge.dispute.created",
  "charge.refunded"
] as const;

export type HandledEvent = (typeof handledEvents)[number];

export function isHandled(type: string): type is HandledEvent {
  return (handledEvents as readonly string[]).includes(type);
}

/* --------------------------- Reading an invoice ---------------------------
   Both of these answer questions the billing screen asks, and both are here
   rather than in `stripeWebhook.ts` for the same reason the mapping above is:
   they are decisions about what Stripe's objects mean, and they are worth
   testing without a webhook, a signature or a Firestore around them.       */

/**
 * When money actually moved, in unix seconds, or null when it did not.
 *
 * Stripe raises an invoice at the start of a trial and marks it paid, so
 * `invoice.paid` alone is not evidence of a payment: it is how a Host on day 1
 * of a free trial came to be shown "Last payment: 10 September 2026" against a
 * card that had never been charged. The amount is what separates the two.
 *
 * The timestamp is the invoice's own, not the moment this ran — a webhook
 * replayed a day late must not restamp the payment as today.
 */
export function paidAtOf(event: { type: string; created: number; data: { object: unknown } }): number | null {
  if (event.type !== "invoice.paid") return null;
  const invoice = event.data.object as {
    amount_paid?: unknown;
    status_transitions?: { paid_at?: unknown } | null;
  };
  if (typeof invoice.amount_paid !== "number" || invoice.amount_paid <= 0) return null;
  const paidAt = invoice.status_transitions?.paid_at;
  return typeof paidAt === "number" ? paidAt : event.created;
}

export type Renewal = { amount: number; interval: string | null };

/**
 * What the next invoice will be, in the currency the subscription is billed in.
 *
 * Read from the price rather than from the last invoice because during a trial
 * the last invoice is the zero-amount one Stripe raises at trial start, and the
 * figure a Host needs is the one that lands when the trial ends.
 *
 * `currency_options` carries the amount for a subscription billed in something
 * other than the price's base currency, and it is only present when the caller
 * expanded it. Null when the catalogue cannot answer in this currency: the
 * screen then shows the date without a figure, which is a smaller failure than
 * showing a US host the Australian one.
 */
export function renewalOf(subscription: {
  currency: string;
  items: { data: Array<{ price?: Stripe.Price | null }> };
}): Renewal | null {
  const price = subscription.items.data[0]?.price;
  if (!price) return null;
  const amount = price.currency === subscription.currency
    ? price.unit_amount
    : price.currency_options?.[subscription.currency]?.unit_amount;
  if (typeof amount !== "number") return null;
  return { amount, interval: price.recurring?.interval ?? null };
}
