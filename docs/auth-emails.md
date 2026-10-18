# Branded authentication emails

Implemented 17 October 2026 using DigiGuestbook's password-reset method.

Firebase Admin issues the secure action code. Resend sends the email from
`DigiStayBook <noreply@digistaybook.com>`. HTML emails display a short button;
their plain-text alternative includes the full DigiStayBook link.

- Reset: `https://digistaybook.com/reset-password?oobCode=...`
- Verification: `https://digistaybook.com/verify-email?oobCode=...`

The app validates codes against its own configured Firebase project. It never
uses an API key or redirect supplied in the incoming link. Verification requires
a button click, so opening an email scanner's preview does not verify an account.
Expired reset links offer a form to request a replacement. Successful actions
remove the code from the address bar.

## Sending and access

`sendPasswordReset` and `sendAccountVerification` run in `australia-southeast1`.
Both enforce App Check in production. Verification additionally requires a
non-anonymous session and reads the recipient from the server's account record;
the client cannot choose another verification recipient.

`RESEND_API_KEY` is in DigiStayBook Secret Manager. The existing Resend sending-only
key covers all domains; no new provider key was created. The dedicated Functions
runtime account has a custom `authEmailSender` role containing only
`firebaseauth.users.get` and `firebaseauth.users.sendEmail` in addition to its
existing roles. There is no fallback to Firebase's default mailer.

Firestore transactions reserve each request and limit requests to 5 per IP per
hour, 3 per recipient per hour and 100 globally per hour. These fixed hourly
windows and UUID request references prevent ordinary abuse and duplicate sends.
Reset responses are identical for missing accounts and provider failures. Check
`authEmailRequests` and Cloud Logging when investigating failed delivery.

Production request records contain a status and provider ID, without recipient
addresses or action codes. IP and recipient limits use HMAC digests with
`REPORT_HASH_KEY`. Both new collections have `expiresAt` TTL policies; records
become eligible for deletion after two hours. Firestore TTL deletion is asynchronous.

## DNS and provider verification

Resend domain ID: `5c0d5e8d-fdbf-4661-b76b-2971d319891e`, Tokyo region.
Verified in Resend on 17 October 2026 after adding these records in GoDaddy:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `resend._domainkey` | Public DKIM key supplied on the Resend domain page |
| CNAME | `rsend` | `rsend-apne1.forge.rmta.net` |
| CNAME | `send` | `send.forge.rmta.net` |

The existing website, apex SPF and ImprovMX receiving records were retained.
Receiving through Resend and tracking metrics are not enabled. The abandoned
Firebase default-mailer domain-verification request was cancelled: this flow
uses Resend and does not depend on Firebase template customisation.

## Validation

Focused auth tests: 38 passed. TypeScript and the production build passed.
The isolated Firebase emulator exercise validated real reset/verification codes,
changed a disposable local account's password, verified another disposable local
account, and checked unsigned and forged-recipient requests. No real email was
sent by the emulator. The helper is `tools/verify-auth-emails.mjs`; it expects the
demo project's Auth, Firestore and Functions emulators on 19199, 18180 and 15101.

Both template variants were accepted by Resend's `delivered@resend.dev` simulator.
These are provider tests, not proof of delivery to a person's inbox. Provider IDs
and sender details are in `artifacts/qa/2026-10-17/auth-email-provider-tests.json`.

The broader unit suite produced 731 passes, one skip and an existing failure in
`src/domain/publicWall.test.ts` concerning host notes. That test and the associated
wall code were outside this email change. The pre-change frontend source was
rebuilt and reproduced the live index and its content-addressed asset names before
the authentication changes were overlaid for release.

The two new Functions and Hosting are deployed. All 25 production files matched
the release build by SHA-256. `/reset-password`, `/verify-email` and `/host/sign-in`
returned HTTP 200. Both callables rejected requests without App Check with 401.
A live browser reset request passed App Check and recorded `skipped` for a
nonexistent test account, without sending email. Resend's dashboard showed
`Delivered` for both simulator template tests; a real recipient's inbox has not
been checked. The TTL policies were `CREATING` at release verification (new
documents already receive TTL; existing documents are processed asynchronously).
