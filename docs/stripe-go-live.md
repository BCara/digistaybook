# Stripe go-live runbook

Created 23 October 2026. Takes `digistaybook-cbert` (digistaybook.com) from the `DigiStayBook sandbox` to a live Stripe account. Design and decisions: [stripe-integration-plan.md](stripe-integration-plan.md).

**Where it stands today.** Production runs on the sandbox: `STRIPE_RESTRICTED_KEY` is an `rk_test_` key, `STRIPE_WEBHOOK_SECRET` is the sandbox endpoint's, and the price ids in `functions/.env.digistaybook-cbert` are sandbox Prices (both secrets set 10 Sep 2026). The live account already exists: **DigiStayBook, `acct_1UDAcSCpbSvZHPj5`**, the parent of the sandbox. Its activation was started but stopped at *Account representative* (checked 23 Oct 2026). Until activation is submitted, Stripe redirects every live-mode Dashboard page to test mode, so nothing below can be done before step 1. Decided 23 Oct 2026: go straight to live, without a test-card run on the current setup. The live run uses the 100% verification code instead (TP-PROP-07).

Nothing changes for Hosts until step 5. A deployed function keeps the secret versions and params it was deployed with.

## 1 Finish activating the account (owner only)

Stripe → account switcher → DigiStayBook sandbox → *Switch to live account* opens the activation form where it stopped. Complete it: business details, representative identity, payout bank account, statement descriptor (`DIGISTAYBOOK`), support email and URL (`https://digistaybook.com`). Two-factor authentication on.

Until `charges_enabled` is true, checkout cannot take a card. The setup script warns about this.

## 2 Build the live catalogue and webhook

**Done 23 Oct 2026 (activation submitted, under review).**
- Account default "Include tax in prices" was already **Automatic**, with SaaS (business use) as the preset category.
- Catalogue built in the Dashboard:

| Object | Live id | Detail |
|---|---|---|
| Product "DigiStayBook" | `prod_VUXkONUHx1sqjd` | tax code `txcd_10103001`, SaaS business use |
| Monthly price | `price_1UTYeeCpbSvZHPj5dfQFUhEf` | A$15.00 + US$10.00, lookup `dsb_monthly`, tax behaviour default (inferred by currency) |
| Annual price | `price_1UTYedCpbSvZHPj5AV6hWx29` | A$150.00 + US$100.00, lookup `dsb_annual`, tax behaviour default (inferred by currency) |

| Coupon "Launch verification" | `Oef15FzK` | 100% off, forever, DigiStayBook only, max 3 redemptions, metadata `dsb_purpose=launch_verification` |
| Promotion code | `DSB-VERIFY-BAFBE81D` | max 3 redemptions. Do not publish it |
| Webhook destination `digistaybook-stripeWebhook` | `we_1UTcEoCpbSvZHPj5bBzRdDZX` | → `https://australia-southeast1-digistaybook-cbert.cloudfunctions.net/stripeWebhook`, snapshot payloads, API `2026-08-26.dahlia`, exactly the six `handledEvents` |

The webhook signing secret was **not** read or stored by Claude. The owner reveals it on the destination page and sets it with `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`. Until the switch-over deploy, the deployed function verifies against the sandbox secret, so any live event would be rejected. None of the six events can fire before a live checkout exists.

These ids are **not yet** in `functions/.env.digistaybook-cbert`. They go in together with the live restricted key (step 3), because live price ids with the sandbox key would break checkout on the next deploy. The script below recognises this Product by its prices, so rerunning it only adds what is missing (the promotion code and the webhook).

Make a **temporary** restricted key (Developers → API keys → Create restricted key, live mode) named `go-live setup`, with **write** on: Products, Prices, Coupons, Promotion Codes, Webhook Endpoints, Tax Settings. Then, in your own PowerShell terminal:

```powershell
$env:STRIPE_SETUP_KEY = [Net.NetworkCredential]::new('', (Read-Host 'Stripe setup key' -AsSecureString)).Password
$env:NODE_OPTIONS = '--use-system-ca'
npm --prefix functions run build
node tools/stripe-go-live.mjs --dry-run
node tools/stripe-go-live.mjs --write-env
```

`tools/stripe-go-live.mjs` is idempotent: rerunning it skips whatever exists. It:

1. sets the account default tax behaviour to Automatic (`inferred_by_currency`) **before** any Price exists;
2. creates the Product and the two Prices from `publishedRates`, so they cannot disagree with what `quote()` accepts. AUD is the base currency, USD is in `currency_options`, and `tax_behavior` is not set (it is immutable);
3. creates a 100% coupon restricted to the Product, plus a `DSB-VERIFY-…` promotion code capped at 3 uses. The code is printed. Do not publish it, because it makes a property free for good;
4. creates the webhook endpoint `https://australia-southeast1-digistaybook-cbert.cloudfunctions.net/stripeWebhook` for exactly `handledEvents`, and stores its signing secret as a new `STRIPE_WEBHOOK_SECRET` version without printing it;
5. writes the live price ids into `functions/.env.digistaybook-cbert`, keeping the sandbox ids as a comment for the preview project (A-15).

Delete the `go-live setup` key afterwards.

## 3 Create the key the functions run on

Developers → API keys → Create restricted key (live), named `digistaybook-functions`:

| Write | Read |
|---|---|
| Checkout Sessions, Customers, Subscriptions, Billing Portal Sessions | Prices, Products, Promotion Codes, Coupons, Invoices, Disputes |

Set it from your own terminal (the CLI prompts for the value):

```powershell
$env:NODE_OPTIONS = '--use-system-ca'
npx firebase functions:secrets:set STRIPE_RESTRICTED_KEY --project digistaybook-cbert
```

## 4 Dashboard settings the API cannot make

- **Revenue recovery → Retries:** Smart Retries for 2 weeks, then mark the subscription unpaid. Stripe's own failed-payment emails stay off (ST-D5, proposed and not yet approved).
- **Revenue recovery → Emails:** trial-ending and card-expiring reminders off. DigiStayBook sends its own.
- **Radar:** the AU/US card rule (ST-06a, §3a layer 3) needs Radar for Fraud Teams. Until then, layers 1 and 2 (country gate and webhook check) still apply.
- **Branding:** icon, colour and the public business name shown on Checkout.

## 5 Deploy and verify

Commit the `.env.digistaybook-cbert` change, then deploy the functions (`NODE_OPTIONS=--use-system-ca`). Verify:

1. A draft property → Billing → quote shows A$15 / US$10. A quote error here means the price ids and the key point at different accounts.
2. Activate with the `DSB-VERIFY-…` code. Checkout must not ask for a card at A$0.00 (TP-PROP-07).
3. Stripe Dashboard → Webhooks → the endpoint shows `checkout.session.completed` delivered with a 200. The wall goes live, and only after that.
4. Cancel that property from the Host Dashboard. Stripe shows `cancel_at_period_end`.

**Rollback:** set the previous secret versions back (`gcloud secrets versions disable` on the new ones), restore the sandbox price ids from the comment in the env file, and redeploy.
