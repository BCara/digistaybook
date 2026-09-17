import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelSubscription, resumeSubscription } from "./stripeCancellation";

const mocks = vi.hoisted(() => ({
  property: { ownerUid: "host-a", "billing.stripeSubscriptionId": "sub_1" } as Record<string, unknown>,
  subscription: {} as Record<string, unknown>,
  retrieve: vi.fn(),
  update: vi.fn(),
  actionWrite: vi.fn()
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: () => 123, fromMillis: (value: number) => value },
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        id: "prop-1",
        exists: true,
        get: async () => ({ id: "prop-1", exists: true, get: (key: string) => mocks.property[key] }),
        collection: (child: string) => {
          if (child !== "billingActions") throw new Error(`Unexpected subcollection: ${child}`);
          return { doc: () => ({ set: mocks.actionWrite }) };
        }
      })
    })
  })
}));

vi.mock("./stripeConfig.js", () => ({
  stripeSecrets: [],
  stripe: () => ({ subscriptions: { retrieve: mocks.retrieve, update: mocks.update } })
}));

/** 8 October 2026, the date every assertion below is about. */
const periodEnd = Math.floor(Date.UTC(2026, 9, 8) / 1000);

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_1",
  status: "trialing",
  currency: "aud",
  cancel_at_period_end: false,
  metadata: { propertyId: "prop-1" },
  items: { data: [{ current_period_end: periodEnd }] },
  ...overrides
});

const request = () => ({
  auth: { uid: "host-a", token: { firebase: { sign_in_provider: "password" } } },
  data: { propertyId: "prop-1" }
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.property = { ownerUid: "host-a", "billing.stripeSubscriptionId": "sub_1" };
  mocks.retrieve.mockResolvedValue(subscription());
  // Stripe answers an update with the whole subscription, so the mock echoes
  // the one under test rather than a fresh default — the currency and the
  // period end on the answer are what the confirmation is built from.
  mocks.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
    ...(await mocks.retrieve()),
    cancel_at_period_end: patch.cancel_at_period_end
  }));
  mocks.actionWrite.mockResolvedValue(undefined);
});

describe("cancelling a trial", () => {
  it("stops at the end of the period rather than deleting the subscription", async () => {
    const result = await cancelSubscription.run(request() as never);

    // BOP §4.3. `subscriptions.cancel` would end service the moment a Host
    // clicked, taking a live wall off a placard mid-stay.
    expect(mocks.update).toHaveBeenCalledWith("sub_1", expect.objectContaining({ cancel_at_period_end: true }));
    expect(result.serviceEndsAt).toBe(periodEnd);
    expect(result.serviceEndsOn).toBe("8 October 2026");
    expect(result.chargedAgain).toBe(false);
    expect(result.alreadySet).toBe(false);
  });

  it("never writes the lifecycle: that stays the webhook's to write", async () => {
    await cancelSubscription.run(request() as never);
    expect(mocks.property.lifecycle).toBeUndefined();
    expect(mocks.property.serviceEndsAt).toBeUndefined();
  });

  it("records what was done, against the subscription it was done to", async () => {
    await cancelSubscription.run(request() as never);
    expect(mocks.actionWrite).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUid: "host-a", action: "cancel", stripeSubscriptionId: "sub_1" })
    );
  });

  it("formats the date in the currency's own order", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ currency: "usd" }));
    const result = await cancelSubscription.run(request() as never);
    expect(result.serviceEndsOn).toBe("October 8, 2026");
  });

  it("answers a second click with the same date instead of an error", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ cancel_at_period_end: true }));
    const result = await cancelSubscription.run(request() as never);

    expect(result.alreadySet).toBe(true);
    expect(result.serviceEndsOn).toBe("8 October 2026");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("takes the earliest item end, so a stray second item cannot extend service", async () => {
    mocks.retrieve.mockResolvedValue(subscription({
      items: { data: [{ current_period_end: periodEnd + 86_400 }, { current_period_end: periodEnd }] }
    }));
    const result = await cancelSubscription.run(request() as never);
    expect(result.serviceEndsAt).toBe(periodEnd);
  });
});

describe("what cancelling refuses", () => {
  it("refuses another host's property", async () => {
    mocks.property.ownerUid = "host-b";
    await expect(cancelSubscription.run(request() as never)).rejects.toMatchObject({ code: "not-found" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses an anonymous session, which is a guest", async () => {
    const guest = {
      auth: { uid: "guest-1", token: { firebase: { sign_in_provider: "anonymous" } } },
      data: { propertyId: "prop-1" }
    };
    await expect(cancelSubscription.run(guest as never)).rejects.toMatchObject({ code: "permission-denied" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a property with no subscription behind it", async () => {
    mocks.property = { ownerUid: "host-a" };
    await expect(cancelSubscription.run(request() as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("refuses a subscription Stripe has already ended", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ status: "canceled" }));
    await expect(cancelSubscription.run(request() as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("changes nothing when Stripe refuses the write", async () => {
    mocks.update.mockRejectedValue(new Error("stripe is down"));
    await expect(cancelSubscription.run(request() as never)).rejects.toMatchObject({ code: "unavailable" });
    expect(mocks.actionWrite).not.toHaveBeenCalled();
  });
});

describe("undoing a cancellation", () => {
  it("clears the flag while the period is still running", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ cancel_at_period_end: true }));
    const result = await resumeSubscription.run(request() as never);

    expect(mocks.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false });
    expect(result.chargedAgain).toBe(true);
    expect(result.serviceEndsOn).toBe("8 October 2026");
    expect(mocks.actionWrite).toHaveBeenCalledWith(expect.objectContaining({ action: "resume" }));
  });

  it("refuses once the subscription has actually ended, because that is a new purchase", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ status: "canceled", cancel_at_period_end: true }));
    await expect(resumeSubscription.run(request() as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("is harmless on a subscription that was never cancelled", async () => {
    const result = await resumeSubscription.run(request() as never);
    expect(result.alreadySet).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
