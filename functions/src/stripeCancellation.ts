import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import type Stripe from "stripe";
import { formatDate } from "./billingPolicy.js";
import { stripe, stripeSecrets } from "./stripeConfig.js";

/* ===========================================================================
   stripeCancellation — ST-09, the half of billing a Host can act on.

   BOP §4.3: cancellation is "effective at the end of the paid cycle", and the
   Host is told the exact date. So this never deletes a subscription — it sets
   `cancel_at_period_end` and lets the period run out. A Host who cancels on
   day 3 of a 28-day trial keeps the wall, and the placard on their kitchen
   table keeps working, until day 28.

   Nothing here writes `lifecycle` or `serviceEndsAt`. Those are the webhook's
   to write (BOP §4.2), and `customer.subscription.updated` is already handled:
   Stripe reports a cancelled-but-running subscription as `active`/`trialing`
   with the flag set, and `stripeBilling.ts` maps that to
   `cancelled_pending_end`. Writing the lifecycle here as well would give the
   property two authors that disagree whenever Stripe refuses the update.

   The date this returns is therefore for the confirmation screen only. It
   comes from Stripe's answer to the write we just made, not from the property
   document, which the webhook may not have caught up with yet.
   ========================================================================= */

const options = {
  region: "australia-southeast1",
  maxInstances: 10,
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  secrets: stripeSecrets
};

const db = () => getFirestore();

/** A Host, never a Guest. Same gate as activation. */
function hostUid(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to manage this subscription.");
  if (request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "This action is not available in this session.");
  }
  return request.auth.uid;
}

async function ownedProperty(propertyId: unknown, uid: string) {
  if (typeof propertyId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(propertyId)) {
    throw new HttpsError("invalid-argument", "Invalid property reference.");
  }
  const snapshot = await db().collection("properties").doc(propertyId).get();
  if (!snapshot.exists || snapshot.get("ownerUid") !== uid) {
    throw new HttpsError("not-found", "That property no longer exists.");
  }
  return snapshot;
}

/**
 * The subscription behind a property, read from Stripe rather than from the
 * property document.
 *
 * The stored id is trusted (only the webhook writes it); the stored *state* is
 * not. A property whose webhook is a few seconds behind would otherwise be
 * refused a cancellation it is entitled to, or offered one it is not.
 */
async function subscriptionFor(
  property: FirebaseFirestore.DocumentSnapshot
): Promise<Stripe.Subscription> {
  const id = property.get("billing.stripeSubscriptionId");
  if (typeof id !== "string" || !id) {
    throw new HttpsError(
      "failed-precondition",
      "This property has no subscription to cancel. If that looks wrong, contact support before the next renewal date."
    );
  }
  try {
    return await stripe().subscriptions.retrieve(id);
  } catch {
    throw new HttpsError(
      "unavailable",
      "We could not reach Stripe. Nothing has changed — try again in a moment."
    );
  }
}

/**
 * When service actually stops.
 *
 * `current_period_end` lives on the subscription items, not the subscription —
 * the same reasoning (and the same earliest-item rule) as `periodEndOf` in
 * `stripeWebhook.ts`. During a trial this is the trial end, which is what makes
 * "cancel the trial" and "cancel the subscription" one operation rather than
 * two: both stop the service at the end of the period already paid for, and a
 * trial's period was paid for with nothing.
 */
