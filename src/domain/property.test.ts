import { canDownloadQrKit, isPubliclyReadable, type PropertySummary } from "./property";

const property: PropertySummary = { id: "p1", ownerUid: "u1", name: "Cottage", slug: "cottage", lifecycle: "active", mode: "live", foundationalPostCount: 1 };

describe("property exposure", () => {
  it("allows active live walls", () => expect(isPubliclyReadable(property)).toBe(true));
  it("keeps sandbox properties private", () => expect(isPubliclyReadable({ ...property, mode: "sandbox" })).toBe(false));
  it("locks QR kits when suspended", () => expect(canDownloadQrKit({ ...property, lifecycle: "suspended" })).toBe(false));
});
