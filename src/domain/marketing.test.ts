import { assertTransactionalContent, canSendMarketing, type MarketingConsent } from "./marketing";

const consent: MarketingConsent = { hostUid: "host-1", address: "host@example.com", status: "granted", timestamp: "2026-08-04T00:00:00.000Z", source: "signup", wordingVersion: "marketing-v1" };

describe("marketing delivery rules", () => {
  it("fails closed without consent", () => expect(canSendMarketing(null, "clear")).toBe(false));
  it("fails closed when suppression state is unavailable", () => expect(canSendMarketing(consent, "unavailable")).toBe(false));
  it("blocks promotional content in transactional templates", () => expect(() => assertTransactionalContent(true)).toThrow(/cannot contain promotional/));
});
