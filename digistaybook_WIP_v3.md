# DigiStayBook: Consolidated Business & Operational Plan
**Target Audience:** Joseph (Operations) & Cara (Lead Developer)  
**Project Blueprint:** B2B Short-Term Rental SaaS  
**Status:** Work In Progress (WIP)
**Revision:** v3 — Guest-experience marketing, booking-provider boundary and Guest Wall micro-branding
**Revision Date:** 4th August 2026

**Stable requirement ID convention:** Each normative section carries a permanent identifier in the form `DSB-BOP-P<part>-<number>`. Appendix email templates use a child suffix such as `DSB-BOP-P9-001A`. IDs must never be renumbered or reused when content moves or is retired. Implementation work, tests, decisions and GitHub issues/commits should cite the applicable ID; new requirements receive the next unused ID in their Part.

---

# Part 1: Core Host Value Proposition

## 1.1 Supporting a More Personal Guest Experience ("Friend vs. Stranger" Mindset) [DSB-BOP-P1-001]

**The Problem:** Fully automated check-ins can feel impersonal and may reduce a guest's sense of connection with the property. Hosts may also find it harder to present welcoming information and shared memories in one accessible place.
**The Solution:** DigiStayBook is designed to make the stay feel warmer and more personal by presenting useful property information and a visual timeline of shared memories. This may encourage more considerate engagement with the home, but it does not guarantee cleanliness, rule compliance or reduced property damage.
## 1.2 Enhanced Guest Experience and Potential Review Benefits [DSB-BOP-P1-002]

**The Problem:** Fully automated stays can feel impersonal, while static paper guestbooks and fragmented house information add little to the guest experience.
**The Solution:** DigiStayBook gives guests a warmer, more useful and more memorable way to engage with the property. A visual memory wall, welcoming host content and accessible house information can help the stay feel more personal and considered.
**Commercial Rationale:** A better overall guest experience may encourage guests to share more positive feedback through the official booking provider after their stay. This is a potential downstream benefit of improving the stay, not a guaranteed outcome or a review-generation function.
**Approved Marketing Position:** Public advertising may state: "Create a more memorable guest experience—one that may encourage guests to share more positive feedback on their official booking platform."
**Operational Boundary:** DigiStayBook will not ask guests for a particular rating, prompt them to copy content into a provider review, provide review-transfer instructions, pre-fill review text, deep-link into a provider review form, or condition any feature or benefit on leaving a review. Guest contributions remain memories for the DigiStayBook wall.
**Provider Responsibility:** Any host communication requesting a review must occur through the host's official booking-provider workflow and must comply with that provider's current policies. DigiStayBook does not claim that using the service guarantees higher ratings, additional reviews or a specific commercial result.
## 1.3 Zero-Friction Guest Experience [DSB-BOP-P1-003]

No App Downloads or Passwords: Guests scan the counter QR code and instantly access the wall. There are no account setups, app installations, logins, or upsell popups standing in their way.
Overcoming Blank Page Anxiety: Guests can quickly upload photos and/or messages, creating a lasting visual legacy that remains active for as long as the host maintains their subscription.
## 1.4 Minimal Operational Overhead for Hosts [DSB-BOP-P1-004]

Automated Moderation & Quarantine Architecture: Hosts don't need to spend hours manually messaging guests or managing software bloat. To protect the host's brand and listing reputation without sacrificing the speed of the guest experience, the platform utilizes a secure "Quarantine-First" architecture. When a guest submits a post, the files are uploaded to a private, non-public storage bucket, and the post is temporarily assigned a processing status.
Sub-Second AI Screening: While the guest sees a brief, optimistic loading state (e.g., "Securing your memory..."), a dual-layer moderation system runs server-side: a lightweight AI image moderation API (e.g., AWS Rekognition/Google Cloud Vision SafeSearch) and a concurrent text-filtering API (including string-matching for profanity and sentiment analysis). To comply with biometric privacy laws (e.g., BIPA, EU AI Act), the AI solely scans for unsafe/explicit content. No biometric data or facial recognition templates are generated, extracted, or stored from guest images.
Safe Routing Logic: Based on the server-side scan, the system executes one of three actions:
Clear (Instant Gratification): If no flags are detected, the post's status updates to published, moving the assets to the public wall instantly.
Standard Flag (Host Review): If an image is flagged for standard NSFW/racy content, or if text contains profanity, negative sentiment, or competitor URLs, the post remains in private quarantine and is routed to "Pending Host Approval". The guest immediately sees a graceful "Pending" UI state stating: "Memory added! Your host is reviewing this post to add it to the public wall." This keeps standard curation as the host's responsibility.
Tier-2 Internal Trust & Safety Escalation (Bypass Protocol): The platform utilizes a secondary, critical-severity threshold. If the AI moderation API detects severe violations (such as explicit violence or severe hate speech), the system bypasses the host entirely. The post is blocked from the public wall and routed to a restricted internal DigiStayBook Admin Trust & Safety queue. Unresolved cases are reviewed at least every 30 days. Unless legal counsel confirms a reporting, preservation or legal-hold requirement, critical media is deleted no later than 30 days after case closure and restricted case metadata is deleted after 12 months. Any content flagged as severe legal liability (e.g., CSAM) is immediately locked down from public view. All mandatory government/authority reporting protocols require manual verification by the Internal Operations Team to prevent false-positive automated reports.
Automated Privacy Takedowns & "Right to be Forgotten" Routing: Every public post features a "Report" flag with a specific "Privacy - I want my content removed" reason. A report accepted by the server hides the post immediately and creates a `hidden_pending_review` case for the Host. An active session deleting its own post also hides it immediately and schedules deletion. If a privacy request is unresolved after 14 days, it escalates automatically to Privacy & Safety Operations and the approved deletion workflow. The only visibility exception is a report from a reporter already in an active abuse/circuit-breaker state; that report is recorded as `suspected_abuse_no_visibility_change` and does not hide the targeted post unless an internal reviewer or separate credible report restricts it.
Anti-Abuse Safeguards (The Circuit Breaker): All reports use a server-controlled endpoint with Firebase App Check, transaction-safe post/report updates, same-session/same-post deduplication and short-lived pseudonymous rate-limit keys. A reporter enters a 24-hour suspected-abuse cooldown after reporting 3 distinct posts on the same wall within 10 minutes or 5 distinct posts within 24 hours. A wall-level circuit breaker also trips when 5 distinct posts are reported within 10 minutes across related reporter signals. Confirmed malicious reporting may create a proportionate restriction, linked only to a keyed hash of the existing Firebase anonymous/account UID, for up to 90 days; it does not create a new cross-device identity. Reports received during a circuit-breaker state are never silently dropped: they are logged, acknowledged neutrally, routed for internal review and leave visibility unchanged. Earlier hidden posts remain pending review and are not automatically restored merely because the breaker later trips.
Simple Curation: Hosts can quickly hide or delete unwanted posts from a clean dashboard grid whenever they check in on their stay.
No Guest Support Fatigue: The guest portal strictly prevents guests from using the platform to send direct messages to the host, protecting the host's inbox.
## 1.5 Commercial Value and Potential Operational Benefit [DSB-BOP-P1-005]

Operational Expense: DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice.
Practical Value: For a monthly or annual subscription, Hosts gain a way to improve the guest experience, make property information easier to access and build a more memorable stay. These improvements may support more positive Guest sentiment and feedback, but no review, savings, property-protection or revenue outcome is guaranteed.
## 1.6 Supplementary Utility: On-Demand House Information & Local Rules [DSB-BOP-P1-006]

Beyond serving as an interactive visual guestbook, hosts can leverage their digital wall as a lightweight digital house manual. By pinning informational posts to the top of the canvas, hosts can seamlessly display essential stay details—such as waste management schedules, amenity guidelines (e.g., pool or HVAC instructions), kitchen inventory locations, and general house rules. This provides guests with immediate, frictionless access to key stay operational information upon scanning the QR code, reducing repetitive messaging inquiries and improving rule compliance.
### 1.6.1 Pinned Post Categories & Content Guidelines [DSB-BOP-P1-007]

To ensure hosts get the most value out of the digital house manual feature, we provide the following core pinned message suggestions:
The "How-To" Guide (Property Amenities)
- **Purpose:** Preempt common guest questions and potentially reduce repetitive host support messages.
Suggested Host Content: Wi-Fi network and password (or a scan-to-connect QR code screenshot), Climate control instructions (AC/Heating quirks, remote locations), Waste management rules (specific bin days and lid colors), and instructions for any specific or complex house tech.
Local Hotspots & Hidden Gems
- **Purpose:** Reinforce the "staying at a friend's house" mindset by providing authentic, localized recommendations rather than generic tourist lists.
Suggested Host Content: Top local eats broken down by cuisine/craving, the best local spots for sunset or scenic views, family-friendly daytime activities, and authentic community events.
The Frictionless Checkout Guide
- **Purpose:** Protect the physical asset and set clear expectations for cleaners without making the guest feel like they are doing unpaid labor. (Advise hosts to keep this to 3-5 brief bullet points).
Suggested Host Content: Dishwasher instructions (e.g., load and start on normal cycle), power and climate down reminders (turn off AC and lights), rubbish removal (tie up bags and place in outdoor bins), exact lock-up and keybox procedures, and a final invitation to add a memory to the digital wall.
The "Meet the Host" / Property Journey Pin
- **Purpose:** Humanize the property and help guests understand the care invested in it. This may encourage more considerate behaviour, but it does not guarantee reduced damage.
Suggested Host Content: A brief, welcoming story about the home, a photo of the host/family, or "before and after" photos showing the sweat equity and care put into the property's renovations.
# Part 2: Interactive Demo Wall & Dual Display Architecture

## 2.1 Pre-Purchase Sandbox & Customization [DSB-BOP-P2-001]

Host Sandbox Mode: Prior to subscription activation, hosts have full access to an interactive "Demo Wall" workspace where they can upload custom photos, write preliminary welcome notes, and experiment with spatial layouts.
Pre-filled Dummy Data: To eliminate the sterile "blank wall" feeling, the Pre-Purchase Sandbox is pre-populated with 10 high-quality, dynamic dummy posts. This immediately demonstrates the platform's value and visual appeal to the host.
Anti-Blank Wall Setup (Seeding): Before going live, hosts must ensure the digital wall contains at least one foundational item. They can either upload a custom "Foundational Post" (such as a welcome text message or a photo of the property) or carry over a generic placeholder post (e.g., a "Welcome to our home!" graphic) from the Sandbox. This is designed to reduce the likelihood that the first scanning guest encounters an empty wall.
Revenue Guardrail: While hosts can test layouts in real time, live public routing links and high-resolution downloadable QR placards remain hard-locked until a valid payment method is securely authorized via Stripe.
## 2.2 Layout Control & Content Hierarchy [DSB-BOP-P2-002]

