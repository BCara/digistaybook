# Storage deletion delivery — 8 September 2026

> **Supporting reference.** The main current records are [Implementation summary](IMPLEMENTATION_SUMMARY.md) and [Plan deviations and gaps](PLAN_DEVIATIONS_AND_GAPS.md). This document retains the detailed history of its delivery.

Authority: [handbook §§5.4 and 5.10](handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html#retention-deletion-backups). This implements the queued media-deletion portion of GC-05; it does not approve retention policy or close the whole issue.

## Delivered locally

- `deleteStoredMedia` is a Firebase scheduled function, every five minutes in Sydney. It processes existing `deletionJobs` and failed `storageCleanup` manifests. Scheduling follows the [Firebase scheduled-functions API](https://firebase.google.com/docs/functions/schedule-functions).
- Deletes named primary objects in both approved private buckets, tolerates already-missing objects and checks that each object is absent before marking completion. A partial failure retries the whole manifest safely.
- Validates every target before the first delete: approved bucket, correct property prefix, valid path and bounded manifest. Legacy paths require an explicitly configured `LEGACY_MEDIA_BUCKET`; no production bucket is guessed.
- Waits five minutes after the request to let existing 120-second upload/publication handlers finish. Transactions claim ten-minute leases; overlapping invocations cannot claim the same live lease, and expired leases recover.
- Retries failures with exponential delay, capped at one hour and eight attempts. Invalid manifests and exhausted attempts require attention. Audit fields and structured logs contain status/codes/IDs, not guest messages, photos or raw provider errors.
- Rechecks submission/post state and safety restrictions. Held jobs remain held until authorised operations resolves the hold; this worker cannot approve a release. Cleanup only removes quarantine paths for media already promoted to the delivery bucket.
- Scans active queues in round-robin pages of 100 per queue per invocation. Held/failed entries cannot permanently hide later work. Completed jobs remain as deletion manifests and are excluded from the scan. Overdue unfinished jobs produce structured error logs against the recorded deadline (or legacy 24/72-hour fallback).
- Host guest-media deletion now records the 72-hour deadline; newly queued quarantine cleanup records property/submission IDs. Old cleanup manifests can recover property identity from the submission.

## Verification

`tools/verify-storage-deletion.mjs` uses only demo Firestore/Storage emulators. It verifies actual two-bucket removal, missing objects, partial failure/retry, hold preservation, cross-property/bucket rejection before any deletion, late-upload settling, overlapping leases, expired lease recovery, exhausted retries, quarantine-only cleanup and traversal beyond 100 jobs. It is included in `npm run check:all`.

The full check passed: 292 unit/UI tests, 32 security-rule tests, both builds and all three integration scripts. A final crash-attempt-limit safeguard was subsequently rebuilt and checked with the deletion emulator script, including refusal to delete a still-visible post.

Evidence: [full verification log](../artifacts/launch-review-2026-09-07/storage-deletion-check-all.log) and [final worker verification](../artifacts/launch-review-2026-09-07/storage-deletion-final.log). This proves local worker behaviour, not cloud scheduler delivery, production IAM or backup erasure.

## Still required before launch

- Deploy and verify the scheduled job, bucket IAM, runtime environment and real monitoring/alert routing. Queue capacity and deadlines require production load evidence; logs alone are not delivered alerts.
- Confirm object versioning, soft-delete retention and backup expiry; reapply manifests before restoration. Primary-object absence does not prove all historical copies are erased.
- Implement abandoned uploads, timed-out processing, rejected-content expiry, property draft/dormancy schedules, consent/session expiry and scoped safety-hold review/release. These are separate policies/workflows, not inferred deletions.
- Add authorised operations tooling for held/failed jobs and restore handling. Do not manually reset a held job without resolving its source hold and recording the decision.

Not deployed. Production guest intake remains disabled by default. The handbook is unchanged; GC-05 remains open with this partial delivery recorded.
