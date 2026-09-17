# Stripe integration plan

Created 8 September 2026. Authority: [DigiStayBook Business & Operating Plan](handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html), §4.1, §4.2, §5.1, §5.6, §5.7, §5.10, §6.3.4, §6.3.7. Secondary source: the `stripe-best-practices` skill shipped with the `stripe@claude-plugins-official` plugin (v0.4.1), which carries Stripe's own current guidance.

This is a build plan, not an approval. It does not amend the handbook. Every row in §11 is an owner decision that must be recorded before the corresponding code can go to production. Nothing here has been run against a Stripe account.

**Draft status.** Cross-checked against `stripe_implementation_planner` (Stripe's own MCP planning tool) on 8 September 2026 once the MCP server was authenticated. The planner's recommendations match this design — Stripe-hosted Checkout, free trial with card on file, Customer Portal for payment-method updates, Smart Retries, and free tax threshold monitoring. The one divergence to carry forward is recorded in §11 (ST-D9): flexible billing mode.

**Verification.** Every API parameter, enum value and Dashboard option quoted below was checked against the live Stripe documentation on 8 September 2026 using `stripe docs` (Stripe CLI 1.50.10), not recalled. Where a claim was wrong, it has been corrected in place; §7 in particular now quotes the Dashboard's own three options verbatim.

---

## 1 What the handbook already fixes

These are constraints, not choices. They rule several common Stripe patterns out before any design starts.

| Handbook rule | Consequence for the integration |
|---|---|
| §4.2 "Entitlements change only when a signature-verified Stripe webhook is processed. Nothing in the client grants access." | No client-side fulfilment. The Checkout success redirect writes nothing. `checkout.session.completed` is the only thing that unlocks a wall. |
| §4.1 Billing is per activated property; a host with four properties holds four subscriptions | One Stripe Customer per host, N Subscriptions per host, each carrying `metadata.propertyId`. Not one subscription with quantity 4. |
| §4.1 No feature-gated tier; monthly and annual are the same platform | **One** Product, **two** Prices. Not two Products. |
| §4.1 Prices render in the host's point-of-sale currency (AUD, GBP, EUR, USD), rounded cleanly | `currency_options` on each Price, not four Price objects per interval. |
| §6.3.4 Checkout must show the calculated trial end **date** and a required acknowledgement checkbox with exact wording | The acknowledgement cannot live on Stripe's hosted page. It lives on our activation screen, is recorded, and gates session creation. |
| §5.7 Webhook processing is idempotent; a Stripe retry cannot activate a property twice | Event-id ledger in Firestore, written in the same transaction as the entitlement change. |
| §4.1 A 100% discount code must be able to activate a property in production without taking a real payment | `allow_promotion_codes: true` from day one, even though codes are not marketed. |
| §5.2 A suspended or cancelled property routes to a designed fallback page, never an error | Lifecycle must reach `suspended`/`dormant` reliably, because `getPublicWall` already fails closed on it. |

## 2 What already exists in this repository

The billing surface is further along than the absence of a Stripe SDK suggests.

- [`src/domain/property.ts`](../src/domain/property.ts) — `PropertyLifecycle` with all nine states; `isPubliclyReadable` and `canDownloadQrKit` already gate the wall and the QR kit on lifecycle.
- [`src/domain/billing.ts`](../src/domain/billing.ts) — the lifecycle transition table, keyed by a `BillingEvent` union that reads as a deliberate abstraction over Stripe rather than a copy of it.
- [`src/ui/pages/HostBillingPage.tsx`](../src/ui/pages/HostBillingPage.tsx) — reads `property.billing.{trialEndsAt, currentPeriodEndsAt, lastPaymentAt}` and states plainly that it reports state rather than changing it.
- [`firestore.rules`](../firestore.rules) — a host update may only touch `name`, `profile`, `updatedAt`. `lifecycle` and `billing` are already unwritable from a browser.
- [`functions/src/index.ts`](../functions/src/index.ts) — `onCall`/`onRequest` v2 in `australia-southeast1`, and `moderatePost` establishes the house pattern: a server-owned transition table that does not trust the client-side one.

So the work is not "add billing". It is: fill `property.billing`, drive `property.lifecycle` from Stripe, and build the three host actions the billing page already promises.

## 3 Catalog

One Product. Two recurring Prices. Four currencies per Price.

Launch markets are **Australia and the United States only** (ST-D4). Two currencies, not four. GBP and EUR are deliberately absent — §4 explains why that absence is not by itself a sales gate.

```
Product  prod_… "DigiStayBook"
         tax_code = <confirmed txcd_ — see §11 ST-D3>
  ├─ Price price_monthly  recurring{interval:month}  currency: aud  unit_amount: 1500
  │     currency_options: { usd: { unit_amount: 1000 } }
  └─ Price price_annual   recurring{interval:year}   currency: aud  unit_amount: 15000
        currency_options: { usd: { unit_amount: 10000 } }

No tax_behavior on either Price. See below.
```

### Amounts (ST-D1 — approved 8 Sep 2026, Cara)

Annual is exactly ten times monthly, which is what §4.1's "equivalent to two months free" means arithmetically. All four figures are whole units, as §4.1 requires.

| Currency | Monthly | Annual | Net today (no registrations) | Net once GST-registered |
|---|---|---|---|---|
| AUD | A$15 | A$150 | **A$15.00** | A$13.64 |
| USD | $10 | $100 | **$10.00** | $10.00 (state tax added on top) |

These are **price points, not conversions.** They are anchored on the handbook's USD $10/$100 and rounded to numbers that read as prices rather than as exchange-rate output. Confirm A$15 against the spot rate on the day the Prices are created — the ratio embeds an approximate rate and is not tracked live.

### Tax behaviour: set it on the account, not on the Prices

`tax_behavior` on a Price is **immutable once set** to `inclusive` or `exclusive`. Getting it wrong means creating replacement Prices and migrating every live subscription. There is no need to take that risk.

Stripe supports an account-level **default tax behaviour**, and its **Automatic** setting "selects exclusive pricing for USD and CAD and inclusive pricing for all other currencies" — and explicitly works with multi-currency Prices. That is precisely the split this catalog wants: AUD quoted GST-inclusive per Australian convention, USD quoted tax-exclusive because US state sales tax is added at checkout.

So: **omit `tax_behavior` from both Prices** and set the account default to Automatic (Dashboard → Tax → settings). Prices with no `tax_behavior` inherit the default, and Stripe's documentation states they are then ready for Stripe Tax. The one-way door disappears.

### What "not yet registered" means for revenue

ST-D2 is answered: no Australian GST registration, no US state registrations. Therefore `automatic_tax: { enabled: false }`, no tax line on any invoice, and — because a tax-inclusive price with no applicable tax is simply the price — **A$15 nets the full A$15 today**, not A$13.64.

Two consequences worth carrying into §8.1:

- The A$13.64 figure is not today's number, it is the number **from the day GST registration takes effect**. That is a ~9% revenue step-down on every Australian subscription, arriving at the moment turnover grows past the registration threshold — the moment the business is least able to absorb it. Model it now rather than meeting it. (The threshold is a turnover figure your adviser will confirm; the point is that it is a *when*, not an *if*, for a business that works.)
- Because the flip is planned rather than discovered, it costs nothing at the time: switch `automatic_tax` to `true`, and the account default resolves AUD to inclusive on its own. No new Prices, no migration, no change to the number a host sees.

**Until registration exists, no invoice, receipt or pricing page may show a GST line or imply GST is included.** An unregistered business stating it collects GST is a separate problem from anything in this plan. §6.3.4's approved tax callout is the deductibility wording and is unaffected, but the receipt template in §5.6 needs a check against this before it is built.

## 3a The sales gate

**Dropping GBP and EUR does not stop a UK or EU host buying.** They pay in USD like anyone else. Currency is a display choice; jurisdiction is a separate control, and Stripe Checkout does not provide one — `allowed_countries` exists only under `shipping_address_collection`, which a digital subscription never uses. The gate has to be built.

Three layers, because no single one is sufficient:

1. **Declared country, before the session exists.** The activation screen (§4) already collects an acknowledgement; it also collects the host's country and stores it as `hosts/{uid}.billingCountry`. A country outside the allowlist sees "not available in your country yet" and **no Checkout Session is created**. This is the layer that does the real work, because it is the only one that acts before the host has spent any effort.
2. **Verified country, at the webhook.** Set `billing_address_collection: "required"` so Stripe captures a real billing country, and compare `customer.address.country` to the declared value before granting entitlement. A mismatch outside the allowlist does not activate the property; during a trial nothing has been charged, so cancelling the subscription costs the host nothing and refunds nothing.
3. **Radar, as a backstop on the first charge.** `Block if :card_country: != 'au' AND :card_country: != 'us'`. Radar has no `NOT IN` operator, so an allowlist is written as chained `!=`, and the country list should be held in a Radar value list so the rule does not need editing when a market opens.

**Layer 3 fires late, and that is why layers 1 and 2 matter.** With a 28-day trial there is no charge at activation, so Radar sees nothing until day 28. A UK host who slipped past layer 1 would set up a property, print a placard, hang it in their kitchen, and be blocked four weeks later at the first charge. That is precisely the §4.3 failure the handbook cares about — a broken experience in front of a guest — so the gate must hold at layer 1.

The country is the **host's**, not the property's. `profile.location` is public display text ("Byron Bay, NSW"), not a structured field, and a host can live in one country and own a property in another. The tax treatment of a B2C digital subscription follows the customer, so the host's billing country is the one that governs both the gate and the tax.

Rationale for one Product: Stripe's guidance is to create one Product per *tier a customer chooses between*, and to attach multiple Prices to one Product for *billing variants of the same plan — monthly versus annual, or different currencies*. §4.1 states there is no feature-gated tier, so monthly/annual is exactly the billing-variant case. Two Products would put two different names on invoices for an identical service.

Price IDs are configuration, never literals in application code. They are **not** secrets, so they are `defineString` params rather than Secret Manager entries — Firebase keeps params in a per-project `.env.<project>` file, which already makes it impossible to point a test deployment at the live catalogue, without paying Secret Manager's per-version cost for a public identifier.

### Two API-shape traps, found while building

Both would have compiled and then quietly written `null` for the life of the integration.

- **`current_period_end` is no longer on the Subscription object.** It lives on each subscription item (`subscription.items.data[].current_period_end`). Reading the old location yields `undefined`, so `currentPeriodEndsAt` and `serviceEndsAt` would both be empty — meaning a cancelled property would have no end date to show the host, which §4.3 requires. `periodEndOf()` in `functions/src/stripeWebhook.ts` takes the earliest item end, so an unexpected second item shortens service rather than silently extending it.
- **`invoice.subscription` is gone.** The link moved to `invoice.parent.subscription_details.subscription`. Reading the old field would orphan every `invoice.paid` and `invoice.payment_failed` event — the wall would activate but never record a payment, and a failed payment would never open grace.

**Do not** use the deprecated `plan` object. **Do not** pass `payment_method_types` anywhere — omitting it is what enables dynamic payment methods, and hardcoding `['card']` would suppress local methods that matter in three of the four target currencies.

## 4 Activation: the pre-checkout screen

§6.3.4 requires the exact trial end date and a ticked acknowledgement *before* payment details are collected. Stripe's hosted page cannot render that checkbox with our wording, so the order is:

1. **Our screen** computes `trialEndsAt` and renders the monthly or annual microcopy from §6.3.4 verbatim, with `{Trial_End_Date}` and `{Price}` substituted, plus the required checkbox: *"I understand I will be billed ${Price} on {Date} if I do not cancel."*
2. Host ticks and submits. A callable records a **billing acknowledgement event** — wording, wording version, timestamp, price, currency, computed trial end — on the property, mirroring the versioned consent-event pattern already used for guest consent (§5.3) and marketing consent (§5.1).
3. Only then does the callable create the Checkout Session and return `session.url`.

**The trial end date must be passed to Stripe, not merely described to it.** Pass `subscription_data.trial_end` as the explicit unix timestamp we displayed, not `trial_period_days: 28`. `trial_period_days` is resolved by Stripe at session completion; if the host leaves the tab open overnight, the date on the receipt stops matching the date they acknowledged — which §4.3 ("marketing, checkout, dashboard entitlements and the customer policies describe the same offer, in the same words") does not permit. Give the session a short `expires_at` for the same reason.

`trial_end` must be **at least 48 hours in the future**. A 28-day trial clears that comfortably, but it rules out using a near-zero trial as an internal test shortcut — use the 100% promotion code path for that instead (§4.1).

### Checkout Session

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: hostStripeCustomerId,
  client_reference_id: propertyId,
  // No payment_method_types — dynamic payment methods are configured in the Dashboard.
  line_items: [{ price: priceId, quantity: 1 }],
  allow_promotion_codes: true,                 // §4.1: the 100% internal-verification code
  payment_method_collection: "always",         // §4.1: a valid payment method is required to start a trial
  billing_address_collection: "required",      // §3a layer 2: a real country to verify against
  subscription_data: {
    trial_end: acknowledgedTrialEndUnix,       // the date the host actually acknowledged
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { propertyId, ownerUid }
  },
  metadata: { propertyId, ownerUid, acknowledgementId },
  automatic_tax: { enabled: false },           // ST-D2: no registrations at launch. Revisit at ST-D11.
  integration_identifier: "dsb-activate-<8 random letters>",
  success_url: `${appUrl}/host/property/${propertyId}/billing?activating=1`,
  cancel_url:  `${appUrl}/host/property/${propertyId}/billing`
}, { idempotencyKey: `activate:${propertyId}:${acknowledgementId}` });
```

`success_url` deliberately does **not** carry `{CHECKOUT_SESSION_ID}` for fulfilment purposes. It lands on the billing page in an "activating" state that watches the property document. The wall unlocks when the webhook says so, not when the browser returns — §4.2.

### Trial eligibility

§4.1: the trial is available on the **first activated property only**. That is a host-level fact, so it belongs on the host document, not the property:

- `hosts/{uid}.trialConsumedAt` is set inside the same transaction that first grants an entitlement.
- The activation callable reads it and omits `trial_end` entirely for every subsequent property, and the pre-checkout screen renders the no-trial variant of the copy — charged today, at this price.
- Because the check is server-side and transactional, two properties activated in parallel cannot both take the trial.

## 5 Webhook endpoint

A single `onRequest` function, `stripeWebhook`, in `australia-southeast1`.

```ts
const event = stripe.webhooks.constructEvent(
  req.rawBody, req.headers["stripe-signature"], webhookSecret
);
```

`req.rawBody` is required — Firebase Functions v2 provides it, but any body-parsing middleware inserted ahead of it will silently break signature verification.

### Idempotency and ordering

Two distinct problems, and they need two mechanisms.

**Idempotency** (§5.7, "a Stripe retry cannot activate a property twice"): a Firestore transaction creates `stripeEvents/{event.id}` and applies the entitlement change together. If the document already exists, the transaction aborts and the endpoint returns 200 without re-applying. The ledger document holds only the event id, type, `created`, the property it touched and the resulting lifecycle — no payload, no personal information.

**Ordering**: Stripe does not guarantee delivery order, so a stale `customer.subscription.updated` can arrive after a newer one. Two guards:

- Store `property.billing.lastEventCreated`; discard any subscription-scoped event with an older `event.created`.
- For every `customer.subscription.*` event, treat the payload as a *trigger* and re-read the subscription from the API before writing. The subscription object is the source of truth for `status`, `current_period_end` and `trial_end`; the event payload is only a snapshot of when it was queued.

Return 200 for anything we do not handle, and for anything already in the ledger. Return 500 only for genuine transient failures, so Stripe's retry is doing useful work rather than replaying a permanent error.

Allowlist [Stripe's published IP ranges](https://docs.stripe.com/ips) on the endpoint as defence in depth. Signature verification is the control; the allowlist is the belt.

### Events consumed

| Event | Firestore effect | `BillingEvent` |
|---|---|---|
| `checkout.session.completed` | Bind `stripeCustomerId`/`stripeSubscriptionId` to the property; set `trialConsumedAt` if a trial was granted; unlock routing URL + QR kit | `trial_started` |
| `customer.subscription.updated` | Re-read subscription; map status (§6); write `currentPeriodEndsAt`, `trialEndsAt`, `cancelAtPeriodEnd` | per §6 |
| `customer.subscription.deleted` | End of the paid cycle after cancellation, or terminal dunning failure | `period_ended` |
| `invoice.paid` | `lastPaymentAt`; clear grace deadline | `invoice_paid` |
| `invoice.payment_failed` | Open the 14-day grace window; record `suspendAt`; queue the §5.6 failed-payment email | `payment_failed` |
| `customer.subscription.trial_will_end` | Queue the §5.6 trial expiry notice — but see §7 | — |
| `charge.dispute.created`, `charge.refunded` | Record for the §5.7 monthly reconciliation. No automatic entitlement change; §4.3 puts refund authority with a named owner | — |

## 6 Stripe status → `PropertyLifecycle`

This mapping is the whole integration in one table.

| Stripe subscription `status` | `PropertyLifecycle` | Wall served? | QR kit? |
|---|---|---|---|
| `trialing` | `trialing` | yes | yes |
| `active` | `active` | yes | yes |
| `past_due` | `grace_period` | **yes** — §5.7: the wall stays fully live while the card is retried | yes |
| `unpaid` | `suspended` | no — fallback page | no |
| `canceled` | `cancelled_pending_end`, then `dormant` at period end | until `serviceEndsAt` | until `serviceEndsAt` |
| `incomplete`, `incomplete_expired` | stays `draft` | no | no |

`isPubliclyReadable` in `src/domain/property.ts` already serves `trialing`, `active` and `grace_period` and refuses `suspended` — the mapping above was chosen to fit the code that exists rather than the other way round.

**One-click cancellation** (§4.3, "effective at the end of the paid cycle") is `subscriptions.update(id, { cancel_at_period_end: true })`. That leaves `status: 'active'` with `cancel_at_period_end: true`, which is *not* a status change. Stripe sends a plain `customer.subscription.updated` — the same event as any other edit — so the lifecycle move to `cancelled_pending_end` must key off the flag, not the status. Missing this is the most likely single bug in this build: the host clicks cancel, gets a confirmation, and the dashboard goes on saying "Active" until the period ends.

The reverse is also true and worth building now: setting `cancel_at_period_end` back to `false` reinstates the subscription at any point before the period ends. That is the cheapest possible win-back, and it maps to the `reactivated` event already in `src/domain/billing.ts`.

## 7 Resolving the handbook's two flagged conflicts

§5.7 and §5.6 each carry a *Confirm* that this design can answer concretely.

**Dunning (§5.7).** The handbook describes one 14-day grace period; Stripe's Smart Retries will independently attempt the card several times inside that window. They do not conflict if the Dashboard is configured to match. All three settings live under **Billing → Revenue recovery → Retries**:

- **Maximum duration: 2 weeks.** Smart Retries does not take an arbitrary number of days — the menu is 1 week, 2 weeks, 3 weeks, 1 month or 2 months. Two weeks lands exactly on the handbook's 14 days, which is why the handbook's figure needs no amendment. (A custom retry schedule is the alternative: up to three retries, each a chosen number of days after the previous attempt.)
- **After the final attempt: "Mark the subscription as unpaid."** The Dashboard offers exactly three behaviours — cancel the subscription, mark it unpaid, or leave it overdue in `past_due`. `unpaid` maps to `suspended` and keeps the subscription reactivatable, which §5.7 requires; `canceled` would destroy it and force a new checkout on a host whose card merely expired; leaving it `past_due` would keep the wall live indefinitely without payment, which §5.7 forbids. Under `unpaid`, Stripe keeps generating invoices in `draft` — harmless, and useful for the §5.7 monthly reconciliation.
- Turn **off** Stripe's own automatic dunning emails (**Billing → Revenue recovery → Customer emails**). §5.6 owns that sequence, and two differently-worded failure emails from the same company is exactly the §4.3 consistency failure.

**A hard decline is not retried, and this changes the §5.6 copy.** Where the issuer returns a hard decline code, Stripe schedules the retries but does not execute them: the counter increments, no charge is attempted, and nothing happens until a new payment method is attached. So the failed-payment email must not say the card will be tried again — it must state the suspension date and drive the host to the update route. Wording that promises retries would be false for a materially large share of failures. This is an amendment the §5.6 email table needs before it is written.

**The 14-day annual renewal notice (§5.6).** Do not build this on `invoice.upcoming`. That webhook fires on an account-wide "upcoming invoice" setting shared with the monthly plan — a 14-day lead would send monthly hosts a renewal notice halfway through every cycle. Schedule the notice from `property.billing.currentPeriodEndsAt` with a Cloud Scheduler job, filtered to annual subscriptions. The same reasoning applies to the trial expiry notice: `customer.subscription.trial_will_end` fires at three days, and if §5.6 wants a different lead time, schedule it rather than bend the notice to Stripe's clock.

## 8 Payment-method updates and cancellation

§4.3 is emphatic that cancellation is self-service in the dashboard **and nowhere else**, and §5.7 requires the exact end date confirmed by email. That splits the two flows:

- **Payment method update** — Customer Portal, launched from our billing page and from the §5.6 failed-payment email, created with `flow_data: { type: "payment_method_update" }` so the host lands directly on the card form. This is the "secure update route" §5.7 asks for: the link is a short-lived server-created session, so the email carries no credential.
- **Cancellation** — our own callable, not the portal. We must render the exact end date, confirm it by email, and state what happens to the content afterwards (§4.3). A portal cancel flow would hand that copy to Stripe.

Portal configuration must have plan-switching **disabled**. Monthly↔annual movement mid-cycle would create prorations the handbook has no policy for.

## 9 Keys, secrets and client surface

- **Restricted API key (`rk_`), not a secret key.** Permissions needed: Checkout Sessions `write`, Customers `write`, Subscriptions `write`, Billing Portal Sessions `write`, Prices `read`, Products `read`, Promotion Codes `read`, Invoices `read`, Disputes `read`. Nothing else — no Charges write, no Payouts, no Tax registrations write.
- **Storage: Google Secret Manager**, reached through `defineSecret()` in Firebase Functions, which is Secret Manager underneath. The current `functions/.env.example` placeholders (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) should become `defineSecret("STRIPE_RESTRICTED_KEY")` and `defineSecret("STRIPE_WEBHOOK_SECRET")` before any live key exists, so there is never a moment where the committed pattern is an env file.
- **Separate keys and separate webhook secrets per environment.** The isolated preview project referenced in GC-04 gets its own sandbox.
- **`VITE_STRIPE_PUBLISHABLE_KEY` in `.env.example` should be removed.** With hosted Checkout we redirect to `session.url` and never load Stripe.js, so there is no publishable key, no Stripe.js in the bundle, and no Stripe CSP directives to add to `index.html`. If embedded Checkout is ever adopted, the key and `script-src`/`frame-src`/`connect-src https://*.stripe.com` come back together.
- **Pre-commit hook** matching `/[sr]k_(live|test)_/` across the tree, alongside the existing checks.
- No key, customer id or subscription id is ever returned to the browser. The billing page reads `property.billing`, which holds dates and state only.

