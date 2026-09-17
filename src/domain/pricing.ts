/* ===========================================================================
   pricing — the published rate card, and the only place this app states a price.

   BOP §4.3 requires marketing, the pricing page, checkout, the dashboard and
   the policies to "describe the same offer, in the same words, at the same
   price". Before this file the landing page carried its own hand-typed
   "$10 / $100" while checkout quoted whatever the Stripe catalogue happened to
   hold, and nothing connected the two: the marketing figure could be wrong for
   months without a single test noticing.

   So the rate card is written once, here, and three things hold it in place:

     1. Every marketing surface renders from these amounts. There is no second
        copy of a number anywhere in `src/`.
     2. `functions/src/billingPolicy.ts` carries the same table — it cannot
        import this one, because the two packages compile separately with
        different roots — and `pricing.test.ts` fails the moment the two
        disagree, in either direction.
     3. `stripeActivation.quote()` refuses to quote a Stripe amount that is not
        the published one. A catalogue edited in the Stripe dashboard stops
        checkout rather than silently selling at a price this page never showed.

   The amounts are ST-D1, signed off 8 September 2026: monthly A$15 / US$10,
   annual A$150 / US$100, annual exactly ten times monthly. Changing one means
   changing the Stripe catalogue and both tables together, which is the point.
   ========================================================================= */

export const plans = ["monthly", "annual"] as const;
export type Plan = (typeof plans)[number];

/** The point-of-sale currencies on the launch allowlist (ST-D4). */
export const posCurrencies = ["aud", "usd"] as const;
export type PosCurrency = (typeof posCurrencies)[number];

/** The billing country a visitor is quoted in, and the currency it prices in. */
export const currencyForCountry = { AU: "aud", US: "usd" } as const satisfies Record<string, PosCurrency>;

/** BOP §4.1. The first activated property only, and a payment method is required to start. */
export const trialDays = 28;

/** The published rate card, in minor units, exactly as the Stripe catalogue holds it. */
export const publishedRates: Record<PosCurrency, Record<Plan, number>> = {
  aud: { monthly: 1500, annual: 15000 },
  usd: { monthly: 1000, annual: 10000 }
};

export function publishedRate(plan: Plan, currency: PosCurrency): number {
  return publishedRates[currency][plan];
}

/* ------------------------------- Rendering --------------------------------
   Hand-built rather than left to `Intl`, for the reason `billingPolicy.ts`
   sets out at length: `Intl` renders AUD in `en-AU` as a bare "$", and with two
   dollar currencies on sale a reader cannot tell which dollar they are being
   quoted. A price on this page and the price in the acknowledgement a Host
   ticks a box against have to be the same string, so they are built the same
   way. `pricing.test.ts` holds the two implementations to that.            */

const symbolFor: Record<PosCurrency, string> = { aud: "A$", usd: "US$" };

/** The currency as a Host would name it, for the switch and the fine print. */
export const currencyNames: Record<PosCurrency, string> = {
  aud: "Australian dollars",
  usd: "US dollars"
};

export const countryNames = { AU: "Australia", US: "the United States" } as const;

/** A price as a Host reads it: "A$15.00". Mirrors `billingPolicy.formatPrice`. */
export function formatPrice(minorUnits: number, currency: PosCurrency): string {
  const amount = (minorUnits / 100).toFixed(2);
  const [whole, cents] = amount.split(".");
  return `${symbolFor[currency]}${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/**
 * The same price with a whole-unit tail dropped: "A$15" rather than "A$15.00".
 *
 * §4.1 rounds every published rate cleanly to the nearest whole unit, so the
 * cents on a headline rate are two characters that only ever read "00". They
 * are kept everywhere the figure is legal rather than promotional — the
 * disclosure, the acknowledgement, the receipt — and dropped only here, where
 * the figure is being read rather than agreed to.
 */
export function formatRate(minorUnits: number, currency: PosCurrency): string {
  const exact = formatPrice(minorUnits, currency);
  return exact.endsWith(".00") ? exact.slice(0, -3) : exact;
}

/**
 * How many months of the monthly rate the annual plan gives away.
 *
 * Derived rather than written down. "Two months free" was a hand-typed badge
 * on the landing page, which is a promise about two numbers made in a third
 * place — the one arrangement guaranteed to go stale. A rate card whose annual
 * plan is not a whole number of months free says nothing rather than rounding.
 */
export function monthsFreeOnAnnual(currency: PosCurrency): number | null {
  const { monthly, annual } = publishedRates[currency];
  const saved = monthly * 12 - annual;
  return saved > 0 && saved % monthly === 0 ? saved / monthly : null;
}

/** What a year on the annual plan saves against twelve monthly charges. */
export function annualSaving(currency: PosCurrency): number {
  const { monthly, annual } = publishedRates[currency];
  return monthly * 12 - annual;
}

/* ------------------------------ The copy ----------------------------------
   §6.3.4 fixes the trial callout and §4.1 fixes the tax callout word for word.
   They live here beside the numbers they appear next to, so a page cannot
   quote one without the other.                                             */

/** BOP §6.3.4, verbatim. */
export const trialCallout = "Create your account and add your first property to activate your 28-day free trial.";

/** BOP §4.1, verbatim. Not a claim this page is free to rephrase. */
export const taxCallout =
  "DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances "
  + "and business use; seek tax advice.";

/**
 * The single unified checklist §6.3.4 asks for. One list, because both plans
 * are the same platform and a feature grid split across two columns would be
 * inventing a tier that does not exist.
 */
export const includedFeatures: readonly string[] = [
  "Unlimited guest posts and photo uploads",
  "Printable and downloadable QR kit",
  "Pinned host posts and house guidance",
  "Automated content screening plus host approval",
  "Dashboard moderation, pinning and deletion",
  "Themes, layouts and live wall preview",
  "Private guest feedback inbox",
  "Privacy and takedown request queue"
];

/** One plan as a marketing surface renders it. */
export type PublishedPlan = {
  plan: Plan;
  /** "A$15", whole-unit. */
  rate: string;
  /** "per month, per property". */
  period: string;
  /** "Two months free", or null when the saving is not a whole number of months. */
  saving: string | null;
};

export function publishedPlans(currency: PosCurrency): PublishedPlan[] {
  const months = monthsFreeOnAnnual(currency);
  return [
    {
      plan: "monthly",
      rate: formatRate(publishedRate("monthly", currency), currency),
      period: "per month, per property",
      saving: null
    },
    {
      plan: "annual",
      rate: formatRate(publishedRate("annual", currency), currency),
      period: "per year, per property",
      saving: months === null ? null : `${months === 2 ? "Two" : String(months)} months free`
    }
  ];
}
