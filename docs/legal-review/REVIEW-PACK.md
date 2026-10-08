# DigiStayBook review pack — 2 October 2026

The complete shareable pack is [DigiStayBook-reviewer-pack-2026-10-02.zip](DigiStayBook-reviewer-pack-2026-10-02.zip).
Start with its [21-page review document](reviewer-pack-2026-10-02/DigiStayBook-review-pack.pdf).
It contains the full draft wording, processing inventory, decision register,
reviewer response and approval forms. The ZIP includes 35 files with exact source
snapshots, live bucket/function metadata, the operating handbook, a reviewer cover
note and a checksum manifest. The owner confirmed they are the operator and
privacy/safety handler; legal identity/address details remain pending.

Prepared for qualified counsel review. This pack is not legal approval and does
not authorise guest intake. The appended source snapshots are the exact current
drafts, not a claim about which Hosting version is live.

## Requested review

Please review the appended Host Terms, Guest Terms, Privacy Policy and consent
wording against the actual operator, Google account agreements, processing flow
and operating policies below. Provide amendments and explicit approval of the
final versions; identify issues that prevent public guest intake.

## Current versions and source

| Document | Version | Source/route |
|---|---|---|
| Host Terms | draft-2026-08-04 | src/ui/pages/legal/documents.ts; /terms |
| Guest Terms | draft-2026-10-02 | same source; /guest-terms |
| Privacy | draft-2026-10-02 | same source; /privacy |
| Consent | handbook-5.3-draft-v3 | functions/src/legal.ts |
| Privacy & Safety reporting flow | unversioned UI | src/ui/pages/PrivacySafetyPage.tsx; /privacy-safety |

## Factual processing flow

Guests access a property using its QR/stay link and a property-specific anonymous
Firebase session. Public memories and private feedback are separate submissions.
Messages/feedback are limited to 1,200 characters. Memories allow up to ten
JPEG/PNG/WebP photos, 5 MiB each, 25 MiB total and 40 megapixels; photos are rotated,
metadata-stripped and transformed to WebP within 2000×2000. These image limits
remain provisional; HEIC and real-phone experience require confirmation.

Guest photos are stored in private quarantine/delivery buckets configured for
Sydney. Transformed photo bytes are sent synchronously to Google Vision
SafeSearch through its EU endpoint; text uses Google's Australia Natural
Language endpoint. The selected EU route is not an exclusive-region contractual
guarantee. The actual accepted account terms, processor/subprocessor roles and
overseas safeguards must be reviewed, not inferred from endpoint location.

Clear memories can publish; uncertain provider results or public text contact
details/links go to host review. Provider failures leave public memories private.
Safety cases have restricted access. Private feedback never appears publicly;
specified threat/sexual/derogatory/weapons categories can be held for the safety
team. The existing feedback provider-outage fallback delivers to the host;
daily-budget exhaustion instead defers delivery. Review this difference explicitly.

Public photos are served through state-checking endpoints rather than permanent
download tokens. Guest deletion hides a memory immediately and queues media
deletion. Live runtime access, cleanup deadlines and device behaviour still need
verification. The 100/day allowance is project-wide, resets at Sydney midnight
and alerts operations at 75. It is not a complete storage/spend/abuse control.

## Decisions and evidence required

| Item | Required answer/evidence | Current status |
|---|---|---|
| Operator | Legal entity/name, jurisdiction, business identifiers, service/contact address | Owner confirmation required; do not infer from email brand |
| Contacts | Approved support, privacy and incident contacts; staffed review owner | Operations warning email is codebertcreations@gmail.com; legal contact designation not confirmed |
| Google agreement | Accepted agreement/version, account entity, DPA/subprocessors and overseas disclosures | Account-specific evidence required |
| Minors | Review 16+ declaration, photos of other people/minors, consent authority and response workflow | Open |
| Publication | Rights/licence, visibility, third-party photo consent and takedown rules | Draft review required |
| Retention | Abandoned uploads, rejected content, feedback, safety holds and anonymous-account expiry | Schedules/ownership incomplete |
| Deletion/recovery | Primary deletion within 72h, quarantine cleanup within 24h, seven-day bucket recovery, backup manifests/restore exclusions | Live proof and policy approval open |
| Other schedules | Source declares 90-day routine logs, 30-day backup expiry after deletion, 24-month consent evidence and five-year accounting records | Declared values are not proof of enforced schedules or legal suitability |
| Review/reporting | 14-day report/privacy escalation, 30-day held-feedback review, MFA/audits, urgent incident response | Live operations/staffing proof required |
| Billing | Trial, renewals, cancellation/refunds and Australian consumer wording | Review actual current commercial flow against Host Terms |
| Screening | Thresholds, accuracy limitations, appeals/review wording and outage handling | Calibration and final wording open |

## Approval and implementation record

Reviewer/firm: PENDING. Review date: PENDING. Approved versions: PENDING.
Required amendments: PENDING. Unresolved blockers: PENDING.

After final approval: apply amendments consistently, version all approved texts,
remove draft notices, record reviewer/date/exact versions in
`functions/src/legal.ts`, synchronise handbook/NAS copies, deploy and check the
actual guest pages and consent records. Do not populate approval with an owner
placeholder or enable intake merely because this pack exists.

Supporting records: ../guest-contribution-issues.md,
../image-screening-provider-review-2026-10-02.md,
../screening-daily-allowance-2026-10-02.md and ../../src/domain/retention.ts.