## 10 Build order

Each item is independently provable in the Stripe CLI and the emulator before the next starts.

| ID | Work | Proof |
|---|---|---|
| ST-00 | Stripe CLI on PATH — **done**, v1.50.10 via `npm i -g @stripe/cli` | `stripe docs` and `stripe --version` respond |
| ST-03/04/05 | **Server written 8 Sep 2026; client activation screen added 8 Sep 2026.** `billingPolicy.ts` (versioned §6.3.4 copy, deterministic price and date rendering) + 14 unit tests; `stripeActivation.ts` — `activationOptions` (country gate, trial eligibility, live price quote, both disclosure variants) and `createActivationCheckout` (acknowledgement record, idempotent Customer creation, session with explicit `trial_end`). Client: `src/ui/host/billingStore.ts` (callable wrappers) and `ActivatePanel` inside `HostBillingPage` — a draft property's billing screen establishes the billing country (§3a layer 1) by guessing it from the browser's locale and time zone (`billingCountry.ts`, one click to overrule, and the question is still asked outright when the browser names neither served country), quotes the plan, renders the server's disclosure + acknowledgement checkbox verbatim, and on a ticked box redirects to `session.url`; the return from Stripe watches the property document rather than trusting the redirect. `createActivationCheckout` now persists `hosts/{uid}.billingCountry` on commitment. **Not yet done:** the activation callables have no unit tests (ST-05 emulator pass); end-to-end run needs the sandbox key + emulator. | `npm run check` green (334 tests); browser proof pending the restricted key |
| ST-02a | **Done 8 Sep 2026.** `stripeBilling.ts` (§6 mapping, sales allowlist, handled-event list) + 15 unit tests; `stripeConfig.ts` (Secret Manager binding, lazy client); `stripeWebhook.ts` (signature verification, event ledger, entitlement transaction); `hosts`/`stripeEvents` denied in `firestore.rules` + 3 rules tests; env examples corrected | `npm run check` green (307 tests); `npm run test:emulators` green (35 tests) |
| ST-01 | **Sandbox catalogue done 8 Sep 2026** in `DigiStayBook sandbox` (`acct_1UDAcoE6RXRx7LYa`). Account default tax behaviour set to **Automatic** (`inferred_by_currency`). One Product `prod_VDgefH6xk8OXHp` "DigiStayBook". `price_1UDFHNE6RXRx7LYaR5bQPPOg` monthly (AUD 1500 / USD 1000, lookup `dsb_monthly`) and `price_1UDFHSE6RXRx7LYavuue90cL` annual (AUD 15000 / USD 10000, lookup `dsb_annual`), both `tax_behavior` unset. Price ids in `functions/.env.digistaybook-cbert` (not secrets, per §9). Amounts approved (ST-D1). **Still open:** restricted key + webhook secret into Secret Manager; live-mode catalogue. | `stripe prices retrieve` shows AUD and USD on both prices, `tax_behavior` unset — **verified** |
| ST-02 | `stripeWebhook` skeleton: signature verification, event ledger, 200/500 discipline. No entitlement writes yet. | `stripe trigger` replayed twice writes one ledger row |
| ST-03 | Host↔Customer binding; `hosts/{uid}.stripeCustomerId`, created lazily and idempotently | Two parallel activations create one Customer |
| ST-04 | Billing acknowledgement event and pre-checkout screen with §6.3.4 copy, both variants, plus the §3a layer-1 country gate and `hosts/{uid}.billingCountry` | Wording and version stored; an unticked box cannot create a session; a GB host is refused before any session exists |
| ST-05 | `createActivationCheckout` callable with `trial_end`, trial-eligibility transaction, promotion codes, `billing_address_collection` | Second property gets no trial; a 100% code activates with no charge |
| ST-06 | Entitlement fulfilment: `checkout.session.completed` → lifecycle, routing URL, QR kit unlock, plus the §3a layer-2 country check | Wall reachable only after the webhook, never after the redirect; a mismatched billing country does not activate |
| ST-06a | Radar allowlist rule and value list (§3a layer 3) | A non-AU/US card is declined on the first charge |
| ST-07 | Full status mapping (§6) including the `cancel_at_period_end` trap; `invoice.paid`, `invoice.payment_failed` | `stripe trigger` for each status lands the right lifecycle |
| ST-08 | Dunning configuration, grace deadline and suspension; fallback page verified end to end | Card decline → wall stays live → day 14 → fallback page, no 404 |
| ST-09 | **Cancel done 10 Sep 2026.** `stripeCancellation.ts` — `cancelSubscription` sets `cancel_at_period_end` and returns the exact end date for the confirmation screen; `resumeSubscription` clears it while the period still runs; both record to `properties/{id}/billingActions` and neither writes `lifecycle` (the webhook does). Client: the cancel and undo controls on `HostBillingPage`, plus the next-charge sentence the screen never had. 14 unit tests. **Not yet done:** the portal payment-method-update flow, and the confirmation email — there is no mail transport in `functions/` at all, so the exact date is stated on screen only. | Cancel leaves the wall live to `serviceEndsAt` — **verified in unit tests**; email states the date — **not built** |
| ST-10 | Reconciliation export for the §5.7 monthly review; dispute and refund recording | Stripe subscription states match Firestore for every property |

