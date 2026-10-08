# Guest consent: reminders for manual deletion

Implemented and deployed 5 October 2026. This covers guest public-display consent records in `guestConsent`, not marketing consent or other retention classes.

## Rule and action

Keep consent while its memory exists. The proposed handbook retention period ends 24 calendar months after content deletion or final linked dispute closure, whichever is later. This implements reminders against that draft rule; it does not record legal approval.

The worker checks deletion timestamps, completion of associated photo deletion, recorded retention/safety holds, linked content reports and safety cases, and privacy requests linked by post or the guest session's existing report hash. Open reviews/holds block eligibility. Missing references/dates or more than 100 linked records require manual investigation. External or unlinked disputes and backup copies require separate operator checks.

The worker never deletes consent, photos, submissions or cases. It maintains a private `consentDeletionReview/{consentId}` entry with the exact consent path, status, deadline and reason. When a previously reviewed consent document is absent, it records **absence observed**; that is not a claim about who deleted it, when it was deleted, or backup removal.

## Schedule and email

- An hourly Sydney-time scheduler advances persistent cursors over 100 consent records and 100 existing reviews per run. Large collections are scanned over multiple runs; this is not an immediate full-database sweep.
- At 9am Sydney, due entries are reassessed and a reminder log is emitted if any remain due. No email is requested when none are due. Notifications repeat daily while records remain due.
- Cloud Monitoring policy `10989315569745497124` routes matching logs to the existing enabled email channel for **codebertcreations@gmail.com**. The alert has a one-hour minimum interval; the application emits only once per Sydney day.
- The email gives the total due count, the first two exact record paths and deadlines, the retention reason and links to the complete private review list. It contains no guest message, photo or consent wording.
- The email links to the operations page and the Firebase console review collection. Operations access requires the existing admin role and MFA; console access requires project permissions.

Google documents the [log alert label substitution used in the email](https://docs.cloud.google.com/logging/docs/alerting/log-based-alerts).

## Manual procedure

1. Open `/operations`, select **Consent deletion reviews**, and use **Check consent retention** for each due record.
2. Confirm the status remains **due**, the exact path and deadline, and that no unrecorded dispute or legal hold requires retaining it. If a hold exists, retain the record and record `retentionHold: true` on its consent document through an authorised administrative process; the next assessment blocks it.
3. Use **Open exact consent record in Firebase console**. Delete **only** the named `guestConsent` document. This does not authorise deleting the guest submission, photo files, safety cases or audit records.
4. Use **Recheck record after manual deletion**. The server verifies that the consent record is absent and records the operations actor who performed the check. The hourly worker also detects absence, removing the entry from future due emails.
5. Handle controlled backup copies separately under the approved backup schedule. Observing absence in Firestore is not backup-deletion proof.

## Evidence and limits

- Functions build and client typecheck passed. Seven focused tests passed.
- Firestore emulator verified real eligibility records, later dispute closure, open-case and session-privacy holds, unfinished photo deletion, missing evidence, admin/MFA rejection, observed manual removal, cursor progression, 9am reminders and suppression after a new hold.
- `notifyConsentDeletionReview`, `readConsentDeletionReview` and the updated `listSafetyOperations` are ACTIVE. Filtered revision metadata: `consent-reminder-release-metadata-2026-10-05.json`.
- Hosting deployed from the existing scoped release with the updated operations page; fetched live HTML matches that release.
- The live scheduler is ENABLED (`0 * * * *`, Australia/Sydney). A manually requested production run completed, both scan cursors reached the end, and there were zero due/blocked/incomplete review entries in the checked snapshot.
- The enabled email channel and policy were read back. A **TEST ONLY—do not delete anything** matching log was submitted. Inbox receipt and the completed signed-in operations journey remain unverified. Notification logging or policy configuration alone is not proof that email reached the inbox.
- No Firestore consent TTL or automatic consent deletion was enabled. General guest intake remains disabled and legal approval remains unset.

Source: `functions/src/consentRetention.ts`; email template: `docs/consent-deletion-reminder-policy.json`; database verification: `tools/verify-consent-retention.mjs`.
