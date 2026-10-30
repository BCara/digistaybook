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
    expect(billingCountryFrom(["en-US"], "Europe/Stockholm")).toBe("US");
  });

  it("prefers the most-preferred language that names a country", () => {
    expect(billingCountryFrom(["en", "en-AU"], undefined)).toBe("AU");
    expect(billingCountryFrom(["en-AU", "en-US"], undefined)).toBe("AU");
    expect(billingCountryFrom(["sv-SE", "en-AU"], undefined)).toBe("SE");
  });

  it("falls back to the language when the clock names no country it knows", () => {
    expect(billingCountryFrom(["en-AU"], "America/Sao_Paulo")).toBe("AU");
    expect(billingCountryFrom(["en"], "Australia/Brisbane")).toBe("AU");
  });

  it("does not read the rest of the Americas as the United States", () => {
    expect(billingCountryFrom([], "America/Toronto")).toBe("CA");
    expect(billingCountryFrom([], "America/Sao_Paulo")).toBeNull();
    expect(billingCountryFrom([], "America/Mexico_City")).toBeNull();
  });

  it("reads New Zealand and Canada from the clock", () => {
    expect(billingCountryFrom(["en-US"], "Pacific/Auckland")).toBe("NZ");
    expect(billingCountryFrom(["en-US"], "America/Vancouver")).toBe("CA");
  });

  it("reads the UK and the euro area from the clock", () => {
    expect(billingCountryFrom(["en-US"], "Europe/London")).toBe("GB");
    expect(billingCountryFrom([], "Europe/Berlin")).toBe("DE");
    expect(billingCountryFrom([], "Europe/Dublin")).toBe("IE");
    expect(billingCountryFrom([], "Atlantic/Canary")).toBe("ES");
  });

  // Europe is not the euro area: these are asked, or placed by their language.
  it("does not read the rest of Europe from the clock", () => {
    expect(billingCountryFrom([], "Europe/Stockholm")).toBeNull();
    expect(billingCountryFrom([], "Europe/Zurich")).toBeNull();
    expect(billingCountryFrom([], "Europe/Jersey")).toBeNull();
  });

  it("guesses nothing when neither the clock nor the language names a country", () => {
    expect(billingCountryFrom(["ja"], "Asia/Tokyo")).toBeNull();
    expect(billingCountryFrom([], undefined)).toBeNull();
  });
});
