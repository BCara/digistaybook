# DigiStayBook Major Review Findings

> **Authority note:** `DigiStayBook-BOP_WIP` is the authoritative source for DigiStayBook's product, commercial, pricing and priority decisions. DigiGuestbook is used only as an architectural and implementation guide. Where the two differ, the BOP governs unless a legal, security or provider-policy concern is explicitly reviewed and approved as a BOP amendment.

## 1. Airbnb policy conflict

The BOP's “capture a memory, request a 5-star review, copy it into Airbnb” workflow potentially conflicts with Airbnb's rules. Airbnb prohibits taking guests to another website for feedback or reviews and prohibits pressure or manipulation intended to influence reviews. [Airbnb's Off-Platform Policy](https://www.airbnb.com/help/article/2799) and [Reviews Policy](https://www.airbnb.com/help/article/2673) need to be treated as launch constraints.

Recommended provider-specific behaviour:

- **Airbnb properties:** DigiStayBook operates as a memory wall and house guide, without review-copy prompts.
- **Other providers:** Enable review prompting only after their policies have been checked.
- Keep the universal copy button only as a generic convenience unless the provider permits review reuse.

## 2. Moderation design is internally contradictory

The BOP requires posts to publish immediately but also says image and text AI moderation protects the wall before harmful content appears. An asynchronous scan cannot guarantee both.

It also says severe content should be “hard-deleted” and routed to an internal review queue. Deleted content cannot subsequently be reviewed. The safe model is:

- Upload into private quarantine.
- Create the post with a `processing` status.
- Run text and image screening server-side.
- Publish a sanitised public projection only after passing.
- Move ordinary flags to host review.
- Move critical flags to a restricted internal case with tightly controlled retention.
- Never expose quarantine files through public Firebase Storage URLs.

Google Vision SafeSearch reports categories such as adult, racy, violence, medical and spoof content; it should not be represented as reliable CSAM detection. See the [Google Vision SafeSearch documentation](https://docs.cloud.google.com/vision/docs/detecting-safe-search).

## 3. The legal copy conflicts with the product

The Terms say DigiStayBook does not pre-screen content, while the product requires automated pre-screening.

Other conflicts include:

- “Permanent visual legacy” versus deletion when a subscription ends.
- Immediate hard deletion versus internal review.
- No guest support versus the need to accept guest privacy and safety requests.
- Device fingerprinting and permanent IP bans are not properly disclosed.
- Account data “waiting” after cancellation versus deletion at termination.
- Anonymous guest editing relies on Firebase Anonymous Authentication and local browser state, despite the broad “no guest accounts” wording.
- The document skips Part 7.

The legal text should be professionally reviewed before publication.

## 4. Retention is not defined consistently

The BOP currently suggests several incompatible outcomes:

- Unactivated properties are deleted after 30 days.
- Cancelled users are contacted after 90 days.
- The cancellation email says their data will be waiting.
- The Privacy Policy says property data will be deleted after termination.
- Severe moderation evidence may need a separate retention and legal-hold policy.

A concrete retention matrix is required for drafts, cancelled properties, guest content, public media, billing records, security logs, reports and critical moderation cases.

## 5. Anonymous reporting can be weaponised

Allowing any anonymous visitor to instantly hide any post creates a simple denial-of-service attack.

The implementation should preserve the immediate privacy response but require:

- A server-controlled report endpoint.
- Firebase App Check.
- Rate limiting and deduplication.
- Per-device or session limits without invasive fingerprinting.
- Audit records.
- Automatic restoration and escalation rules for abusive reports.

Firebase recommends App Check for protecting Firebase and custom backend resources from unauthorised clients. See the [Firebase App Check guidance](https://firebase.google.com/docs/app-check/web/custom-resource).

## 6. Billing implementation differs from DigiGuestbook — not a BOP conflict

> **Classification:** This is an implementation difference from DigiGuestbook, not a conflict with the BOP pricing model. The BOP's pricing and subscription requirements remain authoritative.

DigiGuestbook's current primary purchase path uses Stripe Checkout in one-time payment mode. DigiStayBook needs recurring subscription mode with:

- One subscription per property.
- A 28-day trial only for the first activated property.
- Immediate billing for additional properties.
- Monthly and annual recurring prices.
- Server-owned activation state.
- Stripe webhook idempotency.
- End-of-period cancellation.
- A 14-day failed-payment grace period.
- Stable QR routing to an offline page after suspension.

Stripe supports subscription trials, discounts and a hosted customer portal for billing and cancellation. See [Stripe trials](https://docs.stripe.com/billing/subscriptions/trials), [Stripe discounts](https://docs.stripe.com/payments/checkout/discounts) and the [Stripe customer portal](https://docs.stripe.com/customer-management).

## 7. Tax and marketing claims need revision

“100% tax deductible” is too absolute. The Australian Taxation Office says software subscriptions may be deductible, but only the eligible business-use portion is claimable. See the [ATO guidance for digital product expenses](https://www.ato.gov.au/api/public/content/38c3ae45698e4a39a0981a6610bea998?v=194e431b).

Recommended wording:

> “DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances; seek tax advice.”

The abandoned-property and win-back email sequences are commercial marketing. In Australia, they require appropriate consent, sender identification and a functional unsubscribe facility. See the [ACMA Spam Act guidance](https://www.acma.gov.au/Industry/Marketers/Anti-Spam/Ensuring-you-dont-spam/key-elements-of-the-spam-act-ensuring-you-dont-spam-i-acma).

## 8. Security emails are more complex than the BOP implies

Standard Firebase Authentication triggers cover account creation and deletion, not every password or email change. New-login alerts using IP address and user-agent information require a custom authentication flow or Firebase Authentication with Identity Platform blocking functions. See [Firebase Authentication triggers](https://firebase.google.com/docs/functions/1st-gen/auth-events) and [Identity Platform blocking functions](https://firebase.google.com/docs/auth/extend-with-blocking-functions).

These emails should either be:

- Implemented through explicit DigiStayBook-managed account actions and Identity Platform; or
- Reduced to Firebase's supported password-reset and verification messages for the MVP.

