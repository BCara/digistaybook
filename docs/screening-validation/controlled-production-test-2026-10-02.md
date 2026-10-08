# Controlled production guest test

The owner explicitly requested enabling production submissions to test the
complete guest journey, and selected **My Property Name** on 2 October 2026.
This supersedes the earlier blanket-disabled testing instruction for this
named property only; it is not counsel approval or a general public launch.

Property: `chpLFZnSbGBPpoPRNBlb`, slug `sdsdds-nqvd`.
Test configuration: `GUEST_TEST_PROPERTY_IDS` names that property and
`GUEST_TEST_UNTIL=2026-10-09T13:00:00Z` ends the exception at midnight Sydney time
after 9 October. The global `GUEST_CONTRIBUTIONS_ENABLED` switch stays false and
`legalApproval` stays null. Use the actual in-stay QR/guest link with its token.
The token is not copied into documentation or logs.

New test submissions record `intakeMode=owner_authorised_test`; the draft consent
and exact legal versions remain in the consent evidence. Normal guest Auth,
App Check, property lifecycle, stay-token, image and daily-screening limits apply.
Existing saved submissions may finish/retry after the creation window expires.

Structured Cloud Logging events record provider category/confidence results,
photo likelihoods, durations, provisional thresholds, local contact/link holds,
final memory status and sanitised failure outcomes. Each revision has a hashed
24-character `screeningReference`, also recorded on the private submission.
No raw text, images, guest UID, filenames, storage paths, access tokens or raw
provider bodies are included. Same-revision retries share the reference and are
distinguished by timestamp/request trace. Results use the existing Cloud Logging
access and retention; they are not exposed to guests or ordinary hosts.

Text responses with missing/invalid moderation categories now fail rather than
silently clear a memory. Provider failures keep public memories pending/private;
private feedback's existing delivery-on-provider-error fallback is logged
explicitly. Exhausted daily capacity defers both memory and feedback screening.

The live `getPublicWall` response for the token-protected stay view was checked:
`status=open`, `contributionsEnabled=true`, name `My Property Name`. Deployment
configuration on `beginGuestContribution` was read back as ACTIVE with the named
property/expiry and the general switch false. Functions build and 128 focused
Functions tests passed. These checks do not prove actual guest submission,
Google classifications, runtime object access, email receipt or device behaviour.

Open [the HTML test guide](live-test-guide.html) for console links and queries.
The legal/privacy reviewer pack remains a dated snapshot from before this test
exception; supply this addendum to the reviewer with that pack.

To close testing early, clear `GUEST_TEST_PROPERTY_IDS` and `GUEST_TEST_UNTIL` and
redeploy `getPublicWall` and `beginGuestContribution`. No fake legal approval is
needed to start or end the controlled test.
