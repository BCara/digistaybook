import {
  attentionItems,
  billingTotals,
  nextCharge,
  paymentSchedule,
  renewalPrice,
  scheduleByMonth,
  type SchedulableProperty
} from "./billingSchedule";
import { emptyProfile } from "./propertyProfile";

const now = Date.parse("2026-09-11T12:00:00Z");

function property(id: string, overrides: Partial<SchedulableProperty> = {}): SchedulableProperty {
  return {
    id, name: id, slug: id, ownerUid: "host", lifecycle: "active", mode: "live", foundationalPostCount: 0,
    profile: emptyProfile(),
    billing: {
      renewalAmount: 1500, renewalCurrency: "aud", renewalInterval: "month",
      trialEndsAt: null, currentPeriodEndsAt: "2026-10-01T00:00:00Z"
    },
    ...overrides
  };
}

const billingOf = (overrides: Partial<NonNullable<SchedulableProperty["billing"]>>) =>
  ({ ...property("base").billing!, ...overrides });

describe("renewalPrice", () => {
  it("accepts the catalogue's currency in any case", () => {
    expect(renewalPrice(property("a", { billing: billingOf({ renewalCurrency: "AUD" }) })))
      .toEqual({ amount: 1500, currency: "aud", interval: "month" });
  });

  it("refuses to state a price it cannot trust rather than guessing one", () => {
    const refused = [
      { renewalAmount: null },
      { renewalAmount: -1500 },
      { renewalAmount: 15.5 },
      { renewalCurrency: "gbp" },
      { renewalCurrency: null },
      { renewalInterval: "week" },
      { renewalInterval: null }
    ];
    for (const overrides of refused) {
      expect(renewalPrice(property("a", { billing: billingOf(overrides) }))).toBeNull();
    }
    expect(renewalPrice(property("a", { billing: null }))).toBeNull();
  });
});

describe("billingTotals", () => {
  it("never adds currencies together and folds an annual plan in as a twelfth", () => {
    const { totals } = billingTotals([
      property("monthly"),
      property("second-monthly"),
      property("annual", { billing: billingOf({ renewalAmount: 15000, renewalInterval: "year" }) }),
      property("usd", { billing: billingOf({ renewalAmount: 1000, renewalCurrency: "USD" }) })
    ]);
    expect(totals).toHaveLength(2);
    expect(totals[0]).toMatchObject({
      currency: "aud", perMonth: 3000, perYear: 15000, monthlyEquivalent: 4250,
      properties: 3, includesAnnual: true
    });
    expect(totals[1]).toMatchObject({
      currency: "usd", perMonth: 1000, perYear: 0, monthlyEquivalent: 1000,
      properties: 1, includesAnnual: false
    });
  });

  it("counts a trial's post-trial rate and says so, and drops what no longer renews", () => {
    const result = billingTotals([
      property("trial", { lifecycle: "trialing" }),
      property("cancelled", { lifecycle: "cancelled_pending_end", serviceEndsAt: "2026-11-30T00:00:00Z" }),
      property("draft", { lifecycle: "draft", mode: "sandbox" }),
      property("dormant", { lifecycle: "dormant" })
    ]);
    expect(result.includesTrials).toBe(true);
    expect(result.totals).toEqual([expect.objectContaining({ currency: "aud", monthlyEquivalent: 1500, properties: 1 })]);
  });

  it("reports a renewing property it cannot price instead of silently dropping it", () => {
    const { totals, unpriced } = billingTotals([property("priced"), property("mystery", { billing: null })]);
    expect(unpriced.map((entry) => entry.id)).toEqual(["mystery"]);
    expect(totals[0]!.properties).toBe(1);
  });
});

