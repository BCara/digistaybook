# Phone editor release history — 30 October 2026

Latest revision: Plain setup labels, with one note explaining that only the property name is required to get started. Cover photo and Host photo have no repeated optional/recommended tag; checklist optional badges are removed. Source 0118585; Hosting bc0d326aca55d07e. 81 related tests, TypeScript and the full production build passed. Live and preview artifacts match the checked build. See plain-labels/review.md, deployment.json and screenshots.

Previous revision (6:15 pm Sydney): Add property asks only for a name, then opens the sections checklist. Red means not reviewed; Save turns a valid section green even with optional content blank, with review state persisted privately. Required validation, Cancel and failed writes do not turn it green. Source 9aa6c53; Hosting 3441c25c0722d022. Production and preview match the checked build byte for byte. 801 tests passed, 1 skipped; TypeScript and the full production build passed. Local emulator creation, blank-section save/reload, required-name and link validation, and 320/390/1200 px layouts checked. Existing properties without markers also need one review/save per section. See name-first-setup/review.md, deployment.json and screenshots.

Previous revision (6:00 pm Sydney): Welcome & hosts combines names, the welcome note and the optional host photo in one checklist row and one form with one Save. Source f490b49; Hosting 246af47f6056b45b. Production and preview are updated. TypeScript, 61 editor tests and the production build passed, including saving photo and welcome text together. Served artifacts match the tested build. Local browser checked the combined form. See welcome-grouped/deployment.json and welcome-grouped/welcome-and-hosts-390.jpg.

Previous revision (5:54 pm Sydney): Manage opens the restored sections checklist on phones. Rounded grouped rows show completed, incomplete, hidden and optional states. Your photo has its own form; cover photo remains in Property details; Your links remains available. Guest preview returns to its originating view. Source commit `a57a670`, Hosting version `a7e045df766154aa`. Both production and the existing preview were updated. TypeScript, all 61 editor tests and the full production build passed. Local Manage navigation, photo-dialog cancellation, guest-preview return and 320/390 px layouts were checked. All live app-shell, JavaScript and CSS hashes match the checked build. See `sections-first/deployment.json` and `sections-first/sections-list-390.jpg`.

## Earlier preview-led release

Deployed to production and the existing phone-editor preview on 30 October 2026 at 5:40 pm Sydney time.

Release: `e0d3d052f5a66383`; source commit `aa5916d5e1e3693c61624d1e6addb6a0d16b8020`. Hosting only. See deployment.json for exact hashes and release metadata.

- Guest wall opens with labelled Edit actions and a guest-preview button.
- Property details groups the name, address and cover photo in one form. Cover photo has no separate section or overlaid action on the main wall.
- Sections opens the corresponding focused form; each form saves once.
- Your links supports two editable labelled destinations, including Book direct and Join our mailing list presets. Uses the existing HTTPS validation, persistence and guest-wall renderer. Mailing-list subscriptions happen on the linked host page.
- Cancel leaves the saved wall unchanged. Failed writes retain the form values for retry.
- Cover and host photos are selected locally and uploaded on Save. Existing note-photo controls retain their separate, explicit Save photograph action.
- An open form survives resizing across the desktop breakpoint. Its Save footer follows the visual viewport height.

Verification:

- TypeScript passed.
- Main-checkout unit/component suite before release isolation: 820 passed, one skipped. Exact release copy: 804 passed, one skipped; pending unrelated tests were excluded with their source changes.
- Local Firebase Test: saved both example.com destinations on Test Cottage, reloaded, reopened the form, and confirmed stored HTTPS addresses.
- Browser sizes checked: 390 × 844, 430 × 932, 320 × 600, and 844 × 390. No horizontal overflow in the form; Save remains in the visible viewport. Rotating preserves entered text and Cancel discards it.
- Screenshots: your-links-430.jpg, property-details-with-cover.jpg (local phone checks), and live-guest-demo.jpg (production smoke check).
- Physical-device and software-keyboard testing remain unverified.

Release build: full `npm run build`, including static prerendering, passed in an isolated checkout of the confirmed live baseline plus the five scoped editor files. Both original live JavaScript and CSS were reproduced byte for byte before applying the patch. The pending ContactPage.tsx error and other unrelated working changes were excluded. An unrelated inbox link change found in the shared editor file was also excluded from the release copy while remaining intact in the main checkout.

Post-deployment: live and preview versions match. Production app.html, JavaScript and CSS SHA-256 hashes match the checked artifacts. Production sign-in and guest demo render; cover image decoded to 1500 pixels and no browser errors were recorded. An authenticated production editor session was not available, so signed-in interactions were verified locally, not claimed as live-device proof.

Local review: http://127.0.0.1:5181/host/property/test-cottage (the local test host session is already signed in in the review browser).
