# DigiStayBook: Consolidated Business & Operational Plan
**Target Audience:** Joseph (Operations) & Cara (Lead Developer)  
**Project Blueprint:** B2B Short-Term Rental SaaS  
**Status:** Work In Progress (WIP)

---

# Part 1: Core Host Value Proposition

## 1.1 Property Protection ("Friend vs. Stranger" Mindset)

**The Problem:** Fully automated check-ins make short-term stays feel like sterile corporate hotel rooms. Guests who view a stay this way are statistically proven to be more careless, leading to property neglect, broken house rules, and left-behind trash.
**The Solution:** DigiStayBook humanizes the stay. When guests scan the counter placard and see a visual timeline of real families who loved the space before them, their mindset shifts to "staying at a friend's house". This subconsciously compels them to treat the home with deep respect and keep it clean.
## 1.2 Higher Organic 5-Star Reviews (Without Review Fatigue)

**The Problem:** Traditional paper guestbooks sit empty in a drawer or get coffee-stained. Meanwhile, asking guests to leave formal reviews on multiple platforms creates friction.
**The Solution:** DigiStayBook provides a living visual canvas of happy memories rather than a place for clinical star ratings. Building that emotional connection during their stay naturally prompts guests to open their primary booking platform (such as Airbnb, VRBO, Booking.com, or Stayz) at checkout and leave a glowing 5-star review.
**Phase 1:** Mid-Stay Upload & Review Prompt (In-App Action): The guest uploads a photo and text to the digital guestbook during their stay. To maintain strict compliance with booking provider messaging policies, the prompt to copy the text is handled entirely within the DigiStayBook web app. The success modal explicitly states: "Memory added to the wall! Want to use this for your official review? Click 'Copy Text' and paste it into your booking app at checkout!" To achieve this text portability, there is no longer a need to save the review data silently to localStorage; however, localStorage remains strictly utilized for managing the guest's session editing rights.
**Phase 2:** The Host's Checkout Message (Vanilla Compliance): Hosts are provided with a plug-and-play template to insert into their existing automated checkout messages. To ensure 100% compliance with external link and review manipulation algorithms, this template contains no URLs or copy-paste instructions. The template simply reads: "Thank you so much for treating our home like your own. If you loved your stay, it would mean the world to us if you left a 5-star review. Safe travels!"
**Phase 3:** The Universal "Copy" Workflow (The In-App View): Because the mobile-first feed is strictly chronological, a guest will naturally see their own recent post sitting at the very top of the wall. They do not need a customized URL parameter to find it. They simply tap the universal "Copy Text" button on their post either immediately upon uploading, or by scanning the physical QR code one last time before checkout. They can then return to their native booking app and paste the text into the official review form.
## 1.3 Zero-Friction Guest Experience

No App Downloads or Passwords: Guests scan the counter QR code and instantly access the wall. There are no account setups, app installations, logins, or upsell popups standing in their way.
Overcoming Blank Page Anxiety: Guests can quickly upload photos and/or messages, creating a lasting visual legacy that remains active for as long as the host maintains their subscription.
## 1.4 Minimal Operational Overhead for Hosts

Automated Moderation & Quarantine Architecture: Hosts don't need to spend hours manually messaging guests or managing software bloat. To protect the host's brand and listing reputation without sacrificing the speed of the guest experience, the platform utilizes a secure "Quarantine-First" architecture. When a guest submits a post, the files are uploaded to a private, non-public storage bucket, and the post is temporarily assigned a processing status.
Sub-Second AI Screening: While the guest sees a brief, optimistic loading state (e.g., "Securing your memory..."), a dual-layer moderation system runs server-side: a lightweight AI image moderation API (e.g., AWS Rekognition/Google Cloud Vision SafeSearch) and a concurrent text-filtering API (including string-matching for profanity and sentiment analysis). To comply with biometric privacy laws (e.g., BIPA, EU AI Act), the AI solely scans for unsafe/explicit content. No biometric data or facial recognition templates are generated, extracted, or stored from guest images.
Safe Routing Logic: Based on the server-side scan, the system executes one of three actions:
Clear (Instant Gratification): If no flags are detected, the post's status updates to published, moving the assets to the public wall instantly.
Standard Flag (Host Review): If an image is flagged for standard NSFW/racy content, or if text contains profanity, negative sentiment, or competitor URLs, the post remains in private quarantine and is routed to "Pending Host Approval". The guest immediately sees a graceful "Pending" UI state stating: "Memory added! Your host is reviewing this post to add it to the public wall." This keeps standard curation as the host's responsibility.
Tier-2 Internal Trust & Safety Escalation (Bypass Protocol): The platform utilizes a secondary, critical-severity threshold. If the AI moderation API detects severe violations (such as explicit violence or severe hate speech), the system bypasses the host entirely. The post is permanently blocked from the public wall and routed to a restricted internal DigiStayBook Admin Trust & Safety queue with tightly controlled retention. Any content flagged as severe legal liability (e.g., CSAM) is immediately locked down from public view. However, all mandatory government/authority reporting protocols require manual verification by the Internal Operations Team to prevent false-positive automated reports.
Automated Privacy Takedowns & "Right to be Forgotten" Routing: To comply with global privacy laws without requiring a manual platform helpdesk, every public post features a "Report" flag. When clicked, the guest is prompted to select a reason, including a specific "Privacy - I want my content removed" option. If the guest is unauthenticated (lost session), this action routes the post to a "Pending Review" queue in the host's dashboard, where the host can determine its validity to prevent malicious mass-hiding. If the host approves, or if the guest still has an active session, the post is hidden and routed for permanent deletion. If a Host does not action a privacy deletion request within 14 days, the platform will automatically execute the permanent deletion to maintain regulatory compliance.
Anti-Abuse Safeguards (The Circuit Breaker): To prevent malicious actors from weaponizing this instant-hide feature to mass-hide a host's wall (an application-layer DoS attack), the reporting mechanism is fortified by Firebase App Check, strict rate limiting, and session-based deduplication. If abusive reporting patterns are detected from a specific device (e.g., flagging multiple posts in rapid succession), the system's circuit breaker trips. The system automatically ignores the spam flags, leaves the targeted posts visible on the public wall, and logs the attempt—shielding the platform from liability and protecting the host from sabotage.
Simple Curation: Hosts can quickly hide or delete unwanted posts from a clean dashboard grid whenever they check in on their stay.
No Guest Support Fatigue: The guest portal strictly prevents guests from using the platform to send direct messages to the host, protecting the host's inbox.
## 1.5 Clear Financial ROI & Operational Expense

Operational Expense: The subscription is generally considered a tax-deductible* operational business expense for active rental operators.
High Value, Low Cost: For a small monthly or annual baseline, hosts protect a major real estate asset from damage, lower cleaning overhead, and boost review trajectories to drive higher booking returns.
## 1.6 Supplementary Utility: On-Demand House Information & Local Rules

Beyond serving as an interactive visual guestbook, hosts can leverage their digital wall as a lightweight digital house manual. By pinning informational posts to the top of the canvas, hosts can seamlessly display essential stay details—such as waste management schedules, amenity guidelines (e.g., pool or HVAC instructions), kitchen inventory locations, and general house rules. This provides guests with immediate, frictionless access to key stay operational information upon scanning the QR code, reducing repetitive messaging inquiries and improving rule compliance.
### 1.6.1 Pinned Post Categories & Content Guidelines

