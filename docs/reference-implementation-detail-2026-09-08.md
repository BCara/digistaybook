> Supporting reference only. Use [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for current progress. This preserves the detailed record before simplification.

# DigiStayBook — implementation summary and plan

**Main implementation record · Updated 8 September 2026**

## Progress at a glance

**The main guest and host features have been built and checked locally. The app is not live or ready for public launch yet.** “Built locally” means the code is in this project; it does not mean customers can use it on the hosted app.

| Area | What has been implemented, in everyday language | Progress |
|---|---|---|
| Guestbook | Guests can open a real property wall, add messages and photos, and return to edit or delete their own memories. | Built locally; real screening and phone checks still needed. |
| Staying signed in | A signed-in host keeps their account when using guest actions. | Local tests passed; hosted browser check still needed. |
| Host tools | Hosts can review memories, read private feedback and load older items. | Built locally; full safety-team workflow still needed. |
| Reporting a problem | Guests can report a memory or submit a privacy request. Hosts can review ordinary reports. | Partly complete; identity checks, responses and delivered alerts remain. |
| Property setup | Property addresses are reserved uniquely. Cover images, themes, writing prompts and optional shared house information are supported. | Built locally; final layout, setup and QR checks remain. |
| Taking a copy | Hosts can download ZIP parts with messages, supported guest photos and a readable offline copy. | Built locally; older-photo coverage and browser downloads still need work. |
| Protecting and deleting content | Private records are protected; queued photo files can be deleted; open safety cases cannot be automatically republished. | Local checks passed; complete retention and cloud checks remain. |
| Launch | Local automated tests and builds passed. | Not deployed. Providers, policies, operating arrangements and preview checks remain. |

## What still needs to happen

1. Choose and connect content screening and email services, then check real results and email delivery.
2. Finish privacy/safety handling, retention schedules, support and billing verification.
3. Finish the remaining guest experience and export coverage, and test them in browsers and on phones.
4. Supply the business details and final policies, then verify the isolated hosted preview before public launch.

The detailed implementation plan below keeps each outstanding item and its original tracking ID. No percentage is given because completed code and verified launch readiness are different measures.

Use this document for **progress, what was built, what it does and what remains**. Use [differences from the skeleton](PLAN_DEVIATIONS_AND_GAPS.md) for **what behaves differently from the original plan and which choices need agreement**.

The skeleton is the original [Business & Operating Plan](handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html). It remains unchanged. This record covers work delivered in this task on 7–8 September; unrelated or concurrent work must be checked separately before being counted here.

## Everything implemented in this delivery

### Completion pass in progress — 8 September

The user has requested the remaining work and authorised isolated preview testing. Current additions (local, not deployed):

- Load more for guest history, host review, private feedback and legacy moderation; status-first guest review queries prevent closed records hiding unresolved submissions.
- A Report memory action, transactional report intake, per-session/post duplicate handling, cooldowns, neutral acknowledgements, host report review and guarded dismissal/deletion. Multiple open reports prevent premature restoration.
- A connected Privacy & Safety intake form with private, idempotent request storage and deadline escalation to an internal alert queue. Intake is not proof of identity verification or email delivery.
- A staff operations overview guarded on the server by the admin claim **and** an MFA sign-in claim. The overview excludes restricted media and messages. Full case-resolution tooling and staff onboarding remain.
- A scheduled, leased screening retry worker with backoff, revision guards and escalation after eight unsuccessful attempts. The provider is still unselected; unavailable screening cannot publish content.
- A pending-confirmation dialog, public cover/theme rendering, host writing-prompt selection and an explicit opt-in for publishing previously private-labelled house guidance through shared links.
- Host ZIP export under **Export guestbook**, containing messages.json, actual supported guest photo files and an escaped offline HTML copy. Three records are checked per part; failures retain the current part for retry and cancellation prevents download. Server ownership and current safety/visibility checks apply to every photo.
- Open safety cases cannot be republished by a later edit/screening pass.
- Server-controlled draft creation and unique address reservation in one transaction, with safe retries and legacy-address collision checks. Direct browser property creation is denied.

Recorded checks so far: [pagination server checks](../artifacts/launch-review-2026-09-07/pagination-server.log), [reporting checks](../artifacts/launch-review-2026-09-07/reporting-server.log). Combined checks for the expanded pass are in [app checks](../artifacts/launch-review-2026-09-07/completion-check.log) and [server checks](../artifacts/launch-review-2026-09-07/completion-server.log); both passed. Export-specific verification is recorded in [export app checks](../artifacts/launch-review-2026-09-07/export-check.log), [ZIP round-trip test](../artifacts/launch-review-2026-09-07/export-archive-test.log) and [isolated export/report checks](../artifacts/launch-review-2026-09-07/export-isolated-server.log). Browser download and phone evidence are still pending.

The detailed inventory below includes the earlier delivery. The additions above extend it; all deployment and verification limits still apply.

“Implemented” below means local code exists and has the verification described later. It does not mean deployed or approved for launch.

| Area | What changed, in plain English | Boundary / outstanding item |
|---|---|---|
| Saving appearance | Saving a property now saves its theme and wall-off setting alongside its text, without overwriting separately saved photos. | Fresh browser/second-device save-and-reload proof remains. |
| Real guest walls | Real property addresses load the matching property's permitted data and memories. Only the explicit demo uses sample content. Missing, duplicate, disabled and expired properties show unavailable states. | Address reservation and opt-in house information are now implemented locally; full design parity remains. |
| Wall navigation and messages | Real guest routes have their own guest presentation. Loading, empty, unavailable, connection-error, retry and more-memories states are provided. | Complete phone/accessibility review remains. |
| Loading more memories | Public memories load 25 at a time, newest first, with a Load more control and duplicate filtering. The required posts index is included. | Host review, feedback, guest history and legacy moderation now also have Load more controls. |
| Public/private data | Public visitors cannot read raw property/post records. A server endpoint returns only explicitly permitted public fields; billing and restricted data are excluded. | Production rules and cloud access must still be verified. |
| Protected account/property fields | Client writes cannot inject billing/retention fields, set foundational counts or alter server-owned ownership, lifecycle and entitlement fields. | Server draft validation and address reservation now exist; activation still needs end-to-end verification. |
| Cancellation access | Cancelled properties retain permitted access only until a valid future service-end time. Missing/expired dates fail closed. Wall-off and entitlement checks apply to public access; QR eligibility recognises the entitled period. | This is the access safeguard, not a completed billing integration. |
| Guest contribution form | Guests can submit a message and/or up to ten photos, preview/remove selected photos, see upload progress and retry failures. Separate private feedback can accompany the contribution. No guest name or email is requested. | Image limits are provisional; unfinished files do not survive closing the browser. |
| Reliable guest submission | Server-side ownership, property binding, request matching, timestamps and upload-slot checks prevent cross-property edits and duplicate retries. New attempts have a per-session rate limit. Production contribution endpoints declare App Check enforcement. | Stronger abuse controls and real App Check proof remain. |
| Consent evidence | The form links the policies and requires acceptance. The server stores the exact consent wording/version and acceptance time in a separate private record. | Wording is the handbook draft; legal review and finished policy pages remain. |
| Photo processing | The server checks actual image decoding, format, size, pixel count and animation; corrects orientation; resizes/converts images and strips metadata. Uploads go into private quarantine without permanent download tokens. | The supported formats and transformation limits need approval and phone testing. |
| Screening workflow | Code routes clear, ordinary-flagged, critical, rejected and unavailable screening outcomes. Unavailable screening stays private; old results cannot publish a newer edit. | **No real screening provider is connected.** Test classifications do not prove real moderation. |
| Approved photo delivery | Approved images move to a separate delivery bucket. The public photo endpoint checks current visibility and entitlement, uses no-store responses and avoids permanent download tokens. Quarantine cleanup is attempted after approval. | Production bucket permissions and historic media links remain separate checks. |
| Guest ownership and controls | Guests can recover their own submitted memories after reload, edit text and delete. Editing hides the old public version and requeues screening; deleting hides it promptly and records file targets. Other guest sessions cannot manage those memories. | History paging now exists. Lost-session verification and physical-phone proof remain. |
| Host review | Hosts can preview ordinary screened flags and approve or keep them off the wall. Unscreened and critical content cannot be manually published. Restricted records stay out of ordinary host queries. | Host paging now exists; complete internal case operations remain. |
| Moderation consistency | Retries must match the original actor, action and post. Restoring content with an open report or safety restriction is refused. Host hide/restore/delete actions stay in sync with guest records; guest edits cannot resurrect host-deleted content. | The complete reporting service still needs to maintain the report state. |
| Private feedback | Hosts have a separate feedback page and navigation entry. Only independently cleared feedback appears; private feedback is not placed on the public wall or copied into email by this implementation. | Real screening and email operations remain. |
| Keeping hosts signed in | Guest actions use separate property-specific sessions. Password/Google accounts remain signed in. Registered identities are protected from anonymous replacement, and guest-first/concurrent app startup is handled. | Verified through local regression tests; production browser sign-in still needs checking. |
| Deletion records | Guest/host deletion records the intended media targets before clearing public content. Guest media manifests include both quarantine and delivery copies. Host guest-media requests record a 72-hour deadline. | Unrecognised legacy URL-only media and the wider retention schedule remain. |
| File deletion worker | A scheduled worker processes queued media deletion and failed quarantine cleanup. It validates all targets before deleting, checks that files are absent and safely retries partial failures or already-missing files. | Scheduled cloud execution and historical/backup copies are unverified. |
| Deletion reliability | The worker waits for existing uploads to settle, prevents concurrent job claims, recovers expired claims, caps retries, protects safety holds, pages through unfinished jobs and logs overdue/failed work. | Logs need operational alert routing; hold release and retention expiry need their own workflows. |
| Test and accessibility support | Fixed the shared test setup that broke Storage tests, corrected dialog test interactions and added an accessible name to the guest dialog. Added account, guest workflow, security and deletion regressions. | This is not a complete accessibility audit. |

## How it was checked

Latest recorded checks on 8 September: **335 app/unit tests across 35 files**, frontend and Functions builds, and isolated export/report integration checks passed. Actual photo bytes, ownership restrictions and the open safety-case guard were checked. Browser downloads, physical phones and hosted preview are not yet verified.

The earlier combined `npm run check:all` run passed:

- **292 unit/UI tests** and **32 Firestore/Storage security-rule tests**.
- App typechecking, web build and Functions build.
- Emulator integration scripts for public walls/moderation, guest contribution and actual storage deletion.

A final deletion attempt-limit safeguard was then rebuilt and passed the focused deletion emulator checks. Tests cover actual removal from both buckets, partial failures, invalid targets, safety holds, late uploads, concurrent/expired claims and jobs beyond the first page.

Earlier Chromium checks at 390×844 confirmed no horizontal overflow on the sampled guest form, a saved submission, reload recovery and text editing. Browser automation stalled on the deletion confirmation, so deletion evidence comes from the API/emulator checks. Account-preservation tests use mocked Firebase boundaries. No production or physical-phone result is implied.

Evidence: [full verification log](../artifacts/launch-review-2026-09-07/storage-deletion-check-all.log), [final deletion checks](../artifacts/launch-review-2026-09-07/storage-deletion-final.log), [account preservation checks](../artifacts/launch-review-2026-09-07/account-preservation-check.log).

## Implementation plan — work still to finish

GC and L are tracking IDs for delivery work. D references point to the [differences from the skeleton](PLAN_DEVIATIONS_AND_GAPS.md). They are not section numbers from the original plan.

### What “still to finish” actually means

**The list below contains 15 areas with something outstanding. It does not mean 15 whole features still need to be built from scratch.** Some need more code, some need a real service connected, some need testing on the hosted app, and some need a business decision. Several areas share the same dependency: for example, email setup helps finish reporting, safety alerts and customer communications.

“Already done” below means implemented or checked locally in this task unless stated otherwise. “Finished when” describes the evidence still needed to close that item. The identifiers are labels so we can discuss the same item consistently; they do not indicate completion percentages or separate amounts of work.

**Example:** the photo deletion worker already exists. GC-05 stays open because the app also needs rules for when old content should be deleted, checks for backup copies and a process for safety-held content. We are finishing those missing pieces, not rebuilding deletion from scratch.

### GC-01 — Automatically checking guest messages and photos

**Status: Partly built; needs a provider.**

- **Already done:** The app can hold a submission for checking, keep unchecked content private and retry a failed check.
- **Still to do:** Connect a real screening service and test acceptable, harmful and uncertain content. At present the app cannot make real automated safety decisions.
- **Who takes the next steps:** I can implement and test the connection. You need to agree the service and its cost/data terms; screening rules also need agreement.
- **Finished when:** A suitable submission passes a real check, an unsafe one stays off the wall, and a service outage never publishes unchecked content.

Skeleton/tracking references: §5.4; C-12/C-13.

### GC-03 — Terms, privacy policy and guest consent

**Status: Draft; needs business details and review.**

- **Already done:** Guests can accept the draft wording, and the app records what they accepted and when.
- **Still to do:** Replace draft policies with reviewed final versions and settle age/minor and text-only submission wording.
- **Who takes the next steps:** I can prepare and connect the wording. You need to supply the business details and arrange/approve the appropriate policy review.
- **Finished when:** The app shows the agreed policies and records the matching consent version.

Skeleton/tracking references: §§5.3, 6.6; C-11/C-19.

### GC-04 — Protecting the hosted app

**Status: Built locally; hosted checks outstanding.**

- **Already done:** Local tests cover private data access, separate guest sessions and keeping hosts signed in.
- **Still to do:** Configure and test the actual preview accounts, storage permissions, allowed website addresses and protection against unauthorised requests.
- **Who takes the next steps:** I can configure and test the authorised isolated preview once account access is available. You must complete any required account sign-in yourself.
- **Finished when:** On the hosted preview, guests cannot access private records or another host’s property, and a host stays signed in through guest actions.

Skeleton/tracking references: §§5.11, 6.2, 6.5.

### GC-05 — Deleting old content properly

**Status: Partly built.**

- **Already done:** A worker deletes photo files placed in its deletion queue and retries failures. Safety-held files are protected.
- **Still to do:** Add the rules that decide when abandoned uploads, old drafts, expired guest data and dormant properties enter that queue. Handle backup/older copies and authorised release of safety holds.
- **Who takes the next steps:** I can build the missing schedules and checks against the skeleton. You need to settle any unresolved retention decisions and who may approve safety-hold release.
- **Finished when:** Each category is removed when required, held material is handled correctly, and failed or overdue deletion reaches someone responsible.

Skeleton/tracking references: §5.10.

### GC-06 — Older memories and protection against misuse

**Status: Paging built; abuse protection incomplete.**

- **Already done:** Load more is available for guest history, host review, private feedback and moderation. Tests reached older items beyond the first page.
- **Still to do:** Verify those queries on the hosted app and strengthen controls against repeated spam or people creating fresh anonymous sessions to bypass limits.
- **Who takes the next steps:** I can implement and test this. Any additional customer-facing limits need agreement.
- **Finished when:** Older unresolved items remain reachable, and misuse controls work without unfairly blocking ordinary guests.

Skeleton/tracking references: §§5.3–5.5, 6.3; D-05/D-06.

### GC-07 — Handling reports and privacy requests

**Status: Partly built.**

- **Already done:** A guest can report a memory or submit a privacy request. Ordinary reports can hide content and be reviewed by the host. Overdue requests create internal alerts.
- **Still to do:** Complete identity checks for someone who has lost their guest session, responses to the requester, internal case resolution and the remaining report-abuse rules.
- **Who takes the next steps:** I can build the missing flow. You need to decide who handles privacy cases; sending responses also depends on email setup.
- **Finished when:** A person can raise a valid concern, the right person handles it, the outcome is recorded and the requester receives the required response.

Skeleton/tracking references: §§5.3–5.4, 5.8, 6.3.10.

### GC-08 — Finishing the guest experience

**Status: Partly built; device testing outstanding.**

- **Already done:** Real walls, messages/photos, cover/theme rendering, writing prompts, optional shared house information and the pending confirmation dialog exist.
- **Still to do:** Finish the planned layouts, pinned-post order and ten-post practice setup. Check interrupted uploads, accessibility and real phones.
- **Who takes the next steps:** I can implement and perform available browser checks. Physical-phone verification needs access to a suitable device/tester.
- **Finished when:** The planned guest journey works from scanning the link through posting and returning to a memory, including on phones.

Skeleton/tracking references: §§5.1–5.2, 6.3.8–6.3.9, 6.6.

### GC-09 — Tools for the person running safety operations

**Status: Partly built.**

- **Already done:** There is a private queue overview requiring an administrator account with a second sign-in factor. Internal alerts and restricted case records exist.
- **Still to do:** Add the complete case-handling actions, staff sign-in/setup, delivered alerts and a working daily review process.
- **Who takes the next steps:** I can build and test the tools. You need to name the responsible operator and arrange cover; email setup is also required.
- **Finished when:** An authorised operator can securely receive, review and resolve a case, and urgent alerts actually reach them.

Skeleton/tracking references: §§2.3, 5.4, 5.6, 5.9.

### L-01 — Payments and subscription changes

**Status: Needs reconciliation and end-to-end testing.**

- **Already done:** This task added checks that end public access when a cancelled service period expires. Separate billing code may contain additional work.
- **Still to do:** Inspect that separate work before claiming it complete. Test activation, trials/discounts, payment confirmation, renewals, failed payments, cancellation, reactivation and refunds.
- **Who takes the next steps:** I can review and test the implementation. You need to settle commercial settings and business/payment-account details where still undecided.
- **Finished when:** A complete test purchase and subsequent subscription changes produce the correct access, records and customer messages.

Skeleton/tracking references: §§4.1–4.3, 5.1, 5.7; A.4.

### L-02 — Permanent links, printed QR codes and exports

**Status: Partly built; full journey unverified.**

- **Already done:** Property addresses are reserved uniquely. Hosts can download ZIP parts containing visible memories, supported guest photos and an offline readable copy.
- **Still to do:** Verify the final-domain QR print/scan journey, improve large exports and deal with older external photos. Test actual browser downloads. Existing QR tools must be checked before deciding what else to build.
- **Who takes the next steps:** I can implement and test the remaining work. You need to choose the permanent domain and settle any open export-coverage decisions. The ZIP format is already agreed.
- **Finished when:** A printed QR opens the correct property on another device, and the agreed export downloads with all the content it promises.

Skeleton/tracking references: §§5.1, 5.5, 5.10, 6.3.

### L-03 — Checking older photos and records

**Status: Audit and possible migration needed.**

- **Already done:** New guest photos use the protected delivery system.
- **Still to do:** Check photos and records created through older flows. Old direct photo links may need replacement or removal; older records need compatible access/expiry information.
- **Who takes the next steps:** I can inspect the authorised environment and migrate confirmed affected data. This is not a claim that every older record is faulty.
- **Finished when:** Any affected old data follows the same access and deletion rules as new data, with migration results checked.

Skeleton/tracking references: §§5.10–5.11, 6.2.

### L-04 — Emails and customer support

**Status: Not completed in this task.**

- **Already done:** Some internal notification records exist. A stored notification is not an email delivered to a person.
- **Still to do:** Connect sending, finish templates, test real inbox delivery and handle failed delivery/unsubscribes correctly. Establish support intake and refund handling.
- **Who takes the next steps:** I can build the sending and support flows. You need to choose the provider, sender/support address and person responsible for support.
- **Finished when:** Account/service emails arrive, marketing preferences are respected and customers have a working route to help.

Skeleton/tracking references: §§5.6, 5.8; A.1–A.3.

### L-05 — Making setup straightforward

**Status: Earlier findings need checking against current UI.**

- **Already done:** The familiar property editor has been retained, and this task fixed saving appearance settings. Other UI work may have improved more areas.
- **Still to do:** Walk through the latest app as a new host. Confirm which earlier issues still exist, then fix confusing steps, missing help/routes and loss of unsaved work.
- **Who takes the next steps:** I can review and fix confirmed issues. I will ask only where a product choice is needed.
- **Finished when:** A new host can create and prepare a property without confusing dead ends or unexpectedly losing work.

Skeleton/tracking references: §§5.1, 6.3, 6.6.

### L-06 — Proving the app is ready to launch

**Status: Local tests passed; release checks outstanding.**

- **Already done:** The latest recorded app/unit tests and builds passed. Local server tests covered important security and guest flows.
- **Still to do:** Deploy compatible components together to isolated preview. Check full journeys, devices, accessibility, actual services, performance, monitoring, recovery and rollback.
- **Who takes the next steps:** I can carry out the authorised preview work with the required account access. Business operation and physical-device checks need the appropriate owner/tester.
- **Finished when:** There is recorded evidence that the hosted app works safely and can be monitored and recovered, followed by an explicit launch decision.

Skeleton/tracking references: §§5.9, 6.5–6.6, 7.1, 8.1–8.2; A.3.

### L-07 — Keeping the records accurate

**Status: Main documents created; ongoing reconciliation.**

- **Already done:** These two main documents now explain delivery progress and differences from the skeleton.
- **Still to do:** Reconcile older status documents and separate workstreams with verified results. Record remaining decisions and update this plan as items finish.
- **Who takes the next steps:** I can maintain the records. You need to make the outstanding business decisions and identify who authorises launch.
- **Finished when:** The records agree on what is built, tested, deployed and still open, with evidence and decision dates.

Skeleton/tracking references: A.4; A-18.

## Decisions and access needed to continue

- The user has authorised isolated preview testing (8 September 2026).
- Legal business name, operating country, support email and permanent domain are undecided. These must remain unset rather than being invented in policies, billing or emails.
- Screening/email providers are not selected. The user requested alternatives research before preparing Azure/Resend integrations. No supplier account has been connected or paid plan activated.
- Firebase CLI project discovery failed with expired credentials. The user has been asked to complete `npx firebase login --reauth` themselves; preview provisioning is pending that access.
- Provider priority is **lowest ongoing cost**. OpenAI moderation plus SES has now been proposed for evaluation; selection is pending. OpenAI's text/image moderation model is currently free, but it does not complete the plan's PII, malicious/competitor-URL or sentiment checks. [Model pricing](https://developers.openai.com/api/docs/models/omni-moderation-latest), [supported categories](https://developers.openai.com/api/docs/guides/moderation), [data controls](https://developers.openai.com/api/docs/guides/your-data). Account limits, processing/data terms and supplemental-check costs still need validation. Azure's public price page exposes free-tier quotas but not a usable regional paid quote in this research, so it is not ranked as cheaper without that quote.
- The user selected **ZIP with messages and photos**. The local export also includes readable HTML. Format approval does not approve the current implementation limitations below.

## Supporting provider research

### Provider alternatives researched — 8 September 2026

These are candidates, not approved providers or a promise of moderation accuracy. Evaluate the same synthetic acceptance set before choosing thresholds; confirm terms and actual processing location before sending guest content.

| Screening option | Useful fit | Tradeoff to settle |
|---|---|---|
| Azure AI Content Safety | One service for text and image harmful-content categories; the published availability table includes both in Australia East. | Four core harm categories do not by themselves prove every handbook spam, privacy or severe-content outcome. Review coverage, thresholds and separate operational escalation. [Coverage](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview), [categories](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/concepts/harm-categories), [data handling](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/content-safety/data-privacy). |
| AWS Rekognition + Comprehend | Detailed image moderation plus a separate toxicity API for text. | Two services/configurations. Comprehend toxicity is English-only with 1 KB per text segment, so the app's character limit needs deliberate segmentation and language handling. Confirm the exact APIs in the chosen region. [Image moderation](https://docs.aws.amazon.com/rekognition/latest/dg/moderation-api.html), [toxicity limits](https://docs.aws.amazon.com/comprehend/latest/APIReference/API_DetectToxicContent.html). |
| Sightengine | Specialist service offering image and text moderation in one supplier. Public Starter pricing currently lists US$29/month for 10,000 operations plus overages. | Operations are not necessarily whole guest submissions; a ten-photo submission and selected checks must be costed. Geo-fencing appears on the Enterprise offer, so do not assume Australian-only processing on Starter. [Plans](https://sightengine.com/pricing), [supplier FAQ](https://sightengine.com/faq/). |
| Google Vision SafeSearch + separate text service | Fits the existing Google Cloud stack for image checks. | SafeSearch's five image categories are not a text moderation service; another integration is needed. [SafeSearch documentation](https://docs.cloud.google.com/vision/docs/detecting-safe-search). |

| Email option | Useful fit | Tradeoff to settle |
|---|---|---|
| Resend | Simple sending API, delivery events and 24-hour idempotency keys for retry-safe send requests. | Account data, email metadata and logs are stored in the US regardless of sending region. [Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [regions](https://resend.com/docs/dashboard/domains/regions). |
| Postmark | Transactional/broadcast separation, suppression management, event webhooks and a testing tier. The 10,000-email Basic selection currently lists US$15/month. | Default message/activity retention is 45 days; retention and data-location terms need review. [Pricing and feature comparison](https://postmarkapp.com/pricing). |
| Amazon SES | Usage-based sending with regional configuration and more direct AWS control. Current Essentials first-tier pricing lists US$0.16 per 1,000 emails, with other charges depending on usage. | More setup for domain verification, sandbox exit, bounce/complaint handling and operational visibility. Regional configuration is not a guarantee every recipient/mail system is in that region. [Current pricing](https://aws.amazon.com/ses/pricing/), [region-specific setup](https://docs.aws.amazon.com/ses/latest/dg/regions.html). |

Current recommendation for the user's lowest-cost priority: evaluate **OpenAI moderation plus Amazon SES**, with supplemental screening coverage and operating costs explicitly measured. Azure/Sightengine and Resend/Postmark remain alternatives if coverage or setup effort changes the decision. This recommendation is an inference from the documented capabilities, not a completed benchmark. Prices are a research snapshot, exclude taxes/other app costs and must be checked at signup. No live provider data processing or email sending is authorised by this comparison alone.

## Supporting references

These are historical/detail references, not the main current status documents. Earlier statements such as “no deletion worker” describe their delivery date and are superseded by this summary.

- [Original launch review](launch-readiness-review-2026-09-07.md).
- [Initial fixes](launch-fixes-2026-09-07.md).
- [Guest contribution and account preservation](guest-contribution-delivery-2026-09-08.md).
- [Original guest issue register](guest-contribution-issues.md) — GC identifiers are retained in the main gaps document.
- [Storage deletion delivery](storage-deletion-delivery-2026-09-08.md).

For future work, update this document with the implementation and evidence, keep unfinished work in this implementation plan, and update the companion differences document whenever behaviour differs from the skeleton or a plan choice needs agreement. Keep dated reports as supporting history.

Latest verification (8 September): 35 app/unit test files, 335 tests passed; frontend and Functions builds passed. Isolated export/report integration checks passed, including actual photo bytes, owner/anonymous denial, excluded content and the open safety-case publication guard. Root production dependency audit reported zero vulnerabilities. This is local evidence, not browser download, physical-device or hosted-preview proof.
