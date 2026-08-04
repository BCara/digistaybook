# DigiStayBook WIP v2: Recommended Changes

**Reviewed source:** [`digistaybook_WIP_v2.md`](../digistaybook_WIP_v2.md)  
**Review date:** 4 August 2026  
**Purpose:** Turn the eight earlier review findings into specific edits and implementation decisions. The downloaded WIP remains unchanged; this file is the review and change list.

> The BOP remains the product and commercial authority. These recommendations identify provider-policy, legal, privacy, security, billing, and internal-consistency issues that should be resolved before the document becomes an implementation baseline. Legal and tax wording should receive professional review before publication.

## Priority summary

| # | Finding | Current position | Priority |
|---|---|---|---|
| 1 | Booking-provider review policy | Still open | Launch blocker for Airbnb-linked properties |
| 2 | Moderation architecture | Largely improved | Resolve provider limits and operational detail before build |
| 3 | Legal copy versus product | Partly improved | Legal review and consistency pass required |
| 4 | Retention | Partly improved | Define the data-class matrix before schema/build |
| 5 | Anonymous reporting abuse | Controls added, behaviour contradictory | Select one reporting state model before build |
| 6 | Subscription billing | Product flow improved | Add server-owned Stripe architecture before build |
| 7 | Tax and marketing claims | Accepted and applied in WIP v3 (D-006) | Professional legal and tax review before publication |
| 8 | Security emails | Still open | Reduce MVP scope or commit to required auth architecture |

## 1. Booking-provider review policy

### Locations

- Part 1, section 1.2, lines 14-20.
- Part 1, section 1.6.1 checkout guide, line 55.
- Part 2, section 2.4 universal copy button and private feedback, lines 80 and 92-93.
- Part 3, section 3.3 property creation, line 110.
- Part 4 lifecycle emails and milestones, lines 133, 146, 162 and 172.
- Part 9 activation email and lifecycle copy, lines 406-407, 528, 544 and 554.

### Recommended changes

1. Replace section 1.2 with a provider-aware policy instead of claiming universal compliance.
   - For Airbnb-linked properties, DigiStayBook is a memory wall and optional house guide only.
   - Do not display a review-copy modal, a request for a five-star review, review-reuse instructions, or copy positioning tied to Airbnb checkout.
   - For every other provider, default review prompting to off until its current policy has been checked and recorded.
2. Remove the phrases “strict compliance,” “100% compliance,” “official review,” “glowing 5-star review,” and “Automating Your 5-Star Reviews.” They are unsupported compliance conclusions.
3. Keep a generic Copy Text control only if it is described as a convenience for the guest’s own text. Do not describe it as bridging DigiStayBook into a booking engine.
4. Change the line 110 booking-platform field:
   - Store a provider enum such as `airbnb`, `vrbo`, `booking_com`, `stayz`, `direct`, or `other`.
   - Keep a listing URL only where it has a separate operational purpose.
   - Do not use the URL to power a universal checkout review modal.
5. Add a server-owned provider capability flag, defaulting to `reviewReuseAllowed: false`. Client code must not infer permission from a URL.
6. Remove copy that positions private feedback as a way to prevent negative public reviews. Describe it neutrally as optional, non-urgent property feedback.
7. Replace host templates with provider-neutral wording that requests an honest review only through a provider-permitted channel. Maintain provider-specific templates outside the core BOP so they can be disabled when policies change.

### Completion test

- Selecting Airbnb results in no review prompt or five-star language anywhere in the guest wall, host onboarding, emails, pinned-post suggestions, or checkout material.
- A generic copy button does not mention reviews or booking providers.
- Provider policy decisions have an owner, review date, source URL, and default-off fallback.

## 2. Moderation architecture

### Locations

- Part 1, section 1.4, lines 27-34.
- Part 2, section 2.4 pending-state behaviour, lines 81-84.
- Part 4 moderation emails and internal lifecycle, lines 134 and 173-176.
- Part 7, Terms clauses 4.1-4.2 and platform intervention, lines 302-303 and 315.
- Part 9, moderation emails, lines 451-475.

### Recommended changes

1. Retain the new quarantine-first design, but make the state machine explicit:
   - `uploading` -> `processing` -> `published`;
   - `processing` -> `pending_host_review` for ordinary flags;
   - `processing` -> `restricted_internal_review` for critical flags;
   - deletion and rejection are separate terminal states with auditable timestamps.