To ensure hosts get the most value out of the digital house manual feature, we provide the following core pinned message suggestions:
The "How-To" Guide (Property Amenities)
- **Purpose:** Preempt common guest questions and drastically reduce host support messages.
Suggested Host Content: Wi-Fi network and password (or a scan-to-connect QR code screenshot), Climate control instructions (AC/Heating quirks, remote locations), Waste management rules (specific bin days and lid colors), and instructions for any specific or complex house tech.
Local Hotspots & Hidden Gems
- **Purpose:** Reinforce the "staying at a friend's house" mindset by providing authentic, localized recommendations rather than generic tourist lists.
Suggested Host Content: Top local eats broken down by cuisine/craving, the best local spots for sunset or scenic views, family-friendly daytime activities, and authentic community events.
The Frictionless Checkout Guide
- **Purpose:** Protect the physical asset and set clear expectations for cleaners without making the guest feel like they are doing unpaid labor. (Advise hosts to keep this to 3-5 brief bullet points).
Suggested Host Content: Dishwasher instructions (e.g., load and start on normal cycle), power and climate down reminders (turn off AC and lights), rubbish removal (tie up bags and place in outdoor bins), exact lock-up and keybox procedures, and a final prompt reminding them to upload a memory to the digital wall and copy the text for their official 5-star review.
The "Meet the Host" / Property Journey Pin
- **Purpose:** Humanize the physical asset to amplify the "Friend vs. Stranger" mindset, drastically increasing the psychological friction against property damage.
Suggested Host Content: A brief, welcoming story about the home, a photo of the host/family, or "before and after" photos showing the sweat equity and care put into the property's renovations.
# Part 2: Interactive Demo Wall & Dual Display Architecture

## 2.1 Pre-Purchase Sandbox & Customization

Host Sandbox Mode: Prior to subscription activation, hosts have full access to an interactive "Demo Wall" workspace where they can upload custom photos, write preliminary welcome notes, and experiment with spatial layouts.
Pre-filled Dummy Data: To eliminate the sterile "blank wall" feeling, the Pre-Purchase Sandbox is pre-populated with 10 high-quality, dynamic dummy posts. This immediately demonstrates the platform's value and visual appeal to the host.
Anti-Blank Wall Guarantee (Seeding): Before going live, hosts must ensure the digital wall is not empty. They can either upload a custom "Foundational Post" (such as a welcome text message or a photo of the property) OR opt to have the system automatically carry over beautifully designed, generic placeholder posts (e.g., a "Welcome to our home!" graphic) from the Sandbox. This guarantees the first scanning guest never faces an empty screen, removing host onboarding friction.
Revenue Guardrail: While hosts can test layouts in real time, live public routing links and high-resolution downloadable QR placards remain hard-locked until a valid payment method is securely authorized via Stripe.
## 2.2 Layout Control & Content Hierarchy

Mobile-First Chronological Feed: Designed for phone browsers, the primary feed renders chronologically with the newest guest posts appearing at the top.
Featured & Pinned Content: Hosts retain full editorial control to override standard chronological order:
Host Featured Posts: Hosts can specify custom messages or house guidelines to sit permanently at the top of the mobile view.
Guest Pinning: Hosts can select high-value guest photos and messages to be "pinned" to the top of the feed.
Standard Stream: All non-pinned guest contributions flow directly beneath featured content in reverse-chronological order (newest first), giving checking-in guests instant feedback upon posting.
## 2.3 Physical-First QR Architecture (MVP Focus)

To ensure "Zero Operational Overhead," the MVP strictly relies on physical, printed QR placards placed in the property. This completely eliminates hardware dependencies, Wi-Fi reconnection issues, and battery management requirements associated with in-stay tablet displays, ensuring the system is always online and maintenance-free for the host.
## 2.4 Guest Contribution & Self-Service Management

Multi-Image Batch Uploads: Guests can attach and submit up to 10 images simultaneously in a single post.
The Universal Copy Button: Every single guest post rendered on the live chronological wall must feature a lightweight "Copy Text" button (or a simple clipboard icon) embedded within the text block. When a guest taps this button, the text is instantly saved to their device's clipboard, and the icon temporarily transforms into a green checkmark accompanied by a "Copied!" notification. This single UI element completely eliminates the friction of a guest having to re-type their positive sentiments, bridging the gap between our platform and the host's primary booking engine without requiring complex API integrations or fragile browser storage.
Frictionless Post Editing: To ensure a smooth experience, guests are provided with instant self-service controls allowing them to edit text or delete their submitted posts at any time without requiring host intervention.
Graceful Pending UI State: To prevent guests from assuming the app is broken if their post is caught by the AI moderation filters (including false positives), the client-side upload tool must handle flagged content gracefully. Instead of a standard post appearing in the feed, the guest receives a specific success modal: "Memory added! Your host is reviewing this post to add it to the public wall." This prevents frustrated guests from repeatedly attempting to upload the same images.
Automated Takedown / The Privacy Request Modal (Secured): To satisfy data privacy requirements securely, every post on the public wall features a subtle "Report" icon. Clicking this opens a lightweight modal asking the guest to select a reason, featuring a prominent "Privacy - I want my content removed" option. Selecting this routes the request to the host's dashboard for review to prevent malicious abuse. If the host does not action the request within 14 days, the platform will automatically delete the content to ensure privacy compliance.
Graceful Rate Limiting: This client-side action is protected by strict per-session rate limits and Firebase App Check. If the rate limit is exceeded by a malicious user attempting to mass-report the wall, the UI will still gracefully confirm the report to the user (e.g., showing a "Report Submitted" success modal) to prevent escalation. However, the server will silently drop these malicious requests, leaving the posts visible to protect the host's wall.
The Consent Checkbox (Micro-Friction): To legally protect the host, the upload flow features a mandatory, single-tap checkbox immediately above the "Submit" button explicitly linking to both documents, stating: "I agree to the Guest Terms and Privacy Policy, consent to this image being displayed publicly, and confirm I am over 16 years of age." This logs timestamped consent without requiring an account.
The Dynamic Photo Challenge Dropdown: To cure guest "blank page anxiety," the upload page will feature a dynamic writing prompt. To ensure zero operational burden for the host, they will simply select their preferred prompt from a pre-written dropdown list in their dashboard (which they can change over time). Examples of these prompts include:
"Who made the best breakfast this morning?"
"Show us your best sunset or sunrise view!"
"Group selfie time! Show us the whole crew."
"What was the absolute best meal you ate nearby?"
"Capture the absolute coziest spot you found in the house."
The Private Feedback Safety Net: On the guest upload page, add a secondary, optional text-only form titled "Private Feedback / Help Us Improve." This allows guests to vent minor frustrations (e.g., "we couldn't find the AC remote" or "where do you keep the spare towels?") privately to the host, preventing those grievances from ending up in their official public booking platform reviews. The host can then use this data to improve their pinned house manual posts for future guests.
Operational Guardrail: To ensure this does not violate the "No Guest-to-Host Messaging" rule or become a live help desk, the UI must include explicit microcopy setting boundaries and assuring privacy. It must state: "Note: This feedback is kept strictly private and will not be published to the public memory wall. It is not monitored in real-time and your host will not reply here; it is strictly used to improve our house manual for future guests. If you need immediate assistance during your stay, please message your host directly through your booking app."
# Part 3: Commercial Strategy & Resource Allocation

