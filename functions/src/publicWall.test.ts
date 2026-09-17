import { describe, expect, it } from "vitest";
import { publicProperty, wallIsOpen, unavailableWall, ownsProperty, wallPreviewable, resolveWallView, stayTokenMatches } from "./publicWall";

describe("wall content projection", () => {
  it("turns off the public wall without disabling the in-stay wall", () => {
    const property = { mode: "live", lifecycle: "active", profile: { displayWallOff: true } };
    expect(wallIsOpen(property, Date.now(), "public")).toBe(false);
    expect(wallIsOpen(property, Date.now(), "stay")).toBe(true);
    expect(wallIsOpen({ ...property, lifecycle: "suspended" }, Date.now(), "stay")).toBe(false);
  });
  const data = { name: "Cottage", profile: {
    stayHeading: "Arrival", stayWelcome: "Welcome inside",
    facts: [{ term: "Wi-Fi", detail: "Guest network", note: "" }]
  } };

  it("omits house guidance from the public response, including the default view", () => {
    expect(publicProperty(data).houseInformation).toBeNull();
    expect(publicProperty(data, "public").houseInformation).toBeNull();
  });

  it("serves house guidance on the in-stay wall without a second opt-in", () => {
    const served = publicProperty(data, "stay").houseInformation;
    expect(served?.heading).toBe("Arrival");
    expect(served?.facts).toEqual([{ term: "Wi-Fi", detail: "Guest network", note: "" }]);
  });

  it("keeps the host's house-information visibility controls", () => {
    expect(publicProperty({ ...data, profile: { ...data.profile, stayNoteOff: true, factsOff: true } }, "stay").houseInformation).toEqual({ heading: "", welcome: "", tip: "", facts: [] });
  });
});

describe("unavailable wall ownership", () => {
  const property = { ownerUid: "owner", lifecycle: "draft", mode: "sandbox", profile: { displayWallOff: true }, billing: { private: "secret" } };
  it.each([undefined, "other"])("does not reveal details to %s", uid => {
    expect(unavailableWall(property, "p-1", uid)).toEqual({ status: "unavailable" });
  });
  it("returns only the owner's recovery fields", () => {
    expect(unavailableWall(property, "p-1", "owner")).toEqual({ status: "unavailable", owner: { propertyId: "p-1", lifecycle: "draft", mode: "sandbox", publicWallOff: true } });
    expect(unavailableWall(undefined, "p-1", "owner")).toEqual({ status: "unavailable" });
  });
});

describe("owner preview of a closed wall", () => {
  const draft = { ownerUid: "owner", lifecycle: "draft", mode: "sandbox", profile: {} };
  it("recognises only the owning account", () => {
    expect(ownsProperty(draft, "owner")).toBe(true);
    expect(ownsProperty(draft, "other")).toBe(false);
    expect(ownsProperty(draft, undefined)).toBe(false);
    expect(ownsProperty(undefined, "owner")).toBe(false);
  });
  it("previews a closed wall for its owner and for nobody else", () => {
    expect(wallPreviewable(draft, "owner")).toBe(true);
    expect(wallPreviewable(draft, "other")).toBe(false);
    expect(wallPreviewable(draft, undefined)).toBe(false);
  });
  it.each(["deleted", "deletion_scheduled"])("refuses to preview a property being removed: %s", lifecycle => {
    expect(wallPreviewable({ ...draft, lifecycle }, "owner")).toBe(false);
  });
});

/* The slug is public: it is in the Host's listing and embedded on their own
   site. The token is what separates the wall that answers with the Wi-Fi
   password from the wall anyone may read. */
describe("the stay token", () => {
  const token = "Kx7tQ2mN4pR8sV1wY3zB5c";
  const property = { ownerUid: "host-a", stayToken: token };

  it("recognises the property's own token and nothing else", () => {
    expect(stayTokenMatches(property, token)).toBe(true);
    expect(stayTokenMatches(property, "Kx7tQ2mN4pR8sV1wY3zB5d")).toBe(false);
    expect(stayTokenMatches(property, "")).toBe(false);
    expect(stayTokenMatches(property, undefined)).toBe(false);
    // A prefix of the right token is not the right token: the comparison is
    // over fixed-length values, not over however much a caller sent.
    expect(stayTokenMatches(property, token.slice(0, 10))).toBe(false);
  });

  it("refuses every caller when the property carries no token", () => {
    expect(stayTokenMatches({ ownerUid: "host-a" }, token)).toBe(false);
    expect(stayTokenMatches({ ownerUid: "host-a", stayToken: "short" }, "short")).toBe(false);
    expect(stayTokenMatches(undefined, token)).toBe(false);
  });

  it("hands a caller without the token the public wall rather than an error", () => {
    expect(resolveWallView(property, "stay", token)).toBe("stay");
    expect(resolveWallView(property, "stay", "Kx7tQ2mN4pR8sV1wY3zB5d")).toBe("public");
    expect(resolveWallView(property, "stay", undefined)).toBe("public");
    // Asking for the public wall is never turned into the in-stay one.
    expect(resolveWallView(property, "public", token)).toBe("public");
  });

  it("lets the owning account read its own in-stay wall without the token", () => {
    expect(resolveWallView(property, "stay", undefined, "host-a")).toBe("stay");
    expect(resolveWallView(property, "stay", undefined, "host-b")).toBe("public");
  });

  it("keeps the token out of everything served to a caller", () => {
    const served = publicProperty({ ...property, name: "Cottage", profile: {} }, "stay");
    expect(JSON.stringify(served)).not.toContain(token);
  });
});
