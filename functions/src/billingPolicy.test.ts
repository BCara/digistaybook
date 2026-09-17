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
  type DiscountFacts
} from "./billingPolicy.js";

// 8 October 2026, midday UTC — far enough from a boundary that the UTC date is
// unambiguous whichever machine runs this.
const trialEnd = Math.floor(Date.UTC(2026, 9, 8, 12) / 1000);

describe("formatPrice", () => {
  // The handbook writes "${Price}". Its dollar sign is literal and {Price} is
  // an already-formatted amount, so following it exactly renders "$A$15.00".
  // The formatted price carries its own symbol; the sentences must not add one.
  it("carries its own currency symbol", () => {
    expect(formatPrice(1500, "aud")).toBe("A$15.00");
    expect(formatPrice(1000, "usd")).toBe("US$10.00");
  });
  // Two dollar currencies on sale: a bare "$15.00" would not tell a Host which
  // dollar they are agreeing to be charged.
  it("distinguishes the two launch currencies", () =>
    expect(formatPrice(1500, "aud")).not.toBe(formatPrice(1500, "usd")));
  it("groups thousands", () => expect(formatPrice(150000, "aud")).toBe("A$1,500.00"));
  it("refuses a currency it has no symbol for", () =>
    expect(() => formatPrice(1000, "gbp")).toThrow(/No price symbol/));
});

describe("formatDate", () => {
  // BOP §6.3.4: "calculated and shown as a date rather than as 'in 28 days'".
  it("renders a date, not a duration", () => {
    expect(formatDate(trialEnd, "aud")).toBe("8 October 2026");
    expect(formatDate(trialEnd, "usd")).toBe("October 8, 2026");
  });
});

describe("priceDisclosure", () => {
  const monthly = priceDisclosure("monthly", "A$15.00", "8 October 2026");
  const annual = priceDisclosure("annual", "A$150.00", "8 October 2026");

  it("states the trial length, the date and the price", () => {
    expect(monthly).toContain("28-day free trial");
    expect(monthly).toContain("8 October 2026");
    expect(monthly).toContain("A$15.00/month");
  });

  it("never doubles the currency symbol", () => {
    expect(monthly).not.toContain("$A$");
    expect(annual).not.toContain("$A$");
  });

  it("promises no charge today, and one-click cancellation", () => {
    expect(monthly).toContain("You will not be charged today.");
    expect(monthly).toContain("cancel at any time in your Host Dashboard with one click");
  });

  // §6.3.4 gives the two plans materially different sentences: monthly renews,
  // annual "will officially begin" and charges for the first year.
  it("says something different about the annual plan", () => {
    expect(annual).toContain("charged A$150.00 for your first year");
    expect(annual).toContain("renew annually");
    expect(annual).not.toContain("/month");
  });
});

describe("chargedTodayDisclosure", () => {
  // BOP §4.1 gives the trial to the first activated property only, but §6.3.4
  // supplies no wording for the second. This copy is approved as ST-D12.
  it("does not promise a trial it cannot give", () => {
    const second = chargedTodayDisclosure("monthly", "A$15.00");
    expect(second).not.toContain("free trial ends");
    expect(second).not.toContain("You will not be charged today");
    expect(second).toContain("charged A$15.00 now");
  });
});

describe("acknowledgement", () => {
  it("quotes the amount and the date the Host is agreeing to", () =>
    expect(acknowledgement("A$15.00", "8 October 2026"))
      .toBe("I understand I will be billed A$15.00 on 8 October 2026 if I do not cancel."));
});

describe("plan validation", () => {
  it("accepts only the two published plans", () => {
    expect(billingPolicy.plans).toEqual(["monthly", "annual"]);
    expect(isPlan("monthly")).toBe(true);
    expect(isPlan("annual")).toBe(true);
    expect(isPlan("lifetime")).toBe(false);
    expect(isPlan(undefined)).toBe(false);
  });
});