## 3.1 Core Focus

This product operates strictly in the B2B short-term rental market.
## 3.2 Operational Boundary (Support Level)

To protect operational capacity and eliminate administrative support fatigue, the platform enforces strict communication boundaries:
No Guest-to-Host Messaging: The platform will explicitly not feature a direct communication link or messaging system between guests and hosts. Guests cannot message hosts to ask questions or request support. However, guests are permitted to send one-way, text-only private feedback upon checkout (e.g., reporting a broken appliance), which does not require or allow a host reply. If a guest has an issue with the property, they must contact the host through their original booking provider (e.g., Airbnb, VRBO, Booking.com).
No Guest-to-Platform Support: DigiStayBook does not provide support to guests. Any contact forms provided on the platform are strictly for property hosts. Guests attempting to contact DigiStayBook will be directed back to their booking platform to resolve stay-related queries.
No Maintenance Ticketing: In-app "maintenance reporting" or "issue ticketing" features will NOT be built, as they violate the core tenet of zero administrative burden for the host. All stay-related issues must remain on the primary booking platform.
Host-Initiated Malicious Guest Escalations: To protect hosts from targeted harassment or spam without pulling internal operations into standard guest-to-host disputes, Hosts are provided a "Report to Platform" option in their dashboard for severe offenses only. This routes the user data (including timestamp and IP address) to internal Operations, allowing the platform to permanently ban the malicious guest's device from the platform via IP/device fingerprinting.
## 3.3 Onboarding & Revenue Safeguards

To accommodate multi-property hosts and delay payment friction, the system enforces a strict multi-stage boundary:
Account Setup: The host registers using a standard email/password combination or via single sign-on (SSO) options (e.g., a Google Account). They are not asked for property details or payment at this stage. To ensure strict compliance with ACMA spam regulations for the subsequent Cart Abandonment email sequence, the registration form must include a clear, un-ticked checkbox requesting explicit consent to receive marketing and promotional communications.
Property Creation & The Pre-Activation Gate: The host adds a property from their dashboard. Mandatory Inputs: During this step, the host must input their specific booking platform listing URL (e.g., their exact Airbnb or VRBO link) to power the checkout review modal. Additionally, the host must fulfill the "Anti-Blank Wall Guarantee" (either uploading a custom post or selecting default placeholders). They have full access to the dedicated Property Page to customize themes and view a live preview, but live routing URLs and downloadable QR code kits remain hard-locked.
Checkout: The host clicks 'Activate Property' and completes the checkout flow via the payment processor. Only when a valid payment method is successfully authorized (or a 100% discounted total via coupon is confirmed) does that specific property become active, unlocking link generation and dynamic QR compilation.
## 3.4 Dynamic Billing Architecture

Tiers: Monthly Subscription (~$USD10/mo) and Annual Subscription (~$USD100/yr).
Localization Rules: Prices must render in the host's native point-of-sale currency (e.g., AUD, GBP, EUR, USD) and must be cleanly rounded to the nearest whole unit.
Promo/Coupon Codes: The checkout infrastructure must include a field for Stripe promotional codes. While not actively marketed at MVP launch, this feature allows for future promotional campaigns and, crucially, enables internal testing in the live production environment (e.g., using a 100% off coupon to activate a property) without incurring actual Stripe charges.
Renewals: Handled automatically on a recurring basis at the locked-in localized rate. No manual invoicing required.
Checkout Microcopy & Stripe Compliance: The checkout page must display clear terms to prevent chargebacks, structured as follows:
Option A (For Monthly Subscriptions): "Start your 28-day free trial. By providing your payment information and clicking 'Start Trial,' you agree to our Terms of Service and Cancellation Policy. You will not be charged today. After your 28-day free trial ends on {Dynamic Date: e.g., August 30, 2026}, your subscription will automatically renew at ${Price}/month until you cancel. You can cancel at any time in your Host Dashboard with one click."
Option B (For Annual Subscriptions): "Start your 28-day free trial. By providing your payment information and clicking 'Start Trial,' you agree to our Terms of Service and Cancellation Policy. You will not be charged today. After your 28-day free trial ends on {Dynamic Date: e.g., August 30, 2026}, your subscription will officially begin, and your card will be charged ${Price} for your first year. It will automatically renew annually until you cancel. You can cancel at any time in your Host Dashboard with one click."
Implementation Notes for Stripe: The checkout page must dynamically calculate and display the exact date the trial ends (do not just say "in 28 days"). Additionally, include a required explicit consent checkbox next to the disclaimer that says, "I understand I will be billed ${Price} on {Date} if I do not cancel."
# Part 4: Operational Workflows & Communications

## 4.0 Commercial Messaging Compliance (Spam Act 2003)

All automated emails, specifically the Cart Abandonment (4.2) and Win-Back (4.3) sequences, are classified as commercial electronic messages. To comply with the Australian Communications and Media Authority (ACMA), all emails will automatically include:
Clear sender identification and contact details.
A functional, one-click 'Unsubscribe' link in the footer that remains active for at least 30 days.
System architecture that guarantees unsubscribe requests are honored and processed across all marketing lists within 5 business days.
## 4.1 Host Email Lifecycle

