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
   annual A$150 / US$100, annual exactly ten times monthly. On 30 October 2026
   (D-027, D-028) DigiStayBook began selling worldwide on a currency ladder:
   US$10 converted at the RBA rates of 29 October 2026 and rounded to a whole
   unit — £8, €9, NZ$18, CA$14 — with A$15 kept as approved, every annual price
   exactly ten times its monthly one, and USD for every country without a
   price of its own. The handbook §4.1 rate card holds the same rows. Changing
   one means changing the Stripe catalogue and both tables together, which is
   the point.
   ========================================================================= */

export const plans = ["monthly", "annual"] as const;
export type Plan = (typeof plans)[number];

/** The currencies on the ladder. Every country is billed in one of these. */
export const posCurrencies = ["aud", "nzd", "gbp", "eur", "cad", "usd"] as const;
export type PosCurrency = (typeof posCurrencies)[number];

/**
 * The countries with a price of their own. Every other country is billed in
 * USD, the base the ladder is converted from.
 *
 * The euro rows are the euro area, not the EU: a Host in Stockholm or Warsaw
 * has no krona or zloty price, so they pay the USD one. `billingPolicy.ts`
 * holds the same map, and `pricing.test.ts` fails the moment the two disagree.
 */
export const currencyForCountry: Readonly<Record<string, PosCurrency>> = {
  AU: "aud",
  NZ: "nzd",
  GB: "gbp",
  CA: "cad",
  AT: "eur", BE: "eur", BG: "eur", CY: "eur", DE: "eur", EE: "eur", ES: "eur",
  FI: "eur", FR: "eur", GR: "eur", HR: "eur", IE: "eur", IT: "eur", LT: "eur",
  LU: "eur", LV: "eur", MT: "eur", NL: "eur", PT: "eur", SI: "eur", SK: "eur"
};

/** Billed in USD unless the country has a price of its own. */
export const baseCurrency: PosCurrency = "usd";

export function currencyFor(country: string | null | undefined): PosCurrency {
  return (country && currencyForCountry[country]) || baseCurrency;
}

/** An ISO 3166-1 alpha-2 code from `billingCountries`. */
export type BillingCountry = string;

/**
 * Every country a Host can be billed in: ISO 3166-1 alpha-2, less the
 * uninhabited territories and the countries Stripe cannot take payments from
 * (Cuba, Iran, North Korea, Syria). The server holds the same list.
 */
export const billingCountries: readonly BillingCountry[] = [
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

const billingCountrySet = new Set(billingCountries);

export function isBillingCountry(value: string | null | undefined): value is BillingCountry {
  return typeof value === "string" && billingCountrySet.has(value);
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

/** "Germany" for "DE"; the code itself where the runtime has no name for it. */
export function countryName(code: BillingCountry): string {
  return regionNames?.of(code) ?? code;
}

/** Where each currency on the ladder is charged, for copy that cannot know where the reader is. */
export const currencyRegions: Record<PosCurrency, string> = {
  aud: "in Australia",
  nzd: "in New Zealand",
  gbp: "in the UK",
  eur: "in the euro area",
  cad: "in Canada",
  usd: "in the US and everywhere else"
};

/** The ladder, in a sentence. One phrasing, so the pages cannot drift apart. */
export const currencyCoverage =
  "DigiStayBook sells worldwide. Hosts in Australia, New Zealand, the UK, the euro area and Canada are billed "
  + "in their own currency, and everyone else in US dollars";

/** BOP §4.1. The first activated property only, and a payment method is required to start. */
export const trialDays = 28;

/** The published rate card, in minor units, exactly as the Stripe catalogue holds it. */
export const publishedRates: Record<PosCurrency, Record<Plan, number>> = {
  aud: { monthly: 1500, annual: 15000 },
  nzd: { monthly: 1800, annual: 18000 },
  gbp: { monthly: 800, annual: 8000 },
  eur: { monthly: 900, annual: 9000 },
  cad: { monthly: 1400, annual: 14000 },
  usd: { monthly: 1000, annual: 10000 }
};

export function publishedRate(plan: Plan, currency: PosCurrency): number {
  return publishedRates[currency][plan];
}

/* ------------------------------- Rendering --------------------------------
   Hand-built rather than left to `Intl`, for the reason `billingPolicy.ts`
   sets out at length: `Intl` renders AUD in `en-AU` as a bare "$", and with four
   dollar currencies on sale a reader cannot tell which dollar they are being
   quoted. A price on this page and the price in the acknowledgement a Host
   ticks a box against have to be the same string, so they are built the same
   way. `pricing.test.ts` holds the two implementations to that.            */

const symbolFor: Record<PosCurrency, string> = { aud: "A$", nzd: "NZ$", gbp: "£", eur: "€", cad: "CA$", usd: "US$" };

/** The currency as a Host would name it, for the switch and the fine print. */
export const currencyNames: Record<PosCurrency, string> = {
  aud: "Australian dollars",
  nzd: "New Zealand dollars",
  gbp: "British pounds",
  eur: "euros",
  cad: "Canadian dollars",
  usd: "US dollars"
};

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
 * Derived rather than written down. "Two months free" was once a hand-typed badge
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

/**
 * The headline that carries the tax message, the way a retailer marks a
 * product "tax deductible*": always "could be", never a promise, and always
 * starred to `taxCallout` as the small print on the same page.
 */
export const taxHeadline = "Could be tax deductible";

/** The one-line reason under the headline. Still not a promise. */
export const taxPitch =
  "Hosting is a business, and DigiStayBook is one of the tools you run it with. "
  + "For many hosts that makes it a business expense at tax time.";

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

const monthWords: Record<number, string> = { 1: "One", 2: "Two", 3: "Three", 4: "Four" };

/** The annual badge, "Two months free", or null when the saving is not whole months. */
export function monthsFreeLabel(currency: PosCurrency): string | null {
  const months = monthsFreeOnAnnual(currency);
  return months === null ? null : `${monthWords[months] ?? String(months)} months free`;
}

export function publishedPlans(currency: PosCurrency): PublishedPlan[] {
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
      saving: monthsFreeLabel(currency)
    }
  ];
}
