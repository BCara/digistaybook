# Image screening decision and provider review

Recorded 2 October 2026. Applies to handbook C-12 and the existing C-19 privacy review.

## Approved arrangement

The owner approved overseas image screening while retaining guest-photo storage in Sydney. Engineering selects Google Cloud Vision SafeSearch's **EU endpoint** for a defined request route. This choice is not an Australia-only or EU-only handling promise. Private quarantine and delivery buckets remain in `australia-southeast1`.

The synchronous request adapter is `functions/src/visionScreening.ts`. It sends one already transformed, metadata-stripped image as bytes to `https://eu-vision.googleapis.com/v1/projects/{project}/locations/eu/images:annotate`, requesting only `SAFE_SEARCH_DETECTION`. It sends no guest session ID, property name, caption, storage URL or original filename. Redirects are refused, requests have a timeout, and errors cannot cause a global/US fallback. Provider errors and incomplete/unknown annotations fail the call. `functions/src/screening.ts` now connects this image transport to the wall-memory flow and checks wall text through the Australia Natural Language endpoint. LIKELY/VERY_LIKELY image categories and provider text categories at the provisional 0.8 threshold become `standard` host review; nothing is auto-rejected.

## Published terms checked

- **Purpose and security:** Google's [Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum) describes Google as processor, limits processing to service instructions, and provides encryption, confidentiality, restricted access and incident-notification commitments. It also sets obligations for contracted subprocessors. These are published terms; this review does not establish the agreement/version accepted by this particular account.
- **Image handling:** Google's [Vision data-use FAQ](https://docs.cloud.google.com/vision/docs/data-usage) says synchronous checks process images in memory without disk persistence, do not train Vision models on submitted content, and temporarily log request metadata. Asynchronous methods have temporary image retention and are excluded from this setup. This does not change our own Sydney storage/retention obligations.
- **Endpoint support:** Google's [Vision release notes](https://docs.cloud.google.com/vision/docs/release-notes) document US/EU support for SafeSearch and require directly calling the regional hostname rather than forwarding a location through the global endpoint.
- **Location caveat:** The [contractual data-residency list](https://cloud.google.com/terms/data-residency) currently limits the Vision entry to OCR. Therefore the [AI/ML location commitment](https://cloud.google.com/terms/service-terms) must not be presented as a contractual SafeSearch EU-only guarantee. The addendum permits processing in other countries subject to applicable location commitments. Privacy drafts name the selected EU endpoint, allow overseas handling under Google's terms, and avoid an exclusive-region promise.

## Privacy review handoff

Guest Terms and Privacy Policy become `draft-2026-10-02`; the acknowledgement becomes `handbook-5.3-draft-v3`. The acknowledgement explains overseas checks without waiving privacy rights. Legal approval remains null and production intake remains disabled.

The existing C-19 reviewer should check the actual account agreement, Google/subprocessor roles, overseas safeguards and country disclosures, incident contacts, and the revised guest texts. The EU endpoint choice alone does not establish legal compliance. See Google's [subprocessor register](https://cloud.google.com/terms/subprocessors).

## Verification

- Production bucket metadata checked on 2 October: both named guest buckets are in `AUSTRALIA-SOUTHEAST1`, with uniform bucket access and public-access prevention enforced. Seven-day soft deletion remains in place; its retention-policy review is GC-05.
- Vision and Natural Language APIs were observed enabled in `digistaybook-cbert`.
- A direct project-authenticated request to the selected EU endpoint succeeded with a generated 32×32 solid-colour WebP fixture: adult/spoof/racy were `VERY_UNLIKELY`; medical/violence were `UNLIKELY`. No guest photo was used. This proves endpoint reachability for the testing account, not runtime service-account access or classification quality on representative guest content.
- Functions build and 19 focused provider, screening, legal-gate and legal-page tests passed. Tests verify EU-only request routing, no cross-region retry, incomplete-result handling and the closed publication gate.
- App typecheck and production build passed. The deployed `beginGuestContribution` configuration still has `GUEST_CONTRIBUTIONS_ENABLED=false` and names the two Sydney guest buckets. This change has not deployed the new adapter or revised drafts.
- The adapter is deployed in the guest-contribution function revisions (`finishGuestContribution-00013-kos`, `changeGuestContribution-00012-noc`, `retryPendingScreening-00012-wip`, and the related upload/begin/photo revisions), but `GUEST_CONTRIBUTIONS_ENABLED=false` keeps the public path closed while C-13 calibration, numeric cost controls and C-19 approval remain open. No end-to-end guest submission or runtime service-account screening is proved by these checks.