The Platform Welcome (Account Creation): Fired instantly when a host signs up via email or SSO (before any payment is made). The goal is to welcome them to the platform, explain the dashboard, and drive them to add their first property to start their trial.
The Property Activation (Asset Delivery): Fired every time a host successfully completes checkout and activates a property (whether it is their first or fiftieth property). It delivers the specific high-resolution QR code kit for that location, provides the plug-and-play checkout message templates for immediate insertion into their automated booking platform sequences, and prompts them to manage their foundational posts.
The Moderation Alert (AI or Guest Flag): Fired when the AI moderation system (image or text) flags a guest post, or when a guest uses the automated "Report" button, routing the content to "Pending Host Approval". Prompts the host to log in and review the flagged/hidden content so it doesn't sit unseen.
Trial Expiry Notice: As a courtesy, an automated email reminder is sent to the host's registered email address prior to the conclusion of their 28-day free trial.
Automated Monthly Receipts: Delivered immediately post-billing cycle. Provides a clean, itemized tax invoice so hosts can easily claim the subscription as a tax-deductible* operational business expense. (Note: General upcoming renewal reminders for standard paid monthly subscriptions are not sent. However, an annual renewal warning is sent for annual plans, alongside the initial trial expiry notice).
Card Expiring Soon (Pre-Dunning): Fired automatically via Stripe 30 days before the active credit card on file expires to preemptively avoid failed payments and grace periods.
Failed Payment Flow (The Grace Period): Fired immediately if a payment fails. The system grants a 14-day soft grace period where the property memory wall remains fully active for checking-in guests to better accommodate B2B operators. The email provides a polite warning and a secure link to update payment details before suspension.
Service Suspension (The Final Notice): Fired immediately after the 14-day soft grace period concludes following a failed payment. Confirms that the QR code is now deactivated and provides a "Reactivate Now" link to restore service. Crucially, deactivated QR codes do not lead to a broken URL or standard 404 error. Instead, they route to a beautifully designed, professional fallback page that simply states: "This property's digital guestbook is temporarily offline." This protects the host's professional image with their in-house guests even if they missed a payment.
Cancellation Confirmation: Fired instantly upon dashboard account closure, confirming the termination and noting the precise date service will cease.
## 4.2 Lead-Nurturing Cart Abandonment Sequence

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
Trigger: Fires if a host names a property but exits before clicking "Activate Property" and completing checkout. (Note: This sequence only fires if the host explicitly checked the marketing consent opt-in box during Account Setup).
Email 1 (1 Hour Post-Abandonment): Initial check-in asking if they hit a snag, directing them to the FAQ, and reiterating the core value of humanizing the stay to ensure guests respect the property.
Email 2 (24 Hours Post-Abandonment): Focuses on the "Booking Platform reviews" angle—explaining how capturing emotional connections naturally leads to 5-star reviews upon checkout.
Email 3 (3 Days Post-Abandonment): Focuses on the commercial benefits, reminding the host that the subscription is a tax-deductible* operational business expense that protects their physical investment.
Email 4 (30 Days Post-Abandonment): Notice of impending unpaid property deletion, creating a final sense of urgency to lock in their QR kit.
## 4.3 Retention & Engagement Lifecycle

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
The "Activation" Nudge (Day 7 Check-in):
- **Trigger:** Fires 7 days after a Host successfully activates a property (initiating their free trial) only if the property has zero guest posts. (Note: Only fires if the host opted into marketing communications).
- **Purpose:** Prevents hosts from reaching the end of their free trial without experiencing the product's value.
- **Content:** "Did you get your QR code printed? Here is a quick tip on the best place to display it to get your first guest memory."
Automated ROI Milestone Matrix:
- **Purpose:** To constantly prove the platform is an indispensable, tax-deductible* operational expense, the system will track both QR Code Scans (utility/engagement) and Guest Memories (review pipeline).
The Milestones (Triggers & Content):
10 Scans (The Placement Win): Validates that guests are seeing the QR code and actively reading the digital house rules.
1st Memory (The Aha! Moment): Proves the emotional connection is working. ("Success! A guest just left their first memory on your wall.")
50 Scans (The Traction Milestone): Proves the digital house manual is actively reducing host support messages.
10 Memories (The Review Engine): Reminds the host of the 5-star review potential.
100 Scans (The Superhost Milestone): Validates long-term utility.
50 Memories (The Legacy Milestone): Proves the property has successfully shifted from a sterile rental to a loved home.
Annual Subscription Renewal Warning (Compliance & Trust):
- **Trigger:** Fires 14 days before an Annual Subscription is scheduled to auto-renew.
- **Purpose:** Mitigates the risk of Stripe disputes and chargebacks that occur when users are silently billed for large annual amounts after a year of no billing communication.
- **Content:** A polite heads-up that their yearly plan is renewing soon, with a clear link to the dashboard to manage their billing.
The 90-Day Win-Back Campaign:
- **Trigger:** Fires 90 days after a host fully cancels their subscription and their account goes dormant. (Note: Only fires if the host opted into marketing communications).
- **Purpose:** Re-engages churned users by reminding them of the long-term operational and financial value of the platform, avoiding margin-reducing discounts.
- **Content:** "We've added some new features since you left. Are you still capturing 5-star reviews? Remember, keeping your digital guestbook active helps guests treat your space with respect, protecting your physical investment—and it remains a tax-deductible* operational expense. Log back in to reactivate your wall in one click."
## 4.4 Internal Admin Lifecycle & Moderation

To protect margins and prevent operational bottlenecking as the platform scales, internal team moderation is strictly limited to an "Escalation-Only" model, managed via a hidden Admin URL (e.g., admin.digistaybook.com).
The Daily Sweep (Operations): The internal operations team executes a single daily review of the "Critical Escalation Queue." This queue only contains items flagged by the AI as severe legal liabilities or manual Host-Initiated Escalations. Operations resolves these with a one-click action: either Hard Delete & Ban IP (if malicious) or Downgrade to Host Review (if a false positive).
Monthly AI Tuning (Quality Assurance): To ensure the AI moderation filters are not overly aggressive (which creates guest friction), the operations team reviews a random sample of 50 standard AI-flagged posts monthly. If the false-positive rate exceeds acceptable margins, the confidence threshold of the image moderation API is adjusted down to reduce unnecessary "Pending" states.
# Part 5: Future Expansion Roadmap (Post-MVP)

These modules will be built after the MVP is stable. They are focused on scaling acquisition and engagement without adding operational bloat.
## 5.1 Affiliate & Referral Marketing Engine

**Goal:** Scale host acquisition passively via peer-to-peer and influencer networks.
**Workflow:** Affiliates generate leads via unique tracking links.
Billing Rule: To prioritize upfront cash flow, commissions are only paid out on Annual Subscription sales. The payout is 40% of the first year's revenue, ensuring the commission dynamically scales with localized pricing (e.g., if a user pays the equivalent of $50 USD in their local currency, the payout is $20 USD).
Affiliate Payout Notification: An automated email triggered to confirm a successful referral. It notifies the affiliate partner of their $40.00 USD payout, delivering immediate positive reinforcement to encourage continued network sharing.
## 5.2 Contextual Location-Based Writing Prompts

**Goal:** Eliminate "blank page anxiety" for guests and increase upload rates by providing tailored writing prompts.
**Workflow:**
Hosts select a property archetype from a predefined list (e.g., Default, Beach, Mountain/Country, Urban/City) within their settings.
When guests scan the QR code, the system reads this archetype and dynamically displays location-aware placeholder text (e.g., "Our favorite hiking trail nearby was..." for Mountain properties).
## 5.3 Dual-Carousel Tablet Display (Enterprise/Pro Tier)

**Workflow:** A dedicated UI built for hosts who wish to run a dedicated iPad/tablet on the counter. The interface will feature a left carousel for host-pinned guidelines and a right carousel for live community posts, alongside a persistent on-screen QR code for guests to interact via their personal phones.
## 5.4 Direct Booking Retention Links

**Goal:** Increase financial ROI for hosts by capturing repeat guests without platform commission fees.
**Workflow:** Allow hosts to add a permanent "Book Your Next Stay Directly" button or URL link to their specific property feed, capitalizing on the moment guests are enjoying their stay and scrolling through happy memories.
## 5.5 Client-Side Auto-Translation for House Manuals

**Goal:** Eliminate language barriers for international guests reading the host's manually written rules without creating complex translation admin work for the host.
**Workflow:** Leverage standard mobile browser APIs to detect the guest's default language and offer a lightweight toggle to auto-translate the host's pinned text (like the Checkout Guide and How-Tos) into the guest's native language.
# Part 6: Website Architecture & Required Pages

This architecture accommodates multi-property hosts, delays payment friction, and centralizes management into a dedicated Property Page.
## 6.1 The Home Page (Main Landing Page)

**What to display:**
Main headline and value proposition.
The "About Us" story.
Pricing plans.
The 45-second video preview.
Required Button: "Sign Up or Log In"
**Button Destination:** Directs the user to the Sign-Up/Log-In Page.
## 6.2 The Pricing Page

