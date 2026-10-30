/* ===========================================================================
   billingPolicy — the wording a Host is asked to agree to, and its version.

   BOP §6.3.4 fixes this copy exactly, and §4.3 requires marketing, checkout,
   the dashboard and the policies to "describe the same offer, in the same
   words, at the same price". So the sentences live here, versioned, and the
   version is recorded with every acknowledgement — the same pattern as the
   guest consent wording in `guestPolicy.ts`.

   Changing a sentence means minting a new version, not editing a string.
   ========================================================================= */

export const billingPolicy = {
  /** BOP §4.1. Applies to a Host's first activated property only. */
  trialDays: 28,

  /* v2 adds the discounted wording at the foot of this file. §6.3.4 itself is
     unchanged and the undiscounted sentences are byte-for-byte what v1 said;
     the version moves because the policy a Host can be shown grew, and an
     acknowledgement is evidence of the whole policy rather than of the one
     paragraph that happened to be rendered. */
  version: "handbook-6.3.4-v2",

  /**
   * The countries with a price of their own (D-028). Every other country is
   * billed in `baseCurrency`. The euro rows are the euro area, not the EU.
   * `src/domain/pricing.ts` holds the same map; `pricing.test.ts` compares them.
   */
  currencyFor: {
    AU: "aud",
    NZ: "nzd",
    GB: "gbp",
    CA: "cad",
    AT: "eur", BE: "eur", BG: "eur", CY: "eur", DE: "eur", EE: "eur", ES: "eur",
    FI: "eur", FR: "eur", GR: "eur", HR: "eur", IE: "eur", IT: "eur", LT: "eur",
    LU: "eur", LV: "eur", MT: "eur", NL: "eur", PT: "eur", SI: "eur", SK: "eur"
  } as Record<string, string>,

  /** USD, the base the ladder is converted from, for every other country. */
  baseCurrency: "usd",

  plans: ["monthly", "annual"] as const
} as const;

/** The currency a billing country is charged in. */
export function currencyForCountry(country: string): string {
  return billingPolicy.currencyFor[country] ?? billingPolicy.baseCurrency;
}

/**
 * Every country a Host can be billed in (D-028): ISO 3166-1 alpha-2, less the
 * uninhabited territories and the countries Stripe cannot take payments from.
 * `src/domain/pricing.ts` holds the same list; `pricing.test.ts` compares them.
 */
export const billingCountries: readonly string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF",
  "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG",
  "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC",
  "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI",
  "GL", "GM", "GN", "GP", "GQ", "GR", "GT", "GU", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN",
  "IQ", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO",
  "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP",
  "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE",
  "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SZ", "TC", "TD", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA",
  "UG", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"
];

export type Plan = (typeof billingPolicy.plans)[number];

export function isPlan(value: unknown): value is Plan {
  return value === "monthly" || value === "annual";
}

/* --------------------------- The published rate card ----------------------
   The amounts `/pricing` shows a visitor, in minor units, per point-of-sale
   currency. ST-D1, signed off 8 September 2026: monthly A$15 / US$10, annual
   A$150 / US$100. The currency ladder of 30 October 2026 (D-027, D-028) adds
   £8 / £80, €9 / €90, NZ$18 / NZ$180 and CA$14 / CA$140: US$10 converted at
   RBA rates and rounded, annual still ten times monthly.

   This table is not what a Host is charged — the Stripe catalogue is, and
   `stripeActivation.quote()` reads it from there. It is what the business has
   published, and BOP §4.3 requires the two to be the same number. Holding it
   here lets `quote()` refuse a catalogue that has drifted, rather than quoting
   a Host a price no page ever showed them.

   `src/domain/pricing.ts` carries the same table for the marketing pages: the
   two packages compile separately with different roots, so neither can import
   the other, and `src/domain/pricing.test.ts` fails the moment they disagree.
   Changing a rate means changing Stripe and both tables.                    */

export const publishedRates: Record<string, Record<Plan, number>> = {
  aud: { monthly: 1500, annual: 15000 },
  nzd: { monthly: 1800, annual: 18000 },
  gbp: { monthly: 800, annual: 8000 },
  eur: { monthly: 900, annual: 9000 },
  cad: { monthly: 1400, annual: 14000 },
  usd: { monthly: 1000, annual: 10000 }
};

