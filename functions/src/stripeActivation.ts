import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import type Stripe from "stripe";
import {
  acknowledgement,
  billingPolicy,
  chargedTodayDisclosure,
  discountedAmount,
  discountedChargedTodayDisclosure,
  discountedPriceDisclosure,
  discountLabel,
  formatDate,
  formatPrice,
  isPlan,
  priceDisclosure,
  publishedRate,
  type Plan
} from "./billingPolicy.js";
import {
  appliesToPlan,
  promotionRefusal,
  resolvePromotionCode,
  type ResolvedPromotion
} from "./promotionCodes.js";
import { countryIsPermitted } from "./stripeBilling.js";
import { appUrl, stripe, stripePriceAnnual, stripePriceMonthly, stripeSecrets } from "./stripeConfig.js";

/* ===========================================================================
   stripeActivation — everything that happens before Stripe sees the Host.

   BOP §6.3.4 requires the exact trial end date and a ticked acknowledgement
   *before* payment details are collected. Stripe's hosted page cannot render
   our checkbox with our wording, so the order is: this service quotes the
   terms, the Host accepts them, the acceptance is recorded, and only then is a
   Checkout Session created.

   Two callables, deliberately separate. `activationOptions` is a read: it can
   be called repeatedly while a Host reads the page. `createActivationCheckout`
   is the commitment, and it re-derives everything rather than trusting what
   the first call returned.
   ========================================================================= */

const options = {
  region: "australia-southeast1",
  maxInstances: 10,
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  secrets: stripeSecrets
};

const db = () => getFirestore();
const day = 86_400;

