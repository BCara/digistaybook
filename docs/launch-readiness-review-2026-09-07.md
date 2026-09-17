# DigiStayBook launch and usability review

> **Supporting reference.** The main current records are [Implementation summary](IMPLEMENTATION_SUMMARY.md) and [Plan deviations and gaps](PLAN_DEVIATIONS_AND_GAPS.md). This document retains the detailed history of its delivery.

**Implementation follow-up:** see [launch fixes and remaining work](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/launch-fixes-2026-09-07.md). The observations below describe the original review baseline; the follow-up records subsequent local changes and verification without rewriting that evidence history.

Reviewed 7 September 2026 against the current working tree, hosted public pages and isolated local Firebase emulators. **Authoritative product and operating baseline: [DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html).** This revision replaces the earlier review's use of the old Markdown BOP and inherited decisions. Requirement references below use the handbook's section numbers.

The handbook is a working plan: its **Action** annotations describe required work; **Confirm** annotations identify decisions still needing an owner. Its historical implementation notes are not current test results. For example, a per-property editor and scoped host uploads now exist, and `moderatePost` declares production App Check enforcement; guest contribution/report enforcement remains unbuilt or unproved. The current Functions audit reports eight moderate advisories, rather than the handbook's seven. No handbook requirement has been silently deferred by this review.

**Assessment: not ready for a public paid launch.** The visual direction and host editing experience provide a useful foundation, and property creation and host moderation have working local paths. However, the guest experience still uses demonstration data, key commercial and safety workflows do not exist, and several controls give assurances the implementation does not fulfil. Completing the real guest journey and enforcing privacy should take priority over more visual features.

This is a review, not an implementation or deployment. Existing application work was preserved. Synthetic accounts, properties and media used for checks were confined to `demo-digistaybook` on local emulators. The report and its evidence are separate from the product plan.

## What was verified

| Area | Observed result | Boundary |
|---|---|---|
| Hosted website | Landing page, in-stay demo and Terms route open at `https://digistaybook-cbert.web.app`. Terms explicitly say they are not approved for publication. | Public browser inspection; not proof of deployed backend functionality. |
| Local versus hosted | Hosted in-stay contribution is inline; the current checkout uses an Add a memory dialog and a photo input. | Rendered evidence that local and hosted UI differ; exact cloud revision not established. |
| TypeScript and builds | App typecheck, web production build and Functions build pass. | Local Node 24.12.0; deployment/CI specifies Node 22. |
| Unit/UI suite | 270 passed, 1 failed, across 26 files. | `npm run check` stops at the test failure; builds were run separately. |
| Existing rules suite | 20 Firestore tests pass. Storage suite crashes before executing its tests because shared setup references `Element` in a Node environment. | `npm run test:emulators` fails overall. |
| Status ledger | Validator passes: 9 workstreams, 25 tasks. | Valid structure does not mean current release readiness; several evidence documents contain older counts and descriptions. |
| Dependency audit | Web production dependencies: 0 reported advisories. Functions production dependency tree: 8 moderate, 0 high/critical. | Point-in-time npm audit, not a comprehensive security assessment. |
| Host journeys | Synthetic host signs in; three-step wizard creates a persisted draft; host approval moves a held memory to visible through the Functions emulator. | Local browser and emulators only; no real-host sign-up, inbox delivery or production Auth check. |
| Responsive review | Guest dialog, host dashboard and property editor inspected at 390×844; desktop editor at 1440×900. Mobile editor measured 375px document width inside a 390px viewport. | Sampled Chromium layouts; not a complete accessibility audit or physical-phone test. |
| Cloud inventory | Read-only `firebase functions:list --project digistaybook-cbert --json` returned an error. | Current cloud Functions, rules, App Check and billing configuration remain unverified. The error does not establish that Functions are absent. |

## Blockers and required outcomes

Priority **P0** means resolve before accepting real guest content or taking payment. **P1** means finish before the corresponding public-launch promise or validate during the controlled pilot.

### 1. P0 — Real property walls and guest submission are not connected

