# Guest screening and review — 5 October 2026

Owner requested the review switch, complete memory-case controls, serious-photo
routing and deployment. These routing thresholds are provisional; provider
accuracy and false positives still require representative calibration. Nothing
is automatically rejected or reported to authorities.

## Memory decisions

1. Save the message and transformed photos privately and complete text/photo
   screening. An incomplete check cannot publish anything.
2. A serious text or photo flag takes priority and opens a restricted safety
   case. Ordinary hosts cannot read or approve its restricted content.
3. Other flags go to host review: the memory stays off the public wall.
4. A clear memory also goes to host review if the property switch **Review
   content before publication** is selected. The owning host changes this
   setting in the property's moderation/guest review panel. It defaults to off
   for existing properties without a stored preference.
5. Clear memories can publish automatically with that switch off, subject to
   the property, submission revision, reports and safety-state checks.
6. Switching review off does not publish items already waiting. The host must
   approve those individually. Published memories are not retroactively hidden.

## Less serious and serious flags

| Signal | Route |
|---|---|
| Profanity, Insult, Toxic or another text-category flag at confidence >= 0.8, without a serious category | Host review for memories; ordinary private complaints still reach the host inbox |
| Public memory containing an email, phone number or external link after a completed scan | Host review |
| Violent, Sexual, Derogatory or Firearms & Weapons text at confidence >= 0.8 | Restricted safety review in both routes |
| Photo adult or violence likelihood LIKELY or VERY_LIKELY | Restricted safety review |
| Photo medical or racy likelihood LIKELY or VERY_LIKELY, without an adult/violence safety flag | Host review |
| Lower photo likelihoods, or spoof alone | No hold from that image signal; other checks still apply |

For example, a profane complaint without a threat is ordinary host handling;
a threat, hate signal or sexual-content flag can be a safety case. These are
provider category rules, not a reliable scale of how bad a word or image is.
Benign incidents, historical references, medical images and swimwear can be
misclassified. A flag requires human review rather than irreversible rejection.

Google defines the image categories and likelihood scale in its
[SafeSearch API reference](https://docs.cloud.google.com/vision/docs/reference/rest/v1/AnnotateImageResponse#safesearchannotation).
The destination mapping above is DigiStayBook's policy. It does not detect age,
establish consent, identify every illegal image, or inspect text/contact details
inside an image. There is no regional fallback and photo storage stays in the
existing private guest-photo buckets.

## Restricted memory review

- Opening messages and individual photos requires an operations admin account
  with MFA. Each opening records the actor and case reference in the audit.
  Photo bytes are served through the authorised callable, without download tokens.
- **Release to host:** clears the safety hold and sends the unchanged revision
  to ordinary host review. It does not publish the memory. If the guest edited
  the message while held, release queues the new revision for fresh screening.
- **Delete memory:** hides the post, clears its message and queues deletion of
  both quarantine and delivery photo objects. Case message/photo references
  are cleared, and the decision is audited. The primary deletion job has the
  existing 72-hour due date; bucket recovery and backup retention are separate.
- A guest-withdrawn memory cannot be released. Operations can resolve its
  existing safety hold by deletion so the previously held deletion can proceed.
- Case photos cannot be fetched after release or deletion. Existing external
  copies, including screenshots, cannot be revoked by this check.

## Private feedback and incomplete checks

Clear feedback and ordinary complaints are delivered privately to the host.
Serious text flags are withheld in restricted safety cases. Provider failure or
capacity exhaustion keeps feedback undelivered and memories unpublished.
The worker retries with backoff; eight failed worker attempts raise an
operations alert. Waiting for daily capacity does not consume that retry count.
The warning outbox is recorded; it is not proof of email delivery or staffing.

## Verification and release record

- Local full check: 606 tests passed, 1 skipped; typecheck, client build and
  Functions build passed. Archived review-pack source tests are excluded from
  the application's test discovery.
- Emulator: passed. Verified the owner-only review switch, clear-content hold,
  serious-photo priority, MFA/audited message and photo access, release without
  publication, changed-revision rescreening and deletion after guest withdrawal.
- Deployed nine selected Functions in Sydney on 5 October, including new
  `setGuestReviewPolicy` and `readSafetyCasePhoto`. All are ACTIVE under the
  dedicated runtime account. `finishGuestContribution` is now revision
  `finishguestcontribution-00017-piv`; the complete selected metadata is in
  `guest-review-release-metadata-2026-10-05.json`.
- Deployed the frontend from HEAD plus the two changed UI components. The
  unrelated billing edits were excluded. Live hosting HTML matches that build.
- Live unauthenticated calls to the setting and safety case/photo endpoints
  returned 401 UNAUTHENTICATED. This proves denial, not successful reviewer
  access or classification quality.
- General intake remains off (`GUEST_CONTRIBUTIONS_ENABLED=false`) and legal
  approval remains null. The existing property test exception and its
  9 October expiry are preserved; no new test properties were enabled.
- Remaining release evidence: real provider calibration, device journeys,
  reviewer MFA/staffing, email receipt, legal sign-off and production deletion
  deadlines. Local tests and deployed configuration are separate evidence.


## 6 October policy superseding incomplete-screening retries

Incomplete memory or feedback screening opens a restricted safety-review case tagged Screening incomplete, with the failure reason visible to the reviewer. Memories stay unpublished and feedback stays undelivered until review. Automatic retries cannot bypass an open case. Implemented and verified locally; live deployment and verification pending. Operating plan section 5.4 is the policy reference.


## Final product decision status — 6 October 2026

Guest experience and screening decisions are final for testing, confirmed by the owner on 6 October 2026. Retain current behaviour and thresholds, with incomplete screening routed to restricted safety review tagged Screening incomplete and the reason visible to the reviewer. Reopen a decision only if testing finds an issue. Operating plan sections 5.3, 5.4 and 6.3.8 are the policy reference; this pack records review and verification work, not a second set of product decisions. Legal wording approval, deployment and live evidence remain separately tracked.
