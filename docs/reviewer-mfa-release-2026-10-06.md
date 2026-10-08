# Safety Review MFA — 6 October 2026

Production project: `digistaybook-cbert`. Identity Platform and authenticator-app (TOTP) MFA are enabled. The reviewer setup, sign-in challenge and access gate are deployed to Firebase Hosting.

## Authorised reviewers

| Email | Reviewer permission | Personal authenticator |
| --- | --- | --- |
| clb.bertram@gmail.com | Assigned | Awaiting enrolment |
| caralbertram@gmail.com | Assigned | Awaiting enrolment |
| jjbdunleavy@gmail.com | Assigned | Awaiting enrolment |
| codebertcreations@gmail.com | Assigned | Awaiting enrolment |

No initial passwords were created. Each person must prove ownership through Google sign-in and connect their own authenticator. Reviewer permission alone does not allow Safety Review access: the server also requires a Firebase second-factor sign-in claim.

### Googlemail sign-in correction

The existing verified Google account for `clb.bertram@gmail.com` signs in as `clb.bertram@googlemail.com` (display name Cara Bertram). Firebase stores it under a different UID from the newly provisioned Gmail record. Reviewer permission has now been assigned to that existing verified Google identity, preserving its other claims. Google confirms the Gmail and Googlemail versions reach the same mailbox: https://support.google.com/mail/answer/10313?hl=en. The provisioning script now checks existing verified Googlemail identities for all four approved Gmail addresses; it does not create alias accounts or weaken the server MFA requirement. Refresh setup to fetch the new claim, or sign out and sign back in. Human UI retest is still pending.

## Each reviewer's setup

1. Open https://digistaybook-cbert.web.app/operations and select **Continue with Google**, choosing the exact email listed above. If a different account is selected, sign out and choose the correct account.
2. Follow **Set up authenticator** to https://digistaybook-cbert.web.app/operations/setup. Confirm the reviewer email shown. If email verification is requested, use **Send verification email**, open its link, then **I have verified my email**.
3. Select **Confirm Google sign-in and set up authenticator** and confirm the same Google account.
4. In Google Authenticator or Microsoft Authenticator, add an account and scan the QR code. If scanning is unavailable, enter the displayed setup key as a time-based account. Keep the QR code and key private.
5. Enter the current six-digit code and select **Confirm authenticator**. Cancelling does not enrol the factor.
6. Select **Sign out and sign in with MFA**. Sign in with Google again. Wait for a new authenticator code if the code just used during enrolment has not changed, then enter it at the challenge.
7. Verify Safety Review opens. Record the outcome and Mobile/Desktop coverage against `TP-LIVE-08` in the NAS testing document. Do not record keys, codes or credentials.

An incorrect or expired code should keep the reviewer at the challenge. Cancelling must leave the reviewer signed out. Ordinary host accounts and reviewer accounts signed in without MFA must not see the review queue.

## Verification and remaining checks

- `npm run check`: 643 tests passed, one skipped; application typecheck, production build and Functions build passed.
- The Hosting release was built from the previous live frontend with only the MFA changes overlaid. Live HTML matches that release; main asset is `index-B61fgl1M.js`.
- Live desktop browser: signed-out `/operations` redirects to sign-in with an operations return destination and displays no review content.
- A disposable, verified synthetic account with no reviewer permission passed live Firebase TOTP enrolment, mandatory second-factor challenge, invalid-code rejection, valid-code sign-in, second-factor token claim and sign-out. The account was deleted and its absence verified.
- Earlier automated attempts failed because the test immediately reused the enrolment code during sign-in. The helper was corrected to wait for a new interval; the live retest passed. This was a test-sequence fault, not evidence that the UI enrolment failed.
- Real reviewer Google linking, individual email verification/enrolment, mobile journeys and live review actions remain to be performed. The complete `TP-LIVE-08` procedure is not yet passed.

No Functions, security rules or Stripe settings were deployed in this release. Incomplete-screening routing changes from the earlier work remain a separate backend deployment and verification task.

## Lost authenticator

The reviewer contacts the project administrator, who verifies their identity before resetting the factor using the privileged Firebase/Identity Platform account-management tools. Remove only that reviewer's lost factor, revoke their refresh tokens and have them repeat setup. Do not grant password-only operations access. Verify recovery and existing-session behaviour on a disposable account before recording `TP-LIVE-08-S10/S11` as passed.

The shared test record is `\\192.168.1.71\nas\projects\DigiStayBook\business-operations\DIGISTAYBOOK_TEST_PROCEDURES.html`, procedure `TP-LIVE-08`.