Mobile-First Chronological Feed: Designed for phone browsers, the primary feed renders chronologically with the newest guest posts appearing at the top.
Featured & Pinned Content: Hosts retain full editorial control to override standard chronological order:
Host Featured Posts: Hosts can specify custom messages or house guidelines to sit permanently at the top of the mobile view.
Guest Pinning: Hosts can select high-value guest photos and messages to be "pinned" to the top of the feed.
Standard Stream: All non-pinned guest contributions flow directly beneath featured content in reverse-chronological order (newest first), giving checking-in guests instant feedback upon posting.
## 2.3 Physical-First QR Architecture (MVP Focus) [DSB-BOP-P2-003]

To ensure "Zero Operational Overhead," the MVP strictly relies on physical, printed QR placards placed in the property. This completely eliminates hardware dependencies, Wi-Fi reconnection issues, and battery management requirements associated with in-stay tablet displays, ensuring the system is always online and maintenance-free for the host.
## 2.4 Guest Contribution & Self-Service Management [DSB-BOP-P2-004]

Multi-Image Batch Uploads: Guests can attach and submit up to 10 images simultaneously in a single post.
The Universal Copy Button: Every guest post rendered on the live chronological wall may feature a lightweight "Copy Text" button (or a simple clipboard icon) embedded within the text block. When a guest taps this button, the text is saved to their device's clipboard, and the icon temporarily transforms into a green checkmark accompanied by a "Copied!" notification. This is a general accessibility and personal-use convenience only; the interface does not connect it to a booking-provider review workflow.
Frictionless Post Editing: To ensure a smooth experience, guests are provided with instant self-service controls allowing them to edit text or delete their submitted posts at any time without requiring host intervention.
Graceful Pending UI State: To prevent guests from assuming the app is broken if their post is caught by the AI moderation filters (including false positives), the client-side upload tool must handle flagged content gracefully. Instead of a standard post appearing in the feed, the guest receives a specific success modal: "Memory added! Your host is reviewing this post to add it to the public wall." This prevents frustrated guests from repeatedly attempting to upload the same images.
Automated Takedown / The Privacy Request Modal (Secured): Every post on the public wall features a subtle "Report" icon. The modal collects a reason, including "Privacy - I want my content removed," and sends it to the server-controlled reporting endpoint. When the server accepts an ordinary report, the post is hidden immediately and routed to the Host's Privacy & Takedown Requests queue. If the Host does not resolve a privacy request within 14 days, it escalates automatically to Privacy & Safety Operations and the approved deletion workflow.
Graceful Rate Limiting: The client displays the same neutral acknowledgement for every syntactically valid report: "Report received. It will be reviewed." It does not claim that deletion was approved or reveal whether visibility changed. The server verifies App Check, deduplicates the same reporter/post combination, applies the per-reporter and per-wall thresholds, and records the outcome. Reports in a circuit-breaker state are retained for internal review rather than silently discarded.
### 2.4.1 Authoritative Reporting State Model [DSB-BOP-P2-005]

All visibility changes and report status transitions are owned by one transactional server endpoint; the client and direct Firestore writes cannot hide, restore or delete another Guest's post.

- `self_delete_scheduled`: An authenticated anonymous Guest session deletes its own post. The post hides immediately, deletion is scheduled and no Host verification is required.
- `hidden_pending_review`: The server accepts an ordinary report from a reporter who is not in an abuse state. The post hides immediately, the Host is notified and the 14-day privacy SLA begins where applicable.
- `suspected_abuse_no_visibility_change`: The reporter or wall circuit breaker is active. The report is recorded and routed internally, but the report does not change the post's current visibility.
- `confirmed_delete`: The Host or Privacy & Safety Operations confirms deletion. Active copies delete within the retention schedule deadline.
- `rejected_restored`: A report is rejected after review and no other open report or safety restriction applies. A previously hidden post is restored and the reporter outcome is added to the audit trail. A Host rejection alone does not mark a reporter as malicious; confirmed abuse requires the threshold or an internal determination.

**Reporter limits:** Same reporter plus same post is deduplicated for 24 hours. Short-lived rate-limit keys rotate after 24 hours. Reporting 3 distinct posts on one wall within 10 minutes or 5 within 24 hours starts a 24-hour suspected-abuse cooldown. Two internally confirmed malicious-reporting cases within 90 days may create a restriction, linked to a keyed hash of the existing Firebase anonymous/account UID, lasting no more than 90 days. A cleared browser/session cannot be correlated through a newly invented device identity. Reporter restrictions expire automatically.

**Wall circuit breaker:** Five distinct posts reported within 10 minutes across related reporter signals pauses new report-driven hides for that wall, alerts Privacy & Safety Operations and leaves already hidden posts in review. An internal reviewer can still restrict a credible urgent safety report while the breaker is active.

**Audit and notifications:** Every transaction records the report ID, post/wall IDs, pseudonymous reporter key, reason, App Check result, threshold counters, previous/new visibility, status, timestamps and resolver without copying the reported media into the audit event. Hosts receive an immediate notification for `hidden_pending_review`; circuit-breaker activity produces an internal alert. Restoration occurs only when the report is rejected and no other restriction remains.
The Consent Checkbox (Micro-Friction): To legally protect the host, the upload flow features a mandatory, single-tap checkbox immediately above the "Submit" button explicitly linking to both documents, stating: "I agree to the Guest Terms and Privacy Policy, consent to this image being displayed publicly, and confirm I am over 16 years of age." This logs timestamped consent without requiring an account.
The Dynamic Photo Challenge Dropdown: To cure guest "blank page anxiety," the upload page will feature a dynamic writing prompt. To ensure zero operational burden for the host, they will simply select their preferred prompt from a pre-written dropdown list in their dashboard (which they can change over time). Examples of these prompts include:
"Who made the best breakfast this morning?"
"Show us your best sunset or sunrise view!"
"Group selfie time! Show us the whole crew."
"What was the absolute best meal you ate nearby?"
"Capture the absolute coziest spot you found in the house."
The Private Feedback Safety Net: On the guest upload page, add a secondary, optional text-only form titled "Private Feedback / Help Us Improve." This allows guests to share practical suggestions privately with the host (e.g., "we couldn't find the AC remote" or "where do you keep the spare towels?"). The host can use this feedback to improve their pinned house manual posts and the experience for future guests.
Operational Guardrail: To ensure this does not violate the "No Guest-to-Host Messaging" rule or become a live help desk, the UI must include explicit microcopy setting boundaries and assuring privacy. It must state: "Note: This feedback is kept strictly private and will not be published to the public memory wall. It is not monitored in real-time and your host will not reply here; it is strictly used to improve our house manual for future guests. If you need immediate assistance during your stay, please message your host directly through your booking app."
# Part 3: Commercial Strategy & Resource Allocation

## 3.1 Core Focus [DSB-BOP-P3-001]

This product operates strictly in the B2B short-term rental market.
## 3.2 Operational Boundary (Support Level) [DSB-BOP-P3-002]

To protect operational capacity and eliminate administrative support fatigue, the platform enforces strict communication boundaries:
No Guest-to-Host Messaging: The platform will explicitly not feature a direct communication link or messaging system between guests and hosts. Guests cannot message hosts to ask questions or request support. However, guests are permitted to send one-way, text-only private feedback upon checkout (e.g., reporting a broken appliance), which does not require or allow a host reply. If a guest has an issue with the property, they must contact the host through their original booking provider (e.g., Airbnb, VRBO, Booking.com).
No Guest Stay Support: DigiStayBook does not provide booking, property, maintenance or in-stay support to guests. Guests seeking help with their reservation or the property are directed to the host through their original booking platform. This boundary does not prevent a guest from contacting DigiStayBook through the public Privacy & Safety route about personal-data rights, content safety or the operation of DigiStayBook's reporting tools.
No Maintenance Ticketing: In-app "maintenance reporting" or "issue ticketing" features will NOT be built, as they violate the core tenet of zero administrative burden for the host. All stay-related issues must remain on the primary booking platform.
Host-Initiated Malicious Guest Escalations: To protect hosts from targeted harassment or spam without pulling internal operations into standard guest-to-host disputes, Hosts are provided a "Report to Platform" option in their dashboard for severe offenses only. This routes the report and relevant security context to Internal Operations. Proportionate controls may include rate limits, duplicate-report suppression, temporary session restrictions and short-lived pseudonymous abuse keys. These controls do not create persistent cross-session identifiers, and security records are retained only for the bounded period defined in the approved retention schedule.
## 3.3 Onboarding & Revenue Safeguards [DSB-BOP-P3-003]

To accommodate multi-property hosts and delay payment friction, the system enforces a strict multi-stage boundary:
Account Setup: The host registers using a standard email/password combination or via single sign-on (SSO) options (e.g., a Google Account). They are not asked for property details or payment at this stage. The registration form includes a clear, un-ticked checkbox requesting explicit consent to receive marketing and promotional communications. The consent event stores the Host UID and normalised address, UTC timestamp, form/source identifier, exact consent wording and version, and resulting consent status. Consent is not inferred from account creation or acceptance of the Terms.
Property Creation & The Pre-Activation Gate: The host adds a property from their dashboard and completes the "Anti-Blank Wall Setup" by either uploading a custom post or selecting a default placeholder. They have full access to the dedicated Property Page to customise themes and view a live preview, but live routing URLs and downloadable QR code kits remain hard-locked until activation. A booking-provider listing URL is not required for a review prompt or review-transfer feature.
Checkout: The host clicks 'Activate Property' and completes the checkout flow via the payment processor. Only when a valid payment method is successfully authorized (or a 100% discounted total via coupon is confirmed) does that specific property become active, unlocking link generation and dynamic QR compilation.
## 3.4 Dynamic Billing Architecture [DSB-BOP-P3-004]