/** The published amount, or null for a currency the business has not priced. */
export function publishedRate(plan: Plan, currency: string): number | null {
  return publishedRates[currency]?.[plan] ?? null;
}

/* --------------------------- Rendering the terms --------------------------
   Both of these are deliberately hand-built rather than left to `Intl`, for
   two reasons that matter only because this copy is legally acknowledged.

   `Intl` picks a currency symbol relative to the formatting locale, so AUD in
   `en-AU` renders as a bare "$" — its own local currency needs no prefix. With
   two dollar currencies on sale that is genuinely ambiguous: an Australian Host
   would tick a box reading "$15.00" and a US Host one reading "$10.00", with
   nothing in either to say which dollar. BOP §4.3 requires the same offer to be
   described "in the same words, at the same price"; a price the reader cannot
   identify does not meet that.

   The second reason is drift. `Intl` output depends on the runtime's ICU data,
   which changes with Node versions. The exact string a Host agreed to is
   evidence, and it must not change because a Cloud Function was redeployed on a
   newer runtime.                                                           */

const symbolFor: Record<string, string> = { aud: "A$", nzd: "NZ$", gbp: "£", eur: "€", cad: "CA$", usd: "US$" };

const months = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/** Month-first for the US and Canadian dollars, day-first for the rest of the ladder. */
const dayFirst: Record<string, boolean> = { aud: true, nzd: true, gbp: true, eur: true, cad: false, usd: false };

