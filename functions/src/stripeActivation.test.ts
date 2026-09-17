import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activationOptions, createActivationCheckout, forgetCatalogue } from "./stripeActivation";
import { billingPolicy } from "./billingPolicy";

const mocks = vi.hoisted(() => ({
  property: { ownerUid: "host-a", lifecycle: "draft", foundationalPostCount: 0, profile: {} } as Record<string, unknown>,
  trialConsumed: true,
  price: vi.fn(), checkout: vi.fn(), hostWrite: vi.fn(), acknowledgementWrite: vi.fn(),
  promotionList: vi.fn()
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: () => 123, fromMillis: (value: number) => value },
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: () => name === "hosts" ? {
        get: async () => ({
          exists: true,
          get: (key: string) => key === "stripeCustomerId" ? "cus_test"
            : key === "trialConsumedAt" ? (mocks.trialConsumed ? 123 : undefined)
            : undefined
        }),
        set: mocks.hostWrite
      } : {
        get: async () => ({ id: "prop-1", exists: true, get: (key: string) => mocks.property[key] }),
        collection: (child: string) => {
          if (child !== "billingAcknowledgements") throw new Error(`Unexpected content query: ${child}`);
          return { doc: () => ({ id: "ack-1", set: mocks.acknowledgementWrite }) };
        }
      }
    })
  })
}));

vi.mock("./stripeConfig.js", () => ({
  stripeSecrets: [],
  stripePriceMonthly: { value: () => "price_monthly" },
  stripePriceAnnual: { value: () => "price_annual" },
  appUrl: { value: () => "https://example.test" },
  stripe: () => ({
    prices: { retrieve: mocks.price },
    checkout: { sessions: { create: mocks.checkout } },
    promotionCodes: { list: mocks.promotionList }
  })
}));

const request = () => ({
  auth: { uid: "host-a", token: { firebase: { sign_in_provider: "password" } } },
  data: { propertyId: "prop-1", country: "AU", plan: "monthly", acknowledged: true, version: billingPolicy.version }
});

beforeEach(() => {
  vi.clearAllMocks();
  // Each test starts on a cold instance: the catalogue is remembered
  // between calls in production, and a quote carried over from the test
  // before would hide the retrieve this one is about.
  forgetCatalogue();
  mocks.property = { ownerUid: "host-a", lifecycle: "draft", foundationalPostCount: 0, profile: {} };
  mocks.trialConsumed = true;
  mocks.price.mockImplementation(async (id: string) => ({
    currency: "aud",
    unit_amount: id === "price_monthly" ? 1500 : 15000,
    product: "prod_test"
  }));
  mocks.promotionList.mockResolvedValue({ data: [] });
  mocks.checkout.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/test" });
  mocks.hostWrite.mockResolvedValue(undefined);
  mocks.acknowledgementWrite.mockResolvedValue(undefined);
});

