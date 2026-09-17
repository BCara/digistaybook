import {
  canDownloadQrKit,
  generatePropertySlug,
  isPubliclyReadable,
  lifecycleLabels,
  lifecycleSummaries,
  propertyIdentityLimits,
  slugPattern,
  slugifyPropertyName,
  validatePropertyName,
  type PropertySummary
} from "./property";

const property: PropertySummary = { id: "p1", ownerUid: "u1", name: "Cottage", slug: "cottage", lifecycle: "active", mode: "live", foundationalPostCount: 1 };

describe("property exposure", () => {
  it("preserves cancelled access only before its verified deadline", () => {
    const now = Date.parse("2026-09-07T00:00:00Z");
    const cancelled = { ...property, lifecycle: "cancelled_pending_end" as const };
    expect(isPubliclyReadable(cancelled, now)).toBe(false);
    expect(isPubliclyReadable({ ...cancelled, serviceEndsAt: "invalid" }, now)).toBe(false);
    expect(isPubliclyReadable({ ...cancelled, serviceEndsAt: "2026-09-07T00:00:00Z" }, now)).toBe(false);
    expect(canDownloadQrKit({ ...cancelled, serviceEndsAt: "2026-09-08T00:00:00Z" }, now)).toBe(true);
  });
  it("allows active live walls", () => expect(isPubliclyReadable(property)).toBe(true));
  it("keeps sandbox properties private", () => expect(isPubliclyReadable({ ...property, mode: "sandbox" })).toBe(false));
  it("locks QR kits when suspended", () => expect(canDownloadQrKit({ ...property, lifecycle: "suspended" })).toBe(false));
});

describe("property identity", () => {
  it("derives a URL-safe slug from a property name", () => {
    expect(slugifyPropertyName("Seabreeze Cottage")).toBe("seabreeze-cottage");
    expect(slugifyPropertyName("  The Old Bakery (No. 4) ")).toBe("the-old-bakery-no-4");
    expect(slugifyPropertyName("Café du Port")).toBe("cafe-du-port");
  });

  it("never leaves a trailing hyphen when the name is truncated", () => {
    const slug = slugifyPropertyName("A".repeat(38) + " tail");
    expect(slug.length).toBeLessThanOrEqual(propertyIdentityLimits.slugMax);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("builds a wall address from the name plus a suffix that makes it unique", () => {
    const slug = generatePropertySlug("Seabreeze Cottage", { suffix: () => "7k3p" });
    expect(slug).toBe("seabreeze-cottage-7k3p");
    expect(slugPattern.test(slug)).toBe(true);
  });

  it("never generates the same address twice for one host", () => {
    const suffixes = ["7k3p", "7k3p", "9m2t"];
    let call = 0;
    const slug = generatePropertySlug("Seabreeze Cottage", {
      takenSlugs: ["seabreeze-cottage-7k3p"],
      suffix: () => suffixes[call++]
    });
    expect(slug).toBe("seabreeze-cottage-9m2t");
  });

  it("keeps a generated address inside the length limit even for a long name", () => {
    const slug = generatePropertySlug("The Extremely Long Named Seaside Cottage By The Harbour Wall");
    expect(slug.length).toBeLessThanOrEqual(propertyIdentityLimits.slugMax);
    expect(slugPattern.test(slug)).toBe(true);
  });

  it("still produces a usable address when the name slugs to nothing", () => {
    const slug = generatePropertySlug("!!!", { suffix: () => "7k3p" });
    expect(slug).toBe("property-7k3p");
  });

  it("generates addresses that differ from one another", () => {
    const slugs = new Set(Array.from({ length: 50 }, () => generatePropertySlug("Seabreeze Cottage")));
    expect(slugs.size).toBeGreaterThan(45);
  });

  it("accepts a well-formed property name", () => {
    expect(validatePropertyName("Seabreeze Cottage")).toEqual([]);
  });

  it("refuses a name too short or too long to be shown to a guest", () => {
    expect(validatePropertyName("A")).toEqual([{ field: "name", message: expect.stringContaining("at least 2") }]);
    expect(validatePropertyName("A".repeat(61))).toEqual([
      { field: "name", message: expect.stringContaining("limited to 60") }
    ]);
  });

  it("describes every lifecycle state a host can be shown", () => {
    const states = Object.keys(lifecycleLabels) as Array<keyof typeof lifecycleLabels>;
    expect(states.every((state) => lifecycleSummaries[state]?.length > 0)).toBe(true);
  });
});