ST-01 through ST-03 are safe to build against a sandbox before any of the §11 decisions land. ST-D1, ST-D2 and ST-D12 — the price, the tax treatment and the acknowledgement wording the host is asked to accept — are now all decided, so ST-04 and ST-05 are unblocked against the sandbox.

## 11 Open decisions

Owner decisions, in the handbook's own register format. None of these are engineering calls.

| ID / status | Handbook reference | Decision required | Blocks |
|---|---|---|---|
| **ST-D1 — decided 8 Sep 2026 (Cara)** | §4.1 *Confirm*; §6.3.4 | **Approved: AUD $15/$150 (GST-inclusive), USD $10/$100 (tax-exclusive), annual = 10× monthly.** Rationale in §3. Sandbox Prices created at these amounts (ST-01). One carry-over for the live catalogue only: confirm A$15 still reads as a clean price against the spot rate on the day the live Prices are created. | live catalogue |
| **ST-D2 — decided 8 Sep 2026** | §4.1 *Confirm*; §5.11 | **No Australian GST registration and no US state registrations at launch.** Therefore `automatic_tax: false`, no tax line on any invoice, and account default tax behaviour set to **Automatic** so no immutable `tax_behavior` is written to a Price (§3). | ST-01, ST-04 |
| **ST-D11 — new; scheduled, not open** | §4.1; §8.1; §8.2 | Two triggers that must be watched rather than discovered. (a) **Australian GST**: registration becomes obligatory at a turnover threshold your adviser will confirm; crossing it cuts AUD revenue by ~9% overnight (§3). (b) **US state sales tax**: economic-nexus thresholds are per state and reach inbound digital services. Stripe's threshold monitoring flags potential obligations but is information, not a determination. Add both to the §8.2 monthly financial review so the flip is planned. | ST-10 |
| **ST-D3 — deferred with ST-D2** | §4.1 | The product tax code, taken from Stripe's Tax Codes API rather than guessed. Digital/SaaS-specific — explicitly **not** the generic electronically-supplied-services code, which is too broad for US state-level taxability. Not needed while `automatic_tax` is off, but required before it is switched on. Route legal correctness to the tax adviser. | ST-D11 |
| **ST-D4 — decided 8 Sep 2026** | §2 *Confirm* (first market); §5.11; A.7 | **Allowlist: Australia and the United States only.** Two currencies (AUD, USD). UK and EU are out of scope at launch, which removes the VAT question entirely rather than deferring it. Enforced by the three-layer gate in §3a, because dropping the currencies is not itself a gate. Opening a further market is a deliberate act requiring its own jurisdiction review. | ST-01, ST-05 |
| **ST-D5** | §5.7 *Confirm* | Approve the retry configuration in §7: Smart Retries maximum duration **2 weeks**, after-retries behaviour **mark as unpaid**, Stripe's own dunning emails **off**. This closes the handbook's open dunning *Confirm* without amending the 14-day figure. | ST-08 |
| **ST-D6** | §5.6 | Confirm the trial expiry notice lead time. Stripe's `trial_will_end` fires at three days; anything else is a scheduled job. | ST-07 |
| **ST-D10 — handbook amendment** | §5.6 failed-payment email | The §5.6 email table implies the card will be retried across the grace period. Stripe does not retry hard declines at all (§7). Reword the failed-payment email to state the suspension date and the update route without promising a retry. | ST-08 |
| **ST-D7** | §4.3 *Confirm* | Refund authority — who may approve a goodwill refund, to what value, recorded where. Until this exists, refunds are Dashboard-only and manual, and no code path issues one. | ST-10 |
| **ST-D8** | §4.1 *Confirm* | "Unlimited guest uploads" on the pricing page against per-gigabyte storage cost. Not a Stripe decision, but it is priced by ST-D1 and stated in the same copy. | ST-04 |
| **ST-D12 — decided 8 Sep 2026 (Cara)** | §6.3.4; §4.1; §4.3 | Two departures from the §6.3.4 wording, both forced, **both approved as written**. (a) The handbook writes **`${Price}`** with a literal `# Stripe integration plan

Created 8 September 2026. Authority: [DigiStayBook Business & Operating Plan](handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html), §4.1, §4.2, §5.1, §5.6, §5.7, §5.10, §6.3.4, §6.3.7. Secondary source: the `stripe-best-practices` skill shipped with the `stripe@claude-plugins-official` plugin (v0.4.1), which carries Stripe's own current guidance.

This is a build plan, not an approval. It does not amend the handbook. Every row in §11 is an owner decision that must be recorded before the corresponding code can go to production. Nothing here has been run against a Stripe account.

**Draft status.** Cross-checked against `stripe_implementation_planner` (Stripe's own MCP planning tool) on 8 September 2026 once the MCP server was authenticated. The planner's recommendations match this design — Stripe-hosted Checkout, free trial with card on file, Customer Portal for payment-method updates, Smart Retries, and free tax threshold monitoring. The one divergence to carry forward is recorded in §11 (ST-D9): flexible billing mode.

**Verification.** Every API parameter, enum value and Dashboard option quoted below was checked against the live Stripe documentation on 8 September 2026 using `stripe docs` (Stripe CLI 1.50.10), not recalled. Where a claim was wrong, it has been corrected in place; §7 in particular now quotes the Dashboard's own three options verbatim.

---

## 1 What the handbook already fixes

These are constraints, not choices. They rule several common Stripe patterns out before any design starts.

| Handbook rule | Consequence for the integration |
|---|---|
| §4.2 "Entitlements change only when a signature-verified Stripe webhook is processed. Nothing in the client grants access." | No client-side fulfilment. The Checkout success redirect writes nothing. `checkout.session.completed` is the only thing that unlocks a wall. |
| §4.1 Billing is per activated property; a host with four properties holds four subscriptions | One Stripe Customer per host, N Subscriptions per host, each carrying `metadata.propertyId`. Not one subscription with quantity 4. |
| §4.1 No feature-gated tier; monthly and annual are the same platform | **One** Product, **two** Prices. Not two Products. |
| §4.1 Prices render in the host's point-of-sale currency (AUD, GBP, EUR, USD), rounded cleanly | `currency_options` on each Price, not four Price objects per interval. |
| §6.3.4 Checkout must show the calculated trial end **date** and a required acknowledgement checkbox with exact wording | The acknowledgement cannot live on Stripe's hosted page. It lives on our activation screen, is recorded, and gates session creation. |
| §5.7 Webhook processing is idempotent; a Stripe retry cannot activate a property twice | Event-id ledger in Firestore, written in the same transaction as the entitlement change. |
| §4.1 A 100% discount code must be able to activate a property in production without taking a real payment | `allow_promotion_codes: true` from day one, even though codes are not marketed. |
| §5.2 A suspended or cancelled property routes to a designed fallback page, never an error | Lifecycle must reach `suspended`/`dormant` reliably, because `getPublicWall` already fails closed on it. |

## 2 What already exists in this repository

The billing surface is further along than the absence of a Stripe SDK suggests.

- [`src/domain/property.ts`](../src/domain/property.ts) — `PropertyLifecycle` with all nine states; `isPubliclyReadable` and `canDownloadQrKit` already gate the wall and the QR kit on lifecycle.
- [`src/domain/billing.ts`](../src/domain/billing.ts) — the lifecycle transition table, keyed by a `BillingEvent` union that reads as a deliberate abstraction over Stripe rather than a copy of it.
- [`src/ui/pages/HostBillingPage.tsx`](../src/ui/pages/HostBillingPage.tsx) — reads `property.billing.{trialEndsAt, currentPeriodEndsAt, lastPaymentAt}` and states plainly that it reports state rather than changing it.
- [`firestore.rules`](../firestore.rules) — a host update may only touch `name`, `profile`, `updatedAt`. `lifecycle` and `billing` are already unwritable from a browser.
- [`functions/src/index.ts`](../functions/src/index.ts) — `onCall`/`onRequest` v2 in `australia-southeast1`, and `moderatePost` establishes the house pattern: a server-owned transition table that does not trust the client-side one.

So the work is not "add billing". It is: fill `property.billing`, drive `property.lifecycle` from Stripe, and build the three host actions the billing page already promises.

## 3 Catalog

One Product. Two recurring Prices. Four currencies per Price.

Launch markets are **Australia and the United States only** (ST-D4). Two currencies, not four. GBP and EUR are deliberately absent — §4 explains why that absence is not by itself a sales gate.

```
Product  prod_… "DigiStayBook"
         tax_code = <confirmed txcd_ — see §11 ST-D3>
  ├─ Price price_monthly  recurring{interval:month}  currency: aud  unit_amount: 1500
  │     currency_options: { usd: { unit_amount: 1000 } }
  └─ Price price_annual   recurring{interval:year}   currency: aud  unit_amount: 15000
        currency_options: { usd: { unit_amount: 10000 } }