Both guest pages assign `demoProperty` and render `demoPosts`. A visit to `/stay/audit-missing-property` rendered Seabreeze Cottage and its eight sample memories without a demo banner. The property slug does not load the host's property, verify activation or identify a missing property. The embedded public wall uses the same demonstration component.

The submission handler validates local text with a fixed demo session and then says nothing is sent. The photo input has no handler and no place in the submitted schema. There is no contribution endpoint in the Functions entry point.

**Required work:** isolate fixtures to explicit demo routes; implement a server-backed slug lookup and public-safe projections; enforce lifecycle and wall visibility; render real paginated posts and uploaded media. Implement anonymous guest ownership, text/photo submission, consent evidence, screening, retry-safe writes, upload progress and useful errors. Guests need a durable success state and a way to manage their contribution.

**Done when:** a newly created, activated property displays its own name, welcome, photos and memories on a second device; a guest's submission survives reload and appears in moderation; nonexistent, unpublished, disabled and expired addresses show the correct unavailable state without sample content.

Evidence: [GuestWallPage.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/pages/GuestWallPage.tsx:26), [StayWallPage.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/pages/StayWallPage.tsx:25), [MemoryWall.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/wall/MemoryWall.tsx:107). Handbook: §§5.1–5.3, 6.3.8–6.3.9.

### 2. P0 — Public/private separation must be enforced by the backend

The live property document contains the profile, including in-stay house facts, and billing. Firestore grants unauthenticated reads of that whole document. An isolated probe successfully read a synthetic Wi-Fi password and billing fields without authentication. It also read a live document with `displayWallOff: true`.