Tiers: Monthly Subscription (~$USD10/mo) and Annual Subscription (~$USD100/yr).
Localization Rules: Prices must render in the host's native point-of-sale currency (e.g., AUD, GBP, EUR, USD) and must be cleanly rounded to the nearest whole unit.
Promo/Coupon Codes: The checkout infrastructure must include a field for Stripe promotional codes. While not actively marketed at MVP launch, this feature allows for future promotional campaigns and, crucially, enables internal testing in the live production environment (e.g., using a 100% off coupon to activate a property) without incurring actual Stripe charges.
Renewals: Handled automatically on a recurring basis at the locked-in localized rate. No manual invoicing required.
Checkout Microcopy & Stripe Compliance: The checkout page must display clear terms to prevent chargebacks, structured as follows:
Option A (For Monthly Subscriptions): "Start your 28-day free trial. By providing your payment information and clicking 'Start Trial,' you agree to our Terms of Service and Cancellation Policy. You will not be charged today. After your 28-day free trial ends on {Dynamic Date: e.g., August 30, 2026}, your subscription will automatically renew at ${Price}/month until you cancel. You can cancel at any time in your Host Dashboard with one click."
Option B (For Annual Subscriptions): "Start your 28-day free trial. By providing your payment information and clicking 'Start Trial,' you agree to our Terms of Service and Cancellation Policy. You will not be charged today. After your 28-day free trial ends on {Dynamic Date: e.g., August 30, 2026}, your subscription will officially begin, and your card will be charged ${Price} for your first year. It will automatically renew annually until you cancel. You can cancel at any time in your Host Dashboard with one click."
Implementation Notes for Stripe: The checkout page must dynamically calculate and display the exact date the trial ends (do not just say "in 28 days"). Additionally, include a required explicit consent checkbox next to the disclaimer that says, "I understand I will be billed ${Price} on {Date} if I do not cancel."
## 3.5 Marketing Positioning and Booking-Provider Boundary [DSB-BOP-P3-005]

DigiStayBook's marketing may emphasise that a welcoming, useful and memorable digital guest experience can improve overall guest sentiment and may encourage guests to leave more positive feedback on their official booking platform.

Approved host-facing marketing themes include:
- "Create a more memorable guest experience."
- "Help every stay feel personal, welcoming and well supported."
- "A better guest experience may encourage more positive feedback on the official booking platform."

Marketing must present improved reviews as a possible indirect benefit, not as a guaranteed result. Advertising must not promise a particular star rating, a guaranteed increase in review volume, higher revenue or preferred treatment by a booking provider. Guest-facing product flows must not request a particular rating, solicit a provider review, transfer guestbook content into a provider review, or direct a guest into a provider review form.
# Part 4: Operational Workflows & Communications

**Document hierarchy:** Part 4 is the authoritative source for operational triggers, classifications, controls, timing and lifecycle requirements. Part 9 is an appendix containing the corresponding implementation-ready email copy and templates. The brief email descriptions in Part 4 are intentional operational summaries, not duplicate template copy. If an Appendix template conflicts with Part 4, Part 4 controls and the Appendix must be corrected.

## 4.0 Commercial Messaging Compliance (Spam Act 2003) [DSB-BOP-P4-001]

Every outbound email is classified before implementation. Transactional emails are limited to information necessary to create, secure, operate or bill the account/property and must not contain promotional copy. Marketing emails require recorded consent and a successful central-suppression check immediately before sending.

Every commercial message must include clear DigiStayBook sender identification, valid contact details and a functional one-click unsubscribe mechanism that remains available for at least 30 days. Unsubscribe requests must update the central suppression state across all promotional sequences within five working days, with immediate suppression as the operational target.

The central marketing-preference service stores Host consent evidence and a minimal suppression record separately from product content. Every cart-abandonment, onboarding promotion, activation nudge, ROI milestone, win-back, affiliate promotion and future promotional sequence must query this service at send time and fail closed if consent or suppression status cannot be confirmed. Account, property or content deletion must not remove the minimum suppression value required to prevent future marketing. Verified re-consent must create a new versioned consent event rather than overwriting the historical withdrawal.

| Email or sequence | Classification | Consent and suppression rule | Content boundary |
|---|---|---|---|
| Account creation confirmation | Transactional | Sent because the Host created an account | Confirm account creation and secure dashboard access only; no trial or sales CTA |
| Property activation and QR delivery | Transactional | Sent because a property was activated | Deliver QR assets and essential setup information only |
| Moderation, privacy and takedown alerts | Transactional | Sent because an actionable content event occurred | Describe the event and required action only |
| Trial-expiry, annual-renewal, receipt, card-expiry, failed-payment, suspension and cancellation notices | Transactional | Sent because of a billing/service event | Billing or service facts only; no promotional benefit or tax advice |
| Password reset, password/email change and security alerts | Transactional | Sent because of an account-security event | Security and recovery content only |
| Onboarding tips beyond essential service setup | Marketing | Recorded consent plus send-time suppression check | May explain product benefits without absolute outcomes |
| Cart-abandonment sequence | Marketing | Recorded consent plus send-time suppression check for every message | Sender/contact/unsubscribe required |
| Activation nudge and ROI/engagement milestones | Marketing | Recorded consent plus send-time suppression check for every message | Sender/contact/unsubscribe required; metrics must not be presented as proof of outcomes |
| 90-day win-back | Marketing | Recorded consent, dormant-property eligibility and send-time suppression check | Sender/contact/unsubscribe required |
| Affiliate payout notice | Transactional | Sent because a commission was earned | Payout facts only; no encouragement to promote further |
| Affiliate recruitment, sharing prompts or campaign updates | Marketing | Recorded affiliate marketing consent plus send-time suppression check | Sender/contact/unsubscribe required |

Before enabling any marketing sequence, automated tests must prove that an unticked consent box, withdrawn consent, a suppression record, missing preference-service response or deleted account prevents the send. Tests must also prove that transactional templates do not contain configured promotional blocks.
## 4.1 Host Email Lifecycle [DSB-BOP-P4-002]

The Account Creation Confirmation: Fired instantly when a Host signs up via email or SSO. It confirms account creation, identifies the account email and links to the secure dashboard. It is transactional and contains no trial, upgrade or promotional CTA. Optional onboarding promotions are a separate marketing sequence requiring consent.
The Property Activation (Asset Delivery): Fired every time a host successfully completes checkout and activates a property (whether it is their first or fiftieth property). It delivers the specific high-resolution QR code kit for that location and prompts the host to manage their foundational posts.
The Moderation Alert (AI or Guest Flag): Fired when the AI moderation system flags a guest post or when the reporting endpoint changes a post to `hidden_pending_review`. It prompts the Host to review the hidden content. Reports that produce `suspected_abuse_no_visibility_change` create an internal Privacy & Safety alert instead of incorrectly telling the Host that a post was hidden.
Trial Expiry Notice: As a courtesy, an automated email reminder is sent to the host's registered email address prior to the conclusion of their 28-day free trial.
Automated Monthly Receipts: Delivered immediately after the billing cycle with a clean, itemised invoice and the wording "Keep this invoice for your records." The receipt is transactional and contains no tax advice or promotional copy. General upcoming renewal reminders for standard paid monthly subscriptions are not sent; annual renewal and initial trial-expiry notices remain separate transactional messages.
Card Expiring Soon (Pre-Dunning): Fired automatically via Stripe 30 days before the active credit card on file expires to preemptively avoid failed payments and grace periods.
Failed Payment Flow (The Grace Period): Fired immediately if a payment fails. The system grants a 14-day soft grace period where the property memory wall remains fully active for checking-in guests to better accommodate B2B operators. The email provides a polite warning and a secure link to update payment details before suspension.
Service Suspension (The Final Notice): Fired immediately after the 14-day soft grace period concludes following a failed payment. Confirms that the QR code is now deactivated and provides a "Reactivate Now" link to restore service. Crucially, deactivated QR codes do not lead to a broken URL or standard 404 error. Instead, they route to a beautifully designed, professional fallback page that simply states: "This property's digital guestbook is temporarily offline." This protects the host's professional image with their in-house guests even if they missed a payment.
Cancellation Confirmation: Fired instantly upon dashboard account closure, confirming the termination and noting the precise date service will cease.
## 4.2 Lead-Nurturing Cart Abandonment Sequence [DSB-BOP-P4-003]

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
Trigger: Fires if a host names a property but exits before clicking "Activate Property" and completing checkout. (Note: This sequence only fires if the host explicitly checked the marketing consent opt-in box during Account Setup).
Email 1 (1 Hour Post-Abandonment): Initial check-in asking if they hit a snag, directing them to the FAQ and explaining the intended guest-experience value without promising changes in guest behaviour or property outcomes.
Email 2 (24 Hours Post-Abandonment): Focuses on the guest-experience value—explaining that a warmer, more useful and memorable stay may encourage more positive feedback on the host's official booking platform, without guaranteeing a review outcome.
Email 3 (3 Days Post-Abandonment): May state: "DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice." It must not claim guaranteed property protection, savings or financial returns.
Email 4 (Day 23 Post-Abandonment): Final seven-day warning that the unpaid property draft is scheduled for deletion on Day 30. The message must show the exact deletion date and must not imply the draft will remain available afterward.
## 4.3 Retention & Engagement Lifecycle [DSB-BOP-P4-004]

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
The "Activation" Nudge (Day 7 Check-in):
- **Trigger:** Fires 7 days after a Host successfully activates a property (initiating their free trial) only if the property has zero guest posts. (Note: Only fires if the host opted into marketing communications).
- **Purpose:** Reminds Hosts about QR placement and is intended to reduce the likelihood that a trial ends before the wall receives a Guest contribution.
- **Content:** "Did you get your QR code printed? Here is a quick tip on the best place to display it to get your first guest memory."
Automated ROI Milestone Matrix:
- **Purpose:** To demonstrate guest engagement and house-information utility, the system will track both QR Code Scans and Guest Memories.
The Milestones (Triggers & Content):
10 Scans (The Placement Milestone): Confirms that 10 scans were recorded; it does not prove that every guest read the content.
1st Memory (The First Contribution): Confirms that a Guest added the first memory to the wall; it does not prove a change in sentiment or behaviour.
50 Scans (The Engagement Milestone): Confirms that 50 scans were recorded; it does not prove reduced support demand.
10 Memories (The Engagement Milestone): Shows that multiple guests have actively contributed to the property's shared memory wall.
100 Scans (The Continued-Use Milestone): Reports continued scanning activity without claiming a specific operational outcome.
50 Memories (The Contribution Milestone): Confirms that 50 memories have been contributed without claiming a change in property status or guest behaviour.
Annual Subscription Renewal Warning (Compliance & Trust):
- **Trigger:** Fires 14 days before an Annual Subscription is scheduled to auto-renew.
- **Purpose:** Gives Hosts advance billing transparency and may reduce renewal surprises or avoidable disputes without guaranteeing a reduction.
- **Content:** A polite heads-up that their yearly plan is renewing soon, with a clear link to the dashboard to manage their billing.
The 90-Day Win-Back Campaign:
- **Trigger:** Fires 90 days after a formerly activated property enters the approved dormant-property period following subscription cancellation. It does not use or target an unpaid draft deleted at Day 30. The campaign fires only where valid marketing consent still exists and the address is not on the suppression list.
- **Purpose:** Re-engages churned users by reminding them of the long-term operational and financial value of the platform, avoiding margin-reducing discounts.
- **Content:** "We've added new ways to help you create a warmer, more useful and memorable guest experience. A better stay may encourage more positive guest feedback on your official booking platform. Log back in to reactivate your wall in one click."
## 4.4 Internal Admin Lifecycle & Moderation [DSB-BOP-P4-005]