What it’s for: Clearly breaking down the commercial value, the subscription tiers, the 28-day free trial offer, and the financial advantages of the platform to drive account creation and property additions.
**What to display:**
- **Main Headline:** A clear, value-focused statement (e.g., "Protect Your Property. Boost Your Reviews. Simple Pricing.").
- **The Free Trial Callout:** A highly visible banner stating that hosts receive a 28-day free trial for their first property. The copy must clarify the workflow: "Create your account and add your first property to activate your 28-day free trial."
The Pricing Tiers (Toggle or Side-by-Side):
Monthly Subscription: ~$USD10/mo. Must render dynamically in the host's native point-of-sale currency (e.g., AUD, GBP, EUR, USD) and be cleanly rounded to the nearest whole unit.
Annual Subscription: ~$USD100/yr. Must also render dynamically in the host's local currency and visually highlight the built-in discount (e.g., "Get 2 months free").
Unified Feature Checklist: Because both tiers offer the exact same complete platform, display a single bulleted checklist confirming everything is included regardless of the tier chosen (e.g., unlimited uploads, QR kit, dashboard moderation).
- **Multi-Property Note:** A brief explanation stating that billing is calculated per property, but all properties are managed seamlessly from a single host dashboard.
- **The ROI & Tax Callout:** A dedicated section explicitly reminding hosts that the subscription is a tax-deductible* operational business expense.
- **Trust & Cancellation Note:** A brief sentence stating, "Cancel anytime before your next billing cycle," with a hyperlink directly to your Cancellation & Billing Policy.
Required Buttons (Conditional Logic):
If the user is NOT logged in: "Create Free Account" or "Sign Up & Claim Trial".
If the user IS logged in: "Go to Dashboard" or "Add a Property".
Button Destinations:
If the user is NOT logged in: Directs the user to the Sign-Up Page to create their credentials.
If the user IS logged in: Bypasses the sign-up flow entirely and directs the host straight to their Host Control Center (The Dashboard).
## 6.3 Sign-Up / Log-In Page

**What to display:** A streamlined form featuring one-click social login options (e.g., "Continue with Google") alongside standard email and password creation/entry. Hosts are not asked for their property name or directed to pay at this stage.
**Required Buttons:** "Continue with Google" (or similar SSO), and the standard "Submit" or "Create Account" / "Log In" buttons.
**Button Destination:** Directs the host immediately to their Dashboard (Host Control Center).
## 6.4 Host Control Center (The Dashboard)

**What to display:**
A list of every property the host manages.
Clear status indicators next to each property showing if it is in "Active" (paid) or "Unpaid" mode.
**Required Buttons:**
"Add Property"
individual property links/cards.
**Button Destination:**
"Add Property" opens a prompt to name and create a new property listing.
Clicking on any specific property directs the host to that location's dedicated Property Page.
## 6.5 Property Page (Dedicated Management Hub)

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
## 6.6 Host FAQ Page

**What to display:** Answers regarding tax deductions, content moderation, photo privacy, data security, and the full text of the Cancellation & Billing Policy:
Tax Deductibility: *DigiStayBook is often deductible as an operational business expense. According to local tax authorities (such as the ATO, IRS, or HMRC), if you use the software for both work and private purposes, you must apportion your expenses and only claim the eligible business-use portion. Eligibility depends on your circumstances; please seek independent tax advice.
Free Trial & Auto-Enrollment: DigiStayBook offers a 28-day free trial for your first property. A valid payment method is required to begin the trial. You will not be charged during the 28-day trial period. If you do not cancel before the end of the 28th day, your account will automatically transition to an active paid subscription, and your payment method will be charged the standard rate for your selected plan (Monthly or Annual).
How to Cancel: You may cancel your subscription at any time without penalty. To cancel, log in to your Host Dashboard, navigate to the specific Property Page, and click "Cancel Subscription." We do not accept cancellation requests via email or the contact form to ensure the security of your account.
Post-Cancellation Access: If you cancel your subscription (or cancel during your free trial), you will retain full access to your live guestbook and QR code until the end of your current billing cycle or the end of your trial period. After that date, your property's QR code will be deactivated, and the public guestbook will no longer be visible to guests.
Refunds: All subscription charges are non-refundable except where required by law, such as in the event of a major failure under the Australian Consumer Law. Subject to those statutory rights, we do not offer prorated refunds or credits for canceled subscriptions, partial months of service, or unused time.
Trial Expiry Notice: As a courtesy, we will send an automated email reminder to your registered email address prior to the conclusion of your 28-day free trial.
## 6.7 Host Contact Page

**What to display:** A contact form strictly designated for hosts to reach out to Operations. It must feature a highly visible disclaimer stating that the form is strictly for property hosts seeking software support. It must explicitly state that guests cannot use this form to contact hosts or inquire about bookings, and that guests must contact their host directly through their primary booking platform (e.g., Airbnb, VRBO) for any stay-related issues.
## 6.8 The Guest Wall (Public Guestbook Page)

**What to display:** The live, mobile-first visual timeline of approved photos and notes. It displays the specific layout/theme chosen on the Property Page, showing pinned posts at the top and standard posts below.
**Required Buttons:** "Add a Memory/Post" (opens the multi-image upload tool), self-service edit/delete buttons for the guest's own content, and a universal "Report" flag on all posts for instant privacy takedowns.
**Button Destination:** Uploads feed directly into the chronological stream and appear on the host's Property Page for moderation. Reported posts are instantly hidden from the stream pending host review.
# Part 7: Terms and Conditions (Legal Copy)

Last Updated: 3rd August 2026
Welcome to DigiStayBook. These Terms and Conditions ("Terms") govern your access to and use of the DigiStayBook website, dashboard, and digital guestbook services (collectively, the "Service").
By creating an account, starting a free trial, or using the Service, you ("Host", "you", or "your") agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
### 1. Description of Service

DigiStayBook provides a digital guestbook platform for short-term rental operators. The Service allows Hosts to generate property-specific QR codes that enable checking-in guests ("Guests") to upload photos and text to a digital wall. DigiStayBook is a business-to-business (B2B) software provider; we do not manage properties, interact with Guests, or facilitate host-to-guest direct messaging.
### 2. Account Registration and Security

To use the Service, you must register for an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
### 3. Free Trial, Billing, and Subscriptions

3.1. 28-Day Free Trial: DigiStayBook offers a 28-day free trial for your first activated property. A valid payment method is required to initiate the trial. You will not be charged during this 28-day period.
3.2. Auto-Renewal: If you do not cancel your subscription before the end of the 28th day, your account will automatically transition to an active paid subscription. Your payment method on file will be charged the standard rate for your selected plan (Monthly or Annual) on a recurring basis.
3.3. Cancellation: You may cancel your subscription at any time via your Host Dashboard. Cancellations must be processed before your next billing date to avoid future charges. We do not accept cancellation requests via email or contact forms. If you cancel, you will retain access to your active QR codes and Guest Wall until the end of your current paid billing cycle (or the end of your free trial).
3.4. Refunds: All subscription charges are non-refundable except where required by law, such as in the event of a major failure under the Australian Consumer Law. Subject to those statutory rights, we do not offer prorated refunds or credits for canceled subscriptions, partial months of service, or unused time.
3.5. Tax Disclaimer: Any statements regarding tax deductibility are for general marketing purposes only. Eligibility to claim software subscriptions as a business expense depends on your individual circumstances and jurisdictional tax laws (e.g., apportioning business versus private use). You are solely responsible for consulting a qualified tax professional regarding your claims.
### 4. User-Generated Content (UGC) and Host Responsibility

