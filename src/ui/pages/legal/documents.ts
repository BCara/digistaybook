import { legalVersions } from "../../../../functions/src/legal";

/*
 * The guest- and host-facing legal texts. The Terms and Privacy Policy are the
 * handbook's drafts (A.6, A.7, last updated 4 August 2026), carried word for
 * word except the marked additions and updates through 6 October 2026:
 * guest-facing terms, private feedback, Google screening and overseas processing.
 * None of it is approved. Counsel approves these exact versions (C-19), and
 * the approval is recorded in functions/src/legal.ts.
 */

export type LegalSection = { heading: string; paragraphs: string[]; added?: boolean };
export type LegalDocument = { title: string; version: string; lastUpdated: string; intro: string[]; sections: LegalSection[]; reviewNotes: string[] };

export const hostTerms: LegalDocument = {
  title: "Terms and Conditions",
  version: legalVersions.hostTerms,
  lastUpdated: "4 August 2026",
  intro: ["These Terms and Conditions govern access to and use of the DigiStayBook website, dashboard and digital guestbook services (the “Service”). By creating an account, starting a free trial or using the Service, the Host agrees to be bound by them. Guests using a property’s guestbook are covered by the separate Guest Terms."],
  sections: [
    { heading: "1. Description of service", paragraphs: ["DigiStayBook provides a digital guestbook platform for short-term rental operators. The Service allows Hosts to generate property-specific QR codes enabling checking-in guests to upload photos and text to a digital wall. DigiStayBook is a business-to-business software provider: it does not manage properties, bookings or in-stay support, and does not facilitate host-to-guest direct messaging. DigiStayBook interacts with Guests only where needed to operate content controls and address privacy, personal-data or platform content-safety matters."] },
    { heading: "2. Account registration and security", paragraphs: ["The Host must register for an account, is responsible for the confidentiality of their credentials and for all activity under the account, and agrees to notify DigiStayBook immediately of any unauthorised use."] },
    { heading: "3. Free trial, billing and subscriptions", paragraphs: [
      "3.1 Trial. A 28-day free trial applies to the Host’s first activated property. A valid payment method is required to start it. No charge is made during the 28 days.",
      "3.2 Auto-renewal. If the subscription is not cancelled before the end of day 28, the account transitions automatically to a paid subscription and the payment method is charged the standard rate for the selected plan on a recurring basis.",
      "3.3 Cancellation. The Host may cancel at any time through the Host Dashboard. Cancellation must be processed before the next billing date to avoid further charges. Cancellation requests are not accepted by email or contact form. On cancellation the Host retains access to active QR codes and the Guest Wall until the end of the current paid billing cycle or the end of the trial.",
      "3.4 Refunds. Subscription charges are non-refundable except where required by law, including in the event of a major failure under the Australian Consumer Law. Subject to those statutory rights, no prorated refunds or credits are offered for cancelled subscriptions, partial months or unused time.",
      "3.5 Tax. Any statement about tax deductibility is general marketing information only. Eligibility to claim a software subscription as a business expense depends on the Host’s circumstances and jurisdiction, including apportionment between business and private use. The Host is solely responsible for consulting a qualified tax professional."
    ] },
    { heading: "4. User-generated content and host responsibility", paragraphs: [
      "4.1 Guest uploads and platform processing. The Service allows Guests to upload photos, text and other materials (“User Content”). To provide the Service, DigiStayBook stores, automatically screens, routes, publishes, restricts and deletes User Content in accordance with the Host’s settings, the moderation workflow, these Terms and applicable legal obligations.",
      "4.2 Moderation. DigiStayBook applies automated, server-side screening before User Content is eligible for publication. It does not routinely manually pre-screen every submission. Limited manual review may occur for critical internal trust-and-safety cases, legal obligations, escalated platform reports and quality-control activity under restricted access. The Host retains primary responsibility for ordinary curation using the dashboard tools. Automated screening and limited review do not constitute endorsement of User Content.",
      "4.3 Liability for user content. DigiStayBook accepts no liability for User Content uploaded by Guests, including copyright infringement, privacy violations, defamatory statements or offensive material. The Host agrees to indemnify DigiStayBook against claims arising from User Content uploaded to their property’s Guest Wall.",
      "4.4 Guest sessions. Guests do not create formal accounts. Self-service editing and deletion rely on Firebase anonymous authentication and the Guest’s local browser session. Access to edit or delete their own posts is permanently lost if the Guest clears their device data, uses private browsing, or accesses the wall from a different device. The public Privacy & Safety route remains available in that case."
    ] },
    { heading: "4.5 Private guest feedback", added: true, paragraphs: [
      "Guests may send the Host private feedback, which is never published and cannot be replied to through the Service. It is checked automatically; feedback that appears to contain threats, sexual content or hate may be held for review by DigiStayBook’s safety team, which may release it to the Host or delete it. The Host may report any feedback message to the safety team, which removes it from the Host’s inbox pending review. Private feedback is not a support or messaging channel, and the Host must not use it as one."
    ] },
    { heading: "5. Acceptable use", paragraphs: [
      "The Service must not be used to promote illegal activity, violence or harassment; to distribute malware, viruses or spam; to infringe intellectual property or privacy rights; or to bypass, attack or disrupt the security and functionality of the Service. DigiStayBook may suspend or terminate an account immediately, without notice or refund, for a violation of these terms.",
      "To enforce these Terms and prevent abuse, DigiStayBook may use rate limits, duplicate-request controls, account or session restrictions, temporary access restrictions and short-lived pseudonymous abuse keys derived from limited security signals. Security records are access-controlled and retained only for the bounded period in the approved retention schedule. These controls do not create persistent cross-session identifiers.",
      "Platform intervention and takedown. While Hosts retain primary responsibility for ordinary curation, DigiStayBook uses automated filters and limited internal review to identify severe legal or safety concerns. Content presenting a critical concern is immediately blocked from public access and placed in a restricted internal case, retained only for the approved verification, legal and safety period, then securely deleted once the case is resolved and no lawful retention requirement remains. DigiStayBook may apply proportionate account, session or temporary access restrictions and may notify the Host where lawful and safe to do so."
    ] },
    { heading: "6. Intellectual property", paragraphs: ["All software, design, text, layout and graphics provided by DigiStayBook — excluding User Content and Host-uploaded property features — are the exclusive property of DigiStayBook. They may not be copied, reverse-engineered or resold without explicit written permission."] },
    { heading: "7. Service availability and hardware", paragraphs: ["DigiStayBook provides web-based software. The Host is solely responsible for providing and maintaining the physical hardware — printed QR placards and any display devices — and the internet connectivity Guests need to access the Service at the property. The Service is not guaranteed to be uninterrupted or error-free."] },
    { heading: "8. Limitation of liability", paragraphs: ["To the maximum extent permitted by law, DigiStayBook is not liable for indirect, incidental, special, consequential or punitive damages, including loss of profits, data or business opportunity, arising from use of or inability to use the Service. Total liability will not exceed the amount paid to DigiStayBook in the twelve months preceding the claim."] },
    { heading: "9. Modifications to the terms", paragraphs: ["DigiStayBook may modify these Terms. Material changes will be notified by email to the account address or by notice in the Host Dashboard. Continued use after changes are published constitutes acceptance of the revised Terms."] },
    { heading: "10. Governing law", paragraphs: ["These Terms are governed by the laws of Victoria, Australia, without regard to conflict-of-law provisions. Disputes are subject to the exclusive jurisdiction of the courts of Victoria, Australia."] },
    { heading: "11. Contact", paragraphs: ["Hosts with questions about these Terms may use the Host Contact form. Guests and other individuals with a privacy, personal-data or content-safety concern may use the public Privacy & Safety page. Neither route provides booking or property support."] }
  ],
  reviewNotes: [
    "Clause 7: the source draft promised “99.9% uptime”; it is removed because no availability target is set or measured (handbook 5.9). Confirm a measured target or that none is published.",
    "Clause 4.5 is new and covers private feedback, which the 4 August draft predates."
  ]
};

