# Guest contribution delivery — 8 September 2026

> **Supporting reference.** The main current records are [Implementation summary](IMPLEMENTATION_SUMMARY.md) and [Plan deviations and gaps](PLAN_DEVIATIONS_AND_GAPS.md). This document retains the detailed history of its delivery.

Implemented locally against [the authoritative handbook](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html). Unresolved requirements and provisional choices are recorded in the separate [issue register](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/guest-contribution-issues.md), preserving the handbook itself.

## Outputs

| Output | What now works | Handbook alignment |
|---|---|---|
| Guest form | Text, up to ten photos, local preview/removal, progress, per-file/total validation, same-attempt retry, mandatory linked consent and separate private feedback. No guest name/email requested. | §5.3 and §6.3.8; provisional limits/pending presentation recorded in GC-02/GC-08. |
| Server intake | App Check on production write endpoints, anonymous ownership, one-property binding, request fingerprint/idempotency, server timestamps and exact consent evidence in a separate private record. | §§5.3, 5.11, 6.2; production verification and cleanup remain GC-04/GC-06. |
| Safe image path | Server checks real image decoding, pixel/count/byte limits and animation; transforms orientation/size/format and strips metadata. Uploads use private server writes without download tokens. | §5.3; image policy remains C-10/GC-02. Sharp behaviour was checked against its [constructor](https://sharp.pixelplumbing.com/api-constructor/) and [output](https://sharp.pixelplumbing.com/api-output/) documentation. |
| Screening boundary | Unavailable/errors stay pending. Trusted classification routing supports clear, ordinary flag, critical and reject; stale scan results cannot overwrite a new revision. | §5.4; **real provider integration remains GC-01**. No customer screening is claimed. |
| Media publication | Approval copies transformed photos to a separate delivery bucket, removes quarantine copies, and tracks failed cleanup. Public media requests check current visibility and entitlement. | §§5.2–5.4, 5.10; cloud IAM and failed-job execution remain GC-04/GC-05. |
| Guest controls | Own memories survive browser reload. Text editing withdraws public visibility and requeues screening. Deletion hides immediately and records both bucket targets for deletion. Another guest cannot edit/delete them. | §5.3; actual deletion worker, unlimited-history reachability and lost-session request handling remain GC-05–GC-07. |
| Host review | Ordinary screened flags can be previewed and approved/kept off the wall. Unscreened and critical content cannot be manually published. Critical records stay outside the host queue. | §5.4; internal admin UI, alerts and complete paging remain GC-06/GC-09. |
| Private feedback inbox | Separate `/host/property/{id}/feedback` page and navigation entry. Only independently cleared feedback appears; no reply channel or email-content delivery is created. | §§5.2–5.3, 5.5, 6.3.7. Real screening remains GC-01. |
| Guest navigation | Real guest routes no longer include acquisition or host navigation. Policy links sit next to consent; Privacy & Safety remains reachable. | §6.3.1. The linked policy/intake routes remain release gaps GC-03/GC-07. |

## Verification

**Final clean run: `npm run check:all` passed.** The [combined verification log](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/guest-check-all.log) includes both builds, all unit/UI and rules tests, both callable scripts, stale-scan rejection, and host hide/restore/delete synchronisation. A guest edit cannot resurrect a host-deleted memory.

- App typecheck, web build and Functions build pass. The unit/UI suite passes **287 tests**; Firestore/Storage rules pass **32 tests**.
- The actual local callable integration script exercises ten-photo upload, malformed/SVG/oversize rejection, immutable-slot retry, incomplete-upload refusal, duplicate request protection, server consent evidence, per-property identity and different-user denial.
- Trusted adapter tests exercise unavailable/throwing provider, clear/standard/critical classifications, publication, authenticated photo review, private feedback isolation, immediate withdrawal on edit/delete and stale-revision protection. They also verify quarantine-to-delivery movement and absence of the quarantine object after approval.
- At a 390×844 Chromium viewport, the form rendered without horizontal overflow (375px content width). A synthetic text/feedback submission was saved pending; reload recovered its same-session controls; an edit was saved and requeued. Browser automation stalled on the local deletion confirmation, so deletion proof comes from the callable integration test, not a claimed browser success.
- This is local/emulator evidence. No production provider call, physical-phone ten-photo run, real legal acceptance, production attestation, inbox delivery or deployment is claimed. Local Node 24 still differs from the configured deployment runtime Node 22.

Evidence: [unit/UI and builds](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/guest-final-ui-build.log), [rules](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/guest-final-rules.log), [public/moderation callables](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/guest-final-public.log), [guest integration](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/guest-final-integration.log).

Reproduce with `npm run check:all`. This now runs both callable scripts after the rules suite. The scripts enforce demo emulator hosts and create only synthetic records. The new guest script's injected classifications are test fixtures, not an external moderation service.

## Release state

### Account preservation follow-up

Guest actions preserve the signed-in host/account session. Each property's anonymous contribution session uses a separate named Firebase app; anonymous sign-in never uses the default account Auth. A restored registered identity in a guest app is explicitly protected from replacement. Default-app startup now also handles guest-first navigation and concurrent initialisation safely.

Five regression cases cover password/Google account preservation, repeat/concurrent guest actions, restored registered identities, existing anonymous sessions and guest-first startup. `npm run check` passed after this change (typecheck, full unit/UI suite and both builds); evidence is in [the account preservation log](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/account-preservation-check.log). These are local tests with mocked Firebase boundaries, not a production browser sign-in verification. This preserves the handbook's account-free guest flow and property-scoped guest ownership without replacing a host's account; no handbook change is needed.

**Not deployed and not ready for production guest intake.** `GUEST_CONTRIBUTIONS_ENABLED` defaults off outside emulators. The environment example documents the separate buckets and open gates. No provider/account credentials or production resources were created or changed.

The next work is GC-01 (provider/threshold decision and integration), GC-05/GC-07 (retention and privacy/reporting operations), and completion of the proof/configuration gates. The broader billing/QR/export launch work from the earlier review also remains. Existing unrelated workspace edits were preserved; the complete Git diff includes work beyond this delivery.