2. State that quarantine objects use private storage paths and are never served through public Firebase Storage URLs. Publish only an approved public projection or approved copy.
3. Replace “Sub-Second AI Screening” with a target rather than a guarantee. Define timeout, retry, provider-outage, and inconclusive-result behaviour; the safe fallback is to remain in `processing`, not publish.
4. Do not describe Google Vision SafeSearch as detecting CSAM, hate speech, competitor URLs, or general illegality. It reports adult, racy, violence, medical, and spoof likelihoods. Use separate named controls for text rules and any specialist safety service.
5. Remove “sentiment analysis” as an automatic safety reason unless the product deliberately intends to quarantine negative but legitimate guest feedback. Sentiment is a curation signal, not proof of harmful content.
6. Define the critical-case operational runbook: access roles, manual verification, legal escalation, evidence preservation, false-positive release, audit trail, and retention/legal-hold rules.
7. Ensure critical content never goes to the ordinary host-review queue or leaks through host notification previews.

### Completion test

- A test upload cannot be publicly read before `published`.
- Provider failure leaves the submission private and recoverable.
- Each moderation provider is mapped only to categories it actually returns.
- Ordinary, critical, rejected, and deleted cases have distinct access and retention rules.

## 3. Legal copy versus actual product

**Decision status:** Accepted on 4 August 2026 and applied to `digistaybook_WIP_v3.md` as decision D-003.

### Locations

- Part 3 support boundary and platform reporting, lines 99-105.
- Part 6 Host Contact Page, lines 274-276.
- Part 7, Terms, lines 282-333, especially lines 302-305 and 314-315.
- Part 8, Privacy Policy, lines 334-387, especially lines 348 and 357-363.

### Recommended changes

1. Replace “acts solely as a passive conduit” at line 302. DigiStayBook stores, screens, routes, publishes, restricts, and deletes content, so the description must match those activities.
2. Clarify line 303 as “no routine manual pre-screening” while accurately disclosing automated pre-publication screening and limited internal critical-case review.
3. Reconcile line 315 “permanently delete” with the restricted internal-review case. A case cannot be deleted and retained for review at the same time.
4. Remove permanent IP/device-fingerprint-ban wording unless a reviewed, disclosed, proportionate implementation is selected. Prefer short-lived pseudonymous abuse keys, rate limits, account/session restrictions, and bounded security-log retention.
5. Separate “guest stay support” from “privacy and safety contact.” DigiStayBook can decline booking/property support while still providing a guest-accessible privacy and safety route.
6. Do not direct guests to a Host-only contact form for a DigiStayBook privacy request. Add a dedicated public privacy contact route and an escalation path when a host does not respond.
7. State who is controller and processor for each data class rather than applying one label to the entire service. DigiStayBook may have its own controller obligations for host accounts, security logs, billing metadata, platform reports, and internal trust-and-safety cases.
8. Send the final Terms, Privacy Policy, consent wording, age rule, moderation process, liability clauses, and deletion process for professional legal review before publication.

### Completion test

- Product behaviour, Terms, Privacy Policy, UI consent, and operational runbooks describe the same moderation, reporting, support, and deletion model.
- Guests can exercise a privacy right without using a Host-only support form.
- No clause claims data was deleted while another section requires it to be retained.

## 4. Retention and deletion

**Decision status:** Recommended operational defaults drafted on 4 August 2026 and applied provisionally to `digistaybook_WIP_v3.md` as decision D-004. Final approval remains part of the professional legal-review gate.

### Locations

- Part 1, critical moderation retention, line 32.
- Part 1 and Part 2 privacy deletion SLA, lines 33 and 83.
- Part 4 abandoned-property and win-back sequences, lines 148 and 170.
- Part 6 FAQ cancellation behaviour, line 271.
- Part 8, section 5, lines 370-375.
- Part 9 cancellation and privacy emails, lines 446-450 and 465-475.

### Recommended changes

1. Replace the four broad retention bullets at lines 372-375 with a data-class matrix covering:
   - unpaid property drafts;
   - active and dormant property configuration;
   - public guest content and original media;
   - quarantined and host-rejected content;
   - privacy/takedown requests;
   - consent evidence;
   - host account/profile data;
   - Stripe references, invoices, and accounting records;
   - authentication, App Check, rate-limit, and security logs;
   - internal moderation cases;
   - backups and disaster-recovery copies.
2. For each row specify purpose, storage location, access roles, active retention, cancellation behaviour, deletion trigger, backup expiry, and legal-hold exception.
3. Keep the proposed 12-month dormant-property window only after product/legal approval. Distinguish reactivatable property content from records that must be retained independently for accounting, dispute, security, or legal purposes.
4. Define “permanently hard-deleted from active servers.” State when deletion completes from active storage and when encrypted backups expire.
5. Record deletion jobs and failures without retaining deleted guest content in the audit record.
6. Define a short, restricted retention rule for critical moderation material with legal counsel; “tightly controlled retention” is not an implementable duration.
7. Align the 30-day unpaid-draft deletion, 90-day win-back communication, 12-month dormancy, privacy-request SLA, and marketing suppression record so none relies on data already deleted.

### Completion test

