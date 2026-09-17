# Launch fixes — 7 September 2026

> **Supporting reference.** The main current records are [Implementation summary](IMPLEMENTATION_SUMMARY.md) and [Plan deviations and gaps](PLAN_DEVIATIONS_AND_GAPS.md). This document retains the detailed history of its delivery.

**Next delivery:** [guest contribution implementation and verification — 8 September](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/guest-contribution-delivery-2026-09-08.md), with a separate [handbook issue register](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/guest-contribution-issues.md). The remaining-work list below describes the earlier implementation pass.

Baseline: [the authoritative handbook](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html) and [the launch review](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/launch-readiness-review-2026-09-07.md).

This is the first implementation pass. Changes are local, uncommitted and not deployed. It does not complete the handbook or make the product ready for real guests or payments. Existing and concurrent application edits were preserved; the full workspace diff contains work beyond this pass.

## What changed

| Area | Implemented change | Remaining boundary |
|---|---|---|
| Saving appearance | `savePropertyProfile` now writes theme and wall-off settings as well as text, without overwriting independently saved photos. A regression checks the actual update fields. | Browser save/reload against the new backend should still be repeated before release. |
| Public access | Raw property and post documents are no longer publicly readable. `getPublicWall` selects explicit public text fields and returns only visible posts. Both real wall routes call it; only the named demo route uses fixtures. Missing/duplicate slugs and unavailable properties fail closed. | This is an initial text-only wall. Complete safe media delivery, house-information presentation, theme/layout parity, pinning and guest contribution. Slugs still need server-owned unique reservation. |
| Paging | Public memories load in pages of 25, newest first, with a Load more control and duplicate filtering. A required posts index is included. | Host moderation still has the old 200-post limit; unresolved work needs its own paginated query and UI. |
| Cancellation and visibility | Domain access checks, Storage rules and public callable preserve cancelled access only until a valid future `serviceEndsAt`; missing/expired dates fail closed. Wall-off is checked by the public callable and Storage rules. QR eligibility includes an entitled grace period. | Billing integration must write a trusted Firestore Timestamp to `serviceEndsAt`; existing cancellation records need a reviewed migration. This does not implement Stripe or revoke previously issued download-token URLs. |
| Client writes | Property creation rejects injected billing/retention/unknown fields and nonzero foundational counts. Updates allow only name/profile/update time; ownership, mode, lifecycle, counts and entitlement deadline are server-owned. | Complete nested schema constraints, trusted activation and unique slug reservation. |
| Restricted moderation | Ordinary hosts cannot directly read restricted posts or query all posts. The host query explicitly selects permitted states. The callable denies restricted content even on a replay/readback. | Build the separate MFA-protected operations surface and the complete intake/escalation process. |
| Moderation retries | A reused request identifier must match its original actor, action and post. Internal job/case IDs are scoped to property and request. Restoration refuses posts with recorded open reports or a safety restriction. | The future reporting service must maintain these fields transactionally; the complete reporting state machine is still required. |
| Deletion targets | Deleting a post preserves recognised property-owned photo paths in a private pending job before clearing the photo fields. Repeat deletion is idempotent. | No deletion worker yet. Pending jobs do not prove deletion. Legacy URL-only references, derivatives, caches, backup expiry and the full retention matrix still need handling. |
| Test/accessibility setup | Shared setup no longer references `Element` in Node-only Storage tests. jsdom models native dialog visibility; the consent test opens the dialog. The guest dialog has an accessible name. | Native focus, screen readers and physical phones still require verification. Concurrent wall-layout work removed the previously visible JSX comment; that work is not attributed to this pass. |

Customer-visible read states include loading, unavailable, connection failure, retry, empty wall and more memories. The current real wall explicitly says contributions are not yet available rather than accepting a submission that is never sent.

## Verification

**Final result: `npm run check:all` passed — 283 unit/UI tests, 30 Firestore/Storage rules tests, app typecheck, web/Functions builds and both callable integration check groups.**

The reusable `npm run check:all` now includes app typechecking, unit/UI tests, web and Functions builds, Firestore/Storage rules, and a real local callable test. `tools/verify-public-wall.mjs` refuses to run without the expected demo emulator hosts and writes only synthetic local records.

The callable checks cover actual response field exclusion, 27 posts across two pages, missing properties, future/expired cancellation, wall-off, authenticated moderation, repeated deletion, preserved deletion paths, reused-request rejection, restricted-content denial and open-report restoration denial. App Check is deliberately relaxed only in the Functions emulator; this is not production attestation evidence.

Final execution results are recorded in [fix-final-check.log](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/fix-final-check.log). Local runtime is Node 24 while deployment specifies Node 22; repeat release checks on Node 22. Build still reports the large Firebase chunk warning.

## What still needs working on

1. **Complete the guest loop:** media/quarantine, ten-photo uploads, consent records, anonymous ownership, screening, private feedback, self-edit/delete/report and polished mobile rendering. Select moderation provider and confirm upload limits/thresholds from the handbook.
2. **Complete paid activation:** verified accounts, Stripe plans/trial/coupon, signature-verified idempotent webhooks, payment recovery, renewal, cancellation, refunds and a printable/downloadable QR kit on the permanent domain. Confirm prices, tax presentation and fair-use economics.
3. **Finish privacy and operations:** working Privacy & Safety and host support, internal MFA/roles/queues, 14-day escalation, export, deletion workers/manifests, retention/backup restoration and legal holds. Select operators and complete the handbook's policy review gate.
4. **Implement communications:** selected provider/domain, transactional templates and real-inbox delivery; separate marketing consent, unsubscribe and durable suppression with fail-closed sending. No marketing sequences enabled by this pass.
5. **Finish launch usability and delivery:** ten licensed demo posts and foundational seeding, missing pricing/FAQ/account/help routes, consistent save/unsaved-edit behaviour, accessible controls, printed-QR and poor-connection phone testing, isolated preview environment, monitoring/budget alerts and operational checklists.
6. **Reconcile documentation:** migrate remaining old requirement references to handbook sections and update the status ledger from current evidence. Resolve or record the Functions dependency risk; no forced dependency downgrade was applied.

The next implementation priority is the screened guest submission and privacy workflow, followed by paid activation. This pass improves security and truthful behaviour but leaves substantial backend/product work; it should not be presented as a finished release.

## Deployment considerations

Do not deploy Hosting alone for these changes. The frontend now depends on `getPublicWall`; deploy the compatible Functions, posts index and rules with the corresponding build in an isolated preview environment first. Verify the callable there, then exercise all affected host queries under the tightened rules. Existing public raw-document clients will be denied intentionally. No cloud rules, customer records, provider accounts or live subscriptions were changed in this pass.
