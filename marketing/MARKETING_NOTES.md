# Marketing notes: owner preferences

Private notes for DigiStayBook marketing. Any AI reads this before drafting anything and follows it. Add to it any time.

**Master copy is on the NAS:** `\\192.168.1.71\nas\projects\DigiStayBook\marketing\MARKETING_NOTES.md`. There is no other master.

Collected on 29 October 2026 from the decisions already recorded in `HOW_TO_EDIT.md`, the merged plan
(`campaigns/merged-2026-10-28/`, including `TRAFFIC_REVIEW.md`) and the campaign source notes. Change anything that is no longer right.

---

## How posting works
- Everything is a **draft for review**. Nothing is posted, scheduled, emailed or messaged without approval of that exact item.
- **Two reviewers.** Cara and Joe each record their own approval (`Approved – Cara`, `Approved – Joe`, `Approved – Cara and Joe`).
  Reviews are saved per browser, so whoever records the second approval picks "Cara and Joe". Older "Manual review – confirmed"
  records show as "Approved – reviewer not recorded".
- When a caption, date, asset or brief changes, its earlier approval does not carry over to the revised version.
- Reconcile any Scheduled or Posted record in Meta before changing a date. Changing the plan does not change Meta.
- Times: the plan has been kept in Sydney time. From 29 October 2026 publication is aimed at the US (see "A global
  audience, US first" below); give new times in US Eastern time with Sydney beside them, and reconcile Meta before
  moving anything already scheduled.

## The one page
- `MARKETING_PLAN.html` is the single marketing page: one working calendar, every post with its artwork and status. Its companion
  pages are `MARKETING_PRODUCTION.html` (videos and shot lists), `MARKETING_STRATEGY.html` (traffic review and measurement) and
  `MARKETING_REFERENCE.html` (source decisions, preserved records, files).
- There is **one active calendar**. Older campaigns (month, "Control your own narrative", "A home with a host") are merged into it and
  kept as reference, not published alongside it.
- A new campaign gets its own folder in `campaigns/` (name-YYYY-MM-DD) and is merged into the plan. Retired pages go in `_archive/`.

## Channels and rhythm
- **Facebook is primary**: most days, aim for 4–5 posts a week. **Pinterest** supports, about twice a week. **Stories** support the
  main posts. Instagram and YouTube can reuse approved videos. Don't spread wider than production capacity allows.
- Every main post sends people to the site through a tracked destination, except a deliberate conversation-only piece.
- Rotate the angle: practical writing, the actual product, local tips, guest feedback, QR placement, approval and setup. Avoid
  repeating abstract "host story" copy.

## Links in captions
- Captions use short links such as `digistaybook.com/f/r-07` (`/f/` Facebook, `/s/` Stories, `/p/` Pinterest). Each is a redirect in
  the app's `firebase.json` to the post's full tracked destination, so a new or renamed post needs a redirect line, and the site must be
  deployed before the post goes out.

## Photos, video and wording
- Real photographs and real moving footage only: licensed stock with the source recorded, or our own. No AI-generated people, scenes
  or photographs. Static artwork is composed from genuine photos, actual demo captures and ordinary HTML/CSS; provenance is recorded.
- Product screenshots come from the fictional demo property (Seabreeze Cottage, `/stay/demo-cottage`). They show how the product looks,
  never a real customer's stay. No outcome or upload result is invented.
- Stock subjects are never presented as customers or endorsers; captions say "Stock footage used for illustration" where it applies.
- Reels are silent masters with burned-in wording; add licensed music from the platform's own library when posting.

## Measuring
- Record real results in `campaigns/merged-2026-10-28/scorecard.csv`. Never infer zero from data that wasn't available.

## Why choose DigiStayBook

This is the heart of all DigiStayBook marketing. Every post, ad, page and email should land on the core reason or one of
the reasons below, and respect the guardrails. The marketing plan page shows this section as "Why hosts choose us".
Agreed 29 October 2026.

### The core reason
**It makes a rental feel like staying in someone's home, not a business.** One QR code gives guests what they need, when
they need it, and lets them leave something for the next guest. Guidebooks only inform, paper guestbooks only collect, and
doing nothing is the real competitor.
- Line: "Give your guests a welcome, not a laminated sheet."

### 1. Guests can find everything themselves
Wi-Fi, trash days, heating and checkout are answered on the counter, on their phone, without messaging you. No app, no account,
under a minute in a browser tab.
- Line: "The answers are on the counter, not in your inbox."
- Guardrail: never promise fewer messages or less support work.

### 2. Guests help because they feel welcome, not because they're told to
Airbnb's new house-rules policy (bookings made on or after 20 November 2026) limits what hosts may require: no taking
trash off-site, stripping beds, laundry or washing dishes. Respectful guests still help when they feel they are staying in
someone's home.
- Line: "The rules limit what you can ask. They don't limit how welcome you can make someone feel."
- Guardrail: the wall gives information ("the trash cans are the black ones at the blue gate, pickup is Tuesday"), never rules or
  requirements. Airbnb says extra rules shouldn't appear on signs in the home. Never pitch DigiStayBook as a way around the rules.
- Guardrail: don't name Airbnb, or any booking platform, in paid ads, and never imply an endorsement or partnership.

### 3. A guestbook that builds up instead of filling up
Every stay adds photos, notes and local tips for the next guest. A paper book fills up and gets lost; a guidebook only
talks at guests. Tips from people who actually stayed carry more weight than the host's own list.
- Line: "Every stay adds to the story of your place."

### 4. You stay in control of what's shown
Posts are screened automatically, borderline ones wait for the host's approval, and the host can remove anything.
- Line: "Nothing questionable lands on your wall unreviewed."
- Guardrail: screening reduces risk; never say it guarantees safe content.

### 5. A small, simple cost that could be a business expense
One price per property, everything included, a 28-day free trial and one-click cancellation. Lead boldly on tax, the way
Officeworks does ("could be tax deductible"), and qualify in the small print.
- Lines: "Claim it at tax time." / "Could be a 100% business expense."
- Small print, every time: "DigiStayBook could be tax deductible as a business expense for your rental. Eligibility
  depends on your circumstances; check with your tax adviser."
- Guardrail: never "is tax deductible", "highly likely", "in most cases", or a figure for what someone will save.
- Guardrail: no currency in marketing (see "A global audience" below). Say "one low monthly price per property" or point to
  the pricing page, which shows each visitor their own currency.

### 6. Repeat guests can find you directly (hold until live)
Guests already have the wall open for the Wi-Fi, so a "Stay with us again" link to the host's own booking page or guest
list is right there. Posters and business cards don't get that reach.
- Line: "Your next booking, one tap from the Wi-Fi."
- Status: built on 29 October 2026, **not deployed yet. Don't market it until it is live.**
- Guardrail: our copy never says "book direct and save" or offers a discount for booking off a platform (Airbnb bans this),
  and never promises repeat bookings or lower commission. What each host's link says and offers is up to them.

### 7. Hear about problems while you can still fix them
Guests can send the host private feedback that is never published: the slow shower, the missing pan, the blind that sticks.
Hosts are anxious about reviews, and this gives them the chance to fix things during the stay.
- Line: "Hear about the slow shower while you can still fix it."
- Guardrail: never suggest it replaces, prevents or heads off reviews. Booking platforms ban review manipulation, and we never
  ask guests for ratings or steer them away from reviewing.

### 8. Real moments from real stays, on your own website
The public wall can be embedded on the host's own site or shared with past guests, so a direct-booking site carries real
guest photos and notes.
- Line: "Real moments from real stays, on your own website."
- Guardrail: they are memories, not reviews or ratings. Don't suggest putting the link in a booking-platform listing:
  Airbnb bans listing links that take people off Airbnb.

### 9. Guests get online first
The QR placard can carry a Wi-Fi code that a phone joins with one scan, and the wall copies the password in one tap.
Guests without mobile data (international visitors especially) aren't stuck before they can read anything.
- Line: "Scan, connect, settle in."

### 10. Update it once, every guest sees it
Change the Wi-Fi password, trash day or a local tip on the wall and the next guest sees it. No reprinting, no out-of-date
folder.
- Line: "Change the Wi-Fi password once. Every guest sees it."

### 11. No guest accounts, no data grab
Guests don't sign up, and DigiStayBook doesn't collect their contact details. That's easier for guests and in line with the
wider move, including Airbnb's new rules, against hosts gathering guest data.
- Line: "No app. No account. No catch."
- Guardrail: describe what we don't collect; don't give privacy or legal advice.

### Timely hooks
- Airbnb's chore rules (bookings from November 20, 2026): "Rewrite your checkout notes for the new rules": useful
  content leading into reason 2. Link to Airbnb's own page; never interpret the policy for hosts.
- The over-automation backlash: "Automate the logistics. Keep the welcome human."
- A crowded US market: "In a crowded market, be the stay they remember." No promised bookings or reviews.
- Direct booking, once reason 6 is live: Airbnb is reportedly piloting a lower host fee for guests who book through the
  host's own Airbnb link. A host could put that link in their "Stay with us again" card and stay within Airbnb's rules.
  Unconfirmed pilot: check the details before using it.

### Careful with
- Local posting laws: many US cities require the emergency contact, occupancy limit and trash rules to be physically posted
  inside the rental. Say the wall also carries this information; never that it meets a legal requirement.
- Translation: not built. Don't market multilingual guides.

### Lines we never use
- Better reviews or star ratings. Approved instead: "A better stay may encourage more positive feedback on the booking platform."
- Less damage, fewer messages, more revenue, or any connection with, or endorsement by, a booking platform.
- "Is tax deductible", "highly likely" or "in most cases".
- Any currency symbol, code or amount.

### Which reason for which audience
- Self-check-in hosts: reasons 1, 2, 9 and 10.
- Hosts who care about character and reviews: reasons 3, 4 and 7.
- Price-sensitive hosts, and US tax season (January to April): reason 5.
- Experienced hosts building direct bookings (for example the "Hosts Helping Hosts" Facebook group): reason 8 now, reason 6 once live.
- Property managers with several homes: reasons 4, 10 and 5 (one price per property, one dashboard).
- Hosts hosting international guests: reason 9.

## A global audience, US first
- DigiStayBook is a global business. **No marketing names or shows a currency**: no "A$15", "$10", "AUD" or "US$". Talk
  about value ("one low monthly price per property, everything included") and link to the pricing page, which prices each
  visitor in their own currency.
- **Marketing is primarily US-focused** (agreed 29 October 2026). Apply it to everything new:
- Spelling and words: US English in all posts, ads, captions, burned-in video text, Pins and pages: color, favorite,
  organize, center, license (noun), catalog; trash and trash can (not rubbish or bins), vacation rental alongside
  short-term rental, check out (verb) and checkout (noun), apartment, zip code.
- Publication times: schedule for US audiences, by default the US evening, 7-9pm Eastern (4-6pm Pacific). That is
  11am-1pm the next day in Sydney while the US is on standard time. Record times in US Eastern time with Sydney beside them.
- Dates and seasons: write dates the US way (November 5) and use the US calendar: Thanksgiving, Black Friday, the holiday
  season, spring break, summer travel, and tax season (January to April) for the tax line.
- Examples and settings: US-style examples (a lake house, a beach rental, a mountain cabin). Keep the demo property's real
  photos and screenshots, but don't call out Australian places in ads.
- Posts already approved, scheduled or posted keep their wording and times until they are deliberately revised; a revised
  caption needs a fresh approval.

## Things I've learned / ideas
- (add here)
