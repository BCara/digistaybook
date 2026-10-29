# Rules for any AI working in this marketing folder

DigiGuestbook, DigiStayBook and LazyAlbum all use the same folder layout and these same rules; only the
"This project" section differs. Read `MARKETING_NOTES.md` (the owner's preferences) before drafting anything,
and `HOW_TO_EDIT.md` before changing a post or the plan page.

## Posting and approval

- Save posts as **drafts for review**. Nothing is scheduled, published, commented or messaged without the
  owner's approval for that exact item, given in chat. Approval for one post doesn't cover the next.
- The owner sometimes posts things themselves: check before editing or scheduling a draft.
- Never permanently delete anything in the owner's accounts; deleting drafts is the owner's job.

## Photography and artwork

The owner requires real photographs for marketing visuals: documented stock (source recorded) or the owner's
own photographs with permission. Check the project's photo library and its manifest before choosing assets.

- Do not generate photos, people, event scenes, backgrounds or product screenshots with AI. No generative fill,
  expansion, face replacement or AI background generation.
- Ordinary cropping, resizing, colour adjustments, text, shapes, the real logo and actual product screenshots
  are fine for composing marketing material.
- Keep downloaded source files unchanged. Record the source page, photographer, licence, download date and
  any new derivative's source assets.
- Do not use files in `ai-generated-DO-NOT-POST` archives or stock images with undocumented origins. Do not
  remove provenance metadata to hide AI use.
- Stock subjects are illustrative; never present them as actual customers, testimonials or endorsements.
- A metadata scan cannot establish that a photo is human-made or guarantee that a platform will not apply an
  AI label. Describe the evidence accurately.

## Where things go

- `MARKETING_PLAN.html` is the one hub page. Don't create other overview pages; a page that belongs with the
  hub is named `MARKETING_<TOPIC>.html` and linked from it.
- A new campaign gets its own folder `campaigns/<name>-YYYY-MM[-DD]/` with a brief or review page, and is
  added to the hub's Campaigns section.
- Reusable material goes in `content/`, background in `reference/`, build scripts in `builder/`.
- Before replacing a file, copy the old one into `_archive/` (dated). Retired pages go there too.
- After changing the hub, run `builder/house.py` (the builder does this for you where there is one) so the
  page keeps the shared format: header, section titles, "Where things are" and footer.

## This project: DigiStayBook

- Footage and photos: licensed stock (Pexels and similar) with sources recorded in each campaign's `SOURCES.md`, or our own.
  Product screenshots only from the fictional demo property (`/stay/demo-cottage`).
- Approvals are per reviewer (Cara, Joe, or both); see `MARKETING_NOTES.md`.
- The active plan's sources are `campaigns/merged-2026-10-28/content.json`; build with `python builder/build_marketing_plan.py`.
- Every new or renamed caption short link (`digistaybook.com/f/...`) needs a redirect in the app's `firebase.json`.
- The repository keeps a working copy of this folder in `marketing/`; keep both in the same layout.
- **Every piece of marketing argues one of the reasons in "Why choose DigiStayBook"** (`MARKETING_NOTES.md`) and keeps its
  guardrails: no promised reviews, ratings, revenue or fewer messages; tax only as "could be", with the small print; no
  booking-platform names in paid ads; direct-booking links not marketed until they are live.
- **No currency, anywhere.** DigiStayBook is a global business: never show a price with a currency symbol or code
  ("A$15", "$10", "USD"). Describe the value and link to the pricing page.
- **US first.** US English spelling and wording (color, favorite, trash, vacation rental), US dates (November 5),
  US seasons and holidays, and publication times aimed at US evenings (7-9pm Eastern by default), recorded in Eastern time
  with Sydney beside it. Posts already approved or scheduled keep their wording and times until deliberately revised.
