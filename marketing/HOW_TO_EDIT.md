# How to edit the marketing (for people and their AI)

All three projects (DigiGuestbook, DigiStayBook, LazyAlbum) use the same folder layout; see `README.txt`. Read `MARKETING_NOTES.md` and `AGENTS.md` first.

The NAS master is `\\192.168.1.71\nas\projects\DigiStayBook\marketing\MARKETING_PLAN.html`.

The active proposal is now `campaigns/merged-2026-10-28/content.json`: 38 dated items, including 20 main Facebook posts. Original campaign sources remain preserved and are reconciled in the 98-row decision ledger. They are reference archives, not separate calendars to publish alongside this one.

1. Edit the merged `content.json` for captions, dates, assets, destinations, shot lists and decisions.
2. Run `python builder/build_marketing_plan.py` in the marketing folder. It reads `campaigns/merged-2026-10-28/plan.css`, `review-sections.html`, the merged source, the preserved launch-week JSON, and `builder/marketing-review.js`, and finishes by applying the shared page format (`builder/house.py`).
3. Open the plan and review the calendar and card details. Missing videos are explicitly labelled. An actual PNG/MP4 is media, not proof of approval or publication.
4. Preserve any populated `campaigns/merged-2026-10-28/scorecard.csv`; the builder creates it only if absent. Record actual results there. Do not infer zero from unavailable data.

Browser reviews retain the existing key `dsb-marketing-review-20261023` and import the old campaign-page key without deleting it. Older reviews remain exportable, including reserved/merged sources. When a caption, date, asset or brief changes, its previous approval is not automatically applied to the revised proposal. The prior record remains visible on the card. Reconcile any existing Scheduled/Posted Meta record before changing external dates. Source changes do not update Meta.

Copy or download the review before switching browsers/computers. Browser reviews do not write to NAS. Export includes the active proposal, source decisions, old browser records and the recorded 28 Oct 19:30 scheduled post.

There are 12 finished main image units and three existing videos. Five new videos remain. `campaigns/merged-2026-10-28/TRAFFIC_REVIEW.md` records the priorities and evidence limits. No new photography was generated. New static artwork uses existing genuine photos, actual fictional-demo captures and ordinary HTML/CSS composition. `ARTWORK_PROVENANCE.json` records inputs.

Artwork rebuild: run `python campaigns/merged-2026-10-28/build_artwork.py`, then `node campaigns/merged-2026-10-28/render_artwork.mjs` from the marketing directory. The latter uses the bundled Playwright and Sharp runtime specified in the script, renders PNGs and checks public destinations read-only.

Preview the NAS copy from the project root with `node marketing/campaigns/merged-2026-10-28/preview.mjs //192.168.1.71/nas/projects/DigiStayBook/marketing 15184`, then open `http://127.0.0.1:15184/MARKETING_PLAN.html`. `node tools/verify-marketing-plan.mjs` verifies that served NAS copy, including playback and isolated review-history migration. The preview binds to localhost and supports video byte ranges.

`prepare_merge.py` recreates the initial editorial merge from `original-sources.json`. Do not run it over later manual edits without preserving them. It is provenance/reconstruction, not the daily editing step.

No posting, scheduling, emailing, messages, account creation, spend or website deployment is performed by these builders. The pre-change NAS hub and builder are backed up in `_archive/2026-10-28-before-unified-traffic-review/`.

## Supporting pages

The main calendar contains the cadence summary, campaign weeks, post overview and post details. `MARKETING_PRODUCTION.html`, `MARKETING_STRATEGY.html` and `MARKETING_REFERENCE.html` hold production briefs, strategy/measurement, and source/history records. `campaigns/merged-2026-10-28/build_info_pages.py` generates them when the main builder runs. Keep these files together on NAS; their links return to the matching post or overview. Legacy section bookmarks redirect to the relevant supporting page. Reviews retain the same browser key.

## Short links in captions

Captions show short links such as `digistaybook.com/f/r-07` (`/f/` Facebook, `/s/` Facebook Stories, `/p/` Pinterest). Each one is a redirect in the project's `firebase.json` to the post's full tracked `destination`, so every new or renamed post needs a matching redirect line, and the site must be deployed before the post goes out. The `destination` field keeps the full UTM URL.

## Approval statuses

Cara and Joe each have their own approval status (`Approved – Cara`, `Approved – Joe`, `Approved – Cara and Joe`). Reviews are saved per browser, so whoever records the second approval should pick "Cara and Joe". Older "Manual review – confirmed" records show as "Approved – reviewer not recorded".

## Changes log

- 2026-10-29 · Claude · "Why choose DigiStayBook" gained reasons 7-11 from a review of current host conversations: private
  feedback, memories on the host's own website, Wi-Fi QR on the placard, update once, no guest accounts; plus timely hooks
  and "careful with" notes (local posting laws, translation). The app no longer tells hosts to put the public-page link in
  their listing (Airbnb bans off-platform links in listings and messages).

- 2026-10-29 · Claude · "Why choose DigiStayBook" is now the heart of the marketing: written in `MARKETING_NOTES.md` and
  shown on the plan as "Why hosts choose us" (the builder renders it from the notes, so change it there and rebuild). New
  rules in the notes and `AGENTS.md`: no currency anywhere, and US first. The calendar is now in US Eastern time (same days
  and clock times, Sydney shown beside each post; nothing was scheduled in Meta). US spelling applied to every post, the
  calendar artwork, the people images and both reels, which were re-rendered (vacation, favorite, neighbor, trash,
  behavior, labeled); the `new-neighbours` short link is unchanged. Edited captions need fresh approval. Before-copies of
  the text, artwork and videos are in `_archive/2026-10-29-us-first/`.

- 2026-10-29 · Claude · Sections now come in the same order in all three projects' plans, on the page and in its
  contents list: Needs you, Strategy, Posts, Post details, Campaigns, Marketing assistant, What changed, Your notes,
  Where things are. `builder/house.py` does this on every build; a section with its own id is placed through
  `"order"` in `builder/house.json`, and anything else stays with the section before it. The contents list now says Strategy and Posts for those two sections. The pages before
  this change are in `_archive/2026-10-29-before-alignment/section-order/`.

- 2026-10-29 · Claude · Marketing folder aligned with DigiGuestbook and LazyAlbum: campaign folders moved into `campaigns/`
  (merged-2026-10-28, home-2026-11-02, month-2026-10-23, prelaunch-week-2026-10-16, respect-host-voice-2026-10-28,
  people-2026-10-28, reels-people-2026-10-29), `_reference/` to `reference/`, `build_marketing_plan.py` and
  `marketing-review.js` to `builder/`; empty `content/` added. Builder, artwork, preview and verify script paths updated; the plan
  rebuilt with the shared house format (`builder/house.py`). Added `MARKETING_NOTES.md`, `AGENTS.md`, `EDIT_REQUESTS.md` and
  `README.txt`. The repository's `marketing/` copy uses the same layout. Copies of every rewritten file and the move list are in
  `_archive/2026-10-29-before-alignment/`.
