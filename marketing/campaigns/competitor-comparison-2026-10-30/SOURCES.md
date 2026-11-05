# Sources: competitor comparison blog post

Re-checked **November 1, 2026** (Sydney date) for the revised draft, by reading each company's own public website with an automated
page fetch (text extraction, not a visual screenshot). First checked October 30, 2026; the earlier record is in
`_archive/2026-11-01-before-comparison-revision/SOURCES.md`. No accounts were created, no trials started, no one contacted.
Prices were seen on some pages and are deliberately **not** recorded (no-currency rule). Re-open each page before publishing.

## Touch Stay

| Claim in the post | URL | What was seen (November 1) |
|---|---|---|
| "mobile-first, with no app required" | https://touchstay.com/ | "mobile-first, with no app required." |
| Shared by direct link, QR code or automated messages via a PMS | https://touchstay.com/ | "a direct link, QR code, or automated guest messaging through your PMS integration." |
| Auto-translation in 30+ languages | https://touchstay.com/ | "Auto-translated in 30+ languages" (listed on the Free plan). |
| 40+ integrations | https://touchstay.com/ | "40+ integrations" with property management systems, channel managers and hospitality tools. |
| Free plan, 20 guest views per guidebook per month | https://touchstay.com/ | "20 guest views / guidebook / month"; "Limits reset monthly per guidebook." |
| 14-day free trial | https://touchstay.com/ | "14-day free trial." |
| Built-in upsell store | https://touchstay.com/ | "Built-in upsell store" (Free plan carries a store commission). |
| Private guest feedback | https://touchstay.com/ | "Capture private guest feedback" to learn what worked and what to improve. |
| Guest photos/notes "not mentioned on its site" | https://touchstay.com/ | Guestbook or guest-uploaded content not mentioned. |
| Wi-Fi join code "not mentioned on its site" | https://touchstay.com/ | Not mentioned. |

Seen but deliberately not used: the page says guests' emails, phone numbers and preferences can be collected when they open the
guidebook. Left out to avoid a negative comparison; the post says only what DigiStayBook doesn't ask guests for. Homepage headline
is about reducing questions; not quoted (our "never promise fewer messages" guardrail). Pricing model not stated in the post.

## Hostfully Digital Guidebooks

| Claim in the post | URL | What was seen (November 1) |
|---|---|---|
| First guidebook free, "no credit cards" | https://www.hostfully.com/digital-guidebooks/ | "your first Hostfully Digital Guidebook is free"; "No credit cards. No strings attached."; FAQ "a single guidebook for free". |
| Auto-translation in 16+ languages | same | "instant, multi-lingual auto-translation (16+ languages!)" |
| Pulls recommendations and maps from Google | same | "Automatically pull in recommendations and maps from Google" |
| Shared as a private link or PDF | same | FAQ: "provide a simple private link to your guest or send a downloadable PDF version." |
| QR code, "according to Hostfully's help center" | https://help.hostfully.com/en/articles/2108793-share-your-hostfully-guidebook-with-guests | "This option allows you to download the QR code and share the guidebook with your guests." (The marketing page doesn't mention QR.) |
| Guidebook Marketplace for paid extras | https://www.hostfully.com/digital-guidebooks/ | Add-ons such as early check-ins and late checkouts; "The only additional fee is if you decide to use our Guidebook Marketplace." |
| Integrates with Hostfully's PMS | same | "Digital Guidebooks integrate with Hostfully's Property Management Software (PMS)" |
| Guest content and private feedback "not mentioned on its site" | same | Neither mentioned. |

Not verified: whether guests need an app. Neither the marketing page nor the help article says; the table says "app not mentioned".

## StayPage

| Claim in the post | URL | What was seen (November 1) |
|---|---|---|
| "a guest journal for your vacation home" | https://staypage.co | "A guest journal for your vacation home." |
| Guests leave stories, photos and local finds via QR | same | Guests "scan a QR code to leave stories, photos, and local finds." |
| "with no app, account, or password" | same | FAQ: from their phone browser "with no app, account, or password." |
| Publish instantly or hold for approval; hide any page | same | "Publish pages instantly or hold each one for approval, one home at a time."; "Hide a page whenever you need to." |
| Not a guidebook | same | FAQ: "No. A guidebook tells guests what to do." |
| "Homeowner-only private pages" | same | Listed as a Host plan feature, not described further. |
| Free Starter plan; 14-day trial of Host plan | same | Starter free (one home, no card); Host plan "14-day free trial"; Enterprise plan also listed. |

Not verified: content screening (only "Per-home branding and moderation" is listed, without detail), translation, Wi-Fi code.

## Paper binder and guestbook

No external source. The section describes general, self-evident properties (reprinting, filling up, getting lost). Reword if any of
it reads as a factual claim about a product.

## DigiStayBook (product truth, checked in `src/` on November 1, 2026)

| Claim | Where checked |
|---|---|
| One price per property, everything included; 28-day free trial on first property | `src/domain/pricing.ts` (`trialDays = 28`, `trialCallout`, `includedFeatures`); `src/seo.ts` /pricing description |
| Opens in the browser, no app, no guest account | `src/ui/pages/LandingPage.tsx`; guest posting in `src/ui/guest/GuestContribution.tsx` has no sign-in |
| Guest name optional; no email or phone asked | `GuestContribution.tsx`: fields are message, "Guest name (optional)", photos, consent, private feedback |
| House guidance pinned at the top, local favorites | `pricing.ts` "Pinned host posts and house guidance"; `src/seo.ts` /stay/demo-cottage description |
| Automated screening; borderline waits for host; host can remove | `LandingPage.tsx` ("Anything borderline waits for you"); `pricing.ts` "Automated content screening plus host approval", "Dashboard moderation, pinning and deletion" |
| Private feedback, never published | `GuestContribution.tsx` "Private feedback for your host"; `src/ui/pages/HostModerationPage.tsx` private feedback tab; `pricing.ts` "Private guest feedback inbox" |
| Optional Wi-Fi join code on the QR placard | `src/ui/pages/HostQrPage.tsx` (Wi-Fi line read as network / password and passed to the sign maker); `src/ui/signs/QrSign.tsx`; `src/seo.ts` /qr-sign-maker "with a Wi-Fi code guests scan to connect" |
| Wall copies the Wi-Fi password in a tap | `src/ui/wall/WallHeader.tsx` (clipboard copy of the password) |
| Public page without house details, share or embed | `src/ui/pages/GuestWallPage.tsx` (`/embed/wall/{slug}`); `src/seo.ts` /wall/demo-cottage description |
| Free QR welcome sign maker, no account | `src/seo.ts` /qr-sign-maker |
| No translation | `src/domain/featureFlags.ts` `clientAutoTranslation: false`; MARKETING_NOTES "Translation: not built" |
| No PMS integration, no upsell store | Search of `src/` found no PMS or store code |

Note: the QR placard code is being reworked by another session (uncommitted changes to `HostQrPage.tsx`, `QrSignMakerPage.tsx`,
`QrPlacard.tsx` deleted, new `src/ui/signs/signPrefill.ts`). The Wi-Fi code still reaches the sign in that working copy. Re-check
before publishing.
