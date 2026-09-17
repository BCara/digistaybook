import type { BillingCountry } from "./billingStore";

/**
 * Where a Host is probably billed, so they are not asked.
 *
 * The country is not cosmetic: it is the §3a layer-1 gate and it picks the
 * currency every quoted price and every acknowledgement sentence is written
 * in. What changes here is only *who says it first* — this guess opens the
 * offer, and the Host can overrule it on the same screen before anything is
 * priced against it. The server still refuses a country it does not serve, and
 * `createActivationCheckout` still records the country actually submitted.
 *
 * A guess, never an answer: anything outside the two countries DigiStayBook
 * serves returns null, and the Host is asked in the old way. Guessing "AU"
 * for a Host in Berlin would show them a price in the wrong currency and ask
 * them to tick a box against it.
 */

/**
 * The clock first, then the browser's declared language regions.
 *
 * The order used to be the other way round, on the reasoning that a language
 * is a setting a person chose while a time zone can be a factory default. That
 * is true of the time zone and wrong about the language: `en-US` *is* the
 * factory default. Chrome ships it and Windows ships it, and neither changes
 * because a machine is switched on in Sydney — so reading the language first
 * told an Australian Host they were "Billed in United States" and quoted them
 * in the wrong dollar, which is the one thing this guess must not do.
 *
 * A time zone naming a served country is the stronger evidence precisely
 * because it is the signal nothing defaults *to*: `Australia/Sydney` is not a
 * value a laptop arrives with, whereas `en-US` is. Language still decides when
 * the clock names nothing we serve — a Host on `Etc/UTC` reading in `en-AU` —
 * so the case the old order existed for is kept, and a US Host reading in
 * `en-GB` is still found by the clock.
 */
export function detectBillingCountry(): BillingCountry | null {
  return billingCountryFrom(browserLocales(), resolvedTimeZone());
}

/**
 * The decision itself, with nothing read from the environment, so a test can
 * state a Host's browser rather than impersonate one. `undefined` here means
 * the browser offered no clock — not "ask the platform", which is why the two
 * halves are separate functions.
 */
export function billingCountryFrom(
  locales: readonly string[],
  timeZone: string | undefined
): BillingCountry | null {
  return countryForTimeZone(timeZone) ?? regionFromLocales(locales);
}

/** The most-preferred declared language that names a country we serve. */
function regionFromLocales(locales: readonly string[]): BillingCountry | null {
  for (const tag of locales) {
    const country = supported(regionOf(tag));
    if (country) return country;
  }
  return null;
}

function browserLocales(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages ?? (navigator.language ? [navigator.language] : []);
}

function resolvedTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** The region subtag of a BCP 47 tag: the two-letter part after the language. */
function regionOf(tag: string): string | null {
  const parts = tag.split(/[-_]/);
  for (const part of parts.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return null;
}

function supported(region: string | null): BillingCountry | null {
  return region === "AU" || region === "US" ? region : null;
}

/**
 * IANA zones are listed rather than matched on the `America/` prefix, which
 * would read Toronto, Mexico City and São Paulo as the United States.
 */
const US_ZONES = new Set([
  "America/Adak",
  "America/Anchorage",
  "America/Boise",
  "America/Chicago",
  "America/Denver",
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Indiana/Knox",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Tell_City",
  "America/Indiana/Vevay",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Juneau",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Los_Angeles",
  "America/Menominee",
  "America/Metlakatla",
  "America/New_York",
  "America/Nome",
  "America/North_Dakota/Beulah",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/Phoenix",
  "America/Sitka",
  "America/Yakutat",
  "Pacific/Honolulu"
]);

function countryForTimeZone(timeZone: string | undefined): BillingCountry | null {
  if (!timeZone) return null;
  if (timeZone.startsWith("Australia/")) return "AU";
  return US_ZONES.has(timeZone) ? "US" : null;
}