4.1. Guest Uploads: The Service allows your Guests to upload photos, text, and other materials ("User Content"). DigiStayBook acts solely as a passive conduit for this User Content.
4.2. Host Moderation & Automated Security: You acknowledge that while DigiStayBook utilizes automated, server-side security filters to block severe violations (e.g., explicit material or severe harassment), we do not manually pre-screen, monitor, or endorse User Content. As the Host, you retain primary responsibility for curating the Guest Wall for your property using the tools provided in your Host Dashboard.
4.3. Liability: DigiStayBook accepts no liability for User Content uploaded by your Guests, including but not limited to copyright infringement, privacy violations, defamatory statements, or offensive material. You agree to indemnify and hold DigiStayBook harmless from any claims arising from User Content uploaded to your property's Guest Wall.
4.4. Guest Sessions and Formal Accounts: Guests do not create formal accounts to use the Service. Features such as self-service guest editing rely strictly on Firebase Anonymous Authentication and the Guest's local browser session (localStorage). Access to edit or delete their own posts will be permanently lost if the Guest clears their device cookies, utilizes private/incognito browsing, or accesses the wall from a different device.
### 5. Acceptable Use

You agree not to use the Service to:
Promote illegal activities, violence, or harassment.
Distribute malware, viruses, or spam.
Infringe upon the intellectual property or privacy rights of others.
Attempt to bypass, hack, or disrupt the security and functionality of the Service.
We reserve the right to suspend or terminate your account immediately, without notice or refund, if we determine that you have violated these Acceptable Use terms.
To enforce these Terms, protect the platform, and prevent abuse, DigiStayBook logs device-level identifiers and reserves the right to implement permanent IP or device fingerprint bans without prior notice.
Platform Intervention and Takedown Rights: While Hosts retain primary responsibility for moderating their Guest Wall, DigiStayBook utilizes automated security filters to detect severe violations of these Terms (e.g., illegal content, severe harassment). DigiStayBook reserves the right, at its sole discretion and without prior notice to the Host, to permanently delete User Content that poses a severe legal or safety liability to the platform, and to permanently ban the originating IP address or device from accessing the Service.
### 6. Intellectual Property

All software, design, text, layout, and graphics provided by DigiStayBook (excluding User Content and Host-uploaded property features) are the exclusive property of DigiStayBook. You may not copy, reverse-engineer, or resell the software or Service without our explicit written permission.
### 7. Service Availability and Hardware

DigiStayBook provides web-based software. You are solely responsible for providing and maintaining the physical hardware (e.g., printed QR placards, tablet displays) and internet connectivity required for Guests to access the Service at your property. While we strive for 99.9% uptime, we do not guarantee that the Service will be uninterrupted or error-free.
### 8. Limitation of Liability

To the maximum extent permitted by law, DigiStayBook shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising out of your use of or inability to use the Service. In no event shall our total liability to you exceed the total amount you have paid to DigiStayBook in the twelve (12) months preceding the claim.
### 9. Modifications to the Terms

We reserve the right to modify these Terms at any time. If we make material changes, we will notify you via the email address associated with your account or through a notice on your Host Dashboard. Continued use of the Service after changes are published constitutes your acceptance of the revised Terms.
### 10. Governing Law

These Terms shall be governed by and construed in accordance with the laws of Victoria, Australia, without regard to its conflict of law provisions. Any legal disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts located in Victoria, Australia.
### 11. Contact Information

If you have any questions about these Terms, please contact us via the Host Contact Form on our website.
# Part 8: Privacy Policy (Legal Copy)

Last Updated: 3rd August 2026
Welcome to DigiStayBook. We respect your privacy and are committed to protecting the personal data of our Hosts and their Guests. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our website, dashboard, and digital guestbook services (collectively, the "Service").
Please read this Privacy Policy carefully. By accessing or using the Service, you agree to the collection and use of information in accordance with this policy.
### 1. Information We Collect