describe("paymentSchedule", () => {
  it("orders every commitment by date and sorts an undated one last", () => {
    const schedule = paymentSchedule([
      property("march", { billing: billingOf({ renewalAmount: 15000, renewalInterval: "year", currentPeriodEndsAt: "2027-03-14T00:00:00Z" }) }),
      property("undated", { billing: billingOf({ currentPeriodEndsAt: null }) }),
      property("october"),
      property("september", { lifecycle: "grace_period", billing: billingOf({ currentPeriodEndsAt: "2026-09-16T00:00:00Z" }) })
    ], now);
    expect(schedule.map((entry) => entry.property.id)).toEqual(["september", "october", "march", "undated"]);
    expect(schedule[3]!.date).toBeNull();
  });

  it("distinguishes a retry, a trial's first charge, a renewal and a wall going dark", () => {
    const schedule = paymentSchedule([
      property("failed", { lifecycle: "grace_period" }),
      property("trial", { lifecycle: "trialing", billing: billingOf({ trialEndsAt: "2026-09-21T00:00:00Z" }) }),
      property("renews"),
      property("ending", { lifecycle: "cancelled_pending_end", serviceEndsAt: "2026-11-30T00:00:00Z" })
    ], now);
    expect(schedule.map((entry) => [entry.kind, entry.label])).toEqual([
      ["trial", "Trial ends — first charge"],
      ["retry", "Retry after a failed payment"],
      ["renews", "Renews"],
      ["ends", "Cancelled — wall goes offline, no charge"]
    ]);
    // A cancellation takes no money, so it carries no amount to render.
    expect(schedule[3]!.price).toBeNull();
  });

  it("marks a date the server has let slip without inventing a new one", () => {
    const [entry] = paymentSchedule([property("stale", { billing: billingOf({ currentPeriodEndsAt: "2026-09-01T00:00:00Z" }) })], now);
    expect(entry).toMatchObject({ overdue: true, label: "Billing date has passed" });
  });

  it("leaves a property with nothing scheduled off the list entirely", () => {
    expect(paymentSchedule([
      property("draft", { lifecycle: "draft", mode: "sandbox" }),
      property("suspended", { lifecycle: "suspended" }),
      property("dormant", { lifecycle: "dormant" })
    ], now)).toEqual([]);
  });
});

describe("nextCharge", () => {
  it("names the soonest charge still ahead, skipping dates already passed", () => {
    const entry = nextCharge([
      property("passed", { billing: billingOf({ currentPeriodEndsAt: "2026-09-01T00:00:00Z" }) }),
      property("soon", { billing: billingOf({ currentPeriodEndsAt: "2026-09-20T00:00:00Z" }) }),
      property("later")
    ], now);
    expect(entry?.property.id).toBe("soon");
  });

  it("has nothing to state when every commitment is undated or takes no money", () => {
    expect(nextCharge([
      property("undated", { billing: billingOf({ currentPeriodEndsAt: null }) }),
      property("ending", { lifecycle: "cancelled_pending_end", serviceEndsAt: "2026-11-30T00:00:00Z" }),
      property("unpriced", { billing: billingOf({ renewalAmount: null }) })
    ], now)).toBeNull();
  });
});

describe("scheduleByMonth", () => {
  it("groups consecutive dates under one month and gathers undated entries at the end", () => {
    const groups = scheduleByMonth(paymentSchedule([
      property("mid-sep", { billing: billingOf({ currentPeriodEndsAt: "2026-09-16T00:00:00Z" }) }),
      property("late-sep", { billing: billingOf({ currentPeriodEndsAt: "2026-09-28T00:00:00Z" }) }),
      property("oct"),
      property("undated", { billing: billingOf({ currentPeriodEndsAt: null }) })
    ], now));
    expect(groups.map((group) => [group.month, group.entries.length])).toEqual([
      ["September 2026", 2],
      ["October 2026", 1],
      [null, 1]
    ]);
  });
});

describe("attentionItems", () => {
  it("puts money before paperwork", () => {
    const items = attentionItems([
      property("draft", { lifecycle: "draft", mode: "sandbox" }),
      property("failed", { lifecycle: "grace_period" }),
      property("suspended", { lifecycle: "suspended" })
    ], now);
    expect(items.map((item) => [item.property.id, item.billing])).toEqual([
      ["failed", true], ["suspended", true], ["draft", false]
    ]);
    expect(items[0]).toMatchObject({ action: "Review payment", href: "/host/property/failed/billing" });
  });

  it("warns about a trial inside its last week and stays quiet before that", () => {
    const soon = property("soon", { lifecycle: "trialing", billing: billingOf({ trialEndsAt: "2026-09-14T12:00:00Z" }) });
    const distant = property("distant", { lifecycle: "trialing", billing: billingOf({ trialEndsAt: "2026-10-14T12:00:00Z" }) });
    expect(attentionItems([soon, distant], now)).toEqual([
      expect.objectContaining({ action: "View trial", text: "Trial ends 14 September 2026." })
    ]);
  });

  it("tells a live property its setup is unfinished, and says when a cancelled wall is already dark", () => {
    const items = attentionItems([
      property("live"),
      property("gone", { lifecycle: "cancelled_pending_end", serviceEndsAt: "2026-09-01T00:00:00Z" })
    ], now);
    expect(items.map((item) => item.text)).toEqual([
      "Subscription cancelled. Your wall is offline.",
      "Some property information is still to be filled in."
    ]);
  });

  it("says nothing about a private draft's setup twice", () => {
    expect(attentionItems([property("draft", { lifecycle: "draft", mode: "sandbox" })], now))
      .toHaveLength(1);
  });
});