- Every stored collection/object type maps to exactly one retention row.
- Cancellation, privacy deletion, account deletion, moderation deletion, and backups have testable deadlines.
- Marketing suppression records survive long enough to prevent re-subscribing an unsubscribed address accidentally.

## 5. Anonymous reporting and takedown abuse

**Decision status:** Accepted with a modified visibility rule on 4 August 2026 and applied to `digistaybook_WIP_v3.md` as decision D-005. Ordinary reports hide immediately; circuit-breaker reports are recorded without changing visibility.

### Locations

- Part 1, reporting and circuit breaker, lines 33-34.
- Part 2, report modal and rate limiting, lines 83-84.
- Part 4 moderation alert, line 134.
- Part 6 Guest Wall, lines 280-281.
- Part 8 privacy workflow, lines 360-363.
- Part 9 privacy-takedown email, lines 465-475.

### Recommended changes

1. Choose one authoritative model. Recommended model:
   - An active session deleting its own post hides it immediately and schedules deletion.
   - A lost-session anonymous privacy request creates `pending_verification` and does not automatically hide the post.
   - A credible urgent safety report can be restricted by a server-side rule or internal reviewer.
   - An unresolved privacy request escalates automatically at the defined SLA instead of silently remaining with the host.
2. Update lines 281 and 472-473, which currently say every report instantly hides content. They contradict lines 33, 83 and 362, which route anonymous reports for validation to prevent mass hiding.
3. Route all reports through a server-controlled endpoint with App Check verification, rate limiting, session/post deduplication, and transaction-safe status changes.
4. Define limits and outcomes explicitly: per-session window, per-wall threshold, cooldown, circuit-breaker state, audit event, host notification, internal escalation, and restoration behaviour.
5. Do not tell a user a privacy request was accepted if the server silently dropped it. Use neutral acknowledgement for suspected abuse and provide a public privacy escalation route.
6. Avoid invasive fingerprinting. Use bounded pseudonymous abuse signals and document their retention.

### Completion test

- Repeated anonymous reports cannot mass-hide a wall.
- A genuine privacy requester has an accessible escalation path and a traceable request status.
- UI copy, emails, dashboard states, Terms, and Privacy Policy all describe the same visibility behaviour.

## 6. Subscription billing architecture

### Locations

- Part 2 payment guardrail, line 66.
- Part 3, sections 3.3-3.4, lines 106-121.
- Part 4 billing lifecycle, lines 132 and 135-140.
- Part 6 pricing, dashboard, property page and FAQ, lines 216-273.
- Part 7, Terms section 3, lines 293-299.
- Part 9 billing emails, lines 401-450.

### Recommended changes

1. Add an implementation subsection specifying Stripe Checkout in subscription mode, with one server-owned subscription entitlement per activated property.
2. Add server fields and constraints such as `propertyId`, `stripeCustomerId`, `stripeSubscriptionId`, `priceId`, `status`, `trialUsed`, `currentPeriodEnd`, `cancelAtPeriodEnd`, and a unique subscription-to-property mapping.
3. Make first-property trial eligibility server-owned and one-time. Additional properties must not gain a trial because of client state, a new browser, cancellation, or a different checkout session.
4. State that access changes only from verified Stripe webhook events, never from a client success redirect.
5. Define signature verification and webhook idempotency using the Stripe event ID. At minimum handle checkout completion, invoice paid/failed, subscription updated/deleted, and trial-ending events.
6. Add the Stripe customer portal or an equivalent server-managed billing page for payment-method updates, invoices, cancellation, and reactivation.
7. Specify end-of-period cancellation and ensure Terms, dashboard copy, QR status, and emails all use the same effective date.
8. Define the 14-day grace state in the entitlement model and the transition to the stable offline QR page. Payment recovery must restore the existing stable QR route.
9. Treat 100%-off production coupons as real subscriptions with verified webhook state and restrict their creation/use to an internal role. A client coupon result must not activate a property directly.

### Completion test

- Replayed or out-of-order webhooks do not duplicate subscriptions or regress entitlement state.
- The first property receives at most one trial; later properties bill immediately.
- Cancel, payment failure, recovery, coupon, and renewal scenarios are covered by integration tests.
- QR URLs remain stable through trial, paid, grace, suspended, reactivated, and cancelled states.

## 7. Tax and marketing claims

**Decision status:** Accepted on 4 August 2026 and applied to `digistaybook_WIP_v3.md` as decision D-006.

### Locations

- Part 1 tax claim, line 39.
- Part 4 receipts, abandonment and milestones, lines 136, 147, 157 and 172.
- Part 6 pricing callout, line 227.
- Part 7 tax disclaimer, line 299.
- Part 9 receipt, abandonment, milestones and win-back copy, lines 420, 529, 539 and 554.
- Marketing consent and unsubscribe controls, lines 109 and 124-129.

