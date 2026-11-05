# Product QA — 5 November 2026

This is a local adversarial test run, not production sign-off. The existing HTML checklist contains 259 steps across 50 procedures. Its historical AI results and human entries remain intact. This report supplements that checklist with executable failure, recovery, concurrency and permission tests; it does not mark all 259 steps passed.

## Results

| Evidence | Result | Scope |
| --- | --- | --- |
| TypeScript, unit/component tests and application/functions builds | 872 passed, 1 skipped | `npm run check`; skipped test is not a pass |
| Firestore and Storage rules | 35 passed | Real local emulators, including denied access |
| Adversarial API suite | 51 passed | Concurrency, replay, ownership, invalid input, privacy and upload validation |
| Host/guest browser journeys | 21 passed; no uncaught errors | Chromium, synthetic accounts and real emulator persistence |
| Browser account recovery | 3 passed | Partial signup failure, verification and reset through the emulator outbox |
| Public build browser suite | 66/66 passed per engine; no uncaught errors | Chromium and WebKit; final JSON records failures and uncaught errors separately |
| Server lifecycle suites | Passed | Public wall, contributions, deletion, reporting, incomplete screening, budget, notifications and consent retention |

The [machine-readable evidence](../artifacts/qa/2026-11-05/) includes individual assertions, browser errors and accessibility findings. Final production-build results are in the `production-build-chromium` and `production-build-webkit` directories. Top-level public-browser results, failure screenshots and smoke results are earlier investigation evidence, not the final release verdict. Logs copied into `logs` retain the underlying verification output.

## Defects fixed

1. A failed optional Auth display-name update made a successfully created account appear to fail signup. Account creation now completes and retains the supplied profile name.
2. Property placard handoff could retain private guest-link/Wi-Fi data across accounts. Handoffs are bound to the owner, cleared at sign-out, and withheld while authentication resolves. Failed browser storage no longer silently opens a stale design.
3. QR printing could proceed without a valid stay token. Printing/sharing waits for a valid link and offers a visible retry after failure.
4. Clipboard feedback could disappear on the first click or apply to a different address after an asynchronous copy. Feedback is now tied to its address.
5. Property API identifiers accepted path separators; duplicate note IDs could alias photo slots; the reserved demo slug could hide a real property. These inputs are rejected before persistence.
6. An unreadable photo could be uploaded as original bytes and replace a working photo. Decoding failures now produce an actionable error and retain the existing content.
7. Local verification/reset links used the obsolete development port. They now use the configured loopback application origin and reject external origins.
8. Small form feedback text failed minimum contrast. Its text colour now meets the tested contrast requirement.

Regression tests accompany these fixes. The implementation-status ledger now references the current sign component. Consent-retention tests compare their own audit changes and start pagination at their own fixture block, so unrelated synthetic activity does not create false failures.

## Coverage beyond the old checklist

- Concurrent property creation, legacy token minting, contribution creation and completion; replayed and changed idempotency requests.
- Lost submission response after the server committed: retry publishes once, without duplicating the memory.
- Denied cross-owner, anonymous, host and operations access; private arrival guidance excluded from public projections and ZIP exports.
- Invalid consent/version, text/name boundaries, malformed image payloads, duplicate image bytes, image metadata stripping and corrupt client images.
- In-flight image upload while editing welcome text, persistence after reload, invalid booking URLs and retryable failures.
- Critical/incomplete screening and provider exceptions, budget limits, review holds and audited MFA claims at the server boundary.
- Deletion retries, partial/missing objects, leases, exhaustion, settling, retention holds and pagination.
- Browser widths 320, 390, 768, 1024 and 1440 in the journey suite; 320, 390 and 1440 on public pages; automated light/dark accessibility checks.
- All 18 placard styles: rendered guest-link and escaped Wi-Fi QR codes decoded by a QR reader library. This is not evidence of printed-paper scan reliability.

## Reproduce safely

Use a stable checkout, synthetic accounts and the `demo-digistaybook` emulator project. Do not run rule tests against a working shared fixture database: those tests clear emulator data. Run rules first, then seed local journeys. Never substitute production credentials or URLs.

```powershell
npm ci
npm --prefix functions ci
npx playwright install chromium webkit
npm run check
npm run status:check
npm run test:emulators
npm run test:local
```

In a second PowerShell terminal, set the explicit emulator guards:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199'
$env:QA_EVIDENCE_DIR = 'artifacts/qa/new-run'
npm run test:adversarial
npm run test:browser
npm run test:browser:auth
npm run test:browser:public
```

The adversarial and guest browser suites expect the local launcher's deterministic screening mode. The historical public-wall/contribution server scripts instead expect unavailable-provider holds; run those in a separate emulator session with deterministic screening disabled. Server scripts declare their own environment guards; inspect them before running. Use `--hookTimeout=60000 --testTimeout=15000` for rules on a cold Windows JVM if necessary.

For production-build public checks, serve `dist` with Firebase Hosting's actual rewrites and headers. Use `QA_BASE_URL=http://127.0.0.1:5182` and `QA_BROWSER=chromium` or `webkit`. `QA_BROWSER_EXECUTABLE` optionally selects an installed browser binary. QR screenshots wait for font/layout and scrolling to settle before decoding; capturing the moving preview produced false failures in two styles. A generic Vite preview fallback serves the landing page to application routes and produces misleading React hydration errors; that preview is not faithful to the deployed routing configuration.

## Outstanding release evidence

These require a separate real-provider/device run and are not cleared by this report:

- Real Stripe checkout, settlement, webhook delivery/replay and cancellation behaviour in the intended provider environment.
- Real inbox delivery, spam placement and link handling outside the emulator; real Google sign-in and MFA enrolment/recovery.
- Production App Check, deployed security configuration, scheduled workers and operational alert delivery.
- Real image/text screening quality and classification, including false positives/negatives; local decisions are injected or deliberately unavailable.
- Physical iPhone/Android camera and photo-library permissions, backgrounding/network transitions, screen readers and printed QR scans.
- Sustained load, production-scale storage/cost behaviour and disaster recovery from real backups.

The initial unit coverage run reported 68.85% statements, 65.13% branches, 72.99% functions and 73.17% lines. Emulator suites are not included in those instrumentation figures. Passing these tests is substantial evidence, not proof that every defect has been found.

The tested fixes were preserved in `master` commit `aabf2ae` during an external workspace branch change. Completion work is isolated on `codex/qa-completion`; no production deployment was performed by this QA run.