describe("activation without a welcome-post prerequisite", () => {
  it("quotes both plans for a draft with no posts or profile content", async () => {
    const result = await activationOptions.run(request() as never);
    expect(result.plans).toHaveLength(2);
    expect(result.currency).toBe("aud");
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("creates checkout with zero posts after accepting the billing terms", async () => {
    const result = await createActivationCheckout.run(request() as never);
    expect(result.url).toBe("https://checkout.stripe.com/c/pay/test");
    expect(mocks.acknowledgementWrite).toHaveBeenCalledWith(expect.objectContaining({ ownerUid: "host-a", plan: "monthly" }));
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ client_reference_id: "prop-1", mode: "subscription" }), expect.any(Object));
    expect(mocks.property.lifecycle).toBe("draft");
  });

  it("still refuses another host's property in both endpoints", async () => {
    mocks.property.ownerUid = "host-b";
    for (const endpoint of [activationOptions, createActivationCheckout]) {
      await expect(endpoint.run(request() as never)).rejects.toMatchObject({ code: "not-found" });
    }
    expect(mocks.price).not.toHaveBeenCalled();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("still requires billing consent before opening checkout", async () => {
    const input = request();
    input.data.acknowledged = false;
    await expect(createActivationCheckout.run(input as never)).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("still refuses an already activated property", async () => {
    mocks.property.lifecycle = "active";
    for (const endpoint of [activationOptions, createActivationCheckout]) {
      await expect(endpoint.run(request() as never)).rejects.toMatchObject({ code: "failed-precondition", message: "This property is already activated." });
    }
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------------------
   The trial end a Host is quoted, and the one Stripe renders.

   Checkout floors the trial to whole days remaining and does it when the page
   loads, so an end exactly 28 days from the quote reads as "27 days free"
   beside our own "28-day free trial". These pin the anchor that stops that.  */

describe("the quoted trial end", () => {
  const day = 86_400;
  const at = (iso: string) => vi.setSystemTime(new Date(iso));

  beforeEach(() => {
    mocks.trialConsumed = false;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const quotedTrialEnd = async () => {
    const result = await activationOptions.run(request() as never);
    return result.trialEndsAt as number;
  };

  it("lands on midday UTC, before and after the rollover", async () => {
    at("2026-09-09T06:30:00.000Z");
    expect(new Date((await quotedTrialEnd()) * 1000).toISOString()).toBe("2026-10-07T12:00:00.000Z");

    at("2026-09-09T18:30:00.000Z");
    expect(new Date((await quotedTrialEnd()) * 1000).toISOString()).toBe("2026-10-08T12:00:00.000Z");
  });

  it("never quotes less than the 28 days the copy promises", async () => {
    for (const hour of [0, 6, 11, 12, 13, 18, 23]) {
      at(`2026-09-09T${String(hour).padStart(2, "0")}:59:59.000Z`);
      const remaining = (await quotedTrialEnd()) - Math.floor(Date.now() / 1000);
      expect(remaining).toBeGreaterThanOrEqual(billingPolicy.trialDays * day);
      expect(remaining).toBeLessThan((billingPolicy.trialDays + 1) * day);
    }
  });

  it("still floors to 28 days at Checkout after the Host reads the terms", async () => {
    at("2026-09-09T06:00:00.000Z");
    const trialEndsAt = await quotedTrialEnd();

    // The gap between the quote and the payment page is what used to cost the
    // twenty-eighth day: whole minutes of reading, then a redirect.
    at("2026-09-09T06:22:41.000Z");
    await createActivationCheckout.run({ ...request(), data: { ...request().data, trialEndsAt } } as never);

    const [session] = mocks.checkout.mock.calls[0];
    expect(session.subscription_data.trial_end).toBe(trialEndsAt);
    expect(Math.floor((session.subscription_data.trial_end - Math.floor(Date.now() / 1000)) / day))
      .toBe(billingPolicy.trialDays);
  });

  it("still refuses a quote whose date has moved on", async () => {
    at("2026-09-09T06:00:00.000Z");
    const stale = await quotedTrialEnd();

    at("2026-09-09T13:00:00.000Z");
    await expect(
      createActivationCheckout.run({ ...request(), data: { ...request().data, trialEndsAt: stale } } as never)
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------------------
   Promotion codes.

   BOP §4.1 requires a 100% code to activate a property without a real payment.
   Resolving it here rather than on Stripe's page is what lets the §6.3.4
   disclosure and the checkbox be written around what the card is charged —
   and Stripe refuses `discounts` and `allow_promotion_codes` together, so the
   two are alternatives rather than an addition.                             */

describe("a promotion code applied before Stripe", () => {
  const promotion = (over: Record<string, unknown> = {}) => ({
    id: "promo_test",
    code: "LAUNCH100",
    expires_at: null,
    restrictions: { minimum_amount: null, minimum_amount_currency: null, first_time_transaction: false },
    promotion: {
      type: "coupon",
      coupon: {
        valid: true,
        percent_off: 100,
        amount_off: null,
        currency: null,
        duration: "forever",
        duration_in_months: null,
        redeem_by: null,
        applies_to: null,
        ...(over.coupon as object ?? {})
      }
    },
    ...over
  });

  const withCode = (code = "LAUNCH100") => ({
    ...request(),
    data: { ...request().data, promotionCode: code }
  });

  beforeEach(() => {
    mocks.trialConsumed = false;
    mocks.promotionList.mockResolvedValue({ data: [promotion()] });
  });

  it("re-quotes every sentence around the discounted charge", async () => {
    const result = await activationOptions.run(withCode() as never);
    const monthly = result.plans.find(p => p.plan === "monthly")!;

    expect(monthly.price).toBe("A$15.00");         // the published rate is unchanged
    expect(monthly.chargedPrice).toBe("A$0.00");   // what the card is charged is not
    expect(monthly.chargedAmount).toBe(0);
    expect(monthly.discount).toEqual({ code: "LAUNCH100", label: "100% off" });
    expect(monthly.acknowledgement).toContain("I understand I will be billed A$0.00");
    expect(monthly.disclosure).toContain("your code LAUNCH100 applies 100% off");
    // The lookup is by code, not by id, and only active codes count.
    expect(mocks.promotionList).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LAUNCH100", active: true })
    );
  });

  it("gives Stripe the code instead of its own promotion field", async () => {
    const quoted = await activationOptions.run(withCode() as never);
    const monthly = quoted.plans.find(p => p.plan === "monthly")!;

    await createActivationCheckout.run({
      ...withCode(),
      data: { ...withCode().data, trialEndsAt: quoted.trialEndsAt, chargedAmount: monthly.chargedAmount }
    } as never);

    const [session] = mocks.checkout.mock.calls[0];
    expect(session.discounts).toEqual([{ promotion_code: "promo_test" }]);
    // Stripe rejects a Session carrying both.
    expect(session.allow_promotion_codes).toBeUndefined();
    expect(mocks.acknowledgementWrite).toHaveBeenCalledWith(
      expect.objectContaining({ promotionCode: "LAUNCH100", promotionCodeId: "promo_test", chargedAmount: 0 })
    );
  });

  it("keeps Stripe's own field for a Host who typed nothing", async () => {
    const quoted = await activationOptions.run(request() as never);
    await createActivationCheckout.run({
      ...request(),
      data: { ...request().data, trialEndsAt: quoted.trialEndsAt }
    } as never);
    const [session] = mocks.checkout.mock.calls[0];
    expect(session.allow_promotion_codes).toBe(true);
    expect(session.discounts).toBeUndefined();
    expect(mocks.promotionList).not.toHaveBeenCalled();
  });

  it("refuses a code Stripe does not know, before anything is quoted", async () => {
    mocks.promotionList.mockResolvedValue({ data: [] });
    await expect(activationOptions.run(withCode("NOPE") as never)).rejects.toMatchObject({
      code: "failed-precondition",
      message: "That promotion code is not valid for this purchase. Check the code and try again."
    });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("refuses a code that reaches neither plan", async () => {
    // A minimum above both plans: nothing we sell is discounted by it, and
    // quoting full price under a "code applied" banner would be a lie.
    mocks.promotionList.mockResolvedValue({
      data: [promotion({
        restrictions: { minimum_amount: 90_000, minimum_amount_currency: "aud", first_time_transaction: false }
      })]
    });
    await expect(activationOptions.run(withCode() as never)).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("quotes only the plans a minimum actually reaches", async () => {
    mocks.promotionList.mockResolvedValue({
      data: [promotion({
        restrictions: { minimum_amount: 10_000, minimum_amount_currency: "aud", first_time_transaction: false }
      })]
    });
    const result = await activationOptions.run(withCode() as never);
    expect(result.plans.find(p => p.plan === "monthly")!.discount).toBeNull();
    expect(result.plans.find(p => p.plan === "annual")!.discount).toEqual({
      code: "LAUNCH100",
      label: "100% off"
    });
  });

  it("refuses a fixed-amount coupon in another currency", async () => {
    mocks.promotionList.mockResolvedValue({
      data: [promotion({ coupon: { percent_off: null, amount_off: 500, currency: "usd" } })]
    });
    await expect(activationOptions.run(withCode() as never)).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("refuses to charge an amount the Host did not acknowledge", async () => {
    const quoted = await activationOptions.run(withCode() as never);
    // The coupon is halved between reading the terms and clicking the button.
    mocks.promotionList.mockResolvedValue({ data: [promotion({ coupon: { percent_off: 50 } })] });

    await expect(createActivationCheckout.run({
      ...withCode(),
      data: { ...withCode().data, trialEndsAt: quoted.trialEndsAt, chargedAmount: 0 }
    } as never)).rejects.toMatchObject({
      code: "failed-precondition",
      message: "That discount has changed. Reload the page and try again."
    });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------------------
   The catalogue is remembered for reads and confirmed for commitments.      */

describe("the price catalogue between calls", () => {
  it("asks Stripe once per price while a host reads the screen", async () => {
    await activationOptions.run(request() as never);
    expect(mocks.price).toHaveBeenCalledTimes(2);
    const again = await activationOptions.run(request() as never);
    // Same two plans, same two figures, no second pair of round trips.
    expect(mocks.price).toHaveBeenCalledTimes(2);
    expect(again.plans).toHaveLength(2);
    expect(again.plans[0].chargedAmount).toBe(1500);
  });

  it("confirms the catalogue live before a card is charged", async () => {
    await activationOptions.run(request() as never);
    expect(mocks.price).toHaveBeenCalledTimes(2);
    await createActivationCheckout.run(request() as never);
    // The commitment does not read the remembered quote.
    expect(mocks.price).toHaveBeenCalledTimes(3);
  });

  it("still refuses a purchase when the catalogue has drifted since the quote", async () => {
    await activationOptions.run(request() as never);
    mocks.price.mockImplementation(async () => ({ currency: "aud", unit_amount: 1700, product: "prod_test" }));
    // The quote a host is holding came from memory; the charge does not.
    await expect(createActivationCheckout.run(request() as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
});