### Recommended changes

1. Replace every remaining “is a tax-deductible operational business expense” statement with:

   > DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice.

2. Keep the improved line 299 disclaimer, but do not rely on a legal-page disclaimer to cure stronger absolute claims elsewhere.
3. Change receipt emails to say “Keep this invoice for your records” rather than giving tax advice.
4. Keep the unticked marketing-consent checkbox. Store consent timestamp, source, wording/version, and the host identity that consented.
5. Maintain a central suppression list and apply unsubscribes across cart-abandonment, activation nudges, ROI milestones, win-back, affiliate, and other promotional sequences within the required timeframe.
6. Classify each email as transactional or marketing. Do not add promotional copy to a transactional email in a way that bypasses marketing consent.
7. Include sender identity, contact details and a functioning unsubscribe mechanism in every commercial message. Test suppression before enabling sequences.
8. Remove or substantiate other absolute outcome claims such as “statistically proven,” “subconsciously compels,” “drastically reduce,” and guaranteed five-star-review or damage-reduction outcomes.

### Completion test

- Searching the repository for `tax-deductible`, `100% compliance`, and `5-star review` finds no unqualified public claim.
- A withdrawn consent test prevents every subsequent marketing send while retaining necessary transactional messages.
- Consent and suppression events are auditable.

## 8. Security and account emails

### Locations

- Part 9, section 9.3, lines 477-521.
- Password-changed email, lines 491-500.
- Email-address-change flow, lines 502-512.
- New-device/login alert, lines 513-521.

### Recommended changes

1. Select and record one MVP decision:
   - **Recommended MVP:** use Firebase-supported password-reset and email-verification/recovery messages; send a password-change confirmation only after a DigiStayBook-managed account action; defer new-device/login alerts.
   - **Expanded security scope:** upgrade to Firebase Authentication with Identity Platform and implement reviewed blocking/custom auth flows, trusted-device state, risk evaluation, and security-event delivery.
2. Do not describe a new-login alert as available from standard Firebase Authentication without the supporting architecture.
3. If password-change confirmation remains, ensure all password changes flow through a controlled action that can safely emit the event. Define behaviour for password reset, in-dashboard change, admin reset, provider-only accounts, and compromised sessions.
4. For email changes, verify the new address securely and notify the old address with a recovery path. Do not switch operational email delivery until verification succeeds.
5. Remove device and approximate-location details unless the server reliably captures them, the privacy policy discloses them, retention is bounded, and false precision is avoided.
6. Add rate limiting, single-use/expiry handling, session revocation guidance, non-enumerating error messages, and tested recovery links.

### Completion test

- Every security email has an actual event source in the architecture and an integration test.
- No email claims an IP/device/location signal that the implementation does not reliably possess.
- Password reset, email change and suspected-compromise flows remain usable without revealing whether an unrelated account exists.

## Document cleanup after the eight decisions

- **Decision: not accepted.** Part 4 remains the authoritative operational source; Part 9 remains an appendix containing detailed email copy and templates. Part 4 may retain concise trigger and lifecycle summaries because they define operational behaviour. Part 9 must conform to Part 4, and any conflict is corrected in the Appendix rather than making Part 9 the source of operational policy.
- **Decision: accepted.** Remove mojibake and corrupted icon strings entirely; retain the surrounding plain-text label without adding a replacement icon.
- Align the MVP hardware statement with the Terms reference to “tablet displays.”
- **Decision: accepted.** Add permanent `DSB-BOP-P<part>-<number>` IDs, never renumber or reuse them, and use child suffixes for Appendix templates so implementation, decisions, tests and GitHub work can cite the BOP without line numbers.
- **Decision: accepted.** Update `docs/product-spec.md`, `docs/decisions.md`, `docs/backlog.md`, and `docs/change-log.md` together with the approved v3 BOP and generated review artifacts in a separate reviewed commit.

## Official references

- [Airbnb Off-Platform and Fee Transparency Policy](https://www.airbnb.com/help/article/2799)
- [Airbnb Reviews Policy](https://www.airbnb.com/help/article/2673)
- [Google Cloud Vision SafeSearch categories](https://docs.cloud.google.com/vision/docs/detecting-safe-search)
- [Firebase Authentication blocking functions](https://firebase.google.com/docs/functions/auth-blocking-events)
- [Firebase custom email action handlers](https://firebase.google.com/docs/auth/custom-email-handler)
- [Stripe subscription trials](https://docs.stripe.com/billing/subscriptions/trials)
- [Stripe customer portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [ACMA spam guidance](https://www.acma.gov.au/avoid-sending-spam)
- [ATO digital product expenses](https://www.ato.gov.au/api/public/content/5652e259-0df5-4d50-868a-7ffed11dab00_TaxTimeToolkit_SB_Digital_product_pdf)
