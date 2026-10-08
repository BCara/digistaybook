# Daily screening allowance

Owner authorised 100 screening attempts per day and an email warning at 75
attempts (25 remaining), on 2 October 2026.

- One allowance across the deployed project, resetting at midnight in
  Australia/Sydney, including daylight saving.
- New memories, edits, retries and private feedback share the allowance.
  A memory with up to ten photos counts as one attempt. Failed provider calls
  count too. Reserved photo checks and text units are also recorded, without
  guest content, in server-only `screeningDailyUsage/YYYY-MM-DD` documents.
- A Firestore transaction reserves capacity before provider calls. Above 100,
  memories stay pending and private. Feedback waits for screening before host
  delivery. The five-minute retry worker resumes deferred items when capacity
  returns. Waiting for capacity does not consume the retry failure allowance.
- At 75 attempts a structured `screening_daily_warning` log is emitted. The
  scheduled notifier re-emits while above the threshold for recovery. Email
  requires a Cloud Monitoring log alert and an email notification channel;
  use 24-hour repeat suppression. The enabled policy is
  `projects/digistaybook-cbert/alertPolicies/4289082800575168349`; its enabled
  email channel sends to `codebertcreations@gmail.com`. Configuration was read
  back from Cloud Monitoring; inbox delivery has not yet been verified.
- This daily count limits provider attempts, not total cloud spend. Uploads,
  storage, delivery and background work have separate costs. Monthly A$1 and
  A$5 screening billing warnings are configured separately and now also use
  this email channel.
- Guest intake remains disabled pending the existing legal and launch gates.

Deployment: `finishGuestContribution`, `changeGuestContribution`,
`retryPendingScreening` and `notifyScreeningAllowance` deployed successfully.
The new notification schedule is enabled every five minutes. The live guest
contribution switch remains false.

Validation: Functions build and 123 Functions tests passed;
budget tests cover concurrent admission, the 75-attempt warning, shared feedback
capacity and Sydney day boundaries. Email delivery and real guest submissions
are not verified by these tests.
