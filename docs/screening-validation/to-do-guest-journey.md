# DigiStayBook — test complete guest journey and inspect Google screening

Prepared for Microsoft To Do. Not yet added: connector is unconfigured and the web account requires review of updated Microsoft terms.

## Setup and limits

- Property: **My Property Name**; ID `chpLFZnSbGBPpoPRNBlb`; wall slug `sdsdds-nqvd`.
- Controlled production intake enabled for this property. Live public-wall response verified open with contributions enabled. Normal authentication, App Check and stay-token checks apply.
- Exception expires at **00:00 on 10 October 2026, Sydney time** (after 9 October). Global intake remains disabled and legal approval remains pending; draft consent applies.
- Use the guest QR/link from the host dashboard in a private browser window. The plain public wall URL cannot add memories. Keep the guest access token out of notes and logs.
- **100 screening attempts per Sydney day across the app**, including submissions, edits, retries and private feedback. One memory with up to ten photos counts one attempt; failed provider calls also consume capacity.
- Email warning at **75 attempts / 25 remaining** to **codebertcreations@gmail.com**; repeated notifications suppressed for 24 hours.
- Monthly screening cost warnings at **A$1 and A$5**, to the same email.
- At daily capacity, memories remain private/pending and feedback is deferred. Capacity resets at midnight Sydney.
- Functions build and 128 tests passed; deployments succeeded. Actual guest journey and provider outcomes still require this live test.

## Checklist

- [ ] Open the property's guest QR/link privately and refresh.
- [ ] Submit benign text: “TEST 01 Lovely stay and a beautiful garden”; accept draft consent.
- [ ] Record test label, timestamp, expected outcome and actual wall result.
- [ ] Find the record in Firestore `guestSubmissions` using propertyId, createdAt and test text. Copy its `screeningReference`.
- [ ] Inspect Google text categories/confidence, provider decision and final stored status in Logs Explorer.
- [ ] Submit benign text with your own ordinary room/garden photo; inspect both providers and photoIndex.
- [ ] Test synthetic contact details (`guest@example.com`); distinguish local review hold from Google screening.
- [ ] Send an ordinary private complaint; confirm delivery to host and absence from the public wall.
- [ ] Approve/reject a held memory from the host review queue; verify the result.
- [ ] Edit a memory; verify its new revision/reference and rescreening.
- [ ] Delete the test memory; verify takedown.
- [ ] Check interrupted mobile upload and HEIC handling on available Android/iPhone devices.
- [ ] Verify warning email at 75 attempts and cap/reset if deliberately testing capacity; avoid extra calls solely to hit the limit without a planned test.
- [ ] Record mismatches and evidence; review test access before expiry and explicitly decide whether to close or extend it.

## Inspect results

Guide: C:\Users\clbbe\Documents\Projects\DigiStayBook\docs\screening-validation\live-test-guide.html

Logs: https://console.cloud.google.com/logs/query?project=digistaybook-cbert

Firestore: https://console.firebase.google.com/project/digistaybook-cbert/firestore

Use a Google account with project access. Warning-email delivery does not grant console access. Set the log time range to cover the test, then query:

```text
resource.type="cloud_run_revision"
jsonPayload.screeningReference="PASTE_REFERENCE_HERE"
```

Expand `jsonPayload`:

- `screening_text_result`: Google Natural Language category names, confidence 0–1, durationMs, endpointRegion `au`. Confidence is not measured accuracy.
- `screening_photo_result`: one event per scanned image, zero-based photoIndex; adult/spoof/medical/violence/racy likelihoods; endpointRegion `eu`.
- `screening_provider_decision`: clear/standard, textFlagged/imageFlagged, thresholds.
- `screening_memory_decision`: app policy outcome; contactDetailsOrLinkHold=true indicates a local contact/link hold.
- `screening_final_state`: actual stored finalStatus. state_changed_no_publication means that attempt committed no publication because the submission/property changed.
- `screening_feedback_decision`: deliver/critical; private feedback never appears publicly.
- `screening_error`: sanitised provider failure, timeout, invalid response, daily capacity exhaustion or broad provider/storage error and fallback.

Each edited revision has a new opaque 24-character screeningReference. Retries of one revision share the reference; use timestamps/request traces to distinguish attempts. Logs exclude raw messages, images, user IDs, storage paths, tokens and provider response bodies.

Firestore status `published` should match a visible wall post; `standard` means host review; `pending` remains private—inspect screeningBudgetWaiting and errors. feedbackStatus `delivered`/`held` means host inbox/restricted safety queue. intakeMode should be owner_authorised_test.

Current provisional holds: any text category confidence >=0.8; photo adult, medical, violence or racy LIKELY/VERY_LIKELY. Spoof is recorded but does not trigger a photo hold. Ordinary private-feedback provider errors currently deliver feedback without completed screening; this fallback is explicitly logged. Daily exhaustion defers feedback. These settings and draft legal wording still require review/calibration.

Legal/privacy reviewer pack: C:\Users\clbbe\Documents\Projects\DigiStayBook\docs\legal-review\reviewer-pack-2026-10-02\DigiStayBook-review-pack.html
