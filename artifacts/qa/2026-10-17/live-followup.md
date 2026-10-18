# Live authenticated follow-up — 17 October 2026

Scope: authorised dedicated DigiStayBook host account, synthetic private property, and relevant mail in the signed-in Zablantools Gmail inbox. Desktop browser only. No charge, subscription acknowledgement, password change, reviewer privilege grant, or permanent deletion.

Test identity: zablantools+digistaybook-ai-20261017@gmail.com. Password and email action tokens are deliberately excluded from this report.

## Account creation and recovery

- Create-account form contained optional name, email, password, confirmation and Google sign-in; password hint says at least 8 characters.
- Seven-character password was refused: “Choose a password of at least 8 characters.”
- Mismatched confirmation was refused: “Both passwords need to match.”
- Valid signup with display name DigiStayBook AI Test reported: “We could not create your account. We could not reach the authentication service. Check your connection and try again.”
- One retry reported the email already exists. Signing in with the original generated password succeeded, reaching Your host overview / No properties yet. Account name was blank. The initial signup journey therefore failed despite creation of the authentication identity; recovery is not a pass for that journey. Root cause unconfirmed. Host-side connectivity was healthy, which does not exclude a transient browser request failure.
- Later explicit Sign out returned to the home page. Sign in again returned to the same dashboard and its persisted draft property.
- No automatic signup/verification message was found in an all-folders Gmail search for the exact test alias before manually requesting verification. Source createHostAccount does not request a verification email.

## Real email delivery

- Manually requested Send verification email from Account settings; app reported success. Received in Gmail Inbox within five minutes, 17 October 2026 at 10:51 AM Sydney time.
- Subject: Verify your email for DigiStayBook. From: DigiStayBook <noreply@digistaybook-cbert.firebaseapp.com>. To: the dedicated alias.
- Message has a single verification action URL and no advertising. Opened the received link and pressed COMPLETE VERIFICATION. Result: Your email has been verified. Account details refresh then showed Email verified.
- From signed-out Host sign in, entered the dedicated alias and pressed Forgot your password? Exact acknowledgement: “Check your inbox. If that address belongs to a host account, a password reset email is on its way.”
- Password-reset message received in Gmail Inbox within five minutes, 17 October 2026 at 10:52 AM Sydney time. Subject: Reset your password for DigiStayBook. Same sender and dedicated recipient. It identifies DigiStayBook and the account, contains a reset action URL and no advertising.
- Password was not changed. Reset completion, used-link rejection and 61-minute expiry remain untested; credential changes require the user to complete the browser flow.

## Draft property and publishing boundary

- Created AI QA Cottage 2026-10-17 in the three-step wizard, with synthetic arrival heading/note and Wi-Fi guidance. No payment prompt during creation.
- Live property ID: vzXLBJRAvgMZOTNUAb7U. Slug: ai-qa-cottage-2026-10-17-mdh9. Remains DRAFT / PRIVATE.
- Reopening showed the saved arrival heading, note and Wi-Fi guidance, plus the design editor and phone preview.
- While the account was unverified, Publish reached plan selection, Australia billing, A$15/month and A$150/year. Monthly showed 28-day trial ending 14 November 2026, renewal at A$15/month, and an unchecked acknowledgement with that amount/date. Start free trial remained disabled.
- No email-verification warning appeared through plan selection. Stopped before subscription acknowledgement/checkout; this only partially exercises TP-ACC-08-S02 and does not establish whether a later server gate exists.

Further observations are appended below as executed.

- Uploaded project-owned logo fixtures (512px PNG cover and 120px JPEG host image). Both displayed Uploading… then rendered in the editor and phone preview, without payment. These are image-upload controls, not camera-roll/portrait-orientation proof.
- Tried Warm Linen, Editorial, Playful and Journal. Text and uploaded images remained in each preview; no theme price/lock. Returned to Warm Linen; editor reported Everything here is saved. The five legacy names in the procedure differ from the four current choices.
- Walls and QR display showed the guest link, public link, QR artwork and Printing is locked / Printing unlocks with an active trial or subscription. No Download QR / Email QR controls were present.
- Opened the guest link while signed in: PREVIEW / Not published yet / Only you can see this. Guests get a closed notice. Arrival content and both fixture images were visible.
- Signed out and reloaded that exact guest link: This guestbook isn’t open to visitors, a neutral explanation and host/booking support direction; no private content. This tests a signed-out browser session, not a separate private-window process.
- Inbox & moderation showed Memories 0, All caught up and no outstanding reports. Private feedback is a separate tab, No feedback yet, with “Replies aren’t supported” and no reply button. No submitted live memories/reports were available because the property remains a draft.
- Export guestbook downloaded live-draft-export.zip. App: Part 1 prepared with 0 memories / All parts prepared. ZIP CRC check passed. Contains messages.json (correct property, posts []), README.txt and index.html with correct property heading and a restrictive CSP. No populated export/offline-photo journey was exercised.
- Ordinary host opening /operations: Safety Review access / An authorised reviewer account is required. No queue or private case data displayed.
- Monthly and Annual amount/date copy inspected. Annual acknowledgement says A$150.00 on 14 November 2026; checkbox left unchecked. Start free trial disabled. Not right? exposes Where will you be billed? / Australia selected / United States. Returned Back to the property, with property still draft and no checkout/charge attempted.
- The complete visible billing main text contained no GST/tax-inclusion disclosure. TP-BILL-01-S06 fails on this live page, even though the separate public pricing page has a tax sentence.

- A reset request for nobody@example.com produced exactly the same neutral acknowledgement as the real test alias. No account-existence information was exposed.