/** A Host, never a Guest. Anonymous sessions exist only for guest self-service. */
function hostUid(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to activate this property.");
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
 * §3a layer 1 of docs/stripe-integration-plan.md.
 *
 * Refused here, before a Checkout Session exists, because this is the only
 * layer that acts before the Host has spent any effort. Radar cannot help: with
 * a 28-day trial there is no charge to screen until day 28, by which time a
 * placard is already hanging in a kitchen.
 */
function permittedCountry(value: unknown): string {
  if (!countryIsPermitted(value)) {
    throw new HttpsError(
      "failed-precondition",
      "DigiStayBook is not available in your country yet. We currently serve Australia and the United States."
    );
  }
  return (value as string).trim().toUpperCase();
}

/** Trial eligibility is a Host-level fact: BOP §4.1, first activated property only. */
async function trialAvailable(uid: string): Promise<boolean> {
  const host = await db().collection("hosts").doc(uid).get();
  return !host.exists || !host.get("trialConsumedAt");
}

type Quote = {
  plan: Plan;
  amount: number;
  currency: string;
  formatted: string;
  /** The Product the Price belongs to, so an `applies_to` coupon can be checked. */
  productId: string | null;
};

/**
 * The catalogue, remembered between calls.
 *
 * A Host reading the activation screen costs two Stripe round trips from
 * Sydney, every time the screen is opened and again whenever they change the
 * country - for two Prices that are checked, immediately below, against a
 * figure compiled into this service. The retrieve is not where the number
 * comes from; it is the guard that stops the catalogue drifting away from the
 * published rate unnoticed (BOP 4.3), and a guard does not have to run twice
 * in the same minute to do its job.
 *
 * So a quote that passed the check is held for a few minutes and served from
 * memory, per instance. What is cached is by definition the published rate:
 * a mismatch throws and is never stored, and the next call asks Stripe again.
 * The commitment does not read this cache at all - `createActivationCheckout`
 * passes `fresh`, so the catalogue is confirmed live before a card is charged,
 * which is the moment drift actually matters.
 */
const catalogueTtlMs = 5 * 60_000;
const catalogue = new Map<string, { at: number; quote: Quote }>();

/** Puts an instance back to a cold catalogue, so a test can watch it fill. */
export function forgetCatalogue() { catalogue.clear(); }

async function quote(plan: Plan, currency: string, fresh = false): Promise<Quote> {
  const id = plan === "monthly" ? stripePriceMonthly.value() : stripePriceAnnual.value();
  if (!id) throw new HttpsError("failed-precondition", "Billing is not configured yet.");

  const key = `${id}:${currency}`;
  const remembered = catalogue.get(key);
  if (!fresh && remembered && Date.now() - remembered.at < catalogueTtlMs) return remembered.quote;

  // `currency_options` is not returned unless it is expanded.
  const price = await stripe().prices.retrieve(id, { expand: ["currency_options"] });

  const amount = price.currency === currency
    ? price.unit_amount
    : price.currency_options?.[currency]?.unit_amount;

  // A currency missing from the catalogue is a configuration fault, not
  // something to approximate. Quoting the wrong number here would be quoting
  // it in the acknowledgement the Host is asked to agree to.
  if (typeof amount !== "number") {
    throw new HttpsError("failed-precondition", "Billing is not configured for your currency yet.");
  }

  // BOP §4.3: marketing, the pricing page and checkout describe the same offer
  // "at the same price". `/pricing` renders the published rate card; this is
  // what stops the catalogue drifting away from it unnoticed. A price edited in
  // the Stripe dashboard now stops activation, loudly, instead of quietly
  // selling at a figure no page ever showed. Refusing is the safe direction:
  // nothing is charged, and the Host is told to come back rather than asked to
  // tick a box against a number the business has not published.
  const published = publishedRate(plan, currency);
  if (published !== amount) {
    logger.error("published_rate_mismatch", { plan, currency, published, catalogue: amount, priceId: id });
    throw new HttpsError(
      "failed-precondition",
      "Our published price and our payment catalogue disagree, so we cannot quote you. "
        + "Nothing has been charged. This has been reported; please try again later."
    );
  }
  const checked: Quote = {
    plan,
    amount,
    currency,
    formatted: formatPrice(amount, currency),
    productId: typeof price.product === "string" ? price.product : (price.product?.id ?? null)
  };
  catalogue.set(key, { at: Date.now(), quote: checked });
  return checked;
}

/**
 * The first midday UTC at least 28 days out, or null when the Host has already
 * used their trial.
 *
 * The obvious `now + 28 x 24h` is what a Host sees contradicted at checkout.
 * Stripe renders the trial as whole days remaining, floored, and it renders
 * them when the page loads rather than when the quote was issued — so an
 * instant exactly 28 days from the quote is always seconds short by the time
 * it is read, and Checkout says "27 days free" beside our "28-day free trial".
 * Landing on a fixed time of day removes the shortfall: the remaining trial is
 * always in [28, 29) days, which floors to 28 however long the Host spends
 * between the offer and the payment page.
 *
 * Midday rather than end of day because the date is shown twice, in two
 * timezones. The disclosure is built from UTC components (`formatDate`), the
 * Host Dashboard renders the same instant in the browser's timezone, and both
 * have to name the day the Host acknowledged. 12:00 UTC is the same calendar
 * date everywhere from UTC-11 to UTC+11, which covers both launch markets;
 * 23:59 UTC would read as the next day for every Australian Host.
 *
 * A trial can therefore run a few hours past 28 days, never under it.
 */
const trialEndFor = (available: boolean) => {
  if (!available) return null;
  const now = Math.floor(Date.now() / 1000);
  const end = new Date((now + billingPolicy.trialDays * day) * 1000);
  end.setUTCHours(12, 0, 0, 0);
  const midday = Math.floor(end.getTime() / 1000);
  return midday - now < billingPolicy.trialDays * day ? midday + day : midday;
};

/**
 * One plan as the Host is offered it, with a code applied if one reaches it.
 *
 * The discounted path re-quotes rather than annotates: `price` stays the
 * published rate, `chargedPrice` is what the card is actually charged, and the
 * disclosure and the acknowledgement are both written around the second. See
 * the discounted-terms section of `billingPolicy.ts` for why the checkbox
 * sentence is the one thing that needed no new wording.
 */
function planOffer(
  q: Quote,
  trialEnd: number | null,
  currency: string,
  promotion: ResolvedPromotion | null
) {
  const applied = promotion && appliesToPlan(promotion, currency, q.amount, q.productId)
    ? promotion
    : null;
  const charged = applied ? discountedAmount(q.amount, applied.facts) : q.amount;
  const chargedPrice = formatPrice(charged, currency);
  const date = formatDate(trialEnd ?? Math.floor(Date.now() / 1000), currency);

  const disclosure = applied
    ? trialEnd !== null
      ? discountedPriceDisclosure(q.plan, q.formatted, chargedPrice, date, applied.facts, currency)
      : discountedChargedTodayDisclosure(q.plan, q.formatted, chargedPrice, applied.facts, currency)
    : trialEnd !== null
      ? priceDisclosure(q.plan, q.formatted, date)
      : chargedTodayDisclosure(q.plan, q.formatted);

  return {
    plan: q.plan,
    /** The published rate. Unchanged by a code, because the rate is unchanged. */
    price: q.formatted,
    /** What the card is charged — the same figure, unless a code moved it. */
    chargedPrice,
    /** Minor units of the above, echoed on commitment so the amount cannot drift. */
    chargedAmount: charged,
    discount: applied
      ? { code: applied.facts.code, label: discountLabel(applied.facts, currency) }
      : null,
    disclosure,
    acknowledgement: acknowledgement(chargedPrice, date)
  };
}

/* ---------------------------------------------------------------------------
   activationOptions — what this property would cost, and in whose words.     */

export const activationOptions = onCall(options, async request => {
  const uid = hostUid(request);
  const country = permittedCountry(request.data?.country);
  const currency = billingPolicy.currencyFor[country];

  // Two reads of two different documents, asked for together. Trial
  // eligibility is a fact about the Host, keyed by the uid on the request,
  // so it does not depend on the property read and nothing is disclosed by
  // having asked: a caller who does not own the property is refused below
  // on the property, and learns nothing about their own host record.
  const [property, available] = await Promise.all([
    ownedProperty(request.data?.propertyId, uid),
    trialAvailable(uid)
  ]);

  // Welcome content is edited on Property view; it is not an activation prerequisite.
  if (property.get("lifecycle") !== "draft") {
    throw new HttpsError("failed-precondition", "This property is already activated.");
  }

  const trialEnd = trialEndFor(available);
  const quotes = await Promise.all(billingPolicy.plans.map(plan => quote(plan, currency)));

  // A code is optional, and resolved once: the lookup and the code-level checks
  // do not vary by plan. Whether it reaches a given plan is asked per plan, in
  // `planOffer`, because a minimum applies to a transaction rather than a code.
  const promotion = request.data?.promotionCode != null
    ? await resolvePromotionCode(request.data.promotionCode, currency)
    : null;

  const plans = quotes.map(q => planOffer(q, trialEnd, currency, promotion));

  // A code that discounts nothing we sell does not work here, and saying so
  // beats quoting the full price under a banner claiming a code was applied.
  if (promotion && plans.every(offered => offered.discount === null)) throw promotionRefusal();

  return {
    currency,
    trialAvailable: available,
    trialDays: billingPolicy.trialDays,
    // The exact instant the Host is being quoted. Echoed back on commitment so
    // the date they agreed to is the date Stripe is given.
    trialEndsAt: trialEnd,
    version: billingPolicy.version,
    plans
  };
});

/* ---------------------------------------------------------------------------
   createActivationCheckout — the commitment.                                 */

export const createActivationCheckout = onCall(options, async request => {
  const uid = hostUid(request);
  const property = await ownedProperty(request.data?.propertyId, uid);
  const country = permittedCountry(request.data?.country);
  const currency = billingPolicy.currencyFor[country];
  const plan = request.data?.plan;

  if (!isPlan(plan)) throw new HttpsError("invalid-argument", "Choose a monthly or annual plan.");

  // BOP §6.3.4: the checkbox is required before submission. The client cannot
  // be trusted to have rendered it, so its version must match what this
  // service currently publishes — an acknowledgement of superseded wording is
  // not an acknowledgement of these terms.
  if (request.data?.acknowledged !== true || request.data?.version !== billingPolicy.version) {
    throw new HttpsError("invalid-argument", "Please read and accept the current billing terms.");
  }
  if (property.get("lifecycle") !== "draft") {
    throw new HttpsError("failed-precondition", "This property is already activated.");
  }

  const available = await trialAvailable(uid);
  const trialEnd = trialEndFor(available);
  const acknowledgedTrialEnd = request.data?.trialEndsAt ?? null;

  // The date on the receipt must be the date the Host ticked a box against.
  // `trial_period_days` would let Stripe resolve the date itself at session
  // completion, so an overnight tab would silently move it. Passing an explicit
  // timestamp fixes that, provided the timestamp is still the one quoted —
  // hence the day comparison. A page left open across a date boundary is asked
  // to refresh rather than quietly charged on a different day.
  if (trialEnd !== null) {
    if (typeof acknowledgedTrialEnd !== "number" || !sameUtcDay(acknowledgedTrialEnd, trialEnd)) {
      throw new HttpsError("failed-precondition", "The trial dates have moved on. Reload the page and try again.");
    }
    // Stripe refuses a trial ending less than 48 hours out.
    if (acknowledgedTrialEnd - Math.floor(Date.now() / 1000) < 2 * day) {
      throw new HttpsError("failed-precondition", "That trial period is too short. Reload the page and try again.");
    }
  }

  const priced = await quote(plan, currency, true);

  // The code is resolved again rather than trusted from the quote. One
  // deactivated between the two calls, or one that no longer reaches this
  // plan, stops the purchase — it does not quietly sell at the full price
  // under a disclosure that promised a discount.
  const promotion = request.data?.promotionCode != null
    ? await resolvePromotionCode(request.data.promotionCode, currency)
    : null;
  const offered = planOffer(priced, trialEnd !== null ? acknowledgedTrialEnd : null, currency, promotion);
  if (promotion && offered.discount === null) throw promotionRefusal();

  // The amount on the receipt must be the amount the box was ticked against —
  // the same reasoning as the trial date above, and the same remedy. Only
  // asked of a discounted quote: without a code the price is the published
  // rate, which `quote()` has already refused to let drift.
  if (promotion && request.data?.chargedAmount !== offered.chargedAmount) {
    throw new HttpsError(
      "failed-precondition",
      "That discount has changed. Reload the page and try again."
    );
  }

  const customer = await customerFor(uid, country, request.auth?.token.email);

  // §3a layer 1 / §4: the declared billing country is a Host-level fact. Kept
  // on commitment (not on the repeatable `activationOptions` read) so a later
  // property's gate and the tax treatment do not depend on asking again.
  await db().collection("hosts").doc(uid).set(
    { billingCountry: country, updatedAt: Timestamp.now() },
    { merge: true }
  );

  // Recorded before the session exists, so an acknowledgement is never implied
  // by a completed payment. Mirrors the guest consent event in §5.3: the
  // wording, its version, and what was quoted — not a tick in isolation.
  const record = db().collection("properties").doc(property.id)
    .collection("billingAcknowledgements").doc();
  await record.set({
    ownerUid: uid,
    plan,
    country,
    currency,
    amount: priced.amount,
    priceFormatted: priced.formatted,
    // What was actually agreed to, which is the published rate unless a code
    // moved it. Both are kept: the evidence is the offer, not just the total.
    chargedAmount: offered.chargedAmount,
    chargedPriceFormatted: offered.chargedPrice,
    promotionCode: offered.discount?.code ?? null,
    promotionCodeId: offered.discount ? promotion?.id ?? null : null,
    trialEndsAt: acknowledgedTrialEnd ? Timestamp.fromMillis(acknowledgedTrialEnd * 1000) : null,
    version: billingPolicy.version,
    wording: offered.acknowledgement,
    disclosure: offered.disclosure,
    acceptedAt: Timestamp.now()
  });

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: property.id,
    currency,
    // No `payment_method_types`. Omitting it is what enables dynamic payment
    // methods; hardcoding ['card'] would suppress local methods that convert.
    line_items: [{ price: priced.plan === "monthly" ? stripePriceMonthly.value() : stripePriceAnnual.value(), quantity: 1 }],
    // BOP §4.1's 100% verification code, by whichever of the two routes Stripe
    // allows. `discounts` and `allow_promotion_codes` are mutually exclusive on
    // a Checkout Session, so a code resolved in our own screen replaces
    // Stripe's field rather than joining it — and a Host who typed nothing
    // still meets that field, exactly as before.
    ...(offered.discount && promotion
      ? { discounts: [{ promotion_code: promotion.id }] }
      : { allow_promotion_codes: true }),
    payment_method_collection: "always",  // §4.1: a payment method is required to start a trial
    billing_address_collection: "required", // §3a layer 2: a country to verify against
    automatic_tax: { enabled: false },    // ST-D2: no registrations at launch
    subscription_data: {
      ...(trialEnd !== null && typeof acknowledgedTrialEnd === "number"
        ? {
            trial_end: acknowledgedTrialEnd,
            trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } }
          }
        : {}),
      metadata: { propertyId: property.id, ownerUid: uid }
    },
    metadata: { propertyId: property.id, ownerUid: uid, acknowledgementId: record.id },
    // The session is short-lived for the same reason the trial end is explicit:
    // a stale tab must not be able to buy at yesterday's quote.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${appUrl.value()}/host/property/${property.id}/billing?activating=1`,
    cancel_url: `${appUrl.value()}/host/property/${property.id}/billing`
  }, {
    // One acknowledgement buys one session. A double-click cannot open two.
    idempotencyKey: `activate:${property.id}:${record.id}`
  });

  // Only the URL. No customer id, no subscription id, nothing the browser has
  // any use for — and BOP §4.2 means the redirect back grants nothing anyway.
  return { url: session.url };
});

