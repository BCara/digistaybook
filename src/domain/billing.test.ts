import { transitionBillingState } from "./billing";

describe("transitionBillingState", () => {
  it("moves a failed active subscription into grace", () => expect(transitionBillingState("active", "payment_failed")).toBe("grace_period"));
  it("suspends after grace expires", () => expect(transitionBillingState("grace_period", "grace_expired")).toBe("suspended"));
  it("moves ended cancellations into dormancy", () => expect(transitionBillingState("cancelled_pending_end", "period_ended")).toBe("dormant"));
  it("rejects impossible transitions", () => expect(() => transitionBillingState("deleted", "invoice_paid")).toThrow(/Invalid billing transition/));
});
