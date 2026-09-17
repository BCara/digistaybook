/* ===========================================================================
   billingSchedule — every renewal a Host is committed to, in the order it
   happens.

   This was arithmetic inlined in the dashboard's overview component, which is
   the wrong place for it twice over: it is the part most likely to be wrong,
   and it is now read by two surfaces — the strip on the dashboard and the
   account billing page — which must not be allowed to disagree about what a
   Host owes.

   Two rules the maths is held to, both of which the old inline version could
   only honour by accident:

     1. Currencies are never added together. `renewalCurrency` is AUD or USD
        (ST-D4) and a single "you pay $X" figure across the two would be a
        number no Host could act on. Totals are per currency, always.

     2. A yearly plan shown beside monthly ones is divided by twelve and said
        to be. The alternative — listing "A$150 / year" next to "A$15 / month"
        and leaving the reader to normalise — is what made the old panel
        unreadable the moment a Host held both plans.

   Nothing here reads Firestore or renders. It takes the properties a page has
   already loaded and answers questions about them.
   ========================================================================= */

import { isPubliclyReadable, type PropertyLifecycle, type PropertySummary } from "./property";
import { posCurrencies, type PosCurrency } from "./pricing";
import { setupProgress, type PropertyProfile } from "./propertyProfile";

/**
 * What this module needs of a property, written here rather than imported
 * from the store: the domain does not depend on the UI, and stating the shape
 * structurally means `HostProperty` satisfies it without either file knowing
 * about the other. Every function is generic over it, so a page that passes
 * `HostProperty[]` gets `HostProperty` back out of the schedule it reads.
 */
export type BillingFacts = {
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  renewalAmount: number | null;
  renewalCurrency: string | null;
  renewalInterval: string | null;
};

export type SchedulableProperty = PropertySummary & {
  billing: BillingFacts | null;
  profile: PropertyProfile;
};

/** The lifecycles that carry a commitment to pay again. Cancelled does not. */
const renewing: readonly PropertyLifecycle[] = ["trialing", "active", "grace_period"];

/** Stripe's two interval words, as the catalogue writes them. */
export type RenewalInterval = "month" | "year";

export type RenewalPrice = { amount: number; currency: PosCurrency; interval: RenewalInterval };

const parseDate = (value: string | null | undefined): number | null => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The next invoice, or null when the property has no price this app is willing
 * to state.
 *
 * Deliberately unforgiving: a malformed amount, an unrecognised currency or an
 * interval outside the catalogue all return null rather than a guess, because
 * every caller renders the result as money. A property that lands here is
 * counted as unpriced and said to be, which is honest; a property rendered at
 * A$0.00 because a field was missing is not.
 */
export function renewalPrice(property: SchedulableProperty): RenewalPrice | null {
  const billing = property.billing;
  const currency = billing?.renewalCurrency?.toLowerCase();
  const amount = billing?.renewalAmount;
  const interval = billing?.renewalInterval;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) return null;
  if (!posCurrencies.includes(currency as PosCurrency)) return null;
  if (interval !== "month" && interval !== "year") return null;
  return { amount, currency: currency as PosCurrency, interval };
}

/* ------------------------------ The schedule ---------------------------- */

/**
 * Why a property appears on a date.
 *
 * `retry` and `ends` are not charges a Host is choosing to make, so they are
 * separated from `renews`: a schedule that renders a failed payment and a
 * healthy renewal identically is the reason the old panel needed reading
 * twice.
 */
export type ScheduleKind = "retry" | "trial" | "renews" | "ends";

export type ScheduleEntry<P extends SchedulableProperty = SchedulableProperty> = {
  property: P;
  kind: ScheduleKind;
  /** ISO, or null when the server has not written a date we can read. */
  date: string | null;
  /** Milliseconds, or null. Sorting key; null sorts last. */
  at: number | null;
  /** What happens on that date, in a Host's words. */
  label: string;
  /** Null for an entry that takes no money, and for an unpriced property. */
  price: RenewalPrice | null;
  /** True when the date has already passed and the server has not moved it. */
  overdue: boolean;
};