const sameUtcDay = (a: number, b: number) =>
  new Date(a * 1000).toISOString().slice(0, 10) === new Date(b * 1000).toISOString().slice(0, 10);

/**
 * The Host's Stripe Customer, created once.
 *
 * BOP §4.1: one Customer per Host, one Subscription per property. The
 * idempotency key is what makes concurrent activations safe — two properties
 * activated at the same moment both ask Stripe to create a customer, and Stripe
 * returns the same one to both rather than billing the Host as two people.
 */
async function customerFor(uid: string, country: string, email?: string): Promise<string> {
  const hostRef = db().collection("hosts").doc(uid);
  const existing = await hostRef.get();
  const stored = existing.get("stripeCustomerId");
  if (typeof stored === "string" && stored) return stored;

  const customer: Stripe.Customer = await stripe().customers.create(
    { email, address: { country }, metadata: { ownerUid: uid } },
    { idempotencyKey: `host:${uid}` }
  );

  // A concurrent call may have stored one first; whoever wrote first wins, and
  // Stripe's idempotency guarantees it is the same customer either way.
  await db().runTransaction(async transaction => {
    const latest = await transaction.get(hostRef);
    if (!latest.get("stripeCustomerId")) {
      transaction.set(hostRef, { stripeCustomerId: customer.id, updatedAt: Timestamp.now() }, { merge: true });
    }
  });

  return (await hostRef.get()).get("stripeCustomerId") ?? customer.id;
}