We collect information in two primary categories: information provided by Hosts (our direct customers) and information provided by Guests (users interacting with a Host's digital guestbook).
A. Information Collected from Hosts
Account Information: When you register for an account, we collect your email address, a secure password, and the name(s) of your property or properties.
Billing Information: When you activate a subscription or free trial, our third-party payment processors (e.g., Stripe) collect your payment details, such as credit card information and billing address. DigiStayBook does not directly view or store your full credit card number.
Property Data: We collect configuration data related to your property, such as custom welcome messages, house rules, and display preferences.
B. Information Collected from Guests
User-Generated Content (UGC): When a Guest scans a property’s QR code, they may voluntarily upload photos, text, and messages to the public Guest Wall.
Technical Data: We automatically collect basic device information when a Guest accesses a Guest Wall via mobile browser, including IP address, browser type, device type, time of access, and device-level identifiers. Guests do not create formal accounts; however, we utilize this technical data, including anonymous session tokens and Firebase App Check, to securely route uploads, prevent fraud, and enforce platform bans against malicious users.
### 2. How We Use Your Information

We use the collected information for the following operational purposes:
To Provide the Service: To host the digital guestbook, generate QR codes, and allow Hosts to moderate their property's Guest Wall.
To Process Payments: To manage subscriptions, free trials, and renewals through our secure payment gateways.
To Communicate with Hosts: To send account-related notices, such as welcome emails, billing receipts, cancellation confirmations, and dashboard access links.
To Improve the Service: To analyze website usage and Technical Data to fix bugs and improve the user experience.
DigiStayBook does not use Guest photos or messages for our own marketing purposes without explicit permission, nor do we sell Host or Guest data to third parties.
### 3. Data Controller vs. Data Processor and the Right to be Forgotten

Under applicable data protection laws (such as GDPR), the Host is the "Data Controller" of the User-Generated Content (photos and text) uploaded to their specific Guest Wall. The Host legally decides which posts remain visible, pinned, or deleted.
DigiStayBook acts strictly as the "Data Processor" and does not provide traditional guest helpdesk support. Instead, Guests can exercise their privacy and data deletion rights ("Right to be Forgotten") autonomously using the tools provided on the platform:
Active Sessions: If a Guest maintains their active browser session, they can use the self-service delete function directly on their device.
Lost Sessions: If a Guest clears their browser data and loses their active session, they can utilize the universal "Report" button on their specific post and select the "Privacy Deletion Request" option. This securely routes the deletion request to the Host's dashboard for validation and final processing, preventing anonymous malicious users from instantly hiding a host's entire wall.
As the Data Processor, DigiStayBook does not directly process or arbitrate data deletion requests from Guests on behalf of Hosts. We fulfill our processor obligations by providing the automated reporting and dashboard deletion tools, empowering the Host to seamlessly execute and honor these requests in compliance with applicable privacy laws.
### 4. How We Share Information

We only share information with third parties in the following limited circumstances:
Service Providers: We share data with trusted third-party vendors who perform services on our behalf, such as cloud hosting providers (e.g., AWS, Google Cloud) and payment processors.
Legal Requirements: We may disclose your information if required to do so by law, court order, or governmental request, or to protect the rights, property, or safety of DigiStayBook, our users, or others.
Business Transfers: If DigiStayBook is involved in a merger, acquisition, or sale of assets, Host data and Guest content may be transferred as a business asset.
### 5. Data Retention and Deletion

Host Data: We retain Host account and billing information for as long as your account is active.
Guest Content: Photos and messages remain on the Guest Wall as long as the Host's subscription is active, unless hidden or deleted by the Host.
Account Cancellation & Dormancy: If a Host cancels their subscription, the live QR code is deactivated at the end of the billing cycle. To accommodate seasonal operators, the property's Guest Wall data is placed in a secure, dormant state (meaning it is "waiting" for you if you reactivate).
Permanent Deletion: If a canceled account remains dormant and inactive for 12 consecutive months, all associated Host data and Guest User-Generated Content will be permanently hard-deleted from our active servers.
### 6. Cookies and Tracking Technologies

We use essential cookies to maintain Host login sessions within the Dashboard and to ensure the platform functions securely. We do not use invasive tracking cookies for targeted third-party advertising.
### 7. Data Security

We implement industry-standard administrative, technical, and physical security measures to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure.
### 8. Children's Privacy

The Service is a B2B platform and is not directed at children under the age of 16. We do not knowingly collect personal information directly from children, and guests must confirm they are over 16 upon uploading content. If you are a Host, it remains your responsibility to moderate any photos containing minors uploaded to your Guest Wall.
### 9. Contact Us

If you have any questions or concerns about this Privacy Policy, how we handle your data, or if you need to make a data privacy request, please contact us via the Host Contact Form located on our website.
# Part 9: Appendix - Automated Email Copy & Templates

## 9.1 Core Host Email Lifecycle

These transactional emails are tied to specific billing and account events to minimize manual intervention.
The Platform Welcome (Account Creation)
- **Subject:** Welcome to DigiStayBook! Let’s protect your property.
Body: Hi {{Host_Name}},
Welcome to DigiStayBook. We built this platform to solve a quiet problem in the short-term rental industry: as check-ins become fully automated, guests treat stays like sterile hotel rooms, leading to less care and more wear-and-tear.
Your new dashboard is ready. To get started, you just need to add your first property.
> ðŸ”˜ **CTA Button:** `Add Your First Property & Start 28-Day Free Trial`

Once activated, you’ll receive your custom QR code kit to instantly start humanizing your guest experience.
The Property Activation (Asset Delivery)
- **Subject:** 🚀 {{Property_Name}} is Live! Here is your QR Kit.
Body: Hi {{Host_Name}},
{{Property_Name}} is officially active! Attached is your high-resolution QR code kit. Simply print the placard and place it on your property's counter.
To guarantee your first scanning guest doesn't see a blank screen, please ensure you have selected your foundational posts in your dashboard.
Automating Your 5-Star Reviews: To seamlessly turn these guest memories into organic 5-star reviews, insert this exact template into your automated checkout messages on Airbnb, VRBO, or Booking.com:
"Thank you so much for treating our home like your own. If you loved your stay, it would mean the world to us if you left a 5-star review. Safe travels!"
> ðŸ”˜ **CTA Button:** `Go to Property Dashboard`

Trial Expiry Notice
- **Subject:** Your DigiStayBook trial for {{Property_Name}} ends soon.
Body: Hi {{Host_Name}},
We hope you are seeing the value of a digital guestbook! As a courtesy reminder, your 28-day free trial for {{Property_Name}} will conclude in a few days.
You don't need to do anything to keep your Guest Wall active—your subscription will automatically seamlessly roll over to your selected paid plan.
> ðŸ”˜ **CTA Button:** `Manage Billing`

Automated Monthly Receipt
- **Subject:** DigiStayBook Receipt: {{Month}}
Body: Hi {{Host_Name}},
Thank you for your continued partnership. Your monthly invoice for {{Property_Name}} is attached below. A quick tip for your accounting: Your DigiStayBook subscription is a tax-deductible* operational business expense.
> ðŸ”˜ **CTA Button:** `Download PDF Invoice`

Card Expiring Soon (Pre-Dunning)
- **Subject:** Action Needed: Your payment method is expiring soon.
Body: Hi {{Host_Name}},
The credit card on file for your DigiStayBook account is set to expire in the next 30 days.
To ensure your property’s QR codes remain active and your guests can continue uploading memories without interruption, please take a moment to update your payment details.
> ðŸ”˜ **CTA Button:** `Update Payment Method`

Failed Payment Flow (The Grace Period)
- **Subject:** Payment Failed – Action required to keep {{Property_Name}} active.
Body: Hi {{Host_Name}},
We were unable to process your recent subscription payment for {{Property_Name}}. We know you are busy running a B2B operation, so we have granted a 14-day soft grace period. During this time, your Guest Wall remains fully active for your checking-in guests.
Please update your payment details before {{Suspension_Date}} to avoid deactivation.
> ðŸ”˜ **CTA Button:** `Securely Update Payment`

Service Suspension (The Final Notice)
- **Subject:** Notice: {{Property_Name}}'s digital guestbook is offline.
Body: Hi {{Host_Name}},
Your 14-day grace period has concluded, and the QR code for {{Property_Name}} has been deactivated.
To protect your professional image with in-house guests, scanning your QR code currently routes to a professional fallback page stating the guestbook is temporarily offline.
You can restore full functionality instantly by reactivating your subscription.
> ðŸ”˜ **CTA Button:** `Reactivate Now`

Cancellation Confirmation
- **Subject:** Confirmation of Subscription Cancellation.
Body: Hi {{Host_Name}},
This email confirms that you have successfully canceled your subscription for {{Property_Name}}.
You will retain full access to your live guestbook and QR code until your current billing cycle ends on {{End_Date}}. After this date, the QR code will be deactivated and the public wall will no longer be visible.
If you ever wish to return, your account data will be kept securely dormant for 12 months before being permanently deleted. We'd love to have you back.
## 9.2 Moderation & Content Safety Emails

#### Email 1A: Moderation Alert – AI Flagged Content

- **Trigger:** The AI image or text API flags potential NSFW material, profanity, negative sentiment, or external URLs.
- **Timing:** Immediate (Real-Time)
- **Subject:** 🛡️ Action Required: Guest post flagged for review ({{Property_Name}})
Body: Hi {{Host_Name}},
Our automated safety filter just flagged a new guest submission at {{Property_Name}}.
To protect your listing reputation and brand, the post has been automatically placed in Pending Host Approval and is currently hidden from your public wall.
Flag Reason: {{AI_Flag_Reason}} (e.g., Unfiltered Language / Image Moderation Flag)
What to do next: Review the post in your dashboard to publish it to your live wall or permanently delete it.
> ðŸ”˜ **CTA Button:** `Review Flagged Post`

#### Email 1B: Moderation Alert – Guest "Report" Flag (Privacy Takedown)

- **Trigger:** An in-stay guest taps the "Report" flag on any post on the public wall (e.g., accidental photo of a minor or privacy request).
- **Timing:** Immediate (High Priority)
- **Subject:** ⚠️ Action Required: Privacy or Takedown Request at {{Property_Name}}
Body: Hi {{Host_Name}},
A guest viewing your public digital wall at {{Property_Name}} has flagged a post and requested its removal.
To ensure your property remains compliant with data privacy laws (such as a guest's "Right to be Forgotten"), the reported post has been instantly hidden from public view and routed to your dashboard.
Report Details: Date Reported: {{Report_Timestamp}} Status: Hidden from Public Wall
Your Next Steps: As the Data Controller for your guestbook, please log in and navigate to the "Privacy & Takedown Requests" tab. If this is a valid request from your guest, you must click "Confirm Permanent Deletion." If you believe this is a malicious or false report from a competitor, you can reject the request. Note: If you do not action this request within 14 days, the platform will automatically permanently delete the content to ensure compliance.
> ðŸ”˜ **CTA Button:** `Review Deletion Request`

## 9.3 Security & Account System Emails

#### Email 2A: Password Reset Request

- **Trigger:** Host clicks "Forgot Password" on the login screen.
- **Timing:** Immediate
- **Subject:** Reset your DigiStayBook password
Body: Hi {{Host_Name}},
We received a request to reset the password for your DigiStayBook account ({{Host_Email}}).
Click the button below to set up a new password:
> ðŸ”˜ **CTA Button:** `Reset My Password`

This link will expire in 60 minutes for security reasons.
If you did not request a password reset, you can safely ignore this email—your password will remain unchanged and your account stays secure.
#### Email 2B: Password Successfully Changed

- **Trigger:** Host updates their password in the dashboard or via the reset link.
- **Timing:** Immediate
- **Subject:** Security Alert: Your DigiStayBook password was changed
Body: Hi {{Host_Name}},
This email confirms that the password for your DigiStayBook account ({{Host_Email}}) was successfully updated on {{Change_Timestamp}}.
Device Details: Browser/Device: {{User_Agent}} Location: {{IP_Location}}
Didn't make this change? If you did not authorize this change, please reset your password immediately using the link below and contact support via your Host Dashboard.
> ðŸ”˜ **CTA Button:** `Secure My Account`

#### Email 2C: Email Address Change Verification

- **Trigger:** Host requests an update to their primary account email in dashboard settings.
- **Timing:** Immediate
- **Subject:** Verify your new email address for DigiStayBook
Body: Hi {{Host_Name}},
You recently requested to update your primary login email address for DigiStayBook to {{New_Host_Email}}.
Please verify this new address by clicking the button below:
> ðŸ”˜ **CTA Button:** `Confirm New Email Address`

Once confirmed, all future operational updates, tax receipts, and moderation alerts for your properties will be routed to this address.
#### Email 2D: Unrecognized Device / New Login Alert

- **Trigger:** Account login detected from a new IP address or device.
- **Timing:** Immediate
- **Subject:** New login to your DigiStayBook account
Body: Hi {{Host_Name}},
We noticed a new login to your DigiStayBook host dashboard: Time: {{Login_Timestamp}} Device: {{Device_Type_and_Browser}} Approximate Location: {{IP_Location}}
If this was you, no action is needed! If this wasn't you, please log in immediately to change your password and review your account security.
> ðŸ”˜ **CTA Button:** `Review Account Security`

## 9.4 Lead-Nurturing Cart Abandonment Sequence

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
Trigger: Fires if a host names a property but exits before clicking "Activate Property" and completing checkout. (Note: This sequence only fires if the host explicitly checked the marketing consent opt-in box during Account Setup).
Email 1 (1 Hour Post-Abandonment): Initial check-in asking if they hit a snag, directing them to the FAQ, and reiterating the core value of humanizing the stay to ensure guests respect the property.
Email 2 (24 Hours Post-Abandonment): Focuses on the "Booking Platform reviews" angle—explaining how capturing emotional connections naturally leads to 5-star reviews upon checkout.
Email 3 (3 Days Post-Abandonment): Focuses on the commercial benefits, reminding the host that the subscription is a tax-deductible* operational business expense that protects their physical investment.
Email 4 (30 Days Post-Abandonment): Notice of impending unpaid property deletion, creating a final sense of urgency to lock in their QR kit.
## 9.5 Retention & Engagement Lifecycle

(Compliance Note: As commercial messages, all emails in this sequence must contain a functional unsubscribe link in the footer and clearly identify the sender to comply with ACMA spam regulations.)
The "Activation" Nudge (Day 7 Check-in):
- **Trigger:** Fires 7 days after a Host successfully activates a property (initiating their free trial) only if the property has zero guest posts. (Note: Only fires if the host opted into marketing communications).
- **Purpose:** Prevents hosts from reaching the end of their free trial without experiencing the product's value.
- **Content:** "Did you get your QR code printed? Here is a quick tip on the best place to display it to get your first guest memory."
Automated ROI Milestone Matrix:
- **Purpose:** To constantly prove the platform is an indispensable, tax-deductible* operational expense, the system will track both QR Code Scans (utility/engagement) and Guest Memories (review pipeline).
The Milestones (Triggers & Content):
10 Scans (The Placement Win): Validates that guests are seeing the QR code and actively reading the digital house rules.
1st Memory (The Aha! Moment): Proves the emotional connection is working. ("Success! A guest just left their first memory on your wall.")
50 Scans (The Traction Milestone): Proves the digital house manual is actively reducing host support messages.
10 Memories (The Review Engine): Reminds the host of the 5-star review potential.
100 Scans (The Superhost Milestone): Validates long-term utility.
50 Memories (The Legacy Milestone): Proves the property has successfully shifted from a sterile rental to a loved home.
Annual Subscription Renewal Warning (Compliance & Trust):
- **Trigger:** Fires 14 days before an Annual Subscription is scheduled to auto-renew.
- **Purpose:** Mitigates the risk of Stripe disputes and chargebacks that occur when users are silently billed for large annual amounts after a year of no billing communication.
- **Content:** A polite heads-up that their yearly plan is renewing soon, with a clear link to the dashboard to manage their billing.
The 90-Day Win-Back Campaign:
- **Trigger:** Fires 90 days after a host fully cancels their subscription and their account dormant. (Note: Only fires if the host opted into marketing communications).
- **Purpose:** Re-engages churned users by reminding them of the long-term operational and financial value of the platform, avoiding margin-reducing discounts.
- **Content:** "We've added some new features since you left. Are you still capturing 5-star reviews? Remember, keeping your digital guestbook active helps guests treat your space with respect, protecting your physical investment—and it remains a tax-deductible* operational expense. Log back in to reactivate your wall in one click."
## 9.6 Affiliate Marketing Engine (Post-MVP)

Affiliate Payout Notification
- **Subject:** You’ve earned a new commission! 💸
Body: Hi {{Affiliate_Name}},
Great work! A host you referred just activated an Annual Subscription.
We’ve successfully processed your 40% commission for their first year, which will be deposited into your account shortly.
Keep sharing your unique link to help more hosts protect their properties and grow your passive income.
> ðŸ”˜ **CTA Button:** `View Affiliate Dashboard`

