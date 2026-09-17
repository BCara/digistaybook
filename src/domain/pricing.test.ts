import * as server from "../../functions/src/billingPolicy";
import {
  annualSaving,
  formatPrice,
  formatRate,
  monthsFreeOnAnnual,
  plans,
  posCurrencies,
  publishedPlans,
  publishedRate,
  publishedRates,
  taxCallout,
  trialCallout,
  trialDays
} from "./pricing";

/**
 * The whole point of this file: `src/domain/pricing.ts` and
 * `functions/src/billingPolicy.ts` hold the same rate card in two packages that
 * cannot import each other. BOP §4.3 requires marketing and checkout to quote
 * the same price, and a copied table only stays honest if something fails when
 * the copies part company.
 */
describe("the published rate card matches the server's", () => {
  it("prices every plan in every currency identically", () => {
    for (const currency of posCurrencies) {
      for (const plan of plans) {
        expect(publishedRate(plan, currency)).toBe(server.publishedRate(plan, currency));
      }
    }
  });

  // Both directions. Without this a currency added on the server — a rate a
  // Host could be charged — would pass while `/pricing` never mentioned it.
  it("publishes exactly the currencies the server prices", () => {
    expect(Object.keys(publishedRates).sort()).toEqual(Object.keys(server.publishedRates).sort());
  });

  it("formats a price into the same string the acknowledgement is written with", () => {
    for (const currency of posCurrencies) {
      for (const plan of plans) {
        const amount = publishedRate(plan, currency);
        expect(formatPrice(amount, currency)).toBe(server.formatPrice(amount, currency));
      }
    }
  });

  it("states the same trial length", () => expect(trialDays).toBe(server.billingPolicy.trialDays));

  it("offers the same plans", () => expect([...plans]).toEqual([...server.billingPolicy.plans]));
});

describe("rates", () => {
  it("quotes the signed-off ST-D1 amounts", () => {
    expect(formatRate(publishedRate("monthly", "aud"), "aud")).toBe("A$15");
    expect(formatRate(publishedRate("annual", "aud"), "aud")).toBe("A$150");
    expect(formatRate(publishedRate("monthly", "usd"), "usd")).toBe("US$10");
    expect(formatRate(publishedRate("annual", "usd"), "usd")).toBe("US$100");
  });

  // Two dollar currencies are on sale, so a bare "$15" would not say which.
  it("names the dollar", () => {
    expect(formatRate(1500, "aud")).not.toBe(formatRate(1500, "usd"));
  });

  it("keeps the cents where a figure is agreed to rather than read", () => {
    expect(formatPrice(1500, "aud")).toBe("A$15.00");
    expect(formatRate(1500, "aud")).toBe("A$15");
    // A rate that is not a whole unit keeps its cents rather than lying.
    expect(formatRate(1550, "aud")).toBe("A$15.50");
  });

  it("groups thousands", () => expect(formatPrice(150000, "aud")).toBe("A$1,500.00"));
});

describe("the annual saving", () => {
  // The badge used to be the hand-typed words "Two months free" sitting beside
  // two numbers it made a promise about. It is now derived from them.
  it("is two months in every published currency", () => {
    for (const currency of posCurrencies) expect(monthsFreeOnAnnual(currency)).toBe(2);
  });

  it("is the difference against twelve monthly charges", () => {
    for (const currency of posCurrencies) {
      const { monthly, annual } = publishedRates[currency];
      expect(annualSaving(currency)).toBe(monthly * 12 - annual);
    }
  });

  it("says nothing rather than rounding when the saving is not whole months", () => {
    const original = publishedRates.usd.annual;
    publishedRates.usd.annual = 10500;
    try {
      expect(monthsFreeOnAnnual("usd")).toBeNull();
      expect(publishedPlans("usd")[1]!.saving).toBeNull();
    } finally {
      publishedRates.usd.annual = original;
    }
  });
});

describe("the approved copy", () => {
  // BOP §6.3.4 and §4.1 fix these word for word; they are not this app's to
  // rephrase, and a page that quotes a rate must be able to quote them with it.
  it("carries the trial callout verbatim", () =>
    expect(trialCallout).toBe(
      "Create your account and add your first property to activate your 28-day free trial."
    ));

  it("carries the tax callout verbatim", () =>
    expect(taxCallout).toBe(
      "DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances "
        + "and business use; seek tax advice."
    ));
});
