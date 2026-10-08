# DigiStayBook — differences from the skeleton

**Main alignment record · Updated 8 September 2026**

## Easy-to-understand summary

**The skeleton means the original [Business & Operating Plan](handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html).** This document compares what that skeleton asks for with what the app currently does differently. The original HTML has not been changed.

The main differences or choices to settle are how photos are stored and resized, upload limits, consent wording, interrupted uploads, publishing existing house information, report-abuse handling and the limits of the ZIP export. Each entry below states the expected behaviour, the current behaviour and what must be agreed or corrected.

**ZIP with messages and photos is an approved format choice. Other restrictions are not approved changes just because they have been implemented.** Completed features, progress, unfinished work and launch checks are in the [implementation summary and plan](IMPLEMENTATION_SUMMARY.md).

## How to read this list

- **Difference:** implemented behaviour or architecture differs from the plan's stated presentation or wording.
- **Decision needed:** the plan leaves a choice open; development has used a provisional value. This is not an agreed product limit.
- **Incomplete:** a required outcome is only partly implemented or was not delivered/verified in this work. This does not mean it was deliberately removed from scope.
- **Unverified:** local code/tests exist, but the production, device or operating evidence is missing.

This consolidates this task's recorded findings and deliveries, not a fresh audit of unrelated concurrent work. Broader items carried forward from the launch review must be reconciled with any later work before being closed. Nothing below treats old implementation notes in the handbook as current proof.

## Comparison with the skeleton

| ID | Type | What the plan says | Current implementation | What needs to happen |
|---|---|---|---|---|
| D-02 | Decision needed | §5.3 and C-10 allow ten images but leave file limits/downscaling open. | JPEG/PNG/WebP only; 5 MiB per image, 25 MiB total, 40 megapixels maximum; no animation; converted to WebP within 2000×2000. HEIC is not accepted. Progress is per completed file. | Approve or revise limits, formats and progress expectations using physical-phone and cost evidence. Reference: GC-02. |
| D-03 | Difference / decision needed | §5.4 describes approved assets moving to public storage; §5.10 refers to public guest content and original media. | Transformed images move to a **private** delivery bucket and are publicly served through an endpoint that checks visibility. Original uploads are not retained by this flow. | Record whether controlled public delivery satisfies “public storage”; explicitly settle transformed-versus-original retention. Do not imply approval from the tests. References: GC-02/GC-04. |
| D-04 | Decision needed | §5.3 provides draft consent wording, with review gates in §6.6 and A.4. | Draft `handbook-5.3-draft-v3` names the message/photos and overseas checks; Guest Terms and Privacy are `draft-2026-10-02`. The owner approved Sydney storage and overseas screening through Google's EU endpoint. This endpoint choice is not an exclusive-region handling promise. | C-19 review covers age/minors, exact wording, actual Google account terms and overseas safeguards; version approved copy in client/server together. Reference: GC-03 and the [provider review](image-screening-provider-review-2026-10-02.md). |
| D-06 | Decision / incomplete protection | §§5.4 and 5.11 require proportionate abuse protection; C-24 covers anonymous-account cleanup. | Intake permits ten new attempts per anonymous UID per hour. Creating new identities can bypass that limit. | Complete abuse controls, expiry and monitoring; approve any user-facing usage policy. Reference: GC-06. |
| D-07 | Difference needing review | §§5.3–5.4 and 6.3 describe the contribution/pending experience. | Provider-unavailable pending copy differs from ordinary host-review copy. Closing the browser loses unfinished file selections, although submitted memories survive reload. | Confirm the pending wording and expected recovery behaviour; improve interrupted-upload recovery and verify poor-connection use. Reference: GC-08. |
| D-08 | Difference needing review | §§5.2 and 6.3 describe house information on the shared guest wall. | Previously private-labelled house information appears only after the host opts in to sharing it. | Confirm this transition for existing properties and make editor wording consistent. A shared link is not private access. |
| D-09 | Difference needing correction or approval | §5.4 describes abuse controls using related reporter signals. | The temporary reporting limit groups reports by the whole wall and time window. | Implement the specified relationship between reports, or explicitly approve a revised rule. |
| D-10 | Approved format / incomplete coverage | §5.5 flags the need for hosts to take content away; §5.10 describes deletion. The skeleton leaves the export format open. | The user chose ZIP with messages and photos. Current ZIPs are split into small parts and omit older external photos and non-visible memories. | Keep the approved ZIP format; settle coverage and improve large-wall downloads. The format decision does not approve missing photos. See the export limits below. |

## Differences resolved in local code

These are retained for traceability and are **not current differences from the skeleton**. Hosted and device checks remain in the implementation plan.

- **D-01 — pending confirmation:** the required dialog has been implemented locally.
- **D-05 — older memories and queues:** Load more paging has been implemented locally and checked with emulator data beyond the first page.

## Work that is not finished yet

The [implementation plan and remaining work](IMPLEMENTATION_SUMMARY.md#still-to-do) shows the remaining implementation and launch checks in one table. An unfinished feature is not automatically a decision to change the skeleton. If its eventual behaviour differs, record that difference here. Earlier tracking IDs are retained only in the [detailed reference](reference-implementation-detail-2026-09-08.md).

## Choices that preserve the plan's intent

These are recorded for clarity; they are not new product exceptions:

- Guests use property-specific anonymous sessions without being asked for a name/email. A host's registered account stays signed in separately. No cross-device guest identity has been introduced.
- Safety classifications can be injected only by trusted local test code. Customers cannot choose a fake screening result.
- Deletion jobs preserve evidence and hold restricted content for authorised review. A held job is not permission for indefinite retention; GC-05 stays open.
- The handbook's Guest Wall is reachable by QR **or shared link**. A second secret arrival-only page is not assumed to be a launch requirement. Hosts must understand what information is public.

## Scope and closure rules

The plan's §7.1/A.8 explicitly defers the affiliate engine, tablet display, direct-booking retention links, translation and contextual location prompts. Their absence is not counted as a new deviation here. Export and private feedback are not in that deferred list.

To close an item, record the implementation or approved decision, its evidence and date. If implementation intentionally changes a requirement, update the relevant handbook section and A.4 decision entry as part of an explicit agreed change. Do not change the plan merely to make an unfinished implementation appear compliant.

The guest-contribution IDs GC-01–GC-09 are preserved from the [original register](guest-contribution-issues.md). D identifiers identify differences/choices; the detailed supporting reference retains GC and L identifiers for traceability. They are local document references, not newly created GitHub issues.

Supporting detail: [original launch review](launch-readiness-review-2026-09-07.md), [first fixes](launch-fixes-2026-09-07.md), [guest delivery](guest-contribution-delivery-2026-09-08.md), [deletion delivery](storage-deletion-delivery-2026-09-08.md). Current delivered status is consolidated in [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md); earlier reports retain their historical wording.

## Export implementation limits — 8 September

ZIP format is approved; the following restrictions remain **L-02 gaps**, not changes to the handbook. The browser downloads separate parts covering up to three scanned records each (some parts may contain no eligible memories). Only visible unrestricted content is exported; standard held memories, private feedback, cover/property photos and legacy external photos need an explicit coverage decision and safe implementation. Deleted content, restricted evidence and guest contact/consent records must not enter ordinary host archives. Each photo is checked again before delivery, but a downloaded archive is a point-in-time copy, not a revocable copy. Large-wall convenience, cancellation/retry in a real browser, cross-device downloads and complete media coverage remain to verify. No archive is persisted on the server by this implementation.
