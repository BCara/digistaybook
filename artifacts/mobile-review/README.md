# Phone layout review — 13 September 2026

## Changes

- Fixed the empty-photo property header: the portrait, property name and address no longer wrap into side-by-side columns or leave a large blank gap on phones.
- Let the empty cover grow with its instructions, keeping the upload action clear of the text and the identity below it.
- Replaced the mobile property navigation's multiple rows with a labelled native page selector. Desktop navigation stays available at wider widths.
- Arranged property actions in two consistent columns, with at least 44px-high targets.
- Made property names, addresses and arrival headings grow over multiple lines. Stored values remain single-line text.
- Kept editor fields inside their sheet, made omit/include controls visible and thumb-sized, and made the sticky Save button full-width on phones.
- Wrapped share links and expanded embed snippets within the available width.
- Allowed save/dialog actions to wrap on narrow screens.
- Corrected the selected pricing currency's contrast in dark mode.

## Review coverage

Inspected rendered local layouts for the home page, pricing, sign-in, sign-up, dashboard, property editor, public-wall editor, settings, QR kit, activation/billing, moderation, private feedback, export, public guest wall, in-stay wall, Privacy & Safety form, terms, privacy, operations and not-found page. Additional sample states cover long names and addresses, a cover photo, a populated moderation card, active billing/QR pages, and settings steps two and three.

The initial 20 layouts were measured at 320, 393, 430, 768 and 1440px: 100 page/viewport combinations, with no page-level horizontal overflow after the fixes. Seven additional populated/dialog states were checked at 320, 393, 430, 620, 768 and 1440px: another 42 combinations passed. Expanded embed instructions were also checked at 320px.

These are local rendered fixtures of the real React components with sample host data, plus the built-in guest demos. They do not verify production accounts, real payments, uploads, staff permissions, or populated server review/feedback queues. Error/empty states were inspected where those services were not available. This is browser viewport testing, not physical-device testing.

## Validation

- 153 focused regression tests passed; the opt-in fixture capture also completed successfully.
- Production build passed. It still reports the existing large-chunk/dynamic-import warnings.
- Type checking could not start: the installed TypeScript package is missing `node_modules/@typescript/typescript-win32-x64/lib/tsc.exe`.
- Updated navigation assertions to distinguish desktop current-page labels from mobile options. Refreshed two stale tests for the existing collapsed embed instructions and direct note-photo picker.

## Artifacts and status

The HTML files in this directory are sample render captures; serve them through the local Vite server so `/src/` styles and `/wall/` images resolve. They are not live application sessions. `tools/mobile-audit.test.tsx` is an opt-in capture helper: set `DSB_MOBILE_AUDIT=1` and run that file with Vitest to regenerate the captures. The normal test run skips it.

All changes are local. No deployment or production data changes were made.
