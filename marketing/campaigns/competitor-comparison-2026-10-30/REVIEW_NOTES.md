# Review notes: competitor comparison blog post

For Cara and Joe. DRAFT only; nothing published, posted or sent. Revised November 1, 2026.

## The request

Joe in #digistaybook-improvements, October 29, 2026: AI tools seem to reference blog posts when recommending QR platforms, so each
of our sites needs "a dedicated blog detailing ourselves vs our competitors", with "the table of comparative things the customers
might be looking for", so we get referenced alongside them. No competitors were named in the request.

## What changed from the October 30 draft

The October 30 draft (about 2,100 words) is kept in `_archive/2026-11-01-before-comparison-revision/`. This revision:

- Is shorter: about 1,350 words of prose plus the comparison table (about 1,750 with the table), against a 900–1,400 word brief.
- Re-checks every competitor claim on November 1 (see `SOURCES.md`). Nothing material had changed. Hostfully's marketing page no
  longer mentions QR codes, so the post credits QR sharing to its help center.
- Heads the table "What hosts look for", per Joe's angle, and adds a "Joins the Wi-Fi from the sign" row (reason 9).
- Drops Enso Connect (a different category, and not re-checked), the house-rules note and two FAQs, to fit the length.
- Re-checks DigiStayBook claims in code; "no guest contact details" is now confirmed from the guest form (name optional, no email or
  phone), and the post says it as what we don't ask for.

## Decisions (owner, November 1, 2026)

1. **Naming StayPage:** keep it named.
2. **"Joins the Wi-Fi from the sign" row:** keep it.
3. **Trademark footer and "not affiliated" line:** no legal review needed.
4. **Where the blog lives:** in the app at `/blog` and `/blog/<slug>`. The post is in `src/ui/blog/posts.tsx` as a **draft**:
   it shows only in a local dev build, and stays out of the production build, the sitemap and search until its `status`
   is changed to `"published"` (then build and deploy). Any wording change approved here must be copied into that file too.

## Still open

- **Tax line (reason 5).** Not included. The approved line is "Could be a 100% business expense", always with the small print
  "DigiStayBook could be tax deductible as a business expense for your rental. Eligibility depends on your circumstances; check
  with your tax adviser." If wanted, it would go in the "Where DigiStayBook fits" pricing bullet.

## Claims to double-check on the day

- Touch Stay free plan limit (20 guest views per guidebook per month) and 14-day trial; StayPage 14-day trial: plans change often.
- Hostfully "app not mentioned" and every "Not mentioned on its site" cell: accurate to the pages fetched, not proof of absence.
- StayPage "Homeowner-only private pages": quoted, not interpreted.
- DigiStayBook Wi-Fi code on the placard: the QR sign code has uncommitted changes in progress (see `SOURCES.md`).
- Extraction method: competitor quotes came from an automated text fetch. Open each URL in a browser and confirm wording.

## Guardrail check (done)

- US English; no currency or prices; "see pricing" links only. No booking-platform names.
- No promises of fewer messages, better reviews, revenue or repeat bookings. Private feedback "isn't a review and doesn't replace one".
- Screening described as reducing risk, not guaranteeing safe content.
- "Stay with us again" / direct booking not mentioned (not live). Translation stated as not offered.
- No logos, testimonials or disparagement; each competitor gets a "Where it's stronger" paragraph. Touch Stay's guest-data collection
  was seen but deliberately not used against it.

## Suggested internal links (already in the post)

`/pricing`, `/stay/demo-cottage`, `/qr-sign-maker`, and `/wall/demo-cottage` from the "Share the memories" bullet.

## Files

- `BLOG_POST.md`: the draft.
- `SOURCES.md`: every competitor claim with URL, date checked and what was seen; DigiStayBook claims with the code checked.
- This file.
