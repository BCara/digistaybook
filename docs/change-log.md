# Change log

## 2026-08-04

- Created `digistaybook_WIP_v3.md` while preserving the downloaded v2 source.
- Reframed booking-provider review benefits as non-guaranteed host-facing marketing and removed review-transfer functionality from the operational design.
- Accepted and applied the legal/product consistency changes covering content processing, moderation review, proportionate abuse controls, public privacy and safety access, role allocation by data class, and the pre-publication legal-review gate.
- Added the provisional data-class retention matrix, deletion definition, content-free deletion audit, legal-hold rules, and aligned draft, dormancy, privacy, win-back, accounting, security, moderation, suppression, and backup periods.
- Resolved the anonymous-reporting contradiction with a server-owned state model: ordinary reports hide immediately, repeated/abusive reporting trips bounded reporter and wall circuit breakers, breaker-state reports remain auditable without changing visibility, and genuine privacy requests retain an escalation route.
- Applied conditional tax wording, removed tax advice from receipts, added versioned marketing-consent evidence, central suppression and send-time checks, classified all email families, separated promotional and transactional content, required pre-enable suppression tests, and softened unsupported outcome claims.
- Clarified the document hierarchy: Part 4 remains the authoritative operational specification, while Part 9 remains the supporting email-copy appendix and must conform to Part 4.
- Removed corrupted icon strings from all Appendix email CTA labels and retained plain-text button labels.
- Added 79 permanent BOP requirement/template IDs, cross-referenced them from the product specification, decisions and backlog, and adopted the no-renumber/no-reuse convention.
- Generated a readable v3 DOCX, a standalone v3 HTML document and a standalone v2-to-v3 HTML comparison from the Markdown sources.
- Replaced the stale pre-BOP build plan with an autonomous BOP-linked implementation plan, persistent status ledger, restart procedure and status validator; recorded the implementation architecture as D-009.
- Started every implementation workstream with an executable foundation: React/TypeScript/Vite application shell, Firebase fail-closed boundaries, Guest and Host slices, moderation/billing/marketing/retention contracts, disabled post-MVP flags, tests and CI.
- Added a release-evidence record and security baseline that distinguish local, emulator, deployed and manual proof, including an explicit Functions dependency-advisory release gate.
- Added an isolated Firebase Emulator Suite gate with eight Firestore rules tests covering public visibility, draft/hidden denial, Host ownership, bounded creation and direct guest-write denial; wired it into CI with Java 21.
- Added `DSB-BOP-P6-010` and implemented its discreet, accessible "Powered by DigiStayBook" link after the public Guest Wall, directing interested visitors to the main landing page without popups or contribution friction.
- Rebuilt the v2-to-v3 HTML comparison as a content-only review, excluding requirement-ID suffix additions and the ID-convention metadata from change blocks while retaining genuine wording and product changes.

## 2026-08-03

- Created the initial repository documentation and working agreement.
- Captured the product baseline from the shared DigiStayBook planning document.
- Recorded the Google Drive/GitHub collaboration workflow.
