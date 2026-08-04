# DigiStayBook product specification

## Source

Authoritative working source: `digistaybook_WIP_v3.md`. The generated DOCX and HTML are readable views of that Markdown source; `digistaybook_WIP_v2.md` remains the preserved comparison baseline.

This file is the concise GitHub-readable product baseline. The BOP assigns permanent IDs in the form `DSB-BOP-P<part>-<number>`. Product requirements, tests, decisions, issues, commits and pull requests must cite the applicable BOP ID instead of relying on a line number. IDs are never renumbered or reused.

## Product summary

DigiStayBook is a mobile-first digital guestbook for short-term rental hosts. Guests scan a physical QR placard, view a property wall, and add memories without creating an account or downloading an app. Hosts manage properties, curate posts, receive operational notifications, and use the wall to support a more personal, useful and memorable stay. More positive feedback on an official booking platform is a possible indirect marketing benefit of a better guest experience, not a DigiStayBook review workflow or guaranteed outcome.

## Initial capability areas

1. Guest wall with chronological posts, photos, text, copy-text action, editing, deletion, reporting, and consent capture. (`DSB-BOP-P2-004`, `DSB-BOP-P6-009`)
2. Host dashboard with property setup, wall preview, moderation, pinning, foundational posts, house information, QR assets, and billing state. (`DSB-BOP-P2-001`, `DSB-BOP-P2-002`, `DSB-BOP-P6-004`, `DSB-BOP-P6-005`)
3. Account and billing lifecycle, including trials, monthly and annual plans, coupons, renewals, failed-payment grace period, suspension, cancellation, and reactivation. (`DSB-BOP-P3-004`, `DSB-BOP-P4-002`, `DSB-BOP-P7-003`)
4. Moderation workflow for automated flags, guest reports, host approval, and internal trust-and-safety escalation. (`DSB-BOP-P2-005`, `DSB-BOP-P4-005`, `DSB-BOP-P9-002`)
5. Transactional email lifecycle for account, activation, moderation, billing, retention, and security events. (`DSB-BOP-P4-001`, `DSB-BOP-P4-002`, `DSB-BOP-P9-001`, `DSB-BOP-P9-003`)
6. Privacy, terms, guest-content controls, retention, and operational boundaries. (`DSB-BOP-P7-001` to `DSB-BOP-P7-011`; `DSB-BOP-P8-001` to `DSB-BOP-P8-010`)
7. A public Privacy & Safety route for personal-data and platform content-safety requests, separate from booking, property and in-stay support. (`DSB-BOP-P6-008`, `DSB-BOP-P8-003`, `DSB-BOP-P8-009`)
8. A data-class retention engine with scheduled deletion, content-free audit events, backup-expiry controls and scoped legal holds based on the approved retention matrix. (`DSB-BOP-P8-005`)
9. A server-controlled reporting state machine with immediate hiding for ordinary reports, bounded reporter/wall circuit breakers, neutral acknowledgements, auditable outcomes, restoration rules and 14-day privacy escalation. (`DSB-BOP-P2-005`)
10. A central marketing-preference and suppression service with versioned express-consent evidence, send-time enforcement, classified email templates and automated suppression/content-boundary tests. (`DSB-BOP-P4-001`, `DSB-BOP-P8-001`)

## Explicit MVP boundaries

- No guest account or app download.
- Physical QR placards are the MVP access method.
- No guest-to-host messaging inside DigiStayBook.
- Guest property issues are directed to the original booking provider.
- No rating requests, review-transfer instructions, pre-filled provider reviews or provider review deep-links inside DigiStayBook.
- Privacy and content-safety requests remain accessible to guests through self-service, reporting and the public Privacy & Safety route.
- Live routing links and downloadable QR kits remain locked until the property is activated.

## Open decisions

The source plan contains future integrations and implementation choices that need confirmation before coding, including hosting, moderation providers, supported booking platforms, email provider, and the first release surface. Track each decision in `docs/decisions.md`.