const scheduleFor = <P extends SchedulableProperty>(property: P, now: number): ScheduleEntry<P> | null => {
  const price = renewalPrice(property);
  const billing = property.billing;
  const base = { property, price, overdue: false };

  switch (property.lifecycle) {
    case "grace_period": {
      const at = parseDate(billing?.currentPeriodEndsAt);
      return { ...base, kind: "retry", date: billing?.currentPeriodEndsAt ?? null, at,
        label: "Retry after a failed payment", overdue: at !== null && at < now };
    }
    case "trialing": {
      const date = billing?.trialEndsAt ?? billing?.currentPeriodEndsAt ?? null;
      const at = parseDate(date);
      return { ...base, kind: "trial", date, at,
        label: at !== null && at < now ? "Trial end date has passed" : "Trial ends — first charge",
        overdue: at !== null && at < now };
    }
    case "active": {
      const at = parseDate(billing?.currentPeriodEndsAt);
      return { ...base, kind: "renews", date: billing?.currentPeriodEndsAt ?? null, at,
        label: at !== null && at < now ? "Billing date has passed" : "Renews", overdue: at !== null && at < now };
    }
    case "cancelled_pending_end": {
      const at = parseDate(property.serviceEndsAt);
      // The money has already stopped, so this entry carries no price. It is
      // on the schedule because a wall going dark is a thing a Host plans
      // around, and a billing page that hid it would be hiding the one date
      // they most need to see coming.
      return { ...base, kind: "ends", date: property.serviceEndsAt ?? null, at, price: null,
        label: at !== null && at < now ? "Cancelled — wall is offline" : "Cancelled — wall goes offline, no charge",
        overdue: false };
    }
    default:
      return null;
  }
};

/**
 * Every dated commitment, soonest first. A commitment whose date the server
 * has not written sorts to the end rather than being dropped: "we do not know
 * when" is a different statement from "there is nothing", and only one of them
 * is safe to leave off a billing page.
 */
export function paymentSchedule<P extends SchedulableProperty>(properties: P[], now = Date.now()): ScheduleEntry<P>[] {
  return properties
    .flatMap((property) => scheduleFor(property, now) ?? [])
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
}

/** The soonest entry that still lies ahead — what the dashboard strip states. */
export function nextCharge<P extends SchedulableProperty>(properties: P[], now = Date.now()): ScheduleEntry<P> | null {
  return paymentSchedule(properties, now).find((entry) =>
    entry.price !== null && entry.at !== null && entry.at >= now) ?? null;
}

/**
 * The schedule grouped into the months it falls in, in order, with undated
 * entries gathered at the end under a null month.
 *
 * Grouping is here rather than in the page because the month a date belongs to
 * is a fact about the date, and a page that recomputed it would be a second
 * place for a timezone to be read differently.
 */
export function scheduleByMonth<P extends SchedulableProperty>(
  entries: ScheduleEntry<P>[]
): { month: string | null; entries: ScheduleEntry<P>[] }[] {
  const groups: { month: string | null; entries: ScheduleEntry<P>[] }[] = [];
  for (const entry of entries) {
    const month = entry.at === null
      ? null
      : new Date(entry.at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry] });
  }
  return groups;
}

/* -------------------------------- Totals -------------------------------- */

export type CurrencyTotal = {
  currency: PosCurrency;
  /** Minor units charged every month, before annual plans are folded in. */
  perMonth: number;
  /** Minor units charged every year. */
  perYear: number;
  /** `perMonth` plus a twelfth of `perYear`, rounded to the minor unit. */
  monthlyEquivalent: number;
  /** How many properties contribute, so the figure can say what it covers. */
  properties: number;
  /** True when an annual plan is folded in, so the page can show its working. */
  includesAnnual: boolean;
};

export type BillingTotals<P extends SchedulableProperty = SchedulableProperty> = {
  totals: CurrencyTotal[];
  /** Renewing properties whose price this app will not state. */
  unpriced: P[];
  /** True when a trial's post-trial rate is inside the figures. */
  includesTrials: boolean;
};

/**
 * What renews, per currency. Never one number: see rule 1 at the top.
 *
 * A yearly plan is carried as both its own annual figure and a twelfth of it,
 * so a page can render "A$150 / year" and "A$12.50 / month" from the same
 * total without dividing anything itself.
 */