export const guestTerms: LegalDocument = {
  title: "Guest Terms",
  version: legalVersions.guestTerms,
  lastUpdated: "6 October 2026",
  intro: ["These terms apply when you use a property’s DigiStayBook guestbook as a guest: reading its wall, adding a memory, or sending private feedback to your host. You do not need an account. The host of the property runs their guestbook; DigiStayBook provides the software."],
  sections: [
    { heading: "1. Adding a memory", added: true, paragraphs: [
      "A memory is a message and up to ten photos for the property’s guestbook wall. By submitting one you confirm you are 16 or older, that you took the photos or have the right to share them, and that everyone recognisable in them is happy for them to be shown.",
      "You consent to your memory being shown publicly on that property’s guestbook, including on screens in the property and on any page where the host displays their wall. If you add an optional guest name, it is displayed with your memory; leaving it blank shows no name. The host may hide, pin or remove memories, and nothing you post is guaranteed to stay up."
    ] },
    { heading: "2. Private feedback", added: true, paragraphs: [
      "Private feedback goes to your host only and is never shown on the wall. It is not monitored in real time and your host cannot reply to it here. It is not a way to get help during your stay: for anything urgent, contact your host through your booking app, or the emergency services if anyone is in danger."
    ] },
    { heading: "3. Screening", added: true, paragraphs: [
      "Memories and private feedback are checked automatically before they reach the wall or your host. Memories that may break these terms are held for review and may never be published. Private feedback that appears to contain threats, sexual content or hate may be held for DigiStayBook’s safety team, who may pass it to your host or delete it. Automated checks are not perfect, and their result is not an endorsement of anything posted.",
      "Photos are stored in Sydney, Australia. Automated photo safety checks involve overseas processing by Google Cloud Vision, configured to use its European Union service endpoint. Google may also handle information in other countries under its service and data-processing terms. See the Privacy Policy for details."
    ] },
    { heading: "4. What you must not post", added: true, paragraphs: [
      "Nothing illegal, threatening, harassing, hateful or sexually explicit; nothing that shares someone else’s personal information without their permission; no photos of children who are not yours; no advertising, spam or links meant to mislead; and nothing you do not have the right to share. Content that breaks these rules may be removed, and the session that posted it may be restricted."
    ] },
    { heading: "5. Changing or removing what you posted", added: true, paragraphs: [
      "From the same browser you used to post, you can edit or delete your memories at any time. If you have cleared your browser, used private browsing or changed device, use the Report control on the memory or the Privacy & Safety page to ask for it to be removed."
    ] },
    { heading: "6. Who to contact", added: true, paragraphs: [
      "For privacy, personal-data or content-safety concerns, use the public Privacy & Safety page. It does not provide booking, maintenance or in-stay support; contact your host through your booking app for those."
    ] },
    { heading: "7. Governing law", added: true, paragraphs: [
      "These terms are governed by the laws of Victoria, Australia. Nothing in them limits rights you have under consumer or privacy law where you live."
    ] }
  ],
  reviewNotes: [
    "These Guest Terms are new: the handbook’s A.6 covers Hosts only, while the guestbook form has always linked to “Guest Terms”.",
    "Age threshold (16) and the minors workflow are open register item C-11.",
    "Whether a licence from the guest to the host and DigiStayBook is needed for display, beyond consent, is for counsel.",
    `Review the overseas photo-screening disclosure together with Privacy Policy section 4.1 and consent version ${legalVersions.consent}; the checkbox mentions automated safety checks, while these documents explain overseas processing. This acknowledgement does not waive privacy rights.`
  ]
};

