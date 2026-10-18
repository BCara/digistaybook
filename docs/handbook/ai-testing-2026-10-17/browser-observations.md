# AI browser observations — 17 October 2026 (Australia/Sydney)

Method: Codex in-app Chromium browser, desktop. Local app served from current source with an isolated emulator-port transform. No physical phone, paper print, live payment, inbox receipt or real-provider classification is claimed.

## Live public pages

- Home: identifies a digital guestbook for short-term rental hosts; 28-day first-property trial; sign-in/signup links. Read home and pricing copy: no guaranteed booking/rating/revenue outcomes. Booking-provider names are used to disclaim review integration.
- Pricing: AUD A$15/month and A$150/year per property; USD US$10/month and US$100/year. Switched AUD → USD → AUD. Shared features, first-property trial and dashboard cancellation shown. Exact tax sentence: “DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice.” Paid-period access wording present.
- Public demo: Seabreeze Cottage, DEMO label, eight memories. Followed “See what guests see” to the stay demo. Host welcome, essentials and notes precede memories. Public demo omits house essentials.
- Demo submission: entered synthetic text, ticked the demo checkbox and pressed Continue. Observed “Your message is validated locally. This is a demo wall, so nothing is sent to a host yet.”
- Demo footer: “Loved your stay? Powered by DigiStayBook — Create a digital guestbook for your property.” Link target is the home page. Footer link was inspected, not clicked; visual overlap and phone layout were not measured.
- Privacy & Safety: opened signed out; booking/property-support exclusion and host-through-booking-platform instructions shown. Request-type choices: Privacy request, Content takedown, Urgent safety concern; Details and Contact email. No live request submitted.
- Terms: opened signed out, draft-2026-08-04. Privacy: opened signed out, draft-2026-10-06.
- /operations redirected to /host/sign-in?returnTo=operations; no queue or private data displayed.
- Live create-account form: optional name, email, password, confirm password, Google button, “At least 8 characters.” Marketing checkbox and Terms/Privacy links beside Create account absent. No live account was created.

## Local host walkthrough

- Created a synthetic host in demo-digistaybook. Seven-character password rejected: “Choose a password of at least 8 characters.” Mismatched passwords rejected: “Both passwords need to match.” Valid creation led to Your host overview / No properties yet. Signed out and back in successfully.
- Created AI QA Cottage 2026-10-17 with synthetic arrival note, Wi-Fi guidance and a host note. Property ID VJm2cE5S2ias8JX0jKjx; slug ai-qa-cottage-2026-10-17-6c2g. Dashboard showed DRAFT / PRIVATE and a next action. No payment requested during creation.
- Design displayed saved text, host note, Wi-Fi and a phone preview. Exercised all four current themes: Warm Linen, Editorial, Playful and Journal; preview styling/colour choices changed and synthetic text remained. Returned to original Warm Linen. Checklist names Linen, Studio, Archive, Harbour, Sage; those legacy choices are not available.
- QR screen showed guest/public links, memory-approval control, public-wall switch, QR code and “Printing is locked / Printing unlocks with an active trial or subscription.”
- Publication/Billing page displayed “Payments are disabled in local Test. Use the seeded active property for this walkthrough.” No Stripe checkout, tax, payment, cancellation or webhook proof obtained.

## Local guest walkthrough

- Opened seeded Test Cottage through its stay link without a host-facing page or guest sign-in prompt. Name, hosts' note, Wi-Fi essentials, memories and writing prompt displayed.
- Memory form requires no name, email or phone. Name is optional. Before selecting files the only visible limit is “Up to 10 photos”. File formats, per-file/total size, megapixel and 1,200-character limits required by TP-GUEST-03-S01 are not all shown upfront: FAIL against that step.
- Current consent: “I agree to the Guest Terms and Privacy Policy, understand that photos undergo automated safety checks, consent to my message and any photos being displayed publicly on this property’s guestbook, and confirm I am 16 or older.” This differs from the older checklist quote; wording reconciliation needs review.
- Submitted without consent: refused with exact message “Please read and accept the consent before submitting.”
- First synthetic message contained an ISO-style date; it was held. Do not treat it as the clear control: the contact/phone rule can match a numeric date string.
- Submitted exact text control “A lovely stay; thank you” with consent, no photo. Observed “Your memory is now on the wall.” It appeared on the wall and in Your memories in this browser as Published. This is text-only browser proof; photo progress and complete stopwatch timing were not measured.
- Closed the guest tab and reopened the same local stay link. After history loaded, the same clear memory appeared as Published; earlier numeric-date fixture remained Pending safety screening or review. No browser errors were returned for the reopened page.

## Boundaries

Other-project emulators were already using the standard ports. QA used localhost ports 15182 (web), 14400 (hub), 19099 (Auth), 18080 (Firestore), 19199 (Storage), 15001 (Functions). No claim that this isolated localhost stack was reachable from a physical phone.

The broad backend verification helpers require the provider-unavailable adapter, whereas the browser walkthrough uses LOCAL_TEST_SCREENING markers. Initial mismatched-adapter attempts are retained as harness errors and excluded from product-pass totals. Consent pagination also requires a clean database; its first mixed-fixture attempt is excluded from product conclusions.