export function billingTotals<P extends SchedulableProperty>(properties: P[]): BillingTotals<P> {
  const committed = properties.filter((property) => renewing.includes(property.lifecycle));
  const byCurrency = new Map<PosCurrency, CurrencyTotal>();
  const unpriced: P[] = [];

  for (const property of committed) {
    const price = renewalPrice(property);
    if (!price) { unpriced.push(property); continue; }
    const total = byCurrency.get(price.currency)
      ?? { currency: price.currency, perMonth: 0, perYear: 0, monthlyEquivalent: 0, properties: 0, includesAnnual: false };
    if (price.interval === "month") total.perMonth += price.amount;
    else { total.perYear += price.amount; total.includesAnnual = true; }
    total.properties += 1;
    byCurrency.set(price.currency, total);
  }

  for (const total of byCurrency.values()) {
    total.monthlyEquivalent = total.perMonth + Math.round(total.perYear / 12);
  }

  return {
    // Ordered by the rate card's own currency order, so two accounts holding
    // the same currencies always read them in the same sequence.
    totals: posCurrencies.flatMap((currency) => byCurrency.get(currency) ?? []),
    unpriced,
    includesTrials: committed.some((property) => property.lifecycle === "trialing")
  };
}

/* ------------------------------- Attention ------------------------------ */

export type AttentionItem<P extends SchedulableProperty = SchedulableProperty> = {
  property: P;
  text: string;
  href: string;
  action: string;
  /** True for a problem with money, which outranks a setup step. */
  billing: boolean;
  /**
   * True only when a wall is offline or about to be, and the Host has to do
   * something to stop it. A trial ending on a known date and a cancellation
   * running to its end are neither: they are dated facts, and the schedule
   * states them. Keeping the two apart is what stops a billing page raising
   * three alarms when one thing is actually wrong.
   */
  urgent: boolean;
};

/** How long before a trial ends a Host should be told without being asked. */
const trialNoticeDays = 7;

/**
 * What a Host is being asked to do, payment problems first.
 *
 * The dashboard reads the count; the billing page reads only the `billing`
 * ones. Both read the same list, so the number in the strip and the banners on
 * the page can never describe different situations.
 */
export function attentionItems<P extends SchedulableProperty>(
  properties: P[],
  now = Date.now()
): AttentionItem<P>[] {
  const items = properties.flatMap((property): AttentionItem<P>[] => {
    const billingHref = `/host/property/${property.id}/billing`;
    const setupHref = `/host/property/${property.id}`;
    switch (property.lifecycle) {
      case "grace_period":
        return [{ property, billing: true, urgent: true, href: billingHref, action: "Review payment",
          text: "Payment failed. Review billing to keep your wall live." }];
      case "suspended":
        return [{ property, billing: true, urgent: true, href: billingHref, action: "Review billing",
          text: "Wall suspended. Review billing to restore access." }];
      case "cancelled_pending_end":
        return [{ property, billing: true, urgent: false, href: billingHref, action: "View subscription",
          text: isPubliclyReadable(property, now)
            ? `Subscription cancelled. Service ends ${formatScheduleDate(property.serviceEndsAt ?? null)}.`
            : "Subscription cancelled. Your wall is offline." }];
      case "trialing": {
        const at = parseDate(property.billing?.trialEndsAt ?? property.billing?.currentPeriodEndsAt);
        if (at === null || at > now + trialNoticeDays * 86400000) return [];
        return [{ property, billing: true, urgent: false, href: billingHref, action: "View trial",
          text: at > now
            ? `Trial ends ${formatScheduleDate(new Date(at).toISOString())}.`
            : "Trial end date has passed. Check your billing status." }];
      }
      case "draft":
        return [{ property, billing: false, urgent: false, href: setupHref, action: "Continue setup",
          text: "Draft property. Continue setup when you are ready." }];
      default:
        return isPubliclyReadable(property, now) && !setupProgress(property.profile).complete
          ? [{ property, billing: false, urgent: false, href: setupHref, action: "Complete information",
              text: "Some property information is still to be filled in." }]
          : [];
    }
  });
  // A failed payment takes a wall offline; an unfinished paragraph does not.
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || Number(b.billing) - Number(a.billing));
}

/* ------------------------------- Rendering ------------------------------ */

/**
 * A date as a Host reads it. Mirrors `ui/host/PropertyState.formatDate`, which
 * this module cannot import: the domain layer does not depend on the UI.
 */
export function formatScheduleDate(iso: string | null): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** The same date shortened for a schedule column: "16 Sep". */
export function formatScheduleDay(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "monthly" / "yearly", for the line under an amount. */
export const intervalLabels: Record<RenewalInterval, string> = { month: "monthly", year: "yearly" };