No tax_behavior on either Price. See below.
```

### Amounts (ST-D1 — approved 8 Sep 2026, Cara)

Annual is exactly ten times monthly, which is what §4.1's "equivalent to two months free" means arithmetically. All four figures are whole units, as §4.1 requires.

| Currency | Monthly | Annual | Net today (no registrations) | Net once GST-registered |
|---|---|---|---|---|
| AUD | A$15 | A$150 | **A$15.00** | A$13.64 |
| USD | $10 | $100 | **$10.00** | $10.00 (state tax added on top) |

These are **price points, not conversions.** They are anchored on the handbook's USD $10/$100 and rounded to numbers that read as prices rather than as exchange-rate output. Confirm A$15 against the spot rate on the day the Prices are created — the ratio embeds an approximate rate and is not tracked live.

### Tax behaviour: set it on the account, not on the Prices

`tax_behavior` on a Price is **immutable once set** to `inclusive` or `exclusive`. Getting it wrong means creating replacement Prices and migrating every live subscription. There is no need to take that risk.

Stripe supports an account-level **default tax behaviour**, and its **Automatic** setting "selects exclusive pricing for USD and CAD and inclusive pricing for all other currencies" — and explicitly works with multi-currency Prices. That is precisely the split this catalog wants: AUD quoted GST-inclusive per Australian convention, USD quoted tax-exclusive because US state sales tax is added at checkout.

So: **omit `tax_behavior` from both Prices** and set the account default to Automatic (Dashboard → Tax → settings). Prices with no `tax_behavior` inherit the default, and Stripe's documentation states they are then ready for Stripe Tax. The one-way door disappears.

### What "not yet registered" means for revenue

ST-D2 is answered: no Australian GST registration, no US state registrations. Therefore `automatic_tax: { enabled: false }`, no tax line on any invoice, and — because a tax-inclusive price with no applicable tax is simply the price — **A$15 nets the full A$15 today**, not A$13.64.

Two consequences worth carrying into §8.1:

- The A$13.64 figure is not today's number, it is the number **from the day GST registration takes effect**. That is a ~9% revenue step-down on every Australian subscription, arriving at the moment turnover grows past the registration threshold — the moment the business is least able to absorb it. Model it now rather than meeting it. (The threshold is a turnover figure your adviser will confirm; the point is that it is a *when*, not an *if*, for a business that works.)
- Because the flip is planned rather than discovered, it costs nothing at the time: switch `automatic_tax` to `true`, and the account default resolves AUD to inclusive on its own. No new Prices, no migration, no change to the number a host sees.

**Until registration exists, no invoice, receipt or pricing page may show a GST line or imply GST is included.** An unregistered business stating it collects GST is a separate problem from anything in this plan. §6.3.4's approved tax callout is the deductibility wording and is unaffected, but the receipt template in §5.6 needs a check against this before it is built.

## 3a The sales gate

**Dropping GBP and EUR does not stop a UK or EU host buying.** They pay in USD like anyone else. Currency is a display choice; jurisdiction is a separate control, and Stripe Checkout does not provide one — `allowed_countries` exists only under `shipping_address_collection`, which a digital subscription never uses. The gate has to be built.

Three layers, because no single one is sufficient:

1. **Declared country, before the session exists.** The activation screen (§4) already collects an acknowledgement; it also collects the host's country and stores it as `hosts/{uid}.billingCountry`. A country outside the allowlist sees "not available in your country yet" and **no Checkout Session is created**. This is the layer that does the real work, because it is the only one that acts before the host has spent any effort.
2. **Verified country, at the webhook.** Set `billing_address_collection: "required"` so Stripe captures a real billing country, and compare `customer.address.country` to the declared value before granting entitlement. A mismatch outside the allowlist does not activate the property; during a trial nothing has been charged, so cancelling the subscription costs the host nothing and refunds nothing.
3. **Radar, as a backstop on the first charge.** `Block if :card_country: != 'au' AND :card_country: != 'us'`. Radar has no `NOT IN` operator, so an allowlist is written as chained `!=`, and the country list should be held in a Radar value list so the rule does not need editing when a market opens.

**Layer 3 fires late, and that is why layers 1 and 2 matter.** With a 28-day trial there is no charge at activation, so Radar sees nothing until day 28. A UK host who slipped past layer 1 would set up a property, print a placard, hang it in their kitchen, and be blocked four weeks later at the first charge. That is precisely the §4.3 failure the handbook cares about — a broken experience in front of a guest — so the gate must hold at layer 1.

The country is the **host's**, not the property's. `profile.location` is public display text ("Byron Bay, NSW"), not a structured field, and a host can live in one country and own a property in another. The tax treatment of a B2C digital subscription follows the customer, so the host's billing country is the one that governs both the gate and the tax.

Rationale for one Product: Stripe's guidance is to create one Product per *tier a customer chooses between*, and to attach multiple Prices to one Product for *billing variants of the same plan — monthly versus annual, or different currencies*. §4.1 states there is no feature-gated tier, so monthly/annual is exactly the billing-variant case. Two Products would put two different names on invoices for an identical service.

Price IDs are configuration, never literals in application code. They are **not** secrets, so they are `defineString` params rather than Secret Manager entries — Firebase keeps params in a per-project `.env.<project>` file, which already makes it impossible to point a test deployment at the live catalogue, without paying Secret Manager's per-version cost for a public identifier.

### Two API-shape traps, found while building

Both would have compiled and then quietly written `null` for the life of the integration.

- **`current_period_end` is no longer on the Subscription object.** It lives on each subscription item (`subscription.items.data[].current_period_end`). Reading the old location yields `undefined`, so `currentPeriodEndsAt` and `serviceEndsAt` would both be empty — meaning a cancelled property would have no end date to show the host, which §4.3 requires. `periodEndOf()` in `functions/src/stripeWebhook.ts` takes the earliest item end, so an unexpected second item shortens service rather than silently extending it.
- **`invoice.subscription` is gone.** The link moved to `invoice.parent.subscription_details.subscription`. Reading the old field would orphan every `invoice.paid` and `invoice.payment_failed` event — the wall would activate but never record a payment, and a failed payment would never open grace.

**Do not** use the deprecated `plan` object. **Do not** pass `payment_method_types` anywhere — omitting it is what enables dynamic payment methods, and hardcoding `['card']` would suppress local methods that matter in three of the four target currencies.

## 4 Activation: the pre-checkout screen

§6.3.4 requires the exact trial end date and a ticked acknowledgement *before* payment details are collected. Stripe's hosted page cannot render that checkbox with our wording, so the order is:

1. **Our screen** computes `trialEndsAt` and renders the monthly or annual microcopy from §6.3.4 verbatim, with `{Trial_End_Date}` and `{Price}` substituted, plus the required checkbox: *"I understand I will be billed ${Price} on {Date} if I do not cancel."*
2. Host ticks and submits. A callable records a **billing acknowledgement event** — wording, wording version, timestamp, price, currency, computed trial end — on the property, mirroring the versioned consent-event pattern already used for guest consent (§5.3) and marketing consent (§5.1).
3. Only then does the callable create the Checkout Session and return `session.url`.

**The trial end date must be passed to Stripe, not merely described to it.** Pass `subscription_data.trial_end` as the explicit unix timestamp we displayed, not `trial_period_days: 28`. `trial_period_days` is resolved by Stripe at session completion; if the host leaves the tab open overnight, the date on the receipt stops matching the date they acknowledged — which §4.3 ("marketing, checkout, dashboard entitlements and the customer policies describe the same offer, in the same words") does not permit. Give the session a short `expires_at` for the same reason.

`trial_end` must be **at least 48 hours in the future**. A 28-day trial clears that comfortably, but it rules out using a near-zero trial as an internal test shortcut — use the 100% promotion code path for that instead (§4.1).

### Checkout Session

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: hostStripeCustomerId,
  client_reference_id: propertyId,
  // No payment_method_types — dynamic payment methods are configured in the Dashboard.
  line_items: [{ price: priceId, quantity: 1 }],
  allow_promotion_codes: true,                 // §4.1: the 100% internal-verification code
  payment_method_collection: "always",         // §4.1: a valid payment method is required to start a trial
  billing_address_collection: "required",      // §3a layer 2: a real country to verify against
  subscription_data: {
    trial_end: acknowledgedTrialEndUnix,       // the date the host actually acknowledged
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { propertyId, ownerUid }
  },
  metadata: { propertyId, ownerUid, acknowledgementId },
  automatic_tax: { enabled: false },           // ST-D2: no registrations at launch. Revisit at ST-D11.
  integration_identifier: "dsb-activate-<8 random letters>",
  success_url: `${appUrl}/host/property/${propertyId}/billing?activating=1`,
  cancel_url:  `${appUrl}/host/property/${propertyId}/billing`
}, { idempotencyKey: `activate:${propertyId}:${acknowledgementId}` });
```

`success_url` deliberately does **not** carry `{CHECKOUT_SESSION_ID}` for fulfilment purposes. It lands on the billing page in an "activating" state that watches the property document. The wall unlocks when the webhook says so, not when the browser returns — §4.2.

### Trial eligibility

§4.1: the trial is available on the **first activated property only**. That is a host-level fact, so it belongs on the host document, not the property:

- `hosts/{uid}.trialConsumedAt` is set inside the same transaction that first grants an entitlement.
- The activation callable reads it and omits `trial_end` entirely for every subsequent property, and the pre-checkout screen renders the no-trial variant of the copy — charged today, at this price.
- Because the check is server-side and transactional, two properties activated in parallel cannot both take the trial.

## 5 Webhook endpoint

A single `onRequest` function, `stripeWebhook`, in `australia-southeast1`.

```ts
const event = stripe.webhooks.constructEvent(
  req.rawBody, req.headers["stripe-signature"], webhookSecret
);
```

`req.rawBody` is required — Firebase Functions v2 provides it, but any body-parsing middleware inserted ahead of it will silently break signature verification.

### Idempotency and ordering

Two distinct problems, and they need two mechanisms.

**Idempotency** (§5.7, "a Stripe retry cannot activate a property twice"): a Firestore transaction creates `stripeEvents/{event.id}` and applies the entitlement change together. If the document already exists, the transaction aborts and the endpoint returns 200 without re-applying. The ledger document holds only the event id, type, `created`, the property it touched and the resulting lifecycle — no payload, no personal information.

**Ordering**: Stripe does not guarantee delivery order, so a stale `customer.subscription.updated` can arrive after a newer one. Two guards:

- Store `property.billing.lastEventCreated`; discard any subscription-scoped event with an older `event.created`.
- For every `customer.subscription.*` event, treat the payload as a *trigger* and re-read the subscription from the API before writing. The subscription object is the source of truth for `status`, `current_period_end` and `trial_end`; the event payload is only a snapshot of when it was queued.

Return 200 for anything we do not handle, and for anything already in the ledger. Return 500 only for genuine transient failures, so Stripe's retry is doing useful work rather than replaying a permanent error.

