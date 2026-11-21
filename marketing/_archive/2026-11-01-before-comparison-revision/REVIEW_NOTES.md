# Review notes: competitor comparison blog post

For Cara and Joe. Draft only; nothing published, posted or sent. October 30, 2026.

## Competitors chosen, and why

- **Touch Stay**: the best-known dedicated digital guidebook; the default thing a host compares us with.
- **Hostfully Digital Guidebooks**: a widely used guidebook with a free first guidebook, tied to a major PMS.
- **StayPage**: the closest direct competitor to our guestbook side (QR card, guests leave photos and stories, host approval).
- **Paper binder and guestbook / doing nothing**: what most hosts actually use today ("doing nothing is the real competitor").
- **Enso Connect**: only a short mention under "who each option suits best", for larger operators; it's a different category.
- Left out: YourWelcome (tablet-based, not checked), Breezeway (operations-first), Chekin, Duve, Smoobu guides, MyTOM Guestbook, HostBook.
  Not researched, so nothing is claimed about them.

## Open questions for the owners

1. **Naming StayPage.** It's the closest like-for-like rival but probably small; naming it gives it exposure. Keep, or drop to a
   generic "guest journal apps" paragraph?
2. **Blog route.** The app has no `/blog` route in `src/seo.ts` `indexedPaths`. Where will this live, and does the slug need a
   sitemap/prerender entry and a Firebase redirect?
3. **Length.** The post body counts about 2,100 words including the table, so roughly 1,800 words of prose, at the top of the brief's range. Trim the
   Enso paragraph or the paper section if you want it shorter.
4. **Booking-platform mention.** The post says "booking platforms are changing what hosts may ask of guests" without naming Airbnb or
   interpreting the policy. Want a link to Airbnb's own announcement instead? (MARKETING_NOTES: link to Airbnb's page, never interpret.)
5. **Trademark footer and "not affiliated" line.** Fine as is, or would you like legal review before publishing?
6. **Tax line.** Not included, to keep the post on comparison. Add reason 5 with the full small print if wanted.

## Risky claims to double-check before publishing

- **Touch Stay free plan limit (20 guest views per guidebook per month)** and **14-day trial**: plans change often; re-check on the day.
- **Touch Stay pricing model**: homepage and FAQ disagree (per property vs. per guidebook/features). The post avoids stating it.
- **Hostfully "no app"**: not confirmed directly, so the post doesn't claim it. QR comes from the help centre, not the marketing page.
- **Hostfully private feedback / guest content**: "not listed on the pages we checked" is accurate to what was fetched, but Hostfully has
  many pages; a reviewer could check its feature overview (https://www.hostfully.com/guidebooks-feature-overview/) before publishing.
- **StayPage "Homeowner-only private pages"**: meaning unclear; the post quotes it without interpreting. Its table cell for private
  feedback could be read as a gap or a match; consider "unclear".
- **"No PMS integration" / "no upsell store" / "no translation" for DigiStayBook**: correct today per code and notes; update the post if
  any of these ship.
- **"DigiStayBook doesn't collect guests' contact details"**: taken from MARKETING_NOTES reason 11, not re-checked in code this session.
- **Extraction method**: competitor quotes came via an automated text fetch, not a visual check. Open each URL in a browser and confirm
  wording before publishing.
- **Site copy conflict spotted (not changed):** `src/ui/pages/LandingPage.tsx` capability text says "so the questions stop arriving",
  which conflicts with the "never promise fewer messages" guardrail. The landing page also says the wall can carry information "booking
  platforms may restrict in their messages", which sits close to the "never pitch as a way around the rules" guardrail. Worth a look.

## Guardrail check (done)

- US English; no currency or prices; "see pricing" links only.
- No promises of fewer messages, better reviews, revenue or repeat bookings. Private feedback described as "isn't a review and doesn't
  replace one".
- Screening described as reducing risk, not guaranteeing safe content.
- No "Stay with us again" / direct-booking feature mentioned (not live).
- No logos, no testimonials, no disparagement; each competitor gets a "where it's stronger" paragraph.
- The wall described as information, not rules or chores.

## Suggested internal links

- `/stay/demo-cottage`: "See what guests see" (already in the FAQ).
- `/wall/demo-cottage`: public page demo, from the "Share the memories" bullet.
- `/pricing`: from the table and the "How much does it cost?" FAQ.
- `/qr-sign-maker`: free sign maker, from the FAQ.
- `/privacy-safety` or `/privacy`: from the "no guest accounts" FAQ answer, if wanted.
- `/contact`: for larger portfolios ("custom options"), near the Enso paragraph.

## Files

- `BLOG_POST.md`: the draft.
- `SOURCES.md`: every competitor claim with URL, date checked and what was seen.
- This file.
