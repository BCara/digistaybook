# DigiStayBook — implementation progress

**Scoped update 2 October 2026.** The tables retain the earlier implementation record; current image-provider and privacy decisions are recorded in [the provider review](image-screening-provider-review-2026-10-02.md). Implemented means built and checked locally unless deployment evidence is stated separately. The app is not ready for public launch yet. Separate workstreams need checking before their work is counted here.

## Implemented

| Feature | What has been implemented |
|---|---|
| Real guestbooks | Real property links load the correct guestbook and its memories. Missing, disabled or expired guestbooks show an appropriate message. |
| Guest messages and photos | Guests can submit a message and up to ten supported photos, preview/remove photos and retry a failed submission. |
| Guests managing their memories | Guests can return in the same browser session to view, edit or delete their own submitted memories. |
| Keeping hosts signed in | Using guest actions keeps a signed-in host’s account intact. Guest sessions are kept separate. |
| Loading older content | Load more controls are available for public memories, guests’ own history, host review, private feedback and moderation. |
| Host review | Hosts can review ordinary flagged memories and manage permitted content. Unchecked or restricted content cannot be manually published. |
| Private feedback | A separate host inbox displays permitted private feedback without putting it on the public wall. |
| Reporting content | Guests can report memories. Ordinary reports can hide content for review; hosts can dismiss reports or delete content using guarded actions. |
| Privacy requests | A form stores private requests and creates an internal alert when a request becomes overdue. |
| Safety overview | An administrator overview shows operational queues and requires a second sign-in factor. |
| Screening preparation | Submissions can wait privately for checking. Failed checks retry, and an open safety case prevents automatic republication. |
| Photo processing and protection | Uploaded photos are checked, resized and stripped of metadata. New guest photos use private storage with controlled access. |
| Deleting queued photos | A worker deletes queued photo files, checks removal, retries failures and protects safety-held content. |
| Property setup and appearance | Unique property addresses are reserved. Appearance saving, cover/theme rendering, writing prompts and optional shared house information are supported. |
| Submission confirmation | Guests receive a pending confirmation dialog after submitting a memory. |
| Exporting the guestbook | Hosts can download ZIP parts containing visible memories, supported guest photos and a readable offline copy. |
| Subscription access checks | Public access ends when a cancelled property’s permitted service period expires. |
| Local verification | The latest recorded run passed 335 app/unit tests and both builds. Isolated server checks covered exports, reporting and important safety controls. |

## Still to do

Some rows below finish an existing feature; others require a connection, decision or real-world test. Related rows can share work—for example, email setup supports reports, alerts and customer messages.

| Feature | What still needs to be implemented or checked | What is needed to proceed |
|---|---|---|
| Real content screening | Google Vision's EU synchronous request adapter is prepared; photo storage remains in Sydney. The combined wall-memory adapter stays disconnected until category mappings and cost controls are settled. Private feedback has a separate Australia text adapter. | Calibrate C-13 using labelled examples, set numeric cost controls, complete C-19 review and prove runtime and guest submission paths. Provider/location choice is recorded in the 2 October review. |
| Final policies | Replace draft Terms, Privacy and consent wording with reviewed versions, including age/minor and text-only wording. | Business details and policy review; then connect the approved wording. |
| Hosted security and sign-in | Configure and test actual preview storage permissions, permitted website addresses, request protection and signed-in account preservation. | Account access for the authorised isolated preview. |
| Full deletion schedules | Add expiry rules for abandoned uploads, old drafts, dormant properties and guest records. Handle older/backup copies, safety-hold release and delivered failure alerts. | Further implementation, cloud checks and any unresolved retention/operating decisions. |
| Protection against misuse | Strengthen controls against repeated spam and attempts to bypass limits using new guest sessions. Verify older queues on the hosted app. | Further implementation and testing; agreement on any new customer-facing limits. |
| Complete privacy/report handling | Add lost-session identity checks, responses to requesters, full internal case resolution and the remaining report-abuse rules. | Further implementation, email setup and a responsible operator. |
| Complete safety operations | Finish case-handling actions, administrator setup, delivered alerts and the daily review process. | Further implementation, email setup and someone responsible for review. |
| Final guest experience | Finish planned layouts, pinned-post ordering and the ten-post practice setup. Check interrupted uploads, accessibility and phones. | Further implementation and browser/device testing. |
| Billing and activation | Review separate billing work, then complete or verify purchases, trials/discounts, renewals, failed payments, cancellation, reactivation and refunds. | Current-code review, payment-account access and settled commercial settings. |
| Permanent links and QR codes | Check the existing QR tools and finish the final-domain print/scan journey on another device. | Permanent domain and preview/device testing. |
| Complete exports | Address older external photos and agreed content coverage, improve large downloads and verify actual browser download/cancel/retry behaviour. | Further implementation and testing. ZIP format is already agreed. |
| Older photos and records | Inspect older flows for direct photo links, storage references and expiry/access information; migrate confirmed affected data. | Authorised environment access and an audit before deciding which changes are needed. |
| Email and customer support | Connect sending, finish templates, verify real inbox delivery, handle failed delivery/unsubscribes and establish support/refund handling. | Provider, sender/support address and responsible operator; then implementation and tests. |
| Host setup and usability | Review the latest host journey, reconcile earlier findings, and fix confirmed confusing steps, missing help and loss of unsaved work. | Current-app review and focused fixes. |
| Launch verification | Deploy to isolated preview; test complete journeys, devices, real services, accessibility, performance, monitoring, recovery and rollback. | Preview access, completed dependencies and a final launch decision. |
| Keeping progress accurate | Reconcile separate workstreams and update these tables as work is implemented, verified and deployed. | Ongoing review; no additional product feature is implied. |

The [Business & Operating Plan](handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html) is the skeleton; its decision register and privacy draft now include the approved overseas image-screening arrangement. [Differences from the skeleton](PLAN_DEVIATIONS_AND_GAPS.md) records behaviour that differs from it. [Detailed history, decisions and test links](reference-implementation-detail-2026-09-08.md) are retained only as a supporting reference.
