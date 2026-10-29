DIGISTAYBOOK MARKETING · NAS MASTER
Updated 29 October 2026. All three projects (DigiGuestbook, DigiStayBook, LazyAlbum) use this same folder layout.

Open MARKETING_PLAN.html first. It is the one page for all marketing: the plan at a glance, one working calendar,
every post with its artwork and review status, and "Where things are". This NAS folder is the master copy.

MARKETING_PLAN.html        The one page. Generated: don't edit it by hand (see HOW_TO_EDIT.md).
MARKETING_PRODUCTION.html  Companion: videos still needed and shot lists.
MARKETING_STRATEGY.html    Companion: traffic review and measurement.
MARKETING_REFERENCE.html   Companion: the 98 source decisions, preserved records, files and sources.
MARKETING_NOTES.md         Your preferences and rules. Every AI reads this before drafting anything.
HOW_TO_EDIT.md             How anyone (or their AI) changes a post and rebuilds the page, plus the changes log.
AGENTS.md                  Rules for any AI working here: real photos only, drafts for review, no posting without approval.
EDIT_REQUESTS.md           Requests that need the owner's PC: new or redrawn images and videos.
README.txt                 This file.

campaigns\                 One folder per campaign, named name-YYYY-MM-DD.
                           merged-2026-10-28        the active merged plan (29 Oct - 29 Nov) and its sources
                           reels-people-2026-10-29  two live-action reels
                           people-2026-10-28        photo-led posts and Stories
                           home-2026-11-02          home campaign (merged into the plan)
                           respect-host-voice-2026-10-28, month-2026-10-23   merged campaigns, kept as reference
                           prelaunch-week-2026-10-16  pre-launch week 1 (history)
content\                   Reusable material not tied to one campaign (empty so far).
reference\                 Background: logos, plan.css/plan.js and the pre-launch week 1 record.
builder\                   Machinery behind MARKETING_PLAN.html: build_marketing_plan.py, marketing-review.js and
                           house.py (the shared page format). You don't need to open these.
_archive\                  Retired pages and before-change backups, kept for the record. Nothing in them is current.

A new campaign gets its own folder in campaigns\ and is merged into MARKETING_PLAN.html.
Extra pages that belong with the hub are named MARKETING_<TOPIC>.html and linked from it.
