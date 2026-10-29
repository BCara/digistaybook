# Sources and production notes

Prepared 29 October 2026. Photos were downloaded and reviewed during this session. No AI imagery, image generation prompts or synthetic people were used. Layout and typography are ordinary HTML/CSS, exported with Playwright. Source photographs remain unchanged apart from cropping in the layouts; no product screen is inserted into a stock subject’s device.

Pexels source pages list these as free stock photos. Licence checked: https://www.pexels.com/license/ (read 28 October Sydney time, before midnight). Pexels permits use and modification; its restrictions include no implied endorsement. These are illustrative scenes, not customer stories, testimonials or proof of app usage. A short stock-photo disclosure is included in the artwork and feed captions.

- `8962200.jpg`: Ivan S, Couple Using Smartphone. Source: https://www.pexels.com/photo/couple-using-smartphone-8962200/
  Download: https://images.pexels.com/photos/8962200/pexels-photo-8962200.jpeg?auto=compress&cs=tinysrgb&w=2200
- `7155733.jpg`: Gustavo Fring, A Couple Looking Together on Cell Phone. Source: https://www.pexels.com/photo/a-couple-looking-together-on-cell-phone-7155733/
  Download: https://images.pexels.com/photos/7155733/pexels-photo-7155733.jpeg?auto=compress&cs=tinysrgb&w=2200
- `6140376.jpg`: William Fortunato, Positive young multiracial couple drinking takeaway coffee on terrace. Source: https://www.pexels.com/photo/positive-young-multiracial-couple-drinking-takeaway-coffee-on-terrace-6140376/
  Download: https://images.pexels.com/photos/6140376/pexels-photo-6140376.jpeg?auto=compress&cs=tinysrgb&w=2200
- `7982837.jpg`: RDNE Stock project, A Family Spending Time Together. Source: https://www.pexels.com/photo/a-family-spending-time-together-7982837/
  Download: https://images.pexels.com/photos/7982837/pexels-photo-7982837.jpeg?auto=compress&cs=tinysrgb&w=2200
- `37876673.jpg`: Renkgezgini, Woman Taking Photo with Smartphone on Beach. Source: https://www.pexels.com/photo/woman-taking-photo-with-smartphone-on-beach-37876673/
  Download: https://images.pexels.com/photos/37876673/pexels-photo-37876673.jpeg?auto=compress&cs=tinysrgb&w=2200

## Product grounding

- Current local `src/ui/pages/LandingPage.tsx`: property QR display, browser guest page, house guidance, local favorites, guest photos/messages and no guest account/app.
- `reference/demo-arrival.png`: existing 28 October capture from the current local app, `/stay/demo-cottage`. Fictional Seabreeze Cottage. Captured screen is labeled Demo in the artwork. This is source/demo appearance evidence, not a new release or a customer session.
- `reference/logo.png`: existing official transparent wordmark copied from `marketing/_reference/digistaybook-logo-long-transparent.png`.
- No price, performance metric, ratings promise or customer result is stated.

## Files and rebuild

- `source/build.py` creates editable source artwork, content JSON, review page and copy documents.
- `source/render.mjs` exports eight PNGs, a contact sheet and a validation manifest; it packages finished media/copy/credits, not unaltered stock photographs.
- Feed: 1080 × 1350. Stories: 1080 × 1920. Add a native Story link sticker before publishing.
- Review selections and edits live in a separate browser key, `dsb-people-moments-20261029`. Export the review to preserve or share it.
- Existing marketing calendar dates, approvals and external schedules are unchanged. This batch is a selection pool for owner review.