export const privacyPolicy: LegalDocument = {
  title: "Privacy Policy",
  version: legalVersions.privacy,
  lastUpdated: "6 October 2026",
  intro: [],
  sections: [
    { heading: "1. Information collected", paragraphs: [
      "From Hosts: account information (email address, password, property names); billing information collected by Stripe, which DigiStayBook does not view or store in full; property configuration data such as welcome messages, house rules and display preferences; and marketing preference data — the host identity, normalised contact address, consent or withdrawal status, UTC timestamp, form or source identifier, and the exact consent wording and version. A minimal central suppression record is kept separately to prevent promotional messages after opt-out.",
      "From Guests: user-generated content voluntarily uploaded to a Guest Wall, including messages, photos and an optional guest name displayed with the memory; and limited technical and security data — IP address, browser type, device category, access time, anonymous session tokens and Firebase App Check signals. Where needed to prevent abuse, short-lived pseudonymous abuse keys may be derived without creating a persistent cross-session identifier. This information is used to route uploads, secure the Service, enforce rate limits, investigate reports and apply proportionate restrictions. It is access-controlled and retained only for the bounded period in the approved retention schedule."
    ] },
    { heading: "1.1 Private feedback and automated screening", added: true, paragraphs: [
      "Guests may also send a Host private feedback. It is shown only to that Host and is never published.",
      "Guest names, messages, photos and private feedback are checked automatically using Google Cloud’s content moderation services before they are published or delivered. Private feedback that appears to contain threats, sexual content or hate may be held and read by DigiStayBook’s restricted safety team, who release it to the Host or delete it. A Host may also send a feedback message to the safety team for review. Each time the safety team opens a held message, that access is recorded; the record does not contain the message."
    ] },
    { heading: "2. How information is used", paragraphs: [
      "To provide the Service: hosting the guestbook, generating QR codes, and enabling Host moderation.",
      "To process payments, subscriptions, trials and renewals through the payment gateway.",
      "To communicate with Hosts: account notices, billing receipts, moderation alerts, cancellation confirmations and dashboard access links.",
      "To manage marketing choices: proving express consent, applying withdrawals across all promotional sequences, preventing sends to suppressed addresses and recording verified re-consent. Account creation and acceptance of the Terms are never treated as marketing consent.",
      "To improve the Service through analysis of usage and technical data.",
      "Guest photos and messages are not used for DigiStayBook’s own marketing without explicit permission, and Host and Guest data are not sold to third parties."
    ] },
    { heading: "3. Privacy roles by data class", paragraphs: [
      "Guest Wall content and property configuration: the Host generally determines why Guest photos, messages and property content are collected and displayed, and acts as controller. DigiStayBook generally processes this content on the Host’s behalf to host, screen, route, publish, restrict and delete it under the Service instructions.",
      "Host accounts and communications: DigiStayBook is controller for registration, account security, service communications and the support records needed to operate the platform relationship.",
      "Billing metadata and transaction records: DigiStayBook is controller for customer, subscription, invoice-reference and accounting information needed for billing, disputes and legal obligations. Payment providers process payment data under their own terms and roles.",
      "Security and abuse-prevention records: DigiStayBook is controller for App Check signals, limited security logs, short-lived pseudonymous abuse keys, rate-limit events and account or session restrictions.",
      "Platform reports and internal trust-and-safety cases: DigiStayBook is controller for reports escalated directly to the platform and for restricted critical cases it must assess for platform safety, legal compliance or user protection.",
      "Service providers: cloud, email, moderation and other vendors process data under the contractual role applicable to their service."
    ] },
    { heading: "3.1 How a Guest exercises deletion rights", paragraphs: [
      "Active session: use the self-service delete control directly on the device that made the post.",
      "Lost session: use the Report control on the post and select “Privacy — I want my content removed”. An accepted ordinary request hides the post immediately and routes it to the Host. If the reporter or wall circuit breaker is active, the request is recorded without changing visibility and is routed to Privacy & Safety Operations.",
      "Public route: submit a request through the public Privacy & Safety page if self-service is unavailable, the session is lost, the post cannot be located, or a previous request was not handled.",
      "Escalation: if the Host does not act within 14 days, the request escalates to Privacy & Safety Operations, which applies the approved deletion or restriction workflow. DigiStayBook may also act directly where required by law or where it is independently responsible for the data class."
    ] },
    { heading: "4. How information is shared", paragraphs: ["Information is shared only with service providers performing services on DigiStayBook’s behalf (cloud hosting, payment processing, email delivery, content moderation); where required by law, court order or governmental request, or to protect the rights, property or safety of DigiStayBook, its users or others; and in the event of a merger, acquisition or sale of assets, where Host data and Guest content may transfer as a business asset."] },
    { heading: "4.1 Photo storage and overseas safety checks", added: true, paragraphs: [
      "Guest photos are stored in Sydney, Australia, in private Google Cloud Storage buckets. Photos undergo automated safety checks using Google Cloud Vision SafeSearch, configured to use its European Union service endpoint. The photo is sent overseas for that check; Sydney storage does not mean all processing stays in Australia.",
      "We use immediate-response photo checks. Google states that these checks process the image in memory without persisting it to disk, and that submitted content is not used to train or improve Cloud Vision models. Google temporarily logs some request metadata, such as the request time and size.",
      "Google processes service data under its Cloud Data Processing Addendum, including security, confidentiality and incident-notification commitments. Google and its contracted service providers may handle information in other countries under those terms. Our choice of the EU endpoint is not a guarantee that every aspect of Google's handling remains in the EU. Text screening is configured to use Google Cloud Natural Language’s Australia endpoint."
    ] },
    { heading: "5. Data retention and deletion", paragraphs: ["Personal information is kept only as long as the approved retention schedule allows, then destroyed or de-identified, including controlled copies in archives and backups. Business records are kept for the period Australian tax law requires, and marketing consent records and unsubscribe requests are handled within the periods ACMA requires."] },
    { heading: "6. Cookies and tracking", paragraphs: ["Essential cookies maintain Host login sessions and platform security. No invasive tracking cookies are used for targeted third-party advertising."] },
    { heading: "7. Data security", paragraphs: ["Administrative, technical and physical measures protect personal information. No electronic transmission or storage technology can be guaranteed completely secure."] },
    { heading: "8. Children’s privacy", paragraphs: ["The Service is a business-to-business platform and is not directed at children under 16. Personal information is not knowingly collected directly from children, and Guests must confirm they are 16 or older before posting a memory. Hosts remain responsible for moderating photographs containing minors uploaded to their Guest Wall."] },
    { heading: "9. Contact", paragraphs: ["Hosts may use the Host Contact form for account and software support. Any Guest, Host or other individual may use the public Privacy & Safety page for a personal-data request, privacy concern or content-safety issue. That route does not provide booking, maintenance or in-stay support. Requests that cannot be resolved through self-service or the Host workflow escalate to Privacy & Safety Operations."] }
  ],
  reviewNotes: [
    "Section 1.1 is new: private feedback, Google Cloud screening and safety-team access postdate the 4 August draft.",
    "Section 8 now says “16 or older before posting a memory” to match the consent sentence; the draft said “over 16 before uploading content”.",
    "Section 5 summarises the draft’s pointer to the handbook’s retention schedule (5.10), which is internal; the published policy needs the schedule itself or a public summary of it.",
    "Section 4.1 records the 2 October owner decision: Sydney photo storage and overseas screening through Google Vision’s EU endpoint. Review the actual account agreement, overseas-disclosure safeguards and country disclosures: Google's contractual Vision data-residency list currently covers OCR only, not SafeSearch. Do not turn the endpoint choice into an EU-only guarantee.",
    "Confirm Google Cloud’s processor/subprocessor role for each data class, applicable account terms, provider notices and the final overseas-country disclosure. The email provider remains open (C-14)."
  ]
};
