import { countryIsPermitted, isHandled, paidAtOf, renewalOf, resolveLifecycle, wallIsServed } from "./stripeBilling.js";

const sub = (status: string, cancelAtPeriodEnd = false) =>
  ({ status, cancelAtPeriodEnd }) as Parameters<typeof resolveLifecycle>[0];

describe("resolveLifecycle", () => {
  it("serves a trialing subscription", () => expect(resolveLifecycle(sub("trialing"))).toBe("trialing"));
  it("serves an active subscription", () => expect(resolveLifecycle(sub("active"))).toBe("active"));

  // The single most likely bug in this integration: Stripe reports a cancelled
  // subscription as active with a flag, so a status-only reading leaves the
  // dashboard saying "Active" after the host has cancelled and been emailed.
  it("reads cancellation from the flag, not the status", () => {
    expect(resolveLifecycle(sub("active", true))).toBe("cancelled_pending_end");
    expect(resolveLifecycle(sub("trialing", true))).toBe("cancelled_pending_end");
  });

  // BOP §5.7: the wall stays live while the card is retried.
  it("keeps a failed payment in grace", () => expect(resolveLifecycle(sub("past_due"))).toBe("grace_period"));
  it("does not let a cancellation extend grace", () =>
    expect(resolveLifecycle(sub("past_due", true))).toBe("grace_period"));

  it("suspends at the end of dunning", () => expect(resolveLifecycle(sub("unpaid"))).toBe("suspended"));
  it("makes an ended subscription dormant", () => expect(resolveLifecycle(sub("canceled"))).toBe("dormant"));

  it("grants nothing for an unfinished checkout", () => {
    expect(resolveLifecycle(sub("incomplete"))).toBeNull();
    expect(resolveLifecycle(sub("incomplete_expired"))).toBeNull();
  });

  // A status added to Stripe after this was written must close the wall, not
  // open it — BOP §5.2 requires the wall to fail closed.
  it("grants nothing for a status it does not know", () =>
    expect(resolveLifecycle(sub("some_future_status"))).toBeNull());
});

describe("wallIsServed", () => {
  it("serves trial, active, grace and the paid tail of a cancellation", () => {
    expect(["trialing", "active", "grace_period", "cancelled_pending_end"].every(l =>
      wallIsServed(l as never))).toBe(true);
  });
  it("refuses suspended, dormant and no entitlement", () => {
    expect(wallIsServed("suspended")).toBe(false);
    expect(wallIsServed("dormant")).toBe(false);
    expect(wallIsServed(null)).toBe(false);
  });
});

describe("countryIsPermitted", () => {
  it("permits the launch markets in any casing", () => {
    expect(countryIsPermitted("AU")).toBe(true);
    expect(countryIsPermitted("us")).toBe(true);
    expect(countryIsPermitted(" au ")).toBe(true);
  });
  it("refuses everything else, including the markets dropped at launch", () => {
    expect(countryIsPermitted("GB")).toBe(false);
    expect(countryIsPermitted("DE")).toBe(false);
    expect(countryIsPermitted("")).toBe(false);
    expect(countryIsPermitted(undefined)).toBe(false);
    expect(countryIsPermitted(null)).toBe(false);
    expect(countryIsPermitted(["AU"])).toBe(false);
  });
});

describe("isHandled", () => {
  it("recognises the events the endpoint acts on", () =>
    expect(isHandled("customer.subscription.updated")).toBe(true));
  it("does not claim events it has no handler for", () =>
    expect(isHandled("payment_intent.succeeded")).toBe(false));
});

describe("paidAtOf", () => {
  const invoice = (amount_paid: number, paid_at?: number) => ({
    type: "invoice.paid",
    created: 1_757_500_000,
    data: { object: { amount_paid, status_transitions: paid_at ? { paid_at } : null } }
  });

  // The bug this function exists to stop: Stripe raises a zero-amount invoice
  // when a trial starts and marks it paid, and stamping `lastPaymentAt` from
  // that showed a Host a payment date for a card that had never been charged.
  it("is silent about the zero-amount invoice Stripe raises at trial start", () => {
    expect(paidAtOf(invoice(0, 1_757_400_000))).toBeNull();
  });

  it("reports a real payment at the moment the invoice was paid", () => {
    expect(paidAtOf(invoice(1500, 1_757_400_000))).toBe(1_757_400_000);
  });

  // A webhook replayed a day late must not restamp the payment as today, so
  // the fallback is the event, never the clock.
  it("falls back to the event time when the invoice carries no paid_at", () => {
    expect(paidAtOf(invoice(1500))).toBe(1_757_500_000);
  });

  it("ignores every event that is not a paid invoice", () => {
    expect(paidAtOf({ ...invoice(1500, 1), type: "invoice.payment_failed" })).toBeNull();
    expect(paidAtOf({ ...invoice(1500, 1), type: "customer.subscription.updated" })).toBeNull();
  });
});

describe("renewalOf", () => {
  const priced = (price: unknown) =>
    ({ currency: "aud", items: { data: [{ price }] } }) as Parameters<typeof renewalOf>[0];

  it("reads the amount straight off a price in the billing currency", () => {
    expect(renewalOf(priced({ currency: "aud", unit_amount: 1500, recurring: { interval: "month" } })))
      .toEqual({ amount: 1500, interval: "month" });
  });

  // A US host on a USD subscription against an AUD-based price. Reading
  // `unit_amount` alone would quote them the Australian figure.
  it("prefers the currency option matching the subscription", () => {
    const subscription = {
      currency: "usd",
      items: { data: [{ price: {
        currency: "aud",
        unit_amount: 1500,
        currency_options: { usd: { unit_amount: 1000 } },
        recurring: { interval: "month" }
      } }] }
    } as Parameters<typeof renewalOf>[0];
    expect(renewalOf(subscription)).toEqual({ amount: 1000, interval: "month" });
  });

  // `currency_options` is absent unless the caller expanded it. Saying nothing
  // costs the screen a figure; guessing would cost it the right currency.
  it("says nothing rather than quote a currency it cannot confirm", () => {
    expect(renewalOf(priced({ currency: "usd", unit_amount: 1000, recurring: { interval: "month" } }))).toBeNull();
    expect(renewalOf(priced(null))).toBeNull();
  });
});