Allowlist [Stripe's published IP ranges](https://docs.stripe.com/ips) on the endpoint as defence in depth. Signature verification is the control; the allowlist is the belt.

### Events consumed

| Event | Firestore effect | `BillingEvent` |
|---|---|---|
| `checkout.session.completed` | Bind `stripeCustomerId`/`stripeSubscriptionId` to the property; set `trialConsumedAt` if a trial was granted; unlock routing URL + QR kit | `trial_started` |
| `customer.subscription.updated` | Re-read subscription; map status (§6); write `currentPeriodEndsAt`, `trialEndsAt`, `cancelAtPeriodEnd` | per §6 |
| `customer.subscription.deleted` | End of the paid cycle after cancellation, or terminal dunning failure | `period_ended` |
| `invoice.paid` | `lastPaymentAt`; clear grace deadline | `invoice_paid` |
| `invoice.payment_failed` | Open the 14-day grace window; record `suspendAt`; queue the §5.6 failed-payment email | `payment_failed` |
| `customer.subscription.trial_will_end` | Queue the §5.6 trial expiry notice — but see §7 | — |
| `charge.dispute.created`, `charge.refunded` | Record for the §5.7 monthly reconciliation. No automatic entitlement change; §4.3 puts refund authority with a named owner | — |

## 6 Stripe status → `PropertyLifecycle`

This mapping is the whole integration in one table.

| Stripe subscription `status` | `PropertyLifecycle` | Wall served? | QR kit? |
|---|---|---|---|
| `trialing` | `trialing` | yes | yes |
| `active` | `active` | yes | yes |
| `past_due` | `grace_period` | **yes** — §5.7: the wall stays fully live while the card is retried | yes |
| `unpaid` | `suspended` | no — fallback page | no |
| `canceled` | `cancelled_pending_end`, then `dormant` at period end | until `serviceEndsAt` | until `serviceEndsAt` |
| `incomplete`, `incomplete_expired` | stays `draft` | no | no |

`isPubliclyReadable` in `src/domain/property.ts` already serves `trialing`, `active` and `grace_period` and refuses `suspended` — the mapping above was chosen to fit the code that exists rather than the other way round.

**One-click cancellation** (§4.3, "effective at the end of the paid cycle") is `subscriptions.update(id, { cancel_at_period_end: true })`. That leaves `status: 'active'` with `cancel_at_period_end: true`, which is *not* a status change. Stripe sends a plain `customer.subscription.updated` — the same event as any other edit — so the lifecycle move to `cancelled_pending_end` must key off the flag, not the status. Missing this is the most likely single bug in this build: the host clicks cancel, gets a confirmation, and the dashboard goes on saying "Active" until the period ends.

The reverse is also true and worth building now: setting `cancel_at_period_end` back to `false` reinstates the subscription at any point before the period ends. That is the cheapest possible win-back, and it maps to the `reactivated` event already in `src/domain/billing.ts`.

## 7 Resolving the handbook's two flagged conflicts

§5.7 and §5.6 each carry a *Confirm* that this design can answer concretely.

**Dunning (§5.7).** The handbook describes one 14-day grace period; Stripe's Smart Retries will independently attempt the card several times inside that window. They do not conflict if the Dashboard is configured to match. All three settings live under **Billing → Revenue recovery → Retries**:

- **Maximum duration: 2 weeks.** Smart Retries does not take an arbitrary number of days — the menu is 1 week, 2 weeks, 3 weeks, 1 month or 2 months. Two weeks lands exactly on the handbook's 14 days, which is why the handbook's figure needs no amendment. (A custom retry schedule is the alternative: up to three retries, each a chosen number of days after the previous attempt.)
- **After the final attempt: "Mark the subscription as unpaid."** The Dashboard offers exactly three behaviours — cancel the subscription, mark it unpaid, or leave it overdue in `past_due`. `unpaid` maps to `suspended` and keeps the subscription reactivatable, which §5.7 requires; `canceled` would destroy it and force a new checkout on a host whose card merely expired; leaving it `past_due` would keep the wall live indefinitely without payment, which §5.7 forbids. Under `unpaid`, Stripe keeps generating invoices in `draft` — harmless, and useful for the §5.7 monthly reconciliation.
- Turn **off** Stripe's own automatic dunning emails (**Billing → Revenue recovery → Customer emails**). §5.6 owns that sequence, and two differently-worded failure emails from the same company is exactly the §4.3 consistency failure.

**A hard decline is not retried, and this changes the §5.6 copy.** Where the issuer returns a hard decline code, Stripe schedules the retries but does not execute them: the counter increments, no charge is attempted, and nothing happens until a new payment method is attached. So the failed-payment email must not say the card will be tried again — it must state the suspension date and drive the host to the update route. Wording that promises retries would be false for a materially large share of failures. This is an amendment the §5.6 email table needs before it is written.

**The 14-day annual renewal notice (§5.6).** Do not build this on `invoice.upcoming`. That webhook fires on an account-wide "upcoming invoice" setting shared with the monthly plan — a 14-day lead would send monthly hosts a renewal notice halfway through every cycle. Schedule the notice from `property.billing.currentPeriodEndsAt` with a Cloud Scheduler job, filtered to annual subscriptions. The same reasoning applies to the trial expiry notice: `customer.subscription.trial_will_end` fires at three days, and if §5.6 wants a different lead time, schedule it rather than bend the notice to Stripe's clock.

## 8 Payment-method updates and cancellation

§4.3 is emphatic that cancellation is self-service in the dashboard **and nowhere else**, and §5.7 requires the exact end date confirmed by email. That splits the two flows:

- **Payment method update** — Customer Portal, launched from our billing page and from the §5.6 failed-payment email, created with `flow_data: { type: "payment_method_update" }` so the host lands directly on the card form. This is the "secure update route" §5.7 asks for: the link is a short-lived server-created session, so the email carries no credential.
- **Cancellation** — our own callable, not the portal. We must render the exact end date, confirm it by email, and state what happens to the content afterwards (§4.3). A portal cancel flow would hand that copy to Stripe.

Portal configuration must have plan-switching **disabled**. Monthly↔annual movement mid-cycle would create prorations the handbook has no policy for.

## 9 Keys, secrets and client surface

- **Restricted API key (`rk_`), not a secret key.** Permissions needed: Checkout Sessions `write`, Customers `write`, Subscriptions `write`, Billing Portal Sessions `write`, Prices `read`, Products `read`, Promotion Codes `read`, Invoices `read`, Disputes `read`. Nothing else — no Charges write, no Payouts, no Tax registrations write.
- **Storage: Google Secret Manager**, reached through `defineSecret()` in Firebase Functions, which is Secret Manager underneath. The current `functions/.env.example` placeholders (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) should become `defineSecret("STRIPE_RESTRICTED_KEY")` and `defineSecret("STRIPE_WEBHOOK_SECRET")` before any live key exists, so there is never a moment where the committed pattern is an env file.
- **Separate keys and separate webhook secrets per environment.** The isolated preview project referenced in GC-04 gets its own sandbox.
- **`VITE_STRIPE_PUBLISHABLE_KEY` in `.env.example` should be removed.** With hosted Checkout we redirect to `session.url` and never load Stripe.js, so there is no publishable key, no Stripe.js in the bundle, and no Stripe CSP directives to add to `index.html`. If embedded Checkout is ever adopted, the key and `script-src`/`frame-src`/`connect-src https://*.stripe.com` come back together.
- **Pre-commit hook** matching `/[sr]k_(live|test)_/` across the tree, alongside the existing checks.
- No key, customer id or subscription id is ever returned to the browser. The billing page reads `property.billing`, which holds dates and state only.

## 10 Build order

Each item is independently provable in the Stripe CLI and the emulator before the next starts.

| ID | Work | Proof |
|---|---|---|
| ST-00 | Stripe CLI on PATH — **done**, v1.50.10 via `npm i -g @stripe/cli` | `stripe docs` and `stripe --version` respond |
| ST-03/04/05 | **Server written 8 Sep 2026; client activation screen added 8 Sep 2026.** `billingPolicy.ts` (versioned §6.3.4 copy, deterministic price and date rendering) + 14 unit tests; `stripeActivation.ts` — `activationOptions` (country gate, trial eligibility, live price quote, both disclosure variants) and `createActivationCheckout` (acknowledgement record, idempotent Customer creation, session with explicit `trial_end`). Client: `src/ui/host/billingStore.ts` (callable wrappers) and `ActivatePanel` inside `HostBillingPage` — a draft property's billing screen establishes the billing country (§3a layer 1) by guessing it from the browser's locale and time zone (`billingCountry.ts`, one click to overrule, and the question is still asked outright when the browser names neither served country), quotes the plan, renders the server's disclosure + acknowledgement checkbox verbatim, and on a ticked box redirects to `session.url`; the return from Stripe watches the property document rather than trusting the redirect. `createActivationCheckout` now persists `hosts/{uid}.billingCountry` on commitment. **Not yet done:** the activation callables have no unit tests (ST-05 emulator pass); end-to-end run needs the sandbox key + emulator. | `npm run check` green (334 tests); browser proof pending the restricted key |
| ST-02a | **Done 8 Sep 2026.** `stripeBilling.ts` (§6 mapping, sales allowlist, handled-event list) + 15 unit tests; `stripeConfig.ts` (Secret Manager binding, lazy client); `stripeWebhook.ts` (signature verification, event ledger, entitlement transaction); `hosts`/`stripeEvents` denied in `firestore.rules` + 3 rules tests; env examples corrected | `npm run check` green (307 tests); `npm run test:emulators` green (35 tests) |
| ST-01 | **Sandbox catalogue done 8 Sep 2026** in `DigiStayBook sandbox` (`acct_1UDAcoE6RXRx7LYa`). Account default tax behaviour set to **Automatic** (`inferred_by_currency`). One Product `prod_VDgefH6xk8OXHp` "DigiStayBook". `price_1UDFHNE6RXRx7LYaR5bQPPOg` monthly (AUD 1500 / USD 1000, lookup `dsb_monthly`) and `price_1UDFHSE6RXRx7LYavuue90cL` annual (AUD 15000 / USD 10000, lookup `dsb_annual`), both `tax_behavior` unset. Price ids in `functions/.env.digistaybook-cbert` (not secrets, per §9). Amounts approved (ST-D1). **Still open:** restricted key + webhook secret into Secret Manager; live-mode catalogue. | `stripe prices retrieve` shows AUD and USD on both prices, `tax_behavior` unset — **verified** |
| ST-02 | `stripeWebhook` skeleton: signature verification, event ledger, 200/500 discipline. No entitlement writes yet. | `stripe trigger` replayed twice writes one ledger row |
| ST-03 | Host↔Customer binding; `hosts/{uid}.stripeCustomerId`, created lazily and idempotently | Two parallel activations create one Customer |
| ST-04 | Billing acknowledgement event and pre-checkout screen with §6.3.4 copy, both variants, plus the §3a layer-1 country gate and `hosts/{uid}.billingCountry` | Wording and version stored; an unticked box cannot create a session; a GB host is refused before any session exists |
| ST-05 | `createActivationCheckout` callable with `trial_end`, trial-eligibility transaction, promotion codes, `billing_address_collection` | Second property gets no trial; a 100% code activates with no charge |
| ST-06 | Entitlement fulfilment: `checkout.session.completed` → lifecycle, routing URL, QR kit unlock, plus the §3a layer-2 country check | Wall reachable only after the webhook, never after the redirect; a mismatched billing country does not activate |
| ST-06a | Radar allowlist rule and value list (§3a layer 3) | A non-AU/US card is declined on the first charge |
| ST-07 | Full status mapping (§6) including the `cancel_at_period_end` trap; `invoice.paid`, `invoice.payment_failed` | `stripe trigger` for each status lands the right lifecycle |
| ST-08 | Dunning configuration, grace deadline and suspension; fallback page verified end to end | Card decline → wall stays live → day 14 → fallback page, no 404 |
| ST-09 | **Cancel done 10 Sep 2026.** `stripeCancellation.ts` — `cancelSubscription` sets `cancel_at_period_end` and returns the exact end date for the confirmation screen; `resumeSubscription` clears it while the period still runs; both record to `properties/{id}/billingActions` and neither writes `lifecycle` (the webhook does). Client: the cancel and undo controls on `HostBillingPage`, plus the next-charge sentence the screen never had. 14 unit tests. **Not yet done:** the portal payment-method-update flow, and the confirmation email — there is no mail transport in `functions/` at all, so the exact date is stated on screen only. | Cancel leaves the wall live to `serviceEndsAt` — **verified in unit tests**; email states the date — **not built** |
| ST-10 | Reconciliation export for the §5.7 monthly review; dispute and refund recording | Stripe subscription states match Firestore for every property |

ST-01 through ST-03 are safe to build against a sandbox before any of the §11 decisions land. ST-D1, ST-D2 and ST-D12 — the price, the tax treatment and the acknowledgement wording the host is asked to accept — are now all decided, so ST-04 and ST-05 are unblocked against the sandbox.

## 11 Open decisions

Owner decisions, in the handbook's own register format. None of these are engineering calls.

| ID / status | Handbook reference | Decision required | Blocks |
|---|---|---|---|
| **ST-D1 — decided 8 Sep 2026 (Cara)** | §4.1 *Confirm*; §6.3.4 | **Approved: AUD $15/$150 (GST-inclusive), USD $10/$100 (tax-exclusive), annual = 10× monthly.** Rationale in §3. Sandbox Prices created at these amounts (ST-01). One carry-over for the live catalogue only: confirm A$15 still reads as a clean price against the spot rate on the day the live Prices are created. | live catalogue |
| **ST-D2 — decided 8 Sep 2026** | §4.1 *Confirm*; §5.11 | **No Australian GST registration and no US state registrations at launch.** Therefore `automatic_tax: false`, no tax line on any invoice, and account default tax behaviour set to **Automatic** so no immutable `tax_behavior` is written to a Price (§3). | ST-01, ST-04 |
| **ST-D11 — new; scheduled, not open** | §4.1; §8.1; §8.2 | Two triggers that must be watched rather than discovered. (a) **Australian GST**: registration becomes obligatory at a turnover threshold your adviser will confirm; crossing it cuts AUD revenue by ~9% overnight (§3). (b) **US state sales tax**: economic-nexus thresholds are per state and reach inbound digital services. Stripe's threshold monitoring flags potential obligations but is information, not a determination. Add both to the §8.2 monthly financial review so the flip is planned. | ST-10 |
| **ST-D3 — deferred with ST-D2** | §4.1 | The product tax code, taken from Stripe's Tax Codes API rather than guessed. Digital/SaaS-specific — explicitly **not** the generic electronically-supplied-services code, which is too broad for US state-level taxability. Not needed while `automatic_tax` is off, but required before it is switched on. Route legal correctness to the tax adviser. | ST-D11 |
| **ST-D4 — decided 8 Sep 2026** | §2 *Confirm* (first market); §5.11; A.7 | **Allowlist: Australia and the United States only.** Two currencies (AUD, USD). UK and EU are out of scope at launch, which removes the VAT question entirely rather than deferring it. Enforced by the three-layer gate in §3a, because dropping the currencies is not itself a gate. Opening a further market is a deliberate act requiring its own jurisdiction review. | ST-01, ST-05 |
| **ST-D5** | §5.7 *Confirm* | Approve the retry configuration in §7: Smart Retries maximum duration **2 weeks**, after-retries behaviour **mark as unpaid**, Stripe's own dunning emails **off**. This closes the handbook's open dunning *Confirm* without amending the 14-day figure. | ST-08 |
| **ST-D6** | §5.6 | Confirm the trial expiry notice lead time. Stripe's `trial_will_end` fires at three days; anything else is a scheduled job. | ST-07 |
| **ST-D10 — handbook amendment** | §5.6 failed-payment email | The §5.6 email table implies the card will be retried across the grace period. Stripe does not retry hard declines at all (§7). Reword the failed-payment email to state the suspension date and the update route without promising a retry. | ST-08 |
| **ST-D7** | §4.3 *Confirm* | Refund authority — who may approve a goodwill refund, to what value, recorded where. Until this exists, refunds are Dashboard-only and manual, and no code path issues one. | ST-10 |
| **ST-D8** | §4.1 *Confirm* | "Unlimited guest uploads" on the pricing page against per-gigabyte storage cost. Not a Stripe decision, but it is priced by ST-D1 and stated in the same copy. | ST-04 |
, but `{Price}` is substituted with an already-formatted amount — following it exactly renders "$A$15.00". The `# Stripe integration plan

Created 8 September 2026. Authority: [DigiStayBook Business & Operating Plan](handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html), §4.1, §4.2, §5.1, §5.6, §5.7, §5.10, §6.3.4, §6.3.7. Secondary source: the `stripe-best-practices` skill shipped with the `stripe@claude-plugins-official` plugin (v0.4.1), which carries Stripe's own current guidance.

This is a build plan, not an approval. It does not amend the handbook. Every row in §11 is an owner decision that must be recorded before the corresponding code can go to production. Nothing here has been run against a Stripe account.

**Draft status.** Cross-checked against `stripe_implementation_planner` (Stripe's own MCP planning tool) on 8 September 2026 once the MCP server was authenticated. The planner's recommendations match this design — Stripe-hosted Checkout, free trial with card on file, Customer Portal for payment-method updates, Smart Retries, and free tax threshold monitoring. The one divergence to carry forward is recorded in §11 (ST-D9): flexible billing mode.

**Verification.** Every API parameter, enum value and Dashboard option quoted below was checked against the live Stripe documentation on 8 September 2026 using `stripe docs` (Stripe CLI 1.50.10), not recalled. Where a claim was wrong, it has been corrected in place; §7 in particular now quotes the Dashboard's own three options verbatim.

---

## 1 What the handbook already fixes

These are constraints, not choices. They rule several common Stripe patterns out before any design starts.

| Handbook rule | Consequence for the integration |
|---|---|
| §4.2 "Entitlements change only when a signature-verified Stripe webhook is processed. Nothing in the client grants access." | No client-side fulfilment. The Checkout success redirect writes nothing. `checkout.session.completed` is the only thing that unlocks a wall. |
| §4.1 Billing is per activated property; a host with four properties holds four subscriptions | One Stripe Customer per host, N Subscriptions per host, each carrying `metadata.propertyId`. Not one subscription with quantity 4. |
| §4.1 No feature-gated tier; monthly and annual are the same platform | **One** Product, **two** Prices. Not two Products. |
| §4.1 Prices render in the host's point-of-sale currency (AUD, GBP, EUR, USD), rounded cleanly | `currency_options` on each Price, not four Price objects per interval. |
| §6.3.4 Checkout must show the calculated trial end **date** and a required acknowledgement checkbox with exact wording | The acknowledgement cannot live on Stripe's hosted page. It lives on our activation screen, is recorded, and gates session creation. |
| §5.7 Webhook processing is idempotent; a Stripe retry cannot activate a property twice | Event-id ledger in Firestore, written in the same transaction as the entitlement change. |
| §4.1 A 100% discount code must be able to activate a property in production without taking a real payment | `allow_promotion_codes: true` from day one, even though codes are not marketed. |
| §5.2 A suspended or cancelled property routes to a designed fallback page, never an error | Lifecycle must reach `suspended`/`dormant` reliably, because `getPublicWall` already fails closed on it. |

## 2 What already exists in this repository

The billing surface is further along than the absence of a Stripe SDK suggests.

- [`src/domain/property.ts`](../src/domain/property.ts) — `PropertyLifecycle` with all nine states; `isPubliclyReadable` and `canDownloadQrKit` already gate the wall and the QR kit on lifecycle.
- [`src/domain/billing.ts`](../src/domain/billing.ts) — the lifecycle transition table, keyed by a `BillingEvent` union that reads as a deliberate abstraction over Stripe rather than a copy of it.
- [`src/ui/pages/HostBillingPage.tsx`](../src/ui/pages/HostBillingPage.tsx) — reads `property.billing.{trialEndsAt, currentPeriodEndsAt, lastPaymentAt}` and states plainly that it reports state rather than changing it.
- [`firestore.rules`](../firestore.rules) — a host update may only touch `name`, `profile`, `updatedAt`. `lifecycle` and `billing` are already unwritable from a browser.
- [`functions/src/index.ts`](../functions/src/index.ts) — `onCall`/`onRequest` v2 in `australia-southeast1`, and `moderatePost` establishes the house pattern: a server-owned transition table that does not trust the client-side one.

So the work is not "add billing". It is: fill `property.billing`, drive `property.lifecycle` from Stripe, and build the three host actions the billing page already promises.

## 3 Catalog

One Product. Two recurring Prices. Four currencies per Price.

Launch markets are **Australia and the United States only** (ST-D4). Two currencies, not four. GBP and EUR are deliberately absent — §4 explains why that absence is not by itself a sales gate.

```
Product  prod_… "DigiStayBook"
         tax_code = <confirmed txcd_ — see §11 ST-D3>
  ├─ Price price_monthly  recurring{interval:month}  currency: aud  unit_amount: 1500
  │     currency_options: { usd: { unit_amount: 1000 } }
  └─ Price price_annual   recurring{interval:year}   currency: aud  unit_amount: 15000
        currency_options: { usd: { unit_amount: 10000 } }

No tax_behavior on either Price. See below.
```

### Amounts (ST-D1 — approved 8 Sep 2026, Cara)

Annual is exactly ten times monthly, which is what §4.1's "equivalent to two months free" means arithmetically. All four figures are whole units, as §4.1 requires.

| Currency | Monthly | Annual | Net today (no registrations) | Net once GST-registered |
|---|---|---|---|---|
| AUD | A$15 | A$150 | **A$15.00** | A$13.64 |
| USD | $10 | $100 | **$10.00** | $10.00 (state tax added on top) |

These are **price points, not conversions.** They are anchored on the handbook's USD $10/$100 and rounded to numbers that read as prices rather than as exchange-rate output. Confirm A$15 against the spot rate on the day the Prices are created — the ratio embeds an approximate rate and is not tracked live.

### Tax behaviour: set it on the account, not on the Prices

`tax_behavior` on a Price is **immutable once set** to `inclusive` or `exclusive`. Getting it wrong means creating replacement Prices and migrating every live subscription. There is no need to take that risk.

Stripe supports an account-level **default tax behaviour**, and its **Automatic** setting "selects exclusive pricing for USD and CAD and inclusive pricing for all other currencies" — and explicitly works with multi-currency Prices. That is precisely the split this catalog wants: AUD quoted GST-inclusive per Australian convention, USD quoted tax-exclusive because US state sales tax is added at checkout.

So: **omit `tax_behavior` from both Prices** and set the account default to Automatic (Dashboard → Tax → settings). Prices with no `tax_behavior` inherit the default, and Stripe's documentation states they are then ready for Stripe Tax. The one-way door disappears.

### What "not yet registered" means for revenue

ST-D2 is answered: no Australian GST registration, no US state registrations. Therefore `automatic_tax: { enabled: false }`, no tax line on any invoice, and — because a tax-inclusive price with no applicable tax is simply the price — **A$15 nets the full A$15 today**, not A$13.64.

Two consequences worth carrying into §8.1:

- The A$13.64 figure is not today's number, it is the number **from the day GST registration takes effect**. That is a ~9% revenue step-down on every Australian subscription, arriving at the moment turnover grows past the registration threshold — the moment the business is least able to absorb it. Model it now rather than meeting it. (The threshold is a turnover figure your adviser will confirm; the point is that it is a *when*, not an *if*, for a business that works.)
- Because the flip is planned rather than discovered, it costs nothing at the time: switch `automatic_tax` to `true`, and the account default resolves AUD to inclusive on its own. No new Prices, no migration, no change to the number a host sees.

**Until registration exists, no invoice, receipt or pricing page may show a GST line or imply GST is included.** An unregistered business stating it collects GST is a separate problem from anything in this plan. §6.3.4's approved tax callout is the deductibility wording and is unaffected, but the receipt template in §5.6 needs a check against this before it is built.

## 3a The sales gate

**Dropping GBP and EUR does not stop a UK or EU host buying.** They pay in USD like anyone else. Currency is a display choice; jurisdiction is a separate control, and Stripe Checkout does not provide one — `allowed_countries` exists only under `shipping_address_collection`, which a digital subscription never uses. The gate has to be built.

Three layers, because no single one is sufficient:

1. **Declared country, before the session exists.** The activation screen (§4) already collects an acknowledgement; it also collects the host's country and stores it as `hosts/{uid}.billingCountry`. A country outside the allowlist sees "not available in your country yet" and **no Checkout Session is created**. This is the layer that does the real work, because it is the only one that acts before the host has spent any effort.
2. **Verified country, at the webhook.** Set `billing_address_collection: "required"` so Stripe captures a real billing country, and compare `customer.address.country` to the declared value before granting entitlement. A mismatch outside the allowlist does not activate the property; during a trial nothing has been charged, so cancelling the subscription costs the host nothing and refunds nothing.
3. **Radar, as a backstop on the first charge.** `Block if :card_country: != 'au' AND :card_country: != 'us'`. Radar has no `NOT IN` operator, so an allowlist is written as chained `!=`, and the country list should be held in a Radar value list so the rule does not need editing when a market opens.

**Layer 3 fires late, and that is why layers 1 and 2 matter.** With a 28-day trial there is no charge at activation, so Radar sees nothing until day 28. A UK host who slipped past layer 1 would set up a property, print a placard, hang it in their kitchen, and be blocked four weeks later at the first charge. That is precisely the §4.3 failure the handbook cares about — a broken experience in front of a guest — so the gate must hold at layer 1.

The country is the **host's**, not the property's. `profile.location` is public display text ("Byron Bay, NSW"), not a structured field, and a host can live in one country and own a property in another. The tax treatment of a B2C digital subscription follows the customer, so the host's billing country is the one that governs both the gate and the tax.

Rationale for one Product: Stripe's guidance is to create one Product per *tier a customer chooses between*, and to attach multiple Prices to one Product for *billing variants of the same plan — monthly versus annual, or different currencies*. §4.1 states there is no feature-gated tier, so monthly/annual is exactly the billing-variant case. Two Products would put two different names on invoices for an identical service.

Price IDs are configuration, never literals in application code. They are **not** secrets, so they are `defineString` params rather than Secret Manager entries — Firebase keeps params in a per-project `.env.<project>` file, which already makes it impossible to point a test deployment at the live catalogue, without paying Secret Manager's per-version cost for a public identifier.

### Two API-shape traps, found while building

Both would have compiled and then quietly written `null` for the life of the integration.

- **`current_period_end` is no longer on the Subscription object.** It lives on each subscription item (`subscription.items.data[].current_period_end`). Reading the old location yields `undefined`, so `currentPeriodEndsAt` and `serviceEndsAt` would both be empty — meaning a cancelled property would have no end date to show the host, which §4.3 requires. `periodEndOf()` in `functions/src/stripeWebhook.ts` takes the earliest item end, so an unexpected second item shortens service rather than silently extending it.
- **`invoice.subscription` is gone.** The link moved to `invoice.parent.subscription_details.subscription`. Reading the old field would orphan every `invoice.paid` and `invoice.payment_failed` event — the wall would activate but never record a payment, and a failed payment would never open grace.

**Do not** use the deprecated `plan` object. **Do not** pass `payment_method_types` anywhere — omitting it is what enables dynamic payment methods, and hardcoding `['card']` would suppress local methods that matter in three of the four target currencies.

## 4 Activation: the pre-checkout screen

§6.3.4 requires the exact trial end date and a ticked acknowledgement *before* payment details are collected. Stripe's hosted page cannot render that checkbox with our wording, so the order is:

1. **Our screen** computes `trialEndsAt` and renders the monthly or annual microcopy from §6.3.4 verbatim, with `{Trial_End_Date}` and `{Price}` substituted, plus the required checkbox: *"I understand I will be billed ${Price} on {Date} if I do not cancel."*
2. Host ticks and submits. A callable records a **billing acknowledgement event** — wording, wording version, timestamp, price, currency, computed trial end — on the property, mirroring the versioned consent-event pattern already used for guest consent (§5.3) and marketing consent (§5.1).
3. Only then does the callable create the Checkout Session and return `session.url`.

**The trial end date must be passed to Stripe, not merely described to it.** Pass `subscription_data.trial_end` as the explicit unix timestamp we displayed, not `trial_period_days: 28`. `trial_period_days` is resolved by Stripe at session completion; if the host leaves the tab open overnight, the date on the receipt stops matching the date they acknowledged — which §4.3 ("marketing, checkout, dashboard entitlements and the customer policies describe the same offer, in the same words") does not permit. Give the session a short `expires_at` for the same reason.

`trial_end` must be **at least 48 hours in the future**. A 28-day trial clears that comfortably, but it rules out using a near-zero trial as an internal test shortcut — use the 100% promotion code path for that instead (§4.1).

### Checkout Session

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: hostStripeCustomerId,
  client_reference_id: propertyId,
  // No payment_method_types — dynamic payment methods are configured in the Dashboard.
  line_items: [{ price: priceId, quantity: 1 }],
  allow_promotion_codes: true,                 // §4.1: the 100% internal-verification code
  payment_method_collection: "always",         // §4.1: a valid payment method is required to start a trial
  billing_address_collection: "required",      // §3a layer 2: a real country to verify against
  subscription_data: {
    trial_end: acknowledgedTrialEndUnix,       // the date the host actually acknowledged
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { propertyId, ownerUid }
  },
  metadata: { propertyId, ownerUid, acknowledgementId },
  automatic_tax: { enabled: false },           // ST-D2: no registrations at launch. Revisit at ST-D11.
  integration_identifier: "dsb-activate-<8 random letters>",
  success_url: `${appUrl}/host/property/${propertyId}/billing?activating=1`,
  cancel_url:  `${appUrl}/host/property/${propertyId}/billing`
}, { idempotencyKey: `activate:${propertyId}:${acknowledgementId}` });
```

`success_url` deliberately does **not** carry `{CHECKOUT_SESSION_ID}` for fulfilment purposes. It lands on the billing page in an "activating" state that watches the property document. The wall unlocks when the webhook says so, not when the browser returns — §4.2.

### Trial eligibility

§4.1: the trial is available on the **first activated property only**. That is a host-level fact, so it belongs on the host document, not the property:

- `hosts/{uid}.trialConsumedAt` is set inside the same transaction that first grants an entitlement.
- The activation callable reads it and omits `trial_end` entirely for every subsequent property, and the pre-checkout screen renders the no-trial variant of the copy — charged today, at this price.
- Because the check is server-side and transactional, two properties activated in parallel cannot both take the trial.

## 5 Webhook endpoint

A single `onRequest` function, `stripeWebhook`, in `australia-southeast1`.

```ts
const event = stripe.webhooks.constructEvent(
  req.rawBody, req.headers["stripe-signature"], webhookSecret
);
```

`req.rawBody` is required — Firebase Functions v2 provides it, but any body-parsing middleware inserted ahead of it will silently break signature verification.

### Idempotency and ordering

Two distinct problems, and they need two mechanisms.

**Idempotency** (§5.7, "a Stripe retry cannot activate a property twice"): a Firestore transaction creates `stripeEvents/{event.id}` and applies the entitlement change together. If the document already exists, the transaction aborts and the endpoint returns 200 without re-applying. The ledger document holds only the event id, type, `created`, the property it touched and the resulting lifecycle — no payload, no personal information.

**Ordering**: Stripe does not guarantee delivery order, so a stale `customer.subscription.updated` can arrive after a newer one. Two guards:

- Store `property.billing.lastEventCreated`; discard any subscription-scoped event with an older `event.created`.
- For every `customer.subscription.*` event, treat the payload as a *trigger* and re-read the subscription from the API before writing. The subscription object is the source of truth for `status`, `current_period_end` and `trial_end`; the event payload is only a snapshot of when it was queued.

Return 200 for anything we do not handle, and for anything already in the ledger. Return 500 only for genuine transient failures, so Stripe's retry is doing useful work rather than replaying a permanent error.

Allowlist [Stripe's published IP ranges](https://docs.stripe.com/ips) on the endpoint as defence in depth. Signature verification is the control; the allowlist is the belt.

### Events consumed

| Event | Firestore effect | `BillingEvent` |
|---|---|---|
| `checkout.session.completed` | Bind `stripeCustomerId`/`stripeSubscriptionId` to the property; set `trialConsumedAt` if a trial was granted; unlock routing URL + QR kit | `trial_started` |
| `customer.subscription.updated` | Re-read subscription; map status (§6); write `currentPeriodEndsAt`, `trialEndsAt`, `cancelAtPeriodEnd` | per §6 |
| `customer.subscription.deleted` | End of the paid cycle after cancellation, or terminal dunning failure | `period_ended` |
| `invoice.paid` | `lastPaymentAt`; clear grace deadline | `invoice_paid` |
| `invoice.payment_failed` | Open the 14-day grace window; record `suspendAt`; queue the §5.6 failed-payment email | `payment_failed` |
| `customer.subscription.trial_will_end` | Queue the §5.6 trial expiry notice — but see §7 | — |
| `charge.dispute.created`, `charge.refunded` | Record for the §5.7 monthly reconciliation. No automatic entitlement change; §4.3 puts refund authority with a named owner | — |

## 6 Stripe status → `PropertyLifecycle`

This mapping is the whole integration in one table.

| Stripe subscription `status` | `PropertyLifecycle` | Wall served? | QR kit? |
|---|---|---|---|
| `trialing` | `trialing` | yes | yes |
| `active` | `active` | yes | yes |
| `past_due` | `grace_period` | **yes** — §5.7: the wall stays fully live while the card is retried | yes |
| `unpaid` | `suspended` | no — fallback page | no |
| `canceled` | `cancelled_pending_end`, then `dormant` at period end | until `serviceEndsAt` | until `serviceEndsAt` |
| `incomplete`, `incomplete_expired` | stays `draft` | no | no |

`isPubliclyReadable` in `src/domain/property.ts` already serves `trialing`, `active` and `grace_period` and refuses `suspended` — the mapping above was chosen to fit the code that exists rather than the other way round.

**One-click cancellation** (§4.3, "effective at the end of the paid cycle") is `subscriptions.update(id, { cancel_at_period_end: true })`. That leaves `status: 'active'` with `cancel_at_period_end: true`, which is *not* a status change. Stripe sends a plain `customer.subscription.updated` — the same event as any other edit — so the lifecycle move to `cancelled_pending_end` must key off the flag, not the status. Missing this is the most likely single bug in this build: the host clicks cancel, gets a confirmation, and the dashboard goes on saying "Active" until the period ends.

The reverse is also true and worth building now: setting `cancel_at_period_end` back to `false` reinstates the subscription at any point before the period ends. That is the cheapest possible win-back, and it maps to the `reactivated` event already in `src/domain/billing.ts`.

## 7 Resolving the handbook's two flagged conflicts

§5.7 and §5.6 each carry a *Confirm* that this design can answer concretely.

**Dunning (§5.7).** The handbook describes one 14-day grace period; Stripe's Smart Retries will independently attempt the card several times inside that window. They do not conflict if the Dashboard is configured to match. All three settings live under **Billing → Revenue recovery → Retries**:

- **Maximum duration: 2 weeks.** Smart Retries does not take an arbitrary number of days — the menu is 1 week, 2 weeks, 3 weeks, 1 month or 2 months. Two weeks lands exactly on the handbook's 14 days, which is why the handbook's figure needs no amendment. (A custom retry schedule is the alternative: up to three retries, each a chosen number of days after the previous attempt.)
- **After the final attempt: "Mark the subscription as unpaid."** The Dashboard offers exactly three behaviours — cancel the subscription, mark it unpaid, or leave it overdue in `past_due`. `unpaid` maps to `suspended` and keeps the subscription reactivatable, which §5.7 requires; `canceled` would destroy it and force a new checkout on a host whose card merely expired; leaving it `past_due` would keep the wall live indefinitely without payment, which §5.7 forbids. Under `unpaid`, Stripe keeps generating invoices in `draft` — harmless, and useful for the §5.7 monthly reconciliation.
- Turn **off** Stripe's own automatic dunning emails (**Billing → Revenue recovery → Customer emails**). §5.6 owns that sequence, and two differently-worded failure emails from the same company is exactly the §4.3 consistency failure.

**A hard decline is not retried, and this changes the §5.6 copy.** Where the issuer returns a hard decline code, Stripe schedules the retries but does not execute them: the counter increments, no charge is attempted, and nothing happens until a new payment method is attached. So the failed-payment email must not say the card will be tried again — it must state the suspension date and drive the host to the update route. Wording that promises retries would be false for a materially large share of failures. This is an amendment the §5.6 email table needs before it is written.

**The 14-day annual renewal notice (§5.6).** Do not build this on `invoice.upcoming`. That webhook fires on an account-wide "upcoming invoice" setting shared with the monthly plan — a 14-day lead would send monthly hosts a renewal notice halfway through every cycle. Schedule the notice from `property.billing.currentPeriodEndsAt` with a Cloud Scheduler job, filtered to annual subscriptions. The same reasoning applies to the trial expiry notice: `customer.subscription.trial_will_end` fires at three days, and if §5.6 wants a different lead time, schedule it rather than bend the notice to Stripe's clock.

## 8 Payment-method updates and cancellation

§4.3 is emphatic that cancellation is self-service in the dashboard **and nowhere else**, and §5.7 requires the exact end date confirmed by email. That splits the two flows:

- **Payment method update** — Customer Portal, launched from our billing page and from the §5.6 failed-payment email, created with `flow_data: { type: "payment_method_update" }` so the host lands directly on the card form. This is the "secure update route" §5.7 asks for: the link is a short-lived server-created session, so the email carries no credential.
- **Cancellation** — our own callable, not the portal. We must render the exact end date, confirm it by email, and state what happens to the content afterwards (§4.3). A portal cancel flow would hand that copy to Stripe.

Portal configuration must have plan-switching **disabled**. Monthly↔annual movement mid-cycle would create prorations the handbook has no policy for.

## 9 Keys, secrets and client surface

- **Restricted API key (`rk_`), not a secret key.** Permissions needed: Checkout Sessions `write`, Customers `write`, Subscriptions `write`, Billing Portal Sessions `write`, Prices `read`, Products `read`, Promotion Codes `read`, Invoices `read`, Disputes `read`. Nothing else — no Charges write, no Payouts, no Tax registrations write.
- **Storage: Google Secret Manager**, reached through `defineSecret()` in Firebase Functions, which is Secret Manager underneath. The current `functions/.env.example` placeholders (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) should become `defineSecret("STRIPE_RESTRICTED_KEY")` and `defineSecret("STRIPE_WEBHOOK_SECRET")` before any live key exists, so there is never a moment where the committed pattern is an env file.
- **Separate keys and separate webhook secrets per environment.** The isolated preview project referenced in GC-04 gets its own sandbox.
- **`VITE_STRIPE_PUBLISHABLE_KEY` in `.env.example` should be removed.** With hosted Checkout we redirect to `session.url` and never load Stripe.js, so there is no publishable key, no Stripe.js in the bundle, and no Stripe CSP directives to add to `index.html`. If embedded Checkout is ever adopted, the key and `script-src`/`frame-src`/`connect-src https://*.stripe.com` come back together.
- **Pre-commit hook** matching `/[sr]k_(live|test)_/` across the tree, alongside the existing checks.
- No key, customer id or subscription id is ever returned to the browser. The billing page reads `property.billing`, which holds dates and state only.

## 10 Build order

Each item is independently provable in the Stripe CLI and the emulator before the next starts.

| ID | Work | Proof |
|---|---|---|
| ST-00 | Stripe CLI on PATH — **done**, v1.50.10 via `npm i -g @stripe/cli` | `stripe docs` and `stripe --version` respond |
| ST-03/04/05 | **Server written 8 Sep 2026; client activation screen added 8 Sep 2026.** `billingPolicy.ts` (versioned §6.3.4 copy, deterministic price and date rendering) + 14 unit tests; `stripeActivation.ts` — `activationOptions` (country gate, trial eligibility, live price quote, both disclosure variants) and `createActivationCheckout` (acknowledgement record, idempotent Customer creation, session with explicit `trial_end`). Client: `src/ui/host/billingStore.ts` (callable wrappers) and `ActivatePanel` inside `HostBillingPage` — a draft property's billing screen establishes the billing country (§3a layer 1) by guessing it from the browser's locale and time zone (`billingCountry.ts`, one click to overrule, and the question is still asked outright when the browser names neither served country), quotes the plan, renders the server's disclosure + acknowledgement checkbox verbatim, and on a ticked box redirects to `session.url`; the return from Stripe watches the property document rather than trusting the redirect. `createActivationCheckout` now persists `hosts/{uid}.billingCountry` on commitment. **Not yet done:** the activation callables have no unit tests (ST-05 emulator pass); end-to-end run needs the sandbox key + emulator. | `npm run check` green (334 tests); browser proof pending the restricted key |
| ST-02a | **Done 8 Sep 2026.** `stripeBilling.ts` (§6 mapping, sales allowlist, handled-event list) + 15 unit tests; `stripeConfig.ts` (Secret Manager binding, lazy client); `stripeWebhook.ts` (signature verification, event ledger, entitlement transaction); `hosts`/`stripeEvents` denied in `firestore.rules` + 3 rules tests; env examples corrected | `npm run check` green (307 tests); `npm run test:emulators` green (35 tests) |
| ST-01 | **Sandbox catalogue done 8 Sep 2026** in `DigiStayBook sandbox` (`acct_1UDAcoE6RXRx7LYa`). Account default tax behaviour set to **Automatic** (`inferred_by_currency`). One Product `prod_VDgefH6xk8OXHp` "DigiStayBook". `price_1UDFHNE6RXRx7LYaR5bQPPOg` monthly (AUD 1500 / USD 1000, lookup `dsb_monthly`) and `price_1UDFHSE6RXRx7LYavuue90cL` annual (AUD 15000 / USD 10000, lookup `dsb_annual`), both `tax_behavior` unset. Price ids in `functions/.env.digistaybook-cbert` (not secrets, per §9). Amounts approved (ST-D1). **Still open:** restricted key + webhook secret into Secret Manager; live-mode catalogue. | `stripe prices retrieve` shows AUD and USD on both prices, `tax_behavior` unset — **verified** |
| ST-02 | `stripeWebhook` skeleton: signature verification, event ledger, 200/500 discipline. No entitlement writes yet. | `stripe trigger` replayed twice writes one ledger row |
| ST-03 | Host↔Customer binding; `hosts/{uid}.stripeCustomerId`, created lazily and idempotently | Two parallel activations create one Customer |
| ST-04 | Billing acknowledgement event and pre-checkout screen with §6.3.4 copy, both variants, plus the §3a layer-1 country gate and `hosts/{uid}.billingCountry` | Wording and version stored; an unticked box cannot create a session; a GB host is refused before any session exists |
| ST-05 | `createActivationCheckout` callable with `trial_end`, trial-eligibility transaction, promotion codes, `billing_address_collection` | Second property gets no trial; a 100% code activates with no charge |
| ST-06 | Entitlement fulfilment: `checkout.session.completed` → lifecycle, routing URL, QR kit unlock, plus the §3a layer-2 country check | Wall reachable only after the webhook, never after the redirect; a mismatched billing country does not activate |
| ST-06a | Radar allowlist rule and value list (§3a layer 3) | A non-AU/US card is declined on the first charge |
| ST-07 | Full status mapping (§6) including the `cancel_at_period_end` trap; `invoice.paid`, `invoice.payment_failed` | `stripe trigger` for each status lands the right lifecycle |
| ST-08 | Dunning configuration, grace deadline and suspension; fallback page verified end to end | Card decline → wall stays live → day 14 → fallback page, no 404 |
| ST-09 | **Cancel done 10 Sep 2026.** `stripeCancellation.ts` — `cancelSubscription` sets `cancel_at_period_end` and returns the exact end date for the confirmation screen; `resumeSubscription` clears it while the period still runs; both record to `properties/{id}/billingActions` and neither writes `lifecycle` (the webhook does). Client: the cancel and undo controls on `HostBillingPage`, plus the next-charge sentence the screen never had. 14 unit tests. **Not yet done:** the portal payment-method-update flow, and the confirmation email — there is no mail transport in `functions/` at all, so the exact date is stated on screen only. | Cancel leaves the wall live to `serviceEndsAt` — **verified in unit tests**; email states the date — **not built** |
| ST-10 | Reconciliation export for the §5.7 monthly review; dispute and refund recording | Stripe subscription states match Firestore for every property |

ST-01 through ST-03 are safe to build against a sandbox before any of the §11 decisions land. ST-D1, ST-D2 and ST-D12 — the price, the tax treatment and the acknowledgement wording the host is asked to accept — are now all decided, so ST-04 and ST-05 are unblocked against the sandbox.

## 11 Open decisions

Owner decisions, in the handbook's own register format. None of these are engineering calls.

| ID / status | Handbook reference | Decision required | Blocks |
|---|---|---|---|
| **ST-D1 — decided 8 Sep 2026 (Cara)** | §4.1 *Confirm*; §6.3.4 | **Approved: AUD $15/$150 (GST-inclusive), USD $10/$100 (tax-exclusive), annual = 10× monthly.** Rationale in §3. Sandbox Prices created at these amounts (ST-01). One carry-over for the live catalogue only: confirm A$15 still reads as a clean price against the spot rate on the day the live Prices are created. | live catalogue |
| **ST-D2 — decided 8 Sep 2026** | §4.1 *Confirm*; §5.11 | **No Australian GST registration and no US state registrations at launch.** Therefore `automatic_tax: false`, no tax line on any invoice, and account default tax behaviour set to **Automatic** so no immutable `tax_behavior` is written to a Price (§3). | ST-01, ST-04 |
| **ST-D11 — new; scheduled, not open** | §4.1; §8.1; §8.2 | Two triggers that must be watched rather than discovered. (a) **Australian GST**: registration becomes obligatory at a turnover threshold your adviser will confirm; crossing it cuts AUD revenue by ~9% overnight (§3). (b) **US state sales tax**: economic-nexus thresholds are per state and reach inbound digital services. Stripe's threshold monitoring flags potential obligations but is information, not a determination. Add both to the §8.2 monthly financial review so the flip is planned. | ST-10 |
| **ST-D3 — deferred with ST-D2** | §4.1 | The product tax code, taken from Stripe's Tax Codes API rather than guessed. Digital/SaaS-specific — explicitly **not** the generic electronically-supplied-services code, which is too broad for US state-level taxability. Not needed while `automatic_tax` is off, but required before it is switched on. Route legal correctness to the tax adviser. | ST-D11 |
| **ST-D4 — decided 8 Sep 2026** | §2 *Confirm* (first market); §5.11; A.7 | **Allowlist: Australia and the United States only.** Two currencies (AUD, USD). UK and EU are out of scope at launch, which removes the VAT question entirely rather than deferring it. Enforced by the three-layer gate in §3a, because dropping the currencies is not itself a gate. Opening a further market is a deliberate act requiring its own jurisdiction review. | ST-01, ST-05 |
| **ST-D5** | §5.7 *Confirm* | Approve the retry configuration in §7: Smart Retries maximum duration **2 weeks**, after-retries behaviour **mark as unpaid**, Stripe's own dunning emails **off**. This closes the handbook's open dunning *Confirm* without amending the 14-day figure. | ST-08 |
| **ST-D6** | §5.6 | Confirm the trial expiry notice lead time. Stripe's `trial_will_end` fires at three days; anything else is a scheduled job. | ST-07 |
| **ST-D10 — handbook amendment** | §5.6 failed-payment email | The §5.6 email table implies the card will be retried across the grace period. Stripe does not retry hard declines at all (§7). Reword the failed-payment email to state the suspension date and the update route without promising a retry. | ST-08 |
| **ST-D7** | §4.3 *Confirm* | Refund authority — who may approve a goodwill refund, to what value, recorded where. Until this exists, refunds are Dashboard-only and manual, and no code path issues one. | ST-10 |
| **ST-D8** | §4.1 *Confirm* | "Unlimited guest uploads" on the pricing page against per-gigabyte storage cost. Not a Stripe decision, but it is priced by ST-D1 and stated in the same copy. | ST-04 |
 is dropped and the price carries its own symbol; with two dollar currencies on sale, prices render as **"A$15.00"** and **"US$10.00"** so the Host can tell which dollar they are agreeing to. (b) §6.3.4 supplies **no wording for a second property**, which takes no trial under §4.1. `chargedTodayDisclosure` in `billingPolicy.ts` is approved as the second-property copy. Both are recorded here as an amendment to the §6.3.4 wording; the handbook text itself is unchanged pending its next revision. | — |
| **ST-D13 — decided 9 Sep 2026 (Cara)** | §6.3.4; §4.1 | A promotion code may be entered **in our own screen**, before Stripe, and the quote is then **re-quoted rather than annotated**: the §6.3.4 disclosure and the acknowledgement are rebuilt around what the card is actually charged, so a 100% code produces "I understand I will be billed A$0.00 on {date}". The new discounted sentences live in `billingPolicy.ts` and mint policy version **`handbook-6.3.4-v2`**; the undiscounted sentences are unchanged. The renewal clause follows the coupon's own `duration`, because a `forever` code and a `once` code renew at different prices. Stripe refuses `discounts` and `allow_promotion_codes` on one Session, so a resolved code **replaces** Stripe's own field and a Host who types nothing still meets it, exactly as §4.1 assumed. The field is **collapsed** behind "Have a promotion code?", matching Stripe's own presentation and the plan's note that codes are not marketed. | ST-D12 |
| **ST-D9 — cross-checked 8 Sep 2026; one item to decide** | — | `stripe_implementation_planner` was run against the sandbox and agrees with this design on every structural choice. **Divergence: flexible billing mode.** Stripe now makes `billing_mode: flexible` the default for new subscriptions on API version `2025-09-30.clover`+; the installed SDK (`stripe@22.6.1`, Basil) still defaults to `classic`, so the Checkout Session in §4 currently creates `classic` subscriptions. Flexible mode changes proration, trial re-entry and cancellation maths — mostly in ways that suit the one-click cancel / reactivate flow in §6 — but it is a one-way migration and is incompatible with billing thresholds and legacy usage billing (neither used here). Decide before ST-05: set `subscription_data.billing_mode.type: "flexible"` explicitly, or stay on `classic` until an SDK/API upgrade. | ST-05 |
