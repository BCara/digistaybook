# Name-first setup and saved section reviews

Deployed 30 October 2026, 6:15 pm Sydney. Commit 9aa6c5390a0e853262a966dbedbfa68525c84edd; Hosting version 3441c25c0722d022. Production and phone-editor preview serve the same version. Hosting only; no backend, rules or public projection changes.

Add property asks only for its required name. Continue creates a private draft and navigates directly to its sections, including desktop. Cover remains inside Property details; the host photo and welcome message remain together. Your links still supports booking and mailing-list destinations.

Every unreviewed section is red. Saving a valid section makes it green even if recommended content is empty. Review markers are stored in the owner's private profile, normalized to the six known section IDs, and excluded by the existing public projections. Cancel and failed saves leave a section unreviewed. Required name errors and unfinished links or essential rows still prevent saving. Existing properties without review markers also start red and need one review/save per section; their content is preserved.

Validation: 801 tests passed, 1 skipped, across 82 passing test files; TypeScript and the complete production build including prerendering passed. Regression coverage includes all six blank sections saved/reopened, cancellation, save failures, name-only creation, duplicate submission, stable retry reservation, desktop landing, private metadata filtering, and persisted dotted profile writes.

Local browser checks used the running Firebase emulators. Created the synthetic private property Checklist setup test, saved a completely empty Welcome & hosts form, and reloaded to confirm its green tick persisted. Clearing the required property name and leaving a new booking link without a URL both blocked saving. Cancel left those rows red. Checked 320, 390 and 1200 pixel layouts; no horizontal overflow; no browser errors recorded. Viewport restored and temporary tab closed.

The release used the isolated checkout of the previous confirmed live revision f490b49. Unrelated main-checkout billing, inbox, contact-page and photo-resizing changes were excluded. Scoped changes were also synced into the main local review checkout, preserving its other work. Inspected differences in the replaced creation wizard were superseded by the new name-only flow.

Live and preview app.html, main JavaScript and CSS SHA-256 hashes match the tested dist files. See deployment.json and the asset verification files. Authenticated production creation and physical-phone/software-keyboard testing were not performed; authenticated interactions were checked locally. Screenshots are local browser checks, not production-device proof.
