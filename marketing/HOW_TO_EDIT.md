# DigiStayBook marketing plan

The shared master is `\\192.168.1.71\nas\projects\DigiStayBook\marketing\MARKETING_PLAN.html`.

The new campaign covers 23 October through 21 November 2026: 30 daily content cards. It starts after the existing launch week. The seven earlier records and their recorded statuses are preserved separately; this rebuild does not verify or change Meta activity.

## Change the source

1. Edit `month-2026-10-23/content.json`. Keep 30 records, their order and the campaign start date unless deliberately revising the calendar.
2. Run `python build_marketing_plan.py` from this marketing folder. Python's standard library is sufficient.
3. Open `MARKETING_PLAN.html` and review the calendar, dates, reference images and caption text.
4. Keep `_reference/plan.css`, `_reference/prelaunch-week-1.json`, `marketing-review.js` and the campaign reference files beside the builder when copying the package.

## Review in the page

- Change status from either the calendar or a post card; both controls stay in sync.
- Edit a caption and add a review comment. These changes save in this browser under the campaign-specific key `dsb-marketing-review-20261023`.
- Use **Copy my review** or **Download review** before moving computers. Browser changes do not write to the NAS file or update Meta.
- Consolidate approved changes into the JSON source and rebuild. A review status is a record, not proof that an external post was drafted, scheduled or published.

## Asset boundary

All 30 captions, Story prompts, visual briefs and alt text are drafted. Five reels have shot lists; four carousels have slide outlines. The reference images are copies of genuine product/demo screens from the earlier launch pack. They are not newly composed post images, carousel exports or videos. Produce and review final assets before using Drafted/Scheduled/Posted statuses.

Use the real logo and real screens. Label sample properties and memories as demos. Do not invent customers, testimonials, poll results, scarcity or launch dates. Keep private guest information, passwords and private in-stay URLs out of public artwork.

The original marketing hub and builder are backed up under `_archive/2026-10-18-before-month-plan/` on the NAS. The earlier campaign folder is retained in place.
