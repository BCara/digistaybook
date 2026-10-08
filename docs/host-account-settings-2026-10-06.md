# Host account settings — 6 October 2026

## Production release — 8 October 2026

The Account page is now deployed at `/host/account`. Live HTML and asset bytes match the production build, which includes the Account route and the registered App Check key. See [deployment evidence](deployment-2026-10-08.json). Real account-change journeys, actual inbox delivery and reviewer MFA during an account change remain unverified. The notes below preserve the original local implementation record.

Implemented locally at `/host/account`, reached through **Account** beside
**Billing** in the signed-in header and mobile menu. Not deployed by this update.

- Hosts can save their account name; the header updates immediately. Settings
  use Firebase Authentication as the account identity source. Existing Firestore
  signup snapshots and Stripe billing details are not rewritten.
- Email/password accounts can request a verified sign-in email change, change
  their password, send a password reset email and verify their current email.
- Email and password changes confirm the current password and complete any
  Firebase authenticator challenge before the change proceeds. Cancelling the
  challenge discards the pending change. Password fields are cleared after the
  confirmation attempt; credentials are not written to browser storage or logs.
- The sign-in email changes only when the new address's verification link is
  completed. Refresh account details reloads the authenticated identity.
- Google-only accounts edit their DigiStayBook name here and manage their email
  and password through the linked Google account page.
- Signed-out and anonymous guest sessions cannot open the page. Account actions
  reject a missing, anonymous or replaced current host session.

The credential flow uses Firebase's [account management APIs](https://firebase.google.com/docs/auth/web/manage-users)
and [verified email change API](https://firebase.google.com/docs/reference/js/auth#verifybeforeupdateemail).

## Verification

- `npm run check`: typecheck, 662 passing tests (one skipped), production frontend
  build and Functions build passed. Existing bundle size/import warnings remain.
- Focused tests cover rejected passwords, MFA waiting/invalid codes/cancellation,
  replaced sessions, Google-only accounts and email verification messaging.
- Disposable Auth emulator account: saved name; denied wrong password; changed
  password and signed in again; requested email change while retaining the old
  email; applied the emulator verification code; signed in with the new email.
  The disposable account was removed. No production identities were changed.
- Browser: navigated through the Account header link, saved a test name and
  observed the header update, then restored the original name. Checked mobile
  and desktop layouts at 390 and 1024 pixels, including a long host name; no
  horizontal overflow. The production build passed again after the header fix.
- Preview: `tmp/host-account-preview.png`. Emulator-only preview server uses
  `http://127.0.0.1:5189/host/account`.

Production release, actual inbox delivery and a real reviewer account completing
MFA during an account change remain unverified. No Functions, security rules,
Stripe settings or unrelated pending source changes were deployed.
