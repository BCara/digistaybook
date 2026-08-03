# DigiStayBook product specification

## Source

Working source: `digistaybook WIP.docx` in the shared Google Drive Product Description folder.

This file is the GitHub-readable requirements baseline. Requirements should be updated here when they are agreed, with the related issue or pull request recorded in the change log.

## Product summary

DigiStayBook is a mobile-first digital guestbook for short-term rental hosts. Guests scan a physical QR placard, view a property wall, and add memories without creating an account or downloading an app. Hosts manage properties, curate posts, receive operational notifications, and use the wall to support a more personal stay and easier review follow-up.

## Initial capability areas

1. Guest wall with chronological posts, photos, text, copy-text action, editing, deletion, reporting, and consent capture.
2. Host dashboard with property setup, wall preview, moderation, pinning, foundational posts, house information, QR assets, and billing state.
3. Account and billing lifecycle, including trials, monthly and annual plans, coupons, renewals, failed-payment grace period, suspension, cancellation, and reactivation.
4. Moderation workflow for automated flags, guest reports, host approval, and internal trust-and-safety escalation.
5. Transactional email lifecycle for account, activation, moderation, billing, retention, and security events.
6. Privacy, terms, guest-content controls, retention, and operational boundaries.

## Explicit MVP boundaries

- No guest account or app download.
- Physical QR placards are the MVP access method.
- No guest-to-host messaging inside DigiStayBook.
- Guest property issues are directed to the original booking provider.
- Live routing links and downloadable QR kits remain locked until the property is activated.

## Open decisions

The source plan contains future integrations and implementation choices that need confirmation before coding, including hosting, moderation providers, supported booking platforms, email provider, and the first release surface. Track each decision in `docs/decisions.md`.
