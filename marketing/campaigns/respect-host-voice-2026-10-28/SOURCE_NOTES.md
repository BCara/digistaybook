# DigiStayBook — A home with a host

Prepared 28 October 2026. Suggested sequence: 2–29 November 2026. No posts have been published or scheduled by this work. No external documents, internet research or competitor research used.

## What is finished

- Four-week idea plan: 28 daily ideas, with feed rest days and distinct channel roles.
- Five Facebook units: four static/multi-image posts (six PNGs total) and one 20-second Reel.
- Five Pinterest Pins with their own titles, descriptions, board suggestions, destinations and alt text.
- Seven Facebook Story backgrounds; native stickers must be added where indicated.
- Two silent, captioned vertical MP4s (20 and 18 seconds), usable as optional TikTok drafts. The first is also the Facebook Reel.
- Complete copy, reply wording, creative notes, UTM links, scripts and a reviewable HTML plan.

Later weeks are ideas, not completed media. TikTok account creation is not included. Times are suggested tests in Australia/Sydney, not researched best times. The schedule is proposed; existing scheduled content was not inspected or altered.

## Product grounding

Current local source inspected:

- `src/ui/pages/LandingPage.tsx`: browser guest flow, property QR display, no guest account/app.
- `src/ui/pages/StayWallPage.tsx` and `src/ui/wall/WallHeader.tsx`: welcome, quick house essentials and host notes.
- `src/ui/wall/demoWall.ts`: fictional Seabreeze Cottage property and sample memories.
- `src/ui/host/GuestReviewPanel.tsx`: require-approval option, safety checks, approve/keep-off-wall actions, private feedback.
- `src/ui/host/PublicWallSettings.tsx`: public memory-page control; house guidance belongs on the in-stay view.

Actual product captures were taken from the current local Vite app on 28 October, from `/stay/demo-cottage` and `/wall/demo-cottage`. This confirms local product appearance, not a production release or real guest usage. The videos use those captured screens with gentle motion and burned-in wording, rather than live action or a recording of a customer session. `reference/capture-evidence.json` records the boundary.

“Control your narrative” means the host’s own welcome, guidance and DigiStayBook memory wall. It does not mean changing booking-platform reviews. No promise of reduced damage, improved ratings, incident prevention or guest compliance is made. Private feedback is not a real-time help service; the actual captured form tells guests to use their booking app for help during a stay.

## Artwork and provenance

The logo is copied from the existing `src/assets/logo-long.png` artwork. It is not a new brand concept.

The earlier generated host image was replaced on 28 October 2026. Finished posts now use genuine stock photography already stored in the local product assets: `memory-fire.webp` for the opening Facebook post and `memory-games.webp` for the first Story. No AI-generated photographs are used in the finished media. Stock scenes are not claimed to depict actual DigiStayBook customers. The original generated image remains outside this active campaign in the tool output folder.

Other photographs are existing local product assets, not newly downloaded:

| Asset | Existing recorded source |
| --- | --- |
| memory-fire.webp | Unsplash photo-1603039531759-1a1bbe4f9f94 |
| memory-games.webp | Unsplash photo-1677024486583-5539ae4cfc67 |
| memory-window.webp | Unsplash photo-1508965386566-d0d8cade38c9 |
| memory-table.webp | Unsplash photo-1758810742940-892122ccdcf1 |
| memory-garden.webp | Unsplash photo-1569787811498-32f428436f46 |
| Images within product captures | Existing fictional demo photos |

The repository's existing `docs/demo-photo-credits.md` records those photos under the Unsplash License, permitting commercial use. That local credit record was consulted; the licence/source websites were not opened or independently reverified for this campaign. Sample memories visible inside captures belong to the fictional demo and are labelled accordingly.

## Edit and rebuild

Edit `source/content.mjs` for strategy, dates, captions and daily ideas. The generated `content.json`, copy document and HTML plan are handoff outputs; rebuild after changing the source. Edit `source/build.mjs` for creative layouts.

From the project root, run `node marketing/respect-host-voice-2026-10-28/source/serve.mjs` for the preview on port 15188, then run:

```
node marketing/respect-host-voice-2026-10-28/source/build.mjs
node marketing/respect-host-voice-2026-10-28/source/export-videos.mjs
node marketing/respect-host-voice-2026-10-28/source/verify.mjs
```

The scripts use the bundled local Playwright runtime documented in their source. `capture.mjs` expects the local product on port 15186. Exported PNGs, MP4s, copy and the plan can be used without running the builders. The final media ZIP includes the media, captions, content JSON and these notes; it excludes source fonts and QA images.

The shared copy is stored as a new campaign folder on the DigiStayBook NAS. Existing campaign folders and marketing hub have been preserved.

