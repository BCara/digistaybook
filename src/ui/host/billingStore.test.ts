import { loadActivationOffer, redirectToCheckout, startActivationCheckout } from "./billingStore";

const callable = vi.fn();
const navigate = vi.fn();

vi.mock("../../lib/firebase", () => ({ getFirebaseServices: async () => ({ functions: {} }) }));
vi.mock("../routing", () => ({ navigate: (...args: unknown[]) => navigate(...args) }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_functions: unknown, name: string) => (data: unknown) => callable(name, data)
}));

function functionsError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code: `functions/${code}` });
}

const offer = {
  currency: "aud",
  trialAvailable: true,
  trialDays: 28,
  trialEndsAt: 1_760_000_000,
  version: "handbook-6.3.4-v1",
  plans: [
    {
      plan: "monthly",
      price: "A$15.00",
      chargedPrice: "A$15.00",
      chargedAmount: 1500,
      discount: null,
      disclosure: "…renew at A$15.00/month…",
      acknowledgement: "I understand I will be billed A$15.00 on 6 October 2026 if I do not cancel."
    }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadActivationOffer", () => {
  it("asks activationOptions for one property in one country and returns the quote", async () => {
    callable.mockResolvedValue({ data: offer });

    const result = await loadActivationOffer("prop-1", "AU");

    expect(callable).toHaveBeenCalledWith("activationOptions", { propertyId: "prop-1", country: "AU" });
    expect(result).toEqual({ status: "ok", value: offer });
  });

  it("passes a failed-precondition message straight through — the server wrote it for the Host", async () => {
    callable.mockRejectedValue(
      functionsError("failed-precondition", "This property is already activated.")
    );

    const result = await loadActivationOffer("prop-1", "AU");

    expect(result).toEqual({
      status: "error",
      message: "This property is already activated."
    });
  });

  it("does not leak an internal error message", async () => {
    callable.mockRejectedValue(functionsError("internal", "TypeError: cannot read properties of undefined"));

    const result = await loadActivationOffer("prop-1", "US");

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ message: "The server could not start activation. Nothing was charged." });
  });
});

describe("startActivationCheckout", () => {
  it("sends the acknowledgement fields and returns the hosted-checkout URL", async () => {
    callable.mockResolvedValue({ data: { url: "https://checkout.stripe.com/c/pay/cs_test_123" } });

    const result = await startActivationCheckout({
      propertyId: "prop-1",
      country: "AU",
      plan: "monthly",
      version: "handbook-6.3.4-v1",
      trialEndsAt: 1_760_000_000
    });

    expect(callable).toHaveBeenCalledWith("createActivationCheckout", {
      propertyId: "prop-1",
      country: "AU",
      plan: "monthly",
      acknowledged: true,
      version: "handbook-6.3.4-v1",
      trialEndsAt: 1_760_000_000
    });
    expect(result).toEqual({ status: "ok", value: { url: "https://checkout.stripe.com/c/pay/cs_test_123" } });
  });

  it("treats a missing URL as a failure rather than redirecting nowhere", async () => {
    callable.mockResolvedValue({ data: { url: null } });

    const result = await startActivationCheckout({
      propertyId: "prop-1",
      country: "AU",
      plan: "annual",
      version: "handbook-6.3.4-v1",
      trialEndsAt: null
    });

    expect(result.status).toBe("error");
  });

  it("surfaces a stale-quote precondition so the Host is told to reload", async () => {
    callable.mockRejectedValue(
      functionsError("failed-precondition", "The trial dates have moved on. Reload the page and try again.")
    );

    const result = await startActivationCheckout({
      propertyId: "prop-1",
      country: "AU",
      plan: "monthly",
      version: "handbook-6.3.4-v1",
      trialEndsAt: 1_760_000_000
    });

    expect(result).toEqual({
      status: "error",
      message: "The trial dates have moved on. Reload the page and try again."
    });
  });
});

describe("redirectToCheckout", () => {
  it("hands the browser to the given URL", () => {
    redirectToCheckout("https://checkout.stripe.com/c/pay/cs_test_123");
    expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_123");
  });
});
