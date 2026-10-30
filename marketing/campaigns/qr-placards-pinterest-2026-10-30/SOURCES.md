# Sources and production notes

Prepared October 30, 2026. Eighteen printable QR placard styles for the same 5 x 7 card (01-12 illustrated,
13-18 with photographs). Each one has the content of
the app's placard (`src/ui/host/QrPlacard.tsx`): lead or welcome, property name, the guest-wall code, the invite,
the address, the Wi-Fi code and the DigiStayBook mark. The demo property (Seabreeze Cottage) fills every card.

- **No AI imagery.** In 01-12, waves, leaves, mountains, arches, circles and borders are hand-written SVG and CSS shapes.
- **Photos (13-18):** the demo property's own Unsplash photos (Unsplash License, commercial use allowed), copied unchanged
  from `public/wall/` into `reference/photos/` with their credit table (`reference/photos/CREDITS.md`, from
  `docs/demo-photo-credits.md`). The renders use the full-size originals of the same photos in `reference/photos-full/`
  (downloaded October 30, 2026 at 3200 px; see its `SOURCES.md`), only cropped in the layouts. They illustrate the
  fictional Seabreeze Cottage, not a customer.
- **The app's sign maker** (`/qr-sign-maker`, `src/ui/signs/`) draws the same eighteen designs; its stylesheet is
  generated from this renderer's CSS. Pins and their links are in `PINS.md`.
- **Fonts:** Google Fonts under the SIL Open Font License, which allows print and commercial use. The fonts are Cormorant
  Garamond, Jost, Bebas Neue, Satisfy, Libre Baskerville, Outfit, Fraunces, DM Serif Display, Josefin Sans, Playfair
  Display, Caveat, Alfa Slab One and Space Mono.
- **QR codes:** the project's `qrcode-generator` with the app's settings (error correction M, four-module quiet zone),
  always dark ink on white. The main code encodes `https://digistaybook.com/stay/demo-cottage`; the Wi-Fi code encodes the
  demo network from `src/domain/propertyProfile.ts`. After export, OpenCV decoded both codes on all twelve print files.

## Files

- `styles/print-5x7/placard-NN-style.png`: 1500 x 2100, 300 dpi, no bleed.
- `styles/pinterest/pin-placard-NN-style.png`: 1000 x 1500, the card on a matching backdrop, no ad copy.
- `styles/STYLES_CONTACT_SHEET.jpg`, `styles/STYLES_MANIFEST.json`.
- `REVIEW.html`: the gallery page.
- Rebuild: `node source/styles.mjs` (needs network for Google Fonts; it stops if a font fails to load).

The earlier ad-style Pins from the same day were retired to `marketing/_archive/2026-10-30-qr-placard-ad-pins/`.
