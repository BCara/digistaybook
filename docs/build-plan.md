# DigiStayBook implementation plan

## Authority, autonomy and continuity

`digistaybook_WIP_v3.md` is the product and commercial authority. Every implementation item cites one or more permanent BOP IDs. DigiGuestbook may be inspected only as an architectural precedent; its pricing, project IDs, customer data, schema and legacy exceptions do not become DigiStayBook requirements.

Implementation proceeds without routine human approval. Safe local choices are recorded in `docs/decisions.md`. Work continues around unavailable credentials, vendor accounts, legal approval or deployment access; those gates block only the affected live integration or release, not unrelated local implementation.

The restart authority is `docs/implementation-status.json`. A task is not “implemented” merely because it appears in code: it must have an evidence path and a verification command. Each meaningful batch ends with a status-ledger update and a Git commit so an interrupted session can resume from the last recorded checkpoint.

## Chosen architecture

- React, TypeScript and Vite for the mobile-first web application.
- A small pathname router for the current public, Host and legal routes; introduce a routing dependency only when route complexity justifies it.
- Firebase Authentication for Hosts; Guests do not require accounts.
- Cloud Firestore and Cloud Storage behind default-deny rules.
- Cloud Functions for privileged reporting, moderation, billing, email, retention and deletion workflows.
- Firebase Emulator Suite for local security and integration tests.
- Stripe adapter boundary for subscription billing; no client-owned entitlement state.
- Provider-neutral email adapter with transactional/marketing classification enforced before delivery.
- Vitest for domain and UI tests, plus typecheck/build/status-validation gates.

Package versions are fixed by the committed lockfile. Production project IDs, secrets and credentials are never committed.

## Workstreams

| Workstream | BOP authority | First executable slice | Completion gate |
|---|---|---|---|
| `WS-00` Delivery control | All BOP IDs; D-008 | Status ledger, BOP-reference validator, resume instructions and checkpoint commits | Every task has state, evidence and verification; restart procedure passes |
| `WS-10` Platform foundation | `DSB-BOP-P2-001`, `DSB-BOP-P3-003`, `DSB-BOP-P6-003` to `DSB-BOP-P6-005` | React/Vite/TypeScript application, routes, Firebase boundaries, emulator config and default-deny rules | Clean install, typecheck, unit tests and production build pass |
| `WS-20` Guest experience | `DSB-BOP-P2-003` to `DSB-BOP-P2-005`, `DSB-BOP-P6-009` | Public wall route, approved-post view, consent-aware contribution model and self-service ownership contract | Mobile UI tests plus emulator rules tests cover read/create/edit/delete boundaries |
| `WS-30` Host experience | `DSB-BOP-P2-001`, `DSB-BOP-P2-002`, `DSB-BOP-P6-004`, `DSB-BOP-P6-005` | Auth-gated Host shell, property setup model, sandbox/live separation and moderation queue | Auth/profile/property tests and Host route tests pass |
| `WS-40` Trust and safety | `DSB-BOP-P2-005`, `DSB-BOP-P4-005`, `DSB-BOP-P9-002` | Server-owned reporting state machine, circuit breakers, neutral outcomes and restoration contract | Threshold, deduplication, visibility and escalation tests pass |
| `WS-50` Commercial and communications | `DSB-BOP-P3-004`, `DSB-BOP-P4-001` to `DSB-BOP-P4-004`, `DSB-BOP-P9-001` to `DSB-BOP-P9-006` | Billing state machine, email catalogue, consent evidence, suppression checks and adapter boundaries | Transition, idempotency, classification and suppression tests pass |
| `WS-60` Privacy and retention | `DSB-BOP-P6-008`, `DSB-BOP-P8-001` to `DSB-BOP-P8-010` | Public Privacy & Safety route, data-class retention policy, deletion manifest and legal-hold model | Retention/deletion tests and privacy-request escalation tests pass |
| `WS-70` Quality and release | All implemented BOP IDs | CI, status validation, security baselines, accessibility checks and evidence levels | CI is green; local, emulator, deployed and manual evidence remain explicitly separated |
| `WS-80` Post-MVP guardrails | `DSB-BOP-P5-001` to `DSB-BOP-P5-005` | Typed feature-flag registry and policy constraints, with every feature disabled by default | No post-MVP route or workflow is reachable until its own approval and test gate passes |

## Delivery sequence

### Milestone A: executable foundation

Start every workstream with contracts, routes, state machines, rules, tests and explicit feature gates. This is the current milestone. It creates a compiling application skeleton and makes policy conflicts visible before external integrations are connected.

### Milestone B: local vertical slice

Connect the Host property setup, public Guest Wall, contribution consent, reporting, Host moderation and Privacy & Safety request flows to Firebase emulators. Implement ownership proofs and default-deny rules before accepting media.

### Milestone C: commercial and lifecycle slice

Connect Stripe test-mode webhooks and the email adapter. Implement idempotent billing transitions, suppression enforcement, receipts, cancellation/dormancy and reactivation. External provider credentials may remain absent while adapter and contract tests run locally.

### Milestone D: operational completeness

Add QR kit generation, media processing, deletion jobs, backup/deletion manifests, security event delivery, monitoring and restricted admin queues. Complete emulator and failure-recovery coverage.

### Milestone E: release evidence

Run accessibility, responsive browser, security, emulator and integration suites. Deploy only after the legal-review gate, production configuration validation and exact environment evidence are recorded. A successful local build is never treated as deployment or live QA.

## Status rules

- `not_started`: no implementation artifact exists.
- `started`: a scoped artifact or contract exists, but the first slice is not yet verified.
- `in_progress`: implementation is actively expanding from a verified first slice.
- `verified`: the defined completion gate passes with recorded evidence.
- `blocked`: only the affected external/live gate cannot proceed; the reason and next unblocked work are recorded.
- `deferred`: intentionally outside the current MVP, with a guardrail preventing accidental exposure.

## Resume procedure

1. Run `git status --short` and preserve unrelated files.
2. Read `docs/implementation-status.md` for the human checkpoint.
3. Run `node tools/verify-implementation-status.mjs` against the JSON authority.
4. Run the verification commands listed for the active tasks.
5. Continue the lowest-numbered active task whose dependencies are satisfied.
6. Update both status files and commit before moving to the next meaningful batch.
