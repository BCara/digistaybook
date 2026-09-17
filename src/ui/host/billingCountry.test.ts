import { describe, expect, it } from "vitest";
import { billingCountryFrom } from "./billingCountry";

describe("billingCountryFrom", () => {
  it("reads the clock, which is the signal nothing defaults to", () => {
    expect(billingCountryFrom([], "Australia/Brisbane")).toBe("AU");
    expect(billingCountryFrom(["en-GB"], "America/Los_Angeles")).toBe("US");
  });

  /* The bug this ordering exists for: Chrome and Windows both ship `en-US`
     and neither changes it for a machine switched on in Sydney, so an
     Australian Host was being told "Billed in United States" and quoted in
     the wrong dollar. The clock is not a default in the same way.          */
  it("does not read a browser's default en-US over an Australian clock", () => {
    expect(billingCountryFrom(["en-US", "en"], "Australia/Sydney")).toBe("AU");
    expect(billingCountryFrom(["en-US"], "Australia/Perth")).toBe("AU");
  });

  it("reads the region a Host's language declares when the clock says nothing", () => {
    expect(billingCountryFrom(["en-AU"], undefined)).toBe("AU");
    expect(billingCountryFrom(["en-US"], undefined)).toBe("US");
    expect(billingCountryFrom(["zh-Hant-US"], undefined)).toBe("US");
    expect(billingCountryFrom(["en_au"], undefined)).toBe("AU");
    expect(billingCountryFrom(["en-AU"], "Etc/UTC")).toBe("AU");
    expect(billingCountryFrom(["en-US"], "Europe/Berlin")).toBe("US");
  });

  it("prefers the most-preferred language that names a served country", () => {
    expect(billingCountryFrom(["fr-FR", "en-AU"], undefined)).toBe("AU");
    expect(billingCountryFrom(["en-AU", "en-US"], undefined)).toBe("AU");
  });

  it("falls back to the language when the clock carries no served country", () => {
    expect(billingCountryFrom(["en-AU"], "America/Toronto")).toBe("AU");
    expect(billingCountryFrom(["en"], "Australia/Brisbane")).toBe("AU");
  });

  it("does not read the rest of the Americas as the United States", () => {
    expect(billingCountryFrom([], "America/Toronto")).toBeNull();
    expect(billingCountryFrom([], "America/Sao_Paulo")).toBeNull();
    expect(billingCountryFrom([], "America/Mexico_City")).toBeNull();
  });

  it("guesses nothing for a Host outside the two served countries", () => {
    expect(billingCountryFrom(["de-DE"], "Europe/Berlin")).toBeNull();
    expect(billingCountryFrom([], undefined)).toBeNull();
  });
});