function periodEndOf(subscription: Stripe.Subscription): number | null {
  const ends = subscription.items.data
    .map(item => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  return ends.length ? Math.min(...ends) : null;
}

/** Whether Stripe still has a subscription that can be stopped at period end. */
function isStoppable(status: Stripe.Subscription.Status): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

type Answer = {
  /** Unix seconds, so the client can format it itself if it ever needs to. */
  serviceEndsAt: number | null;
  /** The same instant in the §6.3.4 house format, which is what the screen shows. */
  serviceEndsOn: string | null;
  /** True when the flag was already in this state before the call. */
  alreadySet: boolean;
  /** Whether a charge is still to come on the date above. */
  chargedAgain: boolean;
};

/**
 * Record what the Host did, in the same spirit as the activation
 * acknowledgement: what was changed, on which subscription, and when.
 * Server-only — `firestore.rules` denies every property subcollection that is
 * not `posts`.
 */
async function record(
  propertyId: string,
  uid: string,
  action: "cancel" | "resume",
  subscription: Stripe.Subscription,
  endsAt: number | null
): Promise<void> {
  await db().collection("properties").doc(propertyId).collection("billingActions").doc().set({
    ownerUid: uid,
    action,
    stripeSubscriptionId: subscription.id,
    stripeStatus: subscription.status,
    serviceEndsAt: endsAt ? Timestamp.fromMillis(endsAt * 1000) : null,
    at: Timestamp.now()
  });
}

/* ---------------------------------------------------------------------------
   cancelSubscription — stop at the end of the period already paid for.       */

export const cancelSubscription = onCall(options, async request => {
  const uid = hostUid(request);
  const property = await ownedProperty(request.data?.propertyId, uid);
  const subscription = await subscriptionFor(property);

  // Already over. Saying so is better than a Stripe error the Host cannot act
  // on.
  if (!isStoppable(subscription.status)) {
    throw new HttpsError(
      "failed-precondition",
      "This subscription has already ended, so there is nothing to cancel and nothing further to pay."
    );
  }

  // Idempotent by design rather than by key: a second click, or a click from a
  // second tab, is answered with the same date instead of an error. The
  // `alreadySet` flag lets the screen say so rather than claim a fresh action.
  if (subscription.cancel_at_period_end) {
    const already = periodEndOf(subscription);
    return {
      serviceEndsAt: already,
      serviceEndsOn: already === null ? null : formatDate(already, subscription.currency),
      alreadySet: true,
      chargedAgain: false
    } satisfies Answer;
  }

  let updated: Stripe.Subscription;
  try {
    updated = await stripe().subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
      metadata: { ...subscription.metadata, cancelledBy: uid }
    });
  } catch {
    throw new HttpsError(
      "unavailable",
      "Stripe did not accept the cancellation, so nothing has changed. Try again in a moment."
    );
  }

  const endsAt = periodEndOf(updated);
  await record(property.id, uid, "cancel", updated, endsAt);

  return {
    serviceEndsAt: endsAt,
    serviceEndsOn: endsAt === null ? null : formatDate(endsAt, updated.currency),
    alreadySet: false,
    // A cancelled trial is never charged, and a cancelled paid subscription has
    // already paid for the period it is running out. Either way the answer is
    // no, and the screen is allowed to say so plainly.
    chargedAgain: false
  } satisfies Answer;
});

/* ---------------------------------------------------------------------------
   resumeSubscription — undo, while there is still something to undo.

   Not in ST-09's line, but `cancel_at_period_end` is a flag rather than a
   deletion, so for as long as the period runs the cancellation is reversible
   with no new checkout, no new acknowledgement and no second trial. Leaving it
   out would mean a mis-click costs a Host their wall address and their placard
   until they buy the property back.                                          */

export const resumeSubscription = onCall(options, async request => {
  const uid = hostUid(request);
  const property = await ownedProperty(request.data?.propertyId, uid);
  const subscription = await subscriptionFor(property);

  // Past the end date there is no flag left to clear: Stripe has moved the
  // subscription to `canceled`, and coming back is a new purchase.
  if (!isStoppable(subscription.status)) {
    throw new HttpsError(
      "failed-precondition",
      "This subscription has already ended. Reactivating brings the wall back with its memories intact, but it starts a new subscription."
    );
  }

  if (!subscription.cancel_at_period_end) {
    const already = periodEndOf(subscription);
    return {
      serviceEndsAt: already,
      serviceEndsOn: already === null ? null : formatDate(already, subscription.currency),
      alreadySet: true,
      chargedAgain: subscription.status !== "trialing"
    } satisfies Answer;
  }

  let updated: Stripe.Subscription;
  try {
    updated = await stripe().subscriptions.update(subscription.id, { cancel_at_period_end: false });
  } catch {
    throw new HttpsError(
      "unavailable",
      "Stripe did not accept the change, so the cancellation still stands. Try again in a moment."
    );
  }

  const endsAt = periodEndOf(updated);
  await record(property.id, uid, "resume", updated, endsAt);

  return {
    serviceEndsAt: endsAt,
    serviceEndsOn: endsAt === null ? null : formatDate(endsAt, updated.currency),
    alreadySet: false,
    // Back on the billing schedule: the date above is a renewal again rather
    // than an ending.
    chargedAgain: true
  } satisfies Answer;
});
