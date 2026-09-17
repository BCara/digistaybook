/* ===========================================================================
   promotionCodes — a code a Host typed, turned into something we can quote.

   BOP §4.1 requires a 100% discount code to activate a property in production
   without taking a real payment, and the plan enables `allow_promotion_codes`
   for exactly that. That alone puts code entry on Stripe's page, which is
   after the acknowledgement: a Host ticks a box against A$15.00 and then
   watches the total become A$0.00 on someone else's screen. Resolving the code
   here instead means the §6.3.4 disclosure and the checkbox are written around
   what the card is actually charged.

   Stripe will not let us have both. `discounts` and `allow_promotion_codes`
   are mutually exclusive on a Checkout Session, so a pre-applied code takes
   Stripe's own "Add promotion code" field away. `stripeActivation` therefore
   sends one or the other: a validated code as `discounts`, and otherwise
   `allow_promotion_codes` exactly as before, so a Host who typed nothing still
   meets the field they would have met.

   What this file validates, and what it cannot
   --------------------------------------------
   Stripe checks a promotion code's restrictions at *redemption*, not when a
   Session is created. Everything checkable up front is checked here, because a
   quote a Host acknowledges and Stripe then refuses is worse than a code
   refused in our own screen, where the reason can be written for them:

     - the code exists, is active, and its coupon is still valid
     - neither the code nor the coupon has expired
     - an `amount_off` coupon is in the currency being quoted
     - an `applies_to` coupon lists the product being sold
     - a `minimum_amount` restriction is met by the plan being quoted

   The last two of those are per plan, not per code: a A$100 minimum is met by
   the annual plan and not the monthly one, and the two plans need not be
   Prices on one Product. So the lookup and the code-level checks happen once,
   and `appliesToPlan` answers the rest for each plan in turn.

   `first_time_transaction` is deliberately not evaluated. It is a fact about
   the Customer's invoice history at redemption, and guessing at it here would
   mean quoting a discount Stripe later declines. A code restricted that way is
   accepted, quoted, and — if Stripe refuses it — surfaced as the Session
   creation error it is, with nothing charged.
   ========================================================================= */

import type Stripe from "stripe";
import { HttpsError } from "firebase-functions/v2/https";
import { stripe } from "./stripeConfig.js";
import { discountedAmount, type DiscountFacts } from "./billingPolicy.js";

/** A resolved code: what Stripe calls it, what it does, and what it needs. */
export type ResolvedPromotion = {
  /** The `promo_…` id, which is what a Checkout Session is given. */
  id: string;
  facts: DiscountFacts;
  /** A `minimum_amount` restriction, in its own currency, or null for none. */
  minimum: { amount: number; currency: string } | null;
  /** `applies_to.products`, or null when the coupon applies to everything. */
  products: string[] | null;
};

/**
 * Codes are short, case-insensitive and typed by hand. Anything outside this
 * shape is a typo rather than a code, and is refused without a round trip to
 * Stripe — which also stops a text box being a way to enumerate the coupon
 * catalogue at one request per keystroke.
 */
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The Host-facing refusal, deliberately the same sentence for every reason.
 *
 * One message for "no such code", "expired", "wrong currency" and "not for
 * this product". A code is a thing someone was given: distinguishing the
 * failures tells a stranger which guesses were close, and tells a Host holding
 * a real code nothing they can act on that "check it" does not.
 */
export function promotionRefusal(): HttpsError {
  return new HttpsError(
    "failed-precondition",
    "That promotion code is not valid for this purchase. Check the code and try again."
  );
}

/**
 * The code as Stripe holds it, or a refusal.
 *
 * Only the checks that do not depend on which plan is being bought. The rest
 * are `appliesToPlan`, once per plan.
 */
export async function resolvePromotionCode(
  input: unknown,
  currency: string
): Promise<ResolvedPromotion> {
  if (typeof input !== "string") throw promotionRefusal();
  const code = input.trim();
  if (!CODE_PATTERN.test(code)) throw promotionRefusal();

  // `code` is an exact, case-insensitive lookup. `active: true` excludes codes
  // switched off, expired, or past their redemption limit. The coupon is
  // expanded because everything below is a fact about the coupon, and an
  // unexpanded `promotion.coupon` is only its id.
  const found = await stripe().promotionCodes.list({
    code,
    active: true,
    limit: 1,
    expand: ["data.promotion.coupon"]
  });
  const promotion = found.data[0];
  if (!promotion) throw promotionRefusal();

  const coupon = promotion.promotion?.coupon;
  // A string here means the expansion did not happen, which is a fault in this
  // call rather than anything the Host did — but it is still not a coupon we
  // can quote from, so it refuses like any other unusable code.
  if (!coupon || typeof coupon === "string" || !coupon.valid) throw promotionRefusal();

  const now = Math.floor(Date.now() / 1000);
  if (typeof promotion.expires_at === "number" && promotion.expires_at <= now) throw promotionRefusal();
  if (typeof coupon.redeem_by === "number" && coupon.redeem_by <= now) throw promotionRefusal();

  // A fixed-amount coupon is denominated in one currency. Applying an A$5-off
  // coupon to a US$10 price would quote a discount Stripe does not give.
  if (coupon.amount_off !== null && coupon.currency !== currency) throw promotionRefusal();

  // The renewal sentence is written from the duration, so a duration this
  // service does not recognise cannot be described accurately — and describing
  // a discount's reach wrongly is the §6.3.4 failure this whole path exists to
  // avoid. Refused like any other code we cannot quote.
  const duration = knownDuration(coupon.duration);
  if (!duration) throw promotionRefusal();

  return {
    id: promotion.id,
    facts: {
      // Stripe's own casing, not the Host's. The code goes into the sentence
      // they acknowledge, and that sentence should match the invoice.
      code: promotion.code,
      percentOff: coupon.percent_off,
      amountOff: coupon.amount_off,
      duration,
      durationInMonths: coupon.duration_in_months
    },
    minimum: minimumOf(promotion.restrictions),
    products: coupon.applies_to?.products?.length ? coupon.applies_to.products : null
  };
}

/**
 * Whether a resolved code actually discounts this particular plan.
 *
 * False for a plan the coupon's `applies_to` does not list, false for a plan
 * under the code's minimum, and false for a code that takes nothing off —
 * quoting that last one would put a code in the disclosure that changed no
 * figure in it.
 */
export function appliesToPlan(
  resolved: ResolvedPromotion,
  currency: string,
  amount: number,
  productId: string | null
): boolean {
  if (resolved.products && (productId === null || !resolved.products.includes(productId))) return false;
  const { minimum } = resolved;
  if (minimum) {
    // A minimum in another currency cannot be compared to this amount, and
    // guessing an exchange rate to decide a discount is not a thing to do.
    if (minimum.currency !== currency || amount < minimum.amount) return false;
  }
  return discountedAmount(amount, resolved.facts) !== amount;
}

/** Stripe's `duration` carries an open string type for values not yet known here. */
function knownDuration(duration: string): DiscountFacts["duration"] | null {
  return duration === "once" || duration === "repeating" || duration === "forever" ? duration : null;
}

function minimumOf(restrictions: Stripe.PromotionCode.Restrictions): ResolvedPromotion["minimum"] {
  const amount = restrictions.minimum_amount;
  const currency = restrictions.minimum_amount_currency;
  if (typeof amount !== "number" || typeof currency !== "string") return null;
  return { amount, currency };
}