To protect margins and prevent operational bottlenecking as the platform scales, internal team moderation is strictly limited to an "Escalation-Only" model, managed via a hidden Admin URL (e.g., admin.digistaybook.com).
The Daily Sweep (Operations): The internal operations team executes a single daily review of the "Critical Escalation Queue." This queue only contains items flagged by the AI as severe legal liabilities or manual Host-Initiated Escalations. Operations resolves each case by restricting the content and associated session where proportionate, retaining a restricted case only for the approved review period, securely deleting content when review and legal-retention needs end, or downgrading a false positive to Host Review.
Monthly AI Tuning (Quality Assurance): To ensure the AI moderation filters are not overly aggressive (which creates guest friction), the operations team reviews a random sample of 50 standard AI-flagged posts monthly. If the false-positive rate exceeds acceptable margins, the confidence threshold of the image moderation API is adjusted down to reduce unnecessary "Pending" states.
# Part 5: Future Expansion Roadmap (Post-MVP)

These modules will be built after the MVP is stable. They are focused on scaling acquisition and engagement without adding operational bloat.
## 5.1 Affiliate & Referral Marketing Engine [DSB-BOP-P5-001]

**Goal:** Create an attributable host-acquisition channel through peer-to-peer and influencer referrals without promising a particular conversion or revenue outcome.
**Workflow:** Affiliates generate leads via unique tracking links.
Billing Rule: To prioritize upfront cash flow, commissions are only paid out on Annual Subscription sales. The payout is 40% of the first year's revenue, ensuring the commission dynamically scales with localized pricing (e.g., if a user pays the equivalent of $50 USD in their local currency, the payout is $20 USD).
Affiliate Payout Notification: A transactional email triggered to confirm a successful referral and the applicable payout. It contains the payment facts only. Any request to share again or promote DigiStayBook is sent separately as marketing and requires recorded consent, a send-time suppression check, sender details and unsubscribe.
## 5.2 Contextual Location-Based Writing Prompts [DSB-BOP-P5-002]

**Goal:** Make it easier for guests to begin writing by providing tailored prompts. This may support participation, but no upload-rate increase is promised.
**Workflow:**
Hosts select a property archetype from a predefined list (e.g., Default, Beach, Mountain/Country, Urban/City) within their settings.
When guests scan the QR code, the system reads this archetype and dynamically displays location-aware placeholder text (e.g., "Our favorite hiking trail nearby was..." for Mountain properties).
## 5.3 Dual-Carousel Tablet Display (Enterprise/Pro Tier) [DSB-BOP-P5-003]

**Workflow:** A dedicated UI built for hosts who wish to run a dedicated iPad/tablet on the counter. The interface will feature a left carousel for host-pinned guidelines and a right carousel for live community posts, alongside a persistent on-screen QR code for guests to interact via their personal phones.
## 5.4 Direct Booking Retention Links [DSB-BOP-P5-004]

**Goal:** Give Hosts an optional direct channel for repeat-guest engagement that may reduce some third-party commission exposure where permitted. No repeat-booking, savings or financial-return outcome is guaranteed.
**Workflow:** Subject to booking-provider policy and legal review, allow Hosts to add a permanent direct-booking button or URL to their property feed. The feature must not imply endorsement by, integration with or preferred treatment from a booking provider.
## 5.5 Client-Side Auto-Translation for House Manuals [DSB-BOP-P5-005]

**Goal:** Help international guests understand Host-written guidance by offering convenient machine translation, while clearly warning that automated translations may be inaccurate and do not replace authoritative safety instructions.
**Workflow:** Leverage standard mobile browser APIs to detect the guest's default language and offer a lightweight toggle to auto-translate the host's pinned text (like the Checkout Guide and How-Tos) into the guest's native language.
# Part 6: Website Architecture & Required Pages

This architecture accommodates multi-property hosts, delays payment friction, and centralizes management into a dedicated Property Page.
## 6.1 The Home Page (Main Landing Page) [DSB-BOP-P6-001]

**What to display:**
Main headline and value proposition.
The "About Us" story.
Pricing plans.
The 45-second video preview.
Required Button: "Sign Up or Log In"
**Button Destination:** Directs the user to the Sign-Up/Log-In Page.
## 6.2 The Pricing Page [DSB-BOP-P6-002]

What it’s for: Clearly breaking down the commercial value, the subscription tiers, the 28-day free trial offer, and the financial advantages of the platform to drive account creation and property additions.
**What to display:**
- **Main Headline:** A clear, value-focused statement (e.g., "Make Every Stay More Memorable. Simple Pricing.").
- **Supporting Marketing Message:** "Create a warmer, more useful guest experience—one that may encourage guests to share more positive feedback on their official booking platform."
- **The Free Trial Callout:** A highly visible banner stating that hosts receive a 28-day free trial for their first property. The copy must clarify the workflow: "Create your account and add your first property to activate your 28-day free trial."
The Pricing Tiers (Toggle or Side-by-Side):
Monthly Subscription: ~$USD10/mo. Must render dynamically in the host's native point-of-sale currency (e.g., AUD, GBP, EUR, USD) and be cleanly rounded to the nearest whole unit.
Annual Subscription: ~$USD100/yr. Must also render dynamically in the host's local currency and visually highlight the built-in discount (e.g., "Get 2 months free").
Unified Feature Checklist: Because both tiers offer the exact same complete platform, display a single bulleted checklist confirming everything is included regardless of the tier chosen (e.g., unlimited uploads, QR kit, dashboard moderation).
- **Multi-Property Note:** A brief explanation stating that billing is calculated per property, but all properties are managed seamlessly from a single host dashboard.
- **The ROI & Tax Callout:** A dedicated section using only this wording: "DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice."
- **Trust & Cancellation Note:** A brief sentence stating, "Cancel anytime before your next billing cycle," with a hyperlink directly to your Cancellation & Billing Policy.
Required Buttons (Conditional Logic):
If the user is NOT logged in: "Create Free Account" or "Sign Up & Claim Trial".
If the user IS logged in: "Go to Dashboard" or "Add a Property".
Button Destinations:
If the user is NOT logged in: Directs the user to the Sign-Up Page to create their credentials.
If the user IS logged in: Bypasses the sign-up flow entirely and directs the host straight to their Host Control Center (The Dashboard).
## 6.3 Sign-Up / Log-In Page [DSB-BOP-P6-003]

**What to display:** A streamlined form featuring one-click social login options (e.g., "Continue with Google") alongside standard email and password creation/entry. Hosts are not asked for their property name or directed to pay at this stage.
**Required Buttons:** "Continue with Google" (or similar SSO), and the standard "Submit" or "Create Account" / "Log In" buttons.
**Button Destination:** Directs the host immediately to their Dashboard (Host Control Center).
## 6.4 Host Control Center (The Dashboard) [DSB-BOP-P6-004]

**What to display:**
A list of every property the host manages.
Clear status indicators next to each property showing if it is in "Active" (paid) or "Unpaid" mode.
**Required Buttons:**
"Add Property"
individual property links/cards.
**Button Destination:**
"Add Property" opens a prompt to name and create a new property listing.
Clicking on any specific property directs the host to that location's dedicated Property Page.
## 6.5 Property Page (Dedicated Management Hub) [DSB-BOP-P6-005]

**What to display:** This is the core control center for a specific property.
Design Controls: Options to change themes, layouts, and how the guestbook displays (e.g., Mosaic display, Spotlight display).
Preview Mode: A live preview module allowing the host to see how the guestbook will look with different themes applied.
Content Management: Sections to view all guest uploads, as well as the host's personal uploads and featured photos. Additionally, an "Inbox" or "Feedback" tab where private guest feedback messages are silently logged for the host to review at their convenience, completely separate from the public Guest Wall. The Content Management tab must also include a dedicated "Privacy & Takedown Requests" queue. This area isolates posts that guests have flagged for privacy removal, allowing the host to easily execute a one-click "Confirm Permanent Deletion" action to satisfy their legal requirements as a Data Controller.
Visibility Controls: Toggles allowing the host to choose whether guest messages or guest-uploaded photos are viewable on the public property wall.
**Required Buttons:**
QR & Sharing Buttons: "Print QR Code", "Download QR Code", "Email QR Code", and "Copy Link to Property".
Content Buttons: "Upload" (for host features/photos), "Pin" (to stick host or guest posts to the top), and "Delete" (to remove customer uploads).
Payment Controls: "Activate Property" or "Pay Now" button (visible if the property is in unpaid mode). This section must also include a Coupon Code input field allowing users to apply discounts prior to finalizing the transaction.
**Button Destination:**
Sharing buttons trigger local device actions (print dialog, file download, email client, clipboard copy).
The Payment button directs the host to the checkout/payment processor to activate the live routing links for that specific property.
## 6.6 Host FAQ Page [DSB-BOP-P6-006]

**What to display:** Answers regarding tax deductions, content moderation, photo privacy, data security, and the full text of the Cancellation & Billing Policy:
Tax Deductibility: DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice. Only an eligible business-use portion may be claimable.
Free Trial & Auto-Enrollment: DigiStayBook offers a 28-day free trial for your first property. A valid payment method is required to begin the trial. You will not be charged during the 28-day trial period. If you do not cancel before the end of the 28th day, your account will automatically transition to an active paid subscription, and your payment method will be charged the standard rate for your selected plan (Monthly or Annual).
How to Cancel: You may cancel your subscription at any time without penalty. To cancel, log in to your Host Dashboard, navigate to the specific Property Page, and click "Cancel Subscription." We do not accept cancellation requests via email or the contact form to ensure the security of your account.
Post-Cancellation Access: If you cancel your subscription (or cancel during your free trial), you will retain full access to your live guestbook and QR code until the end of your current billing cycle or the end of your trial period. After that date, your property's QR code will be deactivated, and the public guestbook will no longer be visible to guests.
Refunds: All subscription charges are non-refundable except where required by law, such as in the event of a major failure under the Australian Consumer Law. Subject to those statutory rights, we do not offer prorated refunds or credits for canceled subscriptions, partial months of service, or unused time.
Trial Expiry Notice: As a courtesy, we will send an automated email reminder to your registered email address prior to the conclusion of your 28-day free trial.
## 6.7 Host Contact Page [DSB-BOP-P6-007]