Separating JSX views does not protect fields in a readable document. Firebase confirms reads are all-or-nothing at document level and recommends separating protected fields into different documents. [Firebase field-access documentation](https://firebase.google.com/docs/firestore/security/rules-fields).

The handbook describes a Guest Wall reached by QR **or shared link**, with pinned house information (§§5.2, 6.3.9). It does not require a second secret arrival page or proof of physical presence. The current `/stay/{same-public-slug}` address can be derived from `/wall/`; any implementation copy claiming it is accessible only inside the property is unsupported. The synthetic Wi-Fi read demonstrates public exposure, but does not by itself violate a handbook requirement to keep all house information private. Billing and restricted records are unequivocally host/server-only.

**Required work:** separate public-safe property/post projections from host-only billing and restricted safety records (§5.11). Clearly tell hosts which house information is public. If an additional private-guidance feature is retained, define and enforce its access policy separately; it is not a handbook launch requirement. Apply availability checks on every backend read and write, including embedded walls.

**Done when:** unauthenticated callers receive only approved public-safe configuration and content, cannot read billing, drafts or restricted records, and cannot bypass a supported visibility control. No screen misrepresents shared-link access as proof of physical presence.

Evidence: [firestore.rules](C:/Users/clbbe/Documents/Projects/DigiStayBook/firestore.rules:29), [propertyProfile.ts](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/domain/propertyProfile.ts:67), [probe results](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/probe-results.json). This confirms local-rule behaviour, not a customer-data incident.

### 3. P0 — Theme and public-wall visibility falsely report successful saves

Browser reproduction: select Studio, press Save changes, receive “Saved. Your walls read this immediately,” then reload. Linen is selected again. Switch the public wall off, save, reload: it is on again.

`savePropertyProfile` returns the normalised profile but its actual write-field list omits `theme` and `displayWallOff`. The client treats returned values as persisted. Even after fixing persistence, public routes and rules must enforce the off switch as described above.

**Required work:** persist every supported editable field, acknowledge actual server state and add an integration test that changes the setting, saves, reloads and checks guest access. Audit other save controls for the same mismatch.

**Done when:** both settings survive a fresh session, and each visibility control produces its stated result across the guest wall and embed. A separate in-stay exception is not required by the handbook.

Evidence: [propertyStore.ts](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/host/propertyStore.ts:249), [HostWallDesignPage.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/pages/HostWallDesignPage.tsx:1016).

### 4. P0 — Photo access and deletion need a complete lifecycle

Host uploads store `getDownloadURL` results and use a public one-year cache policy. The probe confirmed that a draft photo's ordinary unauthenticated Storage SDK read is denied, but fetching its download-token URL without authentication returns HTTP 200. A token URL is a bearer link; changing document visibility alone does not make that issued link private.

Host deletion currently clears the message/name and removes the post's photo field. It does not delete the underlying object or write a deletion manifest preserving the object reference. No scheduled deletion worker is exported. Failed property-photo cleanup is swallowed on the assumption a future sweep will collect leftovers.

**Required work:** decide which media are intentionally public; use an access-controlled delivery path for private/restricted media; preserve deletion targets before removing pointers; implement retryable object deletion and orphan cleanup; test downloaded URLs, caches, derivatives and legal holds against the approved retention policy. Process guest images server-side, strip location metadata, constrain decoded dimensions, resize for phones and enforce actual content validation.

**Done when:** draft/restricted media cannot be read through an issued public link contrary to policy, and a deletion job demonstrably removes all intended objects and records its completion. Do not label a tombstone “permanent deletion” before that workflow exists.

Evidence: [propertyStore.ts](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/host/propertyStore.ts:353), [Functions deletion branch](C:/Users/clbbe/Documents/Projects/DigiStayBook/functions/src/index.ts:93), [Storage probe](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/probe-results.json). Handbook: §5.10 and A-05.

### 5. P0 — Host-writable data and restricted moderation access are too broad

Emulator probes accepted client-supplied `billing`, `retentionState` and arbitrary counts at property creation. After creation, the owner could change `mode`, `foundationalPostCount` and an unknown field. Current rules deny some field changes but do not positively constrain the complete schema. This did **not** establish a payment bypass: the lifecycle still remained draft.

The owner could also read a `restricted` post's full message, and the moderation screen rendered the synthetic restricted text. Critical content intended for the internal safety queue should not reach the ordinary host interface merely because action buttons are removed.

**Required work:** allowlist client fields and validate types/lengths; reserve server-owned fields at creation as well as update; separate restricted payloads from host-safe case status. Implement server-controlled unique slug reservation. Ensure case/request identifiers are correctly scoped and retries are bound to their original action.

**Done when:** crafted client writes fail, an unrelated host/guest cannot cross ownership boundaries, and the ordinary host receives only permitted information about an internal safety case.

Evidence: [firestore.rules](C:/Users/clbbe/Documents/Projects/DigiStayBook/firestore.rules:36), [moderation read](C:/Users/clbbe/Documents/Projects/DigiStayBook/firestore.rules:46), [probe results](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/probe-results.json). Handbook: §§5.4, 5.11, 6.2.

### 6. P0 — Activation and the subscription lifecycle are unfinished

Billing is read-only and explicitly says trials, plan changes, card updates and cancellation are not built. Only `health` and `moderatePost` are exported from Functions; there is no Stripe adapter/webhook implementation in this checkout.

There is already a cancellation defect in the contracts: cancelling transitions to `cancelled_pending_end`, but public-read/QR predicates and both rulesets exclude that state. A synthetic property paid through a future date was denied to a guest after entering that state. This contradicts the BOP and the UI summary that access continues until the paid/trial period ends.

**Required work:** per-property checkout, first-property 28-day trial eligibility, verified 100% coupon activation, explicit renewal consent and dates, webhook signature verification, duplicate/out-of-order event handling, payment failure/14-day grace/recovery, cancellation, billing portal/card management and reactivation. Make service entitlement depend on the paid-through/trial end time and cancellation settings, not an oversimplified label. Stripe documents subscription access changes as webhook-driven. [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

**Done when:** a host can start a trial, activate the correct property, update billing, cancel and keep access until the stated end date. Test success, coupon activation, failed payment, retry, trial expiry, duplicate webhooks, refund and cancellation in Stripe test mode before verifying live configuration.

Evidence: [HostBillingPage.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/pages/HostBillingPage.tsx:125), [billing.ts](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/domain/billing.ts:15), [property.ts](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/domain/property.ts:24). Handbook: §§4.1–4.3, 5.7, 6.3.4.

### 7. P0 — Privacy, reporting and operational safety are still promises

The Privacy & Safety form's submit button is disabled. Guest posts have no implemented edit/delete/report controls. There is no automated screening integration, guest reporting endpoint, private checkout-feedback delivery, notification worker or retention scheduler. Domain types and transition tests describe intended behaviour but do not perform those operations.

Host moderation is a working slice; it should be retained. It still needs the intake pipeline, internal case tooling, notifications and deletion machinery around it. The moderation query loads only the newest 200 posts with no pagination, which can conceal older unresolved reports once the property grows.

**Required work:** anonymous-session self-edit/delete, neutral report acknowledgement, deduplication/rate limits, immediate hiding where policy requires, a working public request route and an operated internal queue. Lost-session requests use Privacy & Safety; do not invent cross-device guest identity. Make the 14-day escalation and retention schedules real. Query unresolved work by state/priority and paginate, rather than deriving the entire queue from the latest 200 memories. Deliver the separate, screened, text-only private feedback field and host inbox required by §§2.4, 5.3 and 6.3.8, with no reply mechanism and no feedback content in email. This is launch scope, not an optional enhancement.

**Done when:** a guest can report/remove their content; a person who lost their session can submit a privacy request; notifications arrive in a real inbox; internal operators can resolve cases; scheduled escalations/deletion are demonstrated. App Check is useful but does not replace ownership or rate limits. [Firebase App Check](https://firebase.google.com/docs/app-check).

Evidence: [PrivacySafetyPage.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/pages/PrivacySafetyPage.tsx:29), [Functions exports](C:/Users/clbbe/Documents/Projects/DigiStayBook/functions/src/index.ts:204), [moderationStore.ts](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/host/moderationStore.ts:40). Handbook: §§5.3–5.4, 5.6, 5.8–5.10.

### 8. P0/P1 — Complete QR, account and publication prerequisites

The QR component draws a genuine per-property code, but the QR page explicitly says printing is not built. Addresses use the current browser origin, so any eventual kit generated on a temporary preview must not accidentally be distributed as a permanent production placard.

Host email/password access, Google access and password-reset wrappers exist. Email verification is not invoked by account creation; there is no complete account settings/closure flow. The Terms and Privacy routes are placeholders. The sign-up flow does not record acceptance of a published policy version. The current local `.env.local` contains no App Check site-key entry; other build/hosting sources were not established.

**Required work:** downloadable/printable QR kit with stable production addresses and activation checks; verify scanning on physical iPhone and Android devices. Finalise the policy documents through the review required by handbook §6.6 and C-19, publish accessible text and capture acceptance at the relevant points. Configure and verify actual Auth domains/providers, account verification/recovery, email sender and inbox delivery, App Check, Firestore, Storage, Functions, secrets and provider accounts.

**Done when:** a new host can independently sign up, verify/recover access, activate, print and scan the correct placard, then manage/cancel their property without developer assistance.

Evidence: [HostQrPage.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/pages/HostQrPage.tsx:152), [hostAuth.ts](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/auth/hostAuth.ts:182), [LegalDraftPage.tsx](C:/Users/clbbe/Documents/Projects/DigiStayBook/src/ui/pages/LegalDraftPage.tsx:7). This is a product/implementation gap assessment, not a legal compliance determination.

## Additional launch scope required by the handbook

The eight findings above are not the complete backlog. The following closes omissions in the original review. Section numbers refer to the [authoritative handbook](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html); the implementation evidence remains the local review described above.

| Handbook requirement | Present gap and required acceptance evidence |
|---|---|
| Sandbox and activation — §§5.1, 6.3.6, 6.3.9 | Provide ten licensed, high-quality dummy posts, visibly distinguish demos from live content, and allow free customisation. The sampled demo has eight memories. Require at least one foundational item before activation. Unpaid drafts expire after 30 days, reset only by meaningful editing; the scheduler is missing. |
| Contribution — §§5.3, 6.3.8 | Build up-to-ten-image selection, removal, progress and retry, with server type/count/size validation. Record exact consent wording, version, timestamp and anonymous subject. The handbook says the page collects nothing else about the guest: reassess the current name field. Scope anonymous ownership to one property; test self-edit/delete and lost-session Privacy & Safety fallback. Image byte limits and age wording still require C-10/C-11 decisions. |
| Screening and reports — §5.4 | Implement private quarantine, image and concurrent text screening, clear/ordinary/critical routing and provider-outage pending behaviour. Critical content bypasses hosts entirely. Report controls need 24-hour session/post deduplication; reporter thresholds of three distinct posts in ten minutes or five in 24 hours; a wall breaker for five distinct reports in ten minutes with related signals; neutral acknowledgements and bounded restriction expiry. Restoration must check for other open reports and safety restrictions. Domain transition tests do not prove a running endpoint. |
| Internal operations — §§2.3, 5.4, 5.8, 6.2 | Build a separate MFA-protected, role-restricted, audited administration surface, never linked in public/host/guest navigation. It needs critical cases, host severe-offence escalation and Privacy & Safety escalations. Name the operator and backup; run daily critical review, monthly 50-flagged-post sampling and unresolved critical review at least every 30 days. No such surface is present in the inspected app router. |
| Private feedback and host export — §§5.3, 5.5; A-07 | Both are required. Add a separate screened one-way text field/inbox, stay-support boundary copy, and no emailed feedback content. Add an authenticated host content export before deletion; decide the format and prove it contains the intended wall/media without exposing restricted cases or internal records. Neither delivery path is implemented. |
| Commercial lifecycle — §§4.1–4.3, 5.7, 6.3.4 | Support both plans per property, first-property 28-day trial, authorised payment method OR verified 100% discount code, precise dated billing acknowledgement, 14-day failed-payment grace, annual notice 14 days before renewal, refunds and reconciliation. Show the designed offline page only when service entitlement actually ends; cancellation must preserve paid-through access. Exact local prices, GST presentation, fair-use boundary and retry schedule are unresolved decisions, not values to invent. |
| Email and preferences — §5.6, A.1 | Build the provider adapter, delivery logging and actual transactional lifecycle, plus important notices in the dashboard. The local marketing predicate/test is not a central consent service. Record separate unticked marketing consent with exact wording/version and source; build one-click unsubscribe and durable suppression that survives account deletion. Every promotional send must fail closed for missing consent, withdrawal, suppression, unavailable preference service or deleted account. Onboarding, abandonment, zero-post nudges, milestones and dormant win-back are marketing. No sequence is to be enabled before these controls are proved. |
| Authentication — §§6.2, 6.3.5 | Verify email before checkout/live links/QR issuance, show the agreed password policy before submission, verify Google branding/domains and recovery behaviour, require recent authentication for password/email changes, cancellation and property deletion, and enforce internal MFA. The handbook specifies single-use recovery with a 60-minute expiry; verify the configured provider can meet this. Decide anonymous-account cleanup without silently breaking self-delete. Wrapper functions alone do not demonstrate these behaviours. |
| Retention and restoration — §5.10 | Implement the full data-class matrix, not only post tombstones: quarantine copy removal within 24 hours of publication; processing timeout seven days; rejected content 30 days; approved privacy primary deletion within 72 hours; request escalation 14 days; separate consent, suppression, accounting and audit periods. The recommended 12-month dormancy and other marked periods require C-19 approval before customer promises. Backups expire within 30 days; reapply deletion manifests before restored service or marketing resumes. Exercise partial failures, bounded retries, alerts and scoped legal holds. |
| Pages, navigation and brand — §§6.3–6.4; A-09–A-14 | The per-property management route now exists, so A-09 is partially superseded by code. Dedicated pricing, host FAQ and host contact routes are absent from the inspected router. Complete account/support/policy/accessibility destinations, display choices, prompt selection and QR print/download/email/copy. Produce the preview video or deliberately restructure that promise as A-10 permits. Inventory approved logo variants, icons and print assets; verify status labels, contrast, keyboard and screen-reader behaviour rather than repeating stale asset annotations as proven defects. |
| Preview, operations and finances — §§5.9, 6.5–6.6, 7.1, 8.1–8.2; A.2–A.3 | Establish the isolated preview Firebase/Stripe test/email environment; its cloud existence was not verified. Prove monitored journeys and alert delivery, budget alerts, rollback, restore and deletion drills. Assign launch approval/stop authority and queue cover. Build a cost-per-property model including ten-image posts, screening, transfer, email and approved dormancy; verify current supplier rates and region rather than treating handbook example prices as quotes. Record monthly billing reconciliation and support/incident checklists. |

**Scope boundary:** §7.1 and A.8 exclude the affiliate engine, tablet display, direct-booking retention links, translation and contextual location prompts from launch. Do not spend the launch budget implementing those while the required loop is incomplete. Export and private feedback are not in that deferred list.

**Owner decisions to settle before dependent work:** use the handbook's [A.4 register](C:/Users/clbbe/Documents/Projects/DigiStayBook/docs/handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html#a-decisions). The critical dependencies are moderation provider/thresholds (C-12/C-13), email provider/domain (C-14), prices and usage economics (C-07/C-08/C-33/C-34), upload constraints (C-10), internal roles/support/alerts (C-04/C-16/C-17), policy and retention review with recorded versions/date (C-19), preview/domain/recovery arrangements, and launch ownership (C-31). Geography, entity details, authentication policy, demo-image licensing and print branding also need the recorded decisions listed there. This review identifies the decisions; it does not approve them or change the handbook.

**Traceability:** A-18 retires the old requirement-ID scheme. This report now uses handbook sections. Reconcile the remaining decision log, product specification, status ledger, tests and issue references in a separate documentation change, preserving their history. A passing ledger validator does not prove alignment with this handbook.

## Changes that would make it easier to use

Keep the recognisable visual style, property-specific header, optional fields, suggested house facts, inline editing, phone preview and sticky Save control. The sampled layouts were usable without horizontal overflow. Focus on clarity and reliable outcomes:

| Journey | Current friction | Recommended change |
|---|---|---|
| Discovering the product | “See a live wall” opens a sample; landing copy promises operational screening, cancellation, unlimited uploads and privacy controls that are not ready. | Label samples as demos. Keep every published claim aligned with demonstrated behaviour. Use a clear primary action to start property setup once the launch path works. |
| First property | The wizard offers four kinds of photographs, a public welcome, arrival note and another host note before a new host has seen the result. The dashboard then reports a fraction such as “1 of 6.” | Prioritise name, cover, welcome and useful essentials; defer optional personalisation. Follow creation with a concrete checklist: preview, start trial, print QR, test scan. Explain the next incomplete item. |
| Wall navigation | “Property view,” “Public wall” and “View guest wall” are easy to confuse. | Align with the handbook's Guest Wall containing house information and approved memories. Distinguish host preview from the live guest view; any additional surface needs a clear purpose and visibility explanation. |
| Mobile editing | On the sampled mobile editor, the canvas began about 693px down the page after the property banner, navigation and theme controls. | Move appearance into a collapsed optional section on phones; prioritise editing house information and previewing. Retain the sticky Save button. |
| Saving work | Theme and visibility save falsely; text requires Save but photos save immediately. Navigation has no general dirty-draft guard; wizard backdrop/Escape closes can discard work. | First fix persistence. Then make save semantics consistent and obvious, preserve drafts or warn before losing edits, and provide undo/remove recovery where appropriate. |
| Guest posting | Generic “Continue,” no real photo preview/upload/progress, consent mentions a policy without linking it, and errors are generic. | Use a clear submit label and pending/published result, local image preview/removal, field-level errors, linked policy text and retry without losing the message. Support the permitted text/photo combinations explicitly. |
| Getting help | Technical internals appear in billing, unconfigured and database-error text. Support links lead to an inactive form. | Give actionable customer wording: what happened, what to do, and where to get help. Keep project configuration, server transactions and database indexes in logs/admin tools. |
| Reading the wall | A raw `/* ... */` developer comment is rendered as page text above the host note in the current local wall. | Correct the JSX comment at MemoryWall.tsx:58. Check both guest views and embeds before release. |
| Accessibility | Some good labels and focus handling exist, but the guest dialog lacks an explicit accessible name and the custom property modal does not actually make the background inert despite its comment. | Name dialogs, enforce modal focus/background behaviour, test keyboard-only navigation, visible focus, errors and contrast in light/dark themes. Verify with VoiceOver/TalkBack and 200% zoom. |

These are proposed improvements; the review did not redesign or edit application screens.

## Release checks and delivery order

**Milestone 1 — Establish trustworthy data and controls.** Fix public/private storage separation, server-owned fields, restricted payloads, media access, theme/visibility persistence and cancellation entitlements. Repair the two broken test paths. Connect the real property resolver and read models. Passing requires negative security tests and save/reload tests, not only mocked UI assertions.

**Milestone 2 — Complete one usable host-to-guest loop.** Create property → configure and seed sandbox → verify account → activate by trial/payment or valid coupon → print QR → scan on another device → submit up to ten photos/text and optional private feedback → screen → publish/hold → host moderation → guest report/edit/delete. Add working Privacy & Safety intake, internal critical-case operations, actual notification delivery, export and deletion jobs before collecting real guest content. Complete the additional handbook requirements above before declaring this milestone release-ready.

**Milestone 3 — Operate a controlled pilot.** Finalise policy/provider configuration and subscription test cases, deploy an identified reviewed revision, and test with a small set of invited hosts. Measure setup completion, time to first successful scan/contribution, upload failures, unresolved reports and support requests. Use results to simplify onboarding, wording and mobile controls. No paid public launch while the P0 items remain.

**Milestone 4 — Public launch.** Verify live subscriptions, cancellation through period end, Auth/email delivery, actual cloud rules and App Check. Publish the tested build on the chosen permanent domain, validate printed QR addresses, set monitoring and cost alerts, document a rollback procedure and practise restoration/deletion handling. Launch promises must match the final shipped scope.

Minimum release acceptance:

- A new host completes setup and activation without developer instructions; a different host cannot access or change their private records.
- A printed QR opens the correct property on physical iPhone and Android devices, including poor connectivity and the intended browser contexts.
- Text and supported photos persist; oversized/unsupported images fail clearly; interrupted uploads and double taps do not create duplicates.
- Host-only billing, restricted content and disabled walls remain inaccessible through direct APIs, alternate routes and issued media URLs as required by the access policy; public house information is labelled accurately.
- Guest reports, self-deletion, lost-session privacy requests, host moderation and internal escalation work end to end.
- Trial, payment failure/recovery, renewal, cancellation and paid-through access match the displayed dates; email delivery is checked in actual inboxes.
- Theme/visibility/content saves survive reload and sign-in on a second device.
- `npm run check:all` passes under the supported runtime; server integration and browser journeys cover the behaviours above.
- The exact deployed project/revision, rules, secrets, sender, custom domain and rollback process are recorded.

The current unit failure is an outdated interaction test that clicks Continue without opening the new dialog; it does not by itself prove consent validation is broken. The Storage failure is a shared-test-setup error at `vitest.setup.ts:6`, not evidence that all Storage rules fail. Repair both and extend coverage to the real persistence and URL-access behaviours uncovered here. Review the eight Functions audit findings individually; do not blindly accept npm's suggested major downgrades.

The present initial JS chunk is about 424kB (127kB gzip), with a further Firebase chunk around 555kB (162kB gzip). These are build measurements, not measured user load times. After correctness, measure the real guest page over mobile connections, keep unnecessary host/SDK code off its critical path, and set pagination/image-size budgets before relying on the “unlimited” upload promise.

## Evidence files and limits

- [Local security probe and synthetic fixtures](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/probe.mjs). Requires running local Auth/Firestore/Storage emulators for `demo-digistaybook`; it writes synthetic audit records and can reseed them. It deliberately demonstrates current gaps, so successful probes are not assertions that security is correct.
- [Probe results](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/probe-results.json).
- [Existing emulator-suite output](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/emulator-test-results.log).
- [Web dependency audit](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/web-dependency-audit.json) and [Functions dependency audit](C:/Users/clbbe/Documents/Projects/DigiStayBook/artifacts/launch-review-2026-09-07/functions-dependency-audit.json).

This review does not establish a production security incident, approved legal documents, working payments, inbox delivery, complete accessibility conformance or physical-device reliability. Those remain explicit release gates. It also does not estimate a delivery date: several substantial backend integrations remain, and elapsed effort depends on the final scope, provider access and acceptance testing.