/** A price as a Host reads it, from the minor units Stripe holds. */
export function formatPrice(minorUnits: number, currency: string): string {
  const symbol = symbolFor[currency];
  if (!symbol) throw new Error(`No price symbol configured for ${currency}`);
  const amount = (minorUnits / 100).toFixed(2);
  // Thousands separators, without letting Intl near the currency itself.
  const [whole, cents] = amount.split(".");
  return `${symbol}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/** The trial end date as a date, never as "in 28 days" (BOP §6.3.4). */
export function formatDate(epochSeconds: number, currency: string): string {
  const date = new Date(epochSeconds * 1000);
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return dayFirst[currency] === false ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}

/* ------------------------------ The sentences -----------------------------
   Quoted from BOP §6.3.4 with two deliberate departures, both approved as
   ST-D12 in docs/stripe-integration-plan.md (Cara, 8 Sep 2026):

   1. The handbook writes "${Price}". Its `$` is literal, and `{Price}` is
      substituted with an already-formatted amount, so following it exactly
      would render "$A$15.00" for an Australian Host. The `$` is dropped and
      the formatted price carries its own symbol ("A$15.00" / "US$10.00"), so
      a Host can tell which dollar they are agreeing to.

   2. The handbook supplies no wording for a Host's second property, which
      takes no trial (§4.1). `chargedTodayDisclosure` is the approved
      second-property copy.                                                */

export function priceDisclosure(plan: Plan, price: string, trialEndDate: string): string {
  const opening =
    `Start your ${billingPolicy.trialDays}-day free trial. By providing your payment information and `
    + `clicking 'Start Trial', you agree to our Terms of Service and Cancellation Policy. `
    + `You will not be charged today. After your ${billingPolicy.trialDays}-day free trial ends on ${trialEndDate}, `;

  const close = " You can cancel at any time in your Host Dashboard with one click.";

  return plan === "monthly"
    ? `${opening}your subscription will automatically renew at ${price}/month until you cancel.${close}`
    : `${opening}your subscription will officially begin, and your card will be charged ${price} for your `
      + `first year. It will automatically renew annually until you cancel.${close}`;
}

/** Approved second-property copy (ST-D12). See departure 2 above — not in the handbook. */
export function chargedTodayDisclosure(plan: Plan, price: string): string {
  const period = plan === "monthly" ? "month" : "year";
  return `Your free trial applies to your first property only, so this property is charged today. `
    + `By providing your payment information you agree to our Terms of Service and Cancellation Policy. `
    + `Your card will be charged ${price} now, and the subscription will automatically renew every ${period} `
    + `until you cancel. You can cancel at any time in your Host Dashboard with one click.`;
}

/** The required checkbox beside the disclosure (BOP §6.3.4). */
export function acknowledgement(price: string, date: string): string {
  return `I understand I will be billed ${price} on ${date} if I do not cancel.`;
}
/* --------------------------- Discounted terms -----------------------------
   BOP §4.1 requires a 100% discount code to be able to activate a property in
   production without taking a real payment. A code changes the amount, and the
   §6.3.4 sentences state the amount — so "you will be billed A$15.00 on 7
   October" is simply false the moment one is applied, and it is most false in
   exactly the case §4.1 exists for.

   So a discounted quote is re-quoted, not annotated: the disclosure is rebuilt
   around what the card will actually be charged, and `acknowledgement` above is
   reused unchanged with the discounted price, because that sentence was never
   about the rate card — it is about the charge.

   The renewal sentence follows the coupon's own duration rather than assuming
   one. A `forever` code renews at the discounted price, a `once` code renews at
   the published one, and a `repeating` code says how long it lasts. Getting
   that wrong is how a Host is surprised by the second invoice, which is the
   failure §6.3.4 is written to prevent.                                     */

/** A coupon reduced to the facts the wording and the arithmetic need. */
export type DiscountFacts = {
  /** The customer-facing code, as Stripe holds it rather than as it was typed. */
  code: string;
  percentOff: number | null;
  /** Minor units, in the coupon's own currency. */
  amountOff: number | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
};

/**
 * What the card is charged after the code.
 *
 * The discount is rounded, not the total, which is how Stripe computes it — and
 * the two must agree, because this figure is the one a Host ticks a box against.
 * Never below zero: a coupon worth more than the price is a free charge, not a
 * credit.
 */
export function discountedAmount(amount: number, discount: DiscountFacts): number {
  if (discount.percentOff !== null) {
    return Math.max(0, amount - Math.round((amount * discount.percentOff) / 100));
  }
  if (discount.amountOff !== null) return Math.max(0, amount - discount.amountOff);
  return amount;
}

/** "100% off", or "A$5.00 off". */
export function discountLabel(discount: DiscountFacts, currency: string): string {
  if (discount.percentOff !== null) return `${discount.percentOff}% off`;
  if (discount.amountOff !== null) return `${formatPrice(discount.amountOff, currency)} off`;
  return "no discount";
}

/** What happens after the discounted charge, in the coupon's own terms. */
function renewalSentence(discount: DiscountFacts, plan: Plan, full: string, discounted: string): string {
  const period = plan === "monthly" ? "month" : "year";
  if (discount.duration === "forever") {
    return `Your code applies for as long as the subscription runs, so it renews at `
      + `${discounted}/${period} until you cancel.`;
  }
  if (discount.duration === "repeating" && discount.durationInMonths !== null) {
    const count = discount.durationInMonths;
    return `Your code applies for ${count} ${count === 1 ? "month" : "months"}, after which the subscription `
      + `renews at the standard ${full}/${period} until you cancel.`;
  }
  return `It then renews at the standard ${full}/${period} until you cancel.`;
}

/** §6.3.4's disclosure, re-quoted around a discount code (policy v2). */
export function discountedPriceDisclosure(
  plan: Plan,
  full: string,
  discounted: string,
  trialEndDate: string,
  discount: DiscountFacts,
  currency: string
): string {
  const period = plan === "monthly" ? "month" : "year";
  return `Start your ${billingPolicy.trialDays}-day free trial. By providing your payment information and `
    + `clicking 'Start Trial', you agree to our Terms of Service and Cancellation Policy. `
    + `You will not be charged today. After your ${billingPolicy.trialDays}-day free trial ends on ${trialEndDate}, `
    + `your code ${discount.code} applies ${discountLabel(discount, currency)} to the standard ${full}/${period}, `
    + `and your card will be charged ${discounted}. `
    + `${renewalSentence(discount, plan, full, discounted)}`
    + ` You can cancel at any time in your Host Dashboard with one click.`;
}

/** The second-property wording (ST-D12), re-quoted around a discount code (policy v2). */
export function discountedChargedTodayDisclosure(
  plan: Plan,
  full: string,
  discounted: string,
  discount: DiscountFacts,
  currency: string
): string {
  const period = plan === "monthly" ? "month" : "year";
  return `Your free trial applies to your first property only, so this property is charged today. `
    + `By providing your payment information you agree to our Terms of Service and Cancellation Policy. `
    + `Your code ${discount.code} applies ${discountLabel(discount, currency)} to the standard ${full}/${period}, `
    + `so your card will be charged ${discounted} now. `
    + `${renewalSentence(discount, plan, full, discounted)}`
    + ` You can cancel at any time in your Host Dashboard with one click.`;
}