**What to display:** A contact form strictly designated for hosts to reach Operations about account, billing and software support. It must state that guests cannot use this form to contact hosts or enquire about bookings. Guests needing assistance with a stay must contact their host through the original booking platform. Guests with a DigiStayBook privacy, personal-data or content-safety concern are directed to the separate public Privacy & Safety page.
## 6.8 Public Privacy & Safety Page [DSB-BOP-P6-008]

**What it is for:** A public, guest-accessible route for personal-data requests, content-safety concerns and problems using the in-product report or deletion tools. It is not a booking, maintenance or guest-to-host support channel.
**What to display:** A concise form that accepts the property/wall reference, post reference where available, request category, contact details required to verify and respond to the request, and a short description. The form must explain how the information will be used and must not require unrelated identity or booking information.
**Escalation path:** The request is recorded in a restricted Privacy & Safety queue and linked to any corresponding host request. The host is notified where appropriate. If the host does not act within the defined 14-day privacy-request period, the platform escalates the request to Privacy & Safety Operations and applies the approved deletion or restriction workflow. Guests can use this route when they have lost their original browser session or believe an in-product request has not been handled.
**Boundary copy:** "DigiStayBook cannot help with bookings, property access, maintenance or in-stay issues. Contact your host through your booking platform for stay support. Use this form only for privacy, personal-data or DigiStayBook content-safety concerns."
## 6.9 The Guest Wall (Public Guestbook Page) [DSB-BOP-P6-009]

**What to display:** The live, mobile-first visual timeline of approved photos and notes. It displays the specific layout/theme chosen on the Property Page, showing pinned posts at the top and standard posts below.
**Required Buttons:** "Add a Memory/Post" (opens the multi-image upload tool), self-service edit/delete buttons for the Guest's own content, and a universal "Report" flag on all posts.
**Button Destination:** Self-deletion hides the Guest's own post immediately and schedules deletion. An ordinary server-accepted report hides the post immediately and creates `hidden_pending_review`. A report received while the reporter or wall circuit breaker is active creates `suspected_abuse_no_visibility_change`; it is recorded for internal review without changing visibility. The client never writes these states directly.
## 6.10 "Powered by DigiStayBook" Guest Wall Micro-Branding [DSB-BOP-P6-010]

**Purpose:** Turn appropriate Guest Wall exposure into a potential host-acquisition path without interrupting the guest experience. Some Guests may themselves own or manage short-term rentals, or be considering hosting; this is a commercial rationale, not a claim that a particular percentage will convert.
**Required placement and copy:** Every live public Guest Wall, including the public demo, displays a discreet text link after the wall content and contribution controls: "Loved your stay? Powered by DigiStayBook — Create a digital guestbook for your property."
**Destination:** The link directs to the DigiStayBook main landing page. It must use a descriptive accessible label and remain usable on mobile and desktop.
**Experience guardrail:** The micro-branding must remain visually secondary to the property's identity and Guest Wall content. It must not appear as a popup, interstitial, modal, forced redirect or contribution requirement, and it must not obscure host content or guest controls.
**Marketing boundary:** Advertising may describe this placement as a product-discovery or host-acquisition loop. DigiStayBook must not publish an unsubstantiated conversion percentage or guarantee that Guest Wall visitors will become Host customers.
# Part 7: Terms and Conditions (Legal Copy)

> **Draft — not approved for publication. Professional legal review is required before these Terms are used.**

Last Updated: 4th August 2026
Welcome to DigiStayBook. These Terms and Conditions ("Terms") govern your access to and use of the DigiStayBook website, dashboard, and digital guestbook services (collectively, the "Service").
By creating an account, starting a free trial, or using the Service, you ("Host", "you", or "your") agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
## 1. Description of Service [DSB-BOP-P7-001]

DigiStayBook provides a digital guestbook platform for short-term rental operators. The Service allows Hosts to generate property-specific QR codes that enable checking-in guests ("Guests") to upload photos and text to a digital wall. DigiStayBook is a business-to-business (B2B) software provider; we do not manage properties, bookings or in-stay support, and we do not facilitate host-to-guest direct messaging. We may interact with Guests only where needed to operate content controls and address privacy, personal-data or platform content-safety matters.
## 2. Account Registration and Security [DSB-BOP-P7-002]

To use the Service, you must register for an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
## 3. Free Trial, Billing, and Subscriptions [DSB-BOP-P7-003]

3.1. 28-Day Free Trial: DigiStayBook offers a 28-day free trial for your first activated property. A valid payment method is required to initiate the trial. You will not be charged during this 28-day period.
3.2. Auto-Renewal: If you do not cancel your subscription before the end of the 28th day, your account will automatically transition to an active paid subscription. Your payment method on file will be charged the standard rate for your selected plan (Monthly or Annual) on a recurring basis.
3.3. Cancellation: You may cancel your subscription at any time via your Host Dashboard. Cancellations must be processed before your next billing date to avoid future charges. We do not accept cancellation requests via email or contact forms. If you cancel, you will retain access to your active QR codes and Guest Wall until the end of your current paid billing cycle (or the end of your free trial).
3.4. Refunds: All subscription charges are non-refundable except where required by law, such as in the event of a major failure under the Australian Consumer Law. Subject to those statutory rights, we do not offer prorated refunds or credits for canceled subscriptions, partial months of service, or unused time.
3.5. Tax Disclaimer: Any statements regarding tax deductibility are for general marketing purposes only. Eligibility to claim software subscriptions as a business expense depends on your individual circumstances and jurisdictional tax laws (e.g., apportioning business versus private use). You are solely responsible for consulting a qualified tax professional regarding your claims.
## 4. User-Generated Content (UGC) and Host Responsibility [DSB-BOP-P7-004]

4.1. Guest Uploads and Platform Processing: The Service allows your Guests to upload photos, text, and other materials ("User Content"). To provide the Service, DigiStayBook stores, automatically screens, routes, publishes, restricts and deletes User Content in accordance with the Host's settings, the moderation workflow, these Terms and applicable legal obligations.
4.2. Host Moderation & Automated Security: DigiStayBook applies automated, server-side screening before User Content is eligible for publication. DigiStayBook does not routinely manually pre-screen every submission. Limited manual review may occur for critical internal trust-and-safety cases, legal obligations, escalated platform reports and quality-control activities under restricted access. The Host retains primary responsibility for ordinary curation of the Guest Wall using the tools provided in the Host Dashboard. Automated screening and limited review do not constitute endorsement of User Content.
4.3. Liability: DigiStayBook accepts no liability for User Content uploaded by your Guests, including but not limited to copyright infringement, privacy violations, defamatory statements, or offensive material. You agree to indemnify and hold DigiStayBook harmless from any claims arising from User Content uploaded to your property's Guest Wall.
4.4. Guest Sessions and Formal Accounts: Guests do not create formal accounts to use the Service. Features such as self-service guest editing rely strictly on Firebase Anonymous Authentication and the Guest's local browser session (localStorage). Access to edit or delete their own posts will be permanently lost if the Guest clears their device cookies, utilizes private/incognito browsing, or accesses the wall from a different device.
## 5. Acceptable Use [DSB-BOP-P7-005]

You agree not to use the Service to:
Promote illegal activities, violence, or harassment.
Distribute malware, viruses, or spam.
Infringe upon the intellectual property or privacy rights of others.
Attempt to bypass, hack, or disrupt the security and functionality of the Service.
We reserve the right to suspend or terminate your account immediately, without notice or refund, if we determine that you have violated these Acceptable Use terms.
To enforce these Terms, protect the platform and prevent abuse, DigiStayBook may use rate limits, duplicate-request controls, account or session restrictions, temporary access restrictions and short-lived pseudonymous abuse keys derived from limited security signals. Security records are access-controlled and retained only for the bounded period set out in the approved retention schedule, and the controls do not create persistent cross-session identifiers.
Platform Intervention and Takedown Rights: While Hosts retain primary responsibility for ordinary Guest Wall curation, DigiStayBook uses automated security filters and limited internal review to identify severe legal or safety concerns. Content presenting a critical concern is immediately blocked from public access and placed in a restricted internal case. It is retained only for the approved verification, legal and safety period, then securely deleted when the case is resolved and no lawful retention requirement remains. DigiStayBook may apply proportionate account, session or temporary access restrictions and may notify the Host where doing so is lawful and safe.
## 6. Intellectual Property [DSB-BOP-P7-006]

All software, design, text, layout, and graphics provided by DigiStayBook (excluding User Content and Host-uploaded property features) are the exclusive property of DigiStayBook. You may not copy, reverse-engineer, or resell the software or Service without our explicit written permission.
## 7. Service Availability and Hardware [DSB-BOP-P7-007]

DigiStayBook provides web-based software. You are solely responsible for providing and maintaining the physical hardware (e.g., printed QR placards, tablet displays) and internet connectivity required for Guests to access the Service at your property. While we strive for 99.9% uptime, we do not guarantee that the Service will be uninterrupted or error-free.
## 8. Limitation of Liability [DSB-BOP-P7-008]

To the maximum extent permitted by law, DigiStayBook shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising out of your use of or inability to use the Service. In no event shall our total liability to you exceed the total amount you have paid to DigiStayBook in the twelve (12) months preceding the claim.
## 9. Modifications to the Terms [DSB-BOP-P7-009]

We reserve the right to modify these Terms at any time. If we make material changes, we will notify you via the email address associated with your account or through a notice on your Host Dashboard. Continued use of the Service after changes are published constitutes your acceptance of the revised Terms.
## 10. Governing Law [DSB-BOP-P7-010]

These Terms shall be governed by and construed in accordance with the laws of Victoria, Australia, without regard to its conflict of law provisions. Any legal disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts located in Victoria, Australia.
## 11. Contact Information [DSB-BOP-P7-011]

Hosts with questions about these Terms may contact us through the Host Contact Form. Guests and other individuals with a privacy, personal-data or content-safety concern may use the public Privacy & Safety page. Neither route provides booking or property support.
# Part 8: Privacy Policy (Legal Copy)

> **Draft — not approved for publication. Professional legal review is required before this Privacy Policy is used.**