describe("currency routing", () => {
  it("maps each launch market to its point-of-sale currency", () => {
    expect(billingPolicy.currencyFor.AU).toBe("aud");
    expect(billingPolicy.currencyFor.US).toBe("usd");
  });
  it("has no currency for a market that is not sold to", () =>
    expect(billingPolicy.currencyFor.GB).toBeUndefined());
});

/* ---------------------------------------------------------------------------
   Discounted terms (policy v2). §6.3.4's sentences state the amount, so a code
   makes them false — most sharply for the 100% code §4.1 exists for. A
   discounted quote is re-quoted, not annotated.                             */

const code = (over: Partial<DiscountFacts> = {}): DiscountFacts => ({
  code: "LAUNCH100",
  percentOff: 100,
  amountOff: null,
  duration: "forever",
  durationInMonths: null,
  ...over
});

describe("discountedAmount", () => {
  it("takes a percentage off, never below zero", () => {
    expect(discountedAmount(1500, code())).toBe(0);
    expect(discountedAmount(1500, code({ percentOff: 50 }))).toBe(750);
  });

  // Stripe rounds the discount rather than the total. The two must agree,
  // because this figure is the one a Host ticks a box against.
  it("rounds the discount, not the total", () =>
    expect(discountedAmount(1500, code({ percentOff: 33 }))).toBe(1500 - 495));

  it("takes a fixed amount off and stops at zero", () => {
    expect(discountedAmount(1500, code({ percentOff: null, amountOff: 500 }))).toBe(1000);
    expect(discountedAmount(1500, code({ percentOff: null, amountOff: 9999 }))).toBe(0);
  });
});

describe("discountLabel", () => {
  it("names a percentage or an amount", () => {
    expect(discountLabel(code(), "aud")).toBe("100% off");
    expect(discountLabel(code({ percentOff: null, amountOff: 500 }), "aud")).toBe("A$5.00 off");
  });
});

describe("the discounted disclosure", () => {
  const written = (facts: DiscountFacts, full = "A$15.00", charged = "A$0.00") =>
    discountedPriceDisclosure("monthly", full, charged, formatDate(trialEnd, "aud"), facts, "aud");

  it("states the charge as the code leaves it, and the rate it came off", () => {
    const sentence = written(code());
    expect(sentence).toContain("your card will be charged A$0.00");
    expect(sentence).toContain("your code LAUNCH100 applies 100% off to the standard A$15.00/month");
    expect(sentence).toContain(`${billingPolicy.trialDays}-day free trial ends on 8 October 2026`);
  });

  // The renewal is where a Host is surprised by the second invoice, so it
  // follows the coupon's own duration rather than an assumption about it.
  it("renews at the discounted price for a code that lasts forever", () =>
    expect(written(code())).toContain("renews at A$0.00/month until you cancel"));

  it("renews at the published price for a code used once", () =>
    expect(written(code({ duration: "once" }))).toContain(
      "It then renews at the standard A$15.00/month until you cancel."
    ));

  it("says how long a repeating code lasts", () => {
    expect(written(code({ duration: "repeating", durationInMonths: 3 }))).toContain(
      "Your code applies for 3 months, after which the subscription renews at the standard A$15.00/month"
    );
    expect(written(code({ duration: "repeating", durationInMonths: 1 }))).toContain("applies for 1 month,");
  });

  // A second property takes no trial, so it is charged today (ST-D12) — and a
  // code has to move that figure too.
  it("has a second-property form that charges today", () => {
    const sentence = discountedChargedTodayDisclosure("annual", "A$150.00", "A$0.00", code(), "aud");
    expect(sentence).toContain("Your free trial applies to your first property only");
    expect(sentence).toContain("your card will be charged A$0.00 now");
    expect(sentence).not.toContain("free trial ends on");
  });
});

describe("the acknowledgement under a code", () => {
  // The one §6.3.4 sentence that needed no new wording: it was never about the
  // rate card, it is about the charge.
  it("is the same sentence, against the discounted charge", () =>
    expect(acknowledgement("A$0.00", formatDate(trialEnd, "aud"))).toBe(
      "I understand I will be billed A$0.00 on 8 October 2026 if I do not cancel."
    ));
});
