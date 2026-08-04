# Initial backlog

## Discovery and foundations

- [ ] Confirm the first release surface and deployment target.
- [ ] Choose the application framework and hosting architecture.
- [ ] Define the data model for hosts, properties, posts, moderation states, and subscriptions.
- [ ] Define authentication and role boundaries.
- [ ] Define privacy, retention, deletion, and trust-and-safety acceptance criteria.
- [x] Draft the provisional data-class retention matrix and lifecycle alignment. (`DSB-BOP-P8-005`)
- [ ] Obtain product/legal approval for D-004 durations before implementing production deletion schedules. (`DSB-BOP-P8-005`, `DSB-BOP-P8-010`)
- [ ] Implement deletion manifests, content-free deletion audit events, retries/failure alerts, scoped legal holds, and restore-time reapplication. (`DSB-BOP-P8-005`)
- [ ] Implement the public Privacy & Safety route, auditable request status, 14-day escalation, and separation from booking/property support. (`DSB-BOP-P6-008`, `DSB-BOP-P8-003`, `DSB-BOP-P8-009`)
- [ ] Map controller, processor, sub-processor, retention, access, and deletion responsibilities for every stored data class. (`DSB-BOP-P8-003`, `DSB-BOP-P8-004`, `DSB-BOP-P8-005`)
- [ ] Obtain and record professional legal approval for the Terms, Privacy Policy, consent, age rule, moderation, liability, deletion, retention, and vendor-role wording before publication. (`DSB-BOP-P8-010`)

## Guest experience

- [ ] Build a mobile-first public wall. (`DSB-BOP-P2-004`, `DSB-BOP-P6-009`)
- [ ] Add guest text and multi-image submission. (`DSB-BOP-P2-004`)
- [ ] Add consent, pending, report, edit, delete, and copy-text flows. (`DSB-BOP-P2-004`, `DSB-BOP-P2-005`)
- [ ] Implement the D-005 transactional reporting endpoint, App Check verification, report deduplication, reporter/wall thresholds, state transitions, Host/internal alerts, restoration rules and abuse-key expiry tests. (`DSB-BOP-P2-005`)

## Host experience

- [ ] Build account and property setup. (`DSB-BOP-P3-003`, `DSB-BOP-P6-003`, `DSB-BOP-P6-005`)
- [ ] Build sandbox and live wall preview. (`DSB-BOP-P2-001`, `DSB-BOP-P2-002`)
- [ ] Add post moderation, pinning, foundational posts, and house information. (`DSB-BOP-P1-006`, `DSB-BOP-P1-007`, `DSB-BOP-P6-005`)
- [ ] Generate and deliver QR assets after activation. (`DSB-BOP-P2-003`, `DSB-BOP-P4-002`)

## Commercial operations

- [ ] Define Stripe trial, monthly, annual, coupon, renewal, failure, grace-period, and cancellation flows. (`DSB-BOP-P3-004`, `DSB-BOP-P7-003`)
- [ ] Define transactional email triggers and templates. (`DSB-BOP-P4-001`, `DSB-BOP-P4-002`, `DSB-BOP-P9-001` to `DSB-BOP-P9-006`)
- [ ] Implement D-006 versioned consent evidence, central suppression, send-time fail-closed checks, email classification enforcement and promotional-content linting for transactional templates. (`DSB-BOP-P4-001`, `DSB-BOP-P8-001`)
- [ ] Test unticked, withdrawn, suppressed, missing-preference-service and deleted-account marketing-send prevention before enabling any campaign. (`DSB-BOP-P4-001`)
- [ ] Add automated test coverage for activation and billing state transitions. (`DSB-BOP-P3-004`, `DSB-BOP-P4-002`)