Last Updated: 4th August 2026
Welcome to DigiStayBook. We respect your privacy and are committed to protecting the personal data of our Hosts and their Guests. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our website, dashboard, and digital guestbook services (collectively, the "Service").
Please read this Privacy Policy carefully. By accessing or using the Service, you agree to the collection and use of information in accordance with this policy.
## 1. Information We Collect [DSB-BOP-P8-001]

We collect information in two primary categories: information provided by Hosts (our direct customers) and information provided by Guests (users interacting with a Host's digital guestbook).
A. Information Collected from Hosts
Account Information: When you register for an account, we collect your email address, a secure password, and the name(s) of your property or properties.
Billing Information: When you activate a subscription or free trial, our third-party payment processors (e.g., Stripe) collect your payment details, such as credit card information and billing address. DigiStayBook does not directly view or store your full credit card number.
Property Data: We collect configuration data related to your property, such as custom welcome messages, house rules, and display preferences.
Marketing Preference Data: Where a Host chooses whether to receive marketing, we store the Host identity, normalised contact address, consent or withdrawal status, UTC timestamp, form/source identifier, and the exact consent wording and version. A minimal central suppression record is retained separately to prevent promotional messages after opt-out.
B. Information Collected from Guests
User-Generated Content (UGC): When a Guest scans a property’s QR code, they may voluntarily upload photos, text, and messages to the public Guest Wall.
Technical and Security Data: When a Guest accesses a Guest Wall, we process limited technical information such as IP address, browser type, device category, access time, anonymous session tokens and Firebase App Check signals. Where needed to prevent abuse, the system may derive short-lived pseudonymous abuse keys without creating a persistent cross-session identifier. We use this information to route uploads, secure the Service, enforce rate limits, investigate platform reports and apply proportionate account, session or temporary access restrictions. Raw and derived security records are access-controlled and retained only for the bounded period in the approved retention schedule.
## 2. How We Use Your Information [DSB-BOP-P8-002]

We use the collected information for the following operational purposes:
To Provide the Service: To host the digital guestbook, generate QR codes, and allow Hosts to moderate their property's Guest Wall.
To Process Payments: To manage subscriptions, free trials, and renewals through our secure payment gateways.
To Communicate with Hosts: To send account-related notices, such as welcome emails, billing receipts, cancellation confirmations, and dashboard access links.
To Manage Marketing Choices: To prove express consent, apply withdrawals across promotional sequences, prevent sends to suppressed addresses and record verified re-consent without treating account creation or acceptance of the Terms as marketing consent.
To Improve the Service: To analyze website usage and Technical Data to fix bugs and improve the user experience.
DigiStayBook does not use Guest photos or messages for our own marketing purposes without explicit permission, nor do we sell Host or Guest data to third parties.
## 3. Privacy Roles by Data Class and the Right to Request Deletion [DSB-BOP-P8-003]

The applicable privacy role depends on the information and the purpose for which it is processed:
- **Guest Wall content and property configuration:** The Host generally determines why Guest photos, messages and property content are collected and displayed and acts as controller for that content. DigiStayBook generally processes this content on the Host's behalf to host, screen, route, publish, restrict and delete it under the Service instructions.
- **Host accounts and communications:** DigiStayBook acts as controller for Host registration, account security, service communications and support records required to operate the platform relationship.
- **Billing metadata and transaction records:** DigiStayBook acts as controller for the customer, subscription, invoice-reference and accounting information it needs for billing administration, disputes and legal obligations. Payment providers process payment data under their own applicable terms and privacy roles.
- **Security and abuse-prevention records:** DigiStayBook acts as controller for App Check signals, limited security logs, short-lived pseudonymous abuse keys, rate-limit events and account/session restrictions used to secure the platform.
- **Platform reports and internal trust-and-safety cases:** DigiStayBook acts as controller for reports escalated directly to the platform and restricted critical cases it must assess for platform safety, legal compliance or the protection of users.
- **Service providers:** Cloud, email, moderation and other vendors process data under the contractual role applicable to the service they provide. The final policy and vendor list must identify whether each provider acts as a processor, sub-processor or independent controller.

Guests can exercise privacy and deletion rights without requesting booking or property support:
- **Active Sessions:** If a Guest maintains their active browser session, they can use the self-service delete function directly on their device.
- **Lost Sessions:** If a Guest loses their active session, they can use the Report control on the relevant post and select "Privacy Deletion Request." An ordinary accepted request hides the post immediately and routes it to the Host dashboard. If the reporter or wall circuit breaker is active, the request is recorded without changing visibility and is routed to Privacy & Safety Operations. The requester can also use the public Privacy & Safety route, and unresolved privacy requests escalate at 14 days.
- **Public Privacy & Safety Route:** A Guest can submit a request directly through the public Privacy & Safety page if self-service is unavailable, the original session is lost, the post cannot be located or a prior request has not been handled.
- **Escalation:** If a Host does not act within the defined 14-day period, the request escalates to Privacy & Safety Operations and the platform applies the approved deletion or restriction workflow. DigiStayBook may also act directly where required by law or where it is independently responsible for the relevant data class.
## 4. How We Share Information [DSB-BOP-P8-004]

We only share information with third parties in the following limited circumstances:
Service Providers: We share data with trusted third-party vendors who perform services on our behalf, such as cloud hosting providers (e.g., AWS, Google Cloud) and payment processors.
Legal Requirements: We may disclose your information if required to do so by law, court order, or governmental request, or to protect the rights, property, or safety of DigiStayBook, our users, or others.
Business Transfers: If DigiStayBook is involved in a merger, acquisition, or sale of assets, Host data and Guest content may be transferred as a business asset.
## 5. Data Retention and Deletion [DSB-BOP-P8-005]

The following periods are recommended operational defaults for the WIP. The 12-month dormancy period, critical-moderation periods and jurisdiction-dependent obligations must be approved through the Professional Legal Review Gate before production. Personal information must not be retained merely because storage is available. The platform must destroy, de-identify or put information beyond use when it is no longer needed, including controlled expiry from backups.

| Data class | Purpose and planned storage | Access roles | Active retention | Cancellation or dormancy behaviour | Deletion trigger and active-system deadline | Encrypted backup expiry | Legal-hold exception |
|---|---|---|---|---|---|---|---|
| Unpaid property drafts and sandbox media | Onboarding before activation; Firestore property draft records and private Cloud Storage | Host; property service account; restricted support when requested | 30 days from draft creation, with the clock reset only by meaningful Host editing | No dormant-property treatment; the abandoned-draft sequence ends with a Day 23 warning | Delete the draft and media on Day 30; complete primary-store deletion within 72 hours | Expire within 30 days after primary deletion | Hold only for a documented fraud, dispute, court or regulatory need; review every 90 days |
| Active property configuration | Operate the wall, theme, pins, house information and QR state; Firestore | Host; property service account; authorised support | Subscription or trial lifetime | At service end, lock public service and move approved reactivatable fields into the dormant-property state | Host deletion request or expiry of approved dormancy; primary deletion within 30 days of trigger | Expire within 30 days after primary deletion | Scoped documented hold; unaffected fields continue to delete |
| Dormant property configuration | Permit seasonal reactivation; access-restricted Firestore and private Storage | Host after authentication; reactivation service; exceptional authorised support | Recommended maximum 12 months from service end, subject to product and legal approval | No public wall, guest upload or normal operational email use; one 90-day win-back is allowed only with valid marketing consent | Delete primary configuration and reactivatable media within 30 days after the 12-month expiry | Expire within 30 days after primary deletion | Scoped hold only; review every 90 days and delete promptly after release |
| Public Guest content and original media | Display approved memories; Firestore public projection and approved Cloud Storage objects | Public read of approved projection; contributing Guest controls for their post; Host; service accounts | While the property is active, unless the Guest or Host deletes it | If the property becomes dormant, remove public access and retain privately only for the approved 12-month reactivation window | Approved privacy deletion: remove public access promptly and delete primary copies within 72 hours; otherwise delete within 30 days after dormancy expires | Expire within 30 days after primary deletion; deletion manifest reapplied before any restore | Preserve only the minimum specifically required by a documented legal obligation; do not keep content merely for analytics |
| Processing quarantine, ordinary flags and Host-rejected content | Pre-publication safety screening and short review/appeal window; private quarantine Storage and moderation records | Moderation service accounts; Host for ordinary review; Trust & Safety for escalations | Processing maximum 7 days; passed quarantine copy deleted within 24 hours of approved publication; rejected content maximum 30 days after rejection | Does not enter normal property dormancy unless it was already published | Delete timed-out processing items after failed/retry handling; delete rejected content at 30 days | Expire within 30 days after primary deletion | Critical cases move to the separate internal-moderation row; documented holds reviewed every 30 days |
| Privacy and takedown requests | Verify, action and demonstrate request handling; restricted request collection without unnecessary media copies | Requester for their submission/status; Host where appropriate; Privacy & Safety; legal when required | Resolve or escalate within 14 days; retain minimal closed-case metadata for 24 months | Continues independently of property cancellation until resolved and the 24-month evidence period ends; `hidden_pending_review` remains non-public, while circuit-breaker reports retain current visibility pending internal review | Delete request attachments as soon as resolved; delete minimal case metadata 24 months after closure | Expire within 30 days after the applicable primary deletion | Scoped hold for an active complaint, regulator, litigation or preservation duty; review every 90 days |
| Guest content-consent evidence | Demonstrate the consent wording/version accepted for a specific post; Firestore consent record containing timestamp, policy version and pseudonymous post/session reference, not a duplicate photo | Privacy & Safety; authorised legal; service account; Host receives only necessary status | For the life of the associated content plus 24 months after content deletion | Retained separately from dormant content for the remainder of the evidence period | Delete 24 months after associated content deletion or final dispute closure, whichever is later | Expire within 30 days after primary deletion | Scoped hold where consent or publication is disputed; review every 90 days |
| Host account and profile data | Authentication, account administration and service communications; Firebase Authentication and Firestore profile | Host; authentication services; restricted support/security | Active account lifetime | Retain the minimum profile during the approved 12-month dormancy period; disable public-property service but allow secure reactivation/account management | Delete within 30 days after approved dormancy expires or an approved account-deletion request, except separately retained records below | Expire within 30 days after primary deletion | Scoped account record retained only where required for dispute, security or legal obligations |
| Stripe references, invoices and accounting records | Billing administration, reconciliation, refunds, disputes and tax records; Stripe plus minimal Firestore references and controlled accounting exports | Billing service accounts; authorised finance; restricted support; legal/auditor when required | Transaction lifetime plus five years after the record was created/obtained or the transaction completed, whichever is later, subject to counsel/accountant confirmation | Retained independently of property and profile dormancy; full card data remains with the payment provider | Delete or de-identify at the end of the applicable accounting/legal period and after open disputes finish | Controlled exports/backups expire within 30 days after the retention period ends | Extend for an open audit, chargeback, tax review, court order or other documented obligation; review annually |
| Authentication, App Check, rate-limit and routine security logs | Secure accounts and endpoints, diagnose abuse and investigate incidents; Firebase/Google security services and central restricted logs | Security service accounts; authorised Security/Trust & Safety; legal for a documented incident | Short-lived rate-limit keys rotate and suspected-abuse cooldowns expire after 24 hours; confirmed restrictions linked to a keyed hash of an existing Firebase anonymous/account UID expire within 90 days; routine logs use rolling 90-day retention; records linked to a separate confirmed security incident may remain 12 months after incident closure | Routine expiry continues during cancellation/dormancy; only confirmed restriction/incident records remain for their separate period | Automated deletion at the applicable 24-hour, 90-day or 12-month deadline | Expire within 30 days after primary log deletion | Scoped preservation for an active incident, legal process or regulator; review every 90 days |
| Internal critical-moderation cases | Verify severe safety/legal flags and record disposition; restricted case store separated from Host moderation | Named Trust & Safety personnel; legal where required; no routine Host access | Unresolved case reviewed at least every 30 days; critical media maximum 30 days after case closure; minimal case metadata maximum 12 months after closure | Never enters ordinary property dormancy or marketing use | Delete critical media no later than 30 days after closure and metadata at 12 months, unless counsel records another requirement | Expire within 30 days after each primary deletion deadline | Legal counsel must approve any extended preservation/reporting duty; hold is scoped, access-logged and reviewed every 30 days |
| Marketing consent and suppression records | Prove consent and prevent messages after opt-out; marketing preference store separated from product content | Host for preferences; marketing service account; authorised compliance staff | Consent proof while marketing is active and for 24 months after the last commercial message; minimal suppression record while the marketing system operates or until verified re-consent | A cancelled Host may receive the 90-day win-back only with valid consent; an unsubscribe suppresses all marketing within five working days | Delete expired consent evidence at 24 months; retain only the minimum suppression value needed to prevent unlawful re-subscription | Expire consent backups within 30 days; suppression state must be reconstructed before any restored marketing system sends | Preserve evidence for an active ACMA complaint or legal process; suppression itself is not released by account/content deletion |
| Deletion-job audit records | Prove deletion execution, retries and failures without retaining deleted content; restricted operations audit store | Privacy & Safety; Security; authorised engineering; legal/auditor when required | 24 months after job completion or final failure resolution | Continues independently of property cancellation for the audit period | Delete after 24 months; record only job ID, data-class code, pseudonymous target reference, timestamps, status, retry/error code and approving actor; never copy deleted text or media | Expire within 30 days after audit-record deletion | Scoped hold for an active complaint, audit or litigation; review every 90 days |
| Backups and disaster-recovery copies | Recover from service failure; encrypted provider-managed backups and object-version controls | Automated recovery service; named infrastructure/security responders during an approved recovery | Rolling maximum 30 days | No product, support, analytics or marketing access; deleted records are marked beyond use pending backup expiry | Expire backup generation automatically at 30 days; any restore must reapply the deletion manifest before the system is returned to service | This row defines the maximum: 30 days | A legal-hold export must be a separate, scoped, access-logged repository rather than extending general backup retention |

**Meaning of deletion:** "Deleted from active systems" means the identifiable record/object and searchable indexes, caches, derived public projections and routine service-provider copies have been removed or irreversibly de-identified so they are no longer available through the product or normal administration. During the rolling backup period, the record is put beyond use: it is not accessed or restored for ordinary purposes. Encrypted backup generations expire within 30 days. If disaster recovery restores an older generation, the deletion manifest is reapplied before the service returns to users. DigiStayBook verifies deletion instructions sent to relevant service providers.

**Deletion audit:** Every deletion workflow creates a content-free audit event and alerts on partial failure. Failed jobs retry with bounded backoff and enter an Operations queue if the deadline is at risk. The audit record stores identifiers and status metadata only; it must not retain the deleted Guest text, image, file name or a reversible copy.

**Lifecycle alignment:** Unpaid drafts receive their final warning on Day 23 and delete on Day 30. The 90-day win-back applies only to previously activated, cancelled properties inside the approved 12-month dormancy window and only where marketing consent remains valid. Privacy requests resolve or escalate within 14 days and do not wait for dormancy. Accounting, consent, security-incident and deletion-audit records follow their own justified periods. Unsubscribe requests update the central suppression record within five working days; deleting an account or property must not remove the minimum suppression state required to prevent future marketing.

**Legal-hold governance:** A hold must identify the authority, data classes, case owner, approval date and review date. It suspends deletion only for the scoped records, never for the entire account by default. Holds are reviewed at the cadence in the matrix and records delete promptly after release. Product/legal approval of this schedule must be recorded before launch.

**Retention rationale:** These defaults apply the OAIC requirement to destroy or de-identify personal information when it is no longer needed, including controlled copies in archives and backups; the ATO's general five-year business-record requirement; and ACMA's consent-record and five-working-day unsubscribe requirements. See [OAIC APP 11 guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information), [ATO record-keeping guidance](https://www.ato.gov.au/law/view/document?LocID=%22TXR%2FTR967%2FNAT%2FATO%22&PiT=20150714000001), and [ACMA spam guidance](https://www.acma.gov.au/avoid-sending-spam). These sources do not approve every product-specific duration in the matrix; counsel must confirm the selected defaults and any other applicable jurisdiction.
## 6. Cookies and Tracking Technologies [DSB-BOP-P8-006]

We use essential cookies to maintain Host login sessions within the Dashboard and to ensure the platform functions securely. We do not use invasive tracking cookies for targeted third-party advertising.
## 7. Data Security [DSB-BOP-P8-007]

We implement industry-standard administrative, technical, and physical security measures to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure.
## 8. Children's Privacy [DSB-BOP-P8-008]

The Service is a B2B platform and is not directed at children under the age of 16. We do not knowingly collect personal information directly from children, and guests must confirm they are over 16 upon uploading content. If you are a Host, it remains your responsibility to moderate any photos containing minors uploaded to your Guest Wall.
## 9. Contact Us [DSB-BOP-P8-009]

Hosts may use the Host Contact Form for account and software support. Any Guest, Host or other individual may use the public Privacy & Safety page for a personal-data request, privacy concern or DigiStayBook content-safety issue. This route does not provide booking, maintenance or in-stay support. Requests that cannot be resolved through self-service or the Host workflow are escalated to Privacy & Safety Operations.
## 10. Professional Legal Review Gate [DSB-BOP-P8-010]

Before publication or production use, qualified legal counsel must review and approve the final Terms, Privacy Policy, Guest consent wording, age threshold and minors workflow, automated and manual moderation process, controller/processor allocation, vendor roles, liability and indemnity clauses, privacy-request escalation, deletion and retention schedule, security-data disclosures, and international/jurisdictional requirements. Launch approval must record the reviewed versions and date. Until that approval is recorded, the legal copy in this WIP is drafting material only.
# Part 9: Appendix - Automated Email Copy & Templates

**Appendix status:** This Part provides the detailed email wording and template fields that support the operational requirements in Part 4. It is not a separate or replacement source of operational policy. Templates must be maintained in line with Part 4; they cannot change a trigger, classification, consent rule, suppression control, timing requirement or retention rule defined there.

## 9.1 Core Host Email Lifecycle [DSB-BOP-P9-001]

These transactional emails are tied to specific billing and account events to minimize manual intervention.
### 9.1.1 Account Creation Confirmation [DSB-BOP-P9-001A]
- **Classification:** Transactional
- **Subject:** Your DigiStayBook account is ready
Body: Hi {{Host_Name}},
Your DigiStayBook account for {{Host_Email}} has been created successfully.
> **CTA Button:** `Open Secure Dashboard`

If you did not create this account, use the account-security link or contact DigiStayBook support. Product onboarding and trial promotions are sent separately only where marketing consent exists.
### 9.1.2 Property Activation (Asset Delivery) [DSB-BOP-P9-001B]
- **Subject:** {{Property_Name}} is Live! Here is your QR Kit.
Body: Hi {{Host_Name}},
{{Property_Name}} is officially active! Attached is your high-resolution QR code kit. Simply print the placard and place it on your property's counter.
Before displaying the QR code, select at least one foundational post to reduce the likelihood that a Guest encounters an empty wall.
> **CTA Button:** `Go to Property Dashboard`

### 9.1.3 Trial Expiry Notice [DSB-BOP-P9-001C]
- **Subject:** Your DigiStayBook trial for {{Property_Name}} ends soon.
Body: Hi {{Host_Name}},
This is a service reminder that your 28-day free trial for {{Property_Name}} will end on {{Trial_End_Date}}.
Unless you cancel before that date, your subscription will automatically move to the selected paid plan and {{Charge_Amount}} will be charged on {{Charge_Date}}.
> **CTA Button:** `Manage Billing`

### 9.1.4 Automated Monthly Receipt [DSB-BOP-P9-001D]
- **Subject:** DigiStayBook Receipt: {{Month}}
Body: Hi {{Host_Name}},
Thank you for your continued partnership. Your monthly invoice for {{Property_Name}} is attached below. Keep this invoice for your records.
> **CTA Button:** `Download PDF Invoice`

### 9.1.5 Card Expiring Soon (Pre-Dunning) [DSB-BOP-P9-001E]
- **Subject:** Action Needed: Your payment method is expiring soon.
Body: Hi {{Host_Name}},
The credit card on file for your DigiStayBook account is set to expire in the next 30 days.
To ensure your property’s QR codes remain active and your guests can continue uploading memories without interruption, please take a moment to update your payment details.
> **CTA Button:** `Update Payment Method`

### 9.1.6 Failed Payment Flow (The Grace Period) [DSB-BOP-P9-001F]
- **Subject:** Payment Failed – Action required to keep {{Property_Name}} active.
Body: Hi {{Host_Name}},
We were unable to process your recent subscription payment for {{Property_Name}}. We know you are busy running a B2B operation, so we have granted a 14-day soft grace period. During this time, your Guest Wall remains fully active for your checking-in guests.
Please update your payment details before {{Suspension_Date}} to avoid deactivation.
> **CTA Button:** `Securely Update Payment`

### 9.1.7 Service Suspension (The Final Notice) [DSB-BOP-P9-001G]
- **Subject:** Notice: {{Property_Name}}'s digital guestbook is offline.
Body: Hi {{Host_Name}},
Your 14-day grace period has concluded, and the QR code for {{Property_Name}} has been deactivated.
Scanning the existing QR code now opens a fallback page stating that the guestbook is temporarily offline.
Reactivation restores the property according to the current billing and entitlement state.
> **CTA Button:** `Reactivate Now`

### 9.1.8 Cancellation Confirmation [DSB-BOP-P9-001H]
- **Subject:** Confirmation of Subscription Cancellation.
Body: Hi {{Host_Name}},
This email confirms that you have successfully canceled your subscription for {{Property_Name}}.
You will retain full access to your live guestbook and QR code until your current billing cycle ends on {{End_Date}}. After this date, the QR code will be deactivated and the public wall will no longer be visible.
Subject to final product and legal approval of the retention schedule, your property configuration and Guest Wall content are planned to remain private and dormant until {{Dormancy_Expiry_Date}} (currently 12 months after service ends). After that date, deletion from active systems is scheduled to complete within 30 days and encrypted backup copies expire within a further 30 days. Limited accounting, consent, suppression, security-incident and deletion-audit records may follow the separate periods in the Privacy Policy. This template must not be enabled until the dormancy period and wording are approved.
## 9.2 Moderation & Content Safety Emails [DSB-BOP-P9-002]

### Email 1A: Moderation Alert - AI Flagged Content [DSB-BOP-P9-002A]

- **Trigger:** The AI image or text API flags potential NSFW material, profanity, negative sentiment, or external URLs.
- **Timing:** Immediate (Real-Time)
- **Subject:** Action Required: Guest post flagged for review ({{Property_Name}})
Body: Hi {{Host_Name}},
Our automated safety filter just flagged a new guest submission at {{Property_Name}}.
To protect your listing reputation and brand, the post has been automatically placed in Pending Host Approval and is currently hidden from your public wall.
Flag Reason: {{AI_Flag_Reason}} (e.g., Unfiltered Language / Image Moderation Flag)
What to do next: Review the post in your dashboard to publish it to your live wall or permanently delete it.
> **CTA Button:** `Review Flagged Post`

### Email 1B: Moderation Alert - Post Hidden After Guest Report [DSB-BOP-P9-002B]

- **Trigger:** The server accepts an ordinary Guest report and atomically changes the post to `hidden_pending_review`. Tapping Report by itself is not the email trigger.
- **Timing:** Immediate (High Priority)
- **Subject:** Action Required: Privacy or Takedown Request at {{Property_Name}}
Body: Hi {{Host_Name}},
A guest viewing your public digital wall at {{Property_Name}} has flagged a post and requested its removal.
The reporting endpoint accepted a Guest report, hid the post from public view and routed it to your dashboard for review.
Report Details: Date Reported: {{Report_Timestamp}} Status: Hidden from Public Wall
Your Next Steps: As the Data Controller for your guestbook, please log in and navigate to the "Privacy & Takedown Requests" tab. If this is a valid request from your guest, click "Confirm Permanent Deletion." If you believe the report is false or abusive, reject it and provide the requested reason. A Host rejection does not by itself classify the reporter as malicious. If you do not resolve a privacy request within 14 days, it escalates automatically to Privacy & Safety Operations, which applies the approved deletion or restoration workflow.
> **CTA Button:** `Review Deletion Request`

### Email 1C: Reporting Circuit Breaker Alert (Internal Only) [DSB-BOP-P9-002C]

- **Trigger:** A reporter or wall enters a circuit-breaker state, producing `suspected_abuse_no_visibility_change`.
- **Recipients:** Privacy & Safety Operations only; do not send a false hidden-post alert to the Host.
- **Content:** Wall and report identifiers, threshold reached, affected post identifiers, current visibility, App Check result, pseudonymous reporter key expiry and a link to the restricted report queue. Do not attach or duplicate Guest media in the alert.

## 9.3 Security & Account System Emails [DSB-BOP-P9-003]

### Email 2A: Password Reset Request [DSB-BOP-P9-003A]

- **Trigger:** Host clicks "Forgot Password" on the login screen.
- **Timing:** Immediate
- **Subject:** Reset your DigiStayBook password
Body: Hi {{Host_Name}},
We received a request to reset the password for your DigiStayBook account ({{Host_Email}}).
Click the button below to set up a new password:
> **CTA Button:** `Reset My Password`

This link will expire in 60 minutes for security reasons.
If you did not request a password reset, you can safely ignore this email—your password will remain unchanged and your account stays secure.
### Email 2B: Password Successfully Changed [DSB-BOP-P9-003B]

- **Trigger:** Host updates their password in the dashboard or via the reset link.
- **Timing:** Immediate
- **Subject:** Security Alert: Your DigiStayBook password was changed
Body: Hi {{Host_Name}},
This email confirms that the password for your DigiStayBook account ({{Host_Email}}) was successfully updated on {{Change_Timestamp}}.
Device Details: Browser/Device: {{User_Agent}} Location: {{IP_Location}}
Didn't make this change? If you did not authorize this change, please reset your password immediately using the link below and contact support via your Host Dashboard.
> **CTA Button:** `Secure My Account`

### Email 2C: Email Address Change Verification [DSB-BOP-P9-003C]

- **Trigger:** Host requests an update to their primary account email in dashboard settings.
- **Timing:** Immediate
- **Subject:** Verify your new email address for DigiStayBook
Body: Hi {{Host_Name}},
You recently requested to update your primary login email address for DigiStayBook to {{New_Host_Email}}.
Please verify this new address by clicking the button below:
> **CTA Button:** `Confirm New Email Address`

Once confirmed, all future operational updates, billing invoices, and moderation alerts for your properties will be routed to this address.
### Email 2D: Unrecognized Device / New Login Alert [DSB-BOP-P9-003D]

- **Trigger:** Account login detected from a new IP address or device.
- **Timing:** Immediate
- **Subject:** New login to your DigiStayBook account
Body: Hi {{Host_Name}},
We noticed a new login to your DigiStayBook host dashboard: Time: {{Login_Timestamp}} Device: {{Device_Type_and_Browser}} Approximate Location: {{IP_Location}}
If this was you, no action is needed! If this wasn't you, please log in immediately to change your password and review your account security.
> **CTA Button:** `Review Account Security`

## 9.4 Lead-Nurturing Cart Abandonment Sequence [DSB-BOP-P9-004]

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
Trigger: Fires if a host names a property but exits before clicking "Activate Property" and completing checkout. (Note: This sequence only fires if the host explicitly checked the marketing consent opt-in box during Account Setup).
Email 1 (1 Hour Post-Abandonment): Initial check-in asking if they hit a snag, directing them to the FAQ and explaining the intended guest-experience value without promising changes in guest behaviour or property outcomes.
Email 2 (24 Hours Post-Abandonment): Focuses on the guest-experience value—explaining that a warmer, more useful and memorable stay may encourage more positive feedback on the host's official booking platform, without guaranteeing a review outcome.
Email 3 (3 Days Post-Abandonment): May state: "DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice." It must not claim guaranteed property protection, savings or financial returns.
Email 4 (Day 23 Post-Abandonment): Final seven-day warning that the unpaid property draft is scheduled for deletion on Day 30. The message must show the exact deletion date and must not imply the draft will remain available afterward.
## 9.5 Retention & Engagement Lifecycle [DSB-BOP-P9-005]

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
The "Activation" Nudge (Day 7 Check-in):
- **Trigger:** Fires 7 days after a Host successfully activates a property (initiating their free trial) only if the property has zero guest posts. (Note: Only fires if the host opted into marketing communications).
- **Purpose:** Reminds Hosts about QR placement and is intended to reduce the likelihood that a trial ends before the wall receives a Guest contribution.
- **Content:** "Did you get your QR code printed? Here is a quick tip on the best place to display it to get your first guest memory."
Automated ROI Milestone Matrix:
- **Purpose:** To demonstrate guest engagement and house-information utility, the system will track both QR Code Scans and Guest Memories.
The Milestones (Triggers & Content):
10 Scans (The Placement Milestone): Confirms that 10 scans were recorded; it does not prove that every Guest read the content.
1st Memory (The First Contribution): Confirms that a Guest added the first memory to the wall; it does not prove a change in sentiment or behaviour.
50 Scans (The Engagement Milestone): Confirms that 50 scans were recorded; it does not prove reduced support demand.
10 Memories (The Engagement Milestone): Shows that multiple guests have actively contributed to the property's shared memory wall.
100 Scans (The Continued-Use Milestone): Reports continued scanning activity without claiming a specific operational outcome.
50 Memories (The Contribution Milestone): Confirms that 50 memories have been contributed without claiming a change in property status or Guest behaviour.
Annual Subscription Renewal Warning (Compliance & Trust):
- **Trigger:** Fires 14 days before an Annual Subscription is scheduled to auto-renew.
- **Purpose:** Gives Hosts advance billing transparency and may reduce renewal surprises or avoidable disputes without guaranteeing a reduction.
- **Content:** A polite heads-up that their yearly plan is renewing soon, with a clear link to the dashboard to manage their billing.
The 90-Day Win-Back Campaign:
- **Trigger:** Fires 90 days after a formerly activated property enters the approved dormant-property period following subscription cancellation. It does not use or target an unpaid draft deleted at Day 30. The campaign fires only where valid marketing consent still exists and the address is not on the suppression list.
- **Purpose:** Re-engages churned users by reminding them of the long-term operational and financial value of the platform, avoiding margin-reducing discounts.
- **Content:** "We've added new ways to help you create a warmer, more useful and memorable guest experience. A better stay may encourage more positive guest feedback on your official booking platform. Log back in to reactivate your wall in one click."
## 9.6 Affiliate Marketing Engine (Post-MVP) [DSB-BOP-P9-006]

### 9.6.1 Affiliate Payout Notification [DSB-BOP-P9-006A]
- **Classification:** Transactional
- **Subject:** You’ve earned a new commission!
Body: Hi {{Affiliate_Name}},
Great work! A host you referred just activated an Annual Subscription.
We’ve successfully processed your 40% commission for their first year, which will be deposited into your account shortly.
> **CTA Button:** `View Affiliate Dashboard`

Any affiliate recruitment, sharing prompt or campaign update is a separate marketing message requiring recorded consent, a send-time suppression check, sender details and unsubscribe.

