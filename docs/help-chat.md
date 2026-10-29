# DigiStayBook help widget

Adapted from LazyAlbum's floating help and support flow, using DigiStayBook branding and curated answers entirely in the browser. No AI provider, API key or network request is needed to answer questions. Prices and trial length come from the existing published pricing module.

The guide recognises setup, pricing, QR displays, guest access, account access, moderation, private feedback, cancellation and privacy questions. Unknown or account-specific questions go to Message us. It does not infer conversational follow-ups; visitors should name the topic in each question. Marketing and host pages show the widget; guest walls, embedded walls and operations do not.

## Email support setup

Deploy `helpContact` and `deleteExpiredHelp` with the frontend. Support uses the same branded Resend integration as authentication mail, with existing `RESEND_API_KEY` and `REPORT_HASH_KEY` secrets. `HELP_SUPPORT_EMAIL` defaults to the existing operations recipient `codebertcreations@gmail.com`. No AI secrets or model settings are needed.

App Check is required outside the emulator. Contact limits are reserved atomically: 5 per IP per hour and 100 site-wide per day. Explicitly submitted messages and optional recent chat are saved in `helpContacts`, then emailed through Resend with an idempotency key and the visitor email as Reply-To. Failed delivery remains pending and visitors can retry. Ordinary chat stays in browser memory.

Default-deny Firestore rules protect support records and pseudonymous counters. Daily cleanup deletes database support records after 180 days and expired counters after two days. Mailbox/provider copies have separate retention. The privacy draft describes this processing.

The emulator saves support submissions locally without emailing. Curated answers are identical locally and in production. After deployment, verify actual support email receipt, Reply-To, optional chat inclusion, retries and App Check refusal. Existing working authentication email does not by itself prove this new endpoint has been deployed or delivered mail.
